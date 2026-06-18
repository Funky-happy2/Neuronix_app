import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { questPosts, questMessages, tradeMessages, loginCodes } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { WebSocketServer, WebSocket } from "ws";
import { getDimension, getDimensionGroup, hasFullStoneSet, dimensionBuffMultipliers, dimensionUnlockState, type DimensionDef } from "@shared/dimensions";

interface LobbyPlayer {
  id: number;
  username: string;
  ws: WebSocket;
  status: "idle" | "queued" | "in_game";
  gameId?: string;
  difficulty?: string;
}

interface GameRoom {
  id: string;
  gameId: string;
  players: { id: number; username: string; ws: WebSocket; score: number; ready: boolean }[];
  state: "waiting" | "playing" | "finished";
  currentQuestion: number;
  startTime?: number;
  spectators: { id: number; ws: WebSocket }[];
  ranked?: RankedMode;
}

interface PvpRoom {
  id: string;
  players: { id: number; username: string; ws: WebSocket; score: number; answered: number; currentAnswer?: number }[];
  questions: { question: string; options: string[]; correctIndex: number; explanation?: string | null }[];
  currentQuestion: number;
  state: "waiting" | "playing" | "finished";
  wager: number;
  answeredThisRound: Set<number>;
  questionStartTime: number;
  botTimers?: ReturnType<typeof setTimeout>[];
  roundTimeout?: ReturnType<typeof setTimeout>;
  spectators: { id: number; ws: WebSocket }[];
  ranked?: RankedMode;
}

const lobby = new Map<number, LobbyPlayer>();
const queue = new Map<string, number[]>();
const rooms = new Map<string, GameRoom>();
const pvpRooms = new Map<string, PvpRoom>();
const pvpQueue: { id: number; wager: number; queuedAt: number }[] = [];
const lastActive = new Map<number, number>();
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

// ─── Live streaming ──────────────────────────────────────────────────────────
interface StreamChatMsg { from: string; fromId: number; text: string; ts: number; }
interface LiveStream {
  streamerId: number;
  streamerName: string;
  gameId: string;
  gameName: string;
  score: number;
  startedAt: number;
  viewers: Map<number, { id: number; username: string; ws: WebSocket }>;
  chat: StreamChatMsg[];
  boosters: Set<number>;     // viewers who have boosted (one each)
  commenters: Set<number>;   // unique viewers who have chatted
  peakViewers: number;
  gemsEarned: number;        // gems paid out so far this stream
}
const streams = new Map<number, LiveStream>();

const STREAM_BOOST_GEMS = 3;       // gems a streamer gets per viewer boost
const STREAM_GEM_CAP = 60;         // max gems a single stream can pay out
const STREAM_END_BONUS_CAP = 30;   // max gems from the streaming-time reward

function streamSummary(s: LiveStream) {
  return {
    streamerId: s.streamerId,
    streamerName: s.streamerName,
    gameId: s.gameId,
    gameName: s.gameName,
    score: s.score,
    viewerCount: s.viewers.size,
    startedAt: s.startedAt,
  };
}

function sendToStream(s: LiveStream, msg: object) {
  const str = JSON.stringify(msg);
  const streamer = lobby.get(s.streamerId);
  if (streamer && streamer.ws.readyState === WebSocket.OPEN) streamer.ws.send(str);
  s.viewers.forEach((v) => {
    if (v.ws.readyState === WebSocket.OPEN) v.ws.send(str);
  });
}

// Relay a message to one specific user (used for WebRTC signaling).
function sendToUser(userId: number, msg: object) {
  const target = lobby.get(userId);
  if (target && target.ws.readyState === WebSocket.OPEN) target.ws.send(JSON.stringify(msg));
}

function broadcastStreamsList() {
  const list = Array.from(streams.values()).map(streamSummary);
  const msg = JSON.stringify({ type: "streams_list", streams: list });
  lobby.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
  });
}

// Walled-garden chat: strip anything URL-like and cap length (kid-safe).
function sanitizeChat(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .replace(/\S+\.(com|net|org|io|gg|xyz|co)\S*/gi, "")
    .slice(0, 140)
    .trim();
}

// ─── Team multiplayer ────────────────────────────────────────────────────────
interface TeamRoom {
  id: string;
  gameId: string;
  difficulty: string;
  teams: { name: string; players: { id: number; username: string; ws: WebSocket | null; score: number; done: boolean; isBot: boolean }[] }[];
  state: "playing" | "finished";
}
const teamRooms = new Map<string, TeamRoom>();
// queued solo players waiting to be grouped into teams, keyed by gameId
const teamQueue = new Map<string, { id: number; difficulty: string; queuedAt: number }[]>();

// ─── Parties (invite friends, play together) ─────────────────────────────────
interface Party {
  id: string;
  hostId: number;
  members: { id: number; username: string }[];
  pendingInvites: number[];
}
const parties = new Map<string, Party>();
const userParty = new Map<number, string>(); // userId -> partyId

function partySummary(p: Party) {
  return { id: p.id, hostId: p.hostId, members: p.members, pendingInvites: p.pendingInvites };
}
function broadcastParty(p: Party) {
  const msg = JSON.stringify({ type: "party_update", party: partySummary(p) });
  for (const m of p.members) {
    const lp = lobby.get(m.id);
    if (lp && lp.ws.readyState === WebSocket.OPEN) lp.ws.send(msg);
  }
}
function disbandParty(p: Party, reason = "Party disbanded") {
  for (const m of p.members) {
    userParty.delete(m.id);
    const lp = lobby.get(m.id);
    if (lp && lp.ws.readyState === WebSocket.OPEN) lp.ws.send(JSON.stringify({ type: "party_disbanded", reason }));
  }
  parties.delete(p.id);
}
function removeFromParty(userId: number, kicked = false) {
  const pid = userParty.get(userId);
  if (!pid) return;
  const p = parties.get(pid);
  userParty.delete(userId);
  if (!p) return;
  p.members = p.members.filter((m) => m.id !== userId);
  if (kicked) {
    const lp = lobby.get(userId);
    if (lp && lp.ws.readyState === WebSocket.OPEN) lp.ws.send(JSON.stringify({ type: "party_kicked" }));
  }
  if (p.members.length === 0) { parties.delete(p.id); return; }
  if (p.hostId === userId) p.hostId = p.members[0].id; // host left → promote next member
  broadcastParty(p);
}

// ─── Ranked mode ─────────────────────────────────────────────────────────────
const RANKED_UNLOCK_LEVEL = 50;   // ranked unlocks at this account level
const PLACEMENT_GAMES = 5;        // placement matches before you get a rank
const rankedQueue: { quiz: number[]; gravity: number[] } = { quiz: [], gravity: [] };

// Pre-game ban/draft. Quiz: 3 topics (ban 1) + battle powerups (ban 2 each).
// Gravity: 3 modifiers (ban 1) that change the race; no abilities.
const RANKED_BANNABLE_ABILITIES = [
  { id: "bp-shield-potion", name: "Shield" },
  { id: "bp-time-freeze", name: "Time Freeze" },
  { id: "bp-double-damage", name: "Double Points" },
  { id: "bp-answer-sabotage", name: "Sabotage" },
  { id: "bp-time-drain", name: "Time Drain" },
  { id: "bp-time-warp", name: "Time Warp" },
  { id: "bp-triple-points", name: "Triple Points" },
  { id: "bp-mega-time", name: "Mega Time" },
];
const RANKED_ABILITY_BANS = 2; // each player bans this many abilities
const GRAVITY_MODIFIERS = [
  { key: "low-gravity", name: "🌀 Low Gravity" },
  { key: "hyperspeed", name: "⚡ Hyperspeed" },
  { key: "spike-storm", name: "🔻 Spike Storm" },
  { key: "tiny-player", name: "🔬 Tiny Pilot" },
  { key: "star-rush", name: "✨ Star Rush" },
];
interface RankedDraft {
  id: string;
  mode: RankedMode;
  pickKind: "topic" | "modifier";
  picks: { key: string; name: string }[];      // topics (quiz) or modifiers (gravity)
  abilities: { id: string; name: string }[];    // battle powerups (quiz only)
  players: { id: number; username: string; ws: WebSocket; bannedPick: string | null; bannedAbilities: string[]; done: boolean }[];
  timeout?: ReturnType<typeof setTimeout>;
}
const rankedDrafts = new Map<string, RankedDraft>();

type RankedMode = "quiz" | "gravity";
interface RankedStats {
  elo: number; peakElo: number;
  placementsPlayed: number; placementWins: number; placed: boolean;
  wins: number; losses: number;
}

function normalizeRanked(raw: any): RankedStats {
  const r = raw || {};
  return {
    elo: typeof r.elo === "number" ? r.elo : 1000,
    peakElo: typeof r.peakElo === "number" ? r.peakElo : 0,
    placementsPlayed: r.placementsPlayed || 0,
    placementWins: r.placementWins || 0,
    placed: !!r.placed,
    wins: r.wins || 0,
    losses: r.losses || 0,
  };
}

const RANK_TIERS: { min: number; name: string; emoji: string }[] = [
  { min: 1900, name: "Singularity", emoji: "🕳️" },
  { min: 1700, name: "Mastermind", emoji: "🧠" },
  { min: 1500, name: "Genius", emoji: "💎" },
  { min: 1300, name: "Prodigy", emoji: "🌟" },
  { min: 1100, name: "Expert", emoji: "🧪" },
  { min: 900, name: "Specialist", emoji: "⚡" },
  { min: 750, name: "Apprentice", emoji: "⚗️" },
  { min: 0, name: "Rookie", emoji: "🔬" },
];

function rankFromElo(elo: number, placed: boolean): { name: string; emoji: string; elo: number } {
  if (!placed) return { name: "Unranked", emoji: "❓", elo };
  const tier = RANK_TIERS.find(t => elo >= t.min) || RANK_TIERS[RANK_TIERS.length - 1];
  return { name: tier.name, emoji: tier.emoji, elo };
}

// ─── Auto-translation ────────────────────────────────────────────────────────
// In-memory cache so each unique string is only translated once per language.
const translateCache = new Map<string, string>(); // key `${target}:${text}`
// MyMemory wants regional codes for some languages.
const MYMEMORY_LANG: Record<string, string> = { zh: "zh-CN", pt: "pt-BR" };
const SUPPORTED_LANGS = new Set(["es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "hi", "it", "ru"]);

async function translateOne(text: string, target: string): Promise<string> {
  const key = `${target}:${text}`;
  const cached = translateCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const pair = `en|${MYMEMORY_LANG[target] || target}`;
    const email = process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : "";
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}${email}`;
    const res = await fetch(url);
    const data: any = await res.json();
    const out = data?.responseData?.translatedText;
    const result = (typeof out === "string" && out.trim() && !out.toUpperCase().includes("MYMEMORY WARNING") && !out.toUpperCase().includes("QUERY LENGTH LIMIT"))
      ? out : text;
    translateCache.set(key, result);
    return result;
  } catch {
    return text;
  }
}

function broadcastLobby() {
  const players = Array.from(lobby.values()).map((p) => ({
    id: p.id,
    username: p.username,
    status: p.status,
  }));
  const msg = JSON.stringify({ type: "lobby_update", players });
  for (const p of lobby.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
  }
}

function generateRoomId() {
  return "room_" + Math.random().toString(36).substring(2, 8);
}

function relayToSpectators(spectators: { id: number; ws: WebSocket }[], msg: object) {
  const str = JSON.stringify(msg);
  for (const s of spectators) {
    if (s.ws && s.ws.readyState === WebSocket.OPEN) s.ws.send(str);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.use((req, _res, next) => {
    if (req.isAuthenticated() && req.user) {
      lastActive.set(req.user.id, Date.now());
    }
    next();
  });

  // Temporary login codes: force-logout once the 10-minute guest window elapses.
  app.use((req, res, next) => {
    const exp = (req.session as any)?.tempExpiresAt;
    if (exp && Date.now() > Number(exp)) {
      return req.logout(() => {
        req.session?.destroy(() => {
          if (req.path.startsWith("/api/")) return res.status(401).json({ message: "Guest pass expired" });
          next();
        });
      });
    }
    next();
  });

  // Guest passes are read-mostly: block spending and trading.
  const RESTRICTED_BLOCK_PREFIXES = [
    "/api/shop/buy", "/api/shop/refund", "/api/shop/mystery-box", "/api/shop/upgrade-item",
    "/api/potions/buy", "/api/rebirth", "/api/trades", "/api/quests",
  ];
  app.use((req, res, next) => {
    if ((req.session as any)?.restricted && req.method !== "GET" && req.method !== "HEAD") {
      if (RESTRICTED_BLOCK_PREFIXES.some((p) => req.path.startsWith(p))) {
        return res.status(403).json({ message: "Guest passes can't spend coins or trade." });
      }
    }
    next();
  });

  const DEFAULT_ULTRA_ADMIN = "Funky_happy2";
  let ULTRA_ADMIN_USERNAME = DEFAULT_ULTRA_ADMIN;

  function isUltraAdmin(username: string) {
    return username === ULTRA_ADMIN_USERNAME;
  }

  (async () => {
    try {
      const dbUltra = await storage.getUltraAdminUser();
      if (dbUltra) {
        ULTRA_ADMIN_USERNAME = dbUltra.username;
        if (!dbUltra.isAdmin) await storage.updateUser(dbUltra.id, { isAdmin: true } as any);
      } else {
        const adminUser = await storage.getUserByUsername(DEFAULT_ULTRA_ADMIN);
        if (adminUser) {
          await storage.setUltraAdmin(adminUser.id);
          if (!adminUser.isAdmin) await storage.updateUser(adminUser.id, { isAdmin: true } as any);
        }
      }
    } catch (e) {}

    async function seedWithRetry(attempt = 1): Promise<void> {
    try {
      const existing = await storage.getShopItems();
      {
        const { db } = await import("./storage");
        const { shopItems } = await import("@shared/schema");
        const items = [
          { id: "avatar-robot", name: "Robot", description: "A cool science robot avatar", category: "avatar", price: 100, icon: "Bot", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "avatar-alien", name: "Alien Explorer", description: "An alien scientist avatar", category: "avatar", price: 200, icon: "Sparkles", rarity: "uncommon", requiredLevel: 3, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "avatar-ninja", name: "Ninja Scientist", description: "A stealthy science ninja", category: "avatar", price: 300, icon: "Swords", rarity: "uncommon", requiredLevel: 5, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "avatar-wizard", name: "Science Wizard", description: "A magical science wizard", category: "avatar", price: 500, icon: "Wand2", rarity: "rare", requiredLevel: 7, requiredRebirth: 0, requiredXp: 500, rewardSource: null },
          { id: "avatar-dragon", name: "Lab Dragon", description: "A fire-breathing lab dragon", category: "avatar", price: 800, icon: "Flame", rarity: "rare", requiredLevel: 9, requiredRebirth: 0, requiredXp: 1000, rewardSource: null },
          { id: "avatar-phoenix", name: "Phoenix", description: "Rise from the ashes", category: "avatar", price: 1200, icon: "Bird", rarity: "epic", requiredLevel: 11, requiredRebirth: 1, requiredXp: 0, rewardSource: null },
          { id: "avatar-crystal", name: "Prism Knight", description: "An armored knight whose body refracts light into dazzling prisms", category: "avatar", price: 1500, icon: "Diamond", rarity: "epic", requiredLevel: 13, requiredRebirth: 2, requiredXp: 0, rewardSource: null },
          { id: "avatar-galaxy", name: "Galaxy Explorer", description: "Explorer of the cosmos", category: "avatar", price: 2000, icon: "Star", rarity: "legendary", requiredLevel: 15, requiredRebirth: 3, requiredXp: 5000, rewardSource: null },
          { id: "badge-glow", name: "Glowing Badges", description: "Your badges glow with a soft light effect", category: "badge_style", price: 150, icon: "Star", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "badge-sparkle", name: "Sparkle Badges", description: "Badges have a sparkle animation", category: "badge_style", price: 350, icon: "Sparkles", rarity: "uncommon", requiredLevel: 3, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "badge-flame", name: "Flame Badges", description: "Badges burn with animated flames", category: "badge_style", price: 600, icon: "Flame", rarity: "rare", requiredLevel: 7, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "badge-rainbow", name: "Rainbow Badges", description: "Badges cycle through rainbow colors", category: "badge_style", price: 1000, icon: "Palette", rarity: "epic", requiredLevel: 10, requiredRebirth: 1, requiredXp: 0, rewardSource: null },
          { id: "badge-crystal", name: "Crystal Badges", description: "Badges have a crystalline shimmer effect", category: "badge_style", price: 1500, icon: "Diamond", rarity: "epic", requiredLevel: 13, requiredRebirth: 2, requiredXp: 0, rewardSource: null },
          { id: "badge-legendary", name: "Legendary Frame", description: "Golden animated frame around all your badges", category: "badge_style", price: 2500, icon: "Crown", rarity: "legendary", requiredLevel: 16, requiredRebirth: 3, requiredXp: 10000, rewardSource: null },
          { id: "deco-stars", name: "Floating Stars", description: "Sparkly stars drift gently around your screen", category: "decoration", price: 200, icon: "Sparkles", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "deco-bubbles", name: "Soap Bubbles", description: "Iridescent rainbow soap bubbles drift and pop across your screen", category: "decoration", price: 300, icon: "Circle", rarity: "uncommon", requiredLevel: 3, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "deco-lightning", name: "Tesla Coil", description: "Arcs of purple electricity jump between coils at the corners of your screen", category: "decoration", price: 500, icon: "Zap", rarity: "rare", requiredLevel: 5, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "deco-fireworks", name: "Firefly Swarm", description: "Glowing fireflies wander randomly across your screen", category: "decoration", price: 800, icon: "Flame", rarity: "rare", requiredLevel: 8, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "deco-aurora", name: "Aurora Borealis", description: "Beautiful northern lights shimmer and shift behind your game", category: "decoration", price: 1200, icon: "Rainbow", rarity: "epic", requiredLevel: 12, requiredRebirth: 1, requiredXp: 2000, rewardSource: null },
          { id: "deco-galaxy", name: "Warp Speed", description: "Stars streak past like you are flying through hyperspace at light speed", category: "decoration", price: 2000, icon: "Star", rarity: "legendary", requiredLevel: 15, requiredRebirth: 2, requiredXp: 5000, rewardSource: null },
          { id: "follower-atom", name: "Atom Follower", description: "A tiny atom orbits your mouse cursor", category: "follower", price: 250, icon: "Atom", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "follower-rocket", name: "Rocket Trail", description: "A mini rocket follows your mouse with a flame trail", category: "follower", price: 400, icon: "Rocket", rarity: "uncommon", requiredLevel: 4, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "follower-sparkle", name: "Sparkle Trail", description: "Your cursor leaves a trail of sparkles", category: "follower", price: 600, icon: "Sparkles", rarity: "rare", requiredLevel: 6, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "follower-comet", name: "Comet Tail", description: "A glowing comet chases your cursor across the screen", category: "follower", price: 900, icon: "Star", rarity: "rare", requiredLevel: 9, requiredRebirth: 0, requiredXp: 1500, rewardSource: null },
          { id: "follower-dna", name: "DNA Helix", description: "A spinning DNA strand follows your mouse", category: "follower", price: 1300, icon: "Dna", rarity: "epic", requiredLevel: 11, requiredRebirth: 1, requiredXp: 0, rewardSource: null },
          { id: "follower-lightning", name: "Lightning Bolt", description: "Bolts of lightning connect to your cursor", category: "follower", price: 1800, icon: "Zap", rarity: "legendary", requiredLevel: 14, requiredRebirth: 2, requiredXp: 3000, rewardSource: null },
          { id: "powerup-lucky-answer", name: "Lucky Answer", description: "Eliminates one wrong answer in quiz and boss battles, giving you better odds", category: "powerup", price: 150, icon: "Eye", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "powerup-bonus-round", name: "Bonus Round", description: "Earn +50 bonus XP at the end of every game you play", category: "powerup", price: 200, icon: "Gift", rarity: "uncommon", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "powerup-daily-double", name: "Daily Double", description: "Double the XP and Neuro rewards from daily challenges", category: "powerup", price: 250, icon: "Rocket", rarity: "uncommon", requiredLevel: 2, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "theme-forest", name: "Forest Theme", description: "Natural green forest colors", category: "theme", price: 300, icon: "TreePine", rarity: "uncommon", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "theme-ocean", name: "Coral Reef Theme", description: "Vibrant coral pinks and turquoise lagoon waters", category: "theme", price: 350, icon: "Waves", rarity: "uncommon", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "theme-fire", name: "Solar Flare Theme", description: "Scorching yellows and radiant sun-bright oranges of a stellar eruption", category: "theme", price: 500, icon: "Flame", rarity: "rare", requiredLevel: 5, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "theme-galaxy", name: "Nebula Theme", description: "Swirling pink and purple gas clouds of a distant nebula", category: "theme", price: 800, icon: "Star", rarity: "rare", requiredLevel: 8, requiredRebirth: 0, requiredXp: 1000, rewardSource: null },
          { id: "theme-rainbow", name: "Rainbow Theme", description: "All the colors of the rainbow", category: "theme", price: 1000, icon: "Sparkles", rarity: "epic", requiredLevel: 10, requiredRebirth: 1, requiredXp: 0, rewardSource: null },
          { id: "theme-gold", name: "Golden Theme", description: "Luxurious gold and amber", category: "theme", price: 1500, icon: "Crown", rarity: "legendary", requiredLevel: 14, requiredRebirth: 2, requiredXp: 5000, rewardSource: null },
          { id: "title-explorer", name: "Explorer Title", description: "Show off your explorer status", category: "title", price: 250, icon: "Compass", rarity: "uncommon", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "title-champion", name: "Champion Title", description: "The champion has arrived", category: "title", price: 500, icon: "Medal", rarity: "rare", requiredLevel: 6, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "title-legend", name: "Legend Title", description: "A true science legend", category: "title", price: 1000, icon: "Award", rarity: "epic", requiredLevel: 10, requiredRebirth: 1, requiredXp: 0, rewardSource: null },
          { id: "title-professor", name: "Professor Title", description: "Respected science professor", category: "title", price: 1500, icon: "GraduationCap", rarity: "epic", requiredLevel: 12, requiredRebirth: 2, requiredXp: 0, rewardSource: null },
          { id: "title-mastermind", name: "Mastermind Title", description: "The ultimate science mastermind", category: "title", price: 2500, icon: "Brain", rarity: "legendary", requiredLevel: 16, requiredRebirth: 3, requiredXp: 8000, rewardSource: null },
          { id: "avatar-comet", name: "Comet Rider", description: "Ride across the cosmos on a blazing comet", category: "avatar", price: 2500, icon: "Orbit", rarity: "legendary", requiredLevel: 17, requiredRebirth: 3, requiredXp: 10000, rewardSource: null },
          { id: "avatar-frost", name: "Cryogenics Expert", description: "A scientist wielding absolute zero ice technology", category: "avatar", price: 1800, icon: "Snowflake", rarity: "epic", requiredLevel: 14, requiredRebirth: 2, requiredXp: 0, rewardSource: null },
          { id: "deco-molecules", name: "Molecule Chain", description: "Colorful molecular structures bounce and connect across your screen", category: "decoration", price: 400, icon: "Atom", rarity: "uncommon", requiredLevel: 4, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "deco-dna-rain", name: "Matrix Rain", description: "DNA letters and codes rain down your screen like a science matrix", category: "decoration", price: 700, icon: "Dna", rarity: "rare", requiredLevel: 7, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "deco-nebula", name: "Nebula Vignette", description: "Glowing cosmic colors pulse softly in the corners of your screen", category: "decoration", price: 1500, icon: "Star", rarity: "epic", requiredLevel: 13, requiredRebirth: 2, requiredXp: 0, rewardSource: null },
          { id: "follower-planet", name: "Mini Planet", description: "A tiny planet orbits your cursor with its own little moon", category: "follower", price: 500, icon: "Globe", rarity: "uncommon", requiredLevel: 5, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "follower-electron", name: "Electron Cloud", description: "An electron cloud buzzes around your cursor", category: "follower", price: 800, icon: "Atom", rarity: "rare", requiredLevel: 8, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "theme-arctic", name: "Polar Night Theme", description: "Midnight blues and shimmering aurora greens of the arctic sky", category: "theme", price: 400, icon: "Snowflake", rarity: "uncommon", requiredLevel: 3, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "theme-jungle", name: "Swamp Marsh Theme", description: "Murky moss greens and foggy bayou grays of the wetlands", category: "theme", price: 600, icon: "TreePine", rarity: "rare", requiredLevel: 6, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "theme-volcanic", name: "Inferno Theme", description: "Blazing white-hot plasma and smoldering ember oranges", category: "theme", price: 900, icon: "Flame", rarity: "rare", requiredLevel: 9, requiredRebirth: 0, requiredXp: 1500, rewardSource: null },
          { id: "badge-neon", name: "Neon Badges", description: "Badges glow with bright neon outlines", category: "badge_style", price: 800, icon: "Zap", rarity: "rare", requiredLevel: 8, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "badge-hologram", name: "Hologram Badges", description: "Badges display as floating holograms", category: "badge_style", price: 2000, icon: "Eye", rarity: "legendary", requiredLevel: 15, requiredRebirth: 3, requiredXp: 8000, rewardSource: null },
          { id: "powerup-comeback-king", name: "Comeback King", description: "Earn +50% XP when you lose a game, turning failures into learning", category: "powerup", price: 350, icon: "Swords", rarity: "rare", requiredLevel: 4, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "powerup-science-scanner", name: "Science Scanner", description: "Shows the science topic for each question in games and boss battles", category: "powerup", price: 450, icon: "FlaskConical", rarity: "rare", requiredLevel: 6, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "reward-storm-crown", name: "Storm Crown", description: "A spinning plasma border of lightning colors - awarded for taming The Chaos Storm", category: "decoration", price: 0, icon: "Crown", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:chaos-storm" },
          { id: "reward-circuit-aura", name: "Circuit Aura", description: "Retro scanlines scroll across your screen - earned by shutting down Dr. Blackout", category: "decoration", price: 0, icon: "Zap", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:dr-blackout" },
          { id: "reward-gene-cloak", name: "Gene Cloak", description: "Shimmering green light traces the edges of your screen - for defeating The Mutation Master", category: "decoration", price: 0, icon: "Dna", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:mutation-master" },
          { id: "reward-meltdown-flask", name: "Meltdown Flask", description: "A bubbling flask follower from conquering Professor Meltdown", category: "follower", price: 0, icon: "FlaskConical", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:professor-meltdown" },
          { id: "reward-gravity-wings", name: "Gravity Wings", description: "Soft light rays beam down from above - earned by defeating the Gravity King", category: "decoration", price: 0, icon: "Star", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:gravity-king" },
          { id: "reward-plague-mask", name: "Plague Mask", description: "A mysterious plague doctor mask from defeating Plague Lord", category: "avatar", price: 0, icon: "Skull", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:plague-lord" },
          { id: "reward-void-shadow", name: "Void Shadow", description: "A dark shadow follower from the secret Void boss", category: "follower", price: 0, icon: "Star", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:the-void" },
          { id: "reward-paradox-clock", name: "Paradox Clock", description: "Holographic lines sweep across your screen - from defeating Professor Paradox", category: "decoration", price: 0, icon: "Timer", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:professor-paradox" },
          { id: "reward-element-crown", name: "Element Crown", description: "The crown of all elements from defeating King Element", category: "avatar", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:king-element" },
          { id: "reward-omega-title", name: "Omega Slayer Title", description: "Awarded for defeating any Omega-level boss mutation", category: "title", price: 0, icon: "Swords", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:any-omega" },
          { id: "reward-volcano-badge", name: "Volcanic Badge Style", description: "Fiery volcanic badge frames earned from Volcano Lab mastery", category: "badge_style", price: 0, icon: "Flame", rarity: "rare", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "game:volcano-lab:hard" },
          { id: "reward-planet-theme", name: "Planet Painter Theme", description: "A cosmic paint-splattered theme from mastering Planet Painter on Hard", category: "theme", price: 0, icon: "Palette", rarity: "rare", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "game:planet-painter:hard" },
          { id: "reward-gravity-follower", name: "Gravity Orb", description: "A floating gravity orb follower from conquering Gravity Dash on Hard", category: "follower", price: 0, icon: "Atom", rarity: "rare", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "game:gravity-dash:hard" },
          { id: "reward-speed-title", name: "Speed Demon Title", description: "Awarded for mastering Physics Frenzy on Hard difficulty", category: "title", price: 0, icon: "Zap", rarity: "rare", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "game:physics-frenzy:hard" },
          { id: "reward-circuit-theme", name: "Neon Circuit Theme", description: "A glowing circuit board theme from mastering Circuit Crafter on Hard", category: "theme", price: 0, icon: "Zap", rarity: "rare", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "game:circuit-crafter:hard" },
          { id: "reward-tecton-tremor", name: "Tremor Aura", description: "The ground pulses beneath your screen - earned by defeating Tecton the Shaker", category: "decoration", price: 0, icon: "Mountain", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:tecton-the-shaker" },
          { id: "reward-nebula-crown", name: "Nebula Crown", description: "A glowing cosmic crown avatar from defeating the Nebula Queen", category: "avatar", price: 0, icon: "Moon", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:nebula-queen" },
          { id: "reward-architect-blueprint", name: "Blueprint Follower", description: "A floating blueprint that follows your cursor - from defeating The Architect", category: "follower", price: 0, icon: "Settings", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:the-architect" },
          { id: "reward-dark-matter-veil", name: "Dark Matter Veil", description: "A shadowy vignette pulses at the edges of your screen - from defeating Dark Matter", category: "decoration", price: 0, icon: "Moon", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:dark-matter" },
          { id: "reward-nano-companion", name: "Nano Companion", description: "A tiny nanobot swarm follows your cursor - from defeating The Nano Swarm", category: "follower", price: 0, icon: "Bug", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:nano-swarm" },
          { id: "reward-quantum-glitch", name: "Quantum Glitch", description: "Reality glitches around your screen edges - from defeating The Quantum Computer", category: "decoration", price: 0, icon: "Cpu", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:quantum-computer" },
          { id: "reward-all-bosses", name: "Boss Slayer Avatar", description: "The ultimate avatar awarded for defeating all 8 regular bosses", category: "avatar", price: 0, icon: "Trophy", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:all-regular" },
          { id: "title-leaderboard-1st", name: "#1 Player", description: "You are the #1 ranked player on the leaderboard! This title is yours while you hold the top spot.", category: "title", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:individual" },
          { id: "title-elite-five", name: "Elite Five", description: "An exclusive rank for the Top 5 players on the leaderboard. Only five people in the whole game can hold this at once!", category: "title", price: 0, icon: "Star", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:top5" },
          { id: "title-ranked-grandmaster", name: "Ranked Grandmaster", description: "The single best Ranked player by ELO. The rarest competitive title in the game — yours only while you sit at #1 on the Ranked ladder.", category: "title", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:ranked1" },
          { id: "title-clan-1st", name: "#1 Clan Leader", description: "Your clan is ranked #1! This title is yours while your clan holds the top spot.", category: "title", price: 0, icon: "Globe", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:clan" },
          { id: "title-team-1st", name: "#1 Team Captain", description: "Your team is ranked #1! This title is yours while your team holds the top spot.", category: "title", price: 0, icon: "Star", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:team" },
          { id: "theme-clan-champion", name: "Clan Champion Theme", description: "A cool steel-blue theme exclusive to members of the #1 ranked clan. Yours only while your clan holds the top spot.", category: "theme", price: 0, icon: "Palette", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:clan" },
          { id: "theme-team-champion", name: "Team Champion Theme", description: "A vibrant purple theme exclusive to members of the #1 ranked team. Yours only while your team holds the top spot.", category: "theme", price: 0, icon: "Palette", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:team" },
          { id: "theme-supreme-champion", name: "Supreme Champion Theme", description: "A blazing gold and fire theme exclusive to the #1 ranked player. The ultimate flex - yours only while you hold the top spot.", category: "theme", price: 0, icon: "Palette", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:individual" },
          { id: "avatar-clan-champion", name: "Clan Champion Avatar", description: "A shield-crested avatar for members of the #1 ranked clan. Yours only while your clan holds the top spot.", category: "avatar", price: 0, icon: "Globe", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:clan" },
          { id: "avatar-team-champion", name: "Team Champion Avatar", description: "A star-blazoned avatar for members of the #1 ranked team. Yours only while your team holds the top spot.", category: "avatar", price: 0, icon: "Medal", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:team" },
          { id: "avatar-supreme-champion", name: "Supreme Champion Avatar", description: "A golden crown avatar for the #1 ranked player. The rarest avatar in the game - yours only while you hold the top spot.", category: "avatar", price: 0, icon: "Gem", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:individual" },
          { id: "deco-clan-champion", name: "Clan Champion Aura", description: "A subtle steel-blue border glow for members of the #1 ranked clan. Yours only while your clan holds the top spot.", category: "decoration", price: 0, icon: "Shield", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:clan" },
          { id: "deco-team-champion", name: "Team Champion Aura", description: "A pulsing purple shimmer for members of the #1 ranked team. Yours only while your team holds the top spot.", category: "decoration", price: 0, icon: "Star", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:team" },
          { id: "deco-supreme-champion", name: "Supreme Champion Aura", description: "A blazing golden plasma border for the #1 ranked player. The most epic decoration in the game.", category: "decoration", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:individual" },
          { id: "frame-supreme-champion", name: "Supreme Champion Frame", description: "A blazing golden animated frame exclusive to the #1 ranked player.", category: "frame", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:individual" },
          { id: "badge-style-supreme-champion", name: "Supreme Champion Badges", description: "Your badges glow with blazing golden fire - exclusive to the #1 ranked player.", category: "badge_style", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:individual" },
          { id: "coin-style-supreme-champion", name: "Supreme Champion Neuros", description: "Your Neuros radiate with champion gold energy - exclusive to the #1 ranked player.", category: "coin_style", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:individual" },
          { id: "gem-style-supreme-champion", name: "Supreme Champion Sparks", description: "Your Sparks blaze with golden champion light - exclusive to the #1 ranked player.", category: "gem_style", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:individual" },
          { id: "follower-supreme-champion", name: "Supreme Champion Follower", description: "Golden diamond particles orbit your cursor - exclusive to the #1 ranked player.", category: "follower", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:individual" },
          { id: "frame-clan-champion", name: "Clan Champion Frame", description: "A steel-blue animated frame for members of the #1 ranked clan.", category: "frame", price: 0, icon: "Shield", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:clan" },
          { id: "badge-style-clan-champion", name: "Clan Champion Badges", description: "Your badges shimmer with steel-blue energy - for members of the #1 ranked clan.", category: "badge_style", price: 0, icon: "Shield", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:clan" },
          { id: "coin-style-clan-champion", name: "Clan Champion Neuros", description: "Your Neuros glow with clan steel-blue energy - for members of the #1 ranked clan.", category: "coin_style", price: 0, icon: "Shield", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:clan" },
          { id: "gem-style-clan-champion", name: "Clan Champion Sparks", description: "Your Sparks shimmer with steel-blue clan energy - for members of the #1 ranked clan.", category: "gem_style", price: 0, icon: "Shield", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:clan" },
          { id: "follower-clan-champion", name: "Clan Champion Follower", description: "Sky-blue particles chase your cursor - for members of the #1 ranked clan.", category: "follower", price: 0, icon: "Shield", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:clan" },
          { id: "frame-team-champion", name: "Team Champion Frame", description: "A vibrant purple animated frame for members of the #1 ranked team.", category: "frame", price: 0, icon: "Star", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:team" },
          { id: "badge-style-team-champion", name: "Team Champion Badges", description: "Your badges pulse with vibrant purple energy - for members of the #1 ranked team.", category: "badge_style", price: 0, icon: "Star", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:team" },
          { id: "coin-style-team-champion", name: "Team Champion Neuros", description: "Your Neuros glow with team purple energy - for members of the #1 ranked team.", category: "coin_style", price: 0, icon: "Star", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:team" },
          { id: "gem-style-team-champion", name: "Team Champion Sparks", description: "Your Sparks pulse with team purple energy - for members of the #1 ranked team.", category: "gem_style", price: 0, icon: "Star", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:team" },
          { id: "follower-team-champion", name: "Team Champion Follower", description: "Fuchsia rings spin around your cursor - for members of the #1 ranked team.", category: "follower", price: 0, icon: "Star", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "leaderboard:team" },
          { id: "reward-tournament-champion", name: "Tournament Champion Aura", description: "A golden glow for winning a tournament - decoration that shows your champion status", category: "decoration", price: 0, icon: "Trophy", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "tournament:winner" },
          { id: "reward-tournament-title", name: "Tournament Champion", description: "Awarded for winning 1st place in any tournament", category: "title", price: 0, icon: "Trophy", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "tournament:winner" },
          { id: "reward-tournament-avatar", name: "Tournament Victor", description: "A golden trophy-wielding avatar for tournament winners", category: "avatar", price: 0, icon: "Trophy", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "tournament:winner" },
          { id: "reward-tournament-frame", name: "Champion Frame", description: "An animated golden frame that pulses with victory energy", category: "frame", price: 0, icon: "Crown", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "tournament:winner" },
          { id: "reward-tournament-theme", name: "Victory Theme", description: "A glowing gold and white theme for tournament champions", category: "theme", price: 0, icon: "Palette", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "tournament:winner" },
          { id: "reward-clan-warrior", name: "Clan Warrior Follower", description: "A tiny shield follows your cursor - awarded for winning a clan battle", category: "follower", price: 0, icon: "Shield", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "clan-battle:winner" },
          { id: "reward-clan-champion", name: "Clan Champion", description: "Awarded for winning a clan battle", category: "title", price: 0, icon: "Shield", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "clan-battle:winner" },
          { id: "reward-kraken-ink", name: "Kraken Ink", description: "Dark tentacles creep from the edges of your screen - from defeating The Kraken", category: "decoration", price: 0, icon: "Waves", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:the-kraken" },
          { id: "reward-magma-core", name: "Magma Core Follower", description: "A glowing magma orb trails behind your cursor - from defeating The Magma Titan", category: "follower", price: 0, icon: "Flame", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:magma-titan" },
          { id: "reward-frost-breath", name: "Frost Breath", description: "Icy mist drifts from the edges of your screen - from defeating The Frost Wyrm", category: "decoration", price: 0, icon: "Snowflake", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:frost-wyrm" },
          { id: "reward-vine-whip", name: "Vine Whip Follower", description: "A living vine follows your cursor leaving tiny flowers - from defeating The Jungle Hydra", category: "follower", price: 0, icon: "TreePine", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:jungle-hydra" },
          { id: "reward-cosmic-rift", name: "Cosmic Rift", description: "A shimmering space-time rift pulses at the edge of your screen - from defeating The Cosmic Entity", category: "decoration", price: 0, icon: "Orbit", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:cosmic-entity" },
          { id: "reward-crystal-shard", name: "Crystal Shard Follower", description: "Floating crystal shards orbit your cursor - from defeating The Crystal Golem", category: "follower", price: 0, icon: "Diamond", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:crystal-golem" },
          { id: "reward-thunder-bolt", name: "Thunder Bolt Aura", description: "Lightning arcs across your screen periodically - from defeating The Thunder King", category: "decoration", price: 0, icon: "Zap", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:thunder-king" },
          { id: "reward-virus-code", name: "Virus Code Rain", description: "Green code rains down your screen edges - from defeating Virus Prime", category: "decoration", price: 0, icon: "Cpu", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:virus-prime" },
          { id: "reward-dino-fossil", name: "Fossil Follower", description: "A tiny fossil fragment orbits your cursor - from defeating The Rex Overlord", category: "follower", price: 0, icon: "Skull", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:rex-overlord" },
          { id: "reward-quantum-wave", name: "Quantum Wave", description: "Reality warps and ripples around your screen - from defeating The Quantum Phantom", category: "decoration", price: 0, icon: "Atom", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:quantum-phantom" },
          { id: "reward-all-world-bosses", name: "Realm Dominator", description: "Awarded for conquering every world and defeating all 10 world bosses", category: "decoration", price: 0, icon: "Globe", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:all-world" },
          { id: "frame-basic", name: "Simple Frame", description: "A clean thin border frame around your profile avatar", category: "frame", price: 200, icon: "Square", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "frame-rounded", name: "Rounded Frame", description: "A smooth rounded frame with soft edges", category: "frame", price: 350, icon: "Circle", rarity: "uncommon", requiredLevel: 3, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "frame-science", name: "Science Frame", description: "A frame decorated with atoms and molecules", category: "frame", price: 600, icon: "Atom", rarity: "rare", requiredLevel: 6, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "frame-fire", name: "Fire Frame", description: "An animated frame with flickering flames", category: "frame", price: 1000, icon: "Flame", rarity: "rare", requiredLevel: 8, requiredRebirth: 0, requiredXp: 500, rewardSource: null },
          { id: "frame-ice", name: "Frost Frame", description: "An animated frame with swirling snowflakes and ice crystals", category: "frame", price: 1200, icon: "Snowflake", rarity: "epic", requiredLevel: 10, requiredRebirth: 1, requiredXp: 1000, rewardSource: null },
          { id: "frame-lightning", name: "Lightning Frame", description: "An animated frame crackling with electric energy", category: "frame", price: 1500, icon: "Zap", rarity: "epic", requiredLevel: 12, requiredRebirth: 1, requiredXp: 2000, rewardSource: null },
          { id: "frame-rainbow", name: "Rainbow Frame", description: "An animated frame that cycles through all rainbow colors", category: "frame", price: 2000, icon: "Rainbow", rarity: "epic", requiredLevel: 14, requiredRebirth: 2, requiredXp: 3000, rewardSource: null },
          { id: "frame-galaxy", name: "Galaxy Frame", description: "An animated frame with swirling galaxies and twinkling stars", category: "frame", price: 3000, icon: "Star", rarity: "legendary", requiredLevel: 16, requiredRebirth: 3, requiredXp: 5000, rewardSource: null },
          { id: "frame-golden", name: "Golden Frame", description: "A luxurious animated golden frame with shimmering particles", category: "frame", price: 5000, icon: "Crown", rarity: "legendary", requiredLevel: 18, requiredRebirth: 4, requiredXp: 10000, rewardSource: null },
          { id: "frame-void", name: "Void Frame", description: "An animated frame of pure darkness that seems to absorb light around it", category: "frame", price: 8000, icon: "Moon", rarity: "legendary", requiredLevel: 20, requiredRebirth: 5, requiredXp: 20000, rewardSource: null },
          { id: "coin-style-default", name: "Classic Neuros", description: "The standard gold Neuro display", category: "coin_style", price: 0, icon: "Coins", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "coin-style-diamond", name: "Diamond Neuros", description: "Your Neuros sparkle like cut diamonds", category: "coin_style", price: 500, icon: "Diamond", rarity: "uncommon", requiredLevel: 5, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "coin-style-fire", name: "Molten Neuros", description: "Your Neuros glow with a fiery orange lava effect", category: "coin_style", price: 1000, icon: "Flame", rarity: "rare", requiredLevel: 8, requiredRebirth: 0, requiredXp: 500, rewardSource: null },
          { id: "coin-style-ice", name: "Frozen Neuros", description: "Your Neuros shimmer with an icy blue frost effect", category: "coin_style", price: 1500, icon: "Snowflake", rarity: "epic", requiredLevel: 12, requiredRebirth: 1, requiredXp: 2000, rewardSource: null },
          { id: "coin-style-rainbow", name: "Prismatic Neuros", description: "Your Neuros cycle through rainbow colors", category: "coin_style", price: 2500, icon: "Rainbow", rarity: "legendary", requiredLevel: 16, requiredRebirth: 3, requiredXp: 8000, rewardSource: null },
          { id: "gem-style-default", name: "Classic Sparks", description: "The standard purple Spark display", category: "gem_style", price: 0, icon: "Gem", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "gem-style-emerald", name: "Emerald Sparks", description: "Your Sparks glow with a rich emerald green", category: "gem_style", price: 500, icon: "Gem", rarity: "uncommon", requiredLevel: 5, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "gem-style-ruby", name: "Ruby Sparks", description: "Your Sparks burn with a deep ruby red", category: "gem_style", price: 1000, icon: "Gem", rarity: "rare", requiredLevel: 8, requiredRebirth: 0, requiredXp: 500, rewardSource: null },
          { id: "gem-style-sapphire", name: "Sapphire Sparks", description: "Your Sparks shimmer with a royal sapphire blue", category: "gem_style", price: 1500, icon: "Gem", rarity: "epic", requiredLevel: 12, requiredRebirth: 1, requiredXp: 2000, rewardSource: null },
          { id: "gem-style-cosmic", name: "Cosmic Sparks", description: "Your Sparks pulse with swirling galaxy energy", category: "gem_style", price: 2500, icon: "Gem", rarity: "legendary", requiredLevel: 16, requiredRebirth: 3, requiredXp: 8000, rewardSource: null },
          { id: "coin-style-plasma", name: "Plasma Neuros", description: "Your Neuros crackle with electric plasma energy - earned by defeating all 8 regular bosses", category: "coin_style", price: 0, icon: "Zap", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:all-regular" },
          { id: "coin-style-void", name: "Void Neuros", description: "Your Neuros shimmer with dark antimatter - earned by conquering all 10 world bosses", category: "coin_style", price: 0, icon: "Moon", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:all-world" },
          { id: "coin-style-champion", name: "Champion Neuros", description: "Your Neuros gleam with tournament gold - awarded for winning a tournament", category: "coin_style", price: 0, icon: "Trophy", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "tournament:winner" },
          { id: "coin-style-toxic", name: "Toxic Neuros", description: "Your Neuros ooze with a sickly green glow - from defeating Plague Lord", category: "coin_style", price: 0, icon: "Bug", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:plague-lord" },
          { id: "coin-style-nebula", name: "Nebula Neuros", description: "Your Neuros swirl with cosmic nebula colors - from defeating the Nebula Queen", category: "coin_style", price: 0, icon: "Orbit", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:nebula-queen" },
          { id: "gem-style-lightning", name: "Lightning Sparks", description: "Your Sparks spark with crackling electricity - from defeating the Thunder King", category: "gem_style", price: 0, icon: "Zap", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:thunder-king" },
          { id: "gem-style-void", name: "Void Sparks", description: "Your Sparks pulse with dark energy from the void - earned by defeating all 10 world bosses", category: "gem_style", price: 0, icon: "Moon", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:all-world" },
          { id: "gem-style-champion", name: "Champion Sparks", description: "Your Sparks shine with victorious golden light - awarded for winning a tournament", category: "gem_style", price: 0, icon: "Trophy", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "tournament:winner" },
          { id: "gem-style-frost", name: "Frost Sparks", description: "Your Sparks glitter with frozen ice crystals - from defeating the Frost Wyrm", category: "gem_style", price: 0, icon: "Snowflake", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:frost-wyrm" },
          { id: "gem-style-magma", name: "Magma Sparks", description: "Your Sparks burn with molten lava energy - from defeating the Magma Titan", category: "gem_style", price: 0, icon: "Flame", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:magma-titan" },
          { id: "avatar-xp-rising", name: "Rising Star", description: "An avatar for reaching 5,000 total XP", category: "avatar", price: 0, icon: "Star", rarity: "uncommon", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "xp:5000" },
          { id: "avatar-xp-veteran", name: "Science Veteran", description: "An avatar for reaching 25,000 total XP", category: "avatar", price: 0, icon: "Medal", rarity: "rare", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "xp:25000" },
          { id: "avatar-xp-master", name: "XP Master", description: "An avatar for reaching 50,000 total XP", category: "avatar", price: 0, icon: "Award", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "xp:50000" },
          { id: "avatar-xp-legend", name: "XP Legend", description: "An avatar for reaching 100,000 total XP - the ultimate science achievement", category: "avatar", price: 0, icon: "Gem", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "xp:100000" },
          { id: "avatar-streak-master", name: "Streak Master", description: "An avatar for reaching a 30-day streak", category: "avatar", price: 0, icon: "Flame", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "streak:30" },
          { id: "avatar-game-master", name: "Game Master", description: "An avatar for playing 100 total games", category: "avatar", price: 0, icon: "Gamepad2", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "games:100" },
          { id: "avatar-rebirth-phoenix", name: "Eternal Flame", description: "An avatar wreathed in undying fire for completing your first rebirth", category: "avatar", price: 0, icon: "Bird", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "rebirth:1" },
          { id: "avatar-rebirth-titan", name: "Rebirth Titan", description: "A towering titan avatar for reaching rebirth level 5", category: "avatar", price: 0, icon: "Shield", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "rebirth:5" },
          { id: "frame-world-conqueror", name: "World Conqueror Frame", description: "An animated elemental frame for defeating all 10 world bosses", category: "frame", price: 0, icon: "Globe", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:all-world" },
          { id: "title-world-conqueror", name: "World Conqueror", description: "Awarded for defeating all 10 world bosses", category: "title", price: 0, icon: "Globe", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:all-world" },
          { id: "title-admins-favourite", name: "Admin's Favourite", description: "Personally chosen by an admin as a standout player. A true honour!", category: "title", price: 0, icon: "Heart", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "admin:favourite" },
          { id: "avatar-news-star", name: "News Star", description: "A radiant avatar for scientists who earn 10 boosts across posts and packs", category: "avatar", price: 0, icon: "Star", rarity: "rare", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boost:10" },
          { id: "avatar-viral-scientist", name: "Viral Scientist", description: "An electrifying avatar for scientists who earn 50 boosts across posts and packs", category: "avatar", price: 0, icon: "Zap", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boost:50" },
          { id: "title-influencer", name: "Influencer Title", description: "Earned by reaching 100 total boosts across all your posts and packs", category: "title", price: 0, icon: "Sparkles", rarity: "legendary", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boost:100" },
          { id: "title-my-clan", name: "Clan Title", description: "Show off your clan pride with this special Clan title tag", category: "title", price: 100, icon: "Shield", rarity: "uncommon", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "title-my-team", name: "Team Title", description: "Show off your team spirit with this special Team title tag", category: "title", price: 100, icon: "Users", rarity: "uncommon", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "profile-anim-glow", name: "Glowing Profile", description: "Your avatar pulses with a soft magical glow", category: "profile_animation", price: 300, icon: "Sparkles", rarity: "uncommon", requiredLevel: 3, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "profile-anim-rainbow", name: "Rainbow Profile", description: "Your avatar shimmers with all the colours of the rainbow", category: "profile_animation", price: 600, icon: "Star", rarity: "rare", requiredLevel: 6, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "profile-anim-fire", name: "Fire Profile", description: "Your avatar blazes with intense fiery energy", category: "profile_animation", price: 500, icon: "Flame", rarity: "rare", requiredLevel: 5, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "name-anim-glow", name: "Glowing Name", description: "Your display name glows with a soft mystical light", category: "name_animation", price: 250, icon: "Zap", rarity: "uncommon", requiredLevel: 2, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "name-anim-rainbow", name: "Rainbow Name", description: "Your display name cycles through all the colours of the rainbow", category: "name_animation", price: 500, icon: "Sparkles", rarity: "rare", requiredLevel: 5, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "name-anim-gold", name: "Golden Name", description: "Your display name shimmers and gleams in brilliant gold", category: "name_animation", price: 800, icon: "Crown", rarity: "epic", requiredLevel: 8, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "profile-anim-pulse", name: "Pulse Profile", description: "Your avatar pulses with a rhythmic heartbeat glow", category: "profile_animation", price: 400, icon: "Heart", rarity: "uncommon", requiredLevel: 4, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "profile-anim-ice", name: "Frozen Profile", description: "Your avatar shimmers with an icy frost aura", category: "profile_animation", price: 450, icon: "Snowflake", rarity: "uncommon", requiredLevel: 4, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "profile-anim-cosmic", name: "Cosmic Profile", description: "Your avatar cycles through the colours of the galaxy", category: "profile_animation", price: 700, icon: "Orbit", rarity: "rare", requiredLevel: 8, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "profile-anim-electric", name: "Electric Profile", description: "Your avatar crackles with intense lightning energy", category: "profile_animation", price: 0, icon: "Zap", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:thunder-king" },
          { id: "profile-anim-shadow", name: "Shadow Profile", description: "Your avatar is consumed by dark, mysterious shadow energy", category: "profile_animation", price: 0, icon: "Moon", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:dr-blackout" },
          { id: "name-anim-fire", name: "Flaming Name", description: "Your display name flickers with intense flames", category: "name_animation", price: 350, icon: "Flame", rarity: "uncommon", requiredLevel: 3, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "name-anim-ice", name: "Frozen Name", description: "Your display name shimmers with an icy frost glow", category: "name_animation", price: 350, icon: "Snowflake", rarity: "uncommon", requiredLevel: 3, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "name-anim-electric", name: "Electric Name", description: "Your display name crackles with lightning energy", category: "name_animation", price: 0, icon: "Zap", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:thunder-king" },
          { id: "name-anim-cosmic", name: "Cosmic Name", description: "Your display name cycles through galaxy colours", category: "name_animation", price: 600, icon: "Orbit", rarity: "rare", requiredLevel: 7, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "name-anim-shadow", name: "Shadow Name", description: "Your display name pulses with dark mysterious energy", category: "name_animation", price: 0, icon: "Moon", rarity: "epic", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: "boss:dr-blackout" },
          { id: "profile-anim-breathe", name: "Breathing Profile", description: "Your avatar slowly and gently expands and contracts like it's breathing", category: "profile_animation", price: 100, icon: "Wind", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "profile-anim-nova", name: "Nova Profile", description: "Your avatar erupts in an explosive supernova of colour and light", category: "profile_animation", price: 2500, icon: "Atom", rarity: "legendary", requiredLevel: 18, requiredRebirth: 3, requiredXp: 15000, rewardSource: null },
          { id: "name-anim-blink", name: "Blinking Name", description: "Your display name slowly fades in and out with a calming pulse", category: "name_animation", price: 80, icon: "Eye", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "name-anim-plasma", name: "Plasma Name", description: "Your display name blazes through intense neon plasma colours at high speed", category: "name_animation", price: 2200, icon: "Zap", rarity: "legendary", requiredLevel: 17, requiredRebirth: 3, requiredXp: 12000, rewardSource: null },
          { id: "powerup-streak-saver", name: "Streak Shield Pack", description: "Shields your streak 5 times — protects up to 5 missed days before needing a top-up! (5 uses, stackable)", category: "powerup", price: 1200, icon: "Shield", rarity: "epic", requiredLevel: 10, requiredRebirth: 1, requiredXp: 0, rewardSource: null },
          { id: "powerup-xp-surge", name: "XP & Neuro Surge", description: "Permanently earn +20% more XP AND +20% more Neuros from every game and challenge!", category: "powerup", price: 2800, icon: "TrendingUp", rarity: "legendary", requiredLevel: 15, requiredRebirth: 2, requiredXp: 8000, rewardSource: null },
          { id: "theme-plain", name: "Clean Theme", description: "A minimal, no-nonsense slate-grey theme that keeps things clear and focused", category: "theme", price: 50, icon: "Minus", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "title-curious", name: "Curious Title", description: "Show off your curious nature with this starter title", category: "title", price: 50, icon: "Search", rarity: "common", requiredLevel: 1, requiredRebirth: 0, requiredXp: 0, rewardSource: null },
          { id: "theme-ocean-depths", name: "Ocean Depths Theme", description: "Deep sea blues and bioluminescent glows from the ocean floor", category: "theme", price: 450, icon: "Waves", rarity: "uncommon", requiredLevel: 3, requiredRebirth: 0, requiredXp: 200, rewardSource: null },
          { id: "avatar-kraken", name: "Kraken Avatar", description: "A mighty kraken rises from the deep ocean depths", category: "avatar", price: 600, icon: "Anchor", rarity: "rare", requiredLevel: 5, requiredRebirth: 0, requiredXp: 500, rewardSource: null },
          { id: "deco-bubbles-deep", name: "Bioluminescent Glow", description: "Glowing deep-sea organisms and luminous plankton drift across your screen", category: "decoration", price: 550, icon: "Droplets", rarity: "rare", requiredLevel: 4, requiredRebirth: 0, requiredXp: 300, rewardSource: null },
          { id: "theme-magma-core", name: "Magma Core Theme", description: "Molten lava reds and volcanic obsidian blacks", category: "theme", price: 550, icon: "Flame", rarity: "rare", requiredLevel: 5, requiredRebirth: 0, requiredXp: 400, rewardSource: null },
          { id: "avatar-magma-titan", name: "Magma Titan Avatar", description: "A towering titan forged from living magma and volcanic rock", category: "avatar", price: 900, icon: "Mountain", rarity: "rare", requiredLevel: 7, requiredRebirth: 0, requiredXp: 800, rewardSource: null },
          { id: "deco-lava-flow", name: "Lava Flow", description: "Glowing rivers of lava flow along the edges of your screen", category: "decoration", price: 750, icon: "Flame", rarity: "rare", requiredLevel: 6, requiredRebirth: 0, requiredXp: 600, rewardSource: null },
          { id: "theme-frozen-tundra", name: "Frozen Tundra Theme", description: "Icy whites and frosty arctic blues of the frozen north", category: "theme", price: 650, icon: "Snowflake", rarity: "rare", requiredLevel: 7, requiredRebirth: 0, requiredXp: 600, rewardSource: null },
          { id: "avatar-frost-wyrm", name: "Frost Wyrm Avatar", description: "An ancient ice dragon from the frozen tundra wastelands", category: "avatar", price: 1000, icon: "Snowflake", rarity: "epic", requiredLevel: 9, requiredRebirth: 0, requiredXp: 1200, rewardSource: null },
          { id: "deco-snowfall", name: "Eternal Snowfall", description: "Gentle snowflakes and ice crystals drift across your screen", category: "decoration", price: 850, icon: "Snowflake", rarity: "rare", requiredLevel: 8, requiredRebirth: 0, requiredXp: 900, rewardSource: null },
          { id: "theme-jungle-canopy", name: "Jungle Canopy Theme", description: "Lush tropical greens and warm earthy tones of the rainforest", category: "theme", price: 700, icon: "TreePine", rarity: "rare", requiredLevel: 9, requiredRebirth: 0, requiredXp: 800, rewardSource: null },
          { id: "avatar-jungle-hydra", name: "Jungle Hydra Avatar", description: "A fearsome multi-headed serpent lurking in the jungle canopy", category: "avatar", price: 1100, icon: "Bug", rarity: "epic", requiredLevel: 11, requiredRebirth: 1, requiredXp: 1500, rewardSource: null },
          { id: "deco-vines", name: "Living Vines", description: "Creeping vines and tropical flowers grow along the edges of your screen", category: "decoration", price: 900, icon: "Leaf", rarity: "epic", requiredLevel: 10, requiredRebirth: 0, requiredXp: 1200, rewardSource: null },
          { id: "theme-space-station", name: "Space Station Theme", description: "Sleek metallic silvers and cosmic void blacks of deep space", category: "theme", price: 1050, icon: "Rocket", rarity: "epic", requiredLevel: 12, requiredRebirth: 1, requiredXp: 1500, rewardSource: null },
          { id: "avatar-cosmic-entity", name: "Cosmic Entity Avatar", description: "A mysterious being of pure cosmic energy from beyond the stars", category: "avatar", price: 1350, icon: "Star", rarity: "epic", requiredLevel: 13, requiredRebirth: 1, requiredXp: 2000, rewardSource: null },
          { id: "deco-stardust", name: "Stardust Trail", description: "Shimmering cosmic particles and stardust swirl around your screen", category: "decoration", price: 1250, icon: "Sparkles", rarity: "epic", requiredLevel: 12, requiredRebirth: 1, requiredXp: 1800, rewardSource: null },
          { id: "theme-crystal-caverns", name: "Crystal Caverns Theme", description: "Sparkling pink crystals and deep purple geode colors from underground caverns", category: "theme", price: 850, icon: "Diamond", rarity: "rare", requiredLevel: 10, requiredRebirth: 0, requiredXp: 1000, rewardSource: null },
          { id: "avatar-crystal-golem", name: "Crystal Golem Avatar", description: "A towering golem made of living crystal that refracts light into rainbows", category: "avatar", price: 1300, icon: "Diamond", rarity: "epic", requiredLevel: 12, requiredRebirth: 1, requiredXp: 1500, rewardSource: null },
          { id: "deco-crystal-shimmer", name: "Crystal Shimmer", description: "Glittering crystal shards and prismatic light rays dance around your screen", category: "decoration", price: 1000, icon: "Sparkles", rarity: "epic", requiredLevel: 11, requiredRebirth: 0, requiredXp: 1200, rewardSource: null },
          { id: "theme-storm-citadel", name: "Storm Citadel Theme", description: "Crackling yellow lightning and dark thundercloud grays of the eternal storm", category: "theme", price: 950, icon: "CloudLightning", rarity: "rare", requiredLevel: 11, requiredRebirth: 0, requiredXp: 1200, rewardSource: null },
          { id: "avatar-thunder-king", name: "Thunder King Avatar", description: "A mighty king wreathed in living lightning and storm clouds", category: "avatar", price: 1400, icon: "Zap", rarity: "epic", requiredLevel: 13, requiredRebirth: 1, requiredXp: 1800, rewardSource: null },
          { id: "deco-lightning-storm", name: "Lightning Storm", description: "Bolts of electricity arc and crackle along the edges of your screen", category: "decoration", price: 1100, icon: "Zap", rarity: "epic", requiredLevel: 12, requiredRebirth: 1, requiredXp: 1500, rewardSource: null },
          { id: "theme-cyber-grid", name: "Cyber Grid Theme", description: "Neon green circuits and glowing teal data streams of the digital frontier", category: "theme", price: 1100, icon: "Cpu", rarity: "epic", requiredLevel: 12, requiredRebirth: 1, requiredXp: 1500, rewardSource: null },
          { id: "avatar-virus-prime", name: "Virus Prime Avatar", description: "A sentient digital virus pulsing with corrupted code and neon energy", category: "avatar", price: 1600, icon: "Bug", rarity: "epic", requiredLevel: 14, requiredRebirth: 1, requiredXp: 2200, rewardSource: null },
          { id: "deco-digital-rain", name: "Digital Rain", description: "Streams of glowing code and binary data cascade down your screen", category: "decoration", price: 1300, icon: "Cpu", rarity: "epic", requiredLevel: 13, requiredRebirth: 1, requiredXp: 1800, rewardSource: null },
          { id: "theme-dino-valley", name: "Dino Valley Theme", description: "Warm amber sands and ancient brown fossils of the prehistoric valley", category: "theme", price: 1200, icon: "Skull", rarity: "epic", requiredLevel: 13, requiredRebirth: 1, requiredXp: 2000, rewardSource: null },
          { id: "avatar-rex-overlord", name: "Rex Overlord Avatar", description: "A fearsome dinosaur king with glowing eyes and fossilized armor", category: "avatar", price: 1900, icon: "Skull", rarity: "legendary", requiredLevel: 15, requiredRebirth: 2, requiredXp: 3000, rewardSource: null },
          { id: "deco-fossil-dust", name: "Fossil Dust", description: "Ancient amber particles and fossil fragments drift across your screen", category: "decoration", price: 1400, icon: "Bone", rarity: "epic", requiredLevel: 14, requiredRebirth: 1, requiredXp: 2500, rewardSource: null },
          { id: "theme-quantum-realm", name: "Quantum Realm Theme", description: "Ethereal violet waves and deep indigo particle fields of quantum space", category: "theme", price: 1400, icon: "Atom", rarity: "epic", requiredLevel: 14, requiredRebirth: 2, requiredXp: 2500, rewardSource: null },
          { id: "avatar-quantum-phantom", name: "Quantum Phantom Avatar", description: "A ghostly being that exists in multiple states simultaneously, flickering between realities", category: "avatar", price: 2200, icon: "Atom", rarity: "legendary", requiredLevel: 16, requiredRebirth: 2, requiredXp: 4000, rewardSource: null },
          { id: "deco-particle-field", name: "Particle Field", description: "Quantum particles phase in and out of existence around your screen in mesmerizing patterns", category: "decoration", price: 1800, icon: "Orbit", rarity: "legendary", requiredLevel: 15, requiredRebirth: 2, requiredXp: 3500, rewardSource: null },
        ];
        for (const item of items) {
          await db.insert(shopItems).values(item).onConflictDoNothing();
        }
        const { eq, notInArray } = await import("drizzle-orm");
        for (const item of items) {
          await db.update(shopItems).set({
            name: item.name,
            description: item.description,
            category: item.category,
            price: item.price,
            icon: item.icon,
            rarity: item.rarity,
            requiredLevel: item.requiredLevel,
            requiredRebirth: item.requiredRebirth,
            requiredXp: item.requiredXp,
            rewardSource: item.rewardSource,
          }).where(eq(shopItems.id, item.id));
        }
        const validIds = items.map(i => i.id);
        await db.delete(shopItems).where(notInArray(shopItems.id, validIds));
        console.log(`Seeded/updated ${items.length} shop items`);
      }
    } catch (e) {
      console.error(`Failed to seed shop items (attempt ${attempt}):`, e);
      if (attempt < 5) {
        const delay = attempt * 3000;
        console.log(`Retrying seed in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        return seedWithRetry(attempt + 1);
      }
    }
    }
    seedWithRetry();

    // One-time patch: grant missed Thunder King rewards to user id:1
    // (Back-button bug prevented the defeat API from firing)
    (async () => {
      try {
        const u = await storage.getUser(1);
        if (!u) return;
        const inv: string[] = u.inventory || [];
        if (inv.includes("profile-anim-electric")) return; // already patched
        const allItems = await storage.getShopItems();
        const tkItems = allItems.filter(i => i.rewardSource === "boss:thunder-king").map(i => i.id);
        const toAdd = tkItems.filter(id => !inv.includes(id));
        const badges: string[] = u.badges || [];
        const badgesToAdd = badges.includes("thunder-tamer") ? [] : ["thunder-tamer"];
        const bossesDefeated = (u.bossesDefeated as Record<string, number>) || {};
        const updatedBosses = { ...bossesDefeated, "thunder-king": Math.max(bossesDefeated["thunder-king"] || 0, 1) };
        await storage.updateUser(1, {
          inventory: [...inv, ...toAdd],
          badges: [...badges, ...badgesToAdd],
          bossesDefeated: updatedBosses,
        } as any);
      } catch (_) {}
    })();
  })();

  app.get("/api/daily-challenge", async (req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      let challenge = await storage.getDailyChallenge(today);

      if (!challenge) {
        const challenges = [
          { gameId: "gravity-dash", title: "Gravity Sprint", description: "Dodge obstacles and grab stars in Gravity Dash! Survive as long as you can!", targetScore: 80, xpReward: 40 },
          { gameId: "dna-decoder", title: "DNA Detective", description: "Match DNA base pairs to decode the sequence! Can you crack the code?", targetScore: 120, xpReward: 50 },
          { gameId: "circuit-crafter", title: "Spark Master", description: "Wire up circuits before time runs out! Connect the right components!", targetScore: 100, xpReward: 45 },
          { gameId: "chemistry-mixer", title: "Potion Brewer", description: "Mix the perfect chemical reactions! Don't blow up the lab!", targetScore: 100, xpReward: 45 },
          { gameId: "time-travel-scientist", title: "Time Warp Quiz", description: "Travel through time and answer science questions from different eras!", targetScore: 150, xpReward: 60 },
          { gameId: "element-arena", title: "Element Showdown", description: "Battle using the periodic table! Pick the right element to win!", targetScore: 100, xpReward: 50 },
          { gameId: "ecosystem-builder", title: "Nature Keeper", description: "Balance plants, animals and fungi to keep your ecosystem alive!", targetScore: 150, xpReward: 55 },
          { gameId: "physics-puzzle-rooms", title: "Trick Shot", description: "Launch projectiles at tricky targets! Nail the angle and power!", targetScore: 100, xpReward: 50 },
          { gameId: "weather-commander", title: "Storm Chaser", description: "Sort weather patterns and command the skies! Don't let storms slip by!", targetScore: 100, xpReward: 45 },
          { gameId: "microbe-defender", title: "Germ Buster", description: "Defend the body from invading microbes! Zap them before they spread!", targetScore: 120, xpReward: 50 },
          { gameId: "boss-challenge", title: "Boss Showdown", description: "Pick any boss and take them on! Defeat them to claim your reward!", targetScore: 1, xpReward: 75 },
          { gameId: "lab-experiment", title: "Mad Scientist Day", description: "Head to the lab and run an experiment! Discover something new!", targetScore: 1, xpReward: 40 },
          { gameId: "community-play", title: "Community Star", description: "Play a question pack made by another player! Support the community!", targetScore: 1, xpReward: 35 },
          { gameId: "gravity-dash", title: "Zero-G Survivor", description: "How long can you last in zero gravity? Beat your record!", targetScore: 120, xpReward: 55 },
          { gameId: "ecosystem-builder", title: "Biodiversity Boom", description: "Create the most diverse ecosystem possible! Use all three organism types!", targetScore: 200, xpReward: 65 },
          { gameId: "chemistry-mixer", title: "Chain Reactor", description: "Trigger 3 successful reactions in a row without mistakes!", targetScore: 150, xpReward: 60 },
          { gameId: "dna-decoder", title: "Gene Genius", description: "Speed-decode DNA! The faster you match, the more points you earn!", targetScore: 180, xpReward: 65 },
          { gameId: "microbe-defender", title: "Immune Warrior", description: "The body is under attack! Destroy 20 microbes to save the patient!", targetScore: 150, xpReward: 55 },
          { gameId: "physics-puzzle-rooms", title: "Bullseye Blitz", description: "Hit every target with minimum shots! Accuracy is everything!", targetScore: 150, xpReward: 60 },
          { gameId: "weather-commander", title: "Forecast Frenzy", description: "Predict and sort extreme weather events! How fast can you react?", targetScore: 130, xpReward: 50 },
          { gameId: "boss-challenge", title: "Legendary Battle", description: "Face a boss on Hard mode! Only the bravest scientists will survive!", targetScore: 1, xpReward: 100 },
          { gameId: "tectonic-clash", title: "Earthquake Engineer", description: "Move tectonic plates and build mountains! Master the forces of the Earth!", targetScore: 100, xpReward: 50 },
          { gameId: "cell-surgeon", title: "Operation Cell", description: "Operate on cells under the microscope! Can you save every organelle?", targetScore: 100, xpReward: 50 },
          { gameId: "star-mapper", title: "Constellation Quest", description: "Connect the stars to form constellations! Map the night sky!", targetScore: 120, xpReward: 55 },
          { gameId: "acid-base-blitz", title: "pH Panic", description: "Sort acids and bases before they crash! Watch the pH hints!", targetScore: 100, xpReward: 45 },
          { gameId: "food-chain-frenzy", title: "Web of Life", description: "Build the longest food chain you can! Connect producers to apex predators!", targetScore: 130, xpReward: 55 },
          { gameId: "volcano-lab", title: "Eruption Rush", description: "Build the biggest eruption possible! Time your release perfectly!", targetScore: 120, xpReward: 50 },
        ];
        const dayIndex = Math.floor(Date.now() / 86400000) % challenges.length;
        const c = challenges[dayIndex];

        challenge = await storage.createDailyChallenge({
          date: today,
          gameId: c.gameId,
          title: c.title,
          description: c.description,
          targetScore: c.targetScore,
          xpReward: c.xpReward || 50,
        });
      }

      let completed = false;
      if (req.isAuthenticated()) {
        const user = await storage.getUser(req.user!.id);
        if (user && user.lastDailyChallengeDate === today) {
          completed = true;
        }
      }

      res.json({ ...challenge, completed });
    } catch (error) {
      res.status(500).json({ message: "Failed to get daily challenge" });
    }
  });

  app.post("/api/daily-challenge/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { challengeType } = req.body;
      const validTypes = ["boss-challenge", "lab-experiment", "community-play"];
      if (!validTypes.includes(challengeType)) {
        return res.status(400).json({ message: "Invalid challenge type" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const today = new Date().toISOString().split("T")[0];
      if (user.lastDailyChallengeDate === today) {
        return res.json({ alreadyCompleted: true });
      }

      const challenge = await storage.getDailyChallenge(today);
      if (!challenge || challenge.gameId !== challengeType) {
        return res.json({ notToday: true });
      }

      const newXP = user.xp + challenge.xpReward;
      const newCoins = user.coins + 25;
      const newLevel = computeLevel(newXP);

      await storage.updateUser(user.id, {
        xp: newXP,
        coins: newCoins,
        level: newLevel,
        dailyChallengesCompleted: user.dailyChallengesCompleted + 1,
        lastDailyChallengeDate: today,
      });

      res.json({ completed: true, xpEarned: challenge.xpReward, coinsEarned: 25 });
    } catch (error) {
      res.status(500).json({ message: "Failed to complete daily challenge" });
    }
  });

  app.post("/api/game/result", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { gameId, score, won, difficulty, gemUpgradesDisabled, isChallenge } = req.body;
      if (!gameId || typeof score !== "number") {
        return res.status(400).json({ message: "Invalid game result" });
      }
      const diff = difficulty || "medium";
      const upgradesOff = gemUpgradesDisabled === true;

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Suspended accounts (e.g. autoclicker detection) earn no rewards until reviewed.
      if (((user as any).safetySettings || {}).suspended) {
        return res.status(403).json({ message: "Account suspended pending review", suspended: true });
      }

      let xpEarned = Math.floor(score / 5) + (won ? 25 : 10);
      let coinsEarned = Math.floor(score / 10) + (won ? 15 : 5);

      // Harder difficulty rewards more — encourages players to challenge themselves.
      const DIFFICULTY_REWARD_MULT: Record<string, number> = { easy: 0.8, medium: 1, hard: 1.5 };
      const diffMult = DIFFICULTY_REWARD_MULT[diff] ?? 1;
      xpEarned = Math.max(1, Math.round(xpEarned * diffMult));
      coinsEarned = Math.max(1, Math.round(coinsEarned * diffMult));

      // Permanent buff from holding a complete Infinity Stone set (+25% XP/coins).
      const dimBuff = dimensionBuffMultipliers(user.inventory || []);
      xpEarned = Math.round(xpEarned * dimBuff.xp);
      coinsEarned = Math.round(coinsEarned * dimBuff.coins);

      const activeUpgrades: string[] = [];
      if (!upgradesOff && isUpgradeActive(user, "upgrade-xp-boost")) {
        xpEarned = Math.floor(xpEarned * 2);
        activeUpgrades.push("upgrade-xp-boost");
      }
      if (!upgradesOff && isUpgradeActive(user, "upgrade-double-coins")) {
        coinsEarned = Math.floor(coinsEarned * 2);
        activeUpgrades.push("upgrade-double-coins");
      }
      if (!upgradesOff && isUpgradeActive(user, "upgrade-coin-magnet")) {
        coinsEarned = Math.floor(coinsEarned * 1.25);
        activeUpgrades.push("upgrade-coin-magnet");
      }
      if (!upgradesOff && isUpgradeActive(user, "upgrade-extra-time")) {
        activeUpgrades.push("upgrade-extra-time");
      }
      if (user.inventory?.includes("upgrade-permanent-xp")) {
        xpEarned = Math.floor(xpEarned * 1.15);
        activeUpgrades.push("upgrade-permanent-xp");
      }
      if (user.inventory?.includes("upgrade-mega-xp")) {
        xpEarned = Math.floor(xpEarned * 1.25);
        activeUpgrades.push("upgrade-mega-xp");
      }
      if (user.inventory?.includes("upgrade-mega-coins")) {
        coinsEarned = Math.floor(coinsEarned * 1.25);
        activeUpgrades.push("upgrade-mega-coins");
      }
      if (user.inventory?.includes("upgrade-scholar")) {
        xpEarned = Math.floor(xpEarned * 1.2);
        coinsEarned = Math.floor(coinsEarned * 1.2);
        activeUpgrades.push("upgrade-scholar");
      }
      if (user.inventory?.includes("upgrade-jackpot") && Math.random() < 0.1) {
        xpEarned = Math.floor(xpEarned * 3);
        coinsEarned = Math.floor(coinsEarned * 3);
        activeUpgrades.push("upgrade-jackpot");
      }
      if (user.inventory?.includes("powerup-xp-surge")) {
        xpEarned = Math.floor(xpEarned * 1.2);
        coinsEarned = Math.floor(coinsEarned * 1.2);
        activeUpgrades.push("powerup-xp-surge");
      }
      if (user.inventory?.includes("upgrade-permanent-coins")) {
        coinsEarned = Math.floor(coinsEarned * 1.15);
        activeUpgrades.push("upgrade-permanent-coins");
      }
      if (user.inventory?.includes("upgrade-treasure-hunter")) {
        coinsEarned += Math.floor(Math.random() * 10) + 5;
        activeUpgrades.push("upgrade-treasure-hunter");
      }
      if (user.inventory?.includes("upgrade-science-star")) {
        xpEarned = Math.floor(xpEarned * 1.1);
        coinsEarned = Math.floor(coinsEarned * 1.1);
        activeUpgrades.push("upgrade-science-star");
      }
      if ((user as any).isVip) {
        xpEarned = Math.floor(xpEarned * 1.1);
        coinsEarned = Math.floor(coinsEarned * 1.1);
        activeUpgrades.push("vip-bonus");
      }
      if (!won && user.inventory.includes("powerup-comeback-king")) {
        xpEarned = Math.floor(xpEarned * 1.5);
        activeUpgrades.push("powerup-comeback-king");
      }
      if (user.inventory.includes("powerup-bonus-round")) {
        xpEarned += 50;
        activeUpgrades.push("powerup-bonus-round");
      }

      const now = Date.now();
      const activePotions = ((user.activePotions as any[]) || []).filter((p: any) => p.expiresAt > now);
      const activePotionIds = activePotions.map((p: any) => p.potionId);
      const potionItemLvls = ((user as any).itemLevels || {}) as Record<string, number>;
      const potionMult = (id: string, base: number) => base + 0.25 * (potionItemLvls[id] || 0);
      if (activePotionIds.includes("potion-xp-small")) {
        xpEarned = Math.floor(xpEarned * potionMult("potion-xp-small", 1.25));
        activeUpgrades.push("potion-xp-small");
      }
      if (activePotionIds.includes("potion-xp-large")) {
        xpEarned = Math.floor(xpEarned * potionMult("potion-xp-large", 1.5));
        activeUpgrades.push("potion-xp-large");
      }
      if (activePotionIds.includes("potion-xp-mega")) {
        xpEarned = Math.floor(xpEarned * potionMult("potion-xp-mega", 3));
        activeUpgrades.push("potion-xp-mega");
      }
      if (activePotionIds.includes("potion-coin-small")) {
        coinsEarned = Math.floor(coinsEarned * potionMult("potion-coin-small", 1.25));
        activeUpgrades.push("potion-coin-small");
      }
      if (activePotionIds.includes("potion-coin-large")) {
        coinsEarned = Math.floor(coinsEarned * potionMult("potion-coin-large", 1.5));
        activeUpgrades.push("potion-coin-large");
      }
      if (activePotionIds.includes("potion-mega")) {
        xpEarned = Math.floor(xpEarned * potionMult("potion-mega", 2));
        coinsEarned = Math.floor(coinsEarned * potionMult("potion-mega", 2));
        activeUpgrades.push("potion-mega");
      }
      if (activePotionIds.includes("potion-lucky") && Math.random() < 0.3) {
        xpEarned = Math.floor(xpEarned * potionMult("potion-lucky", 2));
        coinsEarned = Math.floor(coinsEarned * potionMult("potion-lucky", 2));
        activeUpgrades.push("potion-lucky");
      }

      const prevScores = (user.gameScores as Record<string, number>) || {};
      const overallKey = gameId;
      const diffKey = `${gameId}:${diff}`;
      const existingScore = prevScores[overallKey] || 0;
      const existingDiffScore = prevScores[diffKey] || 0;
      const newScores = {
        ...prevScores,
        [overallKey]: Math.max(existingScore, score),
        [diffKey]: Math.max(existingDiffScore, score),
      };

      const today = new Date().toISOString().split("T")[0];
      let streak = user.currentStreak;
      let longest = user.longestStreak;
      let streakShielded = false;
      let streakSaverUsed = false;
      if (user.lastPlayDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isConsecutive = user.lastPlayDate === yesterday.toISOString().split("T")[0];
        if (isConsecutive) {
          streak = streak + 1;
        } else if (streak > 1) {
          let shielded = false;
          if (!upgradesOff && isUpgradeActive(user, "upgrade-streak-shield")) {
            const lastShieldUsed = user.lastStreakShieldDate || "";
            const daysSinceShield = lastShieldUsed ? Math.floor((Date.now() - new Date(lastShieldUsed).getTime()) / 86400000) : 999;
            if (daysSinceShield >= 7) {
              shielded = true;
            }
          }
          if (!shielded && user.inventory?.includes("upgrade-auto-streak")) {
            shielded = true;
          }
          if (!shielded && user.inventory?.includes("powerup-streak-saver")) {
            const saverUses = ((user.upgradeExpirations as Record<string, number>) || {})["powerup-streak-saver"] || 0;
            if (saverUses > 0) {
              shielded = true;
              streakSaverUsed = true;
            }
          }
          if (!shielded && activePotionIds.includes("potion-shield")) {
            shielded = true;
          }
          if (shielded) {
            streakShielded = true;
          } else {
            streak = 1;
          }
        } else {
          streak = 1;
        }
        longest = Math.max(longest, streak);
      }

      let dailyBonusXP = 0;
      let dailyBonusCoins = 0;
      let dailyChallengesCompleted = user.dailyChallengesCompleted;
      let lastDailyChallengeDate = user.lastDailyChallengeDate;

      const challenge = await storage.getDailyChallenge(today);
      if (isChallenge && challenge && challenge.gameId === gameId && score >= challenge.targetScore && user.lastDailyChallengeDate !== today) {
        dailyBonusXP = challenge.xpReward;
        dailyBonusCoins = 25;
        if (user.inventory.includes("powerup-daily-double")) {
          dailyBonusXP *= 2;
          dailyBonusCoins *= 2;
        }
        dailyChallengesCompleted = user.dailyChallengesCompleted + 1;
        lastDailyChallengeDate = today;
      }

      const totalXPEarned = xpEarned + dailyBonusXP;
      const totalCoinsEarned = coinsEarned + dailyBonusCoins;
      const newXP = user.xp + totalXPEarned;
      const newLevel = computeLevel(newXP);

      const GAME_BADGE_MAP: Record<string, string> = {
        "gravity-dash": "gravity-master",
        "dna-decoder": "gene-genius",
        "circuit-crafter": "circuit-wizard",
        "chemistry-mixer": "mad-scientist",
        "time-travel-scientist": "time-lord",
        "element-arena": "element-champion",
        "ecosystem-builder": "eco-warrior",
        "physics-puzzle-rooms": "escape-artist",
        "weather-commander": "storm-chaser",
        "microbe-defender": "immune-hero",
        "volcano-lab": "eruption-expert",
        "planet-painter": "world-builder",
        "space-architect": "space-pioneer",
        "quantum-quest": "quantum-explorer",
        "fossil-hunter": "fossil-master",
        "atomic-blitz": "atomic-ace",
        "bio-blaster": "bio-brain",
        "physics-frenzy": "physics-phenom",
        "tectonic-clash": "plate-master",
        "cell-surgeon": "cell-surgeon-badge",
        "star-mapper": "star-mapper-badge",
        "acid-base-blitz": "ph-master",
        "food-chain-frenzy": "chain-champion",
        "rocket-engineer": "rocket-engineer-badge",
        "marine-pairs": "marine-pairs-badge",
        "ocean-layers": "ocean-layers-badge",
        "deep-sea-defense": "deep-sea-defense-badge",
        "lava-escape": "lava-escape-badge",
        "eruption-timing": "eruption-timing-badge",
        "magma-memory": "magma-memory-badge",
        "arctic-match": "arctic-match-badge",
        "ice-words": "ice-words-badge",
        "blizzard-runner": "blizzard-runner-badge",
        "species-sort": "species-sort-badge",
        "canopy-catch": "canopy-catch-badge",
        "vine-scramble": "vine-scramble-badge",
        "star-memory": "star-memory-badge",
        "reactor-clicks": "reactor-clicks-badge",
        "asteroid-dodge": "asteroid-dodge-badge",
        "crystal-match": "crystal-match-badge",
        "gem-cutter": "gem-cutter-badge",
        "mineral-sort": "mineral-sort-badge",
        "lightning-rod": "lightning-rod-badge",
        "storm-runner": "storm-runner-badge",
        "pressure-puzzle": "pressure-puzzle-badge",
        "binary-blitz": "binary-blitz-badge",
        "firewall-defense": "firewall-defense-badge",
        "code-cracker": "code-cracker-badge",
        "fossil-dig": "fossil-dig-badge",
        "dino-sort": "dino-sort-badge",
        "extinction-escape": "extinction-escape-badge",
        "wave-rider": "wave-rider-badge",
        "particle-pairs": "particle-pairs-badge",
        "quantum-clicks": "quantum-clicks-badge",
      };

      const newBadges = [...(user.badges || [])];
      if (score >= 100 && !newBadges.includes("first-quest")) {
        newBadges.push("first-quest");
      }
      const badgeThreshold = diff === "easy" ? 350 : diff === "hard" ? 150 : 200;
      if (score >= badgeThreshold && GAME_BADGE_MAP[gameId] && !newBadges.includes(GAME_BADGE_MAP[gameId])) {
        newBadges.push(GAME_BADGE_MAP[gameId]);
      }
      const xpMilestones: [number, string][] = [[500,"xp-starter"],[1500,"xp-rising"],[3000,"xp-pro"],[5000,"xp-legend"],[10000,"xp-mythic"],[25000,"xp-transcendent"],[50000,"xp-eternal"]];
      for (const [threshold, badge] of xpMilestones) {
        if (newXP >= threshold && !newBadges.includes(badge)) newBadges.push(badge);
      }
      const streakMilestones: [number, string][] = [[7,"streak-master"],[14,"streak-legend"],[30,"streak-titan"]];
      for (const [threshold, badge] of streakMilestones) {
        if (streak >= threshold && !newBadges.includes(badge)) newBadges.push(badge);
      }
      const dailyMilestones: [number, string][] = [[10,"daily-hero"],[25,"daily-champion"],[50,"daily-legend"]];
      for (const [threshold, badge] of dailyMilestones) {
        if (dailyChallengesCompleted >= threshold && !newBadges.includes(badge)) newBadges.push(badge);
      }
      const badgeMilestones: [number, string][] = [[5,"badge-collector"],[10,"science-sage"],[20,"badge-hoarder"],[30,"badge-master"],[40,"badge-overlord"],[50,"badge-supreme"]];
      for (const [threshold, badge] of badgeMilestones) {
        if (newBadges.length >= threshold && !newBadges.includes(badge)) newBadges.push(badge);
      }
      const totalGames = user.totalGamesPlayed + 1;
      const gameMilestones: [number, string][] = [[10,"game-rookie"],[50,"game-veteran"],[100,"game-addict"],[250,"game-maniac"]];
      for (const [threshold, badge] of gameMilestones) {
        if (totalGames >= threshold && !newBadges.includes(badge)) newBadges.push(badge);
      }
      const newTotalCoins = user.coins + totalCoinsEarned;
      const coinMilestones: [number, string][] = [[1000,"coin-saver"],[5000,"coin-banker"],[15000,"coin-tycoon"]];
      for (const [threshold, badge] of coinMilestones) {
        if (newTotalCoins >= threshold && !newBadges.includes(badge)) newBadges.push(badge);
      }

      const gameItemsAwarded: string[] = [];
      if (diff === "hard" && score >= badgeThreshold) {
        const allShopItems = await storage.getShopItems();
        const gameRewards = allShopItems.filter(i => i.rewardSource === `game:${gameId}:hard`);
        for (const ri of gameRewards) {
          if (!user.inventory.includes(ri.id) && !gameItemsAwarded.includes(ri.id)) {
            gameItemsAwarded.push(ri.id);
          }
        }
      }

      const currentInv = user.inventory || [];
      const xpAvatarMilestones: [number, string][] = [[5000,"avatar-xp-rising"],[25000,"avatar-xp-veteran"],[50000,"avatar-xp-master"],[100000,"avatar-xp-legend"]];
      for (const [threshold, avatarId] of xpAvatarMilestones) {
        if (newXP >= threshold && !currentInv.includes(avatarId) && !gameItemsAwarded.includes(avatarId)) {
          gameItemsAwarded.push(avatarId);
        }
      }
      const totalGamesForAvatar = user.totalGamesPlayed + 1;
      if (totalGamesForAvatar >= 100 && !currentInv.includes("avatar-game-master") && !gameItemsAwarded.includes("avatar-game-master")) {
        gameItemsAwarded.push("avatar-game-master");
      }
      if (streak >= 30 && !currentInv.includes("avatar-streak-master") && !gameItemsAwarded.includes("avatar-streak-master")) {
        gameItemsAwarded.push("avatar-streak-master");
      }

      const newInventory = gameItemsAwarded.length > 0 ? [...user.inventory, ...gameItemsAwarded] : undefined;

      const updated = await storage.updateUser(user.id, {
        xp: newXP,
        coins: newTotalCoins,
        level: newLevel,
        badges: newBadges,
        gameScores: newScores,
        totalGamesPlayed: user.totalGamesPlayed + 1,
        gamesWon: user.gamesWon + (won ? 1 : 0),
        lastPlayDate: today,
        currentStreak: streak,
        longestStreak: longest,
        dailyChallengesCompleted,
        lastDailyChallengeDate,
        ...(newInventory ? { inventory: newInventory } : {}),
        ...(streakShielded ? { lastStreakShieldDate: today } : {}),
      });

      const consumableUpgrades = activeUpgrades.filter(u => u.startsWith("upgrade-") && !COSMETIC_UPGRADES.has(u));
      for (const uid of consumableUpgrades) {
        await consumeUpgradeUse(user.id, await storage.getUser(user.id) || user, uid);
      }
      if (streakSaverUsed) {
        await consumeUpgradeUse(user.id, await storage.getUser(user.id) || user, "powerup-streak-saver");
        const postUser = await storage.getUser(user.id);
        const remaining = ((postUser?.upgradeExpirations as Record<string, number>) || {})["powerup-streak-saver"] || 0;
        if (remaining === 0 && postUser?.inventory?.includes("powerup-streak-saver")) {
          await storage.updateUser(user.id, { inventory: postUser.inventory.filter((i: string) => i !== "powerup-streak-saver") });
        }
      }

      const freshUser = await storage.getUser(user.id);
      const { password: _, ...safeUser } = (freshUser || updated) as any;
      const newlyEarned = newBadges.filter(b => !(user.badges || []).includes(b));
      const finalScores = newScores as Record<string, number>;
      res.json({
        user: safeUser,
        rewards: {
          xp: xpEarned,
          coins: coinsEarned,
          dailyBonus: dailyBonusXP > 0 ? { xp: dailyBonusXP, coins: dailyBonusCoins } : null,
          badgesEarned: newlyEarned,
          itemsAwarded: gameItemsAwarded,
          activeUpgrades,
        },
        highScores: {
          overall: finalScores[gameId] || 0,
          easy: finalScores[`${gameId}:easy`] || 0,
          medium: finalScores[`${gameId}:medium`] || 0,
          hard: finalScores[`${gameId}:hard`] || 0,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to record game result" });
    }
  });

  const BOSS_BADGE_MAP: Record<string, string[]> = {
    "chaos-storm": ["storm-slayer", "supercell-survivor", "hypercane-hero"],
    "dr-blackout": ["power-restorer", "overload-overcomer", "singularity-stopper"],
    "mutation-master": ["gene-protector", "chimera-conqueror", "genome-guardian"],
    "professor-meltdown": ["meltdown-master", "catalyst-crusher", "antimatter-ace"],
    "gravity-king": ["gravity-guardian", "singularity-survivor", "dimension-defender"],
    "plague-lord": ["plague-purger", "pandemic-preventer", "extinction-ender"],
    "tecton-the-shaker": ["quake-stopper", "rift-closer", "world-saver"],
    "nebula-queen": ["star-savior", "nova-tamer", "cosmic-champion"],
    "the-void": ["void-vanquisher", "abyss-walker"],
    "professor-paradox": ["paradox-solver", "loop-breaker"],
    "king-element": ["element-king", "titan-tamer"],
    "the-architect": ["master-builder", "machine-breaker"],
    "dark-matter": ["dark-warden", "singularity-stopper-2", "universe-saver"],
    "nano-swarm": ["nano-tamer", "goo-buster", "nano-destroyer"],
    "quantum-computer": ["quantum-crusher", "reality-anchor", "loop-master"],
    "the-kraken": ["kraken-tamer", "leviathan-slayer", "abyss-conqueror"],
    "magma-titan": ["titan-cooler", "pyroclast-survivor", "core-stabilizer"],
    "frost-wyrm": ["frost-breaker", "ice-age-ender", "zero-defier"],
    "jungle-hydra": ["hydra-tamer", "overgrowth-pruner", "apex-conqueror"],
    "cosmic-entity": ["entity-banisher", "nebula-containor", "reality-savior"],
    "crystal-golem": ["golem-smasher", "prism-breaker", "geode-conqueror"],
    "thunder-king": ["thunder-tamer", "tempest-crusher", "storm-ender"],
    "virus-prime": ["virus-purger", "malware-slayer", "singularity-purger"],
    "rex-overlord": ["rex-tamer", "apex-hunter", "extinction-stopper"],
    "quantum-phantom": ["phantom-collapser", "entanglement-breaker", "probability-master"],
  };

  app.post("/api/boss/challenge", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { bossId, mutationLevel } = req.body;
      if (!bossId || mutationLevel === undefined) {
        return res.status(400).json({ message: "Boss ID and mutation level required" });
      }
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const baseFee = 10;
      const fee = baseFee + (mutationLevel * 5);
      if (user.coins < fee) {
        return res.status(400).json({ message: `Not enough coins! You need ${fee} coins to challenge this boss.` });
      }
      await storage.updateUser(user.id, { coins: user.coins - fee } as any);
      res.json({ fee, remainingCoins: user.coins - fee });
    } catch (error) {
      res.status(500).json({ message: "Failed to start boss challenge" });
    }
  });

  app.post("/api/boss/defeat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { bossId, mutationLevel, gemUpgradesDisabled } = req.body;
      if (!bossId || mutationLevel === undefined) {
        return res.status(400).json({ message: "Boss ID and mutation level required" });
      }
      const bossUpgradesOff = gemUpgradesDisabled === true;
      
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      let gemsEarned = 0;
      if (mutationLevel >= 2) {
        gemsEarned = 2;
      }

      let bossXpMultiplier = 1;
      let bossCoinsMultiplier = 1;
      if (!bossUpgradesOff && isUpgradeActive(user, "upgrade-boss-rush")) {
        bossXpMultiplier = 1.5;
        bossCoinsMultiplier = 1.5;
      }

      const itemsAwarded: string[] = [];
      const allShopItems = await storage.getShopItems();
      const bossRewardItems = allShopItems.filter(i => i.rewardSource === `boss:${bossId}`);
      for (const ri of bossRewardItems) {
        if (!user.inventory.includes(ri.id)) {
          itemsAwarded.push(ri.id);
        }
      }

      if (mutationLevel >= 2) {
        const omegaReward = allShopItems.find(i => i.rewardSource === "boss:any-omega");
        if (omegaReward && !user.inventory.includes(omegaReward.id) && !itemsAwarded.includes(omegaReward.id)) {
          itemsAwarded.push(omegaReward.id);
        }
      }

      const REGULAR_BOSSES = ["chaos-storm", "dr-blackout", "mutation-master", "professor-meltdown", "gravity-king", "plague-lord", "tecton-the-shaker", "nebula-queen"];
      const WORLD_BOSSES = ["the-kraken", "magma-titan", "frost-wyrm", "jungle-hydra", "cosmic-entity", "crystal-golem", "thunder-king", "virus-prime", "rex-overlord", "quantum-phantom"];
      const bossesDefeated = user.bossesDefeated as Record<string, number> || {};
      const updatedBosses = { ...bossesDefeated, [bossId]: Math.max(bossesDefeated[bossId] || 0, mutationLevel + 1) };
      const allRegularDefeated = REGULAR_BOSSES.every(b => (updatedBosses[b] || 0) > 0);
      if (allRegularDefeated) {
        const allBossReward = allShopItems.find(i => i.rewardSource === "boss:all-regular");
        if (allBossReward && !user.inventory.includes(allBossReward.id) && !itemsAwarded.includes(allBossReward.id)) {
          itemsAwarded.push(allBossReward.id);
        }
      }
      const allWorldDefeated = WORLD_BOSSES.every(b => (updatedBosses[b] || 0) > 0);
      if (allWorldDefeated) {
        const worldRewards = allShopItems.filter(i => i.rewardSource === "boss:all-world");
        for (const wr of worldRewards) {
          if (!user.inventory.includes(wr.id) && !itemsAwarded.includes(wr.id)) {
            itemsAwarded.push(wr.id);
          }
        }
      }

      const badgesAwarded: string[] = [];
      const bossBadges = BOSS_BADGE_MAP[bossId];
      if (bossBadges) {
        const badgeForLevel = bossBadges[Math.min(mutationLevel, bossBadges.length - 1)];
        if (badgeForLevel && !(user.badges || []).includes(badgeForLevel)) {
          badgesAwarded.push(badgeForLevel);
        }
        for (let i = 0; i < Math.min(mutationLevel, bossBadges.length - 1); i++) {
          if (!(user.badges || []).includes(bossBadges[i]) && !badgesAwarded.includes(bossBadges[i])) {
            badgesAwarded.push(bossBadges[i]);
          }
        }
      }
      if (allRegularDefeated && !(user.badges || []).includes("boss-slayer") && !badgesAwarded.includes("boss-slayer")) {
        badgesAwarded.push("boss-slayer");
      }

      const BOSS_XP_REWARDS: Record<string, number[]> = {
        "chaos-storm": [500, 750, 1000],
        "professor-meltdown": [500, 750, 1500],
        "gravity-king": [500, 750, 1500],
        "tecton-the-shaker": [500, 750, 1500],
        "the-kraken": [500, 750, 1500],
        "magma-titan": [500, 750, 1500],
        "frost-wyrm": [500, 750, 1500],
        "jungle-hydra": [500, 750, 1500],
        "cosmic-entity": [500, 750, 1500],
        "crystal-golem": [500, 750, 1500],
        "thunder-king": [500, 750, 1500],
        "virus-prime": [500, 750, 1500],
        "rex-overlord": [500, 750, 1500],
        "dr-blackout": [750, 1000, 1500],
        "mutation-master": [750, 1000, 1500],
        "plague-lord": [750, 1000, 1500],
        "nebula-queen": [750, 1000, 1500],
        "quantum-phantom": [500, 750, 1500],
        "the-void": [2000, 3000],
        "professor-paradox": [2000, 3000],
        "king-element": [2000, 3000],
        "the-architect": [2000, 3000],
        "dark-matter": [750, 1000, 1500],
        "nano-swarm": [750, 1000, 1500],
        "quantum-computer": [1000, 1500, 2000],
      };
      const bossXpList = BOSS_XP_REWARDS[bossId];
      const baseXP = bossXpList
        ? bossXpList[Math.min(mutationLevel, bossXpList.length - 1)]
        : (mutationLevel === 0 ? 500 : mutationLevel === 1 ? 750 : 1500);
      const baseCoins = mutationLevel === 0 ? 100 : mutationLevel === 1 ? 200 : 500;
      const xpEarned = Math.floor(baseXP * bossXpMultiplier);
      const coinsEarned = Math.floor(baseCoins * bossCoinsMultiplier);

      const rebirthMult = (user.rebirthMultiplier || 100) / 100;
      const finalXP = Math.floor(xpEarned * rebirthMult);
      const finalCoins = Math.floor(coinsEarned * rebirthMult);

      const newXP = (user.xp || 0) + finalXP;
      const newCoins = (user.coins || 0) + finalCoins;
      const newLevel = computeLevel(newXP);

      const updates: any = { bossesDefeated: updatedBosses, xp: newXP, coins: newCoins, level: newLevel };
      if (gemsEarned > 0) {
        updates.gems = (user.gems || 0) + gemsEarned;
      }
      if (itemsAwarded.length > 0) {
        updates.inventory = [...user.inventory, ...itemsAwarded];
      }
      if (badgesAwarded.length > 0) {
        updates.badges = [...(user.badges || []), ...badgesAwarded];
      }
      await storage.updateUser(user.id, updates);

      if (!bossUpgradesOff && isUpgradeActive(user, "upgrade-boss-rush")) {
        await consumeUpgradeUse(user.id, await storage.getUser(user.id) || user, "upgrade-boss-rush");
      }
      if (!bossUpgradesOff && isUpgradeActive(user, "upgrade-boss-insight")) {
        await consumeUpgradeUse(user.id, await storage.getUser(user.id) || user, "upgrade-boss-insight");
      }
      
      res.json({ gemsEarned, xpEarned: finalXP, coinsEarned: finalCoins, itemsAwarded, badgesAwarded, bossXpMultiplier, bossCoinsMultiplier });
    } catch (error) {
      res.status(500).json({ message: "Failed to record boss defeat" });
    }
  });

  app.post("/api/experiment/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { experimentId, gemUpgradesDisabled } = req.body;
      if (!experimentId) return res.status(400).json({ message: "Experiment ID required" });
      const labUpgradesOff = gemUpgradesDisabled === true;

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const completedExperiments = ((user.gameScores as Record<string, any>)?._experiments || []) as string[];
      if (!completedExperiments.includes(experimentId)) {
        completedExperiments.push(experimentId);
      }

      const newScores = { ...(user.gameScores as Record<string, any>), _experiments: completedExperiments };
      let xpEarned = 25;
      let coinsEarned = 10;

      if (!labUpgradesOff && isUpgradeActive(user, "upgrade-lab-mastery")) {
        xpEarned = Math.floor(xpEarned * 3);
        coinsEarned = Math.floor(coinsEarned * 3);
      }
      if (!labUpgradesOff && isUpgradeActive(user, "upgrade-xp-boost")) {
        xpEarned = Math.floor(xpEarned * 2);
      }
      if (!labUpgradesOff && isUpgradeActive(user, "upgrade-double-coins")) {
        coinsEarned = Math.floor(coinsEarned * 2);
      }
      if (!labUpgradesOff && isUpgradeActive(user, "upgrade-coin-magnet")) {
        coinsEarned = Math.floor(coinsEarned * 1.25);
      }
      const labNow = Date.now();
      const labActivePotions = ((user.activePotions as any[]) || []).filter((p: any) => p.expiresAt > labNow);
      const labActivePotionIds = labActivePotions.map((p: any) => p.potionId);
      const labPotionLvls = ((user as any).itemLevels || {}) as Record<string, number>;
      const labPotionMult = (id: string, base: number) => base + 0.25 * (labPotionLvls[id] || 0);
      if (labActivePotionIds.includes("potion-xp-small")) xpEarned = Math.floor(xpEarned * labPotionMult("potion-xp-small", 1.25));
      if (labActivePotionIds.includes("potion-xp-large")) xpEarned = Math.floor(xpEarned * labPotionMult("potion-xp-large", 1.5));
      if (labActivePotionIds.includes("potion-xp-mega")) xpEarned = Math.floor(xpEarned * labPotionMult("potion-xp-mega", 3));
      if (labActivePotionIds.includes("potion-coin-small")) coinsEarned = Math.floor(coinsEarned * labPotionMult("potion-coin-small", 1.25));
      if (labActivePotionIds.includes("potion-coin-large")) coinsEarned = Math.floor(coinsEarned * labPotionMult("potion-coin-large", 1.5));
      if (labActivePotionIds.includes("potion-mega")) { xpEarned = Math.floor(xpEarned * labPotionMult("potion-mega", 2)); coinsEarned = Math.floor(coinsEarned * labPotionMult("potion-mega", 2)); }
      if (labActivePotionIds.includes("potion-lucky") && Math.random() < 0.3) { xpEarned = Math.floor(xpEarned * labPotionMult("potion-lucky", 2)); coinsEarned = Math.floor(coinsEarned * labPotionMult("potion-lucky", 2)); }
      const newXP = user.xp + xpEarned;
      const newLevel = computeLevel(newXP);
      const newBadges = [...(user.badges || [])];

      const LAB_EXPERIMENT_IDS = ["pendulum-lab", "plant-growth", "color-mixing", "density-tower", "sound-waves", "volcano-sim"];
      const allDone = LAB_EXPERIMENT_IDS.every(id => completedExperiments.includes(id));
      if (allDone && !newBadges.includes("lab-rat")) {
        newBadges.push("lab-rat");
      }
      const badgeMilestonesLab: [number, string][] = [[5,"badge-collector"],[10,"science-sage"],[20,"badge-hoarder"],[30,"badge-master"],[40,"badge-overlord"],[50,"badge-supreme"]];
      for (const [threshold, badge] of badgeMilestonesLab) {
        if (newBadges.length >= threshold && !newBadges.includes(badge)) newBadges.push(badge);
      }
      const xpMilestonesLab: [number, string][] = [[500,"xp-starter"],[1500,"xp-rising"],[3000,"xp-pro"],[5000,"xp-legend"],[10000,"xp-mythic"],[25000,"xp-transcendent"],[50000,"xp-eternal"]];
      for (const [threshold, badge] of xpMilestonesLab) {
        if (newXP >= threshold && !newBadges.includes(badge)) newBadges.push(badge);
      }

      const updated = await storage.updateUser(user.id, {
        xp: newXP,
        coins: user.coins + coinsEarned,
        level: newLevel,
        badges: newBadges,
        gameScores: newScores,
      });

      const labConsumeUpgrades = ["upgrade-lab-mastery", "upgrade-xp-boost", "upgrade-double-coins", "upgrade-coin-magnet"];
      for (const uid of labConsumeUpgrades) {
        if (!labUpgradesOff && isUpgradeActive(user, uid)) {
          await consumeUpgradeUse(user.id, await storage.getUser(user.id) || user, uid);
        }
      }

      const freshLabUser = await storage.getUser(user.id);
      const newlyEarned = newBadges.filter(b => !(user.badges || []).includes(b));
      const { password: _, ...safeUser } = (freshLabUser || updated) as any;
      res.json({
        user: safeUser,
        rewards: { xp: xpEarned, coins: coinsEarned, badgesEarned: newlyEarned },
        completedExperiments,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to complete experiment" });
    }
  });

  const SAFETY_KEYS = ["hideLeaderboard", "disableMultiplayer", "hideTrade", "hideQuests", "hideCommunityPacks", "hideNews", "hideClans", "focusMode"];

  app.patch("/api/user/safety", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      const body = req.body as Record<string, unknown>;
      const current = ((user as any).safetySettings || {}) as Record<string, boolean>;
      const updates: Record<string, boolean> = { ...current };
      for (const key of SAFETY_KEYS) {
        if (key in body && typeof body[key] === "boolean") updates[key] = body[key] as boolean;
      }
      await storage.updateUser(user.id, { safetySettings: updates } as any);
      res.json({ success: true, safetySettings: updates });
    } catch { res.status(500).json({ message: "Failed to update safety settings" }); }
  });

  app.patch("/api/classes/:id/safety", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      const cls = await storage.getClass(Number(req.params.id));
      if (!cls) return res.status(404).json({ message: "Class not found" });
      if (cls.teacherId !== user.id && !user.isAdmin) return res.status(403).json({ message: "Teachers only" });
      const body = req.body as Record<string, unknown>;
      const current = ((cls as any).safetySettings || {}) as Record<string, unknown>;
      const updates: Record<string, unknown> = { ...current };
      for (const key of SAFETY_KEYS) {
        if (key in body && typeof body[key] === "boolean") updates[key] = body[key] as boolean;
      }
      if (Array.isArray(body.locked)) {
        updates.locked = (body.locked as string[]).filter((k: string) => SAFETY_KEYS.includes(k));
      }
      await storage.updateClass(cls.id, { safetySettings: updates });
      res.json({ success: true, safetySettings: updates });
    } catch { res.status(500).json({ message: "Failed to update class safety settings" }); }
  });

  app.patch("/api/user/progress", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const allowedFields: Record<string, boolean> = {
        avatarId: true, isMuted: true, badges: true, equippedTheme: true, bossesDefeated: true,
        yearLevel: true, coins: true, gems: true, xp: true, level: true,
        gameScores: true, totalGamesPlayed: true, currentStreak: true, longestStreak: true, lastPlayDate: true,
      };
      const body = req.body as Record<string, unknown>;
      const safeUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body)) {
        if (Object.prototype.hasOwnProperty.call(allowedFields, key) && allowedFields[key]) {
          if (key === "yearLevel") {
            const yl = Number(value);
            if (isNaN(yl) || yl < 3 || yl > 8) continue;
          }
          safeUpdates[key] = value;
        }
      }
      const updated = await storage.updateUser(req.user!.id, safeUpdates);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated as any;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  app.get("/api/shop", async (_req, res) => {
    try {
      const items = await storage.getShopItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to get shop items" });
    }
  });

  const WORLD_EXCLUSIVE_ITEM_IDS = new Set([
    "theme-ocean-depths", "avatar-kraken", "deco-bubbles-deep",
    "theme-magma-core", "avatar-magma-titan", "deco-lava-flow",
    "theme-frozen-tundra", "avatar-frost-wyrm", "deco-snowfall",
    "theme-jungle-canopy", "avatar-jungle-hydra", "deco-vines",
    "theme-space-station", "avatar-cosmic-entity", "deco-stardust",
    "theme-crystal-caverns", "avatar-crystal-golem", "deco-crystal-shimmer",
    "theme-storm-citadel", "avatar-thunder-king", "deco-lightning-storm",
    "theme-cyber-grid", "avatar-virus-prime", "deco-digital-rain",
    "theme-dino-valley", "avatar-rex-overlord", "deco-fossil-dust",
    "theme-quantum-realm", "avatar-quantum-phantom", "deco-particle-field",
  ]);

  const WORLD_COSTS: Record<string, { coins: number; gems: number }> = {
    "ocean-depths": { coins: 200, gems: 0 },
    "volcanic-core": { coins: 500, gems: 0 },
    "frozen-tundra": { coins: 1000, gems: 2 },
    "jungle-canopy": { coins: 2000, gems: 5 },
    "space-station": { coins: 3000, gems: 8 },
    "crystal-caverns": { coins: 4000, gems: 12 },
    "storm-citadel": { coins: 5000, gems: 16 },
    "cyber-grid": { coins: 7000, gems: 22 },
    "dino-valley": { coins: 9000, gems: 28 },
    "quantum-realm": { coins: 12000, gems: 35 },
  };

  const SHOP_REFUND_RATE = 0.5;

  app.post("/api/worlds/unlock", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { worldId } = req.body;
      if (!worldId || typeof worldId !== "string") {
        return res.status(400).json({ message: "Valid world ID required" });
      }

      const worldCost = WORLD_COSTS[worldId];
      if (!worldCost) return res.status(404).json({ message: "Unknown world" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.coins < worldCost.coins) {
        return res.status(400).json({ message: "Not enough coins" });
      }
      if (worldCost.gems > 0 && user.gems < worldCost.gems) {
        return res.status(400).json({ message: "Not enough gems" });
      }

      const updates: any = {};
      if (worldCost.coins > 0) updates.coins = user.coins - worldCost.coins;
      if (worldCost.gems > 0) updates.gems = user.gems - worldCost.gems;

      if (Object.keys(updates).length > 0) {
        await storage.updateUser(req.user!.id, updates);
      }

      const updatedUser = await storage.getUser(req.user!.id);
      const { password: _, ...safeUser } = updatedUser as any;
      res.json({ success: true, user: safeUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to unlock world" });
    }
  });

  app.post("/api/shop/buy", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { itemId } = req.body;
      if (!itemId) return res.status(400).json({ message: "Item ID required" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // powerup-streak-saver is stackable — skip the "already owned" check so re-purchase adds uses
      if (itemId !== "powerup-streak-saver" && user.inventory.includes(itemId)) {
        return res.status(400).json({ message: "You already own this item" });
      }

      const items = await storage.getShopItems();
      const item = items.find((i) => i.id === itemId);
      if (!item) return res.status(404).json({ message: "Item not found" });

      const isAdmin = user.isAdmin === true;

      if (!isAdmin && item.rewardSource) {
        return res.status(400).json({ message: "This item can only be earned as a reward" });
      }

      if (!isAdmin && item.requiredLevel && user.level < item.requiredLevel) {
        return res.status(400).json({ message: `You need to be Level ${item.requiredLevel} to buy this item` });
      }

      if (!isAdmin && item.requiredRebirth && item.requiredRebirth > 0 && (user.rebirthLevel || 0) < item.requiredRebirth) {
        return res.status(400).json({ message: `You need Rebirth ${item.requiredRebirth} to buy this item` });
      }

      if (!isAdmin && item.requiredXp && item.requiredXp > 0 && (user.xp || 0) < item.requiredXp) {
        return res.status(400).json({ message: `You need ${item.requiredXp} XP to buy this item` });
      }

      if (!isAdmin && user.coins < item.price) {
        return res.status(400).json({ message: "Not enough coins" });
      }

      // For Streak Shield Pack: don't duplicate in inventory, just add 5 uses to upgradeExpirations
      const newInventory = user.inventory.includes(itemId) ? user.inventory : [...user.inventory, itemId];
      const newBadges = [...(user.badges || [])];

      const allItems = items.filter(i => i.category !== "gem_upgrades");
      if (allItems.every(i => newInventory.includes(i.id)) && !newBadges.includes("shopkeeper")) {
        newBadges.push("shopkeeper");
      }

      const extraUpdates: any = {};
      if (itemId === "powerup-streak-saver") {
        const expirations = { ...((user.upgradeExpirations || {}) as Record<string, number>) };
        expirations["powerup-streak-saver"] = (expirations["powerup-streak-saver"] || 0) + 5;
        extraUpdates.upgradeExpirations = expirations;
      }

      const updated = await storage.updateUser(user.id, {
        coins: isAdmin ? user.coins : user.coins - item.price,
        inventory: newInventory,
        badges: newBadges,
        ...extraUpdates,
      });

      const { password: _, ...safeUser } = updated as any;
      res.json({ user: safeUser, item, badgeEarned: newBadges.length > (user.badges || []).length ? "shopkeeper" : null });
    } catch (error) {
      res.status(500).json({ message: "Failed to purchase item" });
    }
  });

  app.post("/api/user/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || typeof currentPassword !== "string" || typeof newPassword !== "string") {
        return res.status(400).json({ message: "Current and new password required" });
      }
      if (newPassword.length < 4) {
        return res.status(400).json({ message: "New password must be at least 4 characters" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await comparePasswords(currentPassword, user.password);
      if (!valid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashed = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashed });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post("/api/shop/refund", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { itemId } = req.body;
      if (!itemId || typeof itemId !== "string") {
        return res.status(400).json({ message: "Item ID required" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (GEM_UPGRADE_CATALOG[itemId] !== undefined) {
        const inventory = user.inventory || [];
        if (!inventory.includes(itemId)) {
          return res.status(400).json({ message: "You don't own this upgrade" });
        }
        const uses = { ...(((user as any).upgradeExpirations as Record<string, number>) || {}) };
        const isPermanentUpgrade = COSMETIC_UPGRADES.has(itemId);
        const currentUses = uses[itemId] || (isPermanentUpgrade ? 1 : 0);
        if (currentUses <= 0) {
          return res.status(400).json({ message: "No unused upgrade uses to refund" });
        }
        const refundAmount = Math.floor(GEM_UPGRADE_CATALOG[itemId] * SHOP_REFUND_RATE);
        if (isPermanentUpgrade) {
          delete uses[itemId];
        } else {
          uses[itemId] = currentUses - 1;
          if (uses[itemId] <= 0) delete uses[itemId];
        }
        const newInventory = uses[itemId] ? inventory : inventory.filter((i) => i !== itemId);
        const itemLevels = { ...(((user as any).itemLevels as Record<string, number>) || {}) };
        if (!uses[itemId]) delete itemLevels[itemId];
        const updated = await storage.updateUser(user.id, {
          gems: ((user as any).gems || 0) + refundAmount,
          inventory: newInventory,
          upgradeExpirations: uses,
          itemLevels,
        } as any);
        const { password: _, ...safeUser } = updated as any;
        return res.json({ user: safeUser, refundAmount, currency: "gems" });
      }

      const items = await storage.getShopItems();
      const item = items.find((i) => i.id === itemId);
      if (!item) return res.status(404).json({ message: "Item not found" });

      if (item.rewardSource || item.price <= 0) {
        return res.status(400).json({ message: "Reward items cannot be refunded" });
      }

      if (!user.inventory.includes(itemId)) {
        return res.status(400).json({ message: "You don't own this item" });
      }

      if (user.avatarId === itemId) {
        return res.status(400).json({ message: "Unequip this avatar before refunding" });
      }

      const refundAmount = Math.floor(item.price * SHOP_REFUND_RATE);

      const cosmetics = (user.equippedCosmetics as Record<string, string>) || {};
      for (const [cat, eqId] of Object.entries(cosmetics)) {
        if (eqId === itemId) delete cosmetics[cat];
      }
      const itemLevels = { ...(((user as any).itemLevels as Record<string, number>) || {}) };
      delete itemLevels[itemId];

      const updated = await storage.updateUser(user.id, {
        coins: user.coins + refundAmount,
        inventory: user.inventory.filter((i) => i !== itemId),
        equippedCosmetics: cosmetics,
        itemLevels,
      } as any);

      const { password: _, ...safeUser } = updated as any;
      res.json({ user: safeUser, refundAmount, currency: "coins" });
    } catch (error) {
      res.status(500).json({ message: "Failed to refund item" });
    }
  });

  app.post("/api/user/display-name", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { displayName } = req.body;
      if (!displayName || typeof displayName !== "string") return res.status(400).json({ message: "Display name is required" });
      const trimmed = displayName.trim();
      if (trimmed.length < 2 || trimmed.length > 24) return res.status(400).json({ message: "Display name must be 2-24 characters" });
      if (!/^[a-zA-Z0-9_ ]+$/.test(trimmed)) return res.status(400).json({ message: "Display name can only contain letters, numbers, spaces and underscores" });
      await storage.updateUser(req.user!.id, { displayName: trimmed } as any);
      res.json({ success: true, displayName: trimmed });
    } catch {
      res.status(500).json({ message: "Failed to update display name" });
    }
  });

  app.post("/api/shop/equip-cosmetic", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { itemId, category } = req.body;
      if (!itemId || !category) {
        return res.status(400).json({ message: "Item ID and category required" });
      }

      const validCategories = ["follower", "decoration", "badge_style", "theme", "title", "frame", "coin_style", "gem_style", "profile_animation", "name_animation"];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid cosmetic category" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!user.inventory.includes(itemId)) {
        return res.status(400).json({ message: "You don't own this item" });
      }

      // The premium "profile border" upgrades live in the `upgrade` category but
      // share the single `frame` border slot, so only one border shows at a time.
      const BORDER_UPGRADE_IDS = ["upgrade-golden-profile", "upgrade-diamond-profile", "upgrade-elite-border"];
      const isBorderUpgrade = category === "frame" && BORDER_UPGRADE_IDS.includes(itemId);

      const items = await storage.getShopItems();
      const shopItem = items.find((i) => i.id === itemId);
      if (!isBorderUpgrade && (!shopItem || shopItem.category !== category)) {
        return res.status(400).json({ message: "Item does not match the specified category" });
      }

      const cosmetics = (user.equippedCosmetics as Record<string, string>) || {};
      const updateData: any = {};

      if (cosmetics[category] === itemId) {
        delete cosmetics[category];
        if (category === "theme") updateData.equippedTheme = "default";
      } else {
        cosmetics[category] = itemId;
        if (category === "theme") updateData.equippedTheme = itemId;
      }

      updateData.equippedCosmetics = cosmetics;
      const updated = await storage.updateUser(user.id, updateData);
      const { password: _, ...safeUser } = updated as any;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to equip cosmetic" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const leaders = await storage.getLeaderboard(50);
      const newlyGranted: string[] = [];
      const currentUserId = req.isAuthenticated() ? req.user!.id : null;
      if (leaders.length > 0) {
        const top = leaders[0];
        const TITLE_ID = "title-leaderboard-1st";
        const THEME_ID = "theme-supreme-champion";
        const AVATAR_ID = "avatar-supreme-champion";
        const DECO_ID = "deco-supreme-champion";
        const FRAME_ID = "frame-supreme-champion";
        const FOLLOWER_ID = "follower-supreme-champion";
        const BADGE_STYLE_ID = "badge-style-supreme-champion";
        const COIN_STYLE_ID = "coin-style-supreme-champion";
        const GEM_STYLE_ID = "gem-style-supreme-champion";
        const itemsToGrant = [TITLE_ID, THEME_ID, AVATAR_ID, DECO_ID, FRAME_ID, FOLLOWER_ID, BADGE_STYLE_ID, COIN_STYLE_ID, GEM_STYLE_ID];
        for (const item of itemsToGrant) {
          if (!top.inventory.includes(item)) {
            top.inventory = [...top.inventory, item];
            if (top.id === currentUserId) newlyGranted.push(item);
          }
        }
        const topBadges = top.badges || [];
        if (!topBadges.includes("leaderboard-first")) {
          await storage.updateUser(top.id, { inventory: top.inventory, badges: [...topBadges, "leaderboard-first"] } as any);
        } else {
          await storage.updateUser(top.id, { inventory: top.inventory } as any);
        }

        const allUsers = await storage.getLeaderboard(9999);
        for (const u of allUsers) {
          if (u.id === top.id) continue;
          const hasAny = itemsToGrant.some(item => u.inventory.includes(item));
          if (hasAny) {
            let filtered = u.inventory.filter((x: string) => !itemsToGrant.includes(x));
            await storage.updateUser(u.id, { inventory: filtered } as any);
            u.inventory = filtered;
            const cosmetics = u.equippedCosmetics as any || {};
            let cosmeticUpdates: any = {};
            if (cosmetics.title === TITLE_ID) cosmeticUpdates.title = null;
            if (cosmetics.theme === THEME_ID) cosmeticUpdates.theme = null;
            if (cosmetics.decoration === DECO_ID) cosmeticUpdates.decoration = null;
            if (cosmetics.frame === FRAME_ID) cosmeticUpdates.frame = null;
            if (cosmetics.follower === FOLLOWER_ID) cosmeticUpdates.follower = null;
            if (cosmetics.badge_style === BADGE_STYLE_ID) cosmeticUpdates.badge_style = null;
            if (cosmetics.coin_style === COIN_STYLE_ID) cosmeticUpdates.coin_style = null;
            if (cosmetics.gem_style === GEM_STYLE_ID) cosmeticUpdates.gem_style = null;
            if (Object.keys(cosmeticUpdates).length > 0) {
              const newCosmetics = { ...cosmetics, ...cosmeticUpdates };
              await storage.updateUser(u.id, { equippedCosmetics: newCosmetics } as any);
              if (cosmetics.theme === THEME_ID) {
                await storage.updateUser(u.id, { equippedTheme: null } as any);
              }
            }
            if ((u as any).avatarId === AVATAR_ID) {
              await storage.updateUser(u.id, { avatarId: "astronaut" } as any);
            }
          }
        }

        // Top 5 players share the exclusive "Elite Five" rank (revoked if they fall out).
        const TOP5_TITLE = "title-elite-five";
        const top5Ids = new Set(leaders.slice(0, 5).map(u => u.id));
        const everyone = await storage.getLeaderboard(9999);
        for (const u of everyone) {
          const has = u.inventory.includes(TOP5_TITLE);
          if (top5Ids.has(u.id) && !has) {
            await storage.updateUser(u.id, { inventory: [...u.inventory, TOP5_TITLE] } as any);
            if (u.id === currentUserId) newlyGranted.push(TOP5_TITLE);
          } else if (!top5Ids.has(u.id) && has) {
            const cos = (u.equippedCosmetics as any) || {};
            const upd: any = { inventory: u.inventory.filter((x: string) => x !== TOP5_TITLE) };
            if (cos.title === TOP5_TITLE) upd.equippedCosmetics = { ...cos, title: null };
            await storage.updateUser(u.id, upd);
          }
        }
      }
      const allClans = await storage.getAllClans();
      if (allClans.length > 0) {
        const sortedClans = [...allClans].sort((a, b) => b.totalXP - a.totalXP);
        const topClanMembers = await storage.getClanMembers(sortedClans[0].id);
        const CLAN_TITLE = "title-clan-1st";
        const CLAN_THEME = "theme-clan-champion";
        const CLAN_AVATAR = "avatar-clan-champion";
        const CLAN_DECO = "deco-clan-champion";
        const CLAN_FRAME = "frame-clan-champion";
        const CLAN_FOLLOWER = "follower-clan-champion";
        const CLAN_BADGE_STYLE = "badge-style-clan-champion";
        const CLAN_COIN_STYLE = "coin-style-clan-champion";
        const CLAN_GEM_STYLE = "gem-style-clan-champion";
        const clanItems = [CLAN_TITLE, CLAN_THEME, CLAN_AVATAR, CLAN_DECO, CLAN_FRAME, CLAN_FOLLOWER, CLAN_BADGE_STYLE, CLAN_COIN_STYLE, CLAN_GEM_STYLE];
        for (const m of topClanMembers) {
          let inv = [...m.inventory];
          let changed = false;
          for (const item of clanItems) {
            if (!inv.includes(item)) {
              inv.push(item);
              changed = true;
              if (m.id === currentUserId) newlyGranted.push(item);
            }
          }
          if (changed) {
            await storage.updateUser(m.id, { inventory: inv } as any);
          }
        }
        for (let i = 1; i < sortedClans.length; i++) {
          const members = await storage.getClanMembers(sortedClans[i].id);
          for (const m of members) {
            const hasAny = clanItems.some(item => m.inventory.includes(item));
            if (hasAny) {
              const filtered = m.inventory.filter((x: string) => !clanItems.includes(x));
              await storage.updateUser(m.id, { inventory: filtered } as any);
              const cosmetics = m.equippedCosmetics as any || {};
              let updates: any = {};
              if (cosmetics.title === CLAN_TITLE) updates.title = null;
              if (cosmetics.theme === CLAN_THEME) updates.theme = null;
              if (cosmetics.decoration === CLAN_DECO) updates.decoration = null;
              if (cosmetics.frame === CLAN_FRAME) updates.frame = null;
              if (cosmetics.follower === CLAN_FOLLOWER) updates.follower = null;
              if (cosmetics.badge_style === CLAN_BADGE_STYLE) updates.badge_style = null;
              if (cosmetics.coin_style === CLAN_COIN_STYLE) updates.coin_style = null;
              if (cosmetics.gem_style === CLAN_GEM_STYLE) updates.gem_style = null;
              if (Object.keys(updates).length > 0) {
                await storage.updateUser(m.id, { equippedCosmetics: { ...cosmetics, ...updates } } as any);
                if (updates.theme) await storage.updateUser(m.id, { equippedTheme: null } as any);
              }
              if (m.avatarId === CLAN_AVATAR) {
                await storage.updateUser(m.id, { avatarId: "astronaut" } as any);
              }
            }
          }
        }
      }
      const allTeams = await storage.getAllTeams();
      if (allTeams.length > 0) {
        const sortedTeams = [...allTeams].sort((a, b) => b.totalXP - a.totalXP);
        const topTeamMembers = await storage.getTeamMembers(sortedTeams[0].id);
        const TEAM_TITLE = "title-team-1st";
        const TEAM_THEME = "theme-team-champion";
        const TEAM_AVATAR = "avatar-team-champion";
        const TEAM_DECO = "deco-team-champion";
        const TEAM_FRAME = "frame-team-champion";
        const TEAM_FOLLOWER = "follower-team-champion";
        const TEAM_BADGE_STYLE = "badge-style-team-champion";
        const TEAM_COIN_STYLE = "coin-style-team-champion";
        const TEAM_GEM_STYLE = "gem-style-team-champion";
        const teamItems = [TEAM_TITLE, TEAM_THEME, TEAM_AVATAR, TEAM_DECO, TEAM_FRAME, TEAM_FOLLOWER, TEAM_BADGE_STYLE, TEAM_COIN_STYLE, TEAM_GEM_STYLE];
        for (const m of topTeamMembers) {
          let inv = [...m.inventory];
          let changed = false;
          for (const item of teamItems) {
            if (!inv.includes(item)) {
              inv.push(item);
              changed = true;
              if (m.id === currentUserId) newlyGranted.push(item);
            }
          }
          if (changed) {
            await storage.updateUser(m.id, { inventory: inv } as any);
          }
        }
        for (let i = 1; i < sortedTeams.length; i++) {
          const members = await storage.getTeamMembers(sortedTeams[i].id);
          for (const m of members) {
            const hasAny = teamItems.some(item => m.inventory.includes(item));
            if (hasAny) {
              const filtered = m.inventory.filter((x: string) => !teamItems.includes(x));
              await storage.updateUser(m.id, { inventory: filtered } as any);
              const cosmetics = m.equippedCosmetics as any || {};
              let updates: any = {};
              if (cosmetics.title === TEAM_TITLE) updates.title = null;
              if (cosmetics.theme === TEAM_THEME) updates.theme = null;
              if (cosmetics.decoration === TEAM_DECO) updates.decoration = null;
              if (cosmetics.frame === TEAM_FRAME) updates.frame = null;
              if (cosmetics.follower === TEAM_FOLLOWER) updates.follower = null;
              if (cosmetics.badge_style === TEAM_BADGE_STYLE) updates.badge_style = null;
              if (cosmetics.coin_style === TEAM_COIN_STYLE) updates.coin_style = null;
              if (cosmetics.gem_style === TEAM_GEM_STYLE) updates.gem_style = null;
              if (Object.keys(updates).length > 0) {
                await storage.updateUser(m.id, { equippedCosmetics: { ...cosmetics, ...updates } } as any);
                if (updates.theme) await storage.updateUser(m.id, { equippedTheme: null } as any);
              }
              if (m.avatarId === TEAM_AVATAR) {
                await storage.updateUser(m.id, { avatarId: "astronaut" } as any);
              }
            }
          }
        }
      }
      const now = Date.now();
      const safe = leaders.map(({ password, ...u }) => ({
        ...u,
        isOnline: (now - (lastActive.get(u.id) || 0)) < ONLINE_THRESHOLD_MS,
      }));
      res.json({ leaders: safe, newlyGranted });
    } catch (error) {
      res.status(500).json({ message: "Failed to get leaderboard" });
    }
  });

  function clanLiveTotals(members: any[]) {
    return {
      memberCount: members.length,
      totalXP: members.reduce((sum, m) => sum + (m.xp || 0), 0),
      totalCoins: members.reduce((sum, m) => sum + (m.coins || 0), 0),
      totalGems: members.reduce((sum, m) => sum + (m.gems || 0), 0),
      totalBadges: members.reduce((sum, m) => sum + ((m.badges || []).length), 0),
    };
  }

  function teamLiveTotals(members: any[]) {
    return {
      memberCount: members.length,
      totalXP: members.reduce((sum, m) => sum + (m.xp || 0), 0),
      totalCoins: members.reduce((sum, m) => sum + (m.coins || 0), 0),
      totalBadges: members.reduce((sum, m) => sum + ((m.badges || []).length), 0),
    };
  }

  async function removeClanMemberWithLiveTotals(clan: any, target: any) {
    const members = await storage.getClanMembers(clan.id);
    const remaining = members.filter((m) => m.id !== target.id);
    const coLeaders = Array.isArray(clan.coLeaders) ? clan.coLeaders as number[] : [];
    await storage.updateUser(target.id, { clanId: null } as any);
    await storage.updateClan(clan.id, {
      ...clanLiveTotals(remaining),
      coLeaders: coLeaders.filter((id) => id !== target.id),
      election: null,
    } as any);
  }

  async function removeTeamMemberWithLiveTotals(team: any, target: any) {
    const members = await storage.getTeamMembers(team.id);
    const remaining = members.filter((m) => m.id !== target.id);
    await storage.updateUser(target.id, { teamId: null } as any);
    await storage.updateTeam(team.id, {
      ...teamLiveTotals(remaining),
      election: null,
    } as any);
  }

  app.get("/api/clans", async (_req, res) => {
    try {
      const allClans = await storage.getAllClans();
      const liveClans = await Promise.all(allClans.map(async (clan) => {
        const members = await storage.getClanMembers(clan.id);
        return { ...clan, ...clanLiveTotals(members) };
      }));
      res.json(liveClans.sort((a, b) => b.totalXP - a.totalXP));
    } catch (error) {
      res.status(500).json({ message: "Failed to get clans" });
    }
  });

  app.get("/api/clans/:id", async (req, res) => {
    try {
      const clan = await storage.getClan(Number(req.params.id));
      if (!clan) return res.status(404).json({ message: "Clan not found" });
      if ((clan.election as any)?.active && (clan.election as any)?.type !== "kick") {
        await autoResolveElection("clan", clan, clan.id);
        const updated = await storage.getClan(clan.id);
        if (updated) {
          const members = await storage.getClanMembers(clan.id);
          const safeMembers = members.map(({ password, ...u }) => u);
          return res.json({ clan: { ...updated, ...clanLiveTotals(members) }, members: safeMembers });
        }
      }
      const members = await storage.getClanMembers(clan.id);
      const safeMembers = members.map(({ password, ...u }) => u);
      res.json({ clan: { ...clan, ...clanLiveTotals(members) }, members: safeMembers });
    } catch (error) {
      res.status(500).json({ message: "Failed to get clan" });
    }
  });

  app.post("/api/clans", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { name, tag, description, icon, color, motto } = req.body;
      if (!name || !tag) return res.status(400).json({ message: "Name and tag are required" });
      if (tag.length > 5) return res.status(400).json({ message: "Tag must be 5 characters or less" });
      if (name.length > 24) return res.status(400).json({ message: "Name must be 24 characters or less" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.clanId) {
        // Only block if the clan actually still exists — otherwise clear the
        // orphaned reference (clan was deleted) so the player isn't stuck.
        const currentClan = await storage.getClan(user.clanId);
        if (currentClan) return res.status(400).json({ message: "You're already in a clan! Leave first." });
        await storage.updateUser(user.id, { clanId: null } as any);
      }

      const existing = await storage.getClanByName(name);
      if (existing) return res.status(400).json({ message: "A clan with that name already exists" });

      const clan = await storage.createClan({
        name,
        tag: tag.toUpperCase(),
        description: description || "",
        leaderId: user.id,
        leaderName: user.username,
        icon: icon || "Shield",
        color: color || "hsl(270, 85%, 55%)",
        motto: motto || "",
        goals: "",
        plans: "",
        attributes: "",
        recruiting: true,
        memberCount: 1,
        totalXP: user.xp,
        totalCoins: user.coins,
        totalGems: user.gems,
        totalBadges: (user.badges || []).length,
        createdAt: new Date().toISOString(),
      });

      const clanBadges = user.badges || [];
      const clanUserUpdates: any = { clanId: clan.id };
      if (!clanBadges.includes("clan-joiner")) {
        clanUserUpdates.badges = [...clanBadges, "clan-joiner"];
      }
      await storage.updateUser(user.id, clanUserUpdates);
      res.json(clan);
    } catch (error: any) {
      if (error?.constraint) return res.status(400).json({ message: "Clan name or tag already taken" });
      res.status(500).json({ message: "Failed to create clan" });
    }
  });

  app.post("/api/clans/:id/update", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const clanId = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const clan = await storage.getClan(clanId);
      if (!clan) return res.status(404).json({ message: "Clan not found" });
      const coLeaders = Array.isArray(clan.coLeaders) ? (clan.coLeaders as number[]) : [];
      if (clan.leaderId !== user.id && !coLeaders.includes(user.id)) return res.status(403).json({ message: "Only clan leaders can edit this" });

      const { description, motto, goals, plans, attributes, recruiting, icon, color, joinTest } = req.body;
      const updates: any = {};
      if (description !== undefined) updates.description = String(description).slice(0, 500);
      if (motto !== undefined) updates.motto = String(motto).slice(0, 100);
      if (goals !== undefined) updates.goals = String(goals).slice(0, 500);
      if (plans !== undefined) updates.plans = String(plans).slice(0, 500);
      if (attributes !== undefined) updates.attributes = String(attributes).slice(0, 500);
      if (recruiting !== undefined) updates.recruiting = Boolean(recruiting);
      if (icon !== undefined) updates.icon = String(icon);
      if (color !== undefined) updates.color = String(color);
      if (joinTest !== undefined) {
        const sanitized = Array.isArray(joinTest) ? joinTest.slice(0, 5).map((q: any) => ({
          question: String(q.question || "").slice(0, 200),
          options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o: any) => String(o).slice(0, 100)) : [],
          correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
        })).filter((q: any) => q.question && q.options.length >= 2) : [];
        updates.joinTest = sanitized;
      }

      await storage.updateClan(clanId, updates);
      const updated = await storage.getClan(clanId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update clan" });
    }
  });

  app.post("/api/clans/:id/join", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const clanId = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.clanId) return res.status(400).json({ message: "You're already in a clan! Leave first." });

      const clan = await storage.getClan(clanId);
      if (!clan) return res.status(404).json({ message: "Clan not found" });

      const joinTest = Array.isArray(clan.joinTest) ? (clan.joinTest as any[]) : [];
      if (joinTest.length > 0) {
        const { answers } = req.body || {};
        if (!answers || !Array.isArray(answers)) {
          return res.status(400).json({ message: "This clan requires passing an entry test!", hasTest: true, testQuestions: joinTest.map((q: any) => ({ question: q.question, options: q.options })) });
        }
        let correct = 0;
        for (let i = 0; i < joinTest.length; i++) {
          if (answers[i] === joinTest[i].correctIndex) correct++;
        }
        if (correct < joinTest.length) {
          return res.status(400).json({ message: `You got ${correct}/${joinTest.length} correct. You need a perfect score to join!`, testFailed: true });
        }
      }

      const userUpdates: any = { clanId };
      const badges = user.badges || [];
      if (!badges.includes("clan-joiner")) {
        userUpdates.badges = [...badges, "clan-joiner"];
      }
      await storage.updateUser(user.id, userUpdates);
      await storage.updateClan(clanId, {
        memberCount: clan.memberCount + 1,
        totalXP: clan.totalXP + user.xp,
        totalCoins: clan.totalCoins + user.coins,
        totalGems: clan.totalGems + user.gems,
        totalBadges: clan.totalBadges + (user.badges || []).length,
      } as any);

      const updated = await storage.getClan(clanId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to join clan" });
    }
  });

  app.post("/api/clans/:id/leave", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const clanId = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.clanId !== clanId) return res.status(400).json({ message: "You're not in this clan" });

      const clan = await storage.getClan(clanId);
      if (!clan) return res.status(404).json({ message: "Clan not found" });

      await storage.updateUser(user.id, { clanId: null } as any);

      if (clan.memberCount <= 1) {
        await storage.deleteClan(clanId);
        return res.json({ message: "You left and the clan was disbanded (no members left)" });
      }

      const newUpdates: any = {
        memberCount: clan.memberCount - 1,
        totalXP: Math.max(0, clan.totalXP - user.xp),
        totalCoins: Math.max(0, clan.totalCoins - user.coins),
        totalGems: Math.max(0, clan.totalGems - user.gems),
        totalBadges: Math.max(0, clan.totalBadges - (user.badges || []).length),
      };

      const leaveCoLeaders = Array.isArray(clan.coLeaders) ? (clan.coLeaders as number[]) : [];
      if (leaveCoLeaders.includes(user.id)) {
        newUpdates.coLeaders = leaveCoLeaders.filter(id => id !== user.id);
      }

      if (clan.leaderId === user.id) {
        const members = await storage.getClanMembers(clanId);
        const remaining = members.filter(m => m.id !== user.id);
        if (remaining.length > 0) {
          const nextLeader = remaining.find(m => leaveCoLeaders.includes(m.id)) || remaining[0];
          newUpdates.leaderId = nextLeader.id;
          newUpdates.leaderName = nextLeader.username;
          if (leaveCoLeaders.includes(nextLeader.id)) {
            newUpdates.coLeaders = (newUpdates.coLeaders || leaveCoLeaders).filter((id: number) => id !== nextLeader.id);
          }
        }
      }

      await storage.updateClan(clanId, newUpdates);
      res.json({ message: "You left the clan" });
    } catch (error) {
      res.status(500).json({ message: "Failed to leave clan" });
    }
  });

  app.post("/api/clans/:id/kick", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const clanId = Number(req.params.id);
      const { userId } = req.body;
      const requester = await storage.getUser(req.user!.id);
      if (!requester) return res.status(404).json({ message: "User not found" });

      const clan = await storage.getClan(clanId);
      if (!clan) return res.status(404).json({ message: "Clan not found" });
      if (clan.leaderId !== requester.id) return res.status(403).json({ message: "Only the clan owner can kick members" });
      if (userId === clan.leaderId) return res.status(400).json({ message: "Cannot kick the clan owner" });

      const target = await storage.getUser(userId);
      if (!target || target.clanId !== clanId) return res.status(400).json({ message: "User is not in this clan" });

      // Owner kicks directly — no vote required.
      await removeClanMemberWithLiveTotals(clan, target);
      res.json({ message: `${target.username} was removed from the clan by the owner.` });
    } catch (error) {
      res.status(500).json({ message: "Failed to kick member" });
    }
  });

  app.post("/api/clans/:id/kick/vote", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const clanId = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user || user.clanId !== clanId) return res.status(403).json({ message: "You're not in this clan" });
      const clan = await storage.getClan(clanId);
      if (!clan) return res.status(404).json({ message: "Clan not found" });
      const vote = clan.election as any;
      if (!vote?.active || vote.type !== "kick") return res.status(400).json({ message: "No kick vote is active" });
      if (user.id === clan.leaderId || user.id === vote.targetId) return res.status(403).json({ message: "You cannot vote on this kick" });
      const eligible = Array.isArray(vote.eligibleVoters) ? vote.eligibleVoters : [];
      if (!eligible.some((v: any) => v.id === user.id)) return res.status(403).json({ message: "You are not eligible to vote" });
      if (vote.votes?.[String(user.id)]) return res.status(400).json({ message: "You already voted" });

      vote.votes = { ...(vote.votes || {}), [String(user.id)]: true };
      const yesVotes = Object.keys(vote.votes).length;
      const target = await storage.getUser(vote.targetId);
      if (!target || target.clanId !== clanId) {
        await storage.updateClan(clanId, { election: null } as any);
        return res.json({ message: "Kick vote cleared because the member already left.", resolved: true });
      }

      if (yesVotes >= (vote.requiredVotes || eligible.length)) {
        await removeClanMemberWithLiveTotals(clan, target);
        return res.json({ message: `${target.username} was removed after everyone approved.`, resolved: true });
      }

      await storage.updateClan(clanId, { election: vote } as any);
      res.json({ message: "Vote recorded", vote, resolved: false, votesRemaining: (vote.requiredVotes || eligible.length) - yesVotes });
    } catch (error) {
      res.status(500).json({ message: "Failed to record kick vote" });
    }
  });

  app.post("/api/clans/:id/promote", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const clanId = Number(req.params.id);
      const { userId } = req.body;
      const requester = await storage.getUser(req.user!.id);
      if (!requester) return res.status(404).json({ message: "User not found" });

      const clan = await storage.getClan(clanId);
      if (!clan) return res.status(404).json({ message: "Clan not found" });
      if (clan.leaderId !== requester.id) return res.status(403).json({ message: "Only the clan owner can promote members" });

      const target = await storage.getUser(userId);
      if (!target || target.clanId !== clanId) return res.status(400).json({ message: "User is not in this clan" });
      if (userId === clan.leaderId) return res.status(400).json({ message: "Owner is already the highest rank" });

      const currentCoLeaders = Array.isArray(clan.coLeaders) ? (clan.coLeaders as number[]) : [];
      if (currentCoLeaders.includes(userId)) return res.status(400).json({ message: "User is already a co-leader" });

      await storage.updateClan(clanId, { coLeaders: [...currentCoLeaders, userId] } as any);
      res.json({ message: `${target.username} is now a co-leader` });
    } catch (error) {
      res.status(500).json({ message: "Failed to promote member" });
    }
  });

  app.post("/api/clans/:id/demote", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const clanId = Number(req.params.id);
      const { userId } = req.body;
      const requester = await storage.getUser(req.user!.id);
      if (!requester) return res.status(404).json({ message: "User not found" });

      const clan = await storage.getClan(clanId);
      if (!clan) return res.status(404).json({ message: "Clan not found" });
      if (clan.leaderId !== requester.id) return res.status(403).json({ message: "Only the clan owner can demote co-leaders" });

      const currentCoLeaders = Array.isArray(clan.coLeaders) ? (clan.coLeaders as number[]) : [];
      if (!currentCoLeaders.includes(userId)) return res.status(400).json({ message: "User is not a co-leader" });

      await storage.updateClan(clanId, { coLeaders: currentCoLeaders.filter(id => id !== userId) } as any);
      res.json({ message: "Member has been demoted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to demote member" });
    }
  });

  function generateInviteCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  app.get("/api/teams", async (_req, res) => {
    try {
      const allTeams = await storage.getAllTeams();
      const liveTeams = await Promise.all(allTeams.map(async (team) => {
        const members = await storage.getTeamMembers(team.id);
        return { ...team, ...teamLiveTotals(members) };
      }));
      res.json(liveTeams.sort((a, b) => b.totalXP - a.totalXP));
    } catch (error) {
      res.status(500).json({ message: "Failed to get teams" });
    }
  });

  app.get("/api/teams/:id", async (req, res) => {
    try {
      const team = await storage.getTeam(Number(req.params.id));
      if (!team) return res.status(404).json({ message: "Team not found" });
      if ((team.election as any)?.active && (team.election as any)?.type !== "kick") {
        await autoResolveElection("team", team, team.id);
        const updated = await storage.getTeam(team.id);
        if (updated) {
          const members = await storage.getTeamMembers(team.id);
          const safeMembers = members.map(({ password, ...u }) => u);
          return res.json({ team: { ...updated, ...teamLiveTotals(members) }, members: safeMembers });
        }
      }
      const members = await storage.getTeamMembers(team.id);
      const safeMembers = members.map(({ password, ...u }) => u);
      res.json({ team: { ...team, ...teamLiveTotals(members) }, members: safeMembers });
    } catch (error) {
      res.status(500).json({ message: "Failed to get team" });
    }
  });

  app.get("/api/teams/invite/:code", async (req, res) => {
    try {
      const team = await storage.getTeamByInviteCode(req.params.code);
      if (!team) return res.status(404).json({ message: "Invalid invite code" });
      const members = await storage.getTeamMembers(team.id);
      const safeMembers = members.map(({ password, ...u }) => u);
      res.json({ team: { ...team, ...teamLiveTotals(members) }, members: safeMembers });
    } catch (error) {
      res.status(500).json({ message: "Failed to look up invite" });
    }
  });

  app.post("/api/teams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { name, icon, color } = req.body;
      if (!name || name.length < 2 || name.length > 24) return res.status(400).json({ message: "Team name must be 2-24 characters" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.teamId) {
        const currentTeam = await storage.getTeam(user.teamId);
        if (currentTeam) return res.status(400).json({ message: "You're already on a team! Leave first." });
        await storage.updateUser(user.id, { teamId: null } as any);
      }

      const inviteCode = generateInviteCode();
      const team = await storage.createTeam({
        name,
        inviteCode,
        leaderId: user.id,
        leaderName: user.username,
        icon: icon || "⚡",
        color: color || "hsl(220, 85%, 55%)",
        memberCount: 1,
        totalXP: user.xp,
        totalCoins: user.coins,
        totalBadges: (user.badges || []).length,
        createdAt: new Date().toISOString(),
      });

      const teamBadges = user.badges || [];
      const teamUserUpdates: any = { teamId: team.id };
      if (!teamBadges.includes("team-joiner")) {
        teamUserUpdates.badges = [...teamBadges, "team-joiner"];
      }
      await storage.updateUser(user.id, teamUserUpdates);
      res.json(team);
    } catch (error) {
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.post("/api/teams/:id/update", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const teamId = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const team = await storage.getTeam(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      if (team.leaderId !== user.id) return res.status(403).json({ message: "Only the team leader can edit this" });

      const { icon, color } = req.body;
      const updates: any = {};
      if (icon !== undefined) updates.icon = String(icon);
      if (color !== undefined) updates.color = String(color);

      await storage.updateTeam(teamId, updates);
      const updated = await storage.getTeam(teamId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.post("/api/teams/join/:code", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.teamId) return res.status(400).json({ message: "You're already on a team! Leave first." });

      const team = await storage.getTeamByInviteCode(req.params.code);
      if (!team) return res.status(404).json({ message: "Invalid invite code" });
      if (team.memberCount >= 5) return res.status(400).json({ message: "This team is full! (max 5 members)" });

      const teamUpdates: any = { teamId: team.id };
      const badges = user.badges || [];
      if (!badges.includes("team-joiner")) {
        teamUpdates.badges = [...badges, "team-joiner"];
      }
      await storage.updateUser(user.id, teamUpdates);
      await storage.updateTeam(team.id, {
        memberCount: team.memberCount + 1,
        totalXP: team.totalXP + user.xp,
        totalCoins: team.totalCoins + user.coins,
        totalBadges: team.totalBadges + (user.badges || []).length,
      } as any);

      const updated = await storage.getTeam(team.id);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to join team" });
    }
  });

  app.post("/api/teams/:id/leave", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const teamId = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.teamId !== teamId) return res.status(400).json({ message: "You're not on this team" });

      const team = await storage.getTeam(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });

      await storage.updateUser(user.id, { teamId: null } as any);

      if (team.memberCount <= 1) {
        await storage.deleteTeam(teamId);
        return res.json({ message: "You left and the team was disbanded (no members left)" });
      }

      const newUpdates: any = {
        memberCount: team.memberCount - 1,
        totalXP: Math.max(0, team.totalXP - user.xp),
        totalCoins: Math.max(0, team.totalCoins - user.coins),
        totalBadges: Math.max(0, team.totalBadges - (user.badges || []).length),
      };

      if (team.leaderId === user.id) {
        const members = await storage.getTeamMembers(teamId);
        const remaining = members.filter(m => m.id !== user.id);
        if (remaining.length > 0) {
          newUpdates.leaderId = remaining[0].id;
          newUpdates.leaderName = remaining[0].username;
        }
      }

      await storage.updateTeam(teamId, newUpdates);
      res.json({ message: "You left the team" });
    } catch (error) {
      res.status(500).json({ message: "Failed to leave team" });
    }
  });

  app.post("/api/teams/:id/kick", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const teamId = Number(req.params.id);
      const { userId } = req.body;
      const requester = await storage.getUser(req.user!.id);
      if (!requester) return res.status(404).json({ message: "User not found" });

      const team = await storage.getTeam(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      if (team.leaderId !== requester.id) return res.status(403).json({ message: "Only the team owner can kick members" });

      const target = await storage.getUser(userId);
      if (!target || target.teamId !== teamId) return res.status(400).json({ message: "User is not on this team" });
      if (userId === team.leaderId) return res.status(400).json({ message: "Cannot kick the team owner" });

      // Owner kicks directly — no vote required.
      await removeTeamMemberWithLiveTotals(team, target);
      res.json({ message: `${target.username} was removed from the team by the owner.` });
    } catch (error) {
      res.status(500).json({ message: "Failed to kick member" });
    }
  });

  app.post("/api/teams/:id/kick/vote", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const teamId = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user || user.teamId !== teamId) return res.status(403).json({ message: "You're not on this team" });
      const team = await storage.getTeam(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const vote = team.election as any;
      if (!vote?.active || vote.type !== "kick") return res.status(400).json({ message: "No kick vote is active" });
      if (user.id === team.leaderId || user.id === vote.targetId) return res.status(403).json({ message: "You cannot vote on this kick" });
      const eligible = Array.isArray(vote.eligibleVoters) ? vote.eligibleVoters : [];
      if (!eligible.some((v: any) => v.id === user.id)) return res.status(403).json({ message: "You are not eligible to vote" });
      if (vote.votes?.[String(user.id)]) return res.status(400).json({ message: "You already voted" });

      vote.votes = { ...(vote.votes || {}), [String(user.id)]: true };
      const yesVotes = Object.keys(vote.votes).length;
      const target = await storage.getUser(vote.targetId);
      if (!target || target.teamId !== teamId) {
        await storage.updateTeam(teamId, { election: null } as any);
        return res.json({ message: "Kick vote cleared because the member already left.", resolved: true });
      }

      if (yesVotes >= (vote.requiredVotes || eligible.length)) {
        await removeTeamMemberWithLiveTotals(team, target);
        return res.json({ message: `${target.username} was removed after everyone approved.`, resolved: true });
      }

      await storage.updateTeam(teamId, { election: vote } as any);
      res.json({ message: "Vote recorded", vote, resolved: false, votesRemaining: (vote.requiredVotes || eligible.length) - yesVotes });
    } catch (error) {
      res.status(500).json({ message: "Failed to record kick vote" });
    }
  });

  async function fetchPvpQuestions(): Promise<{ question: string; options: string[]; correctIndex: number; explanation?: string | null }[]> {
    try {
      const { db } = await import("./storage");
      const { communityQuestions, communityPacks } = await import("@shared/schema");
      const { eq, inArray } = await import("drizzle-orm");

      const approvedPacks = await db.select({ id: communityPacks.id }).from(communityPacks).where(eq(communityPacks.approved, true));
      const packIds = approvedPacks.map(p => p.id);
      if (packIds.length === 0) return [];

      const allQuestions = await db.select().from(communityQuestions).where(inArray(communityQuestions.packId, packIds));
      for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
      }
      return allQuestions.slice(0, 10).map(q => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      }));
    } catch (_) {
      return [];
    }
  }

  function scheduleBotAnswer(roomId: string) {
    const room = pvpRooms.get(roomId);
    if (!room || room.state === "finished") return;

    const delay = Math.floor(Math.random() * 6000) + 2000;
    const timer = setTimeout(() => {
      const r = pvpRooms.get(roomId);
      if (!r || r.state === "finished") return;
      if (r.answeredThisRound.has(-2)) return;

      r.answeredThisRound.add(-2);
      const botPlayer = r.players.find(p => p.id === -2);
      if (!botPlayer) return;

      const q = r.questions[r.currentQuestion];
      const correct = Math.random() < 0.6;
      const answerIndex = correct ? q.correctIndex : ((q.correctIndex + 1 + Math.floor(Math.random() * 3)) % q.options.length);
      const timeTaken = delay / 1000;
      let points = 0;
      if (answerIndex === q.correctIndex) {
        points = 1;
        if (timeTaken <= 5) points += 0.5;
      }
      botPlayer.score += points;
      botPlayer.answered++;

      const human = r.players.find(p => p.id !== -2);
      if (human && human.ws && human.ws.readyState === WebSocket.OPEN) {
        human.ws.send(JSON.stringify({
          type: "pvp_opponent_progress",
          answered: botPlayer.answered,
        }));
      }

      const allAnswered = r.players.every(p => r.answeredThisRound.has(p.id));
      if (allAnswered) {
        r.currentQuestion++;
        relayToSpectators(r.spectators, {
          type: "spectate_update",
          players: r.players.map(p => ({ id: p.id, username: p.username, score: p.score })),
          questionIndex: r.currentQuestion,
          totalQuestions: 10,
        });
        if (r.currentQuestion >= 10) {
          finishPvpRoom(r).catch(e => console.error("finishPvpRoom error:", e));
        } else {
          setTimeout(() => {
            if (r.state === "finished") return;
            r.answeredThisRound.clear();
            r.questionStartTime = Date.now();
            const nextQ = r.questions[r.currentQuestion];
            const questionMsg = JSON.stringify({
              type: "pvp_next_question",
              question: { text: nextQ.question, options: nextQ.options, index: r.currentQuestion },
            });
            for (const p of r.players) {
              if (p.ws && p.ws.readyState === WebSocket.OPEN) {
                p.ws.send(questionMsg);
              }
            }
            scheduleBotAnswer(r.id);
          }, 2000);
        }
      }
    }, delay);
    if (!room.botTimers) room.botTimers = [];
    room.botTimers.push(timer);
  }

  function startPvpRoundTimeout(roomId: string) {
    const room = pvpRooms.get(roomId);
    if (!room || room.state === "finished") return;
    if (room.roundTimeout) clearTimeout(room.roundTimeout);
    room.roundTimeout = setTimeout(() => {
      const r = pvpRooms.get(roomId);
      if (!r || r.state === "finished") return;
      for (const p of r.players) {
        if (!r.answeredThisRound.has(p.id)) {
          r.answeredThisRound.add(p.id);
          p.answered++;
          if (p.ws && p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(JSON.stringify({
              type: "pvp_answer_result",
              correct: false,
              correctIndex: r.questions[r.currentQuestion].correctIndex,
              explanation: r.questions[r.currentQuestion].explanation || null,
              points: 0,
              totalScore: p.score,
              timedOut: true,
            }));
          }
          const opponent = r.players.find(op => op.id !== p.id);
          if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
            opponent.ws.send(JSON.stringify({ type: "pvp_opponent_progress", answered: p.answered }));
          }
        }
      }
      r.currentQuestion++;
      relayToSpectators(r.spectators, {
        type: "spectate_update",
        players: r.players.map(p => ({ id: p.id, username: p.username, score: p.score })),
        questionIndex: r.currentQuestion,
        totalQuestions: 10,
      });
      if (r.currentQuestion >= 10) {
        finishPvpRoom(r).catch(e => console.error("finishPvpRoom error:", e));
      } else {
        setTimeout(() => {
          if (r.state === "finished") return;
          r.answeredThisRound.clear();
          r.questionStartTime = Date.now();
          const nextQ = r.questions[r.currentQuestion];
          const questionMsg = JSON.stringify({
            type: "pvp_next_question",
            question: { text: nextQ.question, options: nextQ.options, index: r.currentQuestion },
          });
          for (const p of r.players) {
            if (p.ws && p.ws.readyState === WebSocket.OPEN) p.ws.send(questionMsg);
          }
          const hasBot = r.players.some(p => p.id === -2);
          if (hasBot) scheduleBotAnswer(r.id);
          startPvpRoundTimeout(r.id);
        }, 2000);
      }
    }, 17000);
  }

  async function finishPvpRoom(room: PvpRoom) {
    if (room.roundTimeout) clearTimeout(room.roundTimeout);
    room.state = "finished";
    if (room.botTimers) room.botTimers.forEach(t => clearTimeout(t));

    const p1 = room.players[0];
    const p2 = room.players[1];
    const winner = p1.score > p2.score ? p1 : p2.score > p1.score ? p2 : null;
    const loser = winner ? (winner === p1 ? p2 : p1) : null;

    try {
      if (winner && winner.id > 0) {
        const winnerUser = await storage.getUser(winner.id);
        if (winnerUser) {
          let coinReward = 50 + (room.wager * 2);
          await storage.updateUser(winner.id, {
            xp: winnerUser.xp + 100,
            coins: winnerUser.coins + coinReward,
          });
        }
      }
      if (loser && loser.id > 0) {
        const loserUser = await storage.getUser(loser.id);
        if (loserUser) {
          await storage.updateUser(loser.id, {
            xp: loserUser.xp + 25,
            coins: Math.max(0, loserUser.coins - room.wager),
          });
        }
      }
      if (!winner) {
        for (const p of room.players) {
          if (p.id > 0) {
            const u = await storage.getUser(p.id);
            if (u) {
              await storage.updateUser(p.id, { xp: u.xp + 50 });
            }
          }
        }
      }
      for (const p of room.players) {
        if (p.id > 0 && p.score > 0) {
          const u = await storage.getUser(p.id);
          if (u) {
            const prevScores = (u.gameScores as Record<string, number>) || {};
            const pvpKey = "pvp-trivia";
            const existing = prevScores[pvpKey] || 0;
            if (p.score > existing) {
              await storage.updateUser(p.id, { gameScores: { ...prevScores, [pvpKey]: p.score } as any });
            }
          }
        }
      }
      // Update win streaks
      if (winner && winner.id > 0) {
        const wu = await storage.getUser(winner.id);
        if (wu) {
          const newStreak = ((wu as any).winStreak || 0) + 1;
          const newPeak   = Math.max(newStreak, (wu as any).winStreakPeak || 0);
          await storage.updateUser(wu.id, { winStreak: newStreak, winStreakPeak: newPeak } as any);
        }
      }
      if (loser && loser.id > 0) {
        const lu = await storage.getUser(loser.id);
        if (lu) {
          await storage.updateUser(lu.id, { winStreak: 0 } as any);
        }
      }
    } catch (e) {
      console.error("PvP reward error:", e);
    }

    let adminBeaterTitle: string | null = null;
    try {
      if (winner && winner.id > 0 && loser && loser.id > 0) {
        const winnerUser = await storage.getUser(winner.id);
        const loserUser = await storage.getUser(loser.id);
        if (
          winnerUser && loserUser &&
          (loserUser.isAdmin || loserUser.isUltraAdmin) &&
          !winnerUser.isAdmin && !winnerUser.isUltraAdmin
        ) {
          const titleId = `admin-beater:${loserUser.username}`;
          const badges = (winnerUser.badges as string[]) || [];
          if (!badges.includes(titleId)) {
            const inventory = (winnerUser.inventory as string[]) || [];
            await storage.updateUser(winnerUser.id, {
              badges: [...badges, titleId],
              inventory: inventory.includes(titleId) ? inventory : [...inventory, titleId],
            } as any);
            adminBeaterTitle = `${loserUser.username} Beater`;
          }
        }
      }
    } catch (e) {
      console.error("Admin beater title error:", e);
    }

    const resultMsg = {
      type: "pvp_result",
      players: room.players.map(p => ({ id: p.id, username: p.username, score: p.score, answered: p.answered })),
      winnerId: winner?.id || null,
      wager: room.wager,
      rewards: {
        winner: { xp: 100, coins: 50 + (room.wager * 2) },
        loser: { xp: 25, coins: -room.wager },
        draw: { xp: 50, coins: 0 },
      },
      adminBeaterTitle,
    };
    const resultStr = JSON.stringify(resultMsg);
    for (const p of room.players) {
      if (p.ws && p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(resultStr);
      }
      const lp = lobby.get(p.id);
      if (lp) lp.status = "idle";
    }
    relayToSpectators(room.spectators, { type: "spectate_ended" });
    if (room.ranked) {
      await emitRankedResult(room.players, winner?.id ?? null, room.ranked);
    }
    pvpRooms.delete(room.id);
    broadcastLobby();
  }

  // Apply ELO + placements for a finished ranked match and tell each human player.
  async function emitRankedResult(
    players: { id: number; username: string; ws: WebSocket | null; score: number }[],
    winnerId: number | null,
    mode: RankedMode,
  ) {
    const humans = players.filter(p => p.id > 0);
    for (const me of humans) {
      try {
        const u = await storage.getUser(me.id);
        if (!u) continue;
        const rs = normalizeRanked((u as any).rankedStats);
        const result: "win" | "loss" | "draw" =
          winnerId === null ? "draw" : winnerId === me.id ? "win" : "loss";

        // Opponent ELO (mirror the player's own rating for bots).
        const opp = players.find(p => p.id !== me.id);
        let oppElo = rs.elo || 1000;
        if (opp && opp.id > 0) {
          const ou = await storage.getUser(opp.id);
          oppElo = normalizeRanked((ou as any)?.rankedStats).elo || 1000;
        }

        const before = rs.placed ? rs.elo : 0;
        let delta = 0;
        let justPlaced = false;

        if (!rs.placed) {
          // Placement matches: tally wins, then set a starting rating from them.
          rs.placementsPlayed += 1;
          if (result === "win") rs.placementWins += 1;
          if (rs.placementsPlayed >= PLACEMENT_GAMES) {
            rs.placed = true;
            rs.elo = 700 + rs.placementWins * 130; // 0 wins → Bronze, 5 → Diamond
            justPlaced = true;
          }
        } else {
          const expected = 1 / (1 + Math.pow(10, (oppElo - rs.elo) / 400));
          const sc = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
          delta = Math.round(40 * (sc - expected));
          // Upset bonus: beating a higher-rated player gives extra ELO, scaled
          // by how much stronger they were (the bigger the upset, the bigger the reward).
          if (result === "win" && oppElo > rs.elo) {
            delta += Math.min(20, Math.round((oppElo - rs.elo) / 35));
          }
          rs.elo = Math.max(0, rs.elo + delta);
        }

        if (result === "win") rs.wins += 1;
        else if (result === "loss") rs.losses += 1;
        rs.peakElo = Math.max(rs.peakElo || 0, rs.elo);

        // Multiplayer win bonus, bigger for ranked wins.
        const winBonus = result === "win" ? { xp: 60, coins: 40 } : null;
        const updates: any = { rankedStats: rs };
        if (winBonus) {
          updates.xp = u.xp + winBonus.xp;
          updates.coins = u.coins + winBonus.coins;
          updates.level = computeLevel(u.xp + winBonus.xp);
        }
        await storage.updateUser(me.id, updates);

        if (me.ws && me.ws.readyState === WebSocket.OPEN) {
          me.ws.send(JSON.stringify({
            type: "ranked_result",
            mode, result, before, after: rs.elo, delta,
            placed: rs.placed, justPlaced,
            placementsPlayed: rs.placementsPlayed, placementsTotal: PLACEMENT_GAMES, placementWins: rs.placementWins,
            rank: rankFromElo(rs.elo, rs.placed),
            winBonus,
          }));
        }
      } catch (e) {
        console.error("emitRankedResult error:", e);
      }
    }
  }

  // End a live stream, pay the streamer their gem reward, and notify everyone.
  async function finishStream(streamerId: number, endedByAdmin = false) {
    const stream = streams.get(streamerId);
    if (!stream) return;
    const minutes = Math.floor((Date.now() - stream.startedAt) / 60000);
    let bonus = Math.min(STREAM_END_BONUS_CAP, minutes + stream.peakViewers + stream.commenters.size);
    bonus = Math.max(0, Math.min(bonus, STREAM_GEM_CAP - stream.gemsEarned));
    if (bonus > 0) {
      try {
        const u = await storage.getUser(streamerId);
        if (u) await storage.updateUser(streamerId, { gems: (u.gems || 0) + bonus } as any);
      } catch (e) { console.error("stream reward error:", e); }
    }
    const streamer = lobby.get(streamerId);
    if (streamer && streamer.ws.readyState === WebSocket.OPEN) {
      streamer.ws.send(JSON.stringify({ type: "stream_reward", gems: bonus, endedByAdmin, minutes }));
    }
    sendToStream(stream, { type: "stream_ended", streamerId, endedByAdmin });
    streams.delete(streamerId);
    broadcastStreamsList();
  }

  // A viewer boosts a streamer → streamer earns gems (one boost per viewer).
  async function boostStream(streamerId: number, boosterId: number) {
    const stream = streams.get(streamerId);
    if (!stream || boosterId === streamerId) return;
    if (!stream.viewers.has(boosterId)) return;       // must be watching
    if (stream.boosters.has(boosterId)) return;       // one boost each
    if (stream.gemsEarned >= STREAM_GEM_CAP) return;  // capped
    stream.boosters.add(boosterId);
    const gain = Math.min(STREAM_BOOST_GEMS, STREAM_GEM_CAP - stream.gemsEarned);
    stream.gemsEarned += gain;
    try {
      const u = await storage.getUser(streamerId);
      if (u) await storage.updateUser(streamerId, { gems: (u.gems || 0) + gain } as any);
    } catch (e) { console.error("boost gem error:", e); }
    const booster = lobby.get(boosterId);
    sendToStream(stream, {
      type: "stream_boosted",
      streamerId,
      boosterName: booster?.username || "Someone",
      gems: gain,
      totalBoosts: stream.boosters.size,
    });
  }

  // Flat win bonus for ordinary (non-ranked) multiplayer wins.
  async function creditMultiplayerWin(winnerId: number, players: { id: number; ws: WebSocket | null }[]) {
    if (winnerId <= 0) return;
    try {
      const u = await storage.getUser(winnerId);
      if (!u) return;
      const xp = 25, coins = 15;
      await storage.updateUser(winnerId, { xp: u.xp + xp, coins: u.coins + coins, level: computeLevel(u.xp + xp) } as any);
      const p = players.find(pp => pp.id === winnerId);
      if (p?.ws && p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify({ type: "win_bonus", xp, coins, ranked: false }));
      }
    } catch (e) {
      console.error("creditMultiplayerWin error:", e);
    }
  }

  // A party plays a co-op team match together (their whole party vs rival bots).
  function startPartyMatch(party: Party, gameId: string, difficulty: string) {
    const humans = party.members.map(m => lobby.get(m.id)).filter(Boolean) as LobbyPlayer[];
    if (humans.length === 0) return;
    const teamA = humans.map(h => ({ id: h.id, username: h.username, ws: h.ws, score: 0, done: false, isBot: false }));
    const teamB = humans.map((_, i) => ({ id: -210 - i, username: `Rival Bot ${i + 1}`, ws: null as any, score: 60 + Math.floor(Math.random() * 130), done: true, isBot: true }));
    const roomId = "team_" + Math.random().toString(36).substring(2, 8);
    const room: TeamRoom = {
      id: roomId, gameId, difficulty, state: "playing",
      teams: [{ name: "Your Party", players: teamA }, { name: "Rivals", players: teamB }],
    };
    teamRooms.set(roomId, room);
    humans.forEach(h => {
      h.status = "in_game";
      if (h.ws.readyState === WebSocket.OPEN) {
        h.ws.send(JSON.stringify({
          type: "team_match_found", roomId, gameId, difficulty, myTeam: 0,
          teams: room.teams.map(t => ({ name: t.name, players: t.players.map(p => ({ id: p.id, username: p.username, isBot: p.isBot })) })),
        }));
      }
    });
    broadcastLobby();
  }

  function startRankedGravity(player: LobbyPlayer, opp: LobbyPlayer, modifier = "", modifierName = "") {
    const roomId = generateRoomId();
    const room: GameRoom = {
      id: roomId, gameId: "gravity-dash", state: "playing", currentQuestion: 0, spectators: [], ranked: "gravity",
      players: [
        { id: player.id, username: player.username, ws: player.ws, score: 0, ready: false },
        { id: opp.id, username: opp.username, ws: opp.ws, score: 0, ready: false },
      ],
    };
    rooms.set(roomId, room);
    player.status = "in_game";
    opp.status = "in_game";
    const base = { type: "match_found", roomId, gameId: "gravity-dash", difficulty: "hard", ranked: true, gravityModifier: modifier, gravityModifierName: modifierName };
    player.ws.send(JSON.stringify({ ...base, opponent: { id: opp.id, username: opp.username } }));
    opp.ws.send(JSON.stringify({ ...base, opponent: { id: player.id, username: player.username } }));
    broadcastLobby();
  }

  // Build a ranked quiz from specific topic banks (after the draft picks a topic).
  function buildTopicQuestions(topicKeys: string[], n = 10) {
    const pool: any[] = [];
    for (const k of topicKeys) {
      const bank = TOPIC_QUESTION_BANKS[k];
      if (bank) pool.push(...bank.questions);
    }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const out = pool.slice(0, n);
    let i = 0;
    while (out.length < n && pool.length) { out.push(pool[i % pool.length]); i++; }
    return out.map(q => ({ question: q.question, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation || null }));
  }

  function startRankedDraft(p1: LobbyPlayer, p2: LobbyPlayer, mode: RankedMode) {
    let picks: { key: string; name: string }[];
    let pickKind: "topic" | "modifier";
    let abilities: { id: string; name: string }[];
    if (mode === "quiz") {
      const keys = Object.keys(TOPIC_QUESTION_BANKS);
      for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
      picks = keys.slice(0, 3).map(k => ({ key: k, name: TOPIC_QUESTION_BANKS[k].topic }));
      pickKind = "topic";
      abilities = RANKED_BANNABLE_ABILITIES;
    } else {
      const mods = [...GRAVITY_MODIFIERS];
      for (let i = mods.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mods[i], mods[j]] = [mods[j], mods[i]]; }
      picks = mods.slice(0, 3);
      pickKind = "modifier";
      abilities = [];
    }
    const id = "draft_" + Math.random().toString(36).substring(2, 8);
    const draft: RankedDraft = {
      id, mode, pickKind, picks, abilities,
      players: [p1, p2].map(p => ({ id: p.id, username: p.username, ws: p.ws, bannedPick: null, bannedAbilities: [], done: false })),
    };
    rankedDrafts.set(id, draft);
    p1.status = "in_game";
    p2.status = "in_game";
    const payload = (oppName: string) => JSON.stringify({
      type: "ranked_draft_start", draftId: id, mode, pickKind, picks, abilities, abilityBans: RANKED_ABILITY_BANS, opponent: oppName, banSeconds: 25,
    });
    p1.ws.send(payload(p2.username));
    p2.ws.send(payload(p1.username));
    draft.timeout = setTimeout(() => { resolveDraft(id).catch(e => console.error("draft timeout:", e)); }, 28000);
    broadcastLobby();
  }

  async function resolveDraft(id: string) {
    const draft = rankedDrafts.get(id);
    if (!draft) return;
    if (draft.timeout) clearTimeout(draft.timeout);
    rankedDrafts.delete(id);
    // Random ban for anyone who didn't lock in.
    for (const pl of draft.players) {
      if (!pl.bannedPick) pl.bannedPick = draft.picks[Math.floor(Math.random() * draft.picks.length)].key;
      while (draft.abilities.length && pl.bannedAbilities.length < RANKED_ABILITY_BANS) {
        const pick = draft.abilities[Math.floor(Math.random() * draft.abilities.length)].id;
        if (!pl.bannedAbilities.includes(pick)) pl.bannedAbilities.push(pick);
        else if (pl.bannedAbilities.length >= draft.abilities.length) break;
      }
    }
    const bannedPickKeys = new Set(draft.players.map(p => p.bannedPick).filter(Boolean) as string[]);
    const remaining = draft.picks.filter(t => !bannedPickKeys.has(t.key));
    const survivors = (remaining.length ? remaining : draft.picks);
    const bannedAbilities = Array.from(new Set(draft.players.flatMap(p => p.bannedAbilities)));
    const p1 = lobby.get(draft.players[0].id);
    const p2 = lobby.get(draft.players[1].id);
    if (!p1 || !p2) {
      [p1, p2].forEach(p => { if (p) { p.status = "idle"; if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify({ type: "ranked_draft_cancel" })); } });
      broadcastLobby();
      return;
    }
    if (draft.mode === "quiz") {
      const questions = buildTopicQuestions(survivors.map(t => t.key), 10);
      startRankedQuiz(p1, p2, questions, bannedAbilities, survivors.map(t => t.name));
    } else {
      startRankedGravity(p1, p2, survivors[0]?.key || "", survivors[0]?.name || "");
    }
  }

  function startRankedQuiz(player: LobbyPlayer, opp: LobbyPlayer, questions: PvpRoom["questions"], bannedAbilities: string[] = [], topicNames: string[] = []) {
    if (questions.length < 10) {
      [player, opp].forEach(p => { p.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough ranked questions" })); p.status = "idle"; });
      broadcastLobby();
      return;
    }
    const roomId = generateRoomId();
    const roomPlayers: PvpRoom["players"] = [
      { id: player.id, username: player.username, ws: player.ws, score: 0, answered: 0 },
      { id: opp.id, username: opp.username, ws: opp.ws, score: 0, answered: 0 },
    ];
    const pvpRoom: PvpRoom = {
      id: roomId, players: roomPlayers, questions, currentQuestion: 0, state: "playing",
      wager: 0, answeredThisRound: new Set(), questionStartTime: Date.now(),
      spectators: [], ranked: "quiz",
    };
    pvpRooms.set(roomId, pvpRoom);
    player.status = "in_game";
    opp.status = "in_game";
    const q = questions[0];
    const startMsg = { type: "pvp_start", roomId, wager: 0, totalQuestions: 10, ranked: true, bannedAbilities, topic: topicNames.join(" & "), question: { text: q.question, options: q.options, index: 0 } };
    player.ws.send(JSON.stringify({ ...startMsg, opponent: { id: opp.id, username: opp.username } }));
    opp.ws.send(JSON.stringify({ ...startMsg, opponent: { id: player.id, username: player.username } }));
    startPvpRoundTimeout(roomId);
    broadcastLobby();
  }

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let playerId: number | null = null;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "join_lobby") {
          playerId = msg.userId;
          lastActive.set(playerId, Date.now());
          lobby.set(playerId, {
            id: playerId,
            username: msg.username,
            ws,
            status: "idle",
          });
          broadcastLobby();
        }

        // ─── Live streaming ──────────────────────────────────────────────
        if (msg.type === "start_stream" && playerId) {
          const player = lobby.get(playerId);
          if (player) {
            const existing = streams.get(playerId);
            const stream: LiveStream = existing || {
              streamerId: playerId,
              streamerName: player.username,
              gameId: msg.gameId || "gravity-dash",
              gameName: msg.gameName || msg.gameId || "Arcade",
              score: 0,
              startedAt: Date.now(),
              viewers: new Map(),
              chat: [],
              boosters: new Set(),
              commenters: new Set(),
              peakViewers: 0,
              gemsEarned: 0,
            };
            stream.gameId = msg.gameId || stream.gameId;
            stream.gameName = msg.gameName || stream.gameName;
            stream.score = 0;
            streams.set(playerId, stream);
            ws.send(JSON.stringify({ type: "stream_live", ...streamSummary(stream) }));
            broadcastStreamsList();
          }
        }

        if (msg.type === "stream_score" && playerId) {
          const stream = streams.get(playerId);
          if (stream) {
            stream.score = typeof msg.score === "number" ? msg.score : stream.score;
            sendToStream(stream, { type: "stream_update", streamerId: playerId, score: stream.score, viewerCount: stream.viewers.size });
          }
        }

        if (msg.type === "stop_stream" && playerId) {
          void finishStream(playerId);
        }

        if (msg.type === "stream_boost" && playerId && typeof msg.streamerId === "number") {
          void boostStream(msg.streamerId, playerId);
        }

        // Admins (and ultra-admins) can shut down any live stream.
        if (msg.type === "admin_end_stream" && playerId && typeof msg.streamerId === "number") {
          (async () => {
            const u = await storage.getUser(playerId!);
            if (u && (u.isAdmin || (u as any).isUltraAdmin)) {
              await finishStream(msg.streamerId, true);
            }
          })().catch(e => console.error("admin_end_stream:", e));
        }

        if (msg.type === "get_streams") {
          ws.send(JSON.stringify({ type: "streams_list", streams: Array.from(streams.values()).map(streamSummary) }));
        }

        if (msg.type === "watch_stream" && playerId) {
          const stream = streams.get(msg.streamerId);
          const player = lobby.get(playerId);
          if (stream && player && playerId !== stream.streamerId) {
            stream.viewers.set(playerId, { id: playerId, username: player.username, ws });
            stream.peakViewers = Math.max(stream.peakViewers, stream.viewers.size);
            ws.send(JSON.stringify({
              type: "stream_snapshot",
              ...streamSummary(stream),
              chat: stream.chat.slice(-50),
            }));
            // Tell the streamer a viewer is ready so it can open a WebRTC connection.
            sendToUser(stream.streamerId, { type: "viewer_ready", viewerId: playerId, username: player.username });
            sendToStream(stream, { type: "stream_update", streamerId: stream.streamerId, score: stream.score, viewerCount: stream.viewers.size });
            broadcastStreamsList();
          } else {
            ws.send(JSON.stringify({ type: "stream_ended", streamerId: msg.streamerId }));
          }
        }

        if (msg.type === "leave_stream" && playerId) {
          const stream = streams.get(msg.streamerId);
          if (stream && stream.viewers.delete(playerId)) {
            sendToUser(stream.streamerId, { type: "viewer_gone", viewerId: playerId });
            sendToStream(stream, { type: "stream_update", streamerId: stream.streamerId, score: stream.score, viewerCount: stream.viewers.size });
            broadcastStreamsList();
          }
        }

        // ─── WebRTC signaling relay (mic + screen share) ─────────────────
        if (msg.type === "rtc_offer" && playerId && typeof msg.viewerId === "number") {
          // streamer → specific viewer
          sendToUser(msg.viewerId, { type: "rtc_offer", streamerId: playerId, sdp: msg.sdp });
        }
        if (msg.type === "rtc_answer" && playerId && typeof msg.streamerId === "number") {
          // viewer → streamer
          sendToUser(msg.streamerId, { type: "rtc_answer", viewerId: playerId, sdp: msg.sdp });
        }
        if (msg.type === "rtc_ice" && playerId && typeof msg.to === "number") {
          sendToUser(msg.to, { type: "rtc_ice", from: playerId, candidate: msg.candidate });
        }

        if (msg.type === "stream_chat" && playerId) {
          const stream = streams.get(msg.streamerId);
          const player = lobby.get(playerId);
          const text = sanitizeChat(msg.text);
          if (stream && player && text) {
            const isViewer = stream.viewers.has(playerId) || stream.streamerId === playerId;
            if (isViewer) {
              if (playerId !== stream.streamerId) stream.commenters.add(playerId);
              const chatMsg: StreamChatMsg = { from: player.username, fromId: playerId, text, ts: Date.now() };
              stream.chat.push(chatMsg);
              if (stream.chat.length > 200) stream.chat.shift();
              sendToStream(stream, { type: "stream_chat", streamerId: stream.streamerId, ...chatMsg });
            }
          }
        }

        // ─── Team multiplayer ────────────────────────────────────────────
        if (msg.type === "team_queue" && playerId) {
          const gameId = msg.gameId || "gravity-dash";
          const difficulty = ["easy", "medium", "hard"].includes(msg.difficulty) ? msg.difficulty : "medium";
          const player = lobby.get(playerId);
          if (player) {
            player.status = "queued";
            if (!teamQueue.has(gameId)) teamQueue.set(gameId, []);
            const tq = teamQueue.get(gameId)!;
            if (!tq.find((e) => e.id === playerId)) tq.push({ id: playerId, difficulty, queuedAt: Date.now() });
            ws.send(JSON.stringify({ type: "team_queued", gameId }));
            broadcastLobby();

            // Need 4 humans for a full 2v2; otherwise bot-fill after a wait.
            const tryFormTeamMatch = (allowBots: boolean) => {
              const list = teamQueue.get(gameId);
              if (!list) return;
              const live = list.filter((e) => lobby.get(e.id)?.status === "queued");
              if (!allowBots && live.length < 4) return;
              if (allowBots && live.length < 1) return;
              const chosen = live.slice(0, 4);
              // Match difficulty: use the most common chosen difficulty, else random.
              const counts: Record<string, number> = {};
              chosen.forEach((c) => { counts[c.difficulty] = (counts[c.difficulty] || 0) + 1; });
              let matchDiff = chosen[0].difficulty;
              let best = 0;
              for (const [d, n] of Object.entries(counts)) { if (n > best) { best = n; matchDiff = d; } }
              const allSame = Object.keys(counts).length === 1;
              if (!allSame) matchDiff = ["easy", "medium", "hard"][Math.floor(Math.random() * 3)];

              teamQueue.set(gameId, list.filter((e) => !chosen.find((c) => c.id === e.id)));
              const humans = chosen.map((c) => lobby.get(c.id)).filter(Boolean) as LobbyPlayer[];
              const slots: { id: number; username: string; ws: WebSocket | null; score: number; done: boolean; isBot: boolean }[] =
                humans.map((h) => ({ id: h.id, username: h.username, ws: h.ws, score: 0, done: false, isBot: false }));
              while (slots.length < 4) {
                const n = slots.length;
                slots.push({ id: -100 - n, username: `TeamBot ${n}`, ws: null, score: 0, done: false, isBot: true });
              }
              const roomId = "team_" + Math.random().toString(36).substring(2, 8);
              const room: TeamRoom = {
                id: roomId,
                gameId,
                difficulty: matchDiff,
                teams: [
                  { name: "Blue Team", players: [slots[0], slots[2]] },
                  { name: "Red Team", players: [slots[1], slots[3]] },
                ],
                state: "playing",
              };
              teamRooms.set(roomId, room);
              // Simulate bot scores once.
              room.teams.forEach((t) => t.players.forEach((p) => {
                if (p.isBot) { p.score = 60 + Math.floor(Math.random() * 120); p.done = true; }
              }));
              humans.forEach((h) => {
                h.status = "in_game";
                const myTeamIdx = room.teams.findIndex((t) => t.players.some((p) => p.id === h.id));
                if (h.ws.readyState === WebSocket.OPEN) {
                  h.ws.send(JSON.stringify({
                    type: "team_match_found",
                    roomId,
                    gameId,
                    difficulty: matchDiff,
                    myTeam: myTeamIdx,
                    teams: room.teams.map((t) => ({ name: t.name, players: t.players.map((p) => ({ id: p.id, username: p.username, isBot: p.isBot })) })),
                  }));
                }
              });
              broadcastLobby();
            };

            tryFormTeamMatch(false);
            setTimeout(() => tryFormTeamMatch(true), 8000);
          }
        }

        if (msg.type === "team_cancel_queue" && playerId) {
          teamQueue.forEach((list, gid) => {
            teamQueue.set(gid, list.filter((e) => e.id !== playerId));
          });
          const player = lobby.get(playerId);
          if (player) player.status = "idle";
          broadcastLobby();
        }

        if (msg.type === "team_game_score" && playerId) {
          const room = teamRooms.get(msg.roomId);
          if (room) {
            for (const t of room.teams) {
              const p = t.players.find((pp) => pp.id === playerId);
              if (p) { p.score = typeof msg.score === "number" ? msg.score : 0; p.done = true; }
            }
            const allDone = room.teams.every((t) => t.players.every((p) => p.done));
            if (allDone) {
              const totals = room.teams.map((t) => ({
                name: t.name,
                total: t.players.reduce((s, p) => s + p.score, 0),
                players: t.players.map((p) => ({ id: p.id, username: p.username, score: p.score, isBot: p.isBot })),
              }));
              const winIdx = totals[0].total === totals[1].total ? -1 : (totals[0].total > totals[1].total ? 0 : 1);
              const payload = JSON.stringify({ type: "team_results", teams: totals, winningTeam: winIdx });
              room.teams.forEach((t) => t.players.forEach((p) => {
                if (!p.isBot && p.ws && p.ws.readyState === WebSocket.OPEN) p.ws.send(payload);
                const lp = lobby.get(p.id);
                if (lp) lp.status = "idle";
              }));
              teamRooms.delete(room.id);
              broadcastLobby();
            }
          }
        }

        // ─── Parties ──────────────────────────────────────────────────────
        if (msg.type === "get_party" && playerId) {
          const pid = userParty.get(playerId);
          const p = pid ? parties.get(pid) : null;
          ws.send(JSON.stringify({ type: "party_update", party: p ? partySummary(p) : null }));
        }

        if (msg.type === "party_invite" && playerId && typeof msg.targetId === "number") {
          const host = lobby.get(playerId);
          const target = lobby.get(msg.targetId);
          if (!host || !target || msg.targetId === playerId) return;
          let pid = userParty.get(playerId);
          let p = pid ? parties.get(pid) : undefined;
          if (!p) {
            pid = "party_" + Math.random().toString(36).substring(2, 8);
            p = { id: pid, hostId: playerId, members: [{ id: playerId, username: host.username }], pendingInvites: [] };
            parties.set(pid, p);
            userParty.set(playerId, pid);
          }
          if (p.hostId !== playerId) { ws.send(JSON.stringify({ type: "party_error", message: "Only the host can invite" })); return; }
          if (p.members.length + p.pendingInvites.length >= 4) { ws.send(JSON.stringify({ type: "party_error", message: "Party is full (max 4)" })); return; }
          if (p.members.some(m => m.id === msg.targetId) || p.pendingInvites.includes(msg.targetId)) return;
          if (userParty.get(msg.targetId)) { ws.send(JSON.stringify({ type: "party_error", message: "That player is already in a party" })); return; }
          p.pendingInvites.push(msg.targetId);
          target.ws.send(JSON.stringify({ type: "party_invite_received", partyId: pid, from: host.username }));
          broadcastParty(p);
        }

        if (msg.type === "party_accept" && playerId && typeof msg.partyId === "string") {
          const p = parties.get(msg.partyId);
          const me = lobby.get(playerId);
          if (!p || !me || !p.pendingInvites.includes(playerId) || userParty.get(playerId) || p.members.length >= 4) return;
          p.pendingInvites = p.pendingInvites.filter(id => id !== playerId);
          p.members.push({ id: playerId, username: me.username });
          userParty.set(playerId, p.id);
          broadcastParty(p);
        }

        if (msg.type === "party_decline" && playerId && typeof msg.partyId === "string") {
          const p = parties.get(msg.partyId);
          if (p) { p.pendingInvites = p.pendingInvites.filter(id => id !== playerId); broadcastParty(p); }
        }

        if (msg.type === "party_leave" && playerId) {
          removeFromParty(playerId);
          ws.send(JSON.stringify({ type: "party_update", party: null }));
        }

        if (msg.type === "party_kick" && playerId && typeof msg.targetId === "number") {
          const pid = userParty.get(playerId);
          const p = pid ? parties.get(pid) : null;
          if (p && p.hostId === playerId && msg.targetId !== playerId) removeFromParty(msg.targetId, true);
        }

        if (msg.type === "party_queue" && playerId) {
          const pid = userParty.get(playerId);
          const p = pid ? parties.get(pid) : null;
          if (!p || p.hostId !== playerId) { ws.send(JSON.stringify({ type: "party_error", message: "Only the host can start" })); return; }
          const gameId = msg.gameId || "gravity-dash";
          const difficulty = ["easy", "medium", "hard"].includes(msg.difficulty) ? msg.difficulty : "medium";
          startPartyMatch(p, gameId, difficulty);
        }

        // ─── Ranked matchmaking ──────────────────────────────────────────
        if (msg.type === "ranked_queue" && playerId) {
          const mode: RankedMode = msg.mode === "gravity" ? "gravity" : "quiz";
          (async () => {
            const u = await storage.getUser(playerId!);
            if (!u) return;
            if (computeLevel(u.xp) < RANKED_UNLOCK_LEVEL) {
              ws.send(JSON.stringify({ type: "ranked_locked", unlockLevel: RANKED_UNLOCK_LEVEL }));
              return;
            }
            const player = lobby.get(playerId!);
            if (!player) return;
            player.status = "queued";
            const q = rankedQueue[mode];
            const oppId = q.find(id => id !== playerId && lobby.get(id)?.status === "queued");
            if (oppId !== undefined) {
              rankedQueue[mode] = q.filter(id => id !== oppId && id !== playerId);
              const opp = lobby.get(oppId);
              if (opp) startRankedDraft(player, opp, mode);
            } else {
              if (!q.includes(playerId!)) q.push(playerId!);
              ws.send(JSON.stringify({ type: "ranked_queued", mode }));
              broadcastLobby();
              // Ranked is real players only — no bot fill. Wait for an opponent.
            }
          })().catch(e => console.error("ranked_queue error:", e));
        }

        if (msg.type === "ranked_cancel_queue" && playerId) {
          rankedQueue.quiz = rankedQueue.quiz.filter(id => id !== playerId);
          rankedQueue.gravity = rankedQueue.gravity.filter(id => id !== playerId);
          const player = lobby.get(playerId);
          if (player) player.status = "idle";
          broadcastLobby();
        }

        if (msg.type === "ranked_draft_pick" && playerId) {
          const draft = rankedDrafts.get(msg.draftId);
          if (!draft) return;
          const pl = draft.players.find(p => p.id === playerId);
          if (!pl || pl.done) return;
          if (msg.bannedPick && draft.picks.some(t => t.key === msg.bannedPick)) pl.bannedPick = msg.bannedPick;
          if (Array.isArray(msg.bannedAbilities)) {
            pl.bannedAbilities = msg.bannedAbilities
              .filter((id: any) => draft.abilities.some(a => a.id === id))
              .slice(0, RANKED_ABILITY_BANS);
          }
          pl.done = true;
          const opp = draft.players.find(p => p.id !== playerId);
          if (opp?.ws && opp.ws.readyState === WebSocket.OPEN) opp.ws.send(JSON.stringify({ type: "ranked_draft_opponent_locked" }));
          if (draft.players.every(p => p.done)) resolveDraft(msg.draftId).catch(e => console.error("resolveDraft:", e));
        }

        if (msg.type === "queue" && playerId) {
          // "random" gameId = Quick Play: drop the player into any available game.
          let gameId: string = msg.gameId || "gravity-dash";
          const difficulty = ["easy", "medium", "hard"].includes(msg.difficulty) ? msg.difficulty : "medium";
          const player = lobby.get(playerId);
          if (!player) return;
          player.status = "queued";
          player.gameId = gameId;
          player.difficulty = difficulty;

          if (!queue.has(gameId)) queue.set(gameId, []);
          const q = queue.get(gameId)!;
          if (!q.includes(playerId)) q.push(playerId);

          // Find a partner — prefer the SAME difficulty; if the only partner
          // picked a different difficulty, the match difficulty becomes random.
          const others = q.filter((id) => id !== playerId && lobby.get(id)?.status === "queued");
          const sameDiff = others.find((id) => lobby.get(id)?.difficulty === difficulty);
          const partnerId = sameDiff ?? others[0];

          if (partnerId !== undefined) {
            const p1 = lobby.get(playerId);
            const p2 = lobby.get(partnerId);
            // remove both from queue
            queue.set(gameId, q.filter((id) => id !== playerId && id !== partnerId));
            if (p1 && p2) {
              const matchDiff = p1.difficulty === p2.difficulty
                ? difficulty
                : (["easy", "medium", "hard"][Math.floor(Math.random() * 3)]);
              const roomId = generateRoomId();
              const room: GameRoom = {
                id: roomId,
                gameId,
                players: [
                  { id: p1.id, username: p1.username, ws: p1.ws, score: 0, ready: false },
                  { id: p2.id, username: p2.username, ws: p2.ws, score: 0, ready: false },
                ],
                state: "waiting",
                currentQuestion: 0,
                spectators: [],
              };
              rooms.set(roomId, room);
              p1.status = "in_game";
              p2.status = "in_game";

              p1.ws.send(JSON.stringify({
                type: "match_found", roomId, gameId, difficulty: matchDiff,
                opponent: { id: p2.id, username: p2.username },
              }));
              p2.ws.send(JSON.stringify({
                type: "match_found", roomId, gameId, difficulty: matchDiff,
                opponent: { id: p1.id, username: p1.username },
              }));
              broadcastLobby();
            }
          } else {
            setTimeout(() => {
              const stillQueued = queue.get(gameId);
              if (stillQueued && stillQueued.includes(playerId!)) {
                const idx = stillQueued.indexOf(playerId!);
                stillQueued.splice(idx, 1);
                const player = lobby.get(playerId!);
                if (player) {
                  const roomId = generateRoomId();
                  const room: GameRoom = {
                    id: roomId,
                    gameId,
                    players: [
                      { id: player.id, username: player.username, ws: player.ws, score: 0, ready: false },
                      { id: -1, username: "SciBot 🤖", ws: null as any, score: 0, ready: true },
                    ],
                    state: "waiting",
                    currentQuestion: 0,
                    spectators: [],
                  };
                  rooms.set(roomId, room);
                  player.status = "in_game";

                  player.ws.send(JSON.stringify({
                    type: "match_found",
                    roomId,
                    gameId,
                    difficulty: player.difficulty || "medium",
                    opponent: { id: -1, username: "SciBot 🤖" },
                    isBot: true,
                  }));
                  broadcastLobby();

                  let botScore = 0;
                  const botInterval = setInterval(() => {
                    const activeRoom = rooms.get(roomId);
                    if (!activeRoom || activeRoom.state === "finished") {
                      clearInterval(botInterval);
                      return;
                    }
                    botScore += Math.floor(Math.random() * 20) + 5;
                    const botP = activeRoom.players.find((p) => p.id === -1);
                    if (botP) botP.score = botScore;
                    const humanP = activeRoom.players.find((p) => p.id !== -1);
                    if (humanP && humanP.ws && humanP.ws.readyState === WebSocket.OPEN) {
                      humanP.ws.send(JSON.stringify({
                        type: "bot_score_update",
                        botScore,
                      }));
                    }
                  }, 2000);
                }
              }
            }, 5000);

            ws.send(JSON.stringify({ type: "queued", gameId }));
          }
          broadcastLobby();
        }

        if (msg.type === "cancel_queue" && playerId) {
          const player = lobby.get(playerId);
          if (player) {
            player.status = "idle";
            for (const [gid, q] of queue.entries()) {
              const idx = q.indexOf(playerId);
              if (idx >= 0) q.splice(idx, 1);
            }
          }
          broadcastLobby();
        }

        if (msg.type === "challenge" && playerId) {
          const target = lobby.get(msg.targetId);
          const challenger = lobby.get(playerId);
          if (target && challenger && target.status === "idle") {
            target.ws.send(JSON.stringify({
              type: "challenge_received",
              from: { id: challenger.id, username: challenger.username },
              gameId: msg.gameId,
            }));
          }
        }

        if (msg.type === "accept_challenge" && playerId) {
          const challenger = lobby.get(msg.challengerId);
          const accepter = lobby.get(playerId);
          if (challenger && accepter) {
            const roomId = generateRoomId();
            const gameId = msg.gameId || "gravity-dash";
            const room: GameRoom = {
              id: roomId,
              gameId,
              players: [
                { id: challenger.id, username: challenger.username, ws: challenger.ws, score: 0, ready: false },
                { id: accepter.id, username: accepter.username, ws: accepter.ws, score: 0, ready: false },
              ],
              state: "waiting",
              currentQuestion: 0,
              spectators: [],
            };
            rooms.set(roomId, room);
            challenger.status = "in_game";
            accepter.status = "in_game";

            challenger.ws.send(JSON.stringify({
              type: "match_found",
              roomId,
              gameId,
              opponent: { id: accepter.id, username: accepter.username },
            }));
            accepter.ws.send(JSON.stringify({
              type: "match_found",
              roomId,
              gameId,
              opponent: { id: challenger.id, username: challenger.username },
            }));
            broadcastLobby();
          }
        }

        if (msg.type === "decline_challenge" && playerId) {
          const challenger = lobby.get(msg.challengerId);
          if (challenger) {
            challenger.ws.send(JSON.stringify({
              type: "challenge_declined",
              by: playerId,
            }));
          }
        }

        if (msg.type === "game_score" && playerId) {
          const room = rooms.get(msg.roomId);
          if (room) {
            const player = room.players.find((p) => p.id === playerId);
            if (player) {
              player.score = msg.score;
              player.ready = true;

              const botPlayer = room.players.find((p) => p.id === -1);
              if (botPlayer && !botPlayer.ready) {
                botPlayer.score = Math.floor(Math.random() * 80) + 40;
                botPlayer.ready = true;
              }

              if (room.players.every((p) => p.ready)) {
                room.state = "finished";
                const results = {
                  type: "game_results",
                  players: room.players.map((p) => ({
                    id: p.id,
                    username: p.username,
                    score: p.score,
                  })),
                };
                const resultsStr = JSON.stringify(results);
                for (const p of room.players) {
                  if (p.ws && p.ws.readyState === WebSocket.OPEN) {
                    p.ws.send(resultsStr);
                  }
                }
                relayToSpectators(room.spectators, { type: "spectate_ended" });

                // Determine the winner (highest score; tie = no winner).
                const ranking = [...room.players].sort((a, b) => b.score - a.score);
                let winnerId: number | null = null;
                if (ranking.length >= 2 && ranking[0].score !== ranking[1].score) winnerId = ranking[0].id;
                else if (ranking.length === 1) winnerId = ranking[0].id;

                if (room.ranked === "gravity") {
                  emitRankedResult(room.players, winnerId, "gravity").catch(e => console.error("ranked gravity result:", e));
                } else if (winnerId && winnerId > 0) {
                  creditMultiplayerWin(winnerId, room.players).catch(e => console.error("win bonus:", e));
                }

                for (const p of room.players) {
                  const lobbyPlayer = lobby.get(p.id);
                  if (lobbyPlayer) lobbyPlayer.status = "idle";
                }
                rooms.delete(msg.roomId);
                broadcastLobby();
              }
            }
          }
        }

        if (msg.type === "leave_room" && playerId) {
          const room = rooms.get(msg.roomId);
          if (room) {
            for (const p of room.players) {
              if (p.ws && p.ws.readyState === WebSocket.OPEN && p.id !== playerId) {
                p.ws.send(JSON.stringify({ type: "opponent_left" }));
              }
              const lp = lobby.get(p.id);
              if (lp) lp.status = "idle";
            }
            rooms.delete(msg.roomId);
            broadcastLobby();
          }
        }

        if (msg.type === "pvp_challenge" && playerId) {
          const target = lobby.get(msg.targetId);
          const challenger = lobby.get(playerId);
          if (target && challenger && target.status === "idle") {
            target.ws.send(JSON.stringify({
              type: "pvp_challenge_received",
              from: { id: challenger.id, username: challenger.username },
              wager: msg.wager || 0,
            }));
          }
        }

        if (msg.type === "pvp_accept" && playerId) {
          const challenger = lobby.get(msg.challengerId);
          const accepter = lobby.get(playerId);
          if (challenger && accepter) {
            const wager = msg.wager || 0;
            (async () => {
              try {
                if (wager > 0) {
                  const challengerUser = await storage.getUser(challenger.id);
                  const accepterUser = await storage.getUser(accepter.id);
                  if (!challengerUser || !accepterUser || challengerUser.coins < wager || accepterUser.coins < wager) {
                    challenger.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough coins for wager" }));
                    accepter.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough coins for wager" }));
                    return;
                  }
                }

                const questions = await fetchPvpQuestions();
                if (questions.length < 10) {
                  challenger.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough community questions available" }));
                  accepter.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough community questions available" }));
                  return;
                }

                const roomId = generateRoomId();
                const pvpRoom: PvpRoom = {
                  id: roomId,
                  players: [
                    { id: challenger.id, username: challenger.username, ws: challenger.ws, score: 0, answered: 0 },
                    { id: accepter.id, username: accepter.username, ws: accepter.ws, score: 0, answered: 0 },
                  ],
                  questions,
                  currentQuestion: 0,
                  state: "playing",
                  wager,
                  answeredThisRound: new Set(),
                  questionStartTime: Date.now(),
                  spectators: [],
                };
                pvpRooms.set(roomId, pvpRoom);
                challenger.status = "in_game";
                accepter.status = "in_game";

                const q = questions[0];
                const startMsg = {
                  type: "pvp_start",
                  roomId,
                  wager,
                  totalQuestions: 10,
                  question: { text: q.question, options: q.options, index: 0 },
                };
                challenger.ws.send(JSON.stringify({ ...startMsg, opponent: { id: accepter.id, username: accepter.username } }));
                accepter.ws.send(JSON.stringify({ ...startMsg, opponent: { id: challenger.id, username: challenger.username } }));
                startPvpRoundTimeout(roomId);
                broadcastLobby();
              } catch (e) {
                console.error("PvP accept error:", e);
              }
            })();
          }
        }

        if (msg.type === "pvp_decline" && playerId) {
          const challenger = lobby.get(msg.challengerId);
          if (challenger && challenger.ws.readyState === WebSocket.OPEN) {
            challenger.ws.send(JSON.stringify({ type: "pvp_challenge_declined", by: playerId }));
          }
        }

        if (msg.type === "pvp_queue" && playerId) {
          const player = lobby.get(playerId);
          if (!player) return;
          const wager = msg.wager || 0;

          const existingIdx = pvpQueue.findIndex(q => q.id !== playerId);
          if (existingIdx >= 0) {
            const opponent = pvpQueue.splice(existingIdx, 1)[0];
            const opponentPlayer = lobby.get(opponent.id);
            if (opponentPlayer) {
              const matchWager = Math.min(wager, opponent.wager);
              (async () => {
                try {
                  if (matchWager > 0) {
                    const u1 = await storage.getUser(player.id);
                    const u2 = await storage.getUser(opponentPlayer.id);
                    if (!u1 || !u2 || u1.coins < matchWager || u2.coins < matchWager) {
                      player.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough coins for wager" }));
                      opponentPlayer.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough coins for wager" }));
                      return;
                    }
                  }

                  const questions = await fetchPvpQuestions();
                  if (questions.length < 10) {
                    player.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough community questions available" }));
                    opponentPlayer.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough community questions available" }));
                    return;
                  }

                  const roomId = generateRoomId();
                  const pvpRoom: PvpRoom = {
                    id: roomId,
                    players: [
                      { id: player.id, username: player.username, ws: player.ws, score: 0, answered: 0 },
                      { id: opponentPlayer.id, username: opponentPlayer.username, ws: opponentPlayer.ws, score: 0, answered: 0 },
                    ],
                    questions,
                    currentQuestion: 0,
                    state: "playing",
                    wager: matchWager,
                    answeredThisRound: new Set(),
                    questionStartTime: Date.now(),
                    spectators: [],
                  };
                  pvpRooms.set(roomId, pvpRoom);
                  player.status = "in_game";
                  opponentPlayer.status = "in_game";

                  const q = questions[0];
                  const startMsg = {
                    type: "pvp_start",
                    roomId,
                    wager: matchWager,
                    totalQuestions: 10,
                    question: { text: q.question, options: q.options, index: 0 },
                  };
                  player.ws.send(JSON.stringify({ ...startMsg, opponent: { id: opponentPlayer.id, username: opponentPlayer.username } }));
                  opponentPlayer.ws.send(JSON.stringify({ ...startMsg, opponent: { id: player.id, username: player.username } }));
                  startPvpRoundTimeout(roomId);
                  broadcastLobby();
                } catch (e) {
                  console.error("PvP queue match error:", e);
                }
              })();
            }
          } else {
            pvpQueue.push({ id: playerId, wager, queuedAt: Date.now() });
            player.status = "queued";
            ws.send(JSON.stringify({ type: "pvp_queued" }));
            broadcastLobby();

            setTimeout(async () => {
              const idx = pvpQueue.findIndex(q => q.id === playerId);
              if (idx < 0) return;
              pvpQueue.splice(idx, 1);
              const p = lobby.get(playerId!);
              if (!p) return;

              try {
                const questions = await fetchPvpQuestions();
                if (questions.length < 10) {
                  p.ws.send(JSON.stringify({ type: "pvp_error", message: "Not enough community questions available" }));
                  p.status = "idle";
                  broadcastLobby();
                  return;
                }

                const roomId = generateRoomId();
                const pvpRoom: PvpRoom = {
                  id: roomId,
                  players: [
                    { id: p.id, username: p.username, ws: p.ws, score: 0, answered: 0 },
                    { id: -2, username: "SciBot", ws: null as any, score: 0, answered: 0 },
                  ],
                  questions,
                  currentQuestion: 0,
                  state: "playing",
                  wager: 0,
                  answeredThisRound: new Set(),
                  questionStartTime: Date.now(),
                  botTimers: [],
                  spectators: [],
                };
                pvpRooms.set(roomId, pvpRoom);
                p.status = "in_game";

                const q = questions[0];
                p.ws.send(JSON.stringify({
                  type: "pvp_start",
                  roomId,
                  wager: 0,
                  totalQuestions: 10,
                  question: { text: q.question, options: q.options, index: 0 },
                  opponent: { id: -2, username: "SciBot" },
                  isBot: true,
                }));
                broadcastLobby();

                scheduleBotAnswer(roomId);
                startPvpRoundTimeout(roomId);
              } catch (e) {
                console.error("PvP bot fallback error:", e);
                p.status = "idle";
                broadcastLobby();
              }
            }, 10000);
          }
        }

        if (msg.type === "pvp_cancel_queue" && playerId) {
          const idx = pvpQueue.findIndex(q => q.id === playerId);
          if (idx >= 0) pvpQueue.splice(idx, 1);
          const player = lobby.get(playerId);
          if (player) player.status = "idle";
          broadcastLobby();
        }

        if (msg.type === "pvp_answer" && playerId) {
          const room = pvpRooms.get(msg.roomId);
          if (!room || room.state !== "playing") return;
          if (room.answeredThisRound.has(playerId)) return;

          room.answeredThisRound.add(playerId);
          const player = room.players.find(p => p.id === playerId);
          if (!player) return;

          const q = room.questions[room.currentQuestion];
          const correct = msg.answerIndex === q.correctIndex;
          const timeTaken = (Date.now() - room.questionStartTime) / 1000;
          let points = 0;
          if (correct) {
            points = 1;
            if (timeTaken <= 5) points += 0.5;
          }
          player.score += points;
          player.answered++;
          player.currentAnswer = msg.answerIndex;

          const opponent = room.players.find(p => p.id !== playerId);
          if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
            opponent.ws.send(JSON.stringify({
              type: "pvp_opponent_progress",
              answered: player.answered,
            }));
          }

          if (player.ws && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify({
              type: "pvp_answer_result",
              correct,
              correctIndex: q.correctIndex,
              explanation: q.explanation || null,
              points,
              totalScore: player.score,
            }));
          }

          const allAnswered = room.players.every(p => room.answeredThisRound.has(p.id));
          if (allAnswered) {
            if (room.roundTimeout) { clearTimeout(room.roundTimeout); room.roundTimeout = undefined; }
            room.currentQuestion++;
            relayToSpectators(room.spectators, {
              type: "spectate_update",
              players: room.players.map(p => ({ id: p.id, username: p.username, score: p.score })),
              questionIndex: room.currentQuestion,
              totalQuestions: 10,
            });
            if (room.currentQuestion >= 10) {
              finishPvpRoom(room).catch(e => console.error("finishPvpRoom error:", e));
            } else {
              setTimeout(() => {
                if (room.state === "finished") return;
                room.answeredThisRound.clear();
                room.questionStartTime = Date.now();
                const nextQ = room.questions[room.currentQuestion];
                const questionMsg = JSON.stringify({
                  type: "pvp_next_question",
                  question: { text: nextQ.question, options: nextQ.options, index: room.currentQuestion },
                });
                for (const p of room.players) {
                  if (p.ws && p.ws.readyState === WebSocket.OPEN) {
                    p.ws.send(questionMsg);
                  }
                }
                const hasBot = room.players.some(p => p.id === -2);
                if (hasBot) scheduleBotAnswer(room.id);
                startPvpRoundTimeout(room.id);
              }, 2000);
            }
          }
        }

        if (msg.type === "pvp_leave" && playerId) {
          const room = pvpRooms.get(msg.roomId);
          if (room) {
            if (room.botTimers) room.botTimers.forEach(t => clearTimeout(t));
            if (room.roundTimeout) clearTimeout(room.roundTimeout);
            room.state = "finished";
            for (const p of room.players) {
              if (p.id !== playerId && p.ws && p.ws.readyState === WebSocket.OPEN) {
                p.ws.send(JSON.stringify({ type: "pvp_opponent_left" }));
              }
              const lp = lobby.get(p.id);
              if (lp) lp.status = "idle";
            }
            relayToSpectators(room.spectators, { type: "spectate_ended" });
            pvpRooms.delete(msg.roomId);
            broadcastLobby();
          }
        }

        if (msg.type === "get_active_rooms" && playerId) {
          const arcadeList = Array.from(rooms.entries())
            .filter(([, r]) => r.state !== "finished")
            .map(([id, r]) => ({
              id,
              type: "arcade" as const,
              gameId: r.gameId,
              players: r.players.map(p => ({ id: p.id, username: p.username, score: p.score })),
            }));
          const pvpList = Array.from(pvpRooms.entries())
            .filter(([, r]) => r.state !== "finished")
            .map(([id, r]) => ({
              id,
              type: "pvp" as const,
              players: r.players.map(p => ({ id: p.id, username: p.username, score: p.score })),
              currentQuestion: r.currentQuestion,
              totalQuestions: 10,
            }));
          ws.send(JSON.stringify({ type: "active_rooms", rooms: [...arcadeList, ...pvpList] }));
        }

        if (msg.type === "start_spectate" && playerId) {
          for (const r of rooms.values()) r.spectators = r.spectators.filter(s => s.id !== playerId);
          for (const r of pvpRooms.values()) r.spectators = r.spectators.filter(s => s.id !== playerId);

          const arcadeRoom = rooms.get(msg.roomId);
          if (arcadeRoom && arcadeRoom.state !== "finished") {
            arcadeRoom.spectators.push({ id: playerId, ws });
            ws.send(JSON.stringify({
              type: "spectate_snapshot",
              roomId: msg.roomId,
              gameType: "arcade",
              gameId: arcadeRoom.gameId,
              players: arcadeRoom.players.map(p => ({ id: p.id, username: p.username, score: p.score })),
            }));
          } else {
            const pvpRoom = pvpRooms.get(msg.roomId);
            if (pvpRoom && pvpRoom.state !== "finished") {
              pvpRoom.spectators.push({ id: playerId, ws });
              ws.send(JSON.stringify({
                type: "spectate_snapshot",
                roomId: msg.roomId,
                gameType: "pvp",
                players: pvpRoom.players.map(p => ({ id: p.id, username: p.username, score: p.score })),
                currentQuestion: pvpRoom.currentQuestion,
                totalQuestions: 10,
              }));
            }
          }
        }

        if (msg.type === "stop_spectate" && playerId) {
          for (const r of rooms.values()) r.spectators = r.spectators.filter(s => s.id !== playerId);
          for (const r of pvpRooms.values()) r.spectators = r.spectators.filter(s => s.id !== playerId);
        }
      } catch {}
    });

    ws.on("close", () => {
      if (playerId) {
        for (const [gid, q] of queue.entries()) {
          const idx = q.indexOf(playerId);
          if (idx >= 0) q.splice(idx, 1);
        }

        const pvpIdx = pvpQueue.findIndex(q => q.id === playerId);
        if (pvpIdx >= 0) pvpQueue.splice(pvpIdx, 1);

        rankedQueue.quiz = rankedQueue.quiz.filter(id => id !== playerId);
        rankedQueue.gravity = rankedQueue.gravity.filter(id => id !== playerId);

        // Party cleanup — drop the player from their party (also clears pending invites).
        if (userParty.has(playerId)) removeFromParty(playerId);
        parties.forEach((p) => { p.pendingInvites = p.pendingInvites.filter(id => id !== playerId); });

        // Cancel any ranked draft the player was in.
        rankedDrafts.forEach((draft) => {
          if (draft.players.some(p => p.id === playerId)) {
            if (draft.timeout) clearTimeout(draft.timeout);
            rankedDrafts.delete(draft.id);
            draft.players.forEach(p => {
              if (p.id !== playerId) {
                const lp = lobby.get(p.id);
                if (lp) { lp.status = "idle"; if (lp.ws.readyState === WebSocket.OPEN) lp.ws.send(JSON.stringify({ type: "ranked_draft_cancel" })); }
              }
            });
          }
        });

        // Team queue cleanup
        teamQueue.forEach((list, gid) => {
          teamQueue.set(gid, list.filter((e) => e.id !== playerId));
        });

        // Streaming cleanup — end the player's own stream, drop them as a viewer.
        if (streams.has(playerId)) {
          void finishStream(playerId);
        }
        streams.forEach((s) => {
          if (s.viewers.delete(playerId!)) {
            sendToUser(s.streamerId, { type: "viewer_gone", viewerId: playerId! });
            sendToStream(s, { type: "stream_update", streamerId: s.streamerId, score: s.score, viewerCount: s.viewers.size });
            broadcastStreamsList();
          }
        });

        for (const [roomId, room] of rooms.entries()) {
          room.spectators = room.spectators.filter(s => s.id !== playerId);
          const inRoom = room.players.find((p) => p.id === playerId);
          if (inRoom) {
            for (const p of room.players) {
              if (p.id !== playerId && p.ws && p.ws.readyState === WebSocket.OPEN) {
                p.ws.send(JSON.stringify({ type: "opponent_left" }));
              }
              const lp = lobby.get(p.id);
              if (lp) lp.status = "idle";
            }
            relayToSpectators(room.spectators, { type: "spectate_ended" });
            rooms.delete(roomId);
          }
        }

        for (const [roomId, room] of pvpRooms.entries()) {
          room.spectators = room.spectators.filter(s => s.id !== playerId);
          const inRoom = room.players.find(p => p.id === playerId);
          if (inRoom) {
            if (room.botTimers) room.botTimers.forEach(t => clearTimeout(t));
            room.state = "finished";
            for (const p of room.players) {
              if (p.id !== playerId && p.ws && p.ws.readyState === WebSocket.OPEN) {
                p.ws.send(JSON.stringify({ type: "pvp_opponent_left" }));
              }
              const lp = lobby.get(p.id);
              if (lp) lp.status = "idle";
            }
            relayToSpectators(room.spectators, { type: "spectate_ended" });
            pvpRooms.delete(roomId);
          }
        }

        lobby.delete(playerId);
        broadcastLobby();
      }
    });
  });

  const BATTLE_POWERUP_CATALOG: Record<string, { name: string; price: number; icon: string; description: string; rarity: string }> = {
    "bp-shield-potion": { name: "Shield Potion", price: 3, icon: "Shield", description: "Blocks next wrong answer damage", rarity: "uncommon" },
    "bp-time-freeze": { name: "Time Freeze", price: 2, icon: "Timer", description: "Pauses timer for one question", rarity: "common" },
    "bp-double-damage": { name: "Double Damage", price: 4, icon: "Swords", description: "Next correct answer deals 2x damage to boss", rarity: "rare" },
    "bp-heal-potion": { name: "Heal Potion", price: 3, icon: "Heart", description: "Restores 25 HP during fight", rarity: "uncommon" },
    "bp-mirror-shield": { name: "Mirror Shield", price: 5, icon: "Sparkles", description: "Cancels boss skill and damages boss 10 HP", rarity: "epic" },
    "bp-quick-draw": { name: "Quick Draw", price: 2, icon: "Zap", description: "Answer within 3s for +50% damage bonus", rarity: "common" },
    "bp-answer-sabotage": { name: "Answer Sabotage", price: 4, icon: "EyeOff", description: "Hides one correct answer from opponent (PvP)", rarity: "rare" },
    "bp-time-drain": { name: "Time Drain", price: 3, icon: "Hourglass", description: "Steals 5 seconds from opponent's timer (PvP)", rarity: "uncommon" },
    "bp-poison-strike": { name: "Poison Strike", price: 5, icon: "Skull", description: "Deals 15 damage to boss over 3 questions", rarity: "epic" },
    "bp-time-warp": { name: "Time Warp", price: 4, icon: "Clock", description: "Adds 6 seconds to your own timer (PvP/Ranked)", rarity: "rare" },
    "bp-triple-points": { name: "Triple Points", price: 6, icon: "Sparkles", description: "Your next correct answer is worth 3x points (PvP/Ranked)", rarity: "epic" },
    "bp-mega-time": { name: "Mega Time", price: 5, icon: "Hourglass", description: "Adds 10 seconds to your own timer (PvP/Ranked/Tournaments)", rarity: "rare" },
    "bp-clarity": { name: "Clarity", price: 4, icon: "Eye", description: "Removes one wrong answer from your question (Tournaments)", rarity: "uncommon" },
  };

  app.get("/api/battle-powerups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const owned = (user.battlePowerups as Record<string, number>) || {};
      const catalog = Object.entries(BATTLE_POWERUP_CATALOG).map(([id, info]) => ({
        id,
        ...info,
        count: owned[id] || 0,
      }));
      res.json({ powerups: catalog, owned });
    } catch (error) {
      res.status(500).json({ message: "Failed to get battle powerups" });
    }
  });

  app.post("/api/shop/buy-battle-powerup", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { powerupId, quantity } = req.body;
      if (!powerupId || typeof powerupId !== "string") return res.status(400).json({ message: "Powerup ID required" });
      const info = BATTLE_POWERUP_CATALOG[powerupId];
      if (!info) return res.status(400).json({ message: "Unknown battle powerup" });
      const qty = Math.max(1, Math.min(10, Number(quantity) || 1));
      const totalCost = info.price * qty;

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const userGems = user.gems || 0;
      if (userGems < totalCost) return res.status(400).json({ message: "Not enough gems!" });

      const powerups = (user.battlePowerups as Record<string, number>) || {};
      powerups[powerupId] = (powerups[powerupId] || 0) + qty;

      await storage.updateUser(user.id, { gems: userGems - totalCost, battlePowerups: powerups } as any);
      res.json({ success: true, powerups, gemsRemaining: userGems - totalCost });
    } catch (error) {
      res.status(500).json({ message: "Failed to buy battle powerup" });
    }
  });

  app.post("/api/battle-powerup/use", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { powerupId } = req.body;
      if (!powerupId || typeof powerupId !== "string") return res.status(400).json({ message: "Powerup ID required" });
      const info = BATTLE_POWERUP_CATALOG[powerupId];
      if (!info) return res.status(400).json({ message: "Unknown battle powerup" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const powerups = (user.battlePowerups as Record<string, number>) || {};
      if (!powerups[powerupId] || powerups[powerupId] <= 0) {
        return res.status(400).json({ message: "You don't have this powerup!" });
      }

      powerups[powerupId] -= 1;
      if (powerups[powerupId] <= 0) delete powerups[powerupId];

      await storage.updateUser(user.id, { battlePowerups: powerups } as any);
      res.json({ success: true, powerups });
    } catch (error) {
      res.status(500).json({ message: "Failed to use battle powerup" });
    }
  });

  const GEM_UPGRADE_REQUIRED_LEVEL: Record<string, number> = {
    "upgrade-double-coins": 15,
    "upgrade-boss-rush": 20,
    "upgrade-lab-mastery": 25,
    "upgrade-diamond-profile": 10,
    "upgrade-permanent-xp": 15,
    "upgrade-permanent-coins": 15,
    "upgrade-daily-gems": 20,
    "upgrade-rainbow-name": 15,
    "upgrade-auto-streak": 25,
    "upgrade-treasure-hunter": 10,
    "upgrade-elite-border": 8,
    "upgrade-science-star": 30,
    "upgrade-mega-xp": 35,
    "upgrade-mega-coins": 35,
    "upgrade-scholar": 40,
    "upgrade-jackpot": 45,
  };

  const GEM_UPGRADE_CATALOG: Record<string, number> = {
    "upgrade-xp-boost": 10,
    "upgrade-coin-magnet": 8,
    "upgrade-extra-time": 5,
    "upgrade-golden-profile": 15,
    "upgrade-streak-shield": 6,
    "upgrade-boss-insight": 12,
    "upgrade-double-coins": 20,
    "upgrade-boss-rush": 25,
    "upgrade-lab-mastery": 30,
    "upgrade-diamond-profile": 35,
    "upgrade-permanent-xp": 40,
    "upgrade-permanent-coins": 45,
    "upgrade-daily-gems": 50,
    "upgrade-rainbow-name": 30,
    "upgrade-auto-streak": 60,
    "upgrade-treasure-hunter": 35,
    "upgrade-elite-border": 20,
    "upgrade-science-star": 55,
    "upgrade-mega-xp": 70,
    "upgrade-mega-coins": 70,
    "upgrade-scholar": 90,
    "upgrade-jackpot": 100,
  };

  const COSMETIC_UPGRADES = new Set([
    "upgrade-golden-profile",
    "upgrade-diamond-profile",
    "upgrade-permanent-xp",
    "upgrade-permanent-coins",
    "upgrade-daily-gems",
    "upgrade-rainbow-name",
    "upgrade-auto-streak",
    "upgrade-treasure-hunter",
    "upgrade-elite-border",
    "upgrade-science-star",
    "upgrade-mega-xp",
    "upgrade-mega-coins",
    "upgrade-scholar",
    "upgrade-jackpot",
  ]);

  function isUpgradeActive(user: any, upgradeId: string): boolean {
    if (!user.inventory?.includes(upgradeId)) return false;
    if (COSMETIC_UPGRADES.has(upgradeId)) {
      const uses = ((user.upgradeExpirations as Record<string, number>) || {})[upgradeId] || 0;
      return uses > 0;
    }
    const uses = ((user.upgradeExpirations as Record<string, number>) || {})[upgradeId] || 0;
    return uses > 0;
  }

  function getUpgradeUses(user: any, upgradeId: string): number {
    return ((user.upgradeExpirations as Record<string, number>) || {})[upgradeId] || 0;
  }

  async function consumeUpgradeUse(userId: number, user: any, upgradeId: string): Promise<void> {
    if (COSMETIC_UPGRADES.has(upgradeId)) return;
    const uses = { ...((user.upgradeExpirations as Record<string, number>) || {}) };
    if (uses[upgradeId] && uses[upgradeId] > 0) {
      uses[upgradeId] = uses[upgradeId] - 1;
      await storage.updateUser(userId, { upgradeExpirations: uses } as any);
    }
  }

  app.get("/api/upgrade-uses", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const uses = ((user as any).upgradeExpirations as Record<string, number>) || {};
      res.json({ uses });
    } catch {
      res.status(500).json({ message: "Failed to get upgrade uses" });
    }
  });

  app.post("/api/shop/buy-upgrade", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { upgradeId } = req.body;
      if (!upgradeId) return res.status(400).json({ message: "Missing upgrade ID" });
      const price = GEM_UPGRADE_CATALOG[upgradeId];
      if (price === undefined) return res.status(400).json({ message: "Unknown upgrade" });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const userGems = (user as any).gems || 0;
      if (userGems < price) return res.status(400).json({ message: "Not enough gems!" });
      const requiredLvl = GEM_UPGRADE_REQUIRED_LEVEL[upgradeId] || 0;
      if (requiredLvl > 0 && !user.isAdmin) {
        const userLevel = Math.floor(user.xp / 100) + 1;
        if (userLevel < requiredLvl) return res.status(400).json({ message: `Requires level ${requiredLvl}!` });
      }
      const inventory = user.inventory || [];
      if (COSMETIC_UPGRADES.has(upgradeId) && inventory.includes(upgradeId)) {
        return res.status(400).json({ message: "You already own this permanent upgrade!" });
      }
      const newInventory = inventory.includes(upgradeId) ? inventory : [...inventory, upgradeId];
      const uses = { ...((user as any).upgradeExpirations as Record<string, number>) || {} };
      const upgradeItemLevel = (((user as any).itemLevels || {}) as Record<string, number>)[upgradeId] || 0;
      uses[upgradeId] = (uses[upgradeId] || 0) + 1 + upgradeItemLevel;
      const newGems = userGems - price;
      await storage.updateUser(user.id, { inventory: newInventory, gems: newGems, upgradeExpirations: uses } as any);
      res.json({ success: true, uses: uses[upgradeId] });
    } catch (error) {
      res.status(500).json({ message: "Failed to buy upgrade" });
    }
  });

  const DAILY_REWARD_TABLE = [
    { coins: 50, xp: 25, label: "Day 1" },
    { coins: 75, xp: 40, label: "Day 2" },
    { coins: 100, xp: 60, label: "Day 3" },
    { coins: 150, xp: 80, label: "Day 4" },
    { coins: 200, xp: 100, label: "Day 5" },
    { coins: 300, xp: 150, label: "Day 6" },
    { coins: 500, xp: 250, gems: 2, label: "Day 7 Bonus!" },
  ];

  app.get("/api/shop/daily-reward", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user!;
      const today = new Date().toISOString().slice(0, 10);
      const lastDate = (user as any).lastDailyRewardDate || "";
      const streak = (user as any).dailyRewardStreak || 0;
      const alreadyClaimed = lastDate === today;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const streakContinues = lastDate === yesterday;
      const currentStreak = alreadyClaimed ? streak : (streakContinues ? streak : 0);
      const wouldBeStreak = alreadyClaimed ? streak : (streakContinues ? streak + 1 : 1);
      const dayIndex = alreadyClaimed ? (streak - 1) % 7 : (wouldBeStreak - 1) % 7;
      const nextReward = DAILY_REWARD_TABLE[dayIndex];
      res.json({ alreadyClaimed, streak: currentStreak, dayIndex, nextReward, rewards: DAILY_REWARD_TABLE });
    } catch (error) {
      res.status(500).json({ message: "Failed to check daily reward" });
    }
  });

  app.post("/api/shop/daily-reward/claim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user!;
      const today = new Date().toISOString().slice(0, 10);
      const lastDate = (user as any).lastDailyRewardDate || "";
      if (lastDate === today) return res.status(400).json({ message: "Already claimed today!" });
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const streakContinues = lastDate === yesterday;
      const oldStreak = (user as any).dailyRewardStreak || 0;
      const newStreak = streakContinues ? oldStreak + 1 : 1;
      const dayIndex = (newStreak - 1) % 7;
      const reward = DAILY_REWARD_TABLE[dayIndex];
      const updates: any = {
        lastDailyRewardDate: today,
        dailyRewardStreak: newStreak,
        coins: (user.coins || 0) + reward.coins,
        xp: (user.xp || 0) + reward.xp,
      };
      let totalGems = reward.gems || 0;
      if (user.inventory?.includes("upgrade-daily-gems")) {
        totalGems += 2;
      }
      if (totalGems > 0) updates.gems = ((user as any).gems || 0) + totalGems;

      // Award streak badges when daily-reward streak hits milestones
      const streakBadgeMilestones: [number, string][] = [[7, "streak-master"], [14, "streak-legend"], [30, "streak-titan"]];
      const existingBadges = [...((user.badges as string[]) || [])];
      let badgeAdded = false;
      for (const [threshold, badge] of streakBadgeMilestones) {
        if (newStreak >= threshold && !existingBadges.includes(badge)) {
          existingBadges.push(badge);
          badgeAdded = true;
        }
      }
      if (badgeAdded) updates.badges = existingBadges;

      await storage.updateUser(user.id, updates);
      res.json({ success: true, reward: { ...reward, gems: totalGems }, streak: newStreak, dayIndex });
    } catch (error) {
      res.status(500).json({ message: "Failed to claim daily reward" });
    }
  });

  const MYSTERY_BOX_TIERS: { id: string; name: string; coinCost: number; gemCost: number; minLevel: number; rewards: { type: string; min: number; max: number; chance: number; label: string }[] }[] = [
    {
      id: "bronze", name: "Bronze Box", coinCost: 100, gemCost: 0, minLevel: 1,
      rewards: [
        { type: "coins", min: 50, max: 200, chance: 0.52, label: "Coins" },
        { type: "xp", min: 30, max: 150, chance: 0.40, label: "XP" },
        { type: "gems", min: 1, max: 1, chance: 0.03, label: "Gems" },
        { type: "random_item", min: 0, max: 0, chance: 0.05, label: "Random Item" },
      ],
    },
    {
      id: "silver", name: "Silver Box", coinCost: 300, gemCost: 0, minLevel: 5,
      rewards: [
        { type: "coins", min: 150, max: 500, chance: 0.42, label: "Coins" },
        { type: "xp", min: 100, max: 400, chance: 0.35, label: "XP" },
        { type: "gems", min: 1, max: 2, chance: 0.08, label: "Gems" },
        { type: "random_item", min: 0, max: 0, chance: 0.15, label: "Random Item" },
      ],
    },
    {
      id: "gold", name: "Gold Box", coinCost: 0, gemCost: 5, minLevel: 10,
      rewards: [
        { type: "coins", min: 300, max: 1000, chance: 0.32, label: "Coins" },
        { type: "xp", min: 200, max: 800, chance: 0.28, label: "XP" },
        { type: "gems", min: 1, max: 3, chance: 0.10, label: "Gems" },
        { type: "random_item", min: 0, max: 0, chance: 0.30, label: "Random Item" },
      ],
    },
  ];

  app.get("/api/shop/mystery-boxes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    const userLevel = (user as any).level || 1;
    const boxes = MYSTERY_BOX_TIERS.map(box => ({
      ...box,
      locked: userLevel < box.minLevel,
    }));
    res.json({ boxes, totalOpened: (user as any).mysteryBoxesOpened || 0 });
  });

  const VALID_BOX_IDS = new Set(MYSTERY_BOX_TIERS.map(b => b.id));

  app.post("/api/shop/mystery-box/open", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user!;
      const { boxId } = req.body;
      if (!boxId || typeof boxId !== "string" || !VALID_BOX_IDS.has(boxId)) {
        return res.status(400).json({ message: "Invalid box type" });
      }
      const box = MYSTERY_BOX_TIERS.find(b => b.id === boxId);
      if (!box) return res.status(400).json({ message: "Unknown box type" });
      const userLevel = (user as any).level || 1;
      if (userLevel < box.minLevel) return res.status(400).json({ message: `Requires level ${box.minLevel}` });
      if (box.coinCost > 0 && (user.coins || 0) < box.coinCost) return res.status(400).json({ message: "Not enough coins!" });
      if (box.gemCost > 0 && ((user as any).gems || 0) < box.gemCost) return res.status(400).json({ message: "Not enough gems!" });

      const roll = Math.random();
      let cumulative = 0;
      let selectedReward = box.rewards[0];
      for (const r of box.rewards) {
        cumulative += r.chance;
        if (roll < cumulative) { selectedReward = r; break; }
      }

      const updates: any = {
        mysteryBoxesOpened: ((user as any).mysteryBoxesOpened || 0) + 1,
      };
      if (box.coinCost > 0) updates.coins = (user.coins || 0) - box.coinCost;
      if (box.gemCost > 0) updates.gems = ((user as any).gems || 0) - box.gemCost;

      let rewardResult: { type: string; amount: number; label: string; itemId?: string; itemName?: string } = { type: selectedReward.type, amount: 0, label: selectedReward.label };

      if (selectedReward.type === "coins") {
        const amount = Math.floor(Math.random() * (selectedReward.max - selectedReward.min + 1)) + selectedReward.min;
        updates.coins = (updates.coins ?? user.coins ?? 0) + amount;
        rewardResult.amount = amount;
        rewardResult.label = `${amount} Coins`;
      } else if (selectedReward.type === "xp") {
        const amount = Math.floor(Math.random() * (selectedReward.max - selectedReward.min + 1)) + selectedReward.min;
        updates.xp = (user.xp || 0) + amount;
        updates.level = computeLevel(updates.xp);
        rewardResult.amount = amount;
        rewardResult.label = `${amount} XP`;
      } else if (selectedReward.type === "gems") {
        const amount = Math.floor(Math.random() * (selectedReward.max - selectedReward.min + 1)) + selectedReward.min;
        updates.gems = (updates.gems ?? (user as any).gems ?? 0) + amount;
        rewardResult.amount = amount;
        rewardResult.label = `${amount} Gems`;
      } else if (selectedReward.type === "random_item") {
        const allShopItems = await storage.getShopItems();
        const inventory = user.inventory || [];
        const userRebirth = (user as any).rebirthLevel || 0;
        const userXpTotal = user.xp || 0;
        const buyableItems = allShopItems.filter(item =>
          !inventory.includes(item.id) &&
          !(item as any).rewardSource &&
          !WORLD_EXCLUSIVE_ITEM_IDS.has(item.id) &&
          item.price > 0 &&
          item.price <= (box.id === "gold" ? 2000 : box.id === "silver" ? 1000 : 500) &&
          (item.requiredLevel || 0) <= userLevel &&
          (item.requiredRebirth || 0) <= userRebirth &&
          (item.requiredXp || 0) <= userXpTotal
        );
        if (buyableItems.length > 0) {
          const randomItem = buyableItems[Math.floor(Math.random() * buyableItems.length)];
          updates.inventory = [...inventory, randomItem.id];
          rewardResult.itemId = randomItem.id;
          rewardResult.itemName = randomItem.name;
          rewardResult.label = randomItem.name;
          rewardResult.amount = 1;
          (rewardResult as any).itemCategory = randomItem.category;
        } else {
          const fallbackCoins = Math.floor(Math.random() * 200) + 100;
          updates.coins = (updates.coins ?? user.coins ?? 0) + fallbackCoins;
          rewardResult = { type: "coins", amount: fallbackCoins, label: `${fallbackCoins} Coins (all items owned!)` };
        }
      }

      await storage.updateUser(user.id, updates);
      res.json({ success: true, reward: rewardResult, boxId });
    } catch (error) {
      res.status(500).json({ message: "Failed to open mystery box" });
    }
  });

  app.get("/api/community/packs", async (_req, res) => {
    try {
      const packs = await storage.getCommunityPacks();
      const cosmetics = await storage.getUserCosmetics(packs.map(p => p.creatorId));
      const enriched = packs.map(p => {
        const c = cosmetics.get(p.creatorId);
        return { ...p, creatorTitle: c?.titleId || null, creatorIsVip: c?.isVip || false };
      });
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "Failed to get community packs" });
    }
  });

  app.get("/api/community/packs/:id", async (req, res) => {
    try {
      const pack = await storage.getCommunityPack(Number(req.params.id));
      if (!pack) return res.status(404).json({ message: "Pack not found" });
      const questions = await storage.getPackQuestions(pack.id);
      res.json({ ...pack, questions });
    } catch (error) {
      res.status(500).json({ message: "Failed to get pack" });
    }
  });

  app.get("/api/community/my-packs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const packs = await storage.getPacksByCreator(req.user!.id);
      res.json(packs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get your packs" });
    }
  });

  app.post("/api/community/packs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { title, description, gameMode, yearLevel, questions } = req.body;
      if (!title || !description || !questions || !Array.isArray(questions) || questions.length < 3) {
        return res.status(400).json({ message: "Need a title, description, and at least 3 questions" });
      }
      if (questions.length > 20) {
        return res.status(400).json({ message: "Maximum 20 questions per pack" });
      }
      for (const q of questions) {
        if (!q.question || !q.options || q.options.length !== 4 || q.correctIndex === undefined) {
          return res.status(400).json({ message: "Each question needs text, 4 options, and a correct answer" });
        }
      }

      const pack = await storage.createCommunityPack({
        creatorId: req.user!.id,
        creatorName: req.user!.username,
        title,
        description,
        gameMode: gameMode || "speed_quiz",
        yearLevel: yearLevel || 7,
        likes: 0,
        boosts: 0,
        plays: 0,
        createdAt: new Date().toISOString(),
      });

      for (const q of questions) {
        await storage.createPackQuestion({
          packId: pack.id,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation || null,
        });
      }

      // Post-count milestone badges
      try {
        const creator = await storage.getUser(req.user!.id);
        if (creator) {
          const allPacks = await storage.getPacksByCreator(req.user!.id);
          const packCount = allPacks.length;
          const postMilestones: Array<{ threshold: number; badge: string; coins: number; xp: number }> = [
            { threshold: 1,  badge: "community-first-post",     coins: 15,  xp: 30  },
            { threshold: 5,  badge: "community-pack-creator",   coins: 40,  xp: 80  },
            { threshold: 10, badge: "community-pack-veteran",   coins: 100, xp: 200 },
            { threshold: 25, badge: "community-pack-legend",    coins: 250, xp: 500 },
          ];
          const creatorBadges: string[] = creator.badges || [];
          const newBadges: string[] = [];
          let bonusCoins = 0;
          let bonusXP = 0;
          for (const m of postMilestones) {
            if (packCount >= m.threshold && !creatorBadges.includes(m.badge)) {
              newBadges.push(m.badge);
              bonusCoins += m.coins;
              bonusXP += m.xp;
            }
          }
          if (newBadges.length > 0) {
            await storage.updateUser(creator.id, {
              badges: [...creatorBadges, ...newBadges],
              coins: (creator.coins || 0) + bonusCoins,
              xp: (creator.xp || 0) + bonusXP,
            } as any);
          }
        }
      } catch (_) {}

      res.json(pack);
    } catch (error) {
      res.status(500).json({ message: "Failed to create pack" });
    }
  });

  app.delete("/api/community/packs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const deleted = await storage.deleteCommunityPack(Number(req.params.id), req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Pack not found or not yours" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete pack" });
    }
  });

  app.post("/api/community/packs/:id/play", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const packId = Number(req.params.id);
      const pack = await storage.getCommunityPack(packId);
      if (!pack) return res.status(404).json({ message: "Pack not found" });

      await storage.incrementPackPlays(packId);

      const { score = 0, correct = 0, totalQuestions = 1 } = req.body;
      const pct = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;
      const xpReward = Math.round(10 + (pct / 100) * 40); // 10 XP at 0%, 50 XP at 100%
      const coinReward = Math.floor(pct / 25); // 0-4 coins based on score bracket

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);

      const newXP = user.xp + xpReward;
      const newLevel = computeLevel(newXP);
      const newCoins = (user.coins || 0) + coinReward;

      // Save pack high score to gameScores
      const gameScores = (user.gameScores as Record<string, any>) || {};
      const packKey = `community_${packId}`;
      const updates: any = { xp: newXP, level: newLevel, coins: newCoins };
      if (!gameScores[packKey] || score > (gameScores[packKey] || 0)) {
        updates.gameScores = { ...gameScores, [packKey]: score };
      }
      await storage.updateUser(user.id, updates);

      res.json({ xpEarned: xpReward, coinsEarned: coinReward, pct: Math.round(pct) });
    } catch (error) {
      res.status(500).json({ message: "Failed to record play" });
    }
  });

  app.post("/api/community/packs/:id/react", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const packId = Number(req.params.id);
      const { type } = req.body;
      if (!type || !["like", "boost"].includes(type)) {
        return res.status(400).json({ message: "Invalid reaction type" });
      }

      const pack = await storage.getCommunityPack(packId);
      if (!pack) return res.status(404).json({ message: "Pack not found" });
      if (pack.creatorId === req.user!.id) {
        return res.status(400).json({ message: "You can't react to your own pack" });
      }

      const boostMilestones: Array<{ threshold: number; badge: string; item?: string; coins?: number; xp?: number }> = [
        { threshold: 1,   badge: "news-first-spark",      coins: 10,  xp: 20 },
        { threshold: 5,   badge: "news-rising-scientist",  coins: 25,  xp: 50 },
        { threshold: 10,  badge: "news-community-fave",    coins: 50,  xp: 100, item: "avatar-news-star" },
        { threshold: 25,  badge: "news-boost-magnet",      coins: 100, xp: 200 },
        { threshold: 50,  badge: "news-viral-scientist",   coins: 200, xp: 400, item: "avatar-viral-scientist" },
        { threshold: 100, badge: "news-influencer",        coins: 500, xp: 750, item: "title-influencer" },
      ];

      const existing = await storage.getReaction(req.user!.id, packId, type);
      if (existing) {
        await storage.removeReaction(req.user!.id, packId, type);
        if (type === "like") {
          const creator = await storage.getUser(pack.creatorId);
          if (creator && creator.coins > 0) {
            await storage.updateUser(pack.creatorId, { coins: creator.coins - 5 } as any);
          }
        } else if (type === "boost") {
          const creator = await storage.getUser(pack.creatorId);
          if (creator) {
            const prevTotal = (creator as any).totalBoostsReceived || 0;
            await storage.updateUser(pack.creatorId, {
              gems: Math.max(0, (creator.gems || 0) - 1),
              totalBoostsReceived: Math.max(0, prevTotal - 1),
            } as any);
          }
        }
        res.json({ action: "removed", type });
      } else {
        await storage.addReaction(req.user!.id, packId, type);
        const creator = await storage.getUser(pack.creatorId);
        const newBadgesEarned: string[] = [];
        const newItemsEarned: string[] = [];
        if (creator) {
          if (type === "like") {
            await storage.updateUser(pack.creatorId, { coins: creator.coins + 5 } as any);
          } else if (type === "boost") {
            const prevTotal = (creator as any).totalBoostsReceived || 0;
            const newTotal = prevTotal + 1;
            const authorUpdates: Record<string, any> = {
              gems: (creator.gems || 0) + 1,
              totalBoostsReceived: newTotal,
            };
            let bonusCoins = 0;
            let bonusXP = 0;
            for (const milestone of boostMilestones) {
              if (prevTotal < milestone.threshold && newTotal >= milestone.threshold) {
                if (!creator.badges.includes(milestone.badge)) newBadgesEarned.push(milestone.badge);
                if (milestone.item && !creator.inventory.includes(milestone.item)) newItemsEarned.push(milestone.item);
                bonusCoins += milestone.coins || 0;
                bonusXP += milestone.xp || 0;
              }
            }
            if (newBadgesEarned.length > 0) authorUpdates.badges = [...creator.badges, ...newBadgesEarned];
            if (newItemsEarned.length > 0) authorUpdates.inventory = [...creator.inventory, ...newItemsEarned];
            if (bonusCoins > 0) authorUpdates.coins = (creator.coins || 0) + bonusCoins;
            if (bonusXP > 0) {
              authorUpdates.xp = (creator.xp || 0) + bonusXP;
              authorUpdates.level = computeLevel(authorUpdates.xp);
            }
            await storage.updateUser(pack.creatorId, authorUpdates as any);
          }
        }
        res.json({ action: "added", type, authorMilestone: newBadgesEarned.length > 0 || newItemsEarned.length > 0 });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to react" });
    }
  });

  app.get("/api/community/packs/:id/reactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const packId = Number(req.params.id);
      const liked = await storage.getReaction(req.user!.id, packId, "like");
      const boosted = await storage.getReaction(req.user!.id, packId, "boost");
      res.json({ liked: !!liked, boosted: !!boosted });
    } catch (error) {
      res.status(500).json({ message: "Failed to get reactions" });
    }
  });

  // ─── DIMENSIONS: entry sacrifices, rewards, stones, set completion ──────────
  const dimUnlocked = (user: any, dim: DimensionDef) =>
    dimensionUnlockState(dim, {
      xp: user.xp || 0,
      inventory: user.inventory || [],
      badges: user.badges || [],
    }).unlocked;

  app.post("/api/dimensions/enter", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { dimensionId, sacrificeItemId } = req.body;
      const dim = getDimension(dimensionId);
      if (!dim) return res.status(404).json({ message: "Dimension not found" });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(404);
      if (!dimUnlocked(user, dim)) return res.status(403).json({ message: "This dimension is locked." });

      const group = getDimensionGroup(dim.groupId);
      const exp = { ...(((user as any).upgradeExpirations as Record<string, number>) || {}) };
      let inventory = [...(user.inventory || [])];
      const updates: any = {};

      // Validate every required sacrifice before deducting anything.
      if (dim.costCoins && (user.coins || 0) < dim.costCoins) return res.status(400).json({ message: `You need ${dim.costCoins} Neuros to enter.` });
      if (dim.costGems && ((user as any).gems || 0) < dim.costGems) return res.status(400).json({ message: `You need ${dim.costGems} gems to enter.` });
      if (dim.costShards && group?.currencyId && (exp[group.currencyId] || 0) < dim.costShards) {
        return res.status(400).json({ message: `You need ${dim.costShards} ${group.currencyName}.` });
      }
      if (dim.wagerXp && (user.xp || 0) < dim.wagerXp) return res.status(400).json({ message: `You need ${dim.wagerXp} XP to wager.` });
      let burnedItem: string | null = null;
      if (dim.sacrificeItem) {
        const sacrificeable = (id: string) => id.startsWith("potion-") || id.startsWith("powerup-") || id.startsWith("battle-powerup-");
        burnedItem = (sacrificeItemId && inventory.includes(sacrificeItemId) && sacrificeable(sacrificeItemId))
          ? sacrificeItemId
          : (inventory.find(sacrificeable) || null);
        if (!burnedItem) return res.status(400).json({ message: "You need a potion or power-up to sacrifice." });
      }

      // Deduct.
      if (dim.costCoins) updates.coins = (user.coins || 0) - dim.costCoins;
      if (dim.costGems) updates.gems = ((user as any).gems || 0) - dim.costGems;
      if (dim.costShards && group?.currencyId) exp[group.currencyId] = (exp[group.currencyId] || 0) - dim.costShards;
      if (dim.wagerXp) {
        updates.xp = (user.xp || 0) - dim.wagerXp;
        updates.level = computeLevel(updates.xp);
        exp["dim-wager-" + dim.id] = dim.wagerXp; // refunded (+bonus) only on a win
      }
      if (burnedItem) { inventory.splice(inventory.indexOf(burnedItem), 1); updates.inventory = inventory; }
      updates.upgradeExpirations = exp;

      await storage.updateUser(user.id, updates);
      const fresh = await storage.getUser(user.id);
      const { password: _p, ...safe } = fresh as any;
      res.json({ ok: true, sacrificedItem: burnedItem, user: safe });
    } catch (e) { console.error("dimension enter", e); res.status(500).json({ message: "Failed to enter dimension" }); }
  });

  app.post("/api/dimensions/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { dimensionId, won } = req.body;
      const dim = getDimension(dimensionId);
      if (!dim) return res.status(404).json({ message: "Dimension not found" });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(404);

      const group = getDimensionGroup(dim.groupId);
      const exp = { ...(((user as any).upgradeExpirations as Record<string, number>) || {}) };
      let inventory = [...(user.inventory || [])];
      let badges = [...(user.badges || [])];
      const updates: any = {};
      const result: any = { won: !!won, xp: 0, coins: 0, shards: 0, stoneEarned: null, setComplete: false, grand: null, wagerLost: 0, wagerRefunded: 0 };

      const wager = exp["dim-wager-" + dim.id] || 0;
      let xpGain = 0, coinGain = 0;

      if (won) {
        xpGain += dim.rewardXp;
        coinGain += dim.rewardCoins;
        if (wager > 0) { xpGain += wager + Math.round(wager * 0.5); result.wagerRefunded = wager; } // money back + 50%
        if (dim.rewardShards && group?.currencyId) { exp[group.currencyId] = (exp[group.currencyId] || 0) + dim.rewardShards; result.shards = dim.rewardShards; }
        if (dim.stoneId && !inventory.includes(dim.stoneId)) { inventory.push(dim.stoneId); result.stoneEarned = dim.stoneId; }
        if (dim.badgeId && !badges.includes(dim.badgeId)) badges.push(dim.badgeId);

        // Grand reward: complete the stone set.
        if (group?.grandReward && hasFullStoneSet(group, inventory) && !inventory.includes(group.grandReward.completeFlag)) {
          const gr = group.grandReward;
          inventory.push(gr.completeFlag);
          if (!inventory.includes(gr.avatarId)) inventory.push(gr.avatarId);
          if (!inventory.includes(gr.borderId)) inventory.push(gr.borderId);
          if (!badges.includes(gr.badgeId)) badges.push(gr.badgeId);
          xpGain += gr.xp;
          coinGain += gr.coins;
          updates.gems = ((user as any).gems || 0) + gr.gems;
          result.setComplete = true;
          result.grand = { title: gr.title, xp: gr.xp, coins: gr.coins, gems: gr.gems, buffXpPct: gr.buffXpPct, buffCoinPct: gr.buffCoinPct };
        }
      } else {
        // Lose = lose it all: no consolation, the wager (deducted at entry) is forfeit.
        if (wager > 0) result.wagerLost = wager;
      }
      if (wager > 0) delete exp["dim-wager-" + dim.id];

      const newXp = (user.xp || 0) + xpGain;
      updates.xp = newXp;
      updates.level = computeLevel(newXp);
      updates.coins = (user.coins || 0) + coinGain;
      updates.upgradeExpirations = exp;
      updates.inventory = inventory;
      updates.badges = badges;
      result.xp = xpGain;
      result.coins = coinGain;

      await storage.updateUser(user.id, updates);
      const fresh = await storage.getUser(user.id);
      const { password: _p, ...safe } = fresh as any;
      res.json({ ...result, user: safe });
    } catch (e) { console.error("dimension complete", e); res.status(500).json({ message: "Failed to complete dimension" }); }
  });

  // === TEMPORARY LOGIN CODES (10-minute restricted guest access) ===
  const TEMP_CODE_MS = 10 * 60 * 1000;

  app.post("/api/login-codes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if ((req.session as any)?.restricted) return res.status(403).json({ message: "Guest passes can't create codes." });
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);
      const code = randomBytes(4).toString("hex").toUpperCase(); // 8-char code
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TEMP_CODE_MS).toISOString();
      const [created] = await db.insert(loginCodes).values({
        code, userId: user.id, createdById: user.id, createdByName: user.username,
        expiresAt, createdAt: now.toISOString(),
      } as any).returning();
      res.json({ code: created.code, expiresAt: created.expiresAt, validForMs: TEMP_CODE_MS });
    } catch (e) { console.error("create login code", e); res.status(500).json({ message: "Failed to create code" }); }
  });

  app.post("/api/login-codes/redeem", async (req, res, next) => {
    try {
      const code = String(req.body?.code || "").trim().toUpperCase();
      if (!code) return res.status(400).json({ message: "Enter a code." });
      const [lc] = await db.select().from(loginCodes).where(eq(loginCodes.code, code));
      if (!lc) return res.status(404).json({ message: "Invalid code." });
      if (lc.usedAt) return res.status(400).json({ message: "This code was already used." });
      if (Date.now() > Date.parse(lc.expiresAt)) return res.status(400).json({ message: "This code has expired." });
      const target = await storage.getUser(lc.userId);
      if (!target) return res.status(404).json({ message: "Account not found." });
      await db.update(loginCodes).set({ usedAt: new Date().toISOString() }).where(eq(loginCodes.id, lc.id));
      const sessionExpiry = Date.now() + TEMP_CODE_MS; // 10 minutes from redemption
      req.login(target, (err) => {
        if (err) return next(err);
        (req.session as any).restricted = true;
        (req.session as any).tempExpiresAt = sessionExpiry;
        const { password: _p, ...safe } = target as any;
        res.json({ ...safe, restricted: true, tempExpiresAt: sessionExpiry });
      });
    } catch (e) { console.error("redeem login code", e); res.status(500).json({ message: "Failed to redeem code" }); }
  });

  // === TRADE CHAT (bargain with the trade's owner) ===
  app.get("/api/trades/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const tradeId = Number(req.params.id);
      const msgs = await db.select().from(tradeMessages).where(eq(tradeMessages.tradeId, tradeId)).orderBy(tradeMessages.id);
      res.json(msgs);
    } catch (e) { res.status(500).json({ message: "Failed to load messages" }); }
  });

  app.post("/api/trades/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const tradeId = Number(req.params.id);
      const content = String(req.body?.content || "").trim();
      if (!content) return res.status(400).json({ message: "Message can't be empty." });
      if (content.length > 500) return res.status(400).json({ message: "Message is too long." });
      const trade = await storage.getTrade(tradeId);
      if (!trade) return res.status(404).json({ message: "Trade not found." });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);
      const [created] = await db.insert(tradeMessages).values({
        tradeId, senderId: user.id, senderName: user.username, content, createdAt: new Date().toISOString(),
      }).returning();
      res.json(created);
    } catch (e) { res.status(500).json({ message: "Failed to send message" }); }
  });

  // === QUESTS (player-posted paid tasks + bargaining chat) ===
  app.get("/api/quests", async (_req, res) => {
    try {
      const all = await db.select().from(questPosts).orderBy(desc(questPosts.id));
      res.json(all);
    } catch (e) { res.status(500).json({ message: "Failed to load quests" }); }
  });

  app.post("/api/quests", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);
      const title = String(req.body?.title || "").trim().slice(0, 100);
      const description = String(req.body?.description || "").trim().slice(0, 1000);
      const rewardCoins = Math.max(0, Math.floor(Number(req.body?.rewardCoins) || 0));
      const rewardGems = Math.max(0, Math.floor(Number(req.body?.rewardGems) || 0));
      if (!title || !description) return res.status(400).json({ message: "Title and description are required." });
      if (rewardCoins === 0 && rewardGems === 0) return res.status(400).json({ message: "Offer some payment (coins or gems)." });
      if ((user.coins || 0) < rewardCoins) return res.status(400).json({ message: "You don't have enough Neuros to fund this quest." });
      if (((user as any).gems || 0) < rewardGems) return res.status(400).json({ message: "You don't have enough gems to fund this quest." });
      // Escrow the reward up-front so an accepted quest is always payable.
      await storage.updateUser(user.id, {
        coins: (user.coins || 0) - rewardCoins,
        gems: ((user as any).gems || 0) - rewardGems,
      } as any);
      const [created] = await db.insert(questPosts).values({
        posterId: user.id, posterName: user.username, title, description,
        rewardCoins, rewardGems, status: "open", createdAt: new Date().toISOString(),
      } as any).returning();
      res.json(created);
    } catch (e) { console.error("create quest", e); res.status(500).json({ message: "Failed to create quest" }); }
  });

  app.post("/api/quests/:id/accept", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);
      const [q] = await db.select().from(questPosts).where(eq(questPosts.id, id));
      if (!q) return res.status(404).json({ message: "Quest not found." });
      if (q.status !== "open") return res.status(400).json({ message: "This quest isn't open." });
      if (q.posterId === user.id) return res.status(400).json({ message: "You can't accept your own quest." });
      const [updated] = await db.update(questPosts)
        .set({ status: "assigned", assigneeId: user.id, assigneeName: user.username })
        .where(and(eq(questPosts.id, id), eq(questPosts.status, "open")))
        .returning();
      if (!updated) return res.status(400).json({ message: "This quest was just taken." });
      res.json(updated);
    } catch (e) { res.status(500).json({ message: "Failed to accept quest" }); }
  });

  app.post("/api/quests/:id/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);
      const [q] = await db.select().from(questPosts).where(eq(questPosts.id, id));
      if (!q) return res.status(404).json({ message: "Quest not found." });
      if (q.posterId !== user.id) return res.status(403).json({ message: "Only the quest poster can mark it complete." });
      if (q.status !== "assigned") return res.status(400).json({ message: "The quest must be accepted first." });
      const assignee = q.assigneeId ? await storage.getUser(q.assigneeId) : null;
      if (assignee) {
        await storage.updateUser(assignee.id, {
          coins: (assignee.coins || 0) + q.rewardCoins,
          gems: ((assignee as any).gems || 0) + q.rewardGems,
        } as any);
      }
      const [updated] = await db.update(questPosts)
        .set({ status: "completed", completedAt: new Date().toISOString() })
        .where(eq(questPosts.id, id)).returning();
      res.json(updated);
    } catch (e) { console.error("complete quest", e); res.status(500).json({ message: "Failed to complete quest" }); }
  });

  app.post("/api/quests/:id/cancel", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);
      const [q] = await db.select().from(questPosts).where(eq(questPosts.id, id));
      if (!q) return res.status(404).json({ message: "Quest not found." });
      if (q.posterId !== user.id) return res.status(403).json({ message: "Only the poster can cancel this quest." });
      if (q.status === "completed" || q.status === "cancelled") return res.status(400).json({ message: "This quest is already closed." });
      // Refund the escrowed reward to the poster.
      await storage.updateUser(user.id, {
        coins: (user.coins || 0) + q.rewardCoins,
        gems: ((user as any).gems || 0) + q.rewardGems,
      } as any);
      const [updated] = await db.update(questPosts).set({ status: "cancelled" }).where(eq(questPosts.id, id)).returning();
      res.json(updated);
    } catch (e) { res.status(500).json({ message: "Failed to cancel quest" }); }
  });

  app.get("/api/quests/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      const msgs = await db.select().from(questMessages).where(eq(questMessages.questId, id)).orderBy(questMessages.id);
      res.json(msgs);
    } catch (e) { res.status(500).json({ message: "Failed to load messages" }); }
  });

  app.post("/api/quests/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      const content = String(req.body?.content || "").trim();
      if (!content) return res.status(400).json({ message: "Message can't be empty." });
      if (content.length > 500) return res.status(400).json({ message: "Message is too long." });
      const [q] = await db.select().from(questPosts).where(eq(questPosts.id, id));
      if (!q) return res.status(404).json({ message: "Quest not found." });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);
      // While open, anyone can bargain; once assigned only the poster and helper may chat.
      if ((q.status === "assigned" || q.status === "completed") && user.id !== q.posterId && user.id !== q.assigneeId) {
        return res.status(403).json({ message: "Only the poster and the helper can chat now." });
      }
      const [created] = await db.insert(questMessages).values({
        questId: id, senderId: user.id, senderName: user.username, content, createdAt: new Date().toISOString(),
      } as any).returning();
      res.json(created);
    } catch (e) { res.status(500).json({ message: "Failed to send message" }); }
  });

  // === FEEDBACK ROUTES ===
  app.post("/api/feedback", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { message } = req.body;
      if (!message || typeof message !== "string" || message.trim().length < 3) {
        return res.status(400).json({ message: "Please write a message (at least 3 characters)" });
      }
      const fb = await storage.createFeedback({
        userId: req.user!.id,
        username: req.user!.username,
        message: message.trim(),
        createdAt: new Date().toISOString(),
        read: false,
      });
      res.json(fb);
    } catch (error) {
      res.status(500).json({ message: "Failed to send feedback" });
    }
  });

  app.get("/api/my-feedback", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const list = await storage.getUserFeedback(req.user!.id);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // === ADMIN ROUTES ===
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user || !user.isAdmin) return res.status(403).json({ message: "Admin only" });
    next();
  };

  // Records one row in the public, appealable admin-decision log. Every admin
  // action (including the ultra admin's) must supply a description, so callers
  // should validate `description` before invoking this.
  async function logAdminDecision(
    admin: { id: number; username: string },
    opts: { type: string; targetId?: number | null; targetName?: string | null; description: string; reversible?: boolean },
  ) {
    try {
      await storage.createAdminDecision({
        createdAt: new Date().toISOString(),
        adminId: admin.id,
        adminName: admin.username,
        type: opts.type,
        targetId: opts.targetId ?? null,
        targetName: opts.targetName ?? null,
        description: opts.description,
        reversible: opts.reversible ?? false,
        appealStatus: "none",
        appealText: null,
        appealedAt: null,
        appealResponse: null,
        appealResolvedById: null,
        appealResolvedByName: null,
        appealResolvedAt: null,
      } as any);
    } catch (e) {
      console.error("Failed to log admin decision", e);
    }
  }

  app.get("/api/admin/feedback", requireAdmin, async (req, res) => {
    try {
      const allFeedback = await storage.getAllFeedback();
      res.json(allFeedback);
    } catch (error) {
      res.status(500).json({ message: "Failed to get feedback" });
    }
  });

  // Admins can delete any clan outright (clears every member's clanId, then removes the clan).
  app.post("/api/admin/clans/:id/delete", requireAdmin, async (req, res) => {
    try {
      const clanId = Number(req.params.id);
      const clan = await storage.getClan(clanId);
      if (!clan) return res.status(404).json({ message: "Clan not found" });
      await storage.deleteClan(clanId);
      res.json({ message: `Clan "${clan.name}" was deleted.` });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete clan" });
    }
  });

  app.post("/api/admin/feedback/:id/read", requireAdmin, async (req, res) => {
    try {
      await storage.markFeedbackRead(Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark feedback" });
    }
  });

  app.post("/api/admin/feedback/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { xpReward = 50, coinReward = 25 } = req.body;
      const fb = await storage.approveFeedback(Number(req.params.id), xpReward, coinReward);
      if (!fb) return res.status(404).json({ message: "Feedback not found" });
      res.json({ success: true, feedback: fb });
    } catch (error) {
      res.status(500).json({ message: "Failed to approve feedback" });
    }
  });

  app.delete("/api/admin/feedback/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteFeedback(Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete feedback" });
    }
  });

  app.post("/api/admin/feedback/:id/reply", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reply } = req.body;
      if (!reply || typeof reply !== "string" || !reply.trim()) {
        return res.status(400).json({ message: "Reply cannot be empty" });
      }
      await storage.replyToFeedback(id, reply.trim());
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to send reply" });
    }
  });

  app.get("/api/admin/packs", requireAdmin, async (req, res) => {
    try {
      const packs = await storage.getAllPacks();
      res.json(packs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get packs" });
    }
  });

  app.post("/api/admin/packs/:id/approve", requireAdmin, async (req, res) => {
    try {
      const pack = await storage.approvePack(Number(req.params.id));
      if (!pack) return res.status(404).json({ message: "Pack not found" });
      res.json(pack);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve pack" });
    }
  });

  app.delete("/api/admin/packs/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteCommunityPackAdmin(Number(req.params.id));
      if (!deleted) return res.status(404).json({ message: "Pack not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete pack" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers.map(u => ({ id: u.id, username: u.username, displayName: (u as any).displayName || null, xp: u.xp, coins: u.coins, gems: u.gems, level: u.level, badges: u.badges, rebirthLevel: u.rebirthLevel, isAdmin: u.isAdmin, isUltraAdmin: isUltraAdmin(u.username), banned: u.banned, strikes: u.strikes, inventory: u.inventory, bossesDefeated: u.bossesDefeated, isDeleted: (u as any).isDeleted || false, equippedCosmetics: (u as any).equippedCosmetics || {} })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.post("/api/admin/users/:id/update", requireAdmin, async (req, res) => {
    try {
      const { xp, coins, gems, level, badges, bossesDefeated, inventory, rebirthLevel } = req.body;
      const updates: any = {};
      if (xp !== undefined) { updates.xp = Number(xp); updates.level = computeLevel(Number(xp)); }
      if (coins !== undefined) updates.coins = Number(coins);
      if (gems !== undefined) updates.gems = Number(gems);
      if (badges !== undefined) updates.badges = badges;
      if (bossesDefeated !== undefined) updates.bossesDefeated = bossesDefeated;
      if (inventory !== undefined) updates.inventory = inventory;
      if (rebirthLevel !== undefined) {
        updates.rebirthLevel = rebirthLevel;
        updates.rebirthMultiplier = 100 + rebirthLevel * 5;
      }

      const user = await storage.updateUser(Number(req.params.id), updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post("/api/admin/users/:id/toggle-admin", requireAdmin, async (req, res) => {
    try {
      const requester = await storage.getUser(req.user!.id);
      if (!isUltraAdmin(requester!.username)) return res.status(403).json({ message: "Only the ultra admin can change admin status" });
      const userId = Number(req.params.id);
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (isUltraAdmin(target.username)) return res.status(400).json({ message: "Cannot remove ultra admin status" });
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required for this action" });
      }
      await storage.updateUser(userId, { isAdmin: !target.isAdmin } as any);
      await logAdminDecision(requester!, { type: target.isAdmin ? "remove-admin" : "grant-admin", targetId: target.id, targetName: target.username, description: description.trim(), reversible: false });
      res.json({ success: true, isAdmin: !target.isAdmin });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle admin status" });
    }
  });

  app.post("/api/admin/users/:id/toggle-vip", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required for this action" });
      }
      const requester = await storage.getUser(req.user!.id);
      await storage.updateUser(userId, { isVip: !(target as any).isVip } as any);
      await logAdminDecision(requester!, { type: (target as any).isVip ? "remove-vip" : "grant-vip", targetId: target.id, targetName: target.username, description: description.trim(), reversible: false });
      res.json({ success: true, isVip: !(target as any).isVip });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle VIP status" });
    }
  });

  app.post("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const requester = await storage.getUser(req.user!.id);
      if (target.isAdmin && !isUltraAdmin(requester!.username)) return res.status(400).json({ message: "Only the ultra admin can ban other admins" });
      if (isUltraAdmin(target.username)) return res.status(400).json({ message: "The ultra admin cannot be banned" });
      const { banned, description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required for this action" });
      }
      await storage.updateUser(userId, { banned: !!banned } as any);
      await logAdminDecision(requester!, { type: banned ? "ban" : "unban", targetId: target.id, targetName: target.username, description: description.trim(), reversible: !!banned });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user ban status" });
    }
  });

  app.post("/api/admin/users/:id/strike", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const requester = await storage.getUser(req.user!.id);
      if (user.isAdmin && !isUltraAdmin(requester!.username)) return res.status(400).json({ message: "Only the ultra admin can strike other admins" });
      if (isUltraAdmin(user.username)) return res.status(400).json({ message: "The ultra admin cannot be given strikes" });
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required for this action" });
      }
      const newStrikes = user.strikes + 1;
      const updates: any = { strikes: newStrikes };
      if (newStrikes >= 3) {
        updates.banned = true;
      }
      await storage.updateUser(userId, updates);
      await logAdminDecision(requester!, { type: "strike", targetId: user.id, targetName: user.username, description: description.trim(), reversible: true });
      res.json({ success: true, strikes: newStrikes, banned: newStrikes >= 3 });
    } catch (error) {
      res.status(500).json({ message: "Failed to give strike" });
    }
  });

  app.post("/api/admin/users/:id/clear-strikes", requireAdmin, async (req, res) => {
    try {
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required for this action" });
      }
      const requester = await storage.getUser(req.user!.id);
      const user = await storage.updateUser(Number(req.params.id), { strikes: 0 } as any);
      if (!user) return res.status(404).json({ message: "User not found" });
      await logAdminDecision(requester!, { type: "clear-strikes", targetId: user.id, targetName: user.username, description: description.trim(), reversible: false });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear strikes" });
    }
  });

  app.post("/api/admin/users/:id/reset-progress", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const requester = await storage.getUser(req.user!.id);
      if (user.isAdmin && !isUltraAdmin(requester!.username)) return res.status(400).json({ message: "Only the ultra admin can reset other admins" });
      if (isUltraAdmin(user.username)) return res.status(400).json({ message: "The ultra admin's progress cannot be reset" });
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required for this action" });
      }
      await storage.updateUser(userId, {
        xp: 0, coins: 0, gems: 0, level: 1,
        currentStreak: 0, longestStreak: 0,
        badges: [], gameScores: {}, gamesWon: 0, totalGamesPlayed: 0,
        inventory: [], equippedTheme: "default",
        dailyChallengesCompleted: 0, bossesDefeated: {},
      } as any);
      await logAdminDecision(requester!, { type: "reset-progress", targetId: user.id, targetName: user.username, description: description.trim(), reversible: false });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset progress" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const requester = await storage.getUser(req.user!.id);
      if (user.isAdmin && !isUltraAdmin(requester!.username)) return res.status(400).json({ message: "Only the ultra admin can deactivate admin accounts" });
      if (isUltraAdmin(user.username)) return res.status(400).json({ message: "The ultra admin account cannot be deactivated" });
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required for this action" });
      }
      await storage.deleteUser(userId);
      await logAdminDecision(requester!, { type: "deactivate", targetId: user.id, targetName: user.username, description: description.trim(), reversible: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate user" });
    }
  });

  app.delete("/api/admin/users/:id/permanent", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const requester = await storage.getUser(req.user!.id);
      if (!isUltraAdmin(requester!.username)) return res.status(403).json({ message: "Only the ultra admin can permanently delete accounts" });
      if (isUltraAdmin(user.username)) return res.status(400).json({ message: "The ultra admin account cannot be permanently deleted" });
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required for this action" });
      }
      await logAdminDecision(requester!, { type: "permanent-delete", targetId: user.id, targetName: user.username, description: description.trim(), reversible: false });
      await storage.permanentDeleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to permanently delete user" });
    }
  });

  app.post("/api/admin/users/:id/revive", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required for this action" });
      }
      const requester = await storage.getUser(req.user!.id);
      await storage.reviveUser(userId);
      await logAdminDecision(requester!, { type: "revive", targetId: user.id, targetName: user.username, description: description.trim(), reversible: false });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to revive user" });
    }
  });

  app.post("/api/admin/users/:id/unlock-dimension", requireAdmin, async (req, res) => {
    try {
      const { dimensionId } = req.body;
      const dim = getDimension(dimensionId);
      if (!dim) return res.status(404).json({ message: "Dimension not found" });
      const target = await storage.getUser(Number(req.params.id));
      if (!target) return res.status(404).json({ message: "User not found" });
      const flag = "dimunlock-" + dim.id;
      if (!(target.inventory || []).includes(flag)) {
        await storage.updateUser(target.id, { inventory: [...(target.inventory || []), flag] } as any);
      }
      res.json({ ok: true, dimension: dim.name, user: target.username });
    } catch (error) {
      res.status(500).json({ message: "Failed to unlock dimension" });
    }
  });

  app.post("/api/admin/users/:id/grant-boss-kill", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { bossId, mutationLevel } = req.body;
      if (!bossId || mutationLevel === undefined) {
        return res.status(400).json({ message: "Boss ID and mutation level required" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const ml = Number(mutationLevel);
      if (ml < 0 || ml > 2) return res.status(400).json({ message: "Mutation level must be 0, 1, or 2" });

      const bossesDefeated = (user.bossesDefeated as Record<string, number>) || {};
      const currentLevel = bossesDefeated[bossId] || 0;
      const newLevel = Math.max(currentLevel, ml + 1);
      const updatedBosses = { ...bossesDefeated, [bossId]: newLevel };

      const inventory = user.inventory || [];
      const allShopItems = await storage.getShopItems();
      const itemsAwarded: string[] = [];
      const bossRewardItems = allShopItems.filter(i => i.rewardSource === `boss:${bossId}`);
      for (const item of bossRewardItems) {
        if (!inventory.includes(item.id)) itemsAwarded.push(item.id);
      }
      if (ml >= 2) {
        const omegaReward = allShopItems.find(i => i.rewardSource === "boss:any-omega");
        if (omegaReward && !inventory.includes(omegaReward.id) && !itemsAwarded.includes(omegaReward.id)) {
          itemsAwarded.push(omegaReward.id);
        }
      }
      const REGULAR_BOSSES = ["chaos-storm", "dr-blackout", "mutation-master", "professor-meltdown", "gravity-king", "plague-lord", "tecton-the-shaker", "nebula-queen"];
      const allRegularDefeated = REGULAR_BOSSES.every(b => (updatedBosses[b] || 0) > 0);
      if (allRegularDefeated) {
        const allBossReward = allShopItems.find(i => i.rewardSource === "boss:all-regular");
        if (allBossReward && !inventory.includes(allBossReward.id) && !itemsAwarded.includes(allBossReward.id)) {
          itemsAwarded.push(allBossReward.id);
        }
      }

      const badgesAwarded: string[] = [];
      const BOSS_BADGE_MAP: Record<string, string[]> = {
        "chaos-storm": ["storm-slayer", "supercell-survivor", "hypercane-hero"],
        "dr-blackout": ["power-restorer", "overload-overcomer", "singularity-stopper"],
        "mutation-master": ["gene-protector", "chimera-conqueror", "genome-guardian"],
        "professor-meltdown": ["meltdown-master", "catalyst-crusher", "antimatter-ace"],
        "gravity-king": ["gravity-guardian", "singularity-survivor", "dimension-defender"],
        "plague-lord": ["plague-purger", "pandemic-preventer", "extinction-ender"],
        "tecton-the-shaker": ["quake-stopper", "rift-closer", "world-saver"],
        "nebula-queen": ["star-savior", "nova-tamer", "cosmic-champion"],
        "the-void": ["void-vanquisher", "abyss-walker"],
        "professor-paradox": ["paradox-solver", "loop-breaker"],
        "king-element": ["element-king", "titan-tamer"],
        "the-architect": ["master-builder", "machine-breaker"],
        "dark-matter": ["dark-warden", "singularity-stopper-2", "universe-saver"],
        "nano-swarm": ["nano-tamer", "goo-buster", "nano-destroyer"],
        "quantum-computer": ["quantum-crusher", "reality-anchor", "loop-master"],
        "the-kraken": ["kraken-tamer", "leviathan-slayer", "abyss-conqueror"],
        "magma-titan": ["titan-cooler", "pyroclast-survivor", "core-stabilizer"],
        "frost-wyrm": ["frost-breaker", "ice-age-ender", "zero-defier"],
        "jungle-hydra": ["hydra-tamer", "overgrowth-pruner", "apex-conqueror"],
        "cosmic-entity": ["entity-banisher", "nebula-containor", "reality-savior"],
        "crystal-golem": ["golem-smasher", "prism-breaker", "geode-conqueror"],
        "thunder-king": ["thunder-tamer", "tempest-crusher", "storm-ender"],
        "virus-prime": ["virus-purger", "malware-slayer", "singularity-purger"],
        "rex-overlord": ["rex-tamer", "apex-hunter", "extinction-stopper"],
        "quantum-phantom": ["phantom-collapser", "entanglement-breaker", "probability-master"],
      };
      const badges = user.badges || [];
      const bossBadges = BOSS_BADGE_MAP[bossId];
      if (bossBadges) {
        for (let i = 0; i <= Math.min(ml, bossBadges.length - 1); i++) {
          if (!badges.includes(bossBadges[i]) && !badgesAwarded.includes(bossBadges[i])) {
            badgesAwarded.push(bossBadges[i]);
          }
        }
      }
      if (allRegularDefeated && !badges.includes("boss-slayer")) {
        badgesAwarded.push("boss-slayer");
      }

      const updates: any = { bossesDefeated: updatedBosses };
      if (itemsAwarded.length > 0) updates.inventory = [...inventory, ...itemsAwarded];
      if (badgesAwarded.length > 0) updates.badges = [...badges, ...badgesAwarded];

      await storage.updateUser(userId, updates);
      res.json({ success: true, bossesDefeated: updatedBosses, itemsAwarded, badgesAwarded });
    } catch (error) {
      res.status(500).json({ message: "Failed to grant boss kill" });
    }
  });

  app.post("/api/admin/users/:id/seal-boss", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { bossId } = req.body;
      if (!bossId) return res.status(400).json({ message: "Boss ID required" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const bossesDefeated = { ...(user.bossesDefeated as Record<string, number> || {}) };
      delete bossesDefeated[bossId];

      await storage.updateUser(userId, { bossesDefeated } as any);
      res.json({ success: true, bossesDefeated });
    } catch (error) {
      res.status(500).json({ message: "Failed to seal boss" });
    }
  });

  app.post("/api/admin/users/:id/grant-reward-item", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { itemId } = req.body;
      if (!itemId) return res.status(400).json({ message: "Item ID required" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const inventory = user.inventory || [];
      if (inventory.includes(itemId)) {
        return res.status(400).json({ message: "User already owns this item" });
      }

      const allItems = await storage.getShopItems();
      const item = allItems.find(i => i.id === itemId);
      if (!item) return res.status(400).json({ message: "Item not found in shop" });

      await storage.updateUser(userId, { inventory: [...inventory, itemId] } as any);
      res.json({ success: true, itemId });
    } catch (error) {
      res.status(500).json({ message: "Failed to grant reward item" });
    }
  });

  app.post("/api/admin/users/:id/give-shop-item", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { itemId } = req.body;
      if (!itemId) return res.status(400).json({ message: "Item ID required" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const allItems = await storage.getShopItems();
      const item = allItems.find(i => i.id === itemId);
      if (!item) return res.status(400).json({ message: "Item not found in shop" });
      const inventory = user.inventory || [];
      if (inventory.includes(itemId)) return res.status(400).json({ message: "User already owns this item" });
      await storage.updateUser(userId, { inventory: [...inventory, itemId] } as any);
      res.json({ success: true, itemId, itemName: item.name });
    } catch {
      res.status(500).json({ message: "Failed to give shop item" });
    }
  });

  app.post("/api/admin/users/:id/give-mystery-box", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { boxType = "bronze", quantity = 1 } = req.body;
      const qty = Math.min(Math.max(1, Number(quantity)), 20);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const box = MYSTERY_BOX_TIERS.find(b => b.id === boxType);
      if (!box) return res.status(400).json({ message: "Invalid box type" });
      const allShopItems = await storage.getShopItems();
      const userLevel = (user as any).level || 1;
      const userRebirth = (user as any).rebirthLevel || 0;
      const bonusInventory = [...(user.inventory || [])];
      let bonusCoins = 0, bonusXP = 0, bonusGems = 0;
      const results: { reward: string }[] = [];
      for (let i = 0; i < qty; i++) {
        const roll = Math.random();
        let cumulative = 0;
        let selectedReward = box.rewards[0];
        for (const r of box.rewards) {
          cumulative += r.chance;
          if (roll < cumulative) { selectedReward = r; break; }
        }
        if (selectedReward.type === "coins") {
          const amount = Math.floor(Math.random() * (selectedReward.max - selectedReward.min + 1)) + selectedReward.min;
          bonusCoins += amount;
          results.push({ reward: `+${amount} Coins` });
        } else if (selectedReward.type === "xp") {
          const amount = Math.floor(Math.random() * (selectedReward.max - selectedReward.min + 1)) + selectedReward.min;
          bonusXP += amount;
          results.push({ reward: `+${amount} XP` });
        } else if (selectedReward.type === "gems") {
          const amount = Math.floor(Math.random() * (selectedReward.max - selectedReward.min + 1)) + selectedReward.min;
          bonusGems += amount;
          results.push({ reward: `+${amount} Gems` });
        } else if (selectedReward.type === "random_item") {
          const buyableItems = allShopItems.filter(item =>
            !bonusInventory.includes(item.id) &&
            !(item as any).rewardSource &&
            !WORLD_EXCLUSIVE_ITEM_IDS.has(item.id) &&
            item.price > 0 &&
            item.price <= (box.id === "gold" ? 2000 : box.id === "silver" ? 1000 : 500) &&
            (item.requiredLevel || 0) <= userLevel &&
            (item.requiredRebirth || 0) <= userRebirth
          );
          if (buyableItems.length > 0) {
            const randomItem = buyableItems[Math.floor(Math.random() * buyableItems.length)];
            bonusInventory.push(randomItem.id);
            results.push({ reward: randomItem.name });
          } else {
            const fallback = Math.floor(Math.random() * 200) + 100;
            bonusCoins += fallback;
            results.push({ reward: `+${fallback} Coins` });
          }
        }
      }
      const newXP = (user.xp || 0) + bonusXP;
      await storage.updateUser(userId, {
        coins: (user.coins || 0) + bonusCoins,
        gems: ((user as any).gems || 0) + bonusGems,
        xp: newXP,
        level: computeLevel(newXP),
        mysteryBoxesOpened: ((user as any).mysteryBoxesOpened || 0) + qty,
        inventory: bonusInventory,
      } as any);
      res.json({ success: true, boxType, quantity: qty, results });
    } catch {
      res.status(500).json({ message: "Failed to give mystery boxes" });
    }
  });

  app.post("/api/admin/users/:id/give-potion", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { potionId, quantity = 1 } = req.body;
      const qty = Math.min(Math.max(1, Number(quantity)), 50);
      if (!potionId) return res.status(400).json({ message: "Potion ID required" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const newPotions = [...(user.potions || []), ...Array(qty).fill(potionId)];
      await storage.updateUser(userId, { potions: newPotions } as any);
      res.json({ success: true, potionId, quantity: qty });
    } catch {
      res.status(500).json({ message: "Failed to give potion" });
    }
  });

  const ADMINS_FAVOURITE_COINS = 500;

  app.post("/api/admin/users/:id/grant-favourite", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const badges = user.badges || [];
      const inventory = user.inventory || [];
      const hasBadge = badges.includes("admins-favourite");
      const hasTitle = inventory.includes("title-admins-favourite");

      if (hasBadge && hasTitle) {
        return res.status(400).json({ message: "User already has Admin's Favourite badge and title" });
      }

      const newInventory = hasTitle ? inventory : [...inventory, "title-admins-favourite"];
      const newBadges = hasBadge ? badges : [...badges, "admins-favourite"];
      const coinsAwarded = hasBadge ? 0 : ADMINS_FAVOURITE_COINS;

      await storage.updateUser(userId, {
        badges: newBadges,
        inventory: newInventory,
        coins: user.coins + coinsAwarded,
      } as any);
      res.json({ success: true, coinsAwarded });
    } catch (error) {
      res.status(500).json({ message: "Failed to grant favourite badge" });
    }
  });

  app.post("/api/admin/users/:id/rename", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { displayName } = req.body;
      if (!displayName || typeof displayName !== "string") return res.status(400).json({ message: "Display name required" });
      const name = displayName.trim().slice(0, 30);
      if (!name) return res.status(400).json({ message: "Display name cannot be empty" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      await storage.updateUser(userId, { displayName: name } as any);
      res.json({ success: true, displayName: name });
    } catch (error) {
      res.status(500).json({ message: "Failed to rename user" });
    }
  });

  app.post("/api/admin/users/:id/set-custom-title", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { title } = req.body;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const cosmetics = ((user as any).equippedCosmetics as Record<string, string>) || {};
      const newTitle = title && String(title).trim() ? `custom:${String(title).trim().slice(0, 30)}` : null;
      await storage.updateUser(userId, { equippedCosmetics: { ...cosmetics, title: newTitle } } as any);
      res.json({ success: true, title: newTitle });
    } catch (error) {
      res.status(500).json({ message: "Failed to set custom title" });
    }
  });

  // ── Parliament / Proposal routes ──────────────────────────────────────────

  app.get("/api/admin/proposals", requireAdmin, async (req, res) => {
    try {
      const proposals = await storage.getAdminProposals();
      res.json(proposals);
    } catch (error) {
      res.status(500).json({ message: "Failed to load proposals" });
    }
  });

  app.post("/api/admin/proposals", requireAdmin, async (req, res) => {
    try {
      const requester = await storage.getUser(req.user!.id);
      if (!requester) return res.status(401).json({ message: "Unauthorized" });
      const { type, targetId, targetName, actionData, description, isSmallIssue } = req.body;
      if (!type || !description) return res.status(400).json({ message: "type and description are required" });
      const proposal = await storage.createAdminProposal({
        createdAt: new Date().toISOString(),
        createdById: requester.id,
        createdByName: requester.username,
        type,
        targetId: targetId ?? null,
        targetName: targetName ?? null,
        actionData: actionData ?? {},
        description,
        status: "pending",
        isSmallIssue: !!isSmallIssue,
        votes: {},
        resolvedById: null,
        resolvedByName: null,
        resolvedAt: null,
      });
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to create proposal" });
    }
  });

  app.post("/api/admin/proposals/:id/vote", requireAdmin, async (req, res) => {
    try {
      const voter = await storage.getUser(req.user!.id);
      if (!voter) return res.status(401).json({ message: "Unauthorized" });
      const proposal = await storage.getAdminProposal(Number(req.params.id));
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      if (proposal.status !== "pending") return res.status(400).json({ message: "Proposal is already resolved" });
      const { vote, comment } = req.body;
      if (!["yes", "no"].includes(vote)) return res.status(400).json({ message: "vote must be yes or no" });
      const votes = (proposal.votes as Record<string, any>) || {};
      votes[String(voter.id)] = { vote, comment: comment ?? "", username: voter.username };
      await storage.updateAdminProposal(proposal.id, { votes });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to cast vote" });
    }
  });

  app.post("/api/admin/proposals/:id/resolve", requireAdmin, async (req, res) => {
    try {
      const requester = await storage.getUser(req.user!.id);
      if (!requester) return res.status(401).json({ message: "Unauthorized" });
      if (!isUltraAdmin(requester.username)) return res.status(403).json({ message: "Only the ultra admin (Speaker) can resolve proposals" });
      const proposal = await storage.getAdminProposal(Number(req.params.id));
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      if (proposal.status !== "pending") return res.status(400).json({ message: "Proposal is already resolved" });
      const { decision } = req.body;
      if (!["approve", "reject"].includes(decision)) return res.status(400).json({ message: "decision must be approve or reject" });

      if (decision === "approve" && proposal.targetId) {
        const target = await storage.getUser(proposal.targetId);
        if (target) {
          switch (proposal.type) {
            case "ban": await storage.updateUser(proposal.targetId, { banned: true } as any); break;
            case "unban": await storage.updateUser(proposal.targetId, { banned: false } as any); break;
            case "strike": {
              const newStrikes = target.strikes + 1;
              await storage.updateUser(proposal.targetId, { strikes: newStrikes, ...(newStrikes >= 3 ? { banned: true } : {}) } as any);
              break;
            }
            case "clear-strikes": await storage.updateUser(proposal.targetId, { strikes: 0 } as any); break;
            case "reset-progress":
              await storage.updateUser(proposal.targetId, {
                xp: 0, coins: 0, gems: 0, level: 1,
                currentStreak: 0, longestStreak: 0,
                badges: [], gameScores: {}, gamesWon: 0, totalGamesPlayed: 0,
                inventory: [], equippedTheme: "default",
                dailyChallengesCompleted: 0, bossesDefeated: {},
              } as any);
              break;
            case "delete": await storage.deleteUser(proposal.targetId); break;
            case "permanent-delete": await storage.permanentDeleteUser(proposal.targetId); break;
            case "toggle-admin":
              if (!isUltraAdmin(target.username)) {
                await storage.updateUser(proposal.targetId, { isAdmin: !target.isAdmin } as any);
              }
              break;
          }
        }
      }

      await storage.updateAdminProposal(proposal.id, {
        status: decision === "approve" ? "approved" : "rejected",
        resolvedById: requester.id,
        resolvedByName: requester.username,
        resolvedAt: new Date().toISOString(),
      });

      // Approved proposals are real decisions — log them to the public board so
      // the affected user can appeal. (Bans/strikes/suspensions are reversible.)
      if (decision === "approve" && proposal.targetId) {
        const reversibleTypes = ["ban", "strike", "delete"];
        await logAdminDecision(requester, {
          type: proposal.type,
          targetId: proposal.targetId,
          targetName: proposal.targetName,
          description: proposal.description,
          reversible: reversibleTypes.includes(proposal.type),
        });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to resolve proposal" });
    }
  });

  app.post("/api/admin/transfer-ultra-admin", requireAdmin, async (req, res) => {
    try {
      const requester = await storage.getUser(req.user!.id);
      if (!requester) return res.status(401).json({ message: "Unauthorized" });
      if (!isUltraAdmin(requester.username)) return res.status(403).json({ message: "Only the current ultra admin can transfer this status" });
      const { targetUsername } = req.body;
      if (!targetUsername) return res.status(400).json({ message: "targetUsername is required" });
      const target = await storage.getUserByUsername(targetUsername);
      if (!target) return res.status(404).json({ message: "Target user not found" });
      if (target.id === requester.id) return res.status(400).json({ message: "Cannot transfer to yourself" });
      if (!target.isAdmin) return res.status(400).json({ message: "Target must already be an admin" });
      await storage.setUltraAdmin(target.id, requester.id);
      ULTRA_ADMIN_USERNAME = target.username;
      res.json({ success: true, newUltraAdmin: target.username });
    } catch (error) {
      res.status(500).json({ message: "Failed to transfer ultra admin status" });
    }
  });

  // ── Public admin-decision log + appeals ────────────────────────────────────
  // Any logged-in user can view the full decision history (transparency board).
  app.get("/api/decisions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const decisions = await storage.getAdminDecisions(200);
      res.json(decisions);
    } catch { res.status(500).json({ message: "Failed to load decisions" }); }
  });

  // The affected user files an appeal on a decision about their own account.
  app.post("/api/decisions/:id/appeal", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 5) {
        return res.status(400).json({ message: "Please explain why you're appealing (at least 5 characters)." });
      }
      const decision = await storage.getAdminDecision(Number(req.params.id));
      if (!decision) return res.status(404).json({ message: "Decision not found" });
      if (decision.targetId !== req.user!.id) return res.status(403).json({ message: "You can only appeal decisions about your own account." });
      if (decision.appealStatus !== "none") return res.status(400).json({ message: "This decision has already been appealed." });
      await storage.updateAdminDecision(decision.id, {
        appealStatus: "pending",
        appealText: text.trim(),
        appealedAt: new Date().toISOString(),
      } as any);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to submit appeal" }); }
  });

  // Admins review pending appeals.
  app.get("/api/admin/appeals", requireAdmin, async (req, res) => {
    try {
      const appeals = await storage.getPendingAppeals();
      res.json(appeals);
    } catch { res.status(500).json({ message: "Failed to load appeals" }); }
  });

  // Resolve an appeal: "deny" upholds the original, "overturn" grants it and
  // auto-reverses reversible actions. Either way a description is mandatory.
  app.post("/api/admin/appeals/:id/resolve", requireAdmin, async (req, res) => {
    try {
      const { action, description } = req.body; // action: "deny" | "overturn"
      if (!["deny", "overturn"].includes(action)) return res.status(400).json({ message: "action must be 'deny' or 'overturn'" });
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "A reason/description is required to resolve an appeal" });
      }
      const requester = await storage.getUser(req.user!.id);
      const decision = await storage.getAdminDecision(Number(req.params.id));
      if (!decision) return res.status(404).json({ message: "Decision not found" });
      if (decision.appealStatus !== "pending") return res.status(400).json({ message: "This appeal is not pending" });

      if (action === "overturn" && decision.reversible && decision.targetId) {
        const target = await storage.getUser(decision.targetId);
        if (target) {
          switch (decision.type) {
            case "ban":
              await storage.updateUser(target.id, { banned: false } as any);
              break;
            case "strike": {
              const newStrikes = Math.max(0, target.strikes - 1);
              await storage.updateUser(target.id, { strikes: newStrikes, banned: newStrikes >= 3 ? target.banned : false } as any);
              break;
            }
            case "autoclicker-suspension": {
              const safety = ((target as any).safetySettings || {}) as Record<string, any>;
              safety.suspended = false;
              delete safety.suspendedReason;
              await storage.updateUser(target.id, { safetySettings: safety } as any);
              break;
            }
            case "deactivate":
              await storage.reviveUser(target.id);
              break;
          }
        }
      }

      await storage.updateAdminDecision(decision.id, {
        appealStatus: action === "overturn" ? "overturned" : "upheld",
        appealResponse: description.trim(),
        appealResolvedById: requester!.id,
        appealResolvedByName: requester!.username,
        appealResolvedAt: new Date().toISOString(),
      } as any);

      // The resolution is itself a logged decision.
      await logAdminDecision(requester!, {
        type: action === "overturn" ? "appeal-overturned" : "appeal-upheld",
        targetId: decision.targetId,
        targetName: decision.targetName,
        description: `Appeal on "${decision.type}" ${action === "overturn" ? "GRANTED — action reversed" : "denied"}: ${description.trim()}`,
        reversible: false,
      });
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to resolve appeal" }); }
  });

  // ── End Parliament routes ──────────────────────────────────────────────────

  app.post("/api/admin/daily-challenge", requireAdmin, async (req, res) => {
    try {
      const { gameId, title, description, targetScore, xpReward } = req.body;
      if (!gameId || !title || !description) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const today = new Date().toISOString().split("T")[0];
      await storage.deleteDailyChallenge(today);
      const challenge = await storage.createDailyChallenge({
        date: today,
        gameId,
        title,
        description,
        targetScore: targetScore || 100,
        xpReward: xpReward || 50,
      });
      res.json(challenge);
    } catch (error) {
      res.status(500).json({ message: "Failed to set daily challenge" });
    }
  });

  app.get("/api/admin/gt-questions", requireAdmin, async (req, res) => {
    try {
      const questions = await storage.getGrandTournamentQuestions();
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get GT questions" });
    }
  });

  app.post("/api/admin/gt-questions", requireAdmin, async (req, res) => {
    try {
      const { question, options, correctIndex, category } = req.body;
      if (!question || typeof question !== "string" || question.trim().length < 5) {
        return res.status(400).json({ message: "Question must be at least 5 characters" });
      }
      if (!Array.isArray(options) || options.length !== 4 || options.some((o: any) => typeof o !== "string" || !o.trim())) {
        return res.status(400).json({ message: "Must provide exactly 4 non-empty options" });
      }
      if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        return res.status(400).json({ message: "correctIndex must be an integer 0-3" });
      }
      const user = await storage.getUser(req.user!.id);
      const { yearLevel } = req.body;
      const q = await storage.createGrandTournamentQuestion({
        question,
        options,
        correctIndex,
        category: category || "general",
        yearLevel: (yearLevel !== undefined && yearLevel !== null) ? Number(yearLevel) : 0,
        createdBy: user?.username || "admin",
        active: true,
        createdAt: new Date().toISOString(),
      });
      res.json(q);
    } catch (error) {
      res.status(500).json({ message: "Failed to create GT question" });
    }
  });

  app.post("/api/admin/gt-questions/bulk", requireAdmin, async (req, res) => {
    try {
      const { questions } = req.body;
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: "Provide an array of questions" });
      }
      const user = await storage.getUser(req.user!.id);
      const created = [];
      for (const item of questions) {
        if (!item.question || !item.options || item.options.length !== 4 || item.correctIndex === undefined) continue;
        const q = await storage.createGrandTournamentQuestion({
          question: item.question,
          options: item.options,
          correctIndex: item.correctIndex,
          category: item.category || "general",
          createdBy: user?.username || "admin",
          active: true,
          createdAt: new Date().toISOString(),
        });
        created.push(q);
      }
      res.json({ created: created.length, questions: created });
    } catch (error) {
      res.status(500).json({ message: "Failed to bulk create GT questions" });
    }
  });

  app.put("/api/admin/gt-questions/:id", requireAdmin, async (req, res) => {
    try {
      const { question, options, correctIndex, category, active, yearLevel } = req.body;
      const updates: any = {};
      if (question !== undefined) {
        if (typeof question !== "string" || question.trim().length < 5) return res.status(400).json({ message: "Question must be at least 5 characters" });
        updates.question = question;
      }
      if (options !== undefined) {
        if (!Array.isArray(options) || options.length !== 4 || options.some((o: any) => typeof o !== "string" || !o.trim())) return res.status(400).json({ message: "Must provide exactly 4 non-empty options" });
        updates.options = options;
      }
      if (correctIndex !== undefined) {
        if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return res.status(400).json({ message: "correctIndex must be 0-3" });
        updates.correctIndex = correctIndex;
      }
      if (category !== undefined) updates.category = category;
      if (active !== undefined) updates.active = active;
      if (yearLevel !== undefined) updates.yearLevel = Number(yearLevel);
      const updated = await storage.updateGrandTournamentQuestion(Number(req.params.id), updates);
      if (!updated) return res.status(404).json({ message: "Question not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update GT question" });
    }
  });

  app.delete("/api/admin/gt-questions/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteGrandTournamentQuestion(Number(req.params.id));
      if (!deleted) return res.status(404).json({ message: "Question not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete GT question" });
    }
  });

  // === REDEMPTION CODES ===
  async function ensureFreeCodeExists() {
    const existing = await storage.getCurrentFreeCode();
    if (!existing) {
      const total = await storage.getFreeCodesTotalCount();
      const nextIndex = total + 1;
      await storage.createCode({
        code: `FREE_${nextIndex}`,
        coinReward: 100,
        gemReward: 0,
        xpReward: 0,
        maxUses: 50,
        currentUses: 0,
        isFree: true,
        freeCodeIndex: nextIndex,
        createdBy: "system",
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });
    }
  }

  app.get("/api/admin/codes", requireAdmin, async (req, res) => {
    try {
      const codes = await storage.getAllCodes();
      res.json(codes);
    } catch {
      res.status(500).json({ message: "Failed to get codes" });
    }
  });

  app.post("/api/admin/codes", requireAdmin, async (req, res) => {
    try {
      const { code, coinReward, gemReward, xpReward, maxUses, expiresAt, mysteryBoxReward, mysteryBoxType, itemRewards, worldRewards, potionRewards, message, unlimited } = req.body;
      if (!code || typeof code !== "string" || code.trim() === "") {
        return res.status(400).json({ message: "Code is required" });
      }
      const existing = await storage.getCodeByCode(code.trim().toUpperCase());
      if (existing) return res.status(400).json({ message: "Code already exists" });
      const created = await storage.createCode({
        code: code.trim().toUpperCase(),
        coinReward: Number(coinReward) || 0,
        gemReward: Number(gemReward) || 0,
        xpReward: Number(xpReward) || 0,
        mysteryBoxReward: Number(mysteryBoxReward) || 0,
        mysteryBoxType: (mysteryBoxType && ["bronze", "silver", "gold"].includes(mysteryBoxType)) ? mysteryBoxType : "bronze",
        itemRewards: Array.isArray(itemRewards) ? itemRewards : [],
        worldRewards: Array.isArray(worldRewards) ? worldRewards : [],
        potionRewards: Array.isArray(potionRewards) ? potionRewards : [],
        message: message || null,
        maxUses: unlimited ? -1 : (Number(maxUses) || 1),
        currentUses: 0,
        isFree: false,
        freeCodeIndex: null,
        createdBy: (req.user as any).username,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt || null,
      });
      res.json(created);
    } catch {
      res.status(500).json({ message: "Failed to create code" });
    }
  });

  app.delete("/api/admin/codes/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteCode(Number(req.params.id));
      if (!deleted) return res.status(404).json({ message: "Code not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete code" });
    }
  });

  app.get("/api/messages", async (req, res) => {
    try {
      const msgs = await storage.getSiteMessages();
      res.json(msgs.filter(m => m.isActive));
    } catch {
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  app.get("/api/admin/messages", requireAdmin, async (req, res) => {
    try {
      res.json(await storage.getSiteMessages());
    } catch {
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  app.post("/api/admin/messages", requireAdmin, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }
      const msg = await storage.createSiteMessage(content.trim(), (req.user as any).username);
      res.json(msg);
    } catch {
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.delete("/api/admin/messages/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteSiteMessage(Number(req.params.id));
      if (!deleted) return res.status(404).json({ message: "Message not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  app.patch("/api/admin/messages/:id/toggle", requireAdmin, async (req, res) => {
    try {
      const { isActive } = req.body;
      const updated = await storage.toggleSiteMessage(Number(req.params.id), Boolean(isActive));
      if (!updated) return res.status(404).json({ message: "Message not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to toggle message" });
    }
  });

  app.get("/api/referral/my-link", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).id;
      const referral = await storage.getOrCreateReferral(userId);
      res.json({
        code: referral.code,
        usedCount: Number(referral.used_count ?? 0),
        maxUses: 4,
      });
    } catch {
      res.status(500).json({ message: "Failed to get referral link" });
    }
  });

  app.get("/api/codes/free", async (req, res) => {
    try {
      await ensureFreeCodeExists();
      const code = await storage.getCurrentFreeCode();
      if (!code) return res.json(null);
      res.json({ code: code.code, coinReward: code.coinReward, maxUses: code.maxUses, currentUses: code.currentUses });
    } catch {
      res.status(500).json({ message: "Failed to get free code" });
    }
  });

  app.post("/api/codes/redeem", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await ensureFreeCodeExists();
      const { code } = req.body;
      if (!code || typeof code !== "string") return res.status(400).json({ message: "Code is required" });
      const found = await storage.getCodeByCode(code.trim().toUpperCase());
      if (!found) return res.status(404).json({ message: "Invalid code" });
      if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
        return res.status(400).json({ message: "This code has expired" });
      }
      if (found.maxUses !== -1 && found.currentUses >= found.maxUses) {
        return res.status(400).json({ message: "This code has reached its maximum uses" });
      }
      const userId = (req.user as any).id;
      const alreadyRedeemed = await storage.getCodeRedemption(found.id, userId);
      if (alreadyRedeemed) return res.status(400).json({ message: "You have already redeemed this code" });

      await storage.createCodeRedemption(found.id, userId);
      const newUses = found.currentUses + 1;
      await storage.updateCode(found.id, { currentUses: newUses });

      const user = await storage.getUser(userId);
      if (user) {
        const newInventory = [...user.inventory];
        const itemRewards = (found.itemRewards as string[]) || [];
        for (const itemId of itemRewards) {
          if (!newInventory.includes(itemId)) newInventory.push(itemId);
        }
        const potionRewards = (found.potionRewards as string[]) || [];
        const newPotions = [...(user.potions || []), ...potionRewards];

        // Auto-open mystery boxes and collect their rewards
        const boxCount = found.mysteryBoxReward || 0;
        const boxType = (found as any).mysteryBoxType || "bronze";
        const boxResults: { reward: string }[] = [];
        let bonusCoins = 0;
        let bonusXP = 0;
        let bonusGems = 0;
        const bonusInventory = [...newInventory];

        if (boxCount > 0) {
          const box = MYSTERY_BOX_TIERS.find(b => b.id === boxType);
          if (box) {
            const allShopItems = await storage.getShopItems();
            const userLevel = (user as any).level || 1;
            const userRebirth = (user as any).rebirthLevel || 0;
            for (let bi = 0; bi < boxCount; bi++) {
              const roll = Math.random();
              let cumulative = 0;
              let selectedReward = box.rewards[0];
              for (const r of box.rewards) {
                cumulative += r.chance;
                if (roll < cumulative) { selectedReward = r; break; }
              }
              if (selectedReward.type === "coins") {
                const amount = Math.floor(Math.random() * (selectedReward.max - selectedReward.min + 1)) + selectedReward.min;
                bonusCoins += amount;
                boxResults.push({ reward: `+${amount} Coins` });
              } else if (selectedReward.type === "xp") {
                const amount = Math.floor(Math.random() * (selectedReward.max - selectedReward.min + 1)) + selectedReward.min;
                bonusXP += amount;
                boxResults.push({ reward: `+${amount} XP` });
              } else if (selectedReward.type === "gems") {
                const amount = Math.floor(Math.random() * (selectedReward.max - selectedReward.min + 1)) + selectedReward.min;
                bonusGems += amount;
                boxResults.push({ reward: `+${amount} Gems` });
              } else if (selectedReward.type === "random_item") {
                const buyableItems = allShopItems.filter(item =>
                  !bonusInventory.includes(item.id) &&
                  !(item as any).rewardSource &&
                  !WORLD_EXCLUSIVE_ITEM_IDS.has(item.id) &&
                  item.price > 0 &&
                  item.price <= (box.id === "gold" ? 2000 : box.id === "silver" ? 1000 : 500) &&
                  (item.requiredLevel || 0) <= userLevel &&
                  (item.requiredRebirth || 0) <= userRebirth
                );
                if (buyableItems.length > 0) {
                  const randomItem = buyableItems[Math.floor(Math.random() * buyableItems.length)];
                  bonusInventory.push(randomItem.id);
                  boxResults.push({ reward: randomItem.name });
                } else {
                  const fallback = Math.floor(Math.random() * 200) + 100;
                  bonusCoins += fallback;
                  boxResults.push({ reward: `+${fallback} Coins` });
                }
              }
            }
          }
        }

        const totalXP = user.xp + found.xpReward + bonusXP;
        const newLevel = computeLevel(totalXP);

        await storage.updateUser(userId, {
          coins: user.coins + found.coinReward + bonusCoins,
          gems: user.gems + found.gemReward + bonusGems,
          xp: totalXP,
          level: newLevel,
          mysteryBoxesOpened: user.mysteryBoxesOpened + boxCount,
          inventory: bonusInventory,
          potions: newPotions,
        });

        if (found.isFree && found.maxUses !== -1 && newUses >= found.maxUses) {
          await ensureFreeCodeExists();
        }

        res.json({
          success: true,
          coinReward: found.coinReward,
          gemReward: found.gemReward,
          xpReward: found.xpReward,
          mysteryBoxReward: boxCount,
          mysteryBoxType: boxType,
          boxResults,
          itemRewards: (found.itemRewards as string[]) || [],
          worldRewards: (found.worldRewards as string[]) || [],
          potionRewards: (found.potionRewards as string[]) || [],
          message: found.message || null,
        });
        return;
      }

      if (found.isFree && found.maxUses !== -1 && newUses >= found.maxUses) {
        await ensureFreeCodeExists();
      }

      res.json({
        success: true,
        coinReward: found.coinReward,
        gemReward: found.gemReward,
        xpReward: found.xpReward,
        mysteryBoxReward: 0,
        mysteryBoxType: "bronze",
        boxResults: [],
        itemRewards: (found.itemRewards as string[]) || [],
        worldRewards: (found.worldRewards as string[]) || [],
        potionRewards: (found.potionRewards as string[]) || [],
        message: found.message || null,
      });
    } catch {
      res.status(500).json({ message: "Failed to redeem code" });
    }
  });

  app.get("/api/gt-questions/active", async (req, res) => {
    try {
      const all = await storage.getGrandTournamentQuestions(true);
      // Difficulty scales with the player's year level. Questions tagged
      // yearLevel 0 are universal; the rest must match the player's year.
      let pool = all;
      if (req.isAuthenticated()) {
        const u = await storage.getUser(req.user!.id);
        const yl = (u as any)?.yearLevel ?? 7;
        const matched = all.filter((q: any) => !q.yearLevel || q.yearLevel === 0 || q.yearLevel === yl);
        if (matched.length > 0) pool = matched; // fall back to all if none tagged for this year
      }
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      res.json(shuffled.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        category: q.category,
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get active GT questions" });
    }
  });

  // === PACK EDITING ROUTE ===
  app.put("/api/community/packs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const packId = Number(req.params.id);
      const pack = await storage.getCommunityPack(packId);
      if (!pack) return res.status(404).json({ message: "Pack not found" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (pack.creatorId !== req.user!.id && !user.isAdmin) {
        return res.status(403).json({ message: "Not your pack" });
      }

      const { title, description, questions } = req.body;
      if (questions && Array.isArray(questions) && questions.length >= 3 && questions.length <= 20) {
        for (const q of questions) {
          if (!q.question || !q.options || q.options.length !== 4 || q.correctIndex === undefined) {
            return res.status(400).json({ message: "Each question needs text, 4 options, and a correct answer" });
          }
        }
        await storage.updatePackQuestions(packId, questions.map((q: any) => ({
          packId,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation || null,
        })));
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update pack" });
    }
  });

  app.get("/api/news", async (req, res) => {
    try {
      const allPosts = await storage.getNewsPosts();
      const cosmetics = await storage.getUserCosmetics(allPosts.map(p => p.authorId));
      const enrich = (posts: typeof allPosts) => posts.map(p => {
        const c = cosmetics.get(p.authorId);
        return { ...p, authorTitle: c?.titleId || null, authorIsVip: c?.isVip || false };
      });
      if (req.isAuthenticated()) {
        const user = await storage.getUser(req.user!.id);
        if (user?.isAdmin) return res.json(enrich(allPosts));
        return res.json(enrich(allPosts.filter(p => p.status === "approved" || p.authorId === user!.id)));
      }
      res.json(enrich(allPosts.filter(p => p.status === "approved")));
    } catch (error) {
      res.status(500).json({ message: "Failed to get news" });
    }
  });

  function sanitizePoll(rawQuestion: unknown, rawOptions: unknown):
    | { pollQuestion: string; pollOptions: string[] }
    | null {
    if (typeof rawQuestion !== "string") return null;
    const q = rawQuestion.trim();
    if (!q) return null;
    if (!Array.isArray(rawOptions)) return null;
    const opts = rawOptions
      .filter((o): o is string => typeof o === "string")
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
      .slice(0, 6);
    if (opts.length < 2) return null;
    return { pollQuestion: q.slice(0, 200), pollOptions: opts.map((o) => o.slice(0, 80)) };
  }

  app.post("/api/news", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.sendStatus(401);
    try {
      const { title, content, category, pinned, pollQuestion, pollOptions } = req.body;
      if (!title || !content) return res.status(400).json({ message: "Title and content are required" });
      const isAdmin = user.isAdmin;
      const poll = sanitizePoll(pollQuestion, pollOptions);
      const post = await storage.createNewsPost({
        title,
        content,
        category: category || "update",
        authorId: user.id,
        authorName: user.username,
        authorIsAdmin: isAdmin,
        pinned: isAdmin ? (pinned || false) : false,
        createdAt: new Date().toISOString(),
        status: isAdmin ? "approved" : "pending",
        pollQuestion: poll?.pollQuestion ?? null,
        pollOptions: poll?.pollOptions ?? null,
        pollVotes: {},
      } as any);
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to create news post" });
    }
  });

  app.patch("/api/news/:id/approve", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
    try {
      const updated = await storage.updateNewsPost(Number(req.params.id), { status: "approved" } as any);
      if (!updated) return res.status(404).json({ message: "Post not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve post" });
    }
  });

  app.patch("/api/news/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
    try {
      const { title, content, category, pinned, pollQuestion, pollOptions, removePoll } = req.body;
      const updates: any = {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(pinned !== undefined && { pinned }),
      };
      if (removePoll) {
        updates.pollQuestion = null;
        updates.pollOptions = null;
        updates.pollVotes = {};
      } else if (pollQuestion !== undefined || pollOptions !== undefined) {
        const poll = sanitizePoll(pollQuestion, pollOptions);
        if (poll) {
          updates.pollQuestion = poll.pollQuestion;
          updates.pollOptions = poll.pollOptions;
          // Reset votes whenever the poll definition changes so options/votes stay aligned.
          updates.pollVotes = {};
        }
      }
      const updated = await storage.updateNewsPost(Number(req.params.id), updates);
      if (!updated) return res.status(404).json({ message: "Post not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update news post" });
    }
  });

  app.post("/api/news/:id/poll-vote", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.sendStatus(401);
    try {
      const post = await storage.getNewsPost(Number(req.params.id));
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (!post.pollQuestion || !Array.isArray(post.pollOptions) || post.pollOptions.length === 0) {
        return res.status(400).json({ message: "This post has no poll" });
      }
      const optionIndex = Number(req.body?.optionIndex);
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= post.pollOptions.length) {
        return res.status(400).json({ message: "Invalid poll option" });
      }
      const votes = { ...((post.pollVotes as Record<string, number>) || {}) };
      if (Object.prototype.hasOwnProperty.call(votes, String(user.id))) {
        return res.status(400).json({ message: "You have already voted" });
      }
      votes[String(user.id)] = optionIndex;
      const updated = await storage.updateNewsPost(post.id, { pollVotes: votes } as any);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to record vote" });
    }
  });

  app.delete("/api/news/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.sendStatus(401);
    try {
      const post = await storage.getNewsPost(Number(req.params.id));
      if (!post) return res.status(404).json({ message: "Post not found" });
      const canDelete = user.isAdmin || (post.authorId === user.id && post.status === "pending");
      if (!canDelete) return res.status(403).json({ message: "Not allowed" });
      await storage.deleteNewsPost(Number(req.params.id));
      res.json({ message: "Deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete news post" });
    }
  });

  app.get("/api/news/:id/comments", async (req, res) => {
    try {
      const comments = await storage.getNewsComments(Number(req.params.id));
      const cosmetics = await storage.getUserCosmetics(comments.map(c => c.userId));
      const enriched = comments.map(c => {
        const cos = cosmetics.get(c.userId);
        return { ...c, userTitle: cos?.titleId || null, userIsVip: cos?.isVip || false };
      });
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "Failed to get comments" });
    }
  });

  const SPAM_BLOCKED_WORDS = ["http://", "https://", "www.", ".com/", "discord.gg", "free robux", "click here"];
  const COMMENT_COOLDOWN_MS = 15000;
  const MAX_COMMENTS_PER_HOUR = 20;
  const MAX_COMMENT_LENGTH = 500;
  const MIN_COMMENT_LENGTH = 2;
  const lastCommentTime: Record<number, number> = {};

  app.post("/api/news/:id/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.sendStatus(401);
    if (user.banned) return res.status(403).json({ message: "You are banned" });

    const { content } = req.body;
    if (!content || typeof content !== "string") return res.status(400).json({ message: "Comment cannot be empty" });

    const trimmed = content.trim();
    if (trimmed.length < MIN_COMMENT_LENGTH) return res.status(400).json({ message: "Comment is too short" });
    if (trimmed.length > MAX_COMMENT_LENGTH) return res.status(400).json({ message: `Comments must be under ${MAX_COMMENT_LENGTH} characters` });

    const lowerContent = trimmed.toLowerCase();
    for (const word of SPAM_BLOCKED_WORDS) {
      if (lowerContent.includes(word)) return res.status(400).json({ message: "Links and spam are not allowed in comments" });
    }

    const repeatingPattern = /(.)\1{9,}/;
    if (repeatingPattern.test(trimmed)) return res.status(400).json({ message: "Please don't spam repeated characters" });

    const now = Date.now();
    const lastTime = lastCommentTime[user.id] || 0;
    if (now - lastTime < COMMENT_COOLDOWN_MS) {
      const wait = Math.ceil((COMMENT_COOLDOWN_MS - (now - lastTime)) / 1000);
      return res.status(429).json({ message: `Please wait ${wait} seconds before commenting again` });
    }

    try {
      const recentCount = await storage.getRecentCommentCount(user.id, 3600000);
      if (recentCount >= MAX_COMMENTS_PER_HOUR) {
        return res.status(429).json({ message: "You've posted too many comments this hour. Take a break!" });
      }

      const comment = await storage.createNewsComment({
        postId: Number(req.params.id),
        userId: user.id,
        username: user.username,
        content: trimmed,
        createdAt: new Date().toISOString(),
      });
      lastCommentTime[user.id] = now;
      res.json(comment);
    } catch (error) {
      res.status(500).json({ message: "Failed to post comment" });
    }
  });

  app.delete("/api/news/comments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.sendStatus(401);
    try {
      const comment = await storage.getNewsComment(Number(req.params.id));
      if (!comment) return res.status(404).json({ message: "Comment not found" });
      if (comment.userId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "You can only delete your own comments" });
      }
      await storage.deleteNewsComment(comment.id);
      res.json({ message: "Deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  app.get("/api/news/:id/reactions", async (req, res) => {
    try {
      const reactions = await storage.getNewsReactions(Number(req.params.id));
      res.json(reactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get reactions" });
    }
  });

  app.post("/api/news/:id/reactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.sendStatus(401);
    const { emoji } = req.body;
    const ALLOWED_EMOJIS = ["👍", "❤️", "🎉", "😂", "🤯", "🔥"];
    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ message: "Invalid reaction" });
    try {
      const added = await storage.toggleNewsReaction(Number(req.params.id), user.id, emoji);
      res.json({ added });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle reaction" });
    }
  });

  app.get("/api/news/:id/boosts", async (req, res) => {
    try {
      const postId = Number(req.params.id);
      const allReactions = await storage.getNewsReactions(postId);
      const boostCount = allReactions.filter(r => r.emoji === "boost").length;
      const boosted = req.isAuthenticated()
        ? allReactions.some(r => r.emoji === "boost" && r.userId === req.user!.id)
        : false;
      res.json({ boostCount, boosted });
    } catch (error) {
      res.status(500).json({ message: "Failed to get boosts" });
    }
  });

  app.post("/api/news/:id/boost", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const postId = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);
      const post = await storage.getNewsPost(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (post.authorId === user.id) return res.status(400).json({ message: "You can't boost your own post" });

      const added = await storage.toggleNewsReaction(postId, user.id, "boost");
      const author = await storage.getUser(post.authorId);

      const boostMilestones: Array<{ threshold: number; badge: string; item?: string; coins?: number; xp?: number }> = [
        { threshold: 1,   badge: "news-first-spark",      coins: 10,  xp: 20 },
        { threshold: 5,   badge: "news-rising-scientist",  coins: 25,  xp: 50 },
        { threshold: 10,  badge: "news-community-fave",    coins: 50,  xp: 100, item: "avatar-news-star" },
        { threshold: 25,  badge: "news-boost-magnet",      coins: 100, xp: 200 },
        { threshold: 50,  badge: "news-viral-scientist",   coins: 200, xp: 400, item: "avatar-viral-scientist" },
        { threshold: 100, badge: "news-influencer",        coins: 500, xp: 750, item: "title-influencer" },
      ];

      const newBadgesEarned: string[] = [];
      const newItemsEarned: string[] = [];

      if (author) {
        const prevTotal = (author as any).totalBoostsReceived || 0;
        const newTotal = added ? prevTotal + 1 : Math.max(0, prevTotal - 1);

        const authorUpdates: Record<string, any> = {
          gems: added ? (author.gems || 0) + 1 : Math.max(0, (author.gems || 0) - 1),
          totalBoostsReceived: newTotal,
        };

        if (added) {
          let bonusCoins = 0;
          let bonusXP = 0;
          for (const milestone of boostMilestones) {
            if (prevTotal < milestone.threshold && newTotal >= milestone.threshold) {
              if (!author.badges.includes(milestone.badge)) {
                newBadgesEarned.push(milestone.badge);
              }
              if (milestone.item && !author.inventory.includes(milestone.item)) {
                newItemsEarned.push(milestone.item);
              }
              bonusCoins += milestone.coins || 0;
              bonusXP += milestone.xp || 0;
            }
          }
          if (newBadgesEarned.length > 0) {
            authorUpdates.badges = [...author.badges, ...newBadgesEarned];
          }
          if (newItemsEarned.length > 0) {
            authorUpdates.inventory = [...author.inventory, ...newItemsEarned];
          }
          if (bonusCoins > 0) authorUpdates.coins = (author.coins || 0) + bonusCoins;
          if (bonusXP > 0) {
            authorUpdates.xp = (author.xp || 0) + bonusXP;
            authorUpdates.level = computeLevel(authorUpdates.xp);
          }
        }

        await storage.updateUser(post.authorId, authorUpdates as any);
      }

      const allReactions = await storage.getNewsReactions(postId);
      const boostCount = allReactions.filter(r => r.emoji === "boost").length;
      // Rewards belong to the AUTHOR — don't leak their badge/item ids to the booster,
      // just signal whether this boost tipped the author over a milestone.
      res.json({ boosted: added, boostCount, authorMilestone: newBadgesEarned.length > 0 || newItemsEarned.length > 0 });
    } catch (error) {
      res.status(500).json({ message: "Failed to boost post" });
    }
  });

  async function distributeTournamentEndRewards(tournament: any) {
    try {
      const entries = await storage.getTournamentEntries(tournament.id);
      const completedEntries = entries.filter((e: any) => e.completed);
      if (completedEntries.length === 0) return;

      const sorted = [...completedEntries].sort((a: any, b: any) => b.score - a.score || a.timeTaken - b.timeTaken);
      const allShopItems = await storage.getShopItems();
      const tournamentRewards = allShopItems.filter((i: any) => i.rewardSource === "tournament:winner");

      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const rank = i + 1;
        let gemsEarned = 0;
        const gemMultiplier = rank === 1 ? 1 : rank === 2 ? 0.5 : rank === 3 ? 0.25 : 0;
        gemsEarned = Math.floor((tournament.gemReward || 5) * gemMultiplier);

        const xpBonus = rank === 1 ? 100 : rank === 2 ? 60 : rank === 3 ? 30 : 10;
        const coinBonus = rank === 1 ? 200 : rank === 2 ? 100 : rank === 3 ? 50 : 20;

        if (tournament.scope === "individual" && entry.userId) {
          const u = await storage.getUser(entry.userId);
          if (u) {
            const updates: any = {
              xp: u.xp + xpBonus,
              coins: u.coins + coinBonus,
            };
            if (gemsEarned > 0) updates.gems = (u.gems || 0) + gemsEarned;
            if (rank === 1) {
              const items: string[] = [];
              for (const ri of tournamentRewards) {
                if (!u.inventory.includes(ri.id)) items.push(ri.id);
              }
              if (items.length > 0) updates.inventory = [...u.inventory, ...items];
              if (!u.badges.includes("tournament-champion")) updates.badges = [...u.badges, "tournament-champion"];
              updates.tournamentWins = (u.tournamentWins || 0) + 1;
              const newTStreak = ((u as any).tournamentWinStreak || 0) + 1;
              updates.tournamentWinStreak = newTStreak;
              updates.tournamentWinStreakPeak = Math.max(newTStreak, (u as any).tournamentWinStreakPeak || 0);
            } else {
              updates.tournamentWinStreak = 0;
            }
            await storage.updateUser(u.id, updates);
          }
        } else if (tournament.scope === "team" && entry.teamId) {
          const teamMembers = await storage.getTeamMembers(entry.teamId);
          for (const member of teamMembers) {
            const memberUser = await storage.getUser(member.id);
            if (memberUser) {
              const updates: any = {
                xp: memberUser.xp + xpBonus,
                coins: memberUser.coins + coinBonus,
              };
              if (gemsEarned > 0) updates.gems = (memberUser.gems || 0) + gemsEarned;
              if (rank === 1) {
                const items: string[] = [];
                for (const ri of tournamentRewards) {
                  if (!memberUser.inventory.includes(ri.id)) items.push(ri.id);
                }
                if (items.length > 0) updates.inventory = [...memberUser.inventory, ...items];
                if (!memberUser.badges.includes("tournament-champion")) updates.badges = [...memberUser.badges, "tournament-champion"];
                updates.tournamentWins = (memberUser.tournamentWins || 0) + 1;
                const newTStreak = ((memberUser as any).tournamentWinStreak || 0) + 1;
                updates.tournamentWinStreak = newTStreak;
                updates.tournamentWinStreakPeak = Math.max(newTStreak, (memberUser as any).tournamentWinStreakPeak || 0);
              } else {
                updates.tournamentWinStreak = 0;
              }
              await storage.updateUser(memberUser.id, updates);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to distribute tournament end rewards:", err);
    }
  }

  async function ensureDuelBracket(tournament: any) {
    if (tournament.gameMode !== "duel" || tournament.status !== "active") return tournament;
    if (Array.isArray(tournament.bracket) && tournament.bracket.length > 0) return tournament;
    const entries = await storage.getTournamentEntries(tournament.id);
    const activeEntries = entries.filter((e: any) => !e.eliminated);
    if (activeEntries.length === 0) return tournament;
    const shuffled = [...activeEntries].sort((a: any, b: any) => a.id - b.id);
    const matches: any[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const a = shuffled[i];
      const b = shuffled[i + 1];
      matches.push({
        a: a.id,
        b: b?.id ?? null,
        aScore: null,
        bScore: null,
        winnerId: b ? null : a.id,
        status: b ? "pending" : "bye",
      });
    }
    const maxRounds = Math.max(1, Math.ceil(Math.log2(Math.max(activeEntries.length, 2))));
    const updated = await storage.updateTournament(tournament.id, {
      format: "elimination",
      scope: "individual",
      currentRound: 1,
      maxRounds,
      bracket: [{ round: 1, matches }],
    } as any);
    return updated || tournament;
  }

  async function advanceDuelRoundIfReady(tournament: any, bracket: any[]) {
    const current = bracket.find((r: any) => r.round === tournament.currentRound);
    if (!current || !(current.matches || []).every((m: any) => m.status === "complete" || m.status === "bye")) return tournament;
    const winners = (current.matches || []).map((m: any) => m.winnerId).filter(Boolean);
    if (winners.length <= 1 || tournament.currentRound >= tournament.maxRounds) {
      await storage.updateTournament(tournament.id, { status: "completed", bracket } as any);
      const completed = await storage.getTournament(tournament.id);
      await distributeTournamentEndRewards(completed || tournament);
      return completed || tournament;
    }
    const nextRoundNum = tournament.currentRound + 1;
    const matches: any[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      matches.push({
        a: winners[i],
        b: winners[i + 1] ?? null,
        aScore: null,
        bScore: null,
        winnerId: winners[i + 1] ? null : winners[i],
        status: winners[i + 1] ? "pending" : "bye",
      });
    }
    for (const winnerId of winners) {
      await storage.updateTournamentEntry(winnerId, { score: 0, timeTaken: 0, completed: false, round: nextRoundNum } as any);
    }
    const nextBracket = [...bracket, { round: nextRoundNum, matches }];
    return await storage.updateTournament(tournament.id, { currentRound: nextRoundNum, bracket: nextBracket } as any);
  }

  app.get("/api/tournaments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const allTournaments = await storage.getTournaments();
      const now = new Date().toISOString();
      for (const t of allTournaments) {
        let newStatus = t.status;
        if (t.status === "upcoming" && now >= t.startTime) newStatus = "active";
        if ((t.status === "upcoming" || t.status === "active") && now >= t.endTime) newStatus = "completed";
        if (newStatus !== t.status) {
          const updated = await storage.updateTournament(t.id, { status: newStatus } as any);
          Object.assign(t, updated || { status: newStatus });
          if (newStatus === "completed") {
            await distributeTournamentEndRewards(t);
          }
        }
        if (t.status === "active" && t.gameMode === "duel") {
          const updated = await ensureDuelBracket(t);
          Object.assign(t, updated);
        }
      }
      res.json(allTournaments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tournaments" });
    }
  });

  app.get("/api/tournaments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      let tournament = await storage.getTournament(Number(req.params.id));
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      tournament = await ensureDuelBracket(tournament);
      const entries = await storage.getTournamentEntries(tournament.id);
      res.json({ tournament, entries });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tournament" });
    }
  });

  app.post("/api/tournaments", requireAdmin, async (req, res) => {
    try {
      const { title, description, type, packId, questions, maxTeams, startTime, endTime, xpReward, coinReward, topic, status } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });

      const now = new Date();
      const resolvedStart = startTime || now.toISOString();
      const resolvedEnd = endTime || new Date(now.getTime() + 7 * 86400000).toISOString();

      let tournamentQuestions = questions || [];

      if (topic && TOPIC_QUESTION_BANKS[topic]) {
        const bank = TOPIC_QUESTION_BANKS[topic];
        tournamentQuestions = [...bank.questions].sort(() => Math.random() - 0.5).slice(0, req.body.questionCount || 8);
      }

      if (type === "community" && packId) {
        const pack = await storage.getCommunityPack(packId);
        if (!pack) return res.status(404).json({ message: "Community pack not found" });
        const packQs = await storage.getPackQuestions(packId);
        tournamentQuestions = packQs.map(q => ({
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation || "",
        }));
      }

      if (tournamentQuestions.length < 3 && type !== "community") {
        return res.status(400).json({ message: "Tournaments need at least 3 questions. Pick a topic or add custom questions." });
      }

      const resolvedStatus = status || (new Date(resolvedStart) <= now ? "active" : "upcoming");

      const gameMode = req.body.gameMode || "quiz";
      const tournament = await storage.createTournament({
        title,
        description: description || "",
        type: type || "admin",
        status: resolvedStatus,
        packId: packId || null,
        questions: tournamentQuestions,
        maxTeams: maxTeams || 50,
        startTime: resolvedStart,
        endTime: resolvedEnd,
        xpReward: xpReward || 100,
        coinReward: coinReward || 50,
        gemReward: req.body.gemReward || 5,
        createdBy: req.user!.id,
        createdAt: new Date().toISOString(),
        gameMode,
        format: gameMode === "duel" ? "elimination" : req.body.format || "open",
        scope: gameMode === "duel" ? "individual" : req.body.scope || "individual",
        currentRound: 1,
        maxRounds: gameMode === "duel" ? Math.max(1, Math.ceil(Math.log2(Math.max(maxTeams || 16, 2)))) : req.body.maxRounds || 1,
        bracket: [],
      });
      res.json(tournament);
    } catch (error) {
      res.status(500).json({ message: "Failed to create tournament" });
    }
  });

  app.post("/api/tournaments/:id/join", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const tournamentId = Number(req.params.id);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      if (tournament.status === "completed") return res.status(400).json({ message: "This tournament has ended" });
      if (tournament.gameMode === "duel" && Array.isArray(tournament.bracket) && tournament.bracket.length > 0) {
        return res.status(400).json({ message: "This duel bracket has already started" });
      }

      const entries = await storage.getTournamentEntries(tournamentId);
      if (entries.length >= tournament.maxTeams) return res.status(400).json({ message: "Tournament is full" });

      const userBadges = user.badges || [];
      if (!userBadges.includes("tournament-competitor")) {
        await storage.updateUser(user.id, { badges: [...userBadges, "tournament-competitor"] } as any);
      }

      if (tournament.scope === "individual") {
        const existing = await storage.getTournamentEntryByUser(tournamentId, user.id);
        if (existing) return res.status(400).json({ message: "You are already registered" });
        const entry = await storage.createTournamentEntry({
          tournamentId,
          teamId: null,
          teamName: user.username,
          userId: user.id,
          score: 0,
          timeTaken: 0,
          completed: false,
          playedBy: [],
          submittedAt: null,
          round: 1,
          eliminated: false,
        });
        res.json(entry);
      } else {
        if (!user.teamId) return res.status(400).json({ message: "You need to be on a team to join a team tournament" });
        const existing = await storage.getTournamentEntry(tournamentId, user.teamId);
        if (existing) return res.status(400).json({ message: "Your team is already registered" });
        const team = await storage.getTeam(user.teamId);
        if (!team) return res.status(404).json({ message: "Team not found" });
        const entry = await storage.createTournamentEntry({
          tournamentId,
          teamId: user.teamId,
          teamName: team.name,
          userId: null,
          score: 0,
          timeTaken: 0,
          completed: false,
          playedBy: [],
          submittedAt: null,
          round: 1,
          eliminated: false,
        });
        res.json(entry);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to join tournament" });
    }
  });

  app.post("/api/tournaments/:id/submit", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const tournamentId = Number(req.params.id);
      const { score, timeTaken } = req.body;
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      if (tournament.status !== "active") return res.status(400).json({ message: "Tournament is not currently active" });

      if (tournament.gameMode === "duel") {
        const activeTournament = await ensureDuelBracket(tournament);
        entry = await storage.getTournamentEntryByUser(tournamentId, user.id);
        if (!entry) return res.status(400).json({ message: "You haven't joined this duel" });
        if (entry.eliminated) return res.status(400).json({ message: "You have been eliminated" });
        if (entry.completed) return res.status(400).json({ message: "You already played this round" });
        const bracket = Array.isArray(activeTournament.bracket) ? [...activeTournament.bracket] : [];
        const round = bracket.find((r: any) => r.round === activeTournament.currentRound);
        const match = round?.matches?.find((m: any) => m.a === entry.id || m.b === entry.id);
        if (!match) return res.status(400).json({ message: "You are waiting for the next round" });
        if (match.status === "bye") return res.status(400).json({ message: "You have a bye this round" });

        const updated = await storage.updateTournamentEntry(entry.id, {
          score: score || 0,
          timeTaken: timeTaken || 0,
          playedBy: [user.id] as any,
          completed: true,
          submittedAt: new Date().toISOString(),
        } as any);

        if (match.a === entry.id) match.aScore = score || 0;
        if (match.b === entry.id) match.bScore = score || 0;
        const opponentId = match.a === entry.id ? match.b : match.a;
        const opponentScore = match.a === entry.id ? match.bScore : match.aScore;
        if (opponentId && opponentScore !== null && opponentScore !== undefined) {
          const myScore = score || 0;
          const iWon = myScore >= opponentScore;
          match.winnerId = iWon ? entry.id : opponentId;
          match.status = "complete";
          await storage.updateTournamentEntry(iWon ? opponentId : entry.id, { eliminated: true, completed: true } as any);
        }
        const savedTournament = await storage.updateTournament(activeTournament.id, { bracket } as any);
        const advanced = savedTournament ? await advanceDuelRoundIfReady(savedTournament, bracket) : savedTournament;

        const xpEarned = Math.floor((score || 0) / 6) + 10;
        const coinsEarned = Math.floor((score || 0) / 12) + 5;
        const tournamentXpEarned = Math.floor(xpEarned * 0.5) + 5;
        await storage.updateUser(user.id, { xp: user.xp + xpEarned, coins: user.coins + coinsEarned, tournamentXp: (user.tournamentXp || 0) + tournamentXpEarned } as any);
        res.json({ entry: updated, tournament: advanced, rewards: { xp: xpEarned, coins: coinsEarned, gems: 0, items: [], tournamentXp: tournamentXpEarned, note: match.status === "complete" ? "Duel decided! Winner advances." : "Score saved. Waiting for your opponent!" } });
        return;
      }

      let entry: any;
      if (tournament.scope === "individual") {
        entry = await storage.getTournamentEntryByUser(tournamentId, user.id);
        if (!entry) return res.status(400).json({ message: "You haven't joined this tournament" });
        if (entry.completed) return res.status(400).json({ message: "You already completed this tournament" });

        const updated = await storage.updateTournamentEntry(entry.id, {
          score: (score || 0),
          timeTaken: (timeTaken || 0),
          playedBy: [user.id] as any,
          completed: true,
          submittedAt: new Date().toISOString(),
        } as any);

        const baseXp = tournament.xpReward || 100;
        const baseCoin = tournament.coinReward || 50;
        const xpEarned = Math.floor(baseXp * 0.3) + Math.floor((score || 0) / 5);
        const coinsEarned = Math.floor(baseCoin * 0.3) + Math.floor((score || 0) / 10);

        const allEntries = await storage.getTournamentEntries(tournamentId);
        const completedEntries = allEntries.filter(e => e.completed || e.id === entry.id);
        const sorted = completedEntries.sort((a, b) => {
          const sa = a.id === entry.id ? (score || 0) : a.score;
          const sb = b.id === entry.id ? (score || 0) : b.score;
          return sb - sa;
        });
        const rank = sorted.findIndex(e => e.id === entry.id) + 1;

        const tournamentXpEarned = Math.floor(xpEarned * 0.5) + 5;
        const userUpdates: any = { xp: user.xp + xpEarned, coins: user.coins + coinsEarned, tournamentXp: (user.tournamentXp || 0) + tournamentXpEarned };
        await storage.updateUser(user.id, userUpdates);

        res.json({ entry: updated, rewards: { xp: xpEarned, coins: coinsEarned, gems: 0, items: [], tournamentXp: tournamentXpEarned, rank, note: "Final rank rewards are given when the tournament ends!" } });
      } else {
        if (!user.teamId) return res.status(400).json({ message: "You need to be on a team" });
        entry = await storage.getTournamentEntry(tournamentId, user.teamId);
        if (!entry) return res.status(400).json({ message: "Your team hasn't joined this tournament" });

        const alreadyPlayed = Array.isArray(entry.playedBy) && (entry.playedBy as number[]).includes(user.id);
        if (alreadyPlayed) return res.status(400).json({ message: "You already played in this tournament" });

        const newScore = entry.score + (score || 0);
        const newTimeTaken = entry.timeTaken + (timeTaken || 0);
        const newPlayedBy = [...(Array.isArray(entry.playedBy) ? entry.playedBy as number[] : []), user.id];

        const team = await storage.getTeam(user.teamId);
        const teamMembers = team ? await storage.getTeamMembers(user.teamId) : [];
        const allPlayed = teamMembers.length > 0 && teamMembers.every(m => newPlayedBy.includes(m.id));

        const updated = await storage.updateTournamentEntry(entry.id, {
          score: newScore,
          timeTaken: newTimeTaken,
          playedBy: newPlayedBy as any,
          completed: allPlayed,
          submittedAt: new Date().toISOString(),
        } as any);

        const xpEarned = Math.floor((score || 0) / 5);
        const coinsEarned = Math.floor((score || 0) / 10);

        const teamTournamentXpEarned = Math.floor(xpEarned * 0.4) + 5;
        const userUpdates: any = { xp: user.xp + xpEarned, coins: user.coins + coinsEarned, tournamentXp: (user.tournamentXp || 0) + teamTournamentXpEarned };
        await storage.updateUser(user.id, userUpdates);

        res.json({ entry: updated, rewards: { xp: xpEarned, coins: coinsEarned, gems: 0, items: [], tournamentXp: teamTournamentXpEarned, note: "Final rank rewards are given when the tournament ends!" } });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to submit score" });
    }
  });

  app.post("/api/tournaments/:id/arcade-score", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const tournamentId = Number(req.params.id);
      const { score } = req.body;
      if (typeof score !== "number") return res.status(400).json({ message: "score required" });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      if (tournament.status !== "active") return res.status(400).json({ message: "Tournament not active" });

      let entry = await storage.getTournamentEntryByUser(tournamentId, user.id);
      if (!entry) {
        entry = await storage.createTournamentEntry({
          tournamentId,
          userId: user.id,
          teamId: null,
          teamName: user.username,
          score: 0,
          timeTaken: 0,
          completed: false,
          playedBy: [] as any,
          submittedAt: null,
          round: 1,
          eliminated: false,
        });
      }
      const newBest = Math.max(entry.score, score);
      const updated = await storage.updateTournamentEntry(entry.id, {
        score: newBest,
        completed: true,
        submittedAt: new Date().toISOString(),
        playedBy: [user.id] as any,
      } as any);

      const xpEarned = Math.floor(score / 5) + 10;
      const coinsEarned = Math.floor(score / 10) + 5;
      await storage.updateUser(user.id, { xp: user.xp + xpEarned, coins: user.coins + coinsEarned });

      res.json({ entry: updated, rewards: { xp: xpEarned, coins: coinsEarned } });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit arcade score" });
    }
  });

  app.post("/api/tournaments/:id/advance-round", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const tournament = await storage.getTournament(Number(req.params.id));
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      if (tournament.format !== "elimination") return res.status(400).json({ message: "Only elimination tournaments support round advancement" });
      if (tournament.status !== "active") return res.status(400).json({ message: "Tournament must be active" });

      const entries = await storage.getTournamentEntries(tournament.id);
      const activeEntries = entries.filter(e => !e.eliminated);
      const completedEntries = activeEntries.filter(e => e.completed);

      if (completedEntries.length < 2) return res.status(400).json({ message: "Need at least 2 completed entries to advance" });

      const sorted = [...completedEntries].sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken);
      const keepCount = Math.max(Math.ceil(sorted.length / 2), 1);

      if (tournament.currentRound >= tournament.maxRounds || keepCount <= 1) {
        const winner = sorted[0];
        const allShopItems = await storage.getShopItems();
        const tournamentRewards = allShopItems.filter(i => i.rewardSource === "tournament:winner");

        for (let i = 0; i < sorted.length; i++) {
          const entry = sorted[i];
          const placement = i + 1;
          let gemMultiplier = placement === 1 ? 1 : placement === 2 ? 0.5 : placement === 3 ? 0.25 : 0;
          const gemsForPlace = Math.floor((tournament.gemReward || 5) * gemMultiplier);

          if (tournament.scope === "individual" && entry.userId) {
            const entryUser = await storage.getUser(entry.userId);
            if (entryUser) {
              const updates: any = { gems: (entryUser.gems || 0) + gemsForPlace };
              if (placement === 1) {
                const items: string[] = [];
                for (const ri of tournamentRewards) {
                  if (!entryUser.inventory.includes(ri.id)) items.push(ri.id);
                }
                if (items.length > 0) updates.inventory = [...entryUser.inventory, ...items];
                if (!entryUser.badges.includes("tournament-champion")) updates.badges = [...entryUser.badges, "tournament-champion"];
                updates.tournamentWins = (entryUser.tournamentWins || 0) + 1;
              }
              await storage.updateUser(entryUser.id, updates);
            }
          }
          await storage.updateTournamentEntry(entry.id, { eliminated: placement > keepCount } as any);
        }

        for (const entry of activeEntries.filter(e => !e.completed)) {
          await storage.updateTournamentEntry(entry.id, { eliminated: true } as any);
        }

        await storage.updateTournament(tournament.id, { status: "completed", currentRound: tournament.currentRound } as any);
        res.json({ message: "Tournament complete!", winner: winner.teamName, round: tournament.currentRound, final: true });
      } else {
        for (let i = 0; i < sorted.length; i++) {
          const eliminated = i >= keepCount;
          await storage.updateTournamentEntry(sorted[i].id, {
            eliminated,
            score: eliminated ? sorted[i].score : 0,
            timeTaken: eliminated ? sorted[i].timeTaken : 0,
            completed: eliminated,
            round: eliminated ? sorted[i].round : tournament.currentRound + 1,
          } as any);
        }

        for (const entry of activeEntries.filter(e => !e.completed)) {
          await storage.updateTournamentEntry(entry.id, { eliminated: true } as any);
        }

        await storage.updateTournament(tournament.id, { currentRound: tournament.currentRound + 1 } as any);
        res.json({ message: `Round ${tournament.currentRound} complete! ${keepCount} advance to round ${tournament.currentRound + 1}.`, round: tournament.currentRound + 1, eliminated: sorted.length - keepCount, advanced: keepCount, final: false });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to advance round" });
    }
  });

  app.delete("/api/tournaments/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteTournament(Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete tournament" });
    }
  });

  app.get("/api/chat/:channelType/:channelId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { channelType, channelId } = req.params;
      if (!["clan", "team", "district"].includes(channelType)) return res.status(400).json({ message: "Invalid channel type" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);

      const id = Number(channelId);
      if (channelType === "clan" && user.clanId !== id) return res.status(403).json({ message: "Not in this clan" });
      if (channelType === "team" && user.teamId !== id) return res.status(403).json({ message: "Not in this team" });
      if (channelType === "district" && user.yearLevel !== id) return res.status(403).json({ message: "Not in this district" });

      const messages = await storage.getChatMessages(channelType, id);
      res.json(messages.reverse());
    } catch (error) {
      res.status(500).json({ message: "Failed to get chat messages" });
    }
  });

  app.post("/api/chat/:channelType/:channelId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { channelType, channelId } = req.params;
      const { content } = req.body;
      if (!["clan", "team", "district"].includes(channelType)) return res.status(400).json({ message: "Invalid channel type" });
      if (!content || typeof content !== "string" || content.trim().length === 0) return res.status(400).json({ message: "Message required" });
      if (content.length > 500) return res.status(400).json({ message: "Message too long (max 500 characters)" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(401);

      const id = Number(channelId);
      if (channelType === "clan" && user.clanId !== id) return res.status(403).json({ message: "Not in this clan" });
      if (channelType === "team" && user.teamId !== id) return res.status(403).json({ message: "Not in this team" });
      if (channelType === "district" && user.yearLevel !== id) return res.status(403).json({ message: "Not in this district" });

      const msg = await storage.createChatMessage({
        channelType,
        channelId: id,
        userId: user.id,
        username: user.username,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      });
      res.json(msg);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post("/api/rebirth", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.rebirthLevel >= 100) {
        return res.status(400).json({ message: "Maximum rebirth level reached" });
      }

      const n = user.rebirthLevel;
      const reqLevel = Math.min(10 + n * 3, 100);
      const reqBadges = Math.min(Math.floor(n / 2) + 3, 65);
      const reqGames = 25 + n * 10;
      const reqItems = Math.min(Math.floor(n / 3) + 2, 55);
      const reqBosses = n >= 2 ? Math.min(1 + Math.floor((n - 2) / 2), 25) : 0;
      const reqStreak = n >= 3 ? Math.min(2 + (n - 3), 30) : 0;
      const reqXp = n >= 4 ? Math.min(5000 + (n - 4) * 3000, 150000) : 0;
      const reqDailies = n >= 5 ? Math.min(3 + (n - 5) * 2, 60) : 0;
      const reqCoins = n >= 7 ? Math.min(2000 + (n - 7) * 2000, 100000) : 0;

      const currentLevel = computeLevel(user.xp);
      if (currentLevel < reqLevel) {
        return res.status(400).json({ message: `Need level ${reqLevel} (current: ${currentLevel})` });
      }
      if ((user.badges || []).length < reqBadges) {
        return res.status(400).json({ message: `Need ${reqBadges} badges (current: ${(user.badges || []).length})` });
      }
      if (user.totalGamesPlayed < reqGames) {
        return res.status(400).json({ message: `Need ${reqGames} games played (current: ${user.totalGamesPlayed})` });
      }
      if ((user.inventory || []).length < reqItems) {
        return res.status(400).json({ message: `Need ${reqItems} shop items (current: ${(user.inventory || []).length})` });
      }
      const bossesDefeatedCount = Object.keys(user.bossesDefeated as Record<string, number> || {}).length;
      if (reqBosses > 0 && bossesDefeatedCount < reqBosses) {
        return res.status(400).json({ message: `Need ${reqBosses} bosses defeated (current: ${bossesDefeatedCount})` });
      }
      if (reqStreak > 0 && (user.longestStreak || 0) < reqStreak) {
        return res.status(400).json({ message: `Need ${reqStreak}-day longest streak (current: ${user.longestStreak || 0})` });
      }
      if (reqXp > 0 && (user.xp || 0) < reqXp) {
        return res.status(400).json({ message: `Need ${reqXp.toLocaleString()} XP (current: ${(user.xp || 0).toLocaleString()})` });
      }
      if (reqDailies > 0 && (user.dailyChallengesCompleted || 0) < reqDailies) {
        return res.status(400).json({ message: `Need ${reqDailies} daily challenges (current: ${user.dailyChallengesCompleted || 0})` });
      }
      if (reqCoins > 0 && (user.coins || 0) < reqCoins) {
        return res.status(400).json({ message: `Need ${reqCoins.toLocaleString()} coins (current: ${(user.coins || 0).toLocaleString()})` });
      }

      const newRebirthLevel = user.rebirthLevel + 1;
      const newMultiplier = 100 + newRebirthLevel * 5;

      const rebirthBadges: string[] = [];
      const currentBadges = user.badges || [];
      if (newRebirthLevel >= 1 && !currentBadges.includes("rebirth-rookie")) rebirthBadges.push("rebirth-rookie");
      if (newRebirthLevel >= 5 && !currentBadges.includes("rebirth-veteran")) rebirthBadges.push("rebirth-veteran");
      if (newRebirthLevel >= 10 && !currentBadges.includes("rebirth-master")) rebirthBadges.push("rebirth-master");

      const rebirthAvatars: string[] = [];
      const currentInv = user.inventory || [];
      if (newRebirthLevel >= 1 && !currentInv.includes("avatar-rebirth-phoenix")) rebirthAvatars.push("avatar-rebirth-phoenix");
      if (newRebirthLevel >= 5 && !currentInv.includes("avatar-rebirth-titan")) rebirthAvatars.push("avatar-rebirth-titan");

      const allShopItems = await storage.getShopItems();
      const commonUncommonIds = new Set(
        allShopItems
          .filter(item => item.rarity === "common" || item.rarity === "uncommon")
          .map(item => item.id)
      );
      const filteredInv = currentInv.filter(itemId => !commonUncommonIds.has(itemId));

      await storage.deleteTournamentEntriesByUser(user.id);

      const prevGameScores = (user.gameScores as Record<string, any>) || {};
      const preservedScores: Record<string, any> = {};
      for (const [k, v] of Object.entries(prevGameScores)) {
        if (k !== "_experiments") preservedScores[k] = v;
      }

      const updated = await storage.updateUser(user.id, {
        rebirthLevel: newRebirthLevel,
        rebirthMultiplier: newMultiplier,
        xp: user.xp,
        coins: 0,
        gems: user.gems,
        level: currentLevel,
        inventory: [...new Set([...filteredInv, ...rebirthAvatars])],
        gameScores: preservedScores,
        gamesWon: 0,
        totalGamesPlayed: 0,
        badges: [...currentBadges, ...rebirthBadges],
        bossesDefeated: {},
        tournamentWins: 0,
        winStreak: 0,
      });

      const { password: _, ...safeUser } = updated as any;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to rebirth" });
    }
  });

  // Win streak recovery cost: streak_peak * 50 coins + floor(streak_peak / 10) gems
  app.get("/api/win-streak/recover-cost", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.sendStatus(404);
    const peak = (user as any).winStreakPeak || 0;
    const current = (user as any).winStreak || 0;
    const canRecover = peak > current;
    res.json({ current, peak, canRecover, costCoins: peak * 50, costGems: Math.floor(peak / 10) });
  });

  app.post("/api/win-streak/recover", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const peak    = (user as any).winStreakPeak || 0;
      const current = (user as any).winStreak || 0;
      if (peak <= current) return res.status(400).json({ message: "Your streak is already at its best — nothing to recover!" });
      const costCoins = peak * 50;
      const costGems  = Math.floor(peak / 10);
      if (user.coins < costCoins) return res.status(400).json({ message: `Need ${costCoins} coins (you have ${user.coins})` });
      if ((user.gems || 0) < costGems) return res.status(400).json({ message: `Need ${costGems} gems (you have ${user.gems || 0})` });
      await storage.updateUser(user.id, {
        winStreak: peak,
        coins: user.coins - costCoins,
        gems: (user.gems || 0) - costGems,
      } as any);
      res.json({ winStreak: peak, message: `Win streak restored to ${peak}!` });
    } catch {
      res.status(500).json({ message: "Failed to recover win streak" });
    }
  });

  // Tournament win streak recovery: streak_peak * 150 coins + floor(streak_peak / 5) gems
  app.get("/api/tournament-win-streak/recover-cost", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.sendStatus(404);
    const peak    = (user as any).tournamentWinStreakPeak || 0;
    const current = (user as any).tournamentWinStreak || 0;
    const canRecover = peak > current;
    res.json({ current, peak, canRecover, costCoins: peak * 150, costGems: Math.floor(peak / 5) });
  });

  app.post("/api/tournament-win-streak/recover", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const peak    = (user as any).tournamentWinStreakPeak || 0;
      const current = (user as any).tournamentWinStreak || 0;
      if (peak <= current) return res.status(400).json({ message: "Your tournament streak is already at its best!" });
      const costCoins = peak * 150;
      const costGems  = Math.floor(peak / 5);
      if (user.coins < costCoins) return res.status(400).json({ message: `Need ${costCoins} coins (you have ${user.coins})` });
      if ((user.gems || 0) < costGems) return res.status(400).json({ message: `Need ${costGems} gems (you have ${user.gems || 0})` });
      await storage.updateUser(user.id, {
        tournamentWinStreak: peak,
        coins: user.coins - costCoins,
        gems: (user.gems || 0) - costGems,
      } as any);
      res.json({ tournamentWinStreak: peak, message: `Tournament win streak restored to ${peak}!` });
    } catch {
      res.status(500).json({ message: "Failed to recover tournament win streak" });
    }
  });

  // ─── Public profile ─────────────────────────────────────────────────────────
  app.get("/api/profile/:username", async (req, res) => {
    try {
      const u = await storage.getUserByUsername(req.params.username);
      if (!u) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safe } = u as any;
      res.json(safe);
    } catch { res.status(500).json({ message: "Failed to fetch profile" }); }
  });

  // ─── Friends ────────────────────────────────────────────────────────────────
  app.get("/api/friends", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const list = await storage.getFriendships(req.user!.id);
      const augmented = await Promise.all(list.map(async (f) => {
        const friendId = f.senderId === req.user!.id ? f.receiverId : f.senderId;
        const friend = await storage.getUser(friendId);
        return { ...f, friendDisplayName: friend?.displayName || null };
      }));
      res.json(augmented);
    } catch { res.status(500).json({ message: "Failed to fetch friends" }); }
  });

  app.post("/api/friends/request", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { username } = req.body;
      if (!username || typeof username !== "string") return res.status(400).json({ message: "Username required" });
      const sender = await storage.getUser(req.user!.id);
      if (!sender) return res.status(404).json({ message: "User not found" });
      if (username.toLowerCase() === sender.username.toLowerCase()) return res.status(400).json({ message: "You can't friend yourself" });
      const receiver = await storage.getUserByUsername(username);
      if (!receiver) return res.status(404).json({ message: "That player doesn't exist" });
      // Check for existing friendship
      const existing = await storage.getFriendships(sender.id);
      const dup = existing.find(f =>
        (f.senderId === sender.id && f.receiverId === receiver.id) ||
        (f.senderId === receiver.id && f.receiverId === sender.id)
      );
      if (dup) return res.status(400).json({ message: dup.status === "accepted" ? "Already friends!" : "Request already pending" });
      const friendship = await storage.createFriendship({
        senderId: sender.id, senderName: sender.username,
        receiverId: receiver.id, receiverName: receiver.username,
        status: "pending", createdAt: new Date().toISOString(),
      });
      res.json(friendship);
    } catch { res.status(500).json({ message: "Failed to send friend request" }); }
  });

  app.post("/api/friends/:id/accept", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const id = parseInt(req.params.id);
      const f = await storage.getFriendship(id);
      if (!f) return res.status(404).json({ message: "Request not found" });
      if (f.receiverId !== req.user!.id) return res.status(403).json({ message: "Not your request" });
      if (f.status !== "pending") return res.status(400).json({ message: "Already responded" });
      const updated = await storage.updateFriendship(id, "accepted");
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to accept request" }); }
  });

  app.post("/api/friends/:id/decline", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const id = parseInt(req.params.id);
      const f = await storage.getFriendship(id);
      if (!f) return res.status(404).json({ message: "Request not found" });
      if (f.receiverId !== req.user!.id && f.senderId !== req.user!.id) return res.status(403).json({ message: "Not your request" });
      await storage.deleteFriendship(id);
      res.json({ message: "Removed" });
    } catch { res.status(500).json({ message: "Failed to decline request" }); }
  });

  app.delete("/api/friends/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const id = parseInt(req.params.id);
      const f = await storage.getFriendship(id);
      if (!f) return res.status(404).json({ message: "Not found" });
      if (f.senderId !== req.user!.id && f.receiverId !== req.user!.id) return res.status(403).json({ message: "Not your friendship" });
      await storage.deleteFriendship(id);
      res.json({ message: "Unfriended" });
    } catch { res.status(500).json({ message: "Failed to unfriend" }); }
  });

  // ─── Suspicious Activity Reports ─────────────────────────────────────────────
  app.post("/api/report/suspicious", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { reason, details } = req.body;
      if (!reason || typeof reason !== "string") return res.status(400).json({ message: "Reason required" });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.sendStatus(404);
      await storage.createSuspiciousReport(user.id, user.username, reason, details || "");

      // Autoclicker / automation detection: immediately suspend the account and
      // open an admin issue so a human reviews it before any further play.
      let suspended = false;
      if (typeof reason === "string" && reason.startsWith("autoclicker")) {
        const safety = ((user as any).safetySettings || {}) as Record<string, any>;
        if (!safety.suspended) {
          const nowIso = new Date().toISOString();
          safety.suspended = true;
          safety.suspendedAt = nowIso;
          safety.suspendedReason = "Automated input (autoclicker) detected";
          await storage.updateUser(user.id, { safetySettings: safety } as any);
          await storage.createAdminProposal({
            createdAt: nowIso,
            createdById: 0,
            createdByName: "System (Anti-Cheat)",
            type: "autoclicker_review",
            targetId: user.id,
            targetName: user.username,
            actionData: { reason, details: details || "" },
            description: `🤖 Autoclicker suspected for ${user.username}. Account suspended pending review. ${details || ""}`.trim(),
            status: "pending",
            isSmallIssue: false,
            votes: {},
          } as any);
          // Log it as an appealable decision so the player can contest a false positive.
          await logAdminDecision({ id: 0, username: "System (Anti-Cheat)" }, {
            type: "autoclicker-suspension",
            targetId: user.id,
            targetName: user.username,
            description: `Account auto-suspended: automated input (autoclicker) detected. ${details || ""}`.trim(),
            reversible: true,
          });
        }
        suspended = true;
      }
      res.json({ ok: true, suspended });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/admin/suspicious-reports", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) return res.sendStatus(403);
    try {
      const reports = await storage.getSuspiciousReports();
      res.json(reports);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.patch("/api/admin/suspicious-reports/:id/reviewed", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) return res.sendStatus(403);
    try {
      await storage.markReportReviewed(parseInt(req.params.id));
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.delete("/api/admin/suspicious-reports/:id", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) return res.sendStatus(403);
    try {
      await storage.deleteSuspiciousReport(parseInt(req.params.id));
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Auto-translation for the whole UI. Takes a batch of English strings and a
  // target language; returns translations (cached server-side). Public (UI text).
  app.post("/api/translate", async (req, res) => {
    try {
      const { texts, target } = req.body || {};
      if (!Array.isArray(texts) || typeof target !== "string") {
        return res.status(400).json({ message: "texts[] and target required" });
      }
      if (target === "en" || !SUPPORTED_LANGS.has(target)) {
        return res.json({ translations: texts });
      }
      const slice = texts.slice(0, 200).map((t: any) => String(t).slice(0, 500));
      const out: string[] = new Array(slice.length);
      let i = 0;
      const CONCURRENCY = 5;
      const worker = async () => {
        while (i < slice.length) {
          const idx = i++;
          out[idx] = await translateOne(slice[idx], target);
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      res.json({ translations: out });
    } catch {
      res.status(500).json({ message: "translate failed" });
    }
  });

  // Lift an autoclicker/automation suspension after an admin reviews the issue.
  app.post("/api/admin/users/:id/unsuspend", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) return res.sendStatus(403);
    try {
      const target = await storage.getUser(parseInt(req.params.id));
      if (!target) return res.sendStatus(404);
      const safety = ((target as any).safetySettings || {}) as Record<string, any>;
      delete safety.suspended;
      delete safety.suspendedAt;
      delete safety.suspendedReason;
      await storage.updateUser(target.id, { safetySettings: safety } as any);
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Ranked (ELO) leaderboard — also grants the #1 player the Grandmaster title.
  app.get("/api/leaderboard/ranked", async (req, res) => {
    try {
      const all = await storage.getLeaderboard(9999);
      const placed = all
        .map(u => ({ u, rs: normalizeRanked((u as any).rankedStats) }))
        .filter(x => x.rs.placed)
        .sort((a, b) => b.rs.elo - a.rs.elo);

      const GM_TITLE = "title-ranked-grandmaster";
      const topId = placed[0]?.u.id ?? -1;
      const currentUserId = req.isAuthenticated() ? req.user!.id : null;
      const newlyGranted: string[] = [];
      for (const u of all) {
        const has = u.inventory.includes(GM_TITLE);
        if (u.id === topId && !has) {
          await storage.updateUser(u.id, { inventory: [...u.inventory, GM_TITLE] } as any);
          if (u.id === currentUserId) newlyGranted.push(GM_TITLE);
        } else if (u.id !== topId && has) {
          const cos = (u.equippedCosmetics as any) || {};
          const upd: any = { inventory: u.inventory.filter((x: string) => x !== GM_TITLE) };
          if (cos.title === GM_TITLE) upd.equippedCosmetics = { ...cos, title: null };
          await storage.updateUser(u.id, upd);
        }
      }

      const leaders = placed.slice(0, 50).map((x, i) => ({
        rank: i + 1,
        id: x.u.id,
        username: x.u.username,
        elo: x.rs.elo,
        wins: x.rs.wins,
        losses: x.rs.losses,
        tier: rankFromElo(x.rs.elo, true),
        avatarId: (x.u as any).avatarId,
      }));
      res.json({ leaders, newlyGranted });
    } catch (e) {
      console.error("ranked leaderboard:", e);
      res.status(500).json({ message: "Failed" });
    }
  });

  // ─── Direct Messages ─────────────────────────────────────────────────────────
  app.get("/api/messages/unread-count", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const count = await storage.getUnreadMessageCount(req.user!.id);
      res.json({ count });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/messages/:friendId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const friendId = parseInt(req.params.friendId);
      // Verify they are actually friends
      const friendships = await storage.getFriendships(req.user!.id);
      const isFriend = friendships.some(f =>
        f.status === "accepted" &&
        ((f.senderId === req.user!.id && f.receiverId === friendId) ||
         (f.receiverId === req.user!.id && f.senderId === friendId))
      );
      if (!isFriend) return res.status(403).json({ message: "Not friends" });
      // Mark their messages to us as read
      await storage.markMessagesRead(friendId, req.user!.id);
      const messages = await storage.getDirectMessages(req.user!.id, friendId);
      res.json(messages);
    } catch { res.status(500).json({ message: "Failed to load messages" }); }
  });

  app.post("/api/messages/:friendId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const friendId = parseInt(req.params.friendId);
      const { content } = req.body;
      if (!content || typeof content !== "string" || content.trim().length === 0) return res.status(400).json({ message: "Message is empty" });
      if (content.trim().length > 300) return res.status(400).json({ message: "Message too long (max 300 chars)" });
      // Verify friendship
      const friendships = await storage.getFriendships(req.user!.id);
      const isFriend = friendships.some(f =>
        f.status === "accepted" &&
        ((f.senderId === req.user!.id && f.receiverId === friendId) ||
         (f.receiverId === req.user!.id && f.senderId === friendId))
      );
      if (!isFriend) return res.status(403).json({ message: "Not friends" });
      const sender = await storage.getUser(req.user!.id);
      if (!sender) return res.status(404).json({ message: "User not found" });
      const msg = await storage.sendDirectMessage({
        senderId: sender.id,
        senderName: sender.username,
        receiverId: friendId,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        isRead: false,
      });
      res.json(msg);
    } catch { res.status(500).json({ message: "Failed to send message" }); }
  });

  app.get("/api/leaderboard/win-streaks", async (req, res) => {
    try {
      const data = await storage.getWinStreakLeaderboard(50);
      res.json(data);
    } catch { res.status(500).json({ message: "Failed to fetch leaderboard" }); }
  });

  app.get("/api/leaderboard/tournaments", async (req, res) => {
    try {
      const leaders = await storage.getTournamentLeaderboard(100);
      const now = Date.now();
      const safe = leaders.map(({ password, ...u }) => ({
        ...u,
        isOnline: (now - (lastActive.get(u.id) || 0)) < ONLINE_THRESHOLD_MS,
      }));
      res.json(safe);
    } catch { res.status(500).json({ message: "Failed to fetch tournament leaderboard" }); }
  });

  app.post("/api/potions/buy", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { potionId } = req.body;
      if (!potionId || typeof potionId !== "string") {
        return res.status(400).json({ message: "Potion ID required" });
      }

      const POTION_CATALOG: Record<string, { price: number; currency: string; requiredLevel: number; requiredRebirth: number }> = {
        "potion-xp-small": { price: 200, currency: "coins", requiredLevel: 3, requiredRebirth: 0 },
        "potion-xp-large": { price: 500, currency: "coins", requiredLevel: 8, requiredRebirth: 0 },
        "potion-coin-small": { price: 200, currency: "coins", requiredLevel: 3, requiredRebirth: 0 },
        "potion-coin-large": { price: 500, currency: "coins", requiredLevel: 8, requiredRebirth: 0 },
        "potion-lucky": { price: 350, currency: "coins", requiredLevel: 5, requiredRebirth: 0 },
        "potion-shield": { price: 3, currency: "gems", requiredLevel: 5, requiredRebirth: 0 },
        "potion-mega": { price: 8, currency: "gems", requiredLevel: 10, requiredRebirth: 1 },
        "potion-xp-mega": { price: 15, currency: "gems", requiredLevel: 15, requiredRebirth: 3 },
      };

      const potion = POTION_CATALOG[potionId];
      if (!potion) return res.status(404).json({ message: "Potion not found" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const currentLevel = computeLevel(user.xp);
      if (currentLevel < potion.requiredLevel) {
        return res.status(400).json({ message: `Need level ${potion.requiredLevel}` });
      }
      if (user.rebirthLevel < potion.requiredRebirth) {
        return res.status(400).json({ message: `Need rebirth level ${potion.requiredRebirth}` });
      }

      if (potion.currency === "coins") {
        if (user.coins < potion.price) return res.status(400).json({ message: "Not enough coins" });
        await storage.updateUser(user.id, {
          coins: user.coins - potion.price,
          potions: [...(user.potions || []), potionId],
        });
      } else {
        if (user.gems < potion.price) return res.status(400).json({ message: "Not enough gems" });
        await storage.updateUser(user.id, {
          gems: user.gems - potion.price,
          potions: [...(user.potions || []), potionId],
        });
      }

      const updated = await storage.getUser(user.id);
      const { password: _, ...safeUser } = updated as any;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to buy potion" });
    }
  });

  app.post("/api/potions/activate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { potionId } = req.body;
      if (!potionId || typeof potionId !== "string") {
        return res.status(400).json({ message: "Potion ID required" });
      }

      const DURATION_MAP: Record<string, number> = {
        "potion-xp-small": 10, "potion-xp-large": 15, "potion-coin-small": 10,
        "potion-coin-large": 15, "potion-lucky": 10, "potion-shield": 1440,
        "potion-mega": 5, "potion-xp-mega": 3,
      };

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const potions = [...(user.potions || [])];
      const idx = potions.indexOf(potionId);
      if (idx === -1) return res.status(400).json({ message: "You don't have this potion" });

      potions.splice(idx, 1);

      const duration = DURATION_MAP[potionId] || 10;
      const expiresAt = Date.now() + duration * 60 * 1000;
      const activePotions = [...((user.activePotions as any[]) || [])].filter(
        (p: any) => p.expiresAt > Date.now()
      );
      activePotions.push({ potionId, expiresAt });

      const newPotionsUsed = (user.potionsUsed || 0) + 1;
      const potionUpdates: any = {
        potions,
        activePotions,
        potionsUsed: newPotionsUsed,
      };
      if (newPotionsUsed >= 10 && !(user.badges || []).includes("potion-brewer")) {
        potionUpdates.badges = [...(user.badges || []), "potion-brewer"];
      }

      await storage.updateUser(user.id, potionUpdates);

      const updated = await storage.getUser(user.id);
      const { password: _, ...safeUser } = updated as any;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to activate potion" });
    }
  });

  app.post("/api/potions/refund", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { potionId } = req.body;
      if (!potionId || typeof potionId !== "string") {
        return res.status(400).json({ message: "Potion ID required" });
      }

      const POTION_CATALOG: Record<string, { price: number; currency: string }> = {
        "potion-xp-small":    { price: 200,  currency: "coins" },
        "potion-xp-large":    { price: 500,  currency: "coins" },
        "potion-coin-small":  { price: 200,  currency: "coins" },
        "potion-coin-large":  { price: 500,  currency: "coins" },
        "potion-lucky":       { price: 350,  currency: "coins" },
        "potion-badge-double":{ price: 400,  currency: "coins" },
        "potion-shield":      { price: 3,    currency: "gems"  },
        "potion-mega":        { price: 8,    currency: "gems"  },
        "potion-xp-mega":     { price: 15,   currency: "gems"  },
        "potion-coin-mega":   { price: 10,   currency: "gems"  },
        "potion-ultra-boost": { price: 20,   currency: "gems"  },
      };

      const catalog = POTION_CATALOG[potionId];
      if (!catalog) return res.status(404).json({ message: "Potion not found" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const potions = [...(user.potions || [])];
      const idx = potions.indexOf(potionId);
      if (idx === -1) return res.status(400).json({ message: "You don't have this potion" });

      potions.splice(idx, 1);
      const refund = Math.floor(catalog.price * 0.5);

      const updates: any = { potions };
      if (catalog.currency === "coins") {
        updates.coins = user.coins + refund;
      } else {
        updates.gems = user.gems + refund;
      }

      await storage.updateUser(user.id, updates);
      const updated = await storage.getUser(user.id);
      const { password: _, ...safeUser } = updated as any;
      res.json({ user: safeUser, refund, currency: catalog.currency });
    } catch (error) {
      res.status(500).json({ message: "Failed to refund potion" });
    }
  });

  app.get("/api/trades", async (req, res) => {
    try {
      const allTrades = await storage.getTrades();
      const currentUsername = req.isAuthenticated() ? req.user!.username : null;
      const visible = allTrades.filter((t: any) => {
        if (!t.recipientName) return true;
        if (!currentUsername) return false;
        return t.recipientName.toLowerCase() === currentUsername.toLowerCase()
          || t.sellerId === (req.user as any)?.id;
      });
      res.json(visible);
    } catch {
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  app.post("/api/trades", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if ((user as any).banned) return res.status(403).json({ message: "Your account is suspended" });

      const { offerItems, offerCoins, offerGems, offerXp, offerPotions, wantItems, wantCoins, wantGems, wantXp, wantPotions, recipientName, maxUses } = req.body;
      const safeRecipientName: string | undefined = typeof recipientName === "string" && recipientName.trim() ? recipientName.trim() : undefined;
      if (safeRecipientName && safeRecipientName.toLowerCase() === user.username.toLowerCase()) {
        return res.status(400).json({ message: "You can't send a trade to yourself" });
      }
      // maxUses: null = single-use (escrowed), 0 = unlimited, >= 1 = multi-use
      const safeMaxUses: number | null = maxUses === null || maxUses === undefined ? null : Math.max(0, Math.floor(Number(maxUses) || 0));
      const isMultiUse = safeMaxUses !== null; // null = single-use with escrow

      // Ensure arrays are actually arrays, deduplicate, strip non-strings
      const rawOfferItems = Array.isArray(offerItems) ? offerItems : [];
      const rawWantItems  = Array.isArray(wantItems)  ? wantItems  : [];
      const safeOfferItems: string[] = [...new Set(rawOfferItems.filter((x: any) => typeof x === "string"))] as string[];
      const safeWantItems:  string[] = [...new Set(rawWantItems.filter((x: any)  => typeof x === "string"))] as string[];
      const rawOfferPotions = Array.isArray(offerPotions) ? offerPotions : [];
      const rawWantPotions  = Array.isArray(wantPotions)  ? wantPotions  : [];
      const safeOfferPotions: string[] = rawOfferPotions.filter((x: any) => typeof x === "string") as string[];
      const safeWantPotions:  string[] = rawWantPotions.filter((x: any)  => typeof x === "string") as string[];

      // Cap array lengths to prevent abuse
      if (safeOfferItems.length > 10) return res.status(400).json({ message: "You can offer at most 10 items" });
      if (safeWantItems.length  > 10) return res.status(400).json({ message: "You can request at most 10 items" });
      if (safeOfferPotions.length > 5) return res.status(400).json({ message: "You can offer at most 5 potions" });
      if (safeWantPotions.length  > 5) return res.status(400).json({ message: "You can request at most 5 potions" });

      // Clamp numeric values
      const safeOfferCoins: number = Math.max(0, Math.min(999_999, Math.floor(offerCoins || 0)));
      const safeOfferGems:  number = Math.max(0, Math.min(9_999,   Math.floor(offerGems  || 0)));
      const safeOfferXp:    number = Math.max(0, Math.min(999_999, Math.floor(offerXp    || 0)));
      const safeWantCoins:  number = Math.max(0, Math.min(999_999, Math.floor(wantCoins  || 0)));
      const safeWantGems:   number = Math.max(0, Math.min(9_999,   Math.floor(wantGems   || 0)));
      const safeWantXp:     number = Math.max(0, Math.min(999_999, Math.floor(wantXp     || 0)));

      // At least one thing on each side
      if (safeOfferItems.length === 0 && safeOfferCoins <= 0 && safeOfferGems <= 0 && safeOfferXp <= 0 && safeOfferPotions.length === 0) {
        return res.status(400).json({ message: "You must offer at least one item, coins, gems, XP, or potions" });
      }
      if (safeWantItems.length === 0 && safeWantCoins <= 0 && safeWantGems <= 0 && safeWantXp <= 0 && safeWantPotions.length === 0) {
        return res.status(400).json({ message: "You must want at least one item, coins, gems, XP, or potions" });
      }

      // Prevent trading an item for itself
      const bothSides = safeOfferItems.filter(id => safeWantItems.includes(id));
      if (bothSides.length > 0) {
        return res.status(400).json({ message: "You can't offer and request the same item in one trade" });
      }

      const allShopItems = await storage.getShopItems();
      const shopMap = new Map(allShopItems.map(i => [i.id, i]));

      // Validate offer items: ownership + not a reward item
      for (const itemId of safeOfferItems) {
        if (!user.inventory.includes(itemId)) {
          return res.status(400).json({ message: `You don't own ${itemId}` });
        }
        const si = shopMap.get(itemId);
        if (si?.rewardSource) {
          return res.status(400).json({ message: `${si.name} is a reward item and can't be traded` });
        }
      }

      // Validate want items: must exist + not a reward item
      for (const itemId of safeWantItems) {
        const si = shopMap.get(itemId);
        if (!si) return res.status(400).json({ message: `Unknown item: ${itemId}` });
        if (si.rewardSource) return res.status(400).json({ message: `${si.name} is a reward item and can't be traded` });
      }

      // Resource balance checks
      if (safeOfferCoins > user.coins) {
        return res.status(400).json({ message: "Not enough coins to offer" });
      }
      if (safeOfferGems > (user.gems || 0)) {
        return res.status(400).json({ message: "Not enough gems to offer" });
      }
      if (safeOfferXp > (user.xp || 0)) {
        return res.status(400).json({ message: "Not enough XP to offer" });
      }
      const userPotions: string[] = (user as any).potions || [];
      for (const p of safeOfferPotions) {
        if (!userPotions.includes(p)) return res.status(400).json({ message: `You don't have potion: ${p}` });
      }

      if (!isMultiUse) {
        // Single-use: Escrow resources upfront
        let escrowInventory = [...user.inventory];
        for (const itemId of safeOfferItems) {
          const idx = escrowInventory.indexOf(itemId);
          if (idx === -1) return res.status(400).json({ message: `Item ${itemId} is no longer in your inventory` });
          escrowInventory.splice(idx, 1);
        }
        let escrowPotions = [...userPotions];
        for (const p of safeOfferPotions) {
          const idx = escrowPotions.indexOf(p);
          if (idx === -1) return res.status(400).json({ message: `Potion ${p} is no longer available` });
          escrowPotions.splice(idx, 1);
        }
        await storage.updateUser(user.id, {
          inventory: escrowInventory,
          coins: user.coins - safeOfferCoins,
          gems: (user.gems || 0) - safeOfferGems,
          xp: (user.xp || 0) - safeOfferXp,
          potions: escrowPotions,
        } as any);
      }
      // Multi-use: no escrow, resources validated live at accept time

      const trade = await storage.createTrade({
        sellerId: user.id,
        sellerName: user.username,
        offerItems: safeOfferItems,
        offerCoins: safeOfferCoins,
        offerGems: safeOfferGems,
        offerXp: safeOfferXp,
        offerPotions: safeOfferPotions,
        wantItems: safeWantItems,
        wantCoins: safeWantCoins,
        wantGems: safeWantGems,
        wantXp: safeWantXp,
        wantPotions: safeWantPotions,
        recipientName: safeRecipientName || null,
        maxUses: safeMaxUses,
        status: "open",
        createdAt: new Date().toISOString(),
      } as any);

      res.json(trade);
    } catch {
      res.status(500).json({ message: "Failed to create trade" });
    }
  });

  app.post("/api/trades/:id/accept", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const tradeId = parseInt(req.params.id);
      if (isNaN(tradeId)) return res.status(400).json({ message: "Invalid trade ID" });

      const trade = await storage.getTrade(tradeId);
      if (!trade) return res.status(404).json({ message: "Trade not found" });
      if (trade.status !== "open") return res.status(400).json({ message: "Trade is no longer available" });

      const buyer = await storage.getUser(req.user!.id);
      if (!buyer) return res.status(404).json({ message: "User not found" });
      if ((buyer as any).banned) return res.status(403).json({ message: "Your account is suspended" });
      if (buyer.id === trade.sellerId) return res.status(400).json({ message: "You can't accept your own trade" });
      const tradeRecipient = (trade as any).recipientName as string | null;
      if (tradeRecipient && tradeRecipient.toLowerCase() !== buyer.username.toLowerCase()) {
        return res.status(403).json({ message: "This trade is for someone else" });
      }

      // Verify buyer has all required items
      for (const itemId of trade.wantItems) {
        if (!buyer.inventory.includes(itemId)) {
          return res.status(400).json({ message: `You don't have the required item: ${itemId}` });
        }
      }

      // Verify buyer has enough coins, gems, XP, and potions
      if (trade.wantCoins > buyer.coins) {
        return res.status(400).json({ message: `You need ${trade.wantCoins} coins but only have ${buyer.coins}` });
      }
      const wantGems = (trade as any).wantGems || 0;
      if (wantGems > (buyer.gems || 0)) {
        return res.status(400).json({ message: `You need ${wantGems} gems but only have ${buyer.gems || 0}` });
      }
      const wantXp = (trade as any).wantXp || 0;
      if (wantXp > (buyer.xp || 0)) {
        return res.status(400).json({ message: `You need ${wantXp} XP but only have ${buyer.xp || 0}` });
      }
      const wantPotions: string[] = (trade as any).wantPotions || [];
      const buyerPotions: string[] = (buyer as any).potions || [];
      const tempBuyerPotions = [...buyerPotions];
      for (const p of wantPotions) {
        const idx = tempBuyerPotions.indexOf(p);
        if (idx === -1) return res.status(400).json({ message: `You need potion: ${p}` });
        tempBuyerPotions.splice(idx, 1);
      }

      const seller = await storage.getUser(trade.sellerId);
      if (!seller) return res.status(400).json({ message: "Seller account no longer exists" });

      const tradeMaxUses = (trade as any).maxUses as number | null;
      const isMultiUseTrade = tradeMaxUses !== null;

      if (isMultiUseTrade) {
        // Multi-use: validate seller still has resources live
        const sellerCurrentInv: string[] = seller.inventory;
        for (const itemId of trade.offerItems) {
          if (!sellerCurrentInv.includes(itemId)) {
            return res.status(400).json({ message: `Seller no longer has item: ${itemId}` });
          }
        }
        if (trade.offerCoins > seller.coins) {
          return res.status(400).json({ message: "Seller no longer has enough coins to fulfill this trade" });
        }
        const ofGems = (trade as any).offerGems || 0;
        if (ofGems > (seller.gems || 0)) {
          return res.status(400).json({ message: "Seller no longer has enough gems" });
        }
        const ofXp = (trade as any).offerXp || 0;
        if (ofXp > (seller.xp || 0)) {
          return res.status(400).json({ message: "Seller no longer has enough XP" });
        }
        const ofPotions: string[] = (trade as any).offerPotions || [];
        const sellerPotionsCurrent: string[] = (seller as any).potions || [];
        const tempSellerPotions = [...sellerPotionsCurrent];
        for (const p of ofPotions) {
          const idx = tempSellerPotions.indexOf(p);
          if (idx === -1) return res.status(400).json({ message: `Seller no longer has potion: ${p}` });
          tempSellerPotions.splice(idx, 1);
        }

        // Direct transfer for multi-use
        let sellerInv = [...seller.inventory];
        let buyerInv  = [...buyer.inventory];
        buyerInv.push(...trade.offerItems);
        for (const itemId of trade.offerItems) { const i = sellerInv.indexOf(itemId); if (i !== -1) sellerInv.splice(i, 1); }
        for (const itemId of trade.wantItems)  { const i = buyerInv.indexOf(itemId);  if (i !== -1) { buyerInv.splice(i, 1); sellerInv.push(itemId); } }

        const offerGems2 = (trade as any).offerGems || 0;
        const offerXp2   = (trade as any).offerXp   || 0;
        const ofPotions2: string[] = (trade as any).offerPotions || [];
        let newSellerPotions = [...sellerPotionsCurrent, ...wantPotions];
        for (const p of ofPotions2) { const i = newSellerPotions.indexOf(p); if (i !== -1) newSellerPotions.splice(i, 1); }
        let newBuyerPotions2 = [...buyerPotions, ...ofPotions2];
        for (const p of wantPotions) { const i = newBuyerPotions2.indexOf(p); if (i !== -1) newBuyerPotions2.splice(i, 1); }

        await storage.updateUser(seller.id, { inventory: sellerInv, coins: seller.coins - trade.offerCoins + trade.wantCoins, gems: (seller.gems || 0) - offerGems2 + wantGems, xp: (seller.xp || 0) - offerXp2 + wantXp, potions: newSellerPotions } as any);
        await storage.updateUser(buyer.id,  { inventory: buyerInv,  coins: buyer.coins  - trade.wantCoins  + trade.offerCoins,  gems: (buyer.gems  || 0) - wantGems + offerGems2, xp: (buyer.xp || 0) - wantXp + offerXp2, potions: newBuyerPotions2 } as any);

        // Increment timesAccepted, close if limit reached
        const newTimesAccepted = ((trade as any).timesAccepted || 0) + 1;
        const shouldClose = tradeMaxUses > 0 && newTimesAccepted >= tradeMaxUses;
        await storage.updateTrade(tradeId, { timesAccepted: newTimesAccepted, status: shouldClose ? "closed" : "open" } as any);
        return res.json({ message: "Trade completed!" + (shouldClose ? " Trade limit reached." : "") });
      }

      // Single-use (escrowed): Atomically claim the trade — prevents race condition double-accept.
      const claimed = await storage.claimTrade(tradeId, buyer.id, buyer.username);
      if (!claimed) {
        return res.status(409).json({ message: "This trade was just accepted by someone else" });
      }

      // Transfer items: buyer receives offer items, seller receives want items
      let sellerInventory = [...seller.inventory];
      let buyerInventory  = [...buyer.inventory];

      buyerInventory.push(...trade.offerItems);

      for (const itemId of trade.wantItems) {
        const idx = buyerInventory.indexOf(itemId);
        if (idx !== -1) {
          buyerInventory.splice(idx, 1);
          sellerInventory.push(itemId);
        }
      }

      // Transfer coins, gems, XP, and potions
      const offerGems  = (trade as any).offerGems || 0;
      const offerXp    = (trade as any).offerXp   || 0;
      const offerPotions: string[] = (trade as any).offerPotions || [];
      const sellerCoins   = seller.coins + trade.wantCoins;
      const sellerGems    = (seller.gems || 0) + wantGems;
      const sellerXp      = (seller.xp  || 0) + wantXp;
      const sellerPotions = [...((seller as any).potions || []), ...wantPotions];
      const buyerCoins    = buyer.coins  - trade.wantCoins  + trade.offerCoins;
      const buyerGems     = (buyer.gems  || 0) - wantGems + offerGems;
      const buyerXp       = (buyer.xp   || 0) - wantXp  + offerXp;
      // buyer's potions: remove wantPotions (already validated), add offerPotions
      let newBuyerPotions = [...buyerPotions];
      for (const p of wantPotions) {
        const idx = newBuyerPotions.indexOf(p);
        if (idx !== -1) newBuyerPotions.splice(idx, 1);
      }
      newBuyerPotions.push(...offerPotions);

      await storage.updateUser(seller.id, { inventory: sellerInventory, coins: sellerCoins, gems: sellerGems, xp: sellerXp, potions: sellerPotions } as any);
      await storage.updateUser(buyer.id,  { inventory: buyerInventory,  coins: buyerCoins,  gems: buyerGems,  xp: buyerXp,  potions: newBuyerPotions } as any);

      res.json({ message: "Trade completed!" });
    } catch {
      res.status(500).json({ message: "Failed to complete trade" });
    }
  });

  app.delete("/api/trades/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const tradeId = parseInt(req.params.id);
      const trade = await storage.getTrade(tradeId);
      if (!trade) return res.status(404).json({ message: "Trade not found" });
      if (trade.sellerId !== req.user!.id) return res.status(403).json({ message: "Not your trade" });
      if (trade.status !== "open") return res.status(400).json({ message: "Can only cancel open trades" });

      const tradeMaxUsesCancel = (trade as any).maxUses as number | null;
      if (tradeMaxUsesCancel === null) {
        // Single-use (escrowed): return resources to seller
        const seller = await storage.getUser(trade.sellerId);
        if (seller) {
          await storage.updateUser(seller.id, {
            inventory: [...seller.inventory, ...trade.offerItems],
            coins: seller.coins + trade.offerCoins,
            gems: (seller.gems || 0) + ((trade as any).offerGems || 0),
            xp: (seller.xp || 0) + ((trade as any).offerXp || 0),
          } as any);
        }
      }
      // Multi-use: nothing was escrowed, just delete

      await storage.deleteTrade(tradeId);
      res.json({ message: "Trade cancelled" });
    } catch {
      res.status(500).json({ message: "Failed to cancel trade" });
    }
  });

  app.post("/api/gift", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { recipientUsername, itemId, coins, gems } = req.body;
      if (!recipientUsername) return res.status(400).json({ message: "Recipient username required" });
      if (!itemId && (!coins || coins <= 0) && (!gems || gems <= 0)) return res.status(400).json({ message: "Must gift an item, coins, or gems" });

      const recipient = await storage.getUserByUsername(recipientUsername);
      if (!recipient) return res.status(404).json({ message: "Player not found" });
      if (recipient.id === user.id) return res.status(400).json({ message: "Can't gift to yourself" });

      if (itemId) {
        if (!user.inventory.includes(itemId)) {
          return res.status(400).json({ message: "You don't own that item" });
        }
        const allShopItems = await storage.getShopItems();
        const si = allShopItems.find(i => i.id === itemId);
        if (si?.rewardSource) {
          return res.status(400).json({ message: `${si.name} is a reward item and can't be gifted` });
        }
        const newSenderInv = [...user.inventory];
        const idx = newSenderInv.indexOf(itemId);
        if (idx !== -1) newSenderInv.splice(idx, 1);
        const newRecipientInv = [...recipient.inventory, itemId];

        await storage.updateUser(user.id, { inventory: newSenderInv });
        await storage.updateUser(recipient.id, { inventory: newRecipientInv });
      }

      if (coins && coins > 0) {
        if (coins > user.coins) return res.status(400).json({ message: "Not enough coins" });
        await storage.updateUser(user.id, { coins: user.coins - coins });
        await storage.updateUser(recipient.id, { coins: recipient.coins + coins });
      }

      if (gems && gems > 0) {
        if (gems > user.gems) return res.status(400).json({ message: "Not enough gems" });
        await storage.updateUser(user.id, { gems: user.gems - gems });
        await storage.updateUser(recipient.id, { gems: recipient.gems + gems });
      }

      res.json({ message: `Gift sent to ${recipientUsername}!` });
    } catch {
      res.status(500).json({ message: "Failed to send gift" });
    }
  });

  // === ELECTION ROUTES ===
  async function autoResolveElection(type: "clan" | "team", entity: any, entityId: number) {
    const election = entity.election as any;
    if (!election?.active) return null;
    if (election.type === "kick") return null;
    const startedAt = new Date(election.startedAt).getTime();
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (now - startedAt < TWENTY_FOUR_HOURS) return null;

    const winner = [...election.candidates].sort((a: any, b: any) => b.votes - a.votes)[0];
    if (!winner) return null;
    election.active = false;
    election.winner = winner;
    if (type === "clan") {
      await storage.updateClan(entityId, { election, leaderId: winner.id, leaderName: winner.username } as any);
    } else {
      await storage.updateTeam(entityId, { election, leaderId: winner.id, leaderName: winner.username } as any);
    }
    return election;
  }

  async function handleElectionStart(type: "clan" | "team", entityId: number, userId: number, res: any) {
    const entity = type === "clan" ? await storage.getClan(entityId) : await storage.getTeam(entityId);
    if (!entity) return res.status(404).json({ message: `${type} not found` });
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (type === "clan" && user.clanId !== entityId) return res.status(403).json({ message: "You're not in this clan" });
    if (type === "team" && user.teamId !== entityId) return res.status(403).json({ message: "You're not on this team" });

    const election = entity.election as any;
    if (election?.active) {
      if (election.type === "kick") return res.status(400).json({ message: "A kick vote is already running" });
      const resolved = await autoResolveElection(type, entity, entityId);
      if (!resolved) return res.status(400).json({ message: "An election is already running" });
    }

    const members = type === "clan" ? await storage.getClanMembers(entityId) : await storage.getTeamMembers(entityId);
    if (members.length < 2) return res.status(400).json({ message: "Need at least 2 members for an election" });

    const candidates = members.map(m => ({ id: m.id, username: m.username, votes: 0 }));
    const newElection = { active: true, candidates, votes: {} as Record<string, number>, startedAt: new Date().toISOString(), startedBy: userId, totalMembers: members.length };

    if (type === "clan") {
      await storage.updateClan(entityId, { election: newElection } as any);
    } else {
      await storage.updateTeam(entityId, { election: newElection } as any);
    }
    res.json({ message: "Election started! All members can now vote.", election: newElection });
  }

  async function handleElectionVote(type: "clan" | "team", entityId: number, userId: number, candidateId: number, res: any) {
    const entity = type === "clan" ? await storage.getClan(entityId) : await storage.getTeam(entityId);
    if (!entity) return res.status(404).json({ message: `${type} not found` });
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (type === "clan" && user.clanId !== entityId) return res.status(403).json({ message: "You're not in this clan" });
    if (type === "team" && user.teamId !== entityId) return res.status(403).json({ message: "You're not on this team" });

    const election = entity.election as any;
    if (!election?.active) return res.status(400).json({ message: "No active election" });
    if (election.type === "kick") return res.status(400).json({ message: "A kick vote is active, not a leader election" });

    const autoResolved = await autoResolveElection(type, entity, entityId);
    if (autoResolved) return res.json({ message: `Election auto-resolved! ${autoResolved.winner.username} won!`, election: autoResolved, resolved: true });

    if (election.votes[String(userId)]) return res.status(400).json({ message: "You already voted" });

    election.votes[String(userId)] = candidateId;
    const candidate = election.candidates.find((c: any) => c.id === candidateId);
    if (!candidate) return res.status(400).json({ message: "Invalid candidate" });
    candidate.votes += 1;

    const totalVotes = Object.keys(election.votes).length;
    const members = type === "clan" ? await storage.getClanMembers(entityId) : await storage.getTeamMembers(entityId);

    if (totalVotes >= members.length) {
      const winner = [...election.candidates].sort((a: any, b: any) => b.votes - a.votes)[0];
      election.active = false;
      election.winner = winner;
      if (type === "clan") {
        await storage.updateClan(entityId, { election, leaderId: winner.id, leaderName: winner.username } as any);
      } else {
        await storage.updateTeam(entityId, { election, leaderId: winner.id, leaderName: winner.username } as any);
      }
      return res.json({ message: `Election complete! ${winner.username} is the new leader!`, election, resolved: true });
    }

    if (type === "clan") {
      await storage.updateClan(entityId, { election } as any);
    } else {
      await storage.updateTeam(entityId, { election } as any);
    }
    res.json({ message: "Vote recorded!", election, resolved: false, votesRemaining: members.length - totalVotes });
  }

  app.post("/api/clans/:id/election/start", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try { await handleElectionStart("clan", Number(req.params.id), req.user!.id, res); } catch { res.status(500).json({ message: "Failed to start election" }); }
  });

  app.post("/api/clans/:id/election/vote", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try { await handleElectionVote("clan", Number(req.params.id), req.user!.id, req.body.candidateId, res); } catch { res.status(500).json({ message: "Failed to vote" }); }
  });

  app.post("/api/teams/:id/election/start", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try { await handleElectionStart("team", Number(req.params.id), req.user!.id, res); } catch { res.status(500).json({ message: "Failed to start election" }); }
  });

  app.post("/api/teams/:id/election/vote", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try { await handleElectionVote("team", Number(req.params.id), req.user!.id, req.body.candidateId, res); } catch { res.status(500).json({ message: "Failed to vote" }); }
  });

  // === CLAN BATTLES ===
  app.get("/api/clan-battles", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user || !user.clanId) return res.json([]);
      const battles = await storage.getClanBattlesByClan(user.clanId);
      res.json(battles);
    } catch { res.status(500).json({ message: "Failed to fetch clan battles" }); }
  });

  app.get("/api/clan-battles/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const battle = await storage.getClanBattle(Number(req.params.id));
      if (!battle) return res.status(404).json({ message: "Battle not found" });
      res.json(battle);
    } catch { res.status(500).json({ message: "Failed to fetch battle" }); }
  });

  app.post("/api/clan-battles/challenge", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user || !user.clanId) return res.status(400).json({ message: "You need to be in a clan" });

      const myClan = await storage.getClan(user.clanId);
      if (!myClan) return res.status(404).json({ message: "Your clan not found" });
      if (myClan.leaderId !== user.id && !(Array.isArray(myClan.coLeaders) && (myClan.coLeaders as number[]).includes(user.id))) {
        return res.status(403).json({ message: "Only leaders and co-leaders can challenge" });
      }

      const { defenderClanId } = req.body;
      if (!defenderClanId || defenderClanId === user.clanId) return res.status(400).json({ message: "Invalid target clan" });

      const defender = await storage.getClan(defenderClanId);
      if (!defender) return res.status(404).json({ message: "Target clan not found" });

      const existing = await storage.getClanBattlesByClan(user.clanId);
      const activeBattle = existing.find(b => (b.status === "pending" || b.status === "active") && (b.defenderClanId === defenderClanId || b.challengerClanId === defenderClanId));
      if (activeBattle) return res.status(400).json({ message: "There's already an active battle with this clan" });

      const challengerMembers = await storage.getClanMembers(user.clanId);
      const defenderMembers = await storage.getClanMembers(defenderClanId);
      const matchCount = Math.min(challengerMembers.length, defenderMembers.length, 5);

      const matchups = Array.from({ length: matchCount }).map((_, i) => ({
        round: i + 1,
        challengerUserId: challengerMembers[i]?.id || null,
        challengerUsername: challengerMembers[i]?.username || "TBD",
        defenderUserId: defenderMembers[i]?.id || null,
        defenderUsername: defenderMembers[i]?.username || "TBD",
        challengerScore: 0,
        defenderScore: 0,
        completed: false,
      }));

      const battle = await storage.createClanBattle({
        challengerClanId: user.clanId,
        challengerClanName: myClan.name,
        defenderClanId,
        defenderClanName: defender.name,
        status: "pending",
        matchups,
        challengerScore: 0,
        defenderScore: 0,
        winnerId: null,
        winnerName: null,
        gemReward: 10,
        xpReward: 500,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
      res.json(battle);
    } catch { res.status(500).json({ message: "Failed to create clan battle" }); }
  });

  app.post("/api/clan-battles/:id/accept", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const battle = await storage.getClanBattle(Number(req.params.id));
      if (!battle) return res.status(404).json({ message: "Battle not found" });
      if (battle.status !== "pending") return res.status(400).json({ message: "Battle already started or completed" });

      const user = await storage.getUser(req.user!.id);
      if (!user || user.clanId !== battle.defenderClanId) return res.status(403).json({ message: "Only the defending clan can accept" });

      const defClan = await storage.getClan(battle.defenderClanId);
      if (!defClan) return res.status(404).json({ message: "Clan not found" });
      if (defClan.leaderId !== user.id && !(Array.isArray(defClan.coLeaders) && (defClan.coLeaders as number[]).includes(user.id))) {
        return res.status(403).json({ message: "Only leaders and co-leaders can accept challenges" });
      }

      await storage.updateClanBattle(battle.id, { status: "active" } as any);
      res.json({ message: "Challenge accepted! Battle is now active." });
    } catch { res.status(500).json({ message: "Failed to accept battle" }); }
  });

  app.post("/api/clan-battles/:id/submit-score", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const battle = await storage.getClanBattle(Number(req.params.id));
      if (!battle) return res.status(404).json({ message: "Battle not found" });
      if (battle.status !== "active") return res.status(400).json({ message: "Battle is not active" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { roundIndex, score } = req.body;
      const matchups = battle.matchups as any[];
      if (roundIndex < 0 || roundIndex >= matchups.length) return res.status(400).json({ message: "Invalid round" });

      const matchup = matchups[roundIndex];
      if (matchup.completed) return res.status(400).json({ message: "This round is already completed" });

      const isChallenger = user.id === matchup.challengerUserId;
      const isDefender = user.id === matchup.defenderUserId;
      if (!isChallenger && !isDefender) return res.status(403).json({ message: "You're not a participant in this round" });

      if (isChallenger) {
        if (matchup.challengerScore > 0) return res.status(400).json({ message: "You already submitted a score" });
        matchup.challengerScore = score || 0;
      } else {
        if (matchup.defenderScore > 0) return res.status(400).json({ message: "You already submitted a score" });
        matchup.defenderScore = score || 0;
      }

      if (matchup.challengerScore > 0 && matchup.defenderScore > 0) {
        matchup.completed = true;
      }

      let challengerTotal = 0, defenderTotal = 0;
      for (const m of matchups) {
        challengerTotal += m.challengerScore || 0;
        defenderTotal += m.defenderScore || 0;
      }

      const allDone = matchups.every((m: any) => m.completed);
      const updates: any = { matchups, challengerScore: challengerTotal, defenderScore: defenderTotal };

      if (allDone) {
        updates.status = "completed";
        updates.completedAt = new Date().toISOString();
        if (challengerTotal > defenderTotal) {
          updates.winnerId = battle.challengerClanId;
          updates.winnerName = battle.challengerClanName;
        } else if (defenderTotal > challengerTotal) {
          updates.winnerId = battle.defenderClanId;
          updates.winnerName = battle.defenderClanName;
        }

        if (updates.winnerId) {
          const winningMembers = updates.winnerId === battle.challengerClanId
            ? await storage.getClanMembers(battle.challengerClanId)
            : await storage.getClanMembers(battle.defenderClanId);
          const allShopItems = await storage.getShopItems();
          const clanBattleRewards = allShopItems.filter(i => i.rewardSource === "clan-battle:winner");
          for (const member of winningMembers) {
            const memberItems: string[] = [];
            for (const ri of clanBattleRewards) {
              if (!member.inventory.includes(ri.id)) memberItems.push(ri.id);
            }
            const memberBadges = [...member.badges];
            if (!memberBadges.includes("clan-battle-champion")) memberBadges.push("clan-battle-champion");
            await storage.updateUser(member.id, {
              xp: member.xp + (battle.xpReward || 500),
              gems: (member.gems || 0) + (battle.gemReward || 10),
              inventory: [...member.inventory, ...memberItems],
              badges: memberBadges,
            } as any);
          }
        }
      }

      await storage.updateClanBattle(battle.id, updates);
      res.json({ message: allDone ? "Battle complete!" : "Score submitted!", matchups, allDone, challengerTotal, defenderTotal });
    } catch { res.status(500).json({ message: "Failed to submit score" }); }
  });

  app.post("/api/clan-battles/:id/decline", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const battle = await storage.getClanBattle(Number(req.params.id));
      if (!battle) return res.status(404).json({ message: "Battle not found" });
      if (battle.status !== "pending") return res.status(400).json({ message: "Can only decline pending battles" });

      const user = await storage.getUser(req.user!.id);
      if (!user || user.clanId !== battle.defenderClanId) return res.status(403).json({ message: "Only the defending clan can decline" });

      await storage.updateClanBattle(battle.id, { status: "declined" } as any);
      res.json({ message: "Challenge declined." });
    } catch { res.status(500).json({ message: "Failed to decline battle" }); }
  });

  // === GRAND TOURNAMENT ===
  function getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const GRAND_DISTRICTS = ["year-3", "year-4", "year-5", "year-6", "year-7", "year-8"];
  const grandMatchLocks = new Map<number, Promise<void>>();
  function withMatchLock<T>(tournamentId: number, fn: () => Promise<T>): Promise<T> {
    const existing = grandMatchLocks.get(tournamentId) || Promise.resolve();
    const next = existing.then(fn, fn);
    grandMatchLocks.set(tournamentId, next.then(() => {}, () => {}));
    return next;
  }
  const GRAND_EVENTS_ALL = [
    { id: "solo-quiz-championship", scope: "individual", gameMode: "quiz" },
    { id: "speed-science-sprint", scope: "individual", gameMode: "speed-round" },
    { id: "survival-showdown", scope: "individual", gameMode: "survival" },
    { id: "team-science-bowl", scope: "team", gameMode: "quiz" },
    { id: "lab-challenge-relay", scope: "team", gameMode: "lab-challenge" },
    { id: "boss-rush-relay", scope: "team", gameMode: "boss-rush" },
  ];

  const GRAND_PRIZES = {
    first: { coins: 5000, gems: 50, xp: 500 },
    second: { coins: 3000, gems: 30, xp: 300 },
    third: { coins: 1500, gems: 15, xp: 150 },
    participation: { coins: 200, gems: 0, xp: 50 },
  };

  async function ensureGrandTournamentsExist(month: string) {
    const existing = await storage.getGrandTournaments(month);
    if (existing.length > 0) return;
    for (const district of GRAND_DISTRICTS) {
      for (const event of GRAND_EVENTS_ALL) {
        await storage.createGrandTournament({
          month,
          status: "registration",
          phase: "group",
          district,
          eventType: event.id,
          scope: event.scope,
          groups: [],
          knockoutBracket: [],
          standings: [],
          currentRound: 0,
          totalGroupRounds: 5,
          prizes: GRAND_PRIZES,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  function getUserDistrict(user: any): string | null {
    const yl = user.yearLevel;
    if (yl >= 3 && yl <= 8) return `year-${yl}`;
    return null;
  }

  app.get("/api/grand-tournament", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const month = getCurrentMonth();
      await ensureGrandTournamentsExist(month);
      const tournaments = await storage.getGrandTournaments(month);
      const user = await storage.getUser(req.user!.id);
      const userDistrict = user ? getUserDistrict(user) : null;
      const result: any[] = [];
      for (const t of tournaments) {
        const entries = await storage.getGrandTournamentEntries(t.id);
        result.push({ ...t, entries, participantCount: entries.length });
      }

      const now = new Date();
      const nextTournamentStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
      const msUntilStart = nextTournamentStart.getTime() - now.getTime();

      const districtBattle: Record<string, { totalScore: number; playerCount: number; avgScore: number }> = {};
      const districtPlayers: Record<string, Set<number>> = {};
      for (const d of GRAND_DISTRICTS) {
        districtBattle[d] = { totalScore: 0, playerCount: 0, avgScore: 0 };
        districtPlayers[d] = new Set();
      }
      for (const t of result) {
        for (const entry of (t.entries || [])) {
          if (districtBattle[t.district]) {
            districtBattle[t.district].totalScore += entry.totalScore;
            if (entry.userId) districtPlayers[t.district].add(entry.userId);
          }
        }
      }
      for (const d of GRAND_DISTRICTS) {
        districtBattle[d].playerCount = districtPlayers[d].size;
        if (districtBattle[d].playerCount > 0) {
          districtBattle[d].avgScore = Math.round(districtBattle[d].totalScore / districtBattle[d].playerCount);
        }
      }

      res.json({ tournaments: result, currentMonth: month, userDistrict, msUntilStart, nextTournamentStart: nextTournamentStart.toISOString(), districtBattle });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch grand tournament" });
    }
  });

  app.get("/api/grand-tournament/standings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const month = getCurrentMonth();
      const district = req.query.district as string;
      const eventType = req.query.eventType as string;
      if (!district || !eventType) return res.status(400).json({ message: "district and eventType required" });

      const t = await storage.getGrandTournamentByKey(month, district, eventType);
      if (!t) return res.status(404).json({ message: "Tournament not found" });
      const entries = await storage.getGrandTournamentEntries(t.id);
      res.json({ tournament: t, entries });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch standings" });
    }
  });

  app.post("/api/grand-tournament/register", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { eventType } = req.body;
      if (!eventType) return res.status(400).json({ message: "eventType required" });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const district = getUserDistrict(user);
      if (!district) return res.status(400).json({ message: "Your year level (3-8) is required to join a district tournament" });

      const month = getCurrentMonth();
      await ensureGrandTournamentsExist(month);

      const eventDef = GRAND_EVENTS_ALL.find(e => e.id === eventType);
      if (!eventDef) return res.status(400).json({ message: "Invalid event type" });

      const t = await storage.getGrandTournamentByKey(month, district, eventType);
      if (!t) return res.status(404).json({ message: "Tournament not found for your district" });

      if (t.status !== "registration" && t.status !== "active") {
        return res.status(400).json({ message: "Registration is closed for this event" });
      }

      const existingEntry = await storage.getGrandTournamentEntryByUser(t.id, user.id);
      if (existingEntry) return res.status(400).json({ message: "Already registered for this event" });

      if (eventDef.scope === "team") {
        if (!user.teamId) return res.status(400).json({ message: "You must be in a team to enter team events" });
      }

      const entry = await storage.createGrandTournamentEntry({
        tournamentId: t.id,
        userId: user.id,
        username: user.username,
        teamId: eventDef.scope === "team" ? user.teamId : null,
        teamName: eventDef.scope === "team" ? (user as any).teamName || "Team" : null,
        groupIndex: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        totalScore: 0,
        matchesPlayed: 0,
        eliminated: false,
        knockoutSeed: null,
        finalRank: null,
      });

      res.json({ entry, message: "Registered for " + eventType });
    } catch (error) {
      res.status(500).json({ message: "Failed to register" });
    }
  });

  app.post("/api/grand-tournament/submit", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { eventType, score } = req.body;
      if (!eventType || score === undefined) return res.status(400).json({ message: "eventType and score required" });

      const numScore = Math.max(0, Math.min(Number(score) || 0, 500));

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const district = getUserDistrict(user);
      if (!district) return res.status(400).json({ message: "No district assigned" });

      const month = getCurrentMonth();
      const t = await storage.getGrandTournamentByKey(month, district, eventType);
      if (!t) return res.status(404).json({ message: "Tournament not found" });
      if (t.status === "registration") return res.status(400).json({ message: "Tournament hasn't started yet! Wait for the next tournament to begin." });
      if (t.status === "completed") return res.status(400).json({ message: "Tournament is completed" });
      if (t.phase === "knockout") return res.status(400).json({ message: "Group stage has ended. Knockout matches are managed separately." });

      const entry = await storage.getGrandTournamentEntryByUser(t.id, user.id);
      if (!entry) return res.status(400).json({ message: "Not registered for this event" });
      if (entry.matchesPlayed >= t.totalGroupRounds) return res.status(400).json({ message: "You have completed all group matches!" });
      if (entry.eliminated) return res.status(400).json({ message: "You have been eliminated" });
      if (entry.pendingScore !== null && entry.pendingScore !== undefined) return res.status(400).json({ message: "You already have a pending match! Waiting for an opponent..." });

      const result = await withMatchLock(t.id, async () => {
        const freshEntry = await storage.getGrandTournamentEntryByUser(t.id, user.id);
        if (!freshEntry || freshEntry.pendingScore !== null && freshEntry.pendingScore !== undefined) {
          return { error: "You already have a pending match! Waiting for an opponent..." };
        }

        const allEntries = await storage.getGrandTournamentEntries(t.id);
        const pendingOpponents = allEntries.filter(e =>
          e.id !== freshEntry.id &&
          e.pendingScore !== null &&
          e.pendingScore !== undefined &&
          !e.eliminated &&
          e.matchesPlayed < t.totalGroupRounds
        );

        if (pendingOpponents.length === 0) {
          await storage.updateGrandTournamentEntry(freshEntry.id, { pendingScore: numScore } as any);

          const xpGain = Math.floor(numScore / 5) + 10;
          const coinGain = Math.floor(numScore / 10) + 5;
          await storage.updateUser(user.id, {
            xp: user.xp + xpGain,
            coins: user.coins + coinGain,
            level: computeLevel(user.xp + xpGain),
          } as any);

          return {
            status: "pending",
            message: `Score submitted! Waiting for an opponent to be matched... (+${xpGain} XP, +${coinGain} coins)`,
            entry: { ...freshEntry, pendingScore: numScore },
            xpGain,
            coinGain,
          };
        }

        const userTournamentXp = user.tournamentXp || 0;
        const userTierIdx = getTournamentTierIndex(userTournamentXp);
        const opponentUsers = await Promise.all(pendingOpponents.map(async (op) => {
          if (!op.userId) return { ...op, tierIdx: 0 };
          const opUser = await storage.getUser(op.userId);
          return { ...op, tierIdx: opUser ? getTournamentTierIndex(opUser.tournamentXp || 0) : 0 };
        }));
        opponentUsers.sort((a, b) => {
          const tierDiffA = Math.abs(a.tierIdx - userTierIdx);
          const tierDiffB = Math.abs(b.tierIdx - userTierIdx);
          if (tierDiffA !== tierDiffB) return tierDiffA - tierDiffB;
          return Math.abs(a.wins - freshEntry.wins) - Math.abs(b.wins - freshEntry.wins);
        });
        const opponent = opponentUsers[0];

        const freshOpponent = await storage.getGrandTournamentEntry(opponent.id);
        if (!freshOpponent || freshOpponent.pendingScore === null || freshOpponent.pendingScore === undefined) {
          await storage.updateGrandTournamentEntry(freshEntry.id, { pendingScore: numScore } as any);
          const xpGain = Math.floor(numScore / 5) + 10;
          const coinGain = Math.floor(numScore / 10) + 5;
          await storage.updateUser(user.id, { xp: user.xp + xpGain, coins: user.coins + coinGain, level: computeLevel(user.xp + xpGain) } as any);
          return { status: "pending", message: `Score submitted! Waiting for an opponent... (+${xpGain} XP, +${coinGain} coins)`, entry: { ...freshEntry, pendingScore: numScore }, xpGain, coinGain };
        }

        const opponentScore = freshOpponent.pendingScore!;

        let myResult: "win" | "loss" | "draw";
        let oppResult: "win" | "loss" | "draw";
        if (numScore > opponentScore) { myResult = "win"; oppResult = "loss"; }
        else if (numScore < opponentScore) { myResult = "loss"; oppResult = "win"; }
        else { myResult = "draw"; oppResult = "draw"; }

        const myWins = freshEntry.wins + (myResult === "win" ? 1 : 0);
        const myLosses = freshEntry.losses + (myResult === "loss" ? 1 : 0);
        const myDraws = freshEntry.draws + (myResult === "draw" ? 1 : 0);
        const myPoints = (myWins * 3) + myDraws;
        const myMatchesPlayed = freshEntry.matchesPlayed + 1;
        const myTotalScore = freshEntry.totalScore + numScore;

        await storage.updateGrandTournamentEntry(freshEntry.id, {
          totalScore: myTotalScore, matchesPlayed: myMatchesPlayed, wins: myWins, losses: myLosses, draws: myDraws, points: myPoints, pendingScore: null,
        } as any);

        const oppWins = freshOpponent.wins + (oppResult === "win" ? 1 : 0);
        const oppLosses = freshOpponent.losses + (oppResult === "loss" ? 1 : 0);
        const oppDraws = freshOpponent.draws + (oppResult === "draw" ? 1 : 0);
        const oppPoints = (oppWins * 3) + oppDraws;
        const oppMatchesPlayed = freshOpponent.matchesPlayed + 1;
        const oppTotalScore = freshOpponent.totalScore + opponentScore;

        await storage.updateGrandTournamentEntry(freshOpponent.id, {
          totalScore: oppTotalScore, matchesPlayed: oppMatchesPlayed, wins: oppWins, losses: oppLosses, draws: oppDraws, points: oppPoints, pendingScore: null,
        } as any);

        const matchRecord = {
          round: myMatchesPlayed,
          player1: { entryId: freshEntry.id, username: freshEntry.username, score: numScore },
          player2: { entryId: freshOpponent.id, username: freshOpponent.username, score: opponentScore },
          result: myResult === "draw" ? "draw" : (myResult === "win" ? freshEntry.id : freshOpponent.id),
        };
        const freshTournament = await storage.getGrandTournament(t.id);
        const existingGroups = freshTournament ? (freshTournament.groups as any[]) || [] : [];
        await storage.updateGrandTournament(t.id, { groups: [...existingGroups, matchRecord] } as any);

        const xpGain = Math.floor(numScore / 5) + 20 + (myResult === "win" ? 10 : myResult === "draw" ? 5 : 0);
        const coinGain = Math.floor(numScore / 10) + 10 + (myResult === "win" ? 5 : 0);
        const tXpGain = Math.floor(xpGain * 0.4) + (myResult === "win" ? 15 : myResult === "draw" ? 5 : 2);
        await storage.updateUser(user.id, {
          xp: user.xp + xpGain, coins: user.coins + coinGain, level: computeLevel(user.xp + xpGain),
          tournamentXp: (user.tournamentXp || 0) + tXpGain,
        } as any);

        if (freshOpponent.userId) {
          const oppUser = await storage.getUser(freshOpponent.userId);
          if (oppUser) {
            const oppXpGain = Math.floor(opponentScore / 5) + 20 + (oppResult === "win" ? 10 : oppResult === "draw" ? 5 : 0);
            const oppCoinGain = Math.floor(opponentScore / 10) + 10 + (oppResult === "win" ? 5 : 0);
            const oppTXpGain = Math.floor(oppXpGain * 0.4) + (oppResult === "win" ? 15 : oppResult === "draw" ? 5 : 2);
            await storage.updateUser(oppUser.id, {
              xp: oppUser.xp + oppXpGain, coins: oppUser.coins + oppCoinGain, level: computeLevel(oppUser.xp + oppXpGain),
              tournamentXp: (oppUser.tournamentXp || 0) + oppTXpGain,
            } as any);
          }
        }

        const allEntriesNow = await storage.getGrandTournamentEntries(t.id);
        const allDone = allEntriesNow.every(e =>
          e.matchesPlayed >= t.totalGroupRounds && (e.pendingScore === null || e.pendingScore === undefined)
        );
        if (allDone && t.phase === "group") {
          const sorted = [...allEntriesNow].sort((a, b) => b.points - a.points || b.totalScore - a.totalScore);
          let topCount = Math.min(Math.max(Math.floor(sorted.length / 2), 2), 8);
          if (topCount % 2 !== 0 && topCount > 2) topCount--;
          if (topCount > sorted.length) topCount = sorted.length;
          const advancing = sorted.slice(0, topCount);
          const eliminated = sorted.slice(topCount);

          for (const e of eliminated) {
            await storage.updateGrandTournamentEntry(e.id, { eliminated: true, finalRank: topCount + 1 } as any);
          }
          for (let i = 0; i < advancing.length; i++) {
            await storage.updateGrandTournamentEntry(advancing[i].id, { knockoutSeed: i + 1 } as any);
          }

          function getRoundName(matchCount: number): string {
            if (matchCount <= 1) return "final";
            if (matchCount <= 2) return "semifinal";
            return "quarterfinal";
          }

          const bracket: any[] = [];
          const matchCount = Math.floor(advancing.length / 2);
          const roundName = getRoundName(matchCount);
          for (let i = 0; i < matchCount; i++) {
            bracket.push({
              round: roundName, match: i + 1,
              player1: { entryId: advancing[i].id, name: advancing[i].username, score: 0 },
              player2: { entryId: advancing[advancing.length - 1 - i].id, name: advancing[advancing.length - 1 - i].username, score: 0 },
              winner: null,
            });
          }

          await storage.updateGrandTournament(t.id, { phase: "knockout", knockoutBracket: bracket, status: "active" } as any);
        }

        const resultText = myResult === "win"
          ? `You beat ${freshOpponent.username}! (${numScore} vs ${opponentScore})`
          : myResult === "loss"
            ? `${freshOpponent.username} won! (${opponentScore} vs ${numScore})`
            : `Draw with ${freshOpponent.username}! (${numScore} vs ${opponentScore}) - Both advance!`;

        return {
          status: "matched",
          message: `${resultText} +${xpGain} XP, +${coinGain} coins`,
          matchResult: myResult,
          opponent: { username: freshOpponent.username, score: opponentScore },
          yourScore: numScore,
          entry: { ...freshEntry, totalScore: myTotalScore, matchesPlayed: myMatchesPlayed, wins: myWins, losses: myLosses, draws: myDraws, points: myPoints },
          xpGain,
          coinGain,
        };
      });

      if (result.error) return res.status(400).json({ message: result.error });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to submit score" });
    }
  });

  app.post("/api/grand-tournament/advance-knockout", requireAdmin, async (req, res) => {
    try {
      const { tournamentId } = req.body;
      const t = await storage.getGrandTournament(tournamentId);
      if (!t) return res.status(404).json({ message: "Tournament not found" });
      if (t.phase !== "knockout") return res.status(400).json({ message: "Not in knockout phase" });

      const bracket = t.knockoutBracket as any[];
      const currentMatches = bracket.filter((m: any) => !m.winner);

      if (currentMatches.length === 0) {
        await storage.updateGrandTournament(t.id, { status: "completed" } as any);

        const entries = await storage.getGrandTournamentEntries(t.id);
        const sorted = [...entries].sort((a, b) => b.points - a.points || b.totalScore - a.totalScore);
        const prizes = [GRAND_PRIZES.first, GRAND_PRIZES.second, GRAND_PRIZES.third];
        for (let i = 0; i < Math.min(3, sorted.length); i++) {
          const e = sorted[i];
          if (e.userId) {
            const u = await storage.getUser(e.userId);
            if (u) {
              await storage.updateUser(u.id, {
                coins: u.coins + prizes[i].coins,
                gems: u.gems + prizes[i].gems,
                xp: u.xp + prizes[i].xp,
                tournamentWins: i === 0 ? u.tournamentWins + 1 : u.tournamentWins,
              } as any);
            }
          }
          await storage.updateGrandTournamentEntry(e.id, { finalRank: i + 1 } as any);
        }
        for (let i = 3; i < sorted.length; i++) {
          const e = sorted[i];
          if (e.userId) {
            const u = await storage.getUser(e.userId);
            if (u) {
              await storage.updateUser(u.id, {
                coins: u.coins + GRAND_PRIZES.participation.coins,
                xp: u.xp + GRAND_PRIZES.participation.xp,
              } as any);
            }
          }
        }
        return res.json({ message: "Tournament completed! Prizes awarded." });
      }

      res.json({ message: "Knockout matches pending", pendingMatches: currentMatches.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to advance knockout" });
    }
  });

  // === DISTRICT BATTLES ===
  const DISTRICT_VS_PAIRS = [
    ["year-3", "year-4"], ["year-5", "year-6"], ["year-7", "year-8"],
    ["year-3", "year-6"], ["year-4", "year-7"], ["year-5", "year-8"],
  ];

  async function ensureDistrictBattlesExist(month: string) {
    const existing = await storage.getDistrictBattles(month);
    if (existing.length > 0) return;
    const now = new Date().toISOString();

    for (const evt of [
      { id: "district-quiz-war", type: "vs" },
      { id: "district-speed-clash", type: "vs" },
      { id: "district-survival-siege", type: "vs" },
    ]) {
      for (const [d1, d2] of DISTRICT_VS_PAIRS) {
        await storage.createDistrictBattle({
          month, battleType: "vs", eventId: evt.id, status: "active",
          district1: d1, district2: d2,
          district1Score: 0, district2Score: 0,
          district1Players: 0, district2Players: 0,
          winner: null, participants: [], topPlayers: [], createdAt: now,
        });
      }
    }

    for (const evt of [
      { id: "district-champion-cup" },
      { id: "district-speed-king" },
    ]) {
      for (const d of GRAND_DISTRICTS) {
        await storage.createDistrictBattle({
          month, battleType: "internal", eventId: evt.id, status: "active",
          district1: d, district2: null,
          district1Score: 0, district2Score: 0,
          district1Players: 0, district2Players: 0,
          winner: null, participants: [], topPlayers: [], createdAt: now,
        });
      }
    }

    await storage.createDistrictBattle({
      month, battleType: "grand", eventId: "grand-district-showdown", status: "active",
      district1: "all", district2: null,
      district1Score: 0, district2Score: 0,
      district1Players: 0, district2Players: 0,
      winner: null, participants: [], topPlayers: [], createdAt: now,
    });
  }

  app.get("/api/district-battles", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const month = getCurrentMonth();
      await ensureDistrictBattlesExist(month);
      const battles = await storage.getDistrictBattles(month);
      const user = await storage.getUser(req.user!.id);
      const userDistrict = user ? getUserDistrict(user) : null;
      res.json({ battles, userDistrict, month });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch district battles" });
    }
  });

  app.post("/api/district-battles/:id/submit", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const battle = await storage.getDistrictBattle(Number(req.params.id));
      if (!battle) return res.status(404).json({ message: "Battle not found" });
      if (battle.status !== "active") return res.status(400).json({ message: "Battle is not active" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const userDistrict = getUserDistrict(user);
      if (!userDistrict) return res.status(400).json({ message: "You need a valid year level (3-8)" });

      const score = Math.max(0, Math.min(500, Number(req.body.score) || 0));
      const participants = (battle.participants as any[]) || [];

      const existingIdx = participants.findIndex((p: any) => p.userId === user.id);
      if (existingIdx >= 0) {
        if (score > participants[existingIdx].score) {
          participants[existingIdx].score = score;
        } else {
          return res.json({ message: "Score not high enough to update", battle });
        }
      } else {
        participants.push({ userId: user.id, username: user.username, district: userDistrict, score });
      }

      if (battle.battleType === "vs") {
        if (userDistrict !== battle.district1 && userDistrict !== battle.district2) {
          return res.status(400).json({ message: "You are not in either district for this battle" });
        }
        const d1Players = participants.filter((p: any) => p.district === battle.district1);
        const d2Players = participants.filter((p: any) => p.district === battle.district2);
        const d1Score = d1Players.reduce((s: number, p: any) => s + p.score, 0);
        const d2Score = d2Players.reduce((s: number, p: any) => s + p.score, 0);
        await storage.updateDistrictBattle(battle.id, {
          participants,
          district1Score: d1Score,
          district2Score: d2Score,
          district1Players: d1Players.length,
          district2Players: d2Players.length,
        } as any);
      } else if (battle.battleType === "internal") {
        if (userDistrict !== battle.district1) {
          return res.status(400).json({ message: "You are not in this district" });
        }
        const totalScore = participants.reduce((s: number, p: any) => s + p.score, 0);
        const sorted = [...participants].sort((a: any, b: any) => b.score - a.score);
        await storage.updateDistrictBattle(battle.id, {
          participants,
          district1Score: totalScore,
          district1Players: participants.length,
          topPlayers: sorted.slice(0, 10),
        } as any);
      } else if (battle.battleType === "grand") {
        const allBattles = await storage.getDistrictBattles(battle.month);
        const internalBattles = allBattles.filter((b: any) => b.battleType === "internal");
        const qualifiedUsers = new Set<number>();
        for (const ib of internalBattles) {
          const ibParticipants = (ib.topPlayers as any[]) || [];
          ibParticipants.slice(0, 5).forEach((p: any) => qualifiedUsers.add(p.userId));
        }
        if (qualifiedUsers.size > 0 && !qualifiedUsers.has(user.id)) {
          return res.status(400).json({ message: "Only the top 5 players from each district's internal battles qualify for the Grand District Showdown!" });
        }

        const topByDistrict: Record<string, any[]> = {};
        for (const p of participants) {
          if (!topByDistrict[p.district]) topByDistrict[p.district] = [];
          topByDistrict[p.district].push(p);
        }
        const grandTop: any[] = [];
        for (const [dist, players] of Object.entries(topByDistrict)) {
          const sorted = players.sort((a: any, b: any) => b.score - a.score).slice(0, 5);
          grandTop.push(...sorted.map((p: any) => ({ ...p, districtRank: sorted.indexOf(p) + 1 })));
        }
        grandTop.sort((a: any, b: any) => b.score - a.score);
        await storage.updateDistrictBattle(battle.id, {
          participants,
          topPlayers: grandTop,
          district1Players: participants.length,
        } as any);
      }

      await storage.updateUser(user.id, {
        coins: user.coins + 25,
        xp: user.xp + 15,
      } as any);

      const updated = await storage.getDistrictBattle(battle.id);
      res.json({ message: "Score submitted!", battle: updated });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit score" });
    }
  });

  app.get("/api/tournament-rankings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const leaderboardUsers = await storage.getTournamentLeaderboard(100);
      const rankings = leaderboardUsers
        .map((u: any) => ({
          id: u.id,
          username: u.username,
          tournamentXp: u.tournamentXp || 0,
          tournamentWins: u.tournamentWins || 0,
          tierIndex: getTournamentTierIndex(u.tournamentXp || 0),
        }))
        .sort((a: any, b: any) => b.tournamentXp - a.tournamentXp)
        .slice(0, 100);

      const currentUser = await storage.getUser(req.user!.id);
      const myRank = currentUser ? {
        id: currentUser.id,
        username: currentUser.username,
        tournamentXp: currentUser.tournamentXp || 0,
        tournamentWins: currentUser.tournamentWins || 0,
        tierIndex: getTournamentTierIndex(currentUser.tournamentXp || 0),
      } : null;

      res.json({ rankings, myRank });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tournament rankings" });
    }
  });

  app.get("/api/tournament-topic-banks", requireAdmin, async (_req, res) => {
    res.json(TOPIC_QUESTION_BANKS);
  });

  app.get("/api/schools", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const allSchools = await storage.getSchools();
      res.json(allSchools);
    } catch { res.status(500).json({ message: "Failed to fetch schools" }); }
  });

  app.delete("/api/schools/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (!user.isAdmin) return res.status(403).json({ message: "Admins only" });
    try {
      await storage.deleteSchool(Number(req.params.id));
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to delete school" }); }
  });

  app.post("/api/schools/:id/join", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (!(user as any).isTeacher && !user.isAdmin) return res.status(403).json({ message: "Teachers only" });
    try {
      const school = await storage.getSchool(Number(req.params.id));
      if (!school) return res.status(404).json({ message: "School not found" });
      await storage.updateUser(user.id, { schoolId: school.id } as any);
      res.json({ success: true, schoolName: school.name });
    } catch { res.status(500).json({ message: "Failed to join school" }); }
  });

  app.post("/api/schools", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (!user.isAdmin) return res.status(403).json({ message: "Admins only" });
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ message: "School name required" });
      const school = await storage.createSchool({ name: name.trim(), createdBy: user.id, createdAt: new Date().toISOString().slice(0, 10) });
      res.status(201).json(school);
    } catch (e: any) {
      if (e.code === "23505") return res.status(400).json({ message: "School name already exists" });
      res.status(500).json({ message: "Failed to create school" });
    }
  });

  app.get("/api/classes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const schoolId = req.query.schoolId ? Number(req.query.schoolId) : undefined;
      const allClasses = await storage.getClasses(schoolId);
      res.json(allClasses.map(c => ({ ...c, password: undefined })));
    } catch { res.status(500).json({ message: "Failed to fetch classes" }); }
  });

  app.post("/api/classes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (!(user as any).isTeacher && !user.isAdmin) return res.status(403).json({ message: "Teachers only" });
    try {
      const { name, password, schoolId, description } = req.body;
      if (!name || !password) return res.status(400).json({ message: "Name and password required" });
      const cls = await storage.createClass({
        name: name.trim(),
        password: password.trim(),
        schoolId: schoolId ? Number(schoolId) : null,
        teacherId: user.id,
        teacherName: user.username,
        description: description || "",
        createdAt: new Date().toISOString().slice(0, 10),
      } as any);
      res.status(201).json({ ...cls, password: undefined });
    } catch { res.status(500).json({ message: "Failed to create class" }); }
  });

  app.get("/api/classes/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const cls = await storage.getClass(Number(req.params.id));
      if (!cls) return res.status(404).json({ message: "Class not found" });
      const members = await storage.getClassMembers(cls.id);
      res.json({ ...cls, password: undefined, members: members.map(m => ({ id: m.id, username: m.username, xp: m.xp, level: m.level, gameScores: m.gameScores })) });
    } catch { res.status(500).json({ message: "Failed to fetch class" }); }
  });

  app.post("/api/classes/:id/join", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      const cls = await storage.getClass(Number(req.params.id));
      if (!cls) return res.status(404).json({ message: "Class not found" });
      const { password } = req.body;
      if (!password || password.trim() !== cls.password) return res.status(403).json({ message: "Incorrect class password" });
      const bannedList = ((cls as any).bannedMembers || []) as { userId: number }[];
      if (bannedList.find(b => b.userId === user.id)) return res.status(403).json({ message: "You have been banned from this class by the teacher." });
      await storage.updateUser(user.id, { classId: cls.id, schoolId: cls.schoolId ?? undefined } as any);
      res.json({ success: true, className: cls.name });
    } catch { res.status(500).json({ message: "Failed to join class" }); }
  });

  app.post("/api/classes/:id/leave", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      await storage.updateUser(user.id, { classId: null, schoolId: null } as any);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to leave class" }); }
  });

  app.post("/api/classes/:id/ban/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      const cls = await storage.getClass(Number(req.params.id));
      if (!cls) return res.status(404).json({ message: "Class not found" });
      if (cls.teacherId !== user.id && !user.isAdmin) return res.status(403).json({ message: "Teachers only" });
      const targetId = Number(req.params.userId);
      if (targetId === cls.teacherId) return res.status(400).json({ message: "Cannot ban the teacher" });
      const target = await storage.getUser(targetId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const banned = ((cls as any).bannedMembers || []) as { userId: number; username: string }[];
      if (!banned.find(b => b.userId === targetId)) {
        banned.push({ userId: targetId, username: target.username });
        await storage.updateClass(cls.id, { bannedMembers: banned });
      }
      if (target.classId === cls.id) await storage.updateUser(targetId, { classId: null } as any);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to ban student" }); }
  });

  app.post("/api/classes/:id/unban/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      const cls = await storage.getClass(Number(req.params.id));
      if (!cls) return res.status(404).json({ message: "Class not found" });
      if (cls.teacherId !== user.id && !user.isAdmin) return res.status(403).json({ message: "Teachers only" });
      const targetId = Number(req.params.userId);
      const banned = ((cls as any).bannedMembers || []) as { userId: number; username: string }[];
      const updated = banned.filter(b => b.userId !== targetId);
      await storage.updateClass(cls.id, { bannedMembers: updated });
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to unban student" }); }
  });

  app.get("/api/classes/:id/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      const cls = await storage.getClass(Number(req.params.id));
      if (!cls) return res.status(404).json({ message: "Class not found" });
      if (cls.teacherId !== user.id && !user.isAdmin) return res.status(403).json({ message: "Not authorized" });
      res.json({ password: cls.password });
    } catch { res.status(500).json({ message: "Failed to get password" }); }
  });

  app.delete("/api/classes/:id/members/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      const cls = await storage.getClass(Number(req.params.id));
      if (!cls) return res.status(404).json({ message: "Class not found" });
      if (cls.teacherId !== user.id && !user.isAdmin) return res.status(403).json({ message: "Only the class teacher can kick students" });
      const targetId = Number(req.params.userId);
      if (targetId === cls.teacherId) return res.status(400).json({ message: "Cannot remove the teacher" });
      await storage.updateUser(targetId, { classId: null } as any);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to kick student" }); }
  });

  app.delete("/api/classes/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      const cls = await storage.getClass(Number(req.params.id));
      if (!cls) return res.status(404).json({ message: "Class not found" });
      if (cls.teacherId !== user.id && !user.isAdmin) return res.status(403).json({ message: "Only the class teacher can delete this class" });
      await storage.deleteClass(cls.id);
      const members = await storage.getClassMembers(cls.id);
      for (const m of members) {
        await storage.updateUser(m.id, { classId: null } as any);
      }
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to delete class" }); }
  });

  const ITEM_UPGRADE_COSTS: Record<number, number> = { 1: 200, 2: 500 };
  const ITEM_MAX_LEVEL = 2;

  app.post("/api/shop/upgrade-item/:itemId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      const { itemId } = req.params;
      const inventory = user.inventory || [];
      const userPotionsArr = (user.potions as string[]) || [];
      if (!inventory.includes(itemId) && !userPotionsArr.includes(itemId)) return res.status(400).json({ message: "You don't own this item" });
      const itemLevels = ((user as any).itemLevels || {}) as Record<string, number>;
      const currentLevel = itemLevels[itemId] || 0;
      if (currentLevel >= ITEM_MAX_LEVEL) return res.status(400).json({ message: "Item already at max level!" });
      const nextLevel = currentLevel + 1;
      const cost = ITEM_UPGRADE_COSTS[nextLevel];
      if ((user.coins || 0) < cost) return res.status(400).json({ message: `Not enough coins! Need ${cost} coins.` });
      const newItemLevels = { ...itemLevels, [itemId]: nextLevel };
      await storage.updateUser(user.id, { coins: user.coins - cost, itemLevels: newItemLevels } as any);
      res.json({ success: true, newLevel: nextLevel, coinsSpent: cost });
    } catch { res.status(500).json({ message: "Failed to upgrade item" }); }
  });

  app.get("/api/leaderboard/class/:classId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const members = await storage.getClassMembers(Number(req.params.classId));
      const sorted = members.sort((a, b) => (b.xp || 0) - (a.xp || 0));
      res.json(sorted.map(u => ({ id: u.id, username: u.username, xp: u.xp, level: u.level, coins: u.coins })));
    } catch { res.status(500).json({ message: "Failed to fetch class leaderboard" }); }
  });

  return httpServer;
}

const TOPIC_QUESTION_BANKS: Record<string, { topic: string; questions: any[] }> = {
  "space": {
    topic: "Space & Astronomy",
    questions: [
      { question: "What planet is closest to the Sun?", options: ["Venus", "Earth", "Mercury", "Mars"], correctIndex: 2, explanation: "Mercury orbits closest to the Sun at about 58 million km." },
      { question: "What is the largest planet in our solar system?", options: ["Saturn", "Jupiter", "Neptune", "Uranus"], correctIndex: 1, explanation: "Jupiter is over 11 times wider than Earth!" },
      { question: "What galaxy do we live in?", options: ["Andromeda", "Milky Way", "Triangulum", "Whirlpool"], correctIndex: 1, explanation: "Our solar system is in the Milky Way galaxy." },
      { question: "How long does it take sunlight to reach Earth?", options: ["8 seconds", "8 minutes", "8 hours", "80 minutes"], correctIndex: 1, explanation: "Light from the Sun takes about 8 minutes and 20 seconds." },
      { question: "Which planet has the most moons?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], correctIndex: 1, explanation: "Saturn has over 140 confirmed moons!" },
      { question: "What is a light-year a measure of?", options: ["Time", "Distance", "Speed", "Brightness"], correctIndex: 1, explanation: "A light-year measures the distance light travels in one year." },
      { question: "What planet is known as the Red Planet?", options: ["Venus", "Jupiter", "Mars", "Mercury"], correctIndex: 2, explanation: "Mars appears red due to iron oxide (rust) on its surface." },
      { question: "What causes a solar eclipse?", options: ["Earth blocks the Sun", "Moon blocks the Sun", "Sun goes dark", "Clouds block the Sun"], correctIndex: 1, explanation: "The Moon passes between Earth and the Sun during a solar eclipse." },
      { question: "What is the hottest planet in our solar system?", options: ["Mercury", "Venus", "Mars", "Jupiter"], correctIndex: 1, explanation: "Venus is hottest due to its thick greenhouse atmosphere (460°C)." },
      { question: "What are Saturn's rings mainly made of?", options: ["Gas", "Dust", "Ice and rock", "Lava"], correctIndex: 2, explanation: "Saturn's rings are mostly ice particles and rocky debris." },
    ]
  },
  "biology": {
    topic: "Biology & Life Science",
    questions: [
      { question: "What is the powerhouse of the cell?", options: ["Nucleus", "Mitochondria", "Ribosome", "Cell membrane"], correctIndex: 1, explanation: "Mitochondria produce energy (ATP) for the cell." },
      { question: "What is the largest organ in the human body?", options: ["Heart", "Brain", "Liver", "Skin"], correctIndex: 3, explanation: "Skin covers the entire body and is the largest organ." },
      { question: "How many bones does an adult human have?", options: ["106", "206", "306", "406"], correctIndex: 1, explanation: "Adults have 206 bones in their skeleton." },
      { question: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], correctIndex: 2, explanation: "Plants use CO2 in photosynthesis to make food." },
      { question: "What carries oxygen in your blood?", options: ["White blood cells", "Plasma", "Red blood cells", "Platelets"], correctIndex: 2, explanation: "Red blood cells contain haemoglobin which binds to oxygen." },
      { question: "What is the process plants use to make food?", options: ["Respiration", "Digestion", "Photosynthesis", "Fermentation"], correctIndex: 2, explanation: "Photosynthesis uses sunlight, water, and CO2 to make glucose." },
      { question: "How many chambers does the human heart have?", options: ["2", "3", "4", "6"], correctIndex: 2, explanation: "The heart has 4 chambers: 2 atria and 2 ventricles." },
      { question: "What part of the cell contains DNA?", options: ["Mitochondria", "Ribosome", "Nucleus", "Cell wall"], correctIndex: 2, explanation: "The nucleus stores the cell's genetic material (DNA)." },
      { question: "What is the smallest bone in the human body?", options: ["Femur", "Stapes", "Patella", "Radius"], correctIndex: 1, explanation: "The stapes (stirrup bone) in the ear is only 3mm long!" },
      { question: "What type of animal is a frog?", options: ["Reptile", "Mammal", "Amphibian", "Fish"], correctIndex: 2, explanation: "Frogs are amphibians — they live on land and in water." },
    ]
  },
  "chemistry": {
    topic: "Chemistry & Elements",
    questions: [
      { question: "What is the chemical symbol for water?", options: ["O2", "H2O", "CO2", "NaCl"], correctIndex: 1, explanation: "Water is two hydrogen atoms and one oxygen atom: H₂O." },
      { question: "What element has the atomic number 1?", options: ["Helium", "Oxygen", "Hydrogen", "Carbon"], correctIndex: 2, explanation: "Hydrogen is the simplest and lightest element." },
      { question: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], correctIndex: 2, explanation: "Au comes from the Latin word 'aurum' meaning gold." },
      { question: "What gas makes up most of Earth's atmosphere?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], correctIndex: 2, explanation: "Nitrogen makes up about 78% of Earth's atmosphere." },
      { question: "What pH number is neutral?", options: ["0", "7", "10", "14"], correctIndex: 1, explanation: "A pH of 7 is neutral — neither acidic nor alkaline." },
      { question: "What is table salt's chemical name?", options: ["Sodium chloride", "Potassium bromide", "Calcium carbonate", "Magnesium sulfate"], correctIndex: 0, explanation: "Table salt is sodium chloride (NaCl)." },
      { question: "What state of matter has no fixed shape or volume?", options: ["Solid", "Liquid", "Gas", "Plasma"], correctIndex: 2, explanation: "Gas particles move freely and fill any container." },
      { question: "What is the most abundant element in the universe?", options: ["Oxygen", "Carbon", "Helium", "Hydrogen"], correctIndex: 3, explanation: "Hydrogen makes up about 75% of all matter in the universe." },
      { question: "What happens when you mix an acid and a base?", options: ["Explosion", "Neutralisation", "Freezing", "Evaporation"], correctIndex: 1, explanation: "An acid + a base produces a salt and water (neutralisation)." },
      { question: "What are the three states of matter?", options: ["Hot, warm, cold", "Solid, liquid, gas", "Metal, plastic, wood", "Big, medium, small"], correctIndex: 1, explanation: "Matter exists as solids, liquids, and gases." },
    ]
  },
  "physics": {
    topic: "Physics & Forces",
    questions: [
      { question: "What force pulls objects toward Earth?", options: ["Magnetism", "Friction", "Gravity", "Inertia"], correctIndex: 2, explanation: "Gravity attracts objects with mass toward each other." },
      { question: "What is the speed of light?", options: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000 km/s"], correctIndex: 0, explanation: "Light travels at approximately 300,000 kilometres per second." },
      { question: "What unit is used to measure force?", options: ["Joule", "Watt", "Newton", "Volt"], correctIndex: 2, explanation: "Force is measured in Newtons, named after Isaac Newton." },
      { question: "What type of energy does a moving object have?", options: ["Potential", "Kinetic", "Thermal", "Chemical"], correctIndex: 1, explanation: "Kinetic energy is the energy of motion." },
      { question: "What does a prism do to white light?", options: ["Makes it brighter", "Splits it into colours", "Turns it off", "Makes it white"], correctIndex: 1, explanation: "A prism separates white light into the visible spectrum (rainbow)." },
      { question: "What is the unit of electrical resistance?", options: ["Ampere", "Volt", "Ohm", "Watt"], correctIndex: 2, explanation: "Resistance is measured in Ohms." },
      { question: "What travels faster: light or sound?", options: ["Sound", "Light", "They're the same", "It depends"], correctIndex: 1, explanation: "Light travels at 300,000 km/s vs sound at about 343 m/s." },
      { question: "What force slows down moving objects?", options: ["Gravity", "Magnetism", "Friction", "Thrust"], correctIndex: 2, explanation: "Friction opposes motion when surfaces rub together." },
      { question: "What is the formula for speed?", options: ["Force x Mass", "Distance / Time", "Mass x Volume", "Energy / Power"], correctIndex: 1, explanation: "Speed = Distance / Time." },
      { question: "What type of circuit has only one path for electricity?", options: ["Parallel", "Complex", "Series", "Open"], correctIndex: 2, explanation: "A series circuit has a single loop for current to flow through." },
    ]
  },
  "earth": {
    topic: "Earth Science & Geology",
    questions: [
      { question: "What type of rock is formed from cooled lava?", options: ["Sedimentary", "Metamorphic", "Igneous", "Limestone"], correctIndex: 2, explanation: "Igneous rocks form when molten rock (magma/lava) solidifies." },
      { question: "What layer of Earth do we live on?", options: ["Mantle", "Core", "Crust", "Asthenosphere"], correctIndex: 2, explanation: "The crust is Earth's thin outermost layer." },
      { question: "What causes earthquakes?", options: ["Wind", "Rain", "Tectonic plates moving", "Moon's gravity"], correctIndex: 2, explanation: "Earthquakes happen when tectonic plates shift and release energy." },
      { question: "What is the water cycle?", options: ["Water flowing downhill", "Evaporation, condensation, precipitation", "Tides rising and falling", "Rivers flowing to the sea"], correctIndex: 1, explanation: "The water cycle moves water between Earth's surface and atmosphere." },
      { question: "What causes the seasons on Earth?", options: ["Distance from Sun", "Earth's tilted axis", "Moon's orbit", "Ocean currents"], correctIndex: 1, explanation: "Earth's 23.5 degree axial tilt causes different parts to receive more sunlight." },
      { question: "What is a fossil?", options: ["A living organism", "Preserved remains of ancient life", "A type of mineral", "A volcanic rock"], correctIndex: 1, explanation: "Fossils are preserved remains or traces of organisms from the past." },
      { question: "What is the hardest natural mineral?", options: ["Quartz", "Topaz", "Diamond", "Ruby"], correctIndex: 2, explanation: "Diamond scores 10 on the Mohs hardness scale." },
      { question: "What type of rock is formed from layers of sediment?", options: ["Igneous", "Metamorphic", "Sedimentary", "Volcanic"], correctIndex: 2, explanation: "Sedimentary rocks form from compressed layers of sand, mud, or shells." },
      { question: "What is magma called when it reaches Earth's surface?", options: ["Granite", "Lava", "Obsidian", "Pumice"], correctIndex: 1, explanation: "Magma that erupts onto the surface is called lava." },
      { question: "What percentage of Earth's surface is covered by water?", options: ["50%", "60%", "71%", "85%"], correctIndex: 2, explanation: "About 71% of Earth's surface is covered by oceans and water." },
    ]
  },
  "animals": {
    topic: "Animals & Ecosystems",
    questions: [
      { question: "What is a group of wolves called?", options: ["Herd", "Flock", "Pack", "Swarm"], correctIndex: 2, explanation: "Wolves live and hunt in social groups called packs." },
      { question: "What is the fastest land animal?", options: ["Lion", "Cheetah", "Horse", "Greyhound"], correctIndex: 1, explanation: "Cheetahs can reach speeds of up to 112 km/h!" },
      { question: "What do herbivores eat?", options: ["Meat", "Plants", "Both", "Insects"], correctIndex: 1, explanation: "Herbivores eat only plant-based food." },
      { question: "How do fish breathe?", options: ["Lungs", "Skin", "Gills", "Nose"], correctIndex: 2, explanation: "Fish extract oxygen from water using their gills." },
      { question: "What is the largest animal ever to have lived?", options: ["African elephant", "T-Rex", "Blue whale", "Megalodon"], correctIndex: 2, explanation: "Blue whales can grow up to 30 metres long!" },
      { question: "What is the process of a caterpillar becoming a butterfly?", options: ["Evolution", "Metamorphosis", "Mutation", "Adaptation"], correctIndex: 1, explanation: "Metamorphosis is the dramatic transformation from larva to adult." },
      { question: "What animal can change its colour to blend in?", options: ["Parrot", "Chameleon", "Flamingo", "Toucan"], correctIndex: 1, explanation: "Chameleons change colour for camouflage and communication." },
      { question: "What is a baby kangaroo called?", options: ["Cub", "Kit", "Joey", "Pup"], correctIndex: 2, explanation: "Baby kangaroos are called joeys and grow in their mother's pouch." },
      { question: "Which animal has the longest lifespan?", options: ["Elephant", "Giant tortoise", "Whale", "Parrot"], correctIndex: 1, explanation: "Giant tortoises can live over 150 years!" },
      { question: "What is an animal that hunts others for food called?", options: ["Prey", "Predator", "Scavenger", "Herbivore"], correctIndex: 1, explanation: "Predators are animals that hunt and eat other animals." },
    ]
  },
  "human-body": {
    topic: "Human Body & Health",
    questions: [
      { question: "What organ pumps blood around the body?", options: ["Brain", "Lungs", "Heart", "Liver"], correctIndex: 2, explanation: "The heart pumps blood through your circulatory system." },
      { question: "What system protects the body from disease?", options: ["Nervous", "Immune", "Digestive", "Skeletal"], correctIndex: 1, explanation: "The immune system fights off infections and diseases." },
      { question: "What vitamin do you get from sunlight?", options: ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin B12"], correctIndex: 2, explanation: "Your skin produces Vitamin D when exposed to sunlight." },
      { question: "How many teeth does an adult human have?", options: ["20", "28", "32", "36"], correctIndex: 2, explanation: "Adults have 32 teeth including wisdom teeth." },
      { question: "What is the largest muscle in the body?", options: ["Bicep", "Heart", "Gluteus maximus", "Quadricep"], correctIndex: 2, explanation: "The gluteus maximus (buttock muscle) is the body's largest muscle." },
      { question: "What part of the brain controls balance?", options: ["Cerebrum", "Cerebellum", "Brain stem", "Hippocampus"], correctIndex: 1, explanation: "The cerebellum coordinates movement and balance." },
      { question: "What do white blood cells do?", options: ["Carry oxygen", "Fight infections", "Clot blood", "Digest food"], correctIndex: 1, explanation: "White blood cells are part of your immune system." },
      { question: "Which organ filters waste from the blood?", options: ["Heart", "Stomach", "Kidneys", "Lungs"], correctIndex: 2, explanation: "Kidneys filter waste products and excess water from the blood." },
      { question: "What makes up about 60% of your body?", options: ["Bones", "Muscle", "Water", "Fat"], correctIndex: 2, explanation: "The human body is approximately 60% water." },
      { question: "What connects muscles to bones?", options: ["Ligaments", "Tendons", "Cartilage", "Nerves"], correctIndex: 1, explanation: "Tendons are strong cords that connect muscles to bones." },
    ]
  },
  "energy": {
    topic: "Energy & Electricity",
    questions: [
      { question: "What type of energy comes from the Sun?", options: ["Kinetic", "Chemical", "Solar", "Nuclear"], correctIndex: 2, explanation: "The Sun provides solar energy through light and heat." },
      { question: "What is a renewable energy source?", options: ["Coal", "Oil", "Wind", "Natural gas"], correctIndex: 2, explanation: "Wind energy is renewable — it won't run out." },
      { question: "What unit is electricity measured in?", options: ["Newtons", "Watts", "Litres", "Metres"], correctIndex: 1, explanation: "Electrical power is measured in Watts." },
      { question: "What material is a good conductor of electricity?", options: ["Wood", "Rubber", "Copper", "Glass"], correctIndex: 2, explanation: "Copper is an excellent conductor used in most electrical wiring." },
      { question: "What does a battery convert chemical energy into?", options: ["Heat", "Light", "Electrical", "Sound"], correctIndex: 2, explanation: "Batteries convert stored chemical energy into electrical energy." },
      { question: "What type of energy is stored in food?", options: ["Kinetic", "Thermal", "Chemical", "Electrical"], correctIndex: 2, explanation: "Food stores chemical energy that your body converts to fuel." },
      { question: "What is an insulator?", options: ["Lets electricity flow", "Blocks electricity", "Creates electricity", "Stores electricity"], correctIndex: 1, explanation: "Insulators like rubber and plastic block the flow of electricity." },
      { question: "What energy transformation happens in a light bulb?", options: ["Light to heat", "Electrical to light", "Chemical to light", "Sound to light"], correctIndex: 1, explanation: "Light bulbs convert electrical energy into light (and some heat)." },
      { question: "What is the main source of energy for life on Earth?", options: ["Moon", "Wind", "Sun", "Volcanoes"], correctIndex: 2, explanation: "Nearly all life on Earth depends on energy from the Sun." },
      { question: "What is geothermal energy?", options: ["Energy from the Sun", "Energy from wind", "Heat from inside Earth", "Energy from water"], correctIndex: 2, explanation: "Geothermal energy comes from heat deep within the Earth." },
    ]
  },
  "weather": {
    topic: "Weather & Climate",
    questions: [
      { question: "What instrument measures air temperature?", options: ["Barometer", "Thermometer", "Anemometer", "Hygrometer"], correctIndex: 1, explanation: "A thermometer measures how hot or cold the air is." },
      { question: "What causes thunder?", options: ["Clouds colliding", "Rapid air expansion from lightning", "Wind", "Rain"], correctIndex: 1, explanation: "Lightning heats air so fast it expands, creating a shockwave (thunder)." },
      { question: "What type of cloud produces thunderstorms?", options: ["Cirrus", "Stratus", "Cumulonimbus", "Cumulus"], correctIndex: 2, explanation: "Cumulonimbus clouds are tall, dark storm clouds." },
      { question: "What does a barometer measure?", options: ["Temperature", "Wind speed", "Air pressure", "Humidity"], correctIndex: 2, explanation: "A barometer measures atmospheric (air) pressure." },
      { question: "What is the water cycle powered by?", options: ["Moon", "Wind", "Sun's heat", "Earth's rotation"], correctIndex: 2, explanation: "The Sun's heat drives evaporation, which powers the water cycle." },
      { question: "What is the greenhouse effect?", options: ["Plants growing in glass houses", "Gases trapping heat in the atmosphere", "Green light from the Sun", "Forests cooling the Earth"], correctIndex: 1, explanation: "Greenhouse gases trap heat, warming Earth's surface." },
      { question: "What scale measures wind speed?", options: ["Richter", "Beaufort", "Mohs", "Kelvin"], correctIndex: 1, explanation: "The Beaufort scale rates wind from 0 (calm) to 12 (hurricane)." },
      { question: "What is precipitation?", options: ["Evaporation", "Water falling from clouds", "Cloud formation", "Wind"], correctIndex: 1, explanation: "Precipitation is rain, snow, sleet, or hail falling from clouds." },
      { question: "What causes a rainbow?", options: ["Magic", "Light refracting through water droplets", "Coloured clouds", "Wind mixing gases"], correctIndex: 1, explanation: "Sunlight splits into colours when it passes through water droplets." },
      { question: "What is the ozone layer?", options: ["A cloud layer", "A protective gas layer", "Part of the ocean", "A type of wind"], correctIndex: 1, explanation: "The ozone layer absorbs harmful ultraviolet radiation from the Sun." },
    ]
  },
  "ocean": {
    topic: "Oceans & Marine Life",
    questions: [
      { question: "What percentage of Earth's water is salt water?", options: ["50%", "71%", "85%", "97%"], correctIndex: 3, explanation: "About 97% of all water on Earth is salt water in the oceans." },
      { question: "What is the deepest part of the ocean?", options: ["Mid-Atlantic Ridge", "Great Barrier Reef", "Mariana Trench", "Bermuda Triangle"], correctIndex: 2, explanation: "The Mariana Trench reaches nearly 11,000 metres deep!" },
      { question: "What causes ocean tides?", options: ["Wind", "Fish", "Moon's gravity", "Earthquakes"], correctIndex: 2, explanation: "The gravitational pull of the Moon (and Sun) creates tides." },
      { question: "What is coral made of?", options: ["Plants", "Rocks", "Tiny animals", "Sand"], correctIndex: 2, explanation: "Coral is made of tiny animals called polyps that build hard skeletons." },
      { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], correctIndex: 2, explanation: "The Pacific Ocean covers more area than all land on Earth combined!" },
      { question: "How do dolphins breathe?", options: ["Gills", "Lungs", "Skin", "Mouth"], correctIndex: 1, explanation: "Dolphins are mammals — they breathe air through a blowhole." },
      { question: "What is bioluminescence?", options: ["Glow-in-the-dark paint", "Living things producing light", "Moonlight reflection", "Underwater fire"], correctIndex: 1, explanation: "Some sea creatures produce their own light through chemical reactions." },
      { question: "What ocean current keeps Europe warm?", options: ["Kuroshio", "Gulf Stream", "Antarctic Current", "Humboldt"], correctIndex: 1, explanation: "The Gulf Stream carries warm water from the Gulf of Mexico to Europe." },
      { question: "What is phytoplankton?", options: ["A type of whale", "Tiny ocean plants", "A coral species", "Sea foam"], correctIndex: 1, explanation: "Phytoplankton are microscopic plants that produce about 50% of Earth's oxygen!" },
      { question: "What is an estuary?", options: ["A deep ocean trench", "Where a river meets the sea", "An underwater volcano", "A coral reef"], correctIndex: 1, explanation: "An estuary is where freshwater rivers meet and mix with salt water." },
    ]
  },
};

const TOURNAMENT_TIER_THRESHOLDS = [0, 100, 300, 600, 1000, 1600, 2500, 3800, 5500, 8000, 12000, 20000];
function getTournamentTierIndex(xp: number): number {
  let idx = 0;
  for (let i = 0; i < TOURNAMENT_TIER_THRESHOLDS.length; i++) {
    if (xp >= TOURNAMENT_TIER_THRESHOLDS[i]) idx = i;
    else break;
  }
  return idx;
}

function computeLevel(xp: number): number {
  if (typeof xp !== 'number' || isNaN(xp) || xp <= 0) return 1;
  return Math.max(1, Math.floor((125 + Math.sqrt(625 + 300 * xp)) / 150));
}
