// Shared dimension config — imported by BOTH the client (rendering/gameplay) and
// the server (entry-sacrifice validation + reward granting). Keep it framework-free.
//
// Hierarchy: GROUP → DIMENSION → WORLDS.
//   • A group (e.g. The Infinity Rifts) collects several dimensions and a grand reward.
//   • A dimension (e.g. Power Rift) is a CAMPAIGN of several hard "worlds" that ALWAYS
//     ends in a named FINAL BOSS, and grants one stone.
//   • A world is a single punishing mini-game. You must clear EVERY world in a dimension
//     in one run to earn its stone — losing any world forfeits the sacrifice and resets
//     the whole campaign ("lose = lose it all").
//
// Unlocking: dimensions open via XP AND/OR prerequisites (`requires` — other dimensions
// that must be cleared first), forming a progression tree. `keystone` marks the major,
// "important" dimensions (group entries and finales).
//
// Storage strategy (no schema change): stones, unlocks, cosmetics and the
// set-complete flag live in the user's `inventory` (string[]); the group currency
// and active XP wagers live in `upgradeExpirations` (Record<string, number>).

export type DimensionEngine = "gauntlet" | "roguelike" | "puzzle" | "boss-rush";

// Per-world difficulty knobs. All optional — each engine supplies punishing defaults.
export interface WorldParams {
  // gauntlet (endless waves): reach winWave to clear; lives before you fail
  winWave?: number;
  lives?: number;
  // puzzle / nexus (beat-the-clock ladder): climb `rungs` before `timeSec` runs out
  rungs?: number;
  timeSec?: number;
  dropOnWrong?: number; // rungs lost per wrong answer
  // roguelike / labyrinth: survive `steps` with starting `hp`
  steps?: number;
  hp?: number;
  // boss-rush / colosseum: beat `bosses` back-to-back
  bosses?: number;
  bossHp?: number;
  playerHp?: number;
  bossName?: string; // names the climactic boss (final-boss worlds)
}

export interface WorldDef {
  id: string;            // unique within its dimension
  name: string;
  tagline: string;
  icon: string;          // lucide-react icon name
  engine: DimensionEngine;
  params: WorldParams;
  final?: boolean;       // the dimension's climactic final boss
}

export interface DimensionDef {
  id: string;
  groupId: string;
  name: string;
  structure: string;
  tagline: string;
  description: string;
  icon: string;        // lucide-react icon name
  color: string;
  gradient: string;
  worlds: WorldDef[];  // the campaign — clear ALL (ending in the final boss) to win
  unlockXp: number;
  requires?: string[]; // dimension ids that must be cleared first
  keystone?: boolean;  // a major / "important" dimension (group entry or finale)
  topic?: string;      // question theme (see questionTopics.ts); keeps Qs on-theme
  badgeId?: string;
  stoneId?: string;    // collectible stone awarded for clearing every world (if part of a set)
  // Entry sacrifices (any combination, paid ONCE at entry):
  costCoins?: number;
  costGems?: number;
  costShards?: number; // group currency
  sacrificeItem?: boolean; // must give up a consumable (potion/powerup)
  wagerXp?: number;    // risk XP: lost on a loss, refunded + bonus on a full clear
  // Rewards for clearing the whole dimension:
  rewardXp: number;
  rewardCoins: number;
  rewardShards?: number;
}

export interface DimensionStone {
  id: string;
  name: string;
  emoji: string;
  color: string; // hex for glow
}

// An item you can buy in a dimension group's shop using that group's currency.
export interface DimensionShopItem {
  id: string;
  name: string;
  description: string;
  emoji: string;
  cost: number; // in the group's currency
  effect:
    | { type: "forge" }                                   // grant a missing group stone
    | { type: "cosmetic"; item: string }                  // grant an inventory cosmetic
    | { type: "boost"; upgradeId: string; hours: number } // a temporary upgrade
    | { type: "gems"; gems: number };                     // convert currency to gems
}

export interface DimensionGroupDef {
  id: string;
  name: string;
  tagline: string;
  description: string;
  gradient: string;
  icon: string;
  currencyId?: string;   // key inside upgradeExpirations
  currencyName?: string;
  currencyEmoji?: string;
  forgeShardCost?: number; // shards to forge a missing stone directly
  shop?: DimensionShopItem[]; // spend the group currency here
  dimensionIds: string[];
  stones: DimensionStone[];
  grandReward?: {
    title: string;
    badgeId: string;
    avatarId: string;
    borderId: string;
    coins: number;
    gems: number;
    xp: number;
    buffXpPct: number;   // permanent, while the full set is held
    buffCoinPct: number;
    completeFlag: string; // inventory marker so it grants once
  };
}

// ─── Dimension-shop item factories ──────────────────────────────────────────────
const shopForge = (currencyName: string, cost: number): DimensionShopItem =>
  ({ id: "forge", name: "Forge a Stone", description: `Forge a random missing stone for this set — a shortcut to completion.`, emoji: "⚒️", cost, effect: { type: "forge" } });
const shopXp = (cost: number): DimensionShopItem =>
  ({ id: "boost-xp", name: "XP Surge", description: "Double your XP from games for 2 hours.", emoji: "⚡", cost, effect: { type: "boost", upgradeId: "upgrade-xp-boost", hours: 2 } });
const shopCoins = (cost: number): DimensionShopItem =>
  ({ id: "boost-coins", name: "Coin Surge", description: "Double your Neuros from games for 2 hours.", emoji: "💰", cost, effect: { type: "boost", upgradeId: "upgrade-double-coins", hours: 2 } });
const shopGems = (cost: number, gems: number): DimensionShopItem =>
  ({ id: "gems", name: `Exchange for ${gems} Gems`, description: `Trade your currency for ${gems} gems.`, emoji: "💎", cost, effect: { type: "gems", gems } });

// ─── World factories ──────────────────────────────────────────────────────────
// Keep the (many) world definitions terse and readable.
function W(id: string, name: string, tagline: string, icon: string, engine: DimensionEngine, params: WorldParams): WorldDef {
  return { id, name, tagline, icon, engine, params };
}
// Final boss: a climactic boss-rush duel against a named foe.
function FB(id: string, name: string, bossName: string, params: WorldParams): WorldDef {
  return {
    id, name, tagline: `Final Boss — ${bossName}`, icon: "Crown", engine: "boss-rush",
    params: { bosses: 1, bossHp: 9, playerHp: 3, ...params, bossName },
    final: true,
  };
}

// ─── Group 1: The Core Dimensions (free, no stones — the original four) ────────
// A linear ladder: each unlocks by clearing the previous one (no XP gate). Every
// dimension ends in a final boss; clearing all worlds pays out XP, coins and a badge.
const CORE_DIMENSIONS: DimensionDef[] = [
  {
    id: "gauntlet", groupId: "core", name: "The Gauntlet", structure: "3 Worlds + Boss",
    tagline: "Three trials. One life-thread.",
    description: "The proving ground. Survive the waves, climb the spire, then face the Wave Warden. Fall once and the whole gauntlet resets.",
    icon: "Swords", color: "hsl(15, 85%, 50%)", gradient: "from-red-600 to-orange-700",
    unlockXp: 0, keystone: true, badgeId: "gauntlet-champion", rewardXp: 400, rewardCoins: 250,
    worlds: [
      W("g-w1", "Opening Salvo", "Endless waves — reach Wave 8.", "Swords", "gauntlet", { winWave: 8, lives: 2 }),
      W("g-w2", "The Long Climb", "Beat the clock — 14 rungs.", "Puzzle", "puzzle", { rungs: 14, timeSec: 58, dropOnWrong: 2 }),
      FB("g-boss", "Warden's Stand", "The Wave Warden", { bossHp: 8, playerHp: 3 }),
    ],
  },
  {
    id: "roguelike", groupId: "core", name: "The Labyrinth", structure: "3 Worlds + Boss",
    tagline: "A maze with a beast at its heart.",
    description: "Branching floors of the maze, harder every turn, guarded by the Maze Minotaur. One death sends you all the way back.",
    icon: "Map", color: "hsl(265, 70%, 55%)", gradient: "from-violet-600 to-purple-800",
    unlockXp: 0, requires: ["gauntlet"], badgeId: "labyrinth-master", rewardXp: 450, rewardCoins: 280,
    worlds: [
      W("l-w1", "Outer Halls", "Roguelike run — 12 steps.", "Map", "roguelike", { steps: 12, hp: 4 }),
      W("l-w2", "Twisting Depths", "Endless waves — reach Wave 9.", "Swords", "gauntlet", { winWave: 9, lives: 2 }),
      FB("l-boss", "The Beast's Lair", "The Maze Minotaur", { bossHp: 9, playerHp: 3 }),
    ],
  },
  {
    id: "puzzle", groupId: "core", name: "The Nexus", structure: "3 Worlds + Boss",
    tagline: "Three ladders. One ticking clock each.",
    description: "Beat-the-clock ascents, the timer tighter every time, ending against the Clock Tyrant. No lives here — only speed.",
    icon: "Puzzle", color: "hsl(190, 85%, 50%)", gradient: "from-cyan-500 to-blue-700",
    unlockXp: 0, requires: ["roguelike"], badgeId: "nexus-ascendant", rewardXp: 500, rewardCoins: 300,
    worlds: [
      W("n-w1", "First Ascent", "Beat the clock — 14 rungs.", "Puzzle", "puzzle", { rungs: 14, timeSec: 60, dropOnWrong: 2 }),
      W("n-w2", "The Gauntlet Bridge", "Endless waves — reach Wave 9.", "Swords", "gauntlet", { winWave: 9, lives: 2 }),
      FB("n-boss", "The Final Tick", "The Clock Tyrant", { bossHp: 9, playerHp: 3 }),
    ],
  },
  {
    id: "boss-rush", groupId: "core", name: "The Colosseum", structure: "4 Worlds + Boss",
    tagline: "Round after round of champions.",
    description: "Rounds of boss duels, more foes and tougher hides each time, until you face the Arena Champion. One shared health bar per round.",
    icon: "Skull", color: "hsl(340, 80%, 50%)", gradient: "from-rose-700 to-slate-900",
    unlockXp: 0, requires: ["puzzle"], keystone: true, badgeId: "colosseum-victor", rewardXp: 650, rewardCoins: 400,
    worlds: [
      W("c-w1", "Qualifiers", "Boss rush — 3 bosses.", "Skull", "boss-rush", { bosses: 3, bossHp: 5, playerHp: 4 }),
      W("c-w2", "The Maze Match", "Roguelike run — 13 steps.", "Map", "roguelike", { steps: 13, hp: 3 }),
      W("c-w3", "Semi-Finals", "Boss rush — 3 bosses.", "Skull", "boss-rush", { bosses: 3, bossHp: 5, playerHp: 3 }),
      FB("c-boss", "Grand Finals", "The Arena Champion", { bosses: 2, bossHp: 8, playerHp: 3 }),
    ],
  },
];

// ─── Group 2: The Infinity Rifts (6 stone dimensions + a group currency) ───────
const INFINITY_STONES: DimensionStone[] = [
  { id: "stone-power",   name: "Power Stone",   emoji: "🟣", color: "#a855f7" },
  { id: "stone-time",    name: "Time Stone",    emoji: "🟢", color: "#22c55e" },
  { id: "stone-space",   name: "Space Stone",   emoji: "🔵", color: "#3b82f6" },
  { id: "stone-mind",    name: "Mind Stone",    emoji: "🟡", color: "#eab308" },
  { id: "stone-reality", name: "Reality Stone", emoji: "🔴", color: "#ef4444" },
  { id: "stone-soul",    name: "Soul Stone",    emoji: "🟠", color: "#f97316" },
];

const INFINITY_DIMENSIONS: DimensionDef[] = [
  {
    id: "power-rift", groupId: "infinity", topic: "energy", name: "Power Rift", structure: "4 Worlds · BRUTAL",
    tagline: "Raw power. No mercy.",
    description: "The gateway to the Rifts (unlocks at 2,000 XP). Pay the toll in Neuros, then conquer four brutal worlds ending with the Titan of Power. Fall and the toll — and all progress — is gone.",
    icon: "Zap", color: "#a855f7", gradient: "from-fuchsia-600 to-purple-900",
    unlockXp: 2000, keystone: true, stoneId: "stone-power",
    costCoins: 5000, rewardXp: 700, rewardCoins: 450, rewardShards: 25,
    worlds: [
      W("pr-w1", "Surge Field", "Endless waves — reach Wave 10.", "Zap", "gauntlet", { winWave: 10, lives: 2 }),
      W("pr-w2", "Power Conduit", "Beat the clock — 16 rungs.", "Puzzle", "puzzle", { rungs: 16, timeSec: 52, dropOnWrong: 2 }),
      W("pr-w3", "Reactor Core", "Boss rush — 3 bosses.", "Skull", "boss-rush", { bosses: 3, bossHp: 5, playerHp: 3 }),
      FB("pr-boss", "The Power Throne", "The Titan of Power", { bossHp: 10, playerHp: 3 }),
    ],
  },
  {
    id: "time-rift", groupId: "infinity", topic: "time", name: "Time Rift", structure: "4 Worlds · BRUTAL",
    tagline: "Wager your time itself.",
    description: "Requires the Power Stone. Risk your XP across four time-trials ending against Chronos. Clear them all to win it back with interest — fail and the XP is gone forever.",
    icon: "Timer", color: "#22c55e", gradient: "from-emerald-600 to-teal-900",
    unlockXp: 0, requires: ["power-rift"], stoneId: "stone-time",
    wagerXp: 1500, rewardXp: 600, rewardCoins: 450, rewardShards: 25,
    worlds: [
      W("tr-w1", "Ticking Spire", "Beat the clock — 15 rungs.", "Timer", "puzzle", { rungs: 15, timeSec: 55, dropOnWrong: 2 }),
      W("tr-w2", "Frozen Moment", "Endless waves — reach Wave 10.", "Swords", "gauntlet", { winWave: 10, lives: 2 }),
      W("tr-w3", "Hourglass Maze", "Roguelike run — 14 steps.", "Map", "roguelike", { steps: 14, hp: 3 }),
      FB("tr-boss", "The Final Hour", "Chronos, Lord of Time", { bossHp: 10, playerHp: 3 }),
    ],
  },
  {
    id: "space-rift", groupId: "infinity", topic: "space", name: "Space Rift", structure: "4 Worlds · BRUTAL",
    tagline: "Fold space with gems.",
    description: "Requires the Power Stone. Spend gems to tear open a labyrinth across space, surviving four warped worlds and the Void Leviathan to seize the Space Stone.",
    icon: "Orbit", color: "#3b82f6", gradient: "from-blue-600 to-indigo-900",
    unlockXp: 0, requires: ["power-rift"], stoneId: "stone-space",
    costGems: 5, rewardXp: 700, rewardCoins: 450, rewardShards: 25,
    worlds: [
      W("sr-w1", "Folded Halls", "Roguelike run — 13 steps.", "Map", "roguelike", { steps: 13, hp: 3 }),
      W("sr-w2", "Event Horizon", "Boss rush — 3 bosses.", "Orbit", "boss-rush", { bosses: 3, bossHp: 5, playerHp: 3 }),
      W("sr-w3", "The Far Maze", "Roguelike run — 16 steps.", "Map", "roguelike", { steps: 16, hp: 3 }),
      FB("sr-boss", "The Singularity", "The Void Leviathan", { bossHp: 10, playerHp: 3 }),
    ],
  },
  {
    id: "mind-rift", groupId: "infinity", topic: "mind", name: "Mind Rift", structure: "5 Worlds · BOSS GAUNTLET",
    tagline: "Sacrifice to enter the mind.",
    description: "Requires both the Time and Space Stones. A relentless boss gauntlet — give up a consumable, then outfight three rounds of foes and the Overmind across five worlds for the Mind Stone.",
    icon: "Atom", color: "#eab308", gradient: "from-yellow-500 to-amber-800",
    unlockXp: 0, requires: ["time-rift", "space-rift"], stoneId: "stone-mind",
    sacrificeItem: true, rewardXp: 850, rewardCoins: 550, rewardShards: 30,
    worlds: [
      W("mr-w1", "Synapse Storm", "Boss rush — 3 bosses.", "Atom", "boss-rush", { bosses: 3, bossHp: 6, playerHp: 3 }),
      W("mr-w2", "Memory Maze", "Roguelike run — 14 steps.", "Map", "roguelike", { steps: 14, hp: 3 }),
      W("mr-w3", "Thought Cascade", "Beat the clock — 16 rungs.", "Puzzle", "puzzle", { rungs: 16, timeSec: 50, dropOnWrong: 3 }),
      W("mr-w4", "Legion of Doubt", "Boss rush — 4 bosses.", "Skull", "boss-rush", { bosses: 4, bossHp: 6, playerHp: 3 }),
      FB("mr-boss", "The Inner Mind", "The Overmind", { bosses: 2, bossHp: 10, playerHp: 3 }),
    ],
  },
  {
    id: "reality-rift", groupId: "infinity", topic: "quantum", name: "Reality Rift", structure: "4 Worlds · BRUTAL",
    tagline: "Bend reality with Shards.",
    description: "Requires the Mind Stone. Only Rift Shards can warp reality — spend them, then survive four reality-bending worlds and the Paradox Engine to claim the Reality Stone.",
    icon: "Sparkles", color: "#ef4444", gradient: "from-red-600 to-rose-900",
    unlockXp: 0, requires: ["mind-rift"], stoneId: "stone-reality",
    costShards: 50, rewardXp: 800, rewardCoins: 600, rewardShards: 0,
    worlds: [
      W("rr-w1", "Shattered Plain", "Endless waves — reach Wave 11.", "Sparkles", "gauntlet", { winWave: 11, lives: 2 }),
      W("rr-w2", "Warped Spire", "Beat the clock — 17 rungs.", "Puzzle", "puzzle", { rungs: 17, timeSec: 50, dropOnWrong: 3 }),
      W("rr-w3", "Glitch Labyrinth", "Roguelike run — 15 steps.", "Map", "roguelike", { steps: 15, hp: 3 }),
      FB("rr-boss", "End of Reality", "The Paradox Engine", { bossHp: 11, playerHp: 3 }),
    ],
  },
  {
    id: "soul-rift", groupId: "infinity", name: "Soul Rift", structure: "5 Worlds · NIGHTMARE",
    tagline: "The ultimate price.",
    description: "Requires the Reality Stone — the deepest Rift. It demands both Neuros and a wager of your XP. Brave five nightmare worlds and the Soul Devourer without a single failure for the final Soul Stone.",
    icon: "Flame", color: "#f97316", gradient: "from-orange-600 to-rose-950",
    unlockXp: 0, requires: ["reality-rift"], keystone: true, stoneId: "stone-soul",
    costCoins: 8000, wagerXp: 2000, rewardXp: 1100, rewardCoins: 750, rewardShards: 35,
    worlds: [
      W("so-w1", "Soul Labyrinth", "Roguelike run — 16 steps.", "Map", "roguelike", { steps: 16, hp: 3 }),
      W("so-w2", "Wailing Spire", "Beat the clock — 18 rungs.", "Timer", "puzzle", { rungs: 18, timeSec: 48, dropOnWrong: 3 }),
      W("so-w3", "Field of Echoes", "Endless waves — reach Wave 12.", "Swords", "gauntlet", { winWave: 12, lives: 1 }),
      W("so-w4", "Guardians of the Deep", "Boss rush — 4 bosses.", "Skull", "boss-rush", { bosses: 4, bossHp: 6, playerHp: 3 }),
      FB("so-boss", "The Soul Throne", "The Soul Devourer", { bosses: 2, bossHp: 12, playerHp: 3 }),
    ],
  },
];

// ─── Group 3: The Elemental Forge (4 elemental cores + Ember Sparks) ───────────
const ELEMENTAL_CORES: DimensionStone[] = [
  { id: "core-ember",  name: "Ember Core",   emoji: "🔥", color: "#f97316" },
  { id: "core-tide",   name: "Tide Core",    emoji: "💧", color: "#0ea5e9" },
  { id: "core-stone",  name: "Stone Core",   emoji: "🪨", color: "#a16207" },
  { id: "core-gale",   name: "Gale Core",    emoji: "🌪️", color: "#14b8a6" },
];

const ELEMENTAL_DIMENSIONS: DimensionDef[] = [
  {
    id: "inferno-trial", groupId: "elemental", topic: "fire", name: "Inferno Trial", structure: "3 Worlds · BRUTAL",
    tagline: "Forged in fire.",
    description: "The Forge's gateway (unlocks at 2,200 XP). Pay the toll in Neuros and survive three blazing worlds, then the Magma Colossus, to claim the Ember Core.",
    icon: "Flame", color: "#f97316", gradient: "from-orange-600 to-red-800",
    unlockXp: 2200, keystone: true, stoneId: "core-ember",
    costCoins: 4000, rewardXp: 550, rewardCoins: 380, rewardShards: 20,
    worlds: [
      W("if-w1", "Cinder Fields", "Endless waves — reach Wave 9.", "Flame", "gauntlet", { winWave: 9, lives: 2 }),
      W("if-w2", "Magma Climb", "Beat the clock — 15 rungs.", "Puzzle", "puzzle", { rungs: 15, timeSec: 54, dropOnWrong: 2 }),
      FB("if-boss", "Heart of Fire", "The Magma Colossus", { bossHp: 9, playerHp: 3 }),
    ],
  },
  {
    id: "tidal-trial", groupId: "elemental", topic: "water", name: "Tidal Trial", structure: "4 Worlds · BRUTAL",
    tagline: "Ride the rising tide.",
    description: "Requires the Ember Core. Wager your XP against the current across four surging worlds, ending with the Kraken, to win the Tide Core.",
    icon: "Waves", color: "#0ea5e9", gradient: "from-sky-600 to-blue-900",
    unlockXp: 0, requires: ["inferno-trial"], stoneId: "core-tide",
    wagerXp: 1200, rewardXp: 600, rewardCoins: 420, rewardShards: 25,
    worlds: [
      W("td-w1", "Rising Swell", "Beat the clock — 15 rungs.", "Waves", "puzzle", { rungs: 15, timeSec: 55, dropOnWrong: 2 }),
      W("td-w2", "Undertow Maze", "Roguelike run — 13 steps.", "Map", "roguelike", { steps: 13, hp: 3 }),
      W("td-w3", "The Maelstrom", "Beat the clock — 17 rungs.", "Waves", "puzzle", { rungs: 17, timeSec: 50, dropOnWrong: 2 }),
      FB("td-boss", "The Deep", "The Kraken", { bossHp: 10, playerHp: 3 }),
    ],
  },
  {
    id: "tremor-trial", groupId: "elemental", topic: "earth", name: "Tremor Trial", structure: "4 Worlds · BOSS HEAVY",
    tagline: "Stand on shifting ground.",
    description: "Requires the Ember Core. Sacrifice a consumable, then topple wave after wave of earthen titans — and finally the Mountain King — to seize the Stone Core.",
    icon: "Mountain", color: "#a16207", gradient: "from-amber-700 to-stone-900",
    unlockXp: 0, requires: ["inferno-trial"], stoneId: "core-stone",
    sacrificeItem: true, rewardXp: 600, rewardCoins: 420, rewardShards: 25,
    worlds: [
      W("tm-w1", "Quaking Arena", "Boss rush — 3 bosses.", "Mountain", "boss-rush", { bosses: 3, bossHp: 6, playerHp: 3 }),
      W("tm-w2", "Cavern Run", "Roguelike run — 14 steps.", "Map", "roguelike", { steps: 14, hp: 3 }),
      W("tm-w3", "Rockslide Rush", "Boss rush — 4 bosses.", "Skull", "boss-rush", { bosses: 4, bossHp: 6, playerHp: 3 }),
      FB("tm-boss", "The Summit", "The Mountain King", { bossHp: 10, playerHp: 3 }),
    ],
  },
  {
    id: "tempest-trial", groupId: "elemental", topic: "air", name: "Tempest Trial", structure: "4 Worlds · BRUTAL",
    tagline: "Eye of the storm.",
    description: "Requires both the Tide and Stone Cores. Only Ember Sparks can calm the tempest — spend your Sparks and brave four storm-worlds and the Storm Sovereign for the Gale Core.",
    icon: "Wind", color: "#14b8a6", gradient: "from-teal-600 to-emerald-900",
    unlockXp: 0, requires: ["tidal-trial", "tremor-trial"], keystone: true, stoneId: "core-gale",
    costShards: 45, rewardXp: 750, rewardCoins: 500, rewardShards: 0,
    worlds: [
      W("tp-w1", "Gale Maze", "Roguelike run — 13 steps.", "Wind", "roguelike", { steps: 13, hp: 3 }),
      W("tp-w2", "Lightning Spire", "Beat the clock — 16 rungs.", "Zap", "puzzle", { rungs: 16, timeSec: 50, dropOnWrong: 3 }),
      W("tp-w3", "Hurricane Front", "Endless waves — reach Wave 11.", "Wind", "gauntlet", { winWave: 11, lives: 2 }),
      FB("tp-boss", "Eye of the Storm", "The Storm Sovereign", { bossHp: 10, playerHp: 3 }),
    ],
  },
];

// ─── Group 4: The Cosmic Observatory (4 star fragments + Stardust) ─────────────
const COSMIC_FRAGMENTS: DimensionStone[] = [
  { id: "frag-sun",    name: "Sun Fragment",    emoji: "☀️", color: "#facc15" },
  { id: "frag-moon",   name: "Moon Fragment",   emoji: "🌙", color: "#94a3b8" },
  { id: "frag-nebula", name: "Nebula Fragment", emoji: "🌌", color: "#8b5cf6" },
  { id: "frag-comet",  name: "Comet Fragment",  emoji: "☄️", color: "#38bdf8" },
];

const COSMIC_DIMENSIONS: DimensionDef[] = [
  {
    id: "solar-trial", groupId: "cosmic", topic: "space", name: "Solar Trial", structure: "4 Worlds · NIGHTMARE",
    tagline: "Touch the Sun.",
    description: "The true end-game — requires the Soul Stone (the whole Infinity set is best). Endure four searing worlds and the Solar Phoenix to claim the Sun Fragment.",
    icon: "Sun", color: "#facc15", gradient: "from-amber-500 to-orange-800",
    unlockXp: 0, requires: ["soul-rift"], keystone: true, stoneId: "frag-sun",
    costCoins: 12000, rewardXp: 1000, rewardCoins: 700, rewardShards: 30,
    worlds: [
      W("sol-w1", "Solar Flares", "Endless waves — reach Wave 11.", "Sun", "gauntlet", { winWave: 11, lives: 2 }),
      W("sol-w2", "Corona Climb", "Beat the clock — 18 rungs.", "Puzzle", "puzzle", { rungs: 18, timeSec: 50, dropOnWrong: 3 }),
      W("sol-w3", "Plasma Guardians", "Boss rush — 4 bosses.", "Skull", "boss-rush", { bosses: 4, bossHp: 6, playerHp: 3 }),
      FB("sol-boss", "The Sun's Core", "The Solar Phoenix", { bossHp: 11, playerHp: 3 }),
    ],
  },
  {
    id: "lunar-trial", groupId: "cosmic", topic: "space", name: "Lunar Trial", structure: "4 Worlds · NIGHTMARE",
    tagline: "Climb to the Moon.",
    description: "Requires the Sun Fragment. Only Stardust opens the lunar gate — spend it and conquer four lunar worlds and the Lunar Specter for the Moon Fragment.",
    icon: "Moon", color: "#94a3b8", gradient: "from-slate-500 to-indigo-900",
    unlockXp: 0, requires: ["solar-trial"], stoneId: "frag-moon",
    costShards: 60, rewardXp: 900, rewardCoins: 700, rewardShards: 0,
    worlds: [
      W("lun-w1", "Lunar Ladder", "Beat the clock — 17 rungs.", "Moon", "puzzle", { rungs: 17, timeSec: 50, dropOnWrong: 3 }),
      W("lun-w2", "Crater Maze", "Roguelike run — 15 steps.", "Map", "roguelike", { steps: 15, hp: 3 }),
      W("lun-w3", "Tidal Lock", "Endless waves — reach Wave 11.", "Swords", "gauntlet", { winWave: 11, lives: 2 }),
      FB("lun-boss", "Dark Side", "The Lunar Specter", { bossHp: 11, playerHp: 3 }),
    ],
  },
  {
    id: "nebula-trial", groupId: "cosmic", topic: "space", name: "Nebula Trial", structure: "5 Worlds · NIGHTMARE",
    tagline: "Drift through the void.",
    description: "Requires the Sun Fragment. Wager your XP and navigate five nebula-worlds and the Nebula Wyrm without a single failure to capture the Nebula Fragment.",
    icon: "Sparkles", color: "#8b5cf6", gradient: "from-violet-600 to-purple-950",
    unlockXp: 0, requires: ["solar-trial"], stoneId: "frag-nebula",
    wagerXp: 2500, rewardXp: 1100, rewardCoins: 750, rewardShards: 35,
    worlds: [
      W("neb-w1", "Stardust Drift", "Roguelike run — 15 steps.", "Sparkles", "roguelike", { steps: 15, hp: 3 }),
      W("neb-w2", "Cosmic Tide", "Beat the clock — 18 rungs.", "Puzzle", "puzzle", { rungs: 18, timeSec: 48, dropOnWrong: 3 }),
      W("neb-w3", "The Deep Void", "Roguelike run — 17 steps.", "Map", "roguelike", { steps: 17, hp: 3 }),
      W("neb-w4", "Gravity Well", "Endless waves — reach Wave 12.", "Orbit", "gauntlet", { winWave: 12, lives: 1 }),
      FB("neb-boss", "Heart of the Nebula", "The Nebula Wyrm", { bossHp: 11, playerHp: 3 }),
    ],
  },
  {
    id: "comet-trial", groupId: "cosmic", topic: "space", name: "Comet Trial", structure: "5 Worlds · FINAL",
    tagline: "Outrun the comet.",
    description: "The final dimension — requires both the Moon and Nebula Fragments. Spend gems to chase the comet through five worlds and defeat the Celestial Devourer for the last Comet Fragment.",
    icon: "Orbit", color: "#38bdf8", gradient: "from-sky-500 to-blue-950",
    unlockXp: 0, requires: ["lunar-trial", "nebula-trial"], keystone: true, stoneId: "frag-comet",
    costGems: 10, rewardXp: 1300, rewardCoins: 900, rewardShards: 40,
    worlds: [
      W("com-w1", "Tail Chase", "Endless waves — reach Wave 12.", "Orbit", "gauntlet", { winWave: 12, lives: 2 }),
      W("com-w2", "Ice Maze", "Roguelike run — 16 steps.", "Map", "roguelike", { steps: 16, hp: 3 }),
      W("com-w3", "Cosmic Guardians", "Boss rush — 4 bosses.", "Skull", "boss-rush", { bosses: 4, bossHp: 6, playerHp: 3 }),
      W("com-w4", "Final Approach", "Beat the clock — 18 rungs.", "Puzzle", "puzzle", { rungs: 18, timeSec: 46, dropOnWrong: 3 }),
      FB("com-boss", "The Comet's Heart", "The Celestial Devourer", { bosses: 2, bossHp: 12, playerHp: 3 }),
    ],
  },
];

// ─── Group 5: The Quantum Codex (4 qubit shards + Qubits) ──────────────────────
const QUANTUM_STONES: DimensionStone[] = [
  { id: "qbit-superposition", name: "Superposition Shard", emoji: "🌓", color: "#22d3ee" },
  { id: "qbit-entanglement",  name: "Entanglement Shard",  emoji: "🔗", color: "#a78bfa" },
  { id: "qbit-tunneling",     name: "Tunneling Shard",     emoji: "🕳️", color: "#34d399" },
  { id: "qbit-collapse",      name: "Collapse Shard",      emoji: "💠", color: "#f472b6" },
];

const QUANTUM_DIMENSIONS: DimensionDef[] = [
  {
    id: "superposition-rift", groupId: "quantum", name: "Superposition Rift", structure: "3 Worlds · BRUTAL",
    tagline: "Be everywhere at once.",
    description: "The gateway to the Codex (unlocks at 9,000 XP). Pay in Neuros, then clear three quantum worlds and the Schrödinger Sentinel to claim the Superposition Shard.",
    icon: "Atom", color: "#22d3ee", gradient: "from-cyan-500 to-sky-800",
    unlockXp: 9000, keystone: true, topic: "quantum", stoneId: "qbit-superposition",
    costCoins: 14000, rewardXp: 1000, rewardCoins: 700, rewardShards: 30,
    worlds: [
      W("sp-w1", "Probability Field", "Endless waves — reach Wave 11.", "Atom", "gauntlet", { winWave: 11, lives: 2 }),
      W("sp-w2", "Wave Function", "Beat the clock — 18 rungs.", "Puzzle", "puzzle", { rungs: 18, timeSec: 50, dropOnWrong: 3 }),
      FB("sp-boss", "The Observer", "The Schrödinger Sentinel", { bossHp: 11, playerHp: 3 }),
    ],
  },
  {
    id: "entangle-rift", groupId: "quantum", name: "Entanglement Rift", structure: "3 Worlds · BRUTAL",
    tagline: "Linked across all space.",
    description: "Requires the Superposition Shard. Wager your XP and navigate two entangled labyrinths and the Twin Paradox to seize the Entanglement Shard.",
    icon: "Orbit", color: "#a78bfa", gradient: "from-violet-500 to-purple-900",
    unlockXp: 0, requires: ["superposition-rift"], topic: "quantum", stoneId: "qbit-entanglement",
    wagerXp: 3000, rewardXp: 1000, rewardCoins: 700, rewardShards: 30,
    worlds: [
      W("en-w1", "Spooky Distance", "Roguelike run — 15 steps.", "Map", "roguelike", { steps: 15, hp: 3 }),
      W("en-w2", "Linked Pair", "Roguelike run — 17 steps.", "Map", "roguelike", { steps: 17, hp: 3 }),
      FB("en-boss", "Mirror of Twins", "The Twin Paradox", { bosses: 2, bossHp: 10, playerHp: 3 }),
    ],
  },
  {
    id: "tunnel-rift", groupId: "quantum", name: "Tunneling Rift", structure: "3 Worlds · BRUTAL",
    tagline: "Walk through walls.",
    description: "Requires the Entanglement Shard. Spend gems to phase through barriers, then defeat the Barrier Breaker for the Tunneling Shard.",
    icon: "Zap", color: "#34d399", gradient: "from-emerald-500 to-green-900",
    unlockXp: 0, requires: ["entangle-rift"], topic: "physics", stoneId: "qbit-tunneling",
    costGems: 12, rewardXp: 1100, rewardCoins: 750, rewardShards: 30,
    worlds: [
      W("tu-w1", "Barrier Field", "Boss rush — 4 bosses.", "Skull", "boss-rush", { bosses: 4, bossHp: 6, playerHp: 3 }),
      W("tu-w2", "Phase Climb", "Beat the clock — 18 rungs.", "Puzzle", "puzzle", { rungs: 18, timeSec: 48, dropOnWrong: 3 }),
      FB("tu-boss", "The Wall", "The Barrier Breaker", { bossHp: 12, playerHp: 3 }),
    ],
  },
  {
    id: "collapse-rift", groupId: "quantum", name: "Collapse Rift", structure: "4 Worlds · NIGHTMARE",
    tagline: "Where all possibilities end.",
    description: "Requires the Tunneling Shard — the Codex's finale. Spend Qubits, then survive four collapsing worlds and the Wavefunction Devourer for the final Collapse Shard.",
    icon: "Sparkles", color: "#f472b6", gradient: "from-fuchsia-500 via-rose-600 to-indigo-700",
    unlockXp: 0, requires: ["tunnel-rift"], keystone: true, topic: "quantum", stoneId: "qbit-collapse",
    costShards: 60, rewardXp: 1400, rewardCoins: 950, rewardShards: 0,
    worlds: [
      W("co-w1", "Decoherence", "Endless waves — reach Wave 12.", "Sparkles", "gauntlet", { winWave: 12, lives: 1 }),
      W("co-w2", "Collapsing Maze", "Roguelike run — 17 steps.", "Map", "roguelike", { steps: 17, hp: 3 }),
      W("co-w3", "Final Measurement", "Beat the clock — 18 rungs.", "Puzzle", "puzzle", { rungs: 18, timeSec: 46, dropOnWrong: 3 }),
      FB("co-boss", "The Last Possibility", "The Wavefunction Devourer", { bosses: 2, bossHp: 13, playerHp: 3 }),
    ],
  },
];

export const DIMENSIONS: DimensionDef[] = [
  ...CORE_DIMENSIONS, ...INFINITY_DIMENSIONS, ...ELEMENTAL_DIMENSIONS, ...COSMIC_DIMENSIONS, ...QUANTUM_DIMENSIONS,
];

export const DIMENSION_GROUPS: DimensionGroupDef[] = [
  {
    id: "core",
    name: "Core Dimensions",
    tagline: "Four warped realities — a ladder of campaigns, each ending in a boss.",
    description: "The original dimensions, now multi-world campaigns that unlock one after another. Free to enter and endlessly replayable, but you must clear every world — including the final boss — in one run to earn the payout.",
    gradient: "from-fuchsia-500 via-purple-500 to-cyan-500",
    icon: "Hexagon",
    dimensionIds: CORE_DIMENSIONS.map(d => d.id),
    stones: [],
  },
  {
    id: "infinity",
    name: "The Infinity Rifts",
    tagline: "Six stones. One gauntlet. Limitless power.",
    description: "Six punishing rifts, each a campaign of brutal worlds guarding an Infinity Stone, unlocking in a chain from the Power Rift. Every rift demands a sacrifice and rewards Rift Shards. Collect all six stones to claim the Infinity Gauntlet — permanent power, legendary cosmetics and a colossal payout.",
    gradient: "from-purple-600 via-fuchsia-600 to-amber-500",
    icon: "Gem",
    currencyId: "dim-shards-infinity",
    currencyName: "Rift Shards",
    currencyEmoji: "💠",
    forgeShardCost: 120,
    shop: [shopForge("Rift Shards", 120), shopXp(40), shopCoins(40), shopGems(60, 10)],
    dimensionIds: INFINITY_DIMENSIONS.map(d => d.id),
    stones: INFINITY_STONES,
    grandReward: {
      title: "The Infinity Gauntlet",
      badgeId: "infinity-master",
      avatarId: "avatar-infinity",
      borderId: "frame-infinity",
      coins: 50000,
      gems: 100,
      xp: 10000,
      buffXpPct: 25,
      buffCoinPct: 25,
      completeFlag: "infinity-complete",
    },
  },
  {
    id: "elemental",
    name: "The Elemental Forge",
    tagline: "Four elements. One crown.",
    description: "Master fire, water, earth and air across four elemental trials — each a campaign of brutal worlds with an elemental boss, unlocking from the Inferno Trial. Each forges a Core and rewards Ember Sparks. Unite all four Cores to claim the Elemental Crown.",
    gradient: "from-orange-500 via-amber-500 to-teal-500",
    icon: "Flame",
    currencyId: "dim-shards-elemental",
    currencyName: "Ember Sparks",
    currencyEmoji: "🔥",
    forgeShardCost: 100,
    shop: [shopForge("Ember Sparks", 100), shopXp(35), shopGems(50, 8)],
    dimensionIds: ELEMENTAL_DIMENSIONS.map(d => d.id),
    stones: ELEMENTAL_CORES,
    grandReward: {
      title: "The Elemental Crown",
      badgeId: "elemental-sovereign",
      avatarId: "avatar-elemental-lord",
      borderId: "frame-elemental",
      coins: 30000,
      gems: 60,
      xp: 6000,
      buffXpPct: 20,
      buffCoinPct: 20,
      completeFlag: "elemental-complete",
    },
  },
  {
    id: "cosmic",
    name: "The Cosmic Observatory",
    tagline: "Gather the heavens.",
    description: "The end-game — voyage to the Sun, Moon, nebulae and comets, each a nightmare campaign gated behind the Infinity Rifts. Each trial yields a Star Fragment and Stardust. Collect all four Fragments to forge the Cosmic Crown — the ultimate reward.",
    gradient: "from-indigo-500 via-violet-500 to-sky-400",
    icon: "Telescope",
    currencyId: "dim-shards-cosmic",
    currencyName: "Stardust",
    currencyEmoji: "✨",
    forgeShardCost: 150,
    shop: [shopForge("Stardust", 150), shopXp(45), shopGems(70, 12)],
    dimensionIds: COSMIC_DIMENSIONS.map(d => d.id),
    stones: COSMIC_FRAGMENTS,
    grandReward: {
      title: "The Cosmic Crown",
      badgeId: "cosmic-sovereign",
      avatarId: "avatar-cosmos-sovereign",
      borderId: "frame-cosmos",
      coins: 75000,
      gems: 150,
      xp: 15000,
      buffXpPct: 20,
      buffCoinPct: 20,
      completeFlag: "cosmic-complete",
    },
  },
  {
    id: "quantum",
    name: "The Quantum Codex",
    tagline: "Master the impossible.",
    description: "The deepest rifts of all — where particles are everywhere and nowhere at once. Four mind-bending trials gated behind the Codex gateway, each yielding a Qubit Shard and Qubits. Collect all four to forge the Quantum Codex and bend reality itself.",
    gradient: "from-cyan-500 via-violet-600 to-fuchsia-500",
    icon: "Atom",
    currencyId: "dim-shards-quantum",
    currencyName: "Qubits",
    currencyEmoji: "🔬",
    forgeShardCost: 140,
    shop: [shopForge("Qubits", 140), shopXp(45), shopCoins(45), shopGems(70, 14)],
    dimensionIds: QUANTUM_DIMENSIONS.map(d => d.id),
    stones: QUANTUM_STONES,
    grandReward: {
      title: "The Quantum Codex",
      badgeId: "quantum-sovereign",
      avatarId: "avatar-quantum-sage",
      borderId: "frame-quantum",
      coins: 100000,
      gems: 200,
      xp: 20000,
      buffXpPct: 25,
      buffCoinPct: 25,
      completeFlag: "quantum-complete",
    },
  },
];

// ─── Helpers (pure) ───────────────────────────────────────────────────────────
export function getDimension(id: string): DimensionDef | undefined {
  return DIMENSIONS.find(d => d.id === id);
}

export function getDimensionGroup(id: string): DimensionGroupDef | undefined {
  return DIMENSION_GROUPS.find(g => g.id === id);
}

export function getGroupForDimension(dimId: string): DimensionGroupDef | undefined {
  const dim = getDimension(dimId);
  return dim ? getDimensionGroup(dim.groupId) : undefined;
}

// Has the player conquered a dimension? Stone dimensions are proven by owning their
// stone; the free Core dimensions by their badge.
export function isDimensionCleared(dim: DimensionDef, inventory: string[], badges: string[]): boolean {
  if (dim.stoneId) return inventory.includes(dim.stoneId);
  if (dim.badgeId) return badges.includes(dim.badgeId);
  return false;
}

export interface DimensionUnlockState {
  unlocked: boolean;
  xpShort: number;          // remaining XP needed (0 if the XP gate is met)
  missing: DimensionDef[];  // prerequisite dimensions not yet cleared
}

// Single source of truth for unlock logic, shared by client UI and server validation.
export function dimensionUnlockState(
  dim: DimensionDef,
  opts: { xp: number; inventory: string[]; badges: string[] },
): DimensionUnlockState {
  if (opts.inventory.includes("dimunlock-" + dim.id)) {
    return { unlocked: true, xpShort: 0, missing: [] }; // admin grant
  }
  const missing = (dim.requires || [])
    .map(getDimension)
    .filter((d): d is DimensionDef => !!d && !isDimensionCleared(d, opts.inventory, opts.badges));
  const xpShort = Math.max(0, dim.unlockXp - (opts.xp || 0));
  return { unlocked: xpShort === 0 && missing.length === 0, xpShort, missing };
}

// Does the user hold every stone in a group? (inventory = string[])
export function hasFullStoneSet(group: DimensionGroupDef, inventory: string[]): boolean {
  if (group.stones.length === 0) return false;
  return group.stones.every(s => inventory.includes(s.id));
}

// Permanent buff multipliers from any completed stone set the user holds.
export function dimensionBuffMultipliers(inventory: string[]): { xp: number; coins: number } {
  let xp = 1, coins = 1;
  for (const g of DIMENSION_GROUPS) {
    if (g.grandReward && hasFullStoneSet(g, inventory)) {
      xp += g.grandReward.buffXpPct / 100;
      coins += g.grandReward.buffCoinPct / 100;
    }
  }
  return { xp, coins };
}
