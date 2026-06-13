import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag, Coins, Star, Sparkles, Crown, Check, Loader2,
  Palette, Zap, Shield, Trophy, Wand2, Flame, Bird, Bot,
  Swords, TreePine, Diamond, Compass, Lock, Atom, Rocket,
  Circle, Dna, Rainbow, Gem, Undo2, Gift, RotateCcw, Timer,
  GraduationCap, Brain, Magnet, Snowflake, Orbit, Globe, Eye,
  FlaskConical, Waves, Award, Medal, Skull, Moon, Frame, Square,
  Gamepad2, Mountain, Droplets, Anchor, Bug, Settings,
  Calendar, Package, Box, PartyPopper, CircleDot, HelpCircle,
  Heart, Minus, Plus, EyeOff, Hourglass, TrendingUp, Wallet,
  Search, ShieldCheck
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import type { ShopItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { WORLDS } from "@/lib/gameData";

const WORLD_EXCLUSIVE_IDS = new Set(WORLDS.flatMap(w => w.shopItemIds));

const ICON_MAP: Record<string, any> = {
  Bot, Sparkles, Swords, Wand2, Flame, Bird, Diamond, Star, Crown,
  TreePine, Palette, Zap, Shield, Coins, Trophy, Compass, Atom,
  Rocket, Circle, Dna, Rainbow, Timer, GraduationCap, Brain,
  Magnet, Snowflake, Orbit, Globe, Eye, FlaskConical, Waves, Gift, Award, Medal, Skull, Moon,
  Frame, Square, Gamepad2, Gem, Mountain, Droplets, Anchor, Bug, Settings, Heart, EyeOff, Hourglass,
  TrendingUp, Wallet, Search, ShieldCheck,
};

const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-500 bg-gray-500/10 border-gray-500/20",
  uncommon: "text-green-500 bg-green-500/10 border-green-500/20",
  rare: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  epic: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  legendary: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
};

const CATEGORIES = ["All", "daily", "mystery", "avatar", "decoration", "follower", "badge_style", "theme", "frame", "coin_style", "gem_style", "powerup", "battle_powerup", "title", "profile_animation", "name_animation", "reward", "upgrade"];
const CATEGORY_LABELS: Record<string, string> = {
  All: "All", daily: "Daily Rewards", mystery: "Mystery Boxes", avatar: "Avatars", decoration: "Decorations", follower: "Mouse Followers",
  badge_style: "Badge Styles", theme: "Themes", frame: "Frames", coin_style: "Coin Styles",
  gem_style: "Gem Styles", powerup: "Power-ups", battle_powerup: "Battle Powerups", title: "Titles",
  profile_animation: "Profile Animations", name_animation: "Name Animations",
  reward: "Rewards", upgrade: "Upgrades (Gems)",
};
const CATEGORY_ICONS: Record<string, any> = {
  All: ShoppingBag, daily: Calendar, mystery: Package, avatar: Bot, decoration: Sparkles, follower: Rocket,
  badge_style: Star, theme: Palette, frame: Frame, coin_style: Coins,
  gem_style: Gem, powerup: Zap, battle_powerup: Swords, title: Crown,
  profile_animation: Sparkles, name_animation: Zap,
  reward: Gift, upgrade: Gem,
};

const REWARD_GROUPS: { key: string; label: string; icon: any; match: (src: string) => boolean }[] = [
  { key: "bosses", label: "Boss Rewards", icon: Swords, match: (s) => s.startsWith("boss:") },
  { key: "tournaments", label: "Tournament & Clan Rewards", icon: Trophy, match: (s) => s.startsWith("tournament:") || s.startsWith("clan-battle:") },
  { key: "leaderboard", label: "Leaderboard Rewards", icon: Crown, match: (s) => s.startsWith("leaderboard:") },
  { key: "hardmode", label: "Hard Mode Rewards", icon: Zap, match: (s) => s.startsWith("game:") },
  { key: "admin", label: "Special Admin Awards", icon: Heart, match: (s) => s.startsWith("admin:") },
  { key: "boost", label: "Influencer Rewards", icon: Star, match: (s) => s.startsWith("boost:") },
  { key: "pvp", label: "PvP Duel Rewards", icon: Swords, match: (s) => s.startsWith("pvp:") },
];

const REWARD_SOURCE_LABELS: Record<string, string> = {
  "boss:chaos-storm": "Defeat The Chaos Storm",
  "boss:dr-blackout": "Defeat Dr. Blackout",
  "boss:mutation-master": "Defeat The Mutation Master",
  "boss:professor-meltdown": "Defeat Professor Meltdown",
  "boss:gravity-king": "Defeat Gravity King",
  "boss:plague-lord": "Defeat Plague Lord",
  "boss:tecton-the-shaker": "Defeat Tecton the Shaker",
  "boss:nebula-queen": "Defeat Nebula Queen",
  "boss:the-void": "Defeat The Void (Secret Boss)",
  "boss:professor-paradox": "Defeat Professor Paradox (Secret Boss)",
  "boss:king-element": "Defeat King Element (Secret Boss)",
  "boss:the-architect": "Defeat The Architect (Secret Boss)",
  "boss:dark-matter": "Defeat Dark Matter (Secret Boss)",
  "boss:nano-swarm": "Defeat The Nano Swarm (Secret Boss)",
  "boss:quantum-computer": "Defeat The Quantum Computer (Secret Boss)",
  "boss:any-omega": "Defeat any Omega-level Boss",
  "boss:all-regular": "Defeat all 8 Regular Bosses",
  "game:volcano-lab:hard": "Beat Volcano Lab on Hard",
  "game:planet-painter:hard": "Beat Planet Painter on Hard",
  "game:gravity-dash:hard": "Beat Gravity Dash on Hard",
  "game:physics-frenzy:hard": "Beat Physics Frenzy on Hard",
  "game:circuit-crafter:hard": "Beat Circuit Crafter on Hard",
  "tournament:winner": "Win 1st Place in a Tournament",
  "clan-battle:winner": "Win a Clan Battle",
  "leaderboard:individual": "Reach #1 on the Leaderboard",
  "leaderboard:clan": "Lead the #1 Ranked Clan",
  "leaderboard:team": "Lead the #1 Ranked Team",
  "admin:favourite": "Be chosen as Admin's Favourite",
  "pvp:admin-beater": "Defeat an Admin in a Quiz Duel",
  "boost:10":  "Receive 10 total boosts on your posts",
  "boost:50":  "Receive 50 total boosts on your posts",
  "boost:100": "Receive 100 total boosts on your posts",
  "boss:all-world": "Defeat all 10 World Bosses",
  "boss:the-kraken": "Defeat The Kraken",
  "boss:magma-titan": "Defeat The Magma Titan",
  "boss:frost-wyrm": "Defeat The Frost Wyrm",
  "boss:jungle-hydra": "Defeat The Jungle Hydra",
  "boss:cosmic-entity": "Defeat The Cosmic Entity",
  "boss:crystal-golem": "Defeat The Crystal Golem",
  "boss:thunder-king": "Defeat The Thunder King",
  "boss:virus-prime": "Defeat Virus Prime",
  "boss:rex-overlord": "Defeat The Rex Overlord",
  "boss:quantum-phantom": "Defeat The Quantum Phantom",
  "xp:5000": "Reach 5,000 XP",
  "xp:25000": "Reach 25,000 XP",
  "xp:50000": "Reach 50,000 XP",
  "xp:100000": "Reach 100,000 XP — XP Legend avatar",
  "rebirth:1": "Complete your First Rebirth",
  "rebirth:5": "Reach Rebirth Level 5",
  "streak:30": "Reach a 30-Day Streak",
  "games:100": "Play 100 Total Games",
};

const COSMETIC_UPGRADE_IDS = new Set([
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

const GEM_UPGRADES: { id: string; name: string; description: string; icon: string; price: number; rarity: string; requiredLevel?: number }[] = [
  { id: "upgrade-xp-boost", name: "XP Boost", description: "Earn 2x XP from all games! (1 use per game)", icon: "Zap", price: 10, rarity: "epic" },
  { id: "upgrade-coin-magnet", name: "Coin Magnet", description: "Earn +25% coins from boss battles! (1 use per game)", icon: "Coins", price: 8, rarity: "rare" },
  { id: "upgrade-extra-time", name: "Time Extender", description: "+10 seconds on all timed games! (1 use per game)", icon: "Shield", price: 5, rarity: "uncommon" },
  { id: "upgrade-golden-profile", name: "Golden Profile", description: "Your profile shines with a golden border! (Permanent while owned)", icon: "Crown", price: 15, rarity: "legendary" },
  { id: "upgrade-streak-shield", name: "Streak Shield", description: "Protects your daily streak once if you miss a day! (1 use)", icon: "Shield", price: 6, rarity: "rare" },
  { id: "upgrade-boss-insight", name: "Boss Insight", description: "See a hint during boss battles! (1 use per fight)", icon: "Atom", price: 12, rarity: "epic" },
  { id: "upgrade-double-coins", name: "Double Coins", description: "Earn 2x coins from all games! (1 use per game)", icon: "Coins", price: 20, rarity: "legendary", requiredLevel: 15 },
  { id: "upgrade-boss-rush", name: "Boss Rush Mode", description: "Earn 1.5x XP and coins from all boss battles! (1 use per fight)", icon: "Swords", price: 25, rarity: "legendary", requiredLevel: 20 },
  { id: "upgrade-lab-mastery", name: "Lab Mastery", description: "Earn 3x XP and coins from all lab experiments! (1 use per lab)", icon: "FlaskConical", price: 30, rarity: "legendary", requiredLevel: 25 },
  { id: "upgrade-diamond-profile", name: "Diamond Profile", description: "Your profile sparkles with a stunning diamond border! (Permanent)", icon: "Diamond", price: 35, rarity: "legendary", requiredLevel: 10 },
  { id: "upgrade-permanent-xp", name: "XP Mastery", description: "Permanently earn +15% XP from all games forever!", icon: "TrendingUp", price: 40, rarity: "legendary", requiredLevel: 15 },
  { id: "upgrade-permanent-coins", name: "Coin Mastery", description: "Permanently earn +15% coins from all games forever!", icon: "Wallet", price: 45, rarity: "legendary", requiredLevel: 15 },
  { id: "upgrade-daily-gems", name: "Daily Gems", description: "Earn +2 bonus gems every time you claim daily rewards! (Permanent)", icon: "Gift", price: 50, rarity: "legendary", requiredLevel: 20 },
  { id: "upgrade-rainbow-name", name: "Rainbow Name", description: "Your username shimmers with rainbow colours everywhere! (Permanent)", icon: "Palette", price: 30, rarity: "legendary", requiredLevel: 15 },
  { id: "upgrade-auto-streak", name: "Auto Streak Protector", description: "Never lose your daily streak again — permanent protection!", icon: "ShieldCheck", price: 60, rarity: "legendary", requiredLevel: 25 },
  { id: "upgrade-treasure-hunter", name: "Treasure Hunter", description: "Find 5-15 bonus coins hidden in every game! (Permanent)", icon: "Search", price: 35, rarity: "epic", requiredLevel: 10 },
  { id: "upgrade-elite-border", name: "Elite Border", description: "An exclusive elite border for your profile! (Permanent)", icon: "Frame", price: 20, rarity: "epic", requiredLevel: 8 },
  { id: "upgrade-science-star", name: "Science Star", description: "Permanently earn +10% XP AND +10% coins from everything!", icon: "Star", price: 55, rarity: "legendary", requiredLevel: 30 },
  { id: "upgrade-mega-xp", name: "Mega XP Core", description: "Permanently earn +25% XP from all games forever! Stacks with XP Mastery!", icon: "Zap", price: 70, rarity: "legendary", requiredLevel: 35 },
  { id: "upgrade-mega-coins", name: "Mega Coin Core", description: "Permanently earn +25% coins from all games forever! Stacks with Coin Mastery!", icon: "Coins", price: 70, rarity: "legendary", requiredLevel: 35 },
  { id: "upgrade-scholar", name: "Grand Scholar", description: "Permanently earn +20% XP AND +20% coins from everything!", icon: "TrendingUp", price: 90, rarity: "legendary", requiredLevel: 40 },
  { id: "upgrade-jackpot", name: "Jackpot Core", description: "Each game has a 10% chance to TRIPLE all your XP and coins!", icon: "Sparkles", price: 100, rarity: "legendary", requiredLevel: 45 },
];

const COIN_STYLE_COLORS: Record<string, { icon: string; text: string; anim: string }> = {
  "coin-style-diamond": { icon: "text-cyan-400 drop-shadow-sm", text: "text-cyan-500 dark:text-cyan-400", anim: "animate-coin-diamond" },
  "coin-style-fire": { icon: "text-orange-500 drop-shadow-sm", text: "text-orange-600 dark:text-orange-400", anim: "animate-coin-fire" },
  "coin-style-ice": { icon: "text-sky-400 drop-shadow-sm", text: "text-sky-500 dark:text-sky-400", anim: "animate-coin-ice" },
  "coin-style-rainbow": { icon: "text-pink-500 drop-shadow-sm", text: "text-pink-500 dark:text-pink-400", anim: "animate-coin-rainbow" },
  "coin-style-plasma": { icon: "text-fuchsia-500 drop-shadow-sm", text: "text-fuchsia-600 dark:text-fuchsia-400", anim: "animate-coin-plasma" },
  "coin-style-void": { icon: "text-zinc-500 drop-shadow-sm", text: "text-zinc-600 dark:text-zinc-400", anim: "animate-coin-void" },
  "coin-style-champion": { icon: "text-amber-500 drop-shadow-sm", text: "text-amber-600 dark:text-amber-400", anim: "animate-coin-champion" },
  "coin-style-toxic": { icon: "text-lime-500 drop-shadow-sm", text: "text-lime-600 dark:text-lime-400", anim: "animate-coin-toxic" },
  "coin-style-nebula": { icon: "text-indigo-600 drop-shadow-sm", text: "text-indigo-700 dark:text-indigo-400", anim: "animate-coin-nebula" },
  "coin-style-supreme-champion": { icon: "text-yellow-400 drop-shadow-sm", text: "text-yellow-500 dark:text-yellow-300", anim: "animate-coin-champion" },
  "coin-style-clan-champion": { icon: "text-sky-400 drop-shadow-sm", text: "text-sky-500 dark:text-sky-400", anim: "animate-coin-ice" },
  "coin-style-team-champion": { icon: "text-fuchsia-500 drop-shadow-sm", text: "text-fuchsia-600 dark:text-fuchsia-400", anim: "animate-coin-plasma" },
};

const GEM_STYLE_COLORS: Record<string, { icon: string; text: string; anim: string }> = {
  "gem-style-emerald": { icon: "text-emerald-500 drop-shadow-sm", text: "text-emerald-600 dark:text-emerald-400", anim: "animate-gem-emerald" },
  "gem-style-ruby": { icon: "text-rose-500 drop-shadow-sm", text: "text-rose-600 dark:text-rose-400", anim: "animate-gem-ruby" },
  "gem-style-sapphire": { icon: "text-blue-500 drop-shadow-sm", text: "text-blue-600 dark:text-blue-400", anim: "animate-gem-sapphire" },
  "gem-style-cosmic": { icon: "text-violet-500 drop-shadow-sm", text: "text-violet-600 dark:text-violet-400", anim: "animate-gem-cosmic" },
  "gem-style-lightning": { icon: "text-yellow-300 drop-shadow-sm", text: "text-yellow-400 dark:text-yellow-300", anim: "animate-gem-lightning" },
  "gem-style-void": { icon: "text-purple-900 drop-shadow-sm", text: "text-purple-950 dark:text-purple-400", anim: "animate-gem-void" },
  "gem-style-champion": { icon: "text-orange-400 drop-shadow-sm", text: "text-orange-500 dark:text-orange-300", anim: "animate-gem-champion" },
  "gem-style-frost": { icon: "text-teal-400 drop-shadow-sm", text: "text-teal-500 dark:text-teal-400", anim: "animate-gem-frost" },
  "gem-style-magma": { icon: "text-red-700 drop-shadow-sm", text: "text-red-800 dark:text-red-500", anim: "animate-gem-magma" },
  "gem-style-supreme-champion": { icon: "text-yellow-400 drop-shadow-sm", text: "text-yellow-500 dark:text-yellow-300", anim: "animate-gem-champion" },
  "gem-style-clan-champion": { icon: "text-sky-400 drop-shadow-sm", text: "text-sky-500 dark:text-sky-400", anim: "animate-gem-frost" },
  "gem-style-team-champion": { icon: "text-fuchsia-500 drop-shadow-sm", text: "text-fuchsia-600 dark:text-fuchsia-400", anim: "animate-gem-cosmic" },
};

const ITEM_CARD_EFFECTS: Record<string, string> = {
  "badge-glow": "animate-item-glow",
  "badge-sparkle": "animate-item-sparkle",
  "badge-flame": "animate-item-fire",
  "badge-rainbow": "animate-item-rainbow",
  "badge-crystal": "animate-item-ice",
  "badge-neon": "animate-item-electric",
  "badge-hologram": "animate-item-cosmic",
  "badge-legendary": "animate-item-sparkle",
  "coin-style-diamond": "animate-item-sparkle",
  "coin-style-fire": "animate-item-fire",
  "coin-style-ice": "animate-item-ice",
  "coin-style-rainbow": "animate-item-rainbow",
  "gem-style-emerald": "animate-item-glow",
  "gem-style-ruby": "animate-item-fire",
  "gem-style-sapphire": "animate-item-ice",
  "gem-style-cosmic": "animate-item-cosmic",
  "frame-fire": "animate-item-fire",
  "frame-ice": "animate-item-ice",
  "frame-lightning": "animate-item-electric",
  "frame-rainbow": "animate-item-rainbow",
  "frame-galaxy": "animate-item-cosmic",
  "frame-golden": "animate-item-sparkle",
  "frame-void": "animate-item-cosmic",
  "frame-world-conqueror": "animate-item-sparkle",
  "frame-supreme-champion": "animate-item-sparkle",
  "frame-clan-champion": "animate-item-ice",
  "frame-team-champion": "animate-item-cosmic",
  "follower-supreme-champion": "animate-item-sparkle",
  "follower-clan-champion": "animate-item-ice",
  "follower-team-champion": "animate-item-cosmic",
  "badge-style-supreme-champion": "animate-item-sparkle",
  "badge-style-clan-champion": "animate-item-ice",
  "badge-style-team-champion": "animate-item-cosmic",
  "coin-style-supreme-champion": "animate-item-sparkle",
  "coin-style-clan-champion": "animate-item-ice",
  "coin-style-team-champion": "animate-item-cosmic",
  "gem-style-supreme-champion": "animate-item-sparkle",
  "gem-style-clan-champion": "animate-item-ice",
  "gem-style-team-champion": "animate-item-cosmic",
  "theme-rainbow": "animate-item-rainbow",
  "theme-gold": "animate-item-sparkle",
  "theme-supreme-champion": "animate-item-sparkle",
  "deco-aurora": "animate-item-shimmer",
  "deco-galaxy": "animate-item-cosmic",
  "deco-nebula": "animate-item-cosmic",
  "deco-lightning": "animate-item-electric",
  "deco-lightning-storm": "animate-item-electric",
  "deco-crystal-shimmer": "animate-item-sparkle",
  "deco-particle-field": "animate-item-cosmic",
  "follower-lightning": "animate-item-electric",
  "follower-sparkle": "animate-item-sparkle",
  "follower-comet": "animate-item-fire",
};

const EQUIPPABLE_CATEGORIES_CONST = ["follower", "decoration", "badge_style", "theme", "title", "frame", "coin_style", "gem_style", "profile_animation", "name_animation"];

const UPGRADEABLE_CATEGORIES = new Set(["powerup", "upgrade", "battle_powerup"]);
const UPGRADE_COSTS: Record<number, number> = { 1: 200, 2: 500 };
const UPGRADE_MAX = 2;

function ItemCard({ item, i, userInventory, userCoins, userLevel, userXp, userRebirth, userAvatarId, isAdmin, equippedCosmetics, equipMutation, equipCosmeticMutation, refundMutation, buyMutation, upgradeMutation, itemLevels, justUpgradedId }: {
  item: ShopItem; i: number; userInventory: string[]; userCoins: number; userLevel: number; userXp: number; userRebirth: number; userAvatarId: string; isAdmin: boolean; equippedCosmetics: Record<string, string>;
  equipMutation: any; equipCosmeticMutation: any; refundMutation: any; buyMutation: any; upgradeMutation: any; itemLevels: Record<string, number>; justUpgradedId: string | null;
}) {
  const owned = userInventory.includes(item.id);
  const canAfford = isAdmin || userCoins >= item.price;
  const levelLocked = !isAdmin && userLevel < item.requiredLevel;
  const rebirthLocked = !isAdmin && ((item as any).requiredRebirth || 0) > 0 && userRebirth < (item as any).requiredRebirth;
  const xpLocked = !isAdmin && ((item as any).requiredXp || 0) > 0 && userXp < (item as any).requiredXp;
  const isReward = !isAdmin && !!(item as any).rewardSource;
  const anyLocked = (levelLocked || rebirthLocked || xpLocked || isReward) && !owned;
  const IconComp = ICON_MAP[item.icon] || Star;
  const cardEffect = ITEM_CARD_EFFECTS[item.id] || "";
  const currentLevel = (itemLevels || {})[item.id] || 0;
  const justUpgraded = justUpgradedId === item.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={justUpgraded ? { opacity: 1, y: 0, scale: [1, 1.06, 1.03, 1] } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: justUpgraded ? 0.5 : 0.3, delay: justUpgraded ? 0 : i * 0.04 }}
    >
      <Card className={`p-5 border-border relative overflow-hidden ${cardEffect} ${owned ? "opacity-75" : ""} ${anyLocked ? "opacity-50" : ""} ${isReward && !owned ? "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5" : ""} ${isReward && owned ? "border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5" : ""} ${justUpgraded ? "ring-4 ring-yellow-400 ring-offset-2 ring-offset-background border-yellow-400/60" : ""}`} data-testid={`card-item-${item.id}`}>
        {justUpgraded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], y: [20, 0, -8, -24], scale: [0.7, 1.1, 1, 0.9] }}
            transition={{ duration: 1.8, times: [0, 0.2, 0.6, 1] }}
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <span className="bg-yellow-400 text-yellow-900 font-black text-lg px-4 py-2 rounded-full shadow-lg shadow-yellow-400/40 tracking-wide">
              ⬆ LEVEL UP!
            </span>
          </motion.div>
        )}
        <div className="flex items-center justify-between mb-3">
          <Badge className={`text-[10px] font-bold border ${RARITY_COLORS[item.rarity]}`}>
            {item.rarity.toUpperCase()}
          </Badge>
          {isReward ? (
            <Badge variant="outline" className="text-xs font-semibold text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
              <Gift className="w-3 h-3" /> {CATEGORY_LABELS[item.category] || item.category}
            </Badge>
          ) : item.category === "powerup" ? (
            <Badge variant="outline" className="text-xs font-semibold text-green-600 dark:text-green-400 border-green-500/30 gap-1">
              <Check className="w-3 h-3" /> Permanent
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs font-semibold capitalize">
              {CATEGORY_LABELS[item.category] || item.category}
            </Badge>
          )}
        </div>

        <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-3 relative ${isReward ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20" : "bg-gradient-to-br from-purple-500/20 to-blue-500/20"}`}>
          <IconComp className={`w-8 h-8 ${isReward ? "text-amber-600 dark:text-amber-400" : "text-purple-500"}`} />
          {anyLocked && (
            <div className="absolute inset-0 rounded-xl bg-background/60 flex items-center justify-center">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>

        <h3 className="font-bold text-center">{item.name}</h3>
        <p className="text-xs text-muted-foreground text-center mt-1 mb-3">{item.description}</p>

        <div className="flex flex-wrap justify-center gap-1 mb-2">
          {levelLocked && !owned && (
            <Badge variant="secondary" className="text-[10px] font-bold gap-1">
              <Lock className="w-3 h-3" /> Level {item.requiredLevel}
            </Badge>
          )}
          {rebirthLocked && !owned && (
            <Badge variant="secondary" className="text-[10px] font-bold gap-1 bg-pink-500/10 text-pink-500 border-pink-500/20">
              <RotateCcw className="w-3 h-3" /> Rebirth {(item as any).requiredRebirth}
            </Badge>
          )}
          {xpLocked && !owned && (
            <Badge variant="secondary" className="text-[10px] font-bold gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20">
              <Zap className="w-3 h-3" /> {((item as any).requiredXp || 0).toLocaleString()} XP
            </Badge>
          )}
          {isReward && !owned && (
            <Badge variant="secondary" className="text-[10px] font-bold gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              <Gift className="w-3 h-3" /> {REWARD_SOURCE_LABELS[(item as any).rewardSource] || (item as any).rewardSource}
            </Badge>
          )}
          {isReward && owned && (
            <>
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                <Check className="w-3 h-3" /> Unlocked
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-bold gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                <Gift className="w-3 h-3" /> {REWARD_SOURCE_LABELS[(item as any).rewardSource] || (item as any).rewardSource}
              </Badge>
            </>
          )}
          {!levelLocked && !rebirthLocked && !xpLocked && !isReward && !owned && (item as any).requiredRebirth > 0 && (
            <Badge variant="secondary" className="text-[10px] font-bold gap-1 bg-green-500/10 text-green-500">
              <Check className="w-3 h-3" /> Rebirth {(item as any).requiredRebirth}
            </Badge>
          )}
          {!levelLocked && !rebirthLocked && !xpLocked && !isReward && !owned && (item as any).requiredXp > 0 && (
            <Badge variant="secondary" className="text-[10px] font-bold gap-1 bg-green-500/10 text-green-500">
              <Check className="w-3 h-3" /> {((item as any).requiredXp).toLocaleString()} XP
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          {isReward ? (
            <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
              <Gift className="w-4 h-4" /> Free
            </span>
          ) : (
            <span className="flex items-center gap-1 font-bold text-yellow-600 dark:text-yellow-400">
              <Coins className="w-4 h-4" /> {item.price}
            </span>
          )}

          {owned ? (
            <div className="flex items-center gap-1.5">
              {item.category === "avatar" ? (
                userAvatarId === item.id ? (
                  <Badge variant="default" className="font-bold gap-1 bg-green-600 dark:bg-green-700">
                    <Check className="w-3 h-3" /> Equipped
                  </Badge>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="font-bold text-xs"
                      disabled={equipMutation.isPending}
                      onClick={() => equipMutation.mutate(item.id)}
                      data-testid={`button-equip-${item.id}`}
                    >
                      Equip
                    </Button>
                    {!isReward && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="font-bold text-xs"
                        disabled={refundMutation.isPending}
                        onClick={() => refundMutation.mutate(item.id)}
                        data-testid={`button-refund-${item.id}`}
                      >
                        <Undo2 className="w-3 h-3" />
                      </Button>
                    )}
                  </>
                )
              ) : EQUIPPABLE_CATEGORIES_CONST.includes(item.category) ? (
                <>
                  {equippedCosmetics[item.category] === item.id ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="font-bold text-xs bg-green-600/20 dark:bg-green-600/30 border-green-600/40 text-green-600 dark:text-green-400"
                      disabled={equipCosmeticMutation.isPending}
                      onClick={() => equipCosmeticMutation.mutate({ itemId: item.id, category: item.category })}
                      data-testid={`button-unequip-${item.id}`}
                    >
                      <Check className="w-3 h-3 mr-1" /> Equipped
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-bold text-xs"
                      disabled={equipCosmeticMutation.isPending}
                      onClick={() => equipCosmeticMutation.mutate({ itemId: item.id, category: item.category })}
                      data-testid={`button-equip-${item.id}`}
                    >
                      Equip
                    </Button>
                  )}
                  {!isReward && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="font-bold text-xs"
                      disabled={refundMutation.isPending || equippedCosmetics[item.category] === item.id}
                      onClick={() => refundMutation.mutate(item.id)}
                      data-testid={`button-refund-${item.id}`}
                    >
                      <Undo2 className="w-3 h-3" />
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Badge variant="secondary" className="font-bold gap-1 text-xs">
                    <Check className="w-3 h-3" /> Owned
                  </Badge>
                  {UPGRADEABLE_CATEGORIES.has(item.category) && (
                    currentLevel >= UPGRADE_MAX ? (
                      <Badge variant="secondary" className="font-bold text-xs gap-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                        <Star className="w-3 h-3" /> Max Lv
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-bold text-xs gap-0.5 border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                        disabled={upgradeMutation.isPending || userCoins < (UPGRADE_COSTS[currentLevel + 1] || 0)}
                        onClick={() => upgradeMutation.mutate(item.id)}
                        data-testid={`button-upgrade-${item.id}`}
                      >
                        <Plus className="w-3 h-3" /> Lv{currentLevel + 1} ({UPGRADE_COSTS[currentLevel + 1]})
                      </Button>
                    )
                  )}
                  {currentLevel > 0 && UPGRADEABLE_CATEGORIES.has(item.category) && (
                    <motion.div animate={justUpgraded ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.4 }}>
                      <Badge variant="secondary" className={`font-bold text-xs gap-1 transition-all duration-300 ${justUpgraded ? "bg-yellow-400 text-yellow-900 border-yellow-500 shadow-sm shadow-yellow-400/50" : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"}`}>
                        {justUpgraded ? "✦" : ""} Lv {currentLevel}
                      </Badge>
                    </motion.div>
                  )}
                  {!isReward && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="font-bold text-xs"
                      disabled={refundMutation.isPending}
                      onClick={() => refundMutation.mutate(item.id)}
                      data-testid={`button-refund-${item.id}`}
                    >
                      <Undo2 className="w-3 h-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : isReward ? (
            <Badge variant="secondary" className="font-bold gap-1 text-xs text-amber-600 dark:text-amber-400">
              <Gift className="w-3 h-3" /> Earn It!
            </Badge>
          ) : (
            <Button
              size="sm"
              className="font-bold"
              disabled={!canAfford || buyMutation.isPending || levelLocked || rebirthLocked || xpLocked}
              onClick={() => buyMutation.mutate(item.id)}
              data-testid={`button-buy-${item.id}`}
            >
              {buyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : (levelLocked || rebirthLocked || xpLocked) ? <Lock className="w-3 h-3" /> : "Buy"}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default function ShopPage() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [justUpgradedId, setJustUpgradedId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop"],
  });

  const { toast } = useToast();

  const buyMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("POST", "/api/shop/buy", { itemId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Purchased!", description: "Item added to your collection." });
    },
    onError: (err: any) => {
      toast({ title: "Can't buy", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const equipMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      const res = await apiRequest("PATCH", "/api/user/progress", { avatarId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const avatarName = data?.avatarId || "avatar";
      toast({ title: "Equipped!", description: `Your new avatar is now active.` });
    },
  });

  const equipCosmeticMutation = useMutation({
    mutationFn: async ({ itemId, category }: { itemId: string; category: string }) => {
      const res = await apiRequest("POST", "/api/shop/equip-cosmetic", { itemId, category });
      return res.json();
    },
    onSuccess: (data: any, variables) => {
      const userData = data?.user || data;
      if (userData?.id) {
        queryClient.setQueryData(["/api/user"], userData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const updatedCosmetics = userData?.equippedCosmetics || {};
      const nowEquipped = updatedCosmetics[variables.category] === variables.itemId;
      toast({ title: nowEquipped ? "Equipped!" : "Unequipped!", description: nowEquipped ? "Your cosmetic is now active." : "Item has been unequipped." });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("POST", "/api/shop/refund", { itemId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const currency = data.currency === "gems" ? "gems" : "coins";
      toast({ title: "Refunded!", description: `You got ${data.refundAmount} ${currency} back (50% refund).` });
    },
    onError: (err: any) => {
      toast({ title: "Can't refund", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const upgradeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("POST", `/api/shop/upgrade-item/${itemId}`, {});
      return res.json();
    },
    onSuccess: (data: any, itemId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setJustUpgradedId(itemId);
      setTimeout(() => setJustUpgradedId(null), 2000);
    },
    onError: (err: any) => {
      toast({ title: "Can't upgrade", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const { data: dailyRewardData, isLoading: dailyLoading } = useQuery<any>({
    queryKey: ["/api/shop/daily-reward"],
  });

  const claimDailyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shop/daily-reward/claim", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/daily-reward"] });
      const r = data.reward;
      let desc = `+${r.coins} Coins, +${r.xp} XP`;
      if (r.gems) desc += `, +${r.gems} Gems`;
      toast({ title: "Daily Reward Claimed!", description: desc });
    },
    onError: (err: any) => {
      toast({ title: "Can't claim", description: err.message || "Already claimed today!", variant: "destructive" });
    },
  });

  const { data: mysteryBoxData } = useQuery<any>({
    queryKey: ["/api/shop/mystery-boxes"],
  });

  const [openingBox, setOpeningBox] = useState<string | null>(null);
  const [boxResult, setBoxResult] = useState<{ type: string; label: string; amount: number; itemName?: string; itemCategory?: string } | null>(null);

  const openBoxMutation = useMutation({
    mutationFn: async (boxId: string) => {
      const res = await apiRequest("POST", "/api/shop/mystery-box/open", { boxId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/mystery-boxes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      setBoxResult(data.reward);
      setTimeout(() => setOpeningBox(null), 300);
    },
    onError: (err: any) => {
      setOpeningBox(null);
      toast({ title: "Can't open", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const buyUpgradeMutation = useMutation({
    mutationFn: async ({ upgradeId }: { upgradeId: string }) => {
      const res = await apiRequest("POST", "/api/shop/buy-upgrade", { upgradeId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const uses = data?.uses || 1;
      toast({ title: "Upgrade purchased!", description: `You now have ${uses} use${uses > 1 ? "s" : ""} of this upgrade!` });
    },
    onError: (err: any) => {
      toast({ title: "Can't buy", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const userInventory = (user as any)?.inventory || [];
  const userCoins = (user as any)?.coins || 0;
  const userGems = (user as any)?.gems || 0;
  const userLevel = (user as any)?.level || 1;
  const userXp = (user as any)?.xp || 0;
  const userRebirth = (user as any)?.rebirthLevel || 0;
  const userAvatarId = (user as any)?.avatarId || "scientist";
  const userIsAdmin = (user as any)?.isAdmin === true;
  const equippedCosmetics: Record<string, string> = (user as any)?.equippedCosmetics || {};
  const itemLevels: Record<string, number> = (user as any)?.itemLevels || {};

  const adminBeaterItems: ShopItem[] = (userInventory as string[])
    .filter((id: string) => id.startsWith("admin-beater:"))
    .filter((id: string) => !items.find(i => i.id === id))
    .map((id: string) => {
      const adminName = id.slice("admin-beater:".length);
      return {
        id,
        name: `${adminName} Beater`,
        description: `Earned by defeating admin ${adminName} in a Quiz Duel`,
        category: "title",
        price: 0,
        icon: "Swords",
        rarity: "legendary",
        requiredLevel: 1,
        requiredRebirth: 0,
        requiredXp: 0,
        rewardSource: "pvp:admin-beater",
      } as ShopItem;
    });
  const allItems = [...items, ...adminBeaterItems];

  const filteredItems = allItems
    .filter((item) => !WORLD_EXCLUSIVE_IDS.has(item.id))
    .filter((item) => {
      if (selectedCategory === "reward") return !!(item as any).rewardSource;
      if (selectedCategory === "daily" || selectedCategory === "mystery" || selectedCategory === "battle_powerup") return false;
      if (selectedCategory === "All") return true;
      return item.category === selectedCategory;
    })
    .sort((a, b) => {
      const aReward = (a as any).rewardSource ? 1 : 0;
      const bReward = (b as any).rewardSource ? 1 : 0;
      if (aReward !== bReward) return aReward - bReward;
      const RARITY_ORDER: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
      if (a.price !== b.price) return a.price - b.price;
      return (RARITY_ORDER[a.rarity] || 0) - (RARITY_ORDER[b.rarity] || 0);
    });

  const showUpgrades = selectedCategory === "All" || selectedCategory === "upgrade";
  const showDaily = selectedCategory === "All" || selectedCategory === "daily";
  const showMystery = selectedCategory === "All" || selectedCategory === "mystery";
  const showBattlePowerups = selectedCategory === "All" || selectedCategory === "battle_powerup";

  const { data: battlePowerupData } = useQuery<any>({
    queryKey: ["/api/battle-powerups"],
  });

  const upgradeUses: Record<string, number> = (user as any)?.upgradeExpirations || {};

  function getUpgradeUsesCount(upgradeId: string): number {
    return upgradeUses[upgradeId] || 0;
  }

  function isUpgradeActiveClient(upgradeId: string): boolean {
    return getUpgradeUsesCount(upgradeId) > 0;
  }

  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});

  const buyBattlePowerupMutation = useMutation({
    mutationFn: async ({ powerupId, quantity }: { powerupId: string; quantity: number }) => {
      const res = await apiRequest("POST", "/api/shop/buy-battle-powerup", { powerupId, quantity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle-powerups"] });
      toast({ title: "Purchased!", description: "Battle powerup added to your arsenal." });
    },
    onError: (err: any) => {
      toast({ title: "Can't buy", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const MYSTERY_BOX_STYLES: Record<string, { gradient: string; border: string; icon: string; glow: string }> = {
    bronze: { gradient: "from-amber-700/30 to-orange-800/30", border: "border-amber-600/30", icon: "text-amber-500", glow: "shadow-amber-500/20" },
    silver: { gradient: "from-gray-400/20 to-slate-500/20", border: "border-gray-400/30", icon: "text-gray-300", glow: "shadow-gray-400/20" },
    gold: { gradient: "from-yellow-400/20 to-amber-500/20", border: "border-yellow-500/30", icon: "text-yellow-400", glow: "shadow-yellow-400/30" },
  };

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-purple-500" /> Science Shop
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Spend your hard-earned coins on cool stuff!
          </p>
        </div>
        <div className="flex gap-3 self-start md:self-auto flex-wrap">
          {(() => {
            const coinStyle = COIN_STYLE_COLORS[equippedCosmetics.coin_style];
            const gemStyle = GEM_STYLE_COLORS[equippedCosmetics.gem_style];
            const coinIconClass = coinStyle?.icon || "text-yellow-500";
            const coinTextClass = coinStyle?.text || "";
            const coinAnim = coinStyle?.anim || "";
            const gemIconClass = gemStyle?.icon || "text-orange-400";
            const gemTextClass = gemStyle?.text || "text-orange-600 dark:text-orange-300";
            const gemAnim = gemStyle?.anim || "";
            return (
              <>
                <Badge variant="secondary" className={`text-lg font-bold px-4 py-2 gap-2 ${coinTextClass} ${coinAnim}`}>
                  <Coins className={`w-5 h-5 ${coinIconClass}`} /> {userCoins.toLocaleString()} Coins
                </Badge>
                <Badge variant="secondary" className={`text-lg font-bold px-4 py-2 gap-2 bg-orange-500/10 border-orange-500/30 ${gemTextClass} ${gemAnim}`}>
                  <Gem className={`w-5 h-5 ${gemIconClass}`} /> {userGems.toLocaleString()} Gems
                </Badge>
              </>
            );
          })()}
          <Badge variant="outline" className="text-sm font-bold px-3 py-2 gap-1.5">
            <Star className="w-4 h-4 text-purple-500" /> Lv.{userLevel}
          </Badge>
          {userRebirth > 0 && (
            <Badge variant="outline" className="text-sm font-bold px-3 py-2 gap-1.5 bg-pink-500/10 border-pink-500/30">
              <RotateCcw className="w-4 h-4 text-pink-500" /> Rebirth {userRebirth}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => {
          const CatIcon = CATEGORY_ICONS[cat] || ShoppingBag;
          return (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="font-semibold text-xs gap-1.5"
              data-testid={`button-filter-${cat}`}
            >
              <CatIcon className="w-3.5 h-3.5" />
              {CATEGORY_LABELS[cat]}
            </Button>
          );
        })}
      </div>

      {showDaily && (
        <div className="mb-8">
          <h2 className="text-2xl font-black flex items-center gap-2 mb-2" data-testid="text-daily-rewards-title">
            <Calendar className="w-6 h-6 text-emerald-500" /> Daily Rewards
          </h2>
          <p className="text-sm text-muted-foreground mb-4 font-medium">
            Come back every day to claim free rewards! 7-day streak = bonus gems!
          </p>
          {dailyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : dailyRewardData ? (
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Badge variant="secondary" className="text-sm font-bold gap-1.5 px-3 py-1.5">
                  <Flame className="w-4 h-4 text-orange-500" /> {dailyRewardData.streak} Day Streak
                </Badge>
                {dailyRewardData.alreadyClaimed && (
                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-sm font-bold gap-1.5">
                    <Check className="w-4 h-4" /> Claimed Today
                  </Badge>
                )}
              </div>
              {userInventory.includes("upgrade-daily-gems") && (
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">
                  <Gem className="w-3.5 h-3.5 shrink-0" /> Daily Gem Upgrade active — you earn +2 bonus gems every single day!
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {(dailyRewardData.rewards || []).map((reward: any, idx: number) => {
                  const isToday = idx === dailyRewardData.dayIndex;
                  const isPast = idx < dailyRewardData.dayIndex;
                  const isBonusDay = idx === 6;
                  const bonusGems = userInventory.includes("upgrade-daily-gems") ? 2 : 0;
                  const displayGems = (reward.gems || 0) + bonusGems;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                    >
                      <Card
                        className={`p-4 text-center relative overflow-hidden transition-all ${
                          isToday && !dailyRewardData.alreadyClaimed
                            ? "border-2 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/20"
                            : isToday && dailyRewardData.alreadyClaimed
                            ? "border-2 border-green-500/50 opacity-75"
                            : isPast && dailyRewardData.alreadyClaimed
                            ? "opacity-50 border-border"
                            : isBonusDay
                            ? "border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-amber-500/5"
                            : "border-border"
                        }`}
                        data-testid={`daily-reward-day-${idx}`}
                      >
                        {isPast && dailyRewardData.alreadyClaimed && (
                          <div className="absolute top-1 right-1">
                            <Check className="w-4 h-4 text-green-500" />
                          </div>
                        )}
                        <p className={`text-xs font-bold mb-2 ${isBonusDay ? "text-yellow-500" : "text-muted-foreground"}`}>
                          {reward.label}
                        </p>
                        <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${
                          isBonusDay ? "bg-gradient-to-br from-yellow-500/20 to-amber-500/20" : "bg-gradient-to-br from-emerald-500/10 to-cyan-500/10"
                        }`}>
                          {isBonusDay ? <Sparkles className="w-5 h-5 text-yellow-500" /> : <Gift className="w-5 h-5 text-emerald-500" />}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold flex items-center justify-center gap-1">
                            <Coins className="w-3 h-3 text-yellow-500" /> {reward.coins}
                          </p>
                          <p className="text-xs font-semibold flex items-center justify-center gap-1 text-muted-foreground">
                            <Zap className="w-3 h-3 text-blue-500" /> {reward.xp} XP
                          </p>
                          {displayGems > 0 && (
                            <p className="text-xs font-bold flex items-center justify-center gap-1 text-cyan-500">
                              <Gem className="w-3 h-3" /> +{displayGems}
                            </p>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
              {!dailyRewardData.alreadyClaimed && (
                <div className="mt-4 text-center">
                  <Button
                    size="lg"
                    className="gap-2 font-bold text-base px-8 bg-gradient-to-r from-emerald-500 to-cyan-500 border-0 text-white hover:opacity-90"
                    disabled={claimDailyMutation.isPending}
                    onClick={() => claimDailyMutation.mutate()}
                    data-testid="button-claim-daily-reward"
                  >
                    {claimDailyMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Gift className="w-5 h-5" />
                    )}
                    Claim Today's Reward
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {showMystery && (
        <div className="mb-8">
          <h2 className="text-2xl font-black flex items-center gap-2 mb-2" data-testid="text-mystery-boxes-title">
            <Package className="w-6 h-6 text-purple-500" /> Mystery Boxes
          </h2>
          <p className="text-sm text-muted-foreground mb-1 font-medium">
            Open a mystery box for a chance at coins, XP, gems, or a random shop item!
          </p>
          {mysteryBoxData && (
            <p className="text-xs text-muted-foreground mb-4">
              Total opened: <span className="font-bold">{mysteryBoxData.totalOpened}</span>
            </p>
          )}

          {boxResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6"
            >
              <Card className="p-6 border-2 border-purple-500/50 bg-gradient-to-br from-purple-500/10 to-pink-500/10 text-center max-w-md mx-auto">
                <motion.div
                  initial={{ rotate: -10, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                >
                  <PartyPopper className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                </motion.div>
                <h3 className="text-xl font-black mb-2">You Got:</h3>
                <div className="flex items-center justify-center gap-2 mb-3">
                  {boxResult.type === "coins" && <Coins className="w-6 h-6 text-yellow-500" />}
                  {boxResult.type === "xp" && <Zap className="w-6 h-6 text-blue-500" />}
                  {boxResult.type === "gems" && <Gem className="w-6 h-6 text-cyan-500" />}
                  {boxResult.type === "random_item" && <Sparkles className="w-6 h-6 text-purple-500" />}
                  <span className="text-lg font-black">{boxResult.label}</span>
                </div>
                {boxResult.type === "random_item" && boxResult.itemName && (
                  <div className="mb-2">
                    {boxResult.itemCategory && (
                      <p className="text-xs text-purple-400 font-bold uppercase tracking-wide mb-1">
                        {({
                          theme: "UI Theme",
                          avatar: "Avatar Skin",
                          decoration: "Screen Effect",
                          follower: "Mouse Follower",
                          frame: "Profile Frame",
                          coin_style: "Coin Style",
                          gem_style: "Gem Style",
                          badge_style: "Badge Style",
                          title: "Title",
                          powerup: "Power-Up",
                        } as Record<string, string>)[boxResult.itemCategory] || boxResult.itemCategory}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground font-medium">
                      Added to your inventory! Find it in the Shop under{" "}
                      <span className="font-bold text-foreground">
                        {({
                          theme: "Themes",
                          avatar: "Avatars",
                          decoration: "Decorations",
                          follower: "Mouse Followers",
                          frame: "Frames",
                          coin_style: "Coin Styles",
                          gem_style: "Gem Styles",
                          badge_style: "Badge Styles",
                          title: "Titles",
                          powerup: "Power-Ups",
                        } as Record<string, string>)[boxResult.itemCategory] || "your items"}
                      </span>.
                    </p>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold"
                  onClick={() => setBoxResult(null)}
                  data-testid="button-dismiss-box-result"
                >
                  Continue
                </Button>
              </Card>
            </motion.div>
          )}

          <div className="grid sm:grid-cols-3 gap-4">
            {(mysteryBoxData?.boxes || []).map((box: any, i: number) => {
              const style = MYSTERY_BOX_STYLES[box.id] || MYSTERY_BOX_STYLES.bronze;
              const canAffordCoins = box.coinCost === 0 || userCoins >= box.coinCost;
              const canAffordGems = box.gemCost === 0 || userGems >= box.gemCost;
              const canOpen = !box.locked && canAffordCoins && canAffordGems;
              const isOpening = openingBox === box.id;

              return (
                <motion.div
                  key={box.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                >
                  <Card className={`p-5 border ${style.border} bg-gradient-to-br ${style.gradient} relative overflow-hidden ${box.locked ? "opacity-50" : ""}`} data-testid={`card-mystery-box-${box.id}`}>
                    {box.locked && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10 rounded-md">
                        <div className="text-center">
                          <Lock className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                          <p className="text-xs font-bold text-muted-foreground">Level {box.minLevel}</p>
                        </div>
                      </div>
                    )}

                    <div className="text-center mb-4">
                      <motion.div
                        className={`w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-gradient-to-br ${style.gradient} shadow-lg ${style.glow} border ${style.border}`}
                        whileHover={!box.locked ? { scale: 1.05, rotate: [0, -3, 3, 0] } : {}}
                        animate={isOpening ? { scale: [1, 1.2, 0.8, 1.1, 1], rotate: [0, -10, 10, -5, 0] } : {}}
                        transition={isOpening ? { duration: 0.8 } : {}}
                      >
                        <Package className={`w-10 h-10 ${style.icon}`} />
                      </motion.div>
                      <h3 className="text-lg font-black">{box.name}</h3>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      {box.rewards.map((r: any, ri: number) => (
                        <div key={ri} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium flex items-center gap-1">
                            {r.type === "coins" && <Coins className="w-3 h-3 text-yellow-500" />}
                            {r.type === "xp" && <Zap className="w-3 h-3 text-blue-500" />}
                            {r.type === "gems" && <Gem className="w-3 h-3 text-cyan-500" />}
                            {r.type === "random_item" && <HelpCircle className="w-3 h-3 text-purple-500" />}
                            {r.label}
                          </span>
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {Math.round(r.chance * 100)}%
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 font-bold text-sm">
                        {box.coinCost > 0 && (
                          <span className={`flex items-center gap-1 ${canAffordCoins ? "text-yellow-600 dark:text-yellow-400" : "text-red-500"}`}>
                            <Coins className="w-4 h-4" /> {box.coinCost}
                          </span>
                        )}
                        {box.gemCost > 0 && (
                          <span className={`flex items-center gap-1 ${canAffordGems ? "text-cyan-600 dark:text-cyan-400" : "text-red-500"}`}>
                            <Gem className="w-4 h-4" /> {box.gemCost}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="font-bold gap-1.5"
                        disabled={!canOpen || openBoxMutation.isPending}
                        onClick={() => {
                          setOpeningBox(box.id);
                          setBoxResult(null);
                          openBoxMutation.mutate(box.id);
                        }}
                        data-testid={`button-open-box-${box.id}`}
                      >
                        {openBoxMutation.isPending && openingBox === box.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Package className="w-3.5 h-3.5" />
                        )}
                        Open
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {showBattlePowerups && (
        <div className="mb-8">
          <h2 className="text-2xl font-black flex items-center gap-2 mb-2" data-testid="text-battle-powerups-title">
            <Swords className="w-6 h-6 text-red-500" /> Battle Powerups
          </h2>
          <p className="text-sm text-muted-foreground mb-4 font-medium">
            Consumable items for boss fights and PvP battles. Use gems to stock up!
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(battlePowerupData?.powerups || []).map((bp: any, i: number) => {
              const IconComp = ICON_MAP[bp.icon] || Star;
              const qty = buyQuantities[bp.id] || 1;
              const totalCost = bp.price * qty;
              const canAfford = userGems >= totalCost;

              return (
                <motion.div
                  key={bp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card className="p-5 border-red-500/20 bg-gradient-to-br from-red-500/5 to-orange-500/5" data-testid={`card-battle-powerup-${bp.id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={`text-[10px] font-bold border ${RARITY_COLORS[bp.rarity]}`}>
                        {bp.rarity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-semibold text-orange-400 border-orange-500/30 gap-1">
                        <Swords className="w-3 h-3" /> Consumable
                      </Badge>
                    </div>

                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-3 relative">
                      <IconComp className="w-8 h-8 text-red-400" />
                      {bp.count > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {bp.count}
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-center" data-testid={`text-bp-name-${bp.id}`}>{bp.name}</h3>
                    <p className="text-xs text-muted-foreground text-center mt-1 mb-3">{bp.description}</p>

                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        disabled={qty <= 1}
                        onClick={() => setBuyQuantities(prev => ({ ...prev, [bp.id]: Math.max(1, qty - 1) }))}
                        data-testid={`button-bp-qty-minus-${bp.id}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-bold min-w-[24px] text-center" data-testid={`text-bp-qty-${bp.id}`}>{qty}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        disabled={qty >= 10}
                        onClick={() => setBuyQuantities(prev => ({ ...prev, [bp.id]: Math.min(10, qty + 1) }))}
                        data-testid={`button-bp-qty-plus-${bp.id}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-center">
                      <Button
                        size="sm"
                        className="font-bold bg-gradient-to-r from-red-500 to-orange-500 border-0 text-white hover:opacity-90 gap-1"
                        disabled={!canAfford || buyBattlePowerupMutation.isPending}
                        onClick={() => buyBattlePowerupMutation.mutate({ powerupId: bp.id, quantity: qty })}
                        data-testid={`button-buy-bp-${bp.id}`}
                      >
                        {buyBattlePowerupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Gem className="w-3 h-3" /> {totalCost} Gems</>}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : selectedCategory === "reward" ? (
        <div className="space-y-8">
          {REWARD_GROUPS.map((group) => {
            const groupItems = allItems.filter(item => {
              const src = (item as any).rewardSource;
              return src && group.match(src);
            });
            if (groupItems.length === 0) return null;
            const GroupIcon = group.icon;
            return (
              <div key={group.key} data-testid={`reward-group-${group.key}`}>
                <div className="flex items-center gap-2 mb-4">
                  <GroupIcon className="w-5 h-5 text-amber-500" />
                  <h2 className="text-xl font-black text-foreground" data-testid={`text-reward-group-${group.key}`}>{group.label}</h2>
                  <Badge variant="secondary" className="text-xs font-bold" data-testid={`badge-count-${group.key}`}>{groupItems.length} items</Badge>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupItems.map((item, i) => (
                    <ItemCard key={item.id} item={item} i={i} userInventory={userInventory} userCoins={userCoins} userLevel={userLevel} userXp={userXp} userRebirth={userRebirth} userAvatarId={userAvatarId} isAdmin={userIsAdmin} equippedCosmetics={equippedCosmetics} equipMutation={equipMutation} equipCosmeticMutation={equipCosmeticMutation} refundMutation={refundMutation} buyMutation={buyMutation} upgradeMutation={upgradeItemMutation} itemLevels={itemLevels} justUpgradedId={justUpgradedId} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item, i) => (
            <ItemCard key={item.id} item={item} i={i} userInventory={userInventory} userCoins={userCoins} userLevel={userLevel} userXp={userXp} userRebirth={userRebirth} userAvatarId={userAvatarId} isAdmin={userIsAdmin} equippedCosmetics={equippedCosmetics} equipMutation={equipMutation} equipCosmeticMutation={equipCosmeticMutation} refundMutation={refundMutation} buyMutation={buyMutation} upgradeMutation={upgradeItemMutation} itemLevels={itemLevels} justUpgradedId={justUpgradedId} />
          ))}
        </div>
      )}

      {showUpgrades && (
        <div className="mt-8">
          <h2 className="text-2xl font-black flex items-center gap-2 mb-4">
            <Gem className="w-6 h-6 text-orange-400" /> Gem Upgrades
          </h2>
          <p className="text-sm text-muted-foreground mb-4 font-medium">
            Spend gems earned from boosting community packs on powerful upgrades!
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...GEM_UPGRADES].sort((a, b) => {
              const RARITY_ORDER: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
              if (a.price !== b.price) return a.price - b.price;
              return (RARITY_ORDER[a.rarity] || 0) - (RARITY_ORDER[b.rarity] || 0);
            }).map((upgrade, i) => {
              const uses = getUpgradeUsesCount(upgrade.id);
              const isCosmeticUpgrade = COSMETIC_UPGRADE_IDS.has(upgrade.id);
              const active = isCosmeticUpgrade ? userInventory.includes(upgrade.id) : uses > 0;
              const canAfford = userGems >= upgrade.price;
              const levelLocked = upgrade.requiredLevel ? userLevel < upgrade.requiredLevel : false;
              const IconComp = ICON_MAP[upgrade.icon] || Star;
              const canRefund = active && (isCosmeticUpgrade || uses > 0);

              return (
                <motion.div
                  key={upgrade.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card className={`p-5 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 ${active ? "ring-1 ring-green-500/40" : ""} ${levelLocked && !active ? "opacity-50" : ""}`} data-testid={`card-upgrade-${upgrade.id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={`text-[10px] font-bold border ${RARITY_COLORS[upgrade.rarity]}`}>
                        {upgrade.rarity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-semibold text-purple-400 border-purple-500/30">
                        {isCosmeticUpgrade ? "Permanent" : "Per Use"}
                      </Badge>
                    </div>

                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center mx-auto mb-3 relative">
                      <IconComp className="w-8 h-8 text-orange-400" />
                      {levelLocked && !active && (
                        <div className="absolute inset-0 rounded-xl bg-background/60 flex items-center justify-center">
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-center">{upgrade.name}</h3>
                    <p className="text-xs text-muted-foreground text-center mt-1 mb-3">{upgrade.description}</p>

                    {active && (
                      <div className="text-center mb-2">
                        <Badge className="text-[10px] font-bold gap-1 bg-green-500/20 text-green-400 border-green-500/30">
                          <Check className="w-3 h-3" /> {isCosmeticUpgrade ? "Active" : `${uses} use${uses > 1 ? "s" : ""} remaining`}
                        </Badge>
                      </div>
                    )}

                    {levelLocked && !active && (
                      <div className="text-center mb-2">
                        <Badge variant="secondary" className="text-[10px] font-bold gap-1">
                          <Lock className="w-3 h-3" /> Requires Level {upgrade.requiredLevel}
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 font-bold text-orange-500">
                        <Gem className="w-4 h-4" /> {upgrade.price}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {canRefund && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="font-bold text-xs"
                            disabled={refundMutation.isPending}
                            onClick={() => refundMutation.mutate(upgrade.id)}
                            data-testid={`button-refund-upgrade-${upgrade.id}`}
                          >
                            <Undo2 className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="font-bold bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white hover:opacity-90"
                          disabled={!canAfford || buyUpgradeMutation.isPending || levelLocked || (isCosmeticUpgrade && active)}
                          onClick={() => buyUpgradeMutation.mutate({ upgradeId: upgrade.id })}
                          data-testid={`button-buy-upgrade-${upgrade.id}`}
                        >
                          {buyUpgradeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : levelLocked ? <Lock className="w-3 h-3" /> : (isCosmeticUpgrade && active) ? "Owned" : active ? "Buy More" : "Buy"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
