// Single source of truth for resolving a user's avatar id → an icon + gradient.
// Used by the Navbar, Leaderboard, profile modals, clans/teams — anywhere an avatar
// is shown — so a new avatar added to SHOP_AVATARS appears consistently EVERYWHERE.
//
// Resolution is data-driven: the icon comes from the avatar definition's `icon`
// field (via AVATAR_ICON_BY_NAME), so new avatars never need to be added here.
import {
  Rocket, FlaskConical, Bot, Sparkles, Swords, Wand2, Flame, Bird, Diamond, Star,
  Shield, Crown, Snowflake, Orbit, Skull, Moon, Trophy, Globe, Medal, Gem,
  Waves, Zap, Cpu, Atom, TreePine, Award, Gamepad2, Heart, Telescope, Mountain,
  Wind, Sun, Hexagon, Footprints, TrendingUp, GraduationCap, Calendar, RefreshCw,
  Users, Microscope, Infinity as InfinityIcon, Satellite, Brain, Tornado, Layers,
  Hourglass, Stethoscope, Cog, Anchor, User,
  type LucideIcon,
} from "lucide-react";
import { AVATARS, SHOP_AVATARS } from "@/lib/gameData";

// icon name (as stored on an avatar's `icon` field) → component
export const AVATAR_ICON_BY_NAME: Record<string, LucideIcon> = {
  Rocket, FlaskConical, Bot, Sparkles, Swords, Wand2, Flame, Bird, Diamond, Star,
  Shield, Crown, Snowflake, Orbit, Skull, Moon, Trophy, Globe, Medal, Gem,
  Waves, Zap, Cpu, Atom, TreePine, Award, Gamepad2, Heart, Telescope, Mountain,
  Wind, Sun, Hexagon, Footprints, TrendingUp, GraduationCap, Calendar, RefreshCw,
  Users, Microscope, Infinity: InfinityIcon, Satellite, Brain, Tornado, Layers,
  Hourglass, Stethoscope, Cog, Anchor, User,
};

// Per-id gradient (and a legacy icon fallback for ids not in the avatar lists).
export const AVATAR_GRADIENTS: Record<string, { icon: LucideIcon; gradient: string }> = {
  "astronaut": { icon: Rocket, gradient: "from-blue-500 to-indigo-600" },
  "scientist": { icon: FlaskConical, gradient: "from-green-500 to-emerald-600" },
  "avatar-robot": { icon: Bot, gradient: "from-gray-500 to-slate-600" },
  "avatar-alien": { icon: Sparkles, gradient: "from-violet-500 to-purple-600" },
  "avatar-ninja": { icon: Swords, gradient: "from-red-500 to-rose-600" },
  "avatar-wizard": { icon: Wand2, gradient: "from-amber-500 to-yellow-600" },
  "avatar-dragon": { icon: Flame, gradient: "from-orange-500 to-red-600" },
  "avatar-phoenix": { icon: Bird, gradient: "from-pink-500 to-rose-600" },
  "avatar-crystal": { icon: Diamond, gradient: "from-cyan-500 to-teal-600" },
  "avatar-galaxy": { icon: Telescope, gradient: "from-purple-500 to-fuchsia-600" },
  "avatar-frost": { icon: Snowflake, gradient: "from-sky-400 to-blue-600" },
  "avatar-comet": { icon: Orbit, gradient: "from-amber-400 to-orange-600" },
  "reward-plague-mask": { icon: Skull, gradient: "from-lime-500 to-green-700" },
  "reward-element-crown": { icon: Crown, gradient: "from-yellow-400 to-amber-600" },
  "reward-all-bosses": { icon: Trophy, gradient: "from-red-600 to-rose-800" },
  "reward-nebula-crown": { icon: Moon, gradient: "from-indigo-500 to-purple-700" },
  "avatar-kraken": { icon: Waves, gradient: "from-blue-600 to-cyan-800" },
  "avatar-magma-titan": { icon: Mountain, gradient: "from-red-600 to-orange-800" },
  "avatar-frost-wyrm": { icon: Wind, gradient: "from-cyan-400 to-blue-700" },
  "avatar-jungle-hydra": { icon: TreePine, gradient: "from-green-500 to-emerald-700" },
  "avatar-cosmic-entity": { icon: Sun, gradient: "from-amber-400 to-yellow-600" },
  "avatar-crystal-golem": { icon: Hexagon, gradient: "from-pink-400 to-purple-600" },
  "avatar-thunder-king": { icon: Zap, gradient: "from-yellow-400 to-amber-600" },
  "avatar-virus-prime": { icon: Cpu, gradient: "from-green-500 to-teal-700" },
  "avatar-rex-overlord": { icon: Footprints, gradient: "from-amber-500 to-orange-700" },
  "avatar-quantum-phantom": { icon: Atom, gradient: "from-violet-500 to-indigo-700" },
  "avatar-xp-rising": { icon: TrendingUp, gradient: "from-emerald-400 to-green-600" },
  "avatar-xp-veteran": { icon: GraduationCap, gradient: "from-blue-400 to-indigo-600" },
  "avatar-xp-master": { icon: Award, gradient: "from-purple-400 to-violet-600" },
  "avatar-xp-legend": { icon: Star, gradient: "from-yellow-400 to-amber-600" },
  "avatar-streak-master": { icon: Calendar, gradient: "from-orange-400 to-red-600" },
  "avatar-game-master": { icon: Gamepad2, gradient: "from-blue-500 to-purple-600" },
  "avatar-rebirth-phoenix": { icon: RefreshCw, gradient: "from-rose-400 to-pink-600" },
  "avatar-rebirth-titan": { icon: Shield, gradient: "from-slate-400 to-gray-700" },
  "reward-tournament-avatar": { icon: Medal, gradient: "from-yellow-400 to-orange-600" },
  "avatar-clan-champion": { icon: Globe, gradient: "from-blue-500 to-slate-700" },
  "avatar-team-champion": { icon: Users, gradient: "from-purple-500 to-violet-700" },
  "avatar-supreme-champion": { icon: Gem, gradient: "from-yellow-400 to-orange-600" },
  // Newer achievement avatars — nicer themed gradients (icons resolve via .icon).
  "avatar-spark-eternal": { icon: InfinityIcon, gradient: "from-fuchsia-500 to-purple-700" },
  "avatar-quantum-sage": { icon: Brain, gradient: "from-cyan-400 to-indigo-700" },
  "avatar-cosmos-sovereign": { icon: Satellite, gradient: "from-indigo-400 to-violet-700" },
  "avatar-elemental-lord": { icon: Tornado, gradient: "from-orange-500 to-red-700" },
  "avatar-viral-scientist": { icon: Microscope, gradient: "from-green-500 to-emerald-700" },
  "avatar-core-master": { icon: Layers, gradient: "from-purple-500 to-cyan-500" },
  "avatar-time-traveler": { icon: Hourglass, gradient: "from-amber-400 to-orange-700" },
  "avatar-micro-medic": { icon: Stethoscope, gradient: "from-rose-400 to-fuchsia-600" },
  "avatar-machine-master": { icon: Cog, gradient: "from-slate-400 to-zinc-700" },
  "avatar-abyss-explorer": { icon: Anchor, gradient: "from-sky-500 to-indigo-800" },
};

const ALL_AVATAR_DEFS = [...AVATARS, ...SHOP_AVATARS];

// Resolve any avatar id → { icon, gradient }. Icon comes from the avatar's `icon`
// field first (so newly-added avatars always work), then the id map, then a default.
export function resolveAvatarIcon(avatarId: string | null | undefined): { icon: LucideIcon; gradient: string } {
  const id = avatarId || "";
  const def = ALL_AVATAR_DEFS.find((a) => a.id === id);
  const byName = def ? AVATAR_ICON_BY_NAME[def.icon] : undefined;
  const idEntry = AVATAR_GRADIENTS[id];
  return {
    icon: byName || idEntry?.icon || Rocket,
    gradient: idEntry?.gradient || "from-purple-500 to-blue-500",
  };
}
