import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  User, Trophy, Star, Flame, Zap, Target, Calendar, Award,
  Rocket, FlaskConical, Bot, Sparkles, Swords, Wand2, Bird,
  Dna, Clock, Atom, TreePine, Puzzle, CloudLightning, Shield,
  Microscope, GraduationCap, Crown, Medal, Lock, Loader2, Check,
  Snowflake, Orbit, Skull, Moon, Globe, Gem, Waves, Cpu, Heart,
  Gamepad2, Diamond, ShoppingBag, MapPin, TrendingUp, Coins,
  Square, Circle, Rainbow, Palette, Frame, Eye,
  Telescope, Mountain, Wind, Sun, Hexagon, Footprints, RefreshCw, Users, Pencil
} from "lucide-react";
import { BADGES, AVATARS, SHOP_AVATARS, getXPForLevel, type AvatarCategory } from "@/lib/gameData";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

import { getTitle, getTitleAnimClass, PROFILE_ANIM_CLASSES, NAME_ANIM_CLASSES } from "@/lib/titles";

const FRAME_STYLES: Record<string, { border: string; shadow: string; animation?: string }> = {
  "frame-basic": { border: "ring-2 ring-gray-400", shadow: "" },
  "frame-rounded": { border: "ring-2 ring-blue-400 rounded-3xl", shadow: "shadow-md shadow-blue-400/20" },
  "frame-science": { border: "ring-2 ring-dashed ring-emerald-400", shadow: "shadow-lg shadow-emerald-400/30", animation: "animate-pulse-slow" },
  "frame-fire": { border: "ring-[3px] ring-orange-500", shadow: "shadow-lg shadow-orange-500/40", animation: "animate-frame-fire" },
  "frame-ice": { border: "ring-[3px] ring-cyan-400", shadow: "shadow-lg shadow-cyan-400/40", animation: "animate-frame-ice" },
  "frame-lightning": { border: "ring-[3px] ring-yellow-300", shadow: "shadow-lg shadow-yellow-300/50", animation: "animate-frame-lightning" },
  "frame-rainbow": { border: "ring-[3px] ring-pink-500", shadow: "shadow-xl shadow-pink-500/30", animation: "animate-frame-rainbow" },
  "frame-galaxy": { border: "ring-[3px] ring-purple-500 rounded-xl", shadow: "shadow-xl shadow-purple-500/40", animation: "animate-frame-galaxy" },
  "frame-golden": { border: "ring-[4px] ring-double ring-amber-400 rounded-lg", shadow: "shadow-xl shadow-amber-400/50", animation: "animate-frame-golden" },
  "frame-void": { border: "ring-[3px] ring-violet-600 rounded-sm", shadow: "shadow-2xl shadow-violet-600/60", animation: "animate-frame-void" },
  "frame-world-conqueror": { border: "ring-[3px] ring-emerald-500", shadow: "shadow-2xl shadow-emerald-500/50", animation: "animate-frame-conqueror" },
  "frame-supreme-champion": { border: "ring-[4px] ring-yellow-400", shadow: "shadow-2xl shadow-yellow-400/60", animation: "animate-frame-supreme-champion" },
  "frame-clan-champion": { border: "ring-[3px] ring-sky-400", shadow: "shadow-xl shadow-sky-400/50", animation: "animate-frame-clan-champion" },
  "frame-team-champion": { border: "ring-[3px] ring-fuchsia-500", shadow: "shadow-xl shadow-fuchsia-500/50", animation: "animate-frame-team-champion" },
  "reward-tournament-frame": { border: "ring-[3px] ring-yellow-400", shadow: "shadow-xl shadow-yellow-400/40", animation: "animate-frame-golden" },
};

const COIN_STYLE_COLORS: Record<string, { icon: string; text: string }> = {
  "coin-style-diamond": { icon: "text-cyan-400", text: "text-cyan-500 dark:text-cyan-400" },
  "coin-style-fire": { icon: "text-orange-500", text: "text-orange-600 dark:text-orange-400" },
  "coin-style-ice": { icon: "text-sky-400", text: "text-sky-500 dark:text-sky-400" },
  "coin-style-rainbow": { icon: "text-pink-500", text: "text-pink-600 dark:text-pink-400" },
  "coin-style-plasma": { icon: "text-fuchsia-500", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  "coin-style-void": { icon: "text-zinc-500", text: "text-zinc-600 dark:text-zinc-400" },
  "coin-style-champion": { icon: "text-amber-500", text: "text-amber-600 dark:text-amber-400" },
  "coin-style-toxic": { icon: "text-lime-500", text: "text-lime-600 dark:text-lime-400" },
  "coin-style-nebula": { icon: "text-indigo-600", text: "text-indigo-700 dark:text-indigo-400" },
  "coin-style-supreme-champion": { icon: "text-yellow-400", text: "text-yellow-500 dark:text-yellow-300" },
  "coin-style-clan-champion": { icon: "text-sky-400", text: "text-sky-500 dark:text-sky-400" },
  "coin-style-team-champion": { icon: "text-fuchsia-500", text: "text-fuchsia-600 dark:text-fuchsia-400" },
};

const GEM_STYLE_COLORS: Record<string, { icon: string; text: string }> = {
  "gem-style-emerald": { icon: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  "gem-style-ruby": { icon: "text-rose-500", text: "text-rose-600 dark:text-rose-400" },
  "gem-style-sapphire": { icon: "text-blue-500", text: "text-blue-600 dark:text-blue-400" },
  "gem-style-cosmic": { icon: "text-fuchsia-500", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  "gem-style-lightning": { icon: "text-yellow-300", text: "text-yellow-400 dark:text-yellow-300" },
  "gem-style-void": { icon: "text-purple-900", text: "text-purple-950 dark:text-purple-400" },
  "gem-style-champion": { icon: "text-orange-400", text: "text-orange-500 dark:text-orange-300" },
  "gem-style-frost": { icon: "text-teal-400", text: "text-teal-500 dark:text-teal-400" },
  "gem-style-magma": { icon: "text-red-700", text: "text-red-800 dark:text-red-500" },
  "gem-style-supreme-champion": { icon: "text-yellow-400", text: "text-yellow-500 dark:text-yellow-300" },
  "gem-style-clan-champion": { icon: "text-sky-400", text: "text-sky-500 dark:text-sky-400" },
  "gem-style-team-champion": { icon: "text-fuchsia-500", text: "text-fuchsia-600 dark:text-fuchsia-400" },
};

const AVATAR_ICONS: Record<string, any> = {
  Rocket, FlaskConical, Bot, Sparkles, Swords, Wand2, Flame, Bird, Diamond, Star,
  Shield, Crown, Snowflake, Orbit, Skull, Moon, Trophy, Globe, Medal, Gem,
  Waves, Zap, Cpu, Atom, TreePine, Award, Gamepad2, Heart,
  Telescope, Mountain, Wind, Sun, Hexagon, Footprints, TrendingUp, GraduationCap,
  Calendar, RefreshCw, Users,
};

const BADGE_ICONS: Record<string, any> = {
  Star, Rocket, Dna, Zap, FlaskConical, Clock, Atom, TreePine, Puzzle,
  CloudLightning, Shield, Microscope, Swords, Flame, Trophy, GraduationCap, Calendar, Crown,
  Waves, Diamond, Cpu, Skull, Orbit, Heart, Snowflake, Globe, Medal, Award,
};

const AVATAR_CATEGORY_LABELS: Record<AvatarCategory, { label: string; icon: any; color: string }> = {
  shop: { label: "Shop", icon: ShoppingBag, color: "text-blue-500" },
  boss: { label: "Boss Reward", icon: Swords, color: "text-red-500" },
  world: { label: "World Exclusive", icon: MapPin, color: "text-green-500" },
  xp: { label: "XP Milestone", icon: TrendingUp, color: "text-purple-500" },
  achievement: { label: "Achievement", icon: Award, color: "text-amber-500" },
  tournament: { label: "Tournament", icon: Trophy, color: "text-yellow-500" },
  leaderboard: { label: "Leaderboard", icon: Crown, color: "text-orange-500" },
};

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

interface ProfilePageProps {
  nickname: string;
  avatarId: string;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  badges: string[];
  totalGamesPlayed: number;
  gameScores: Record<string, number>;
  inventory: string[];
  onSetAvatar: (avatarId: string) => void;
  yearLevel: number;
  onSetYearLevel: (yearLevel: number) => void;
}

export default function ProfilePage({
  nickname, avatarId, xp, level, currentStreak, longestStreak,
  badges, totalGamesPlayed, gameScores, inventory, onSetAvatar,
  yearLevel, onSetYearLevel,
}: ProfilePageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const upgradeUses = (user as any)?.upgradeExpirations as Record<string, number> | undefined;

  const displayNameMutation = useMutation({
    mutationFn: async (displayName: string) => {
      const res = await apiRequest("POST", "/api/user/display-name", { displayName });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Display name updated!", description: `You're now known as "${data.displayName}"` });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setEditingDisplayName(false);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
  const isUpActive = (id: string) => {
    if (!inventory.includes(id)) return false;
    return (upgradeUses?.[id] || 0) > 0;
  };
  const equippedBadgeStyle = (user as any)?.equippedCosmetics?.badge_style || "";
  const equippedFrame = (user as any)?.equippedCosmetics?.frame || "";
  const equippedCoinStyle = (user as any)?.equippedCosmetics?.coin_style || "";
  const equippedGemStyle = (user as any)?.equippedCosmetics?.gem_style || "";
  const equippedProfileAnim = (user as any)?.equippedCosmetics?.profile_animation || "";
  const equippedNameAnim = (user as any)?.equippedCosmetics?.name_animation || "";
  const profileAnimClass = PROFILE_ANIM_CLASSES[equippedProfileAnim] || "";
  const nameAnimClass = NAME_ANIM_CLASSES[equippedNameAnim] || "";
  const [selectedBadge, setSelectedBadge] = useState<typeof BADGES[0] | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const equipCosmeticMutation = useMutation({
    mutationFn: async ({ itemId, category }: { itemId: string; category: string }) => {
      const res = await apiRequest("POST", "/api/shop/equip-cosmetic", { itemId, category });
      return res.json();
    },
    onSuccess: (data: any) => {
      const userData = data?.user || data;
      if (userData?.id) {
        queryClient.setQueryData(["/api/user"], userData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Updated!", description: "Your cosmetic has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update cosmetic", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/user/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed!", description: "Your new password is now active." });
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to change password", variant: "destructive" });
    },
  });
  const { data: leaderboardData } = useQuery<{ leaders: { id: number; username: string; xp: number; level: number }[]; newlyGranted: string[] }>({
    queryKey: ["/api/leaderboard"],
  });
  const leaders = leaderboardData?.leaders || [];
  const myRank = user ? leaders.findIndex((l) => l.id === user.id) + 1 : 0;

  const xpForCurrentLevel = getXPForLevel(level);
  let xpIntoLevel = xp;
  for (let l = 1; l < level; l++) {
    xpIntoLevel -= getXPForLevel(l);
  }
  const progressPercent = Math.min(100, (xpIntoLevel / xpForCurrentLevel) * 100);

  const currentAvatarIcon = AVATARS.find((a) => a.id === avatarId) || SHOP_AVATARS.find((a) => a.id === avatarId);
  const AvatarIcon = currentAvatarIcon ? (AVATAR_ICONS[currentAvatarIcon.icon] || User) : User;

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
          <User className="w-8 h-8 text-purple-500" /> Player Profile
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          Track your progress, badges, and achievements!
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className={`p-6 lg:col-span-1 ${localStorage.getItem("cosmetic-gem-upgrades") !== "false" && isUpActive("upgrade-golden-profile") ? "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.15)]" : "border-border"}`} data-testid="card-profile">
          <div className="text-center">
            {(() => {
              const isGolden = localStorage.getItem("cosmetic-gem-upgrades") !== "false" && isUpActive("upgrade-golden-profile");
              const frameStyle = FRAME_STYLES[equippedFrame];
              const frameClasses = frameStyle
                ? `${frameStyle.border} ${frameStyle.shadow} ${frameStyle.animation || ""}`
                : isGolden ? "ring-4 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]" : "";
              const bgGradient = isGolden ? "from-yellow-400 to-amber-500" : "from-purple-500 to-blue-500";
              return (
                <div className={`w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden ${frameClasses}`} data-testid="profile-avatar-container">
                  <div className={`w-full h-full rounded-full bg-gradient-to-br ${bgGradient} flex items-center justify-center ${profileAnimClass}`}>
                    <AvatarIcon className="w-12 h-12 text-white" />
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-2 justify-center mb-1">
              {editingDisplayName ? (
                <div className="flex items-center gap-2">
                  <Input
                    className="w-40 h-8 text-sm font-bold"
                    value={newDisplayName}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9 _]/g, "");
                      setNewDisplayName(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newDisplayName.trim().length >= 2) {
                        displayNameMutation.mutate(newDisplayName);
                      } else if (e.key === "Escape") {
                        setEditingDisplayName(false);
                      }
                    }}
                    maxLength={24}
                    placeholder="Letters, numbers, spaces..."
                    autoFocus
                    data-testid="input-display-name"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => displayNameMutation.mutate(newDisplayName)}
                    disabled={displayNameMutation.isPending || newDisplayName.trim().length < 2}
                    data-testid="button-save-display-name"
                  >
                    {displayNameMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingDisplayName(false)} data-testid="button-cancel-display-name">
                    <User className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <h2 className={`text-xl font-black ${nameAnimClass}`} data-testid="text-username">{nickname}</h2>
                  {(user as any)?.isVip && (
                    <Badge className="text-[10px] font-black px-1.5 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40" data-testid="vip-badge-profile">
                      ✦ VIP
                    </Badge>
                  )}
                  <button
                    onClick={() => { setNewDisplayName(nickname); setEditingDisplayName(true); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Change display name"
                    data-testid="button-edit-display-name"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            {user && (
              <p className="text-[10px] text-muted-foreground mb-1" data-testid="text-actual-username">@{user.username}</p>
            )}

            {(() => {
              const equippedTitle = (user as any)?.equippedCosmetics?.title;
              const clanTeamName = equippedTitle === "title-my-clan" ? (user as any)?.clanName : equippedTitle === "title-my-team" ? (user as any)?.teamName : undefined;
              const titleText = getTitle(equippedTitle, clanTeamName);
              if (!titleText) return null;
              return (
                <p className={`text-xs font-bold text-purple-500 dark:text-purple-400 mb-1 ${getTitleAnimClass(equippedTitle)}`} data-testid="text-profile-title">
                  {titleText}
                </p>
              );
            })()}

            <Badge variant="default" className="mb-2 font-bold">
              Level {level}
            </Badge>

            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-left">
              <p className="text-xs font-bold text-muted-foreground mb-2">Year Level (Question Difficulty)</p>
              <div className="flex gap-1.5">
                {[3, 4, 5, 6, 7, 8, 9].map((yr) => (
                  <Button
                    key={yr}
                    size="sm"
                    variant={yearLevel === yr ? "default" : "outline"}
                    className="flex-1 text-xs font-bold h-8"
                    onClick={() => onSetYearLevel(yr)}
                    data-testid={`button-year-${yr}`}
                  >
                    Y{yr}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {yearLevel <= 4 ? "Easier questions for younger players" : yearLevel >= 7 ? "Harder questions for advanced students" : "Standard difficulty"}
              </p>
            </div>

            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs font-bold"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                data-testid="button-change-password-toggle"
              >
                <Lock className="w-3 h-3 mr-1" /> Change Password
              </Button>
              {showPasswordForm && (
                <div className="mt-2 space-y-2 p-3 rounded-lg bg-muted/50">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="text-xs h-8"
                    data-testid="input-current-password"
                  />
                  <Input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="text-xs h-8"
                    data-testid="input-new-password"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-xs h-8"
                    data-testid="input-confirm-password"
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[10px] text-red-500 font-medium">Passwords don't match</p>
                  )}
                  <Button
                    size="sm"
                    className="w-full text-xs font-bold"
                    disabled={
                      !currentPassword || !newPassword || !confirmPassword ||
                      newPassword !== confirmPassword || newPassword.length < 4 ||
                      changePasswordMutation.isPending
                    }
                    onClick={() => changePasswordMutation.mutate({ currentPassword, newPassword })}
                    data-testid="button-submit-password"
                  >
                    {changePasswordMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Update Password"}
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-semibold text-muted-foreground">XP Progress</p>
                <p className="text-xs font-bold">{xpIntoLevel} / {xpForCurrentLevel}</p>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">Total: {xp.toLocaleString()} XP</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-border lg:col-span-2">
          {myRank > 0 && (
            <div className="mb-5 p-4 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20" data-testid="card-leaderboard-rank">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {myRank === 1 ? <Crown className="w-6 h-6 text-yellow-500" /> :
                   myRank <= 3 ? <Medal className="w-6 h-6 text-yellow-500" /> :
                   <Trophy className="w-6 h-6 text-yellow-500" />}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Leaderboard Rank</p>
                    <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400" data-testid="text-leaderboard-rank">#{myRank}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-bold text-xs" data-testid="text-leaderboard-total">
                  out of {leaders.length} players
                </Badge>
              </div>
            </div>
          )}

          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" /> Quick Stats
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-md bg-muted/50">
              <Zap className="w-6 h-6 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-black">{xp.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Total XP</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <Trophy className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
              <p className="text-2xl font-black">{badges.length}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Badges</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <Flame className="w-6 h-6 mx-auto mb-1 text-orange-500" />
              <p className="text-2xl font-black">{currentStreak}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Day Streak</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <Star className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
              <p className="text-2xl font-black">{totalGamesPlayed}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Games Played</p>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-md bg-muted/50">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Longest Streak</p>
            <p className="text-lg font-black flex items-center gap-1.5">
              <Flame className="w-5 h-5 text-orange-500" /> {longestStreak} days
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2">
          <Award className="w-6 h-6 text-yellow-500" /> Badges ({badges.length}/{BADGES.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {BADGES.map((badge, i) => {
            const earned = badges.includes(badge.id);
            const IconComp = BADGE_ICONS[badge.icon] || Star;
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
              >
                <Card
                  className={`p-4 border-border ${earned ? "" : "opacity-40"} cursor-pointer hover:scale-[1.02] transition-transform`}
                  data-testid={`badge-${badge.id}`}
                  onClick={() => setSelectedBadge(badge)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${
                        earned ? "" : "grayscale"
                      }`}
                      style={earned ? {
                        backgroundColor: `${badge.color}20`,
                        color: badge.color,
                        ...(equippedBadgeStyle ? getBadgeStyleCSS(equippedBadgeStyle, badge.color) : {}),
                      } : { backgroundColor: "var(--muted)" }}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm truncate">{badge.name}</h4>
                      <p className="text-[10px] text-muted-foreground font-medium truncate">
                        {earned ? badge.description : badge.requirement}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {selectedBadge && (() => {
          const earned = badges.includes(selectedBadge.id);
          const IconComp = BADGE_ICONS[selectedBadge.icon] || Star;
          return (
            <Dialog open={!!selectedBadge} onOpenChange={open => { if (!open) setSelectedBadge(null); }}>
              <DialogContent className="max-w-sm text-center">
                <div
                  className={`mx-auto w-32 h-32 rounded-2xl flex items-center justify-center ${earned ? "" : "opacity-50 grayscale"}`}
                  style={earned ? {
                    backgroundColor: `${selectedBadge.color}20`,
                    color: selectedBadge.color,
                    ...(equippedBadgeStyle ? getBadgeStyleCSS(equippedBadgeStyle, selectedBadge.color) : {}),
                  } : { backgroundColor: "var(--muted)" }}
                >
                  <IconComp className="w-16 h-16" />
                </div>
                <div className="mt-4 space-y-1">
                  <h2 className="text-xl font-black">{selectedBadge.name}</h2>
                  <span className="inline-block text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground">
                    {selectedBadge.rarity}
                  </span>
                  <p className="text-sm text-muted-foreground mt-2">{selectedBadge.description}</p>
                  <p className="text-xs text-muted-foreground font-medium pt-2 border-t mt-2">{selectedBadge.requirement}</p>
                  {earned
                    ? <p className="text-sm font-bold text-green-600 dark:text-green-400 mt-2">Earned!</p>
                    : <p className="text-sm text-muted-foreground mt-2">Not yet earned</p>
                  }
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" /> Avatars
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {AVATARS.map((avatar) => {
            const IconComp = AVATAR_ICONS[avatar.icon] || User;
            const isUnlocked = level >= avatar.requiredLevel;
            const isActive = avatarId === avatar.id;

            return (
              <Card
                key={avatar.id}
                className={`p-4 border-border text-center cursor-pointer ${isActive ? "ring-2 ring-purple-500" : ""} ${
                  isUnlocked ? "hover-elevate" : "opacity-40"
                }`}
                onClick={() => isUnlocked && onSetAvatar(avatar.id)}
                data-testid={`avatar-${avatar.id}`}
              >
                <div className={`w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  isActive ? "bg-gradient-to-br from-purple-500 to-blue-500" : "bg-muted"
                }`}>
                  <IconComp className={`w-7 h-7 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                </div>
                <p className="text-sm font-bold">{avatar.name}</p>
                <Badge variant="secondary" className="text-[9px] font-bold mb-0.5 gap-0.5">
                  <Rocket className="w-2.5 h-2.5" /> Starter
                </Badge>
                <p className="text-[10px] text-muted-foreground font-medium">
                  {isUnlocked ? (isActive ? "Active" : "Click to use") : `Level ${avatar.requiredLevel}`}
                </p>
              </Card>
            );
          })}
          {SHOP_AVATARS.map((avatar) => {
            const IconComp = AVATAR_ICONS[avatar.icon] || User;
            const isOwned = inventory.includes(avatar.id);
            const isActive = avatarId === avatar.id;
            const catInfo = avatar.category ? AVATAR_CATEGORY_LABELS[avatar.category] : null;
            const CatIcon = catInfo?.icon || ShoppingBag;

            return (
              <Card
                key={avatar.id}
                className={`p-4 border-border text-center cursor-pointer ${isActive ? "ring-2 ring-purple-500" : ""} ${
                  isOwned ? "hover-elevate" : "opacity-40"
                }`}
                onClick={() => isOwned && onSetAvatar(avatar.id)}
                data-testid={`avatar-${avatar.id}`}
              >
                <div className={`w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  isActive ? "bg-gradient-to-br from-purple-500 to-blue-500" : "bg-muted"
                }`}>
                  <IconComp className={`w-7 h-7 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                </div>
                <p className="text-sm font-bold">{avatar.name}</p>
                {catInfo && (
                  <Badge variant="secondary" className={`text-[9px] font-bold mb-0.5 gap-0.5 ${catInfo.color}`}>
                    <CatIcon className="w-2.5 h-2.5" /> {catInfo.label}
                  </Badge>
                )}
                <p className="text-[10px] text-muted-foreground font-medium">
                  {isOwned ? (isActive ? "Active" : "Click to use") : (avatar.source || "Shop item")}
                </p>
              </Card>
            );
          })}
        </div>
      </div>

      {(() => {
        const ownedFrames = inventory.filter(i => i.startsWith("frame-") || i === "reward-tournament-frame");
        const ownedCoinStyles = inventory.filter(i => i.startsWith("coin-style-"));
        const ownedGemStyles = inventory.filter(i => i.startsWith("gem-style-"));
        const hasCustomization = ownedFrames.length > 0 || ownedCoinStyles.length > 0 || ownedGemStyles.length > 0;

        if (!hasCustomization) return null;
        return (
          <div className="mt-8">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Frame className="w-6 h-6 text-pink-500" /> Customization
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {ownedFrames.length > 0 && (
                <Card className="p-4 border-border">
                  <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5">
                    <Square className="w-4 h-4 text-pink-500" /> Frames
                  </h3>
                  <div className="space-y-1.5">
                    {ownedFrames.map(f => {
                      const isActive = equippedFrame === f;
                      const frameInfo = FRAME_STYLES[f];
                      return (
                        <div
                          key={f}
                          className={`text-xs p-2 rounded-md cursor-pointer flex items-center gap-2 transition-all ${isActive ? "bg-pink-500/20 text-pink-600 dark:text-pink-400 font-bold" : "bg-muted/50 hover:bg-muted"}`}
                          onClick={() => equipCosmeticMutation.mutate({ itemId: f, category: "frame" })}
                          data-testid={`frame-${f}`}
                        >
                          <Check className={`w-3 h-3 shrink-0 ${isActive ? "opacity-100" : "opacity-0"}`} />
                          <span className="flex-1">{f.replace(/^(frame-|reward-)/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                          {frameInfo?.animation && (
                            <div className={`w-4 h-4 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 ${frameInfo.animation}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              {ownedCoinStyles.length > 0 && (
                <Card className="p-4 border-border">
                  <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-yellow-500" /> Neuro Style
                  </h3>
                  <div className="space-y-1.5">
                    {ownedCoinStyles.map(c => {
                      const isActive = equippedCoinStyle === c;
                      const styleInfo = COIN_STYLE_COLORS[c];
                      return (
                        <div
                          key={c}
                          className={`text-xs p-2 rounded-md cursor-pointer flex items-center gap-2 transition-all ${isActive ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-bold" : "bg-muted/50 hover:bg-muted"}`}
                          onClick={() => equipCosmeticMutation.mutate({ itemId: c, category: "coin_style" })}
                          data-testid={`coin-style-${c}`}
                        >
                          <Check className={`w-3 h-3 shrink-0 ${isActive ? "opacity-100" : "opacity-0"}`} />
                          <span className="flex-1">{c.replace("coin-style-", "").replace(/-/g, " ").replace(/\b\w/g, ch => ch.toUpperCase())}</span>
                          {styleInfo && <Coins className={`w-3.5 h-3.5 ${styleInfo.icon}`} />}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              {ownedGemStyles.length > 0 && (
                <Card className="p-4 border-border">
                  <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5">
                    <Gem className="w-4 h-4 text-purple-500" /> Spark Style
                  </h3>
                  <div className="space-y-1.5">
                    {ownedGemStyles.map(g => {
                      const isActive = equippedGemStyle === g;
                      const styleInfo = GEM_STYLE_COLORS[g];
                      return (
                        <div
                          key={g}
                          className={`text-xs p-2 rounded-md cursor-pointer flex items-center gap-2 transition-all ${isActive ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold" : "bg-muted/50 hover:bg-muted"}`}
                          onClick={() => equipCosmeticMutation.mutate({ itemId: g, category: "gem_style" })}
                          data-testid={`gem-style-${g}`}
                        >
                          <Check className={`w-3 h-3 shrink-0 ${isActive ? "opacity-100" : "opacity-0"}`} />
                          <span className="flex-1">{g.replace("gem-style-", "").replace(/-/g, " ").replace(/\b\w/g, ch => ch.toUpperCase())}</span>
                          {styleInfo && <Gem className={`w-3.5 h-3.5 ${styleInfo.icon}`} />}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
