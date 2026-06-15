import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Coins, Gem, Package, Award, FlaskConical, Zap,
  Rocket, Bot, Sparkles, Swords, Wand2, Flame, Bird, Diamond,
  Telescope, Snowflake, Orbit, Waves, Mountain, TrendingUp, GraduationCap,
  Sun, Shield, Globe, Crown, Skull, TreePine, Wind, Hexagon, Footprints,
  Cpu, Atom, Star, RefreshCw, Calendar, Gamepad2, Users, Gem as GemIcon,
  Moon, Trophy, Medal,
  type LucideIcon
} from "lucide-react";
import { POTIONS } from "@/lib/gameData";
import { getTitle, getTitleAnimClass, PROFILE_ANIM_CLASSES, FRAME_MINI_STYLES } from "@/lib/titles";

const AVATAR_ICON_MAP: Record<string, { icon: LucideIcon; gradient: string }> = {
  "astronaut": { icon: Rocket, gradient: "from-blue-500 to-cyan-500" },
  "scientist": { icon: FlaskConical, gradient: "from-green-500 to-emerald-500" },
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
  "avatar-supreme-champion": { icon: GemIcon, gradient: "from-yellow-400 to-orange-600" },
  "avatar-news-star": { icon: Star, gradient: "from-yellow-400 to-amber-500" },
  "avatar-viral-scientist": { icon: Zap, gradient: "from-violet-500 to-purple-600" },
  "avatar-pvp-beater": { icon: Swords, gradient: "from-red-500 to-orange-600" },
};

function getAvatarInfo(id: string | null) {
  return AVATAR_ICON_MAP[id || ""] || AVATAR_ICON_MAP["astronaut"];
}

function groupPotions(potions: string[]): { id: string; name: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const p of potions) counts[p] = (counts[p] || 0) + 1;
  return Object.entries(counts).map(([id, count]) => {
    const def = POTIONS.find(p => p.id === id);
    return { id, name: def?.name || id, count };
  });
}

interface Props {
  username: string | null;
  onClose: () => void;
}

export default function UserProfileModal({ username, onClose }: Props) {
  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/profile", username],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${encodeURIComponent(username!)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!username,
    staleTime: 30_000,
  });

  const { data: shopItems = [] } = useQuery<{ id: string; name: string; category: string }[]>({
    queryKey: ["/api/shop"],
    staleTime: 5 * 60_000,
  });

  const itemName = (id: string | undefined) => {
    if (!id) return null;
    return shopItems.find(s => s.id === id)?.name ?? null;
  };

  const open = !!username;
  const cosmetics: Record<string, string> = profile?.equippedCosmetics || {};
  const avatarId: string = profile?.avatarId || "astronaut";
  const avatar = getAvatarInfo(avatarId);
  const AvatarIcon = avatar.icon;
  const titleText = getTitle(cosmetics.title);
  const potions: string[] = profile?.potions || [];
  const groupedPotions = groupPotions(potions);
  const inventory: string[] = profile?.inventory || [];
  const badges: string[] = profile?.badges || [];

  const avatarName = itemName(avatarId) ?? (avatarId === "astronaut" ? "Astronaut" : avatarId === "scientist" ? "Scientist" : avatarId);
  const profileAnimName = cosmetics.profile_animation ? (itemName(cosmetics.profile_animation) ?? cosmetics.profile_animation) : null;
  const nameAnimName = cosmetics.name_animation ? (itemName(cosmetics.name_animation) ?? cosmetics.name_animation) : null;

  const hasCosmetics = [
    cosmetics.title, cosmetics.theme, cosmetics.decoration, cosmetics.frame,
    cosmetics.follower, cosmetics.badge_style, cosmetics.coin_style, cosmetics.gem_style,
  ].some(Boolean);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm" data-testid="user-profile-modal">
        <DialogHeader>
          <DialogTitle className="text-base font-black">Player Profile</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && profile && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full overflow-hidden ${FRAME_MINI_STYLES[cosmetics.frame || ""] || "ring-2 ring-border"} shrink-0`}>
                <div className={`w-full h-full rounded-full bg-gradient-to-br ${avatar.gradient} flex items-center justify-center text-white ${PROFILE_ANIM_CLASSES[cosmetics.profile_animation || ""] || ""}`}>
                  <AvatarIcon className="w-7 h-7" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-black text-base truncate">{profile.displayName || profile.username}</p>
                  {profile.isVip && (
                    <Badge className="text-[9px] font-black px-1 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40">✦ VIP</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">@{profile.username}</p>
                {titleText && (
                  <p className={`text-[11px] font-bold text-purple-500 dark:text-purple-400 ${getTitleAnimClass(cosmetics.title)}`}>{titleText}</p>
                )}
                <Badge variant="secondary" className="mt-1 text-xs font-bold">Lv. {profile.level}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/40 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Zap className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-bold text-purple-500">XP</span>
                </div>
                <p className="font-black text-sm">{(profile.xp || 0).toLocaleString()}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Coins className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-xs font-bold text-yellow-500">Neuros</span>
                </div>
                <p className="font-black text-sm">{(profile.coins || 0).toLocaleString()}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Gem className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="text-xs font-bold text-cyan-500">Sparks</span>
                </div>
                <p className="font-black text-sm">{(profile.gems || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2 py-1.5">
                <AvatarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-muted-foreground">Avatar:</span>
                <span className="font-bold ml-auto truncate max-w-[70px]">{avatarName}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2 py-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-muted-foreground">Badges:</span>
                <span className="font-bold ml-auto">{badges.length}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2 py-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-muted-foreground">Items:</span>
                <span className="font-bold ml-auto">{inventory.length}</span>
              </div>
              {profileAnimName && (
                <div className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2 py-1.5">
                  <span className="text-base leading-none shrink-0">🌀</span>
                  <span className="text-muted-foreground truncate">Profile anim:</span>
                  <span className="font-bold ml-auto truncate max-w-[60px]">{profileAnimName}</span>
                </div>
              )}
              {nameAnimName && (
                <div className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2 py-1.5 col-span-2">
                  <span className="text-base leading-none shrink-0">✍️</span>
                  <span className="text-muted-foreground">Name anim:</span>
                  <span className="font-bold ml-auto">{nameAnimName}</span>
                </div>
              )}
            </div>

            {groupedPotions.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <FlaskConical className="w-3.5 h-3.5 text-pink-500" /> Potions ({potions.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {groupedPotions.map(p => (
                    <Badge key={p.id} variant="outline" className="text-xs font-semibold gap-1 text-pink-600 dark:text-pink-400" data-testid={`profile-potion-${p.id}`}>
                      <FlaskConical className="w-2.5 h-2.5" /> {p.name} ×{p.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {hasCosmetics && (
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1.5">Equipped Cosmetics</p>
                <div className="flex flex-wrap gap-1">
                  {cosmetics.title && titleText && (
                    <Badge variant="secondary" className="text-[10px]">🏷️ {titleText}</Badge>
                  )}
                  {cosmetics.theme && (
                    <Badge variant="secondary" className="text-[10px]">🎨 {itemName(cosmetics.theme) ?? cosmetics.theme}</Badge>
                  )}
                  {cosmetics.decoration && (
                    <Badge variant="secondary" className="text-[10px]">✨ {itemName(cosmetics.decoration) ?? cosmetics.decoration}</Badge>
                  )}
                  {cosmetics.frame && (
                    <Badge variant="secondary" className="text-[10px]">🖼️ {itemName(cosmetics.frame) ?? cosmetics.frame}</Badge>
                  )}
                  {cosmetics.follower && (
                    <Badge variant="secondary" className="text-[10px]">🐾 {itemName(cosmetics.follower) ?? cosmetics.follower}</Badge>
                  )}
                  {cosmetics.badge_style && (
                    <Badge variant="secondary" className="text-[10px]">⭐ {itemName(cosmetics.badge_style) ?? cosmetics.badge_style}</Badge>
                  )}
                  {cosmetics.coin_style && (
                    <Badge variant="secondary" className="text-[10px]">🪙 {itemName(cosmetics.coin_style) ?? cosmetics.coin_style}</Badge>
                  )}
                  {cosmetics.gem_style && (
                    <Badge variant="secondary" className="text-[10px]">💎 {itemName(cosmetics.gem_style) ?? cosmetics.gem_style}</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!isLoading && !profile && (
          <p className="text-center text-muted-foreground py-4 text-sm">User not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
