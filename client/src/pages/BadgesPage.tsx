import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Award, CheckCircle, Lock, Star, Trophy, Swords, FlaskConical,
  Rocket, Dna, Zap, Atom, TreePine, Puzzle, Shield, Flame, Bird,
  CloudLightning, Bug, Orbit, Timer, Crown, Calendar, GraduationCap,
  Sparkles, Pickaxe, Globe, Clock, Microscope, Moon, Cpu, Gamepad2,
  ShoppingCart, RotateCcw, Coins, Mountain, Link, Settings, Heart,
  Magnet, TrendingUp
} from "lucide-react";
import { BADGES } from "@/lib/gameData";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import type { BadgeRarity, BadgeTopic } from "@shared/schema";

const ICON_MAP: Record<string, any> = {
  Star, Rocket, Dna, Zap, Atom, TreePine, Puzzle, Shield, Flame, Bird,
  CloudLightning, Bug, Orbit, Timer, Crown, Calendar, GraduationCap,
  Trophy, Swords, FlaskConical, Sparkles, Pickaxe, Globe, Clock, Microscope,
  Moon, Cpu, Gamepad2, ShoppingCart, RotateCcw, Coins, Mountain, Link, Settings,
  Heart, Award, Magnet, TrendingUp,
};

type FilterType = "all" | "earned" | "locked";

const RARITY_ORDER: Record<BadgeRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const RARITY_COLORS: Record<BadgeRarity, { bg: string; text: string; border: string }> = {
  common: { bg: "bg-zinc-500/15", text: "text-zinc-400", border: "border-zinc-500/30" },
  uncommon: { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30" },
  rare: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
  epic: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" },
  legendary: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
};

const RARITY_CARD_BORDER: Record<BadgeRarity, string> = {
  common: "border-zinc-500/20",
  uncommon: "border-green-500/25",
  rare: "border-blue-500/30",
  epic: "border-purple-500/35",
  legendary: "border-amber-500/40",
};

const TOPIC_CATEGORIES: { id: BadgeTopic | "all"; label: string; icon: any }[] = [
  { id: "all", label: "All", icon: Award },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "bosses", label: "Bosses", icon: Swords },
  { id: "progression", label: "Progression", icon: Trophy },
  { id: "coins", label: "Neuros", icon: Coins },
  { id: "collection", label: "Collection", icon: GraduationCap },
  { id: "competitive", label: "Competitive", icon: Shield },
  { id: "social", label: "Social", icon: Heart },
  { id: "special", label: "Special", icon: Star },
];

const SECRET_BADGES = new Set([
  "void-vanquisher", "abyss-walker",
  "paradox-solver", "loop-breaker",
  "element-king", "titan-tamer",
  "master-builder", "machine-breaker",
  "dark-warden", "singularity-stopper-2", "universe-saver",
  "nano-tamer", "goo-buster", "nano-destroyer",
  "quantum-crusher", "reality-anchor", "loop-master",
  "atomic-ace", "bio-brain", "physics-phenom",
  "rocket-engineer-badge",
]);

function getBadgeStyleCSS(style: string, badgeColor: string): React.CSSProperties {
  switch (style) {
    case "badge-glow":
      return { boxShadow: `0 0 12px 3px ${badgeColor}55, 0 0 4px 1px ${badgeColor}33` };
    case "badge-sparkle":
      return {
        boxShadow: `0 0 8px 2px ${badgeColor}44`,
        animation: "badge-shimmer 2s ease-in-out infinite",
      };
    case "badge-flame":
      return {
        backgroundImage: `linear-gradient(135deg, ${badgeColor}26, rgba(239,68,68,0.15), rgba(249,115,22,0.2))`,
        boxShadow: "0 0 8px 2px rgba(249,115,22,0.25)",
      };
    case "badge-neon":
      return {
        boxShadow: `0 0 6px 1px ${badgeColor}66, inset 0 0 6px 1px ${badgeColor}22`,
        border: `1.5px solid ${badgeColor}88`,
      };
    case "badge-rainbow":
      return {
        border: "2px solid transparent",
        backgroundClip: "padding-box",
        boxShadow: "0 0 0 2px rgba(239,68,68,0.4), 0 0 0 3px rgba(234,179,8,0.4), 0 0 0 4px rgba(34,197,94,0.3), 0 0 0 5px rgba(59,130,246,0.3)",
      };
    case "badge-crystal":
      return {
        backgroundImage: "linear-gradient(135deg, rgba(147,197,253,0.2), rgba(219,234,254,0.1), rgba(147,197,253,0.15))",
        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.3), 0 0 6px rgba(147,197,253,0.3)",
        border: "1px solid rgba(147,197,253,0.3)",
      };
    case "badge-legendary":
      return {
        border: "2px solid rgba(234,179,8,0.6)",
        boxShadow: "0 0 10px 2px rgba(234,179,8,0.3)",
        animation: "badge-shimmer 3s ease-in-out infinite",
      };
    case "badge-hologram":
      return {
        backgroundImage: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(59,130,246,0.15), rgba(34,197,94,0.15), rgba(234,179,8,0.15))",
        boxShadow: "0 0 8px 2px rgba(168,85,247,0.2)",
        animation: "badge-shimmer 2.5s ease-in-out infinite",
      };
    case "reward-volcano-badge":
      return {
        border: "2px solid transparent",
        boxShadow: "0 0 0 2px rgba(239,68,68,0.5), 0 0 8px 2px rgba(249,115,22,0.4)",
        backgroundImage: "linear-gradient(180deg, rgba(239,68,68,0.15), rgba(249,115,22,0.2))",
      };
    case "badge-style-supreme-champion":
      return {
        border: "2px solid rgba(250,204,21,0.7)",
        boxShadow: "0 0 14px 4px rgba(250,204,21,0.35), 0 0 24px 8px rgba(234,179,8,0.2)",
        backgroundImage: "linear-gradient(135deg, rgba(250,204,21,0.15), rgba(234,179,8,0.1))",
        animation: "badge-shimmer 2s ease-in-out infinite",
      };
    case "badge-style-clan-champion":
      return {
        border: "2px solid rgba(56,189,248,0.6)",
        boxShadow: "0 0 10px 3px rgba(56,189,248,0.3), 0 0 18px 6px rgba(14,165,233,0.15)",
        backgroundImage: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(14,165,233,0.08))",
        animation: "badge-shimmer 2.5s ease-in-out infinite",
      };
    case "badge-style-team-champion":
      return {
        border: "2px solid rgba(217,70,239,0.6)",
        boxShadow: "0 0 10px 3px rgba(217,70,239,0.3), 0 0 18px 6px rgba(192,38,211,0.15)",
        backgroundImage: "linear-gradient(135deg, rgba(217,70,239,0.12), rgba(192,38,211,0.08))",
        animation: "badge-shimmer 2.5s ease-in-out infinite",
      };
    default:
      return {};
  }
}

export default function BadgesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>("all");
  const [topic, setTopic] = useState<BadgeTopic | "all">("all");
  const [selectedBadge, setSelectedBadge] = useState<typeof BADGES[0] | null>(null);

  const userBadges = (user as any)?.badges || [];
  const equippedBadgeStyle = (user as any)?.equippedCosmetics?.badge_style || "";
  const earnedCount = BADGES.filter(b => userBadges.includes(b.id)).length;

  const filteredBadges = BADGES.filter(badge => {
    const earned = userBadges.includes(badge.id);
    if (filter === "earned" && !earned) return false;
    if (filter === "locked" && earned) return false;
    if (topic !== "all" && badge.topic !== topic) return false;
    return true;
  }).sort((a, b) => {
    const aSecret = SECRET_BADGES.has(a.id) ? 1 : 0;
    const bSecret = SECRET_BADGES.has(b.id) ? 1 : 0;
    if (aSecret !== bSecret) return aSecret - bSecret;
    return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
  });

  const topicCounts = TOPIC_CATEGORIES.reduce((acc, cat) => {
    if (cat.id === "all") {
      acc[cat.id] = BADGES.length;
    } else {
      acc[cat.id] = BADGES.filter(b => b.topic === cat.id).length;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
          <Award className="w-8 h-8 text-yellow-500" /> Badge Collection
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          Collect badges by playing games, defeating bosses, and completing experiments!
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Badge variant="secondary" className="text-sm font-bold px-3 py-1.5 gap-1.5" data-testid="text-badge-progress">
            <Trophy className="w-4 h-4 text-yellow-500" /> {earnedCount} / {BADGES.length} Earned
          </Badge>
          <div className="w-48 h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(earnedCount / BADGES.length) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["common", "uncommon", "rare", "epic", "legendary"] as BadgeRarity[]).map(r => {
            const count = BADGES.filter(b => userBadges.includes(b.id) && b.rarity === r).length;
            const total = BADGES.filter(b => b.rarity === r).length;
            const colors = RARITY_COLORS[r];
            return (
              <span key={r} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`} data-testid={`text-rarity-${r}`}>
                {r.charAt(0).toUpperCase() + r.slice(1)}: {count}/{total}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "earned", "locked"] as FilterType[]).map(f => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className="font-semibold text-xs capitalize"
            data-testid={`button-filter-${f}`}
          >
            {f === "all" ? "All" : f === "earned" ? `Earned (${earnedCount})` : `Locked (${BADGES.length - earnedCount})`}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {TOPIC_CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          return (
            <Button
              key={cat.id}
              variant={topic === cat.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTopic(cat.id)}
              className="font-semibold text-xs gap-1.5"
              data-testid={`button-topic-${cat.id}`}
            >
              <CatIcon className="w-3.5 h-3.5" />
              {cat.label} ({topicCounts[cat.id]})
            </Button>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBadges.map((badge, i) => {
          const earned = userBadges.includes(badge.id);
          const IconComp = ICON_MAP[badge.icon] || Star;
          const rarityColors = RARITY_COLORS[badge.rarity];
          const cardBorder = RARITY_CARD_BORDER[badge.rarity];
          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              <Card
                className={`p-5 border ${cardBorder} ${earned ? "" : "opacity-50"} cursor-pointer hover:scale-[1.02] transition-transform`}
                data-testid={`card-badge-${badge.id}`}
                onClick={() => setSelectedBadge(badge)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                    style={{
                      backgroundColor: `${badge.color.replace(")", ", 0.15)").replace("hsl", "hsla")}`,
                      color: badge.color,
                      ...(earned && equippedBadgeStyle ? getBadgeStyleCSS(equippedBadgeStyle, badge.color) : {}),
                    }}
                  >
                    <IconComp className="w-7 h-7" />
                    {earned && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    {!earned && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm">{badge.name}</h3>
                      <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${rarityColors.bg} ${rarityColors.text} ${rarityColors.border}`} data-testid={`text-badge-rarity-${badge.id}`}>
                        {badge.rarity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 font-medium">{badge.requirement}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {selectedBadge && (() => {
        const earned = userBadges.includes(selectedBadge.id);
        const IconComp = ICON_MAP[selectedBadge.icon] || Star;
        const rarityColors = RARITY_COLORS[selectedBadge.rarity];
        const cardBorder = RARITY_CARD_BORDER[selectedBadge.rarity];
        return (
          <Dialog open={!!selectedBadge} onOpenChange={open => { if (!open) setSelectedBadge(null); }}>
            <DialogContent className="max-w-sm text-center">
              <div className={`mx-auto w-32 h-32 rounded-2xl flex items-center justify-center relative border-2 ${cardBorder} ${earned ? "" : "opacity-60 grayscale"}`}
                style={{
                  backgroundColor: `${selectedBadge.color.replace(")", ", 0.15)").replace("hsl", "hsla")}`,
                  color: selectedBadge.color,
                  ...(earned && equippedBadgeStyle ? getBadgeStyleCSS(equippedBadgeStyle, selectedBadge.color) : {}),
                }}
              >
                <IconComp className="w-16 h-16" />
                {earned && (
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
                {!earned && (
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-muted flex items-center justify-center shadow">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-1">
                <h2 className="text-xl font-black">{selectedBadge.name}</h2>
                <span className={`inline-flex items-center text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border ${rarityColors.bg} ${rarityColors.text} ${rarityColors.border}`}>
                  {selectedBadge.rarity}
                </span>
                <p className="text-sm text-muted-foreground mt-2">{selectedBadge.description}</p>
                <p className="text-xs text-muted-foreground font-medium pt-1 border-t mt-2">{selectedBadge.requirement}</p>
                {earned && <p className="text-sm font-bold text-green-600 dark:text-green-400 mt-2">Earned!</p>}
                {!earned && <p className="text-sm text-muted-foreground mt-2">Not yet earned</p>}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {filteredBadges.length === 0 && (
        <Card className="p-12 text-center">
          <Award className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No badges match your filters</p>
        </Card>
      )}
    </div>
  );
}