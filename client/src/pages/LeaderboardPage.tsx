import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserProfileModal from "@/components/UserProfileModal";
import {
  Trophy, Star, Medal, Crown, Loader2, Gamepad2, Flame,
  Rocket, FlaskConical, Bot, Sparkles, Swords, Wand2,
  Bird, Diamond, User, Gem, Coins, Award, Shield, Users, UsersRound,
  Snowflake, Orbit, Moon, Globe, Waves, Zap, Cpu, Atom, TreePine,
  Telescope, Mountain, Wind, Sun, Hexagon, Footprints, TrendingUp,
  GraduationCap, Calendar, RefreshCw, Skull
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getTitle, getTitleAnimClass, PROFILE_ANIM_CLASSES, NAME_ANIM_CLASSES, FRAME_MINI_STYLES } from "@/lib/titles";
import { UserNameDisplay } from "@/lib/mentions";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";
import type { LucideIcon } from "lucide-react";

interface LeaderboardUser {
  id: number;
  username: string;
  displayName?: string | null;
  // shared LeaderboardEntry type
  xp: number;
  level: number;
  coins: number;
  gems: number;
  gamesWon: number;
  totalGamesPlayed: number;
  currentStreak: number;
  tournamentXp: number;
  tournamentWins: number;
  isVip?: boolean;
  avatarId: string | null;
  badges: string[];
  inventory: string[];
  clanId: number | null;
  isOnline: boolean;
  equippedCosmetics?: Record<string, string> | null;
}

interface ClanData {
  id: number;
  name: string;
  tag: string;
  icon: string;
  color: string;
  memberCount: number;
  totalXP: number;
  totalCoins: number;
  totalGems: number;
  totalBadges: number;
}

interface TeamData {
  id: number;
  name: string;
  inviteCode: string;
  leaderId: number;
  leaderName: string;
  icon: string;
  color: string;
  memberCount: number;
  totalXP: number;
  totalCoins: number;
  totalBadges: number;
}

const CLAN_ICON_EMOJIS: Record<string, string> = {
  Shield: "🛡️", Sword: "⚔️", Crown: "👑", Star: "⭐", Fire: "🔥",
  Lightning: "⚡", Dragon: "🐉", Skull: "💀", Diamond: "💎", Rocket: "🚀",
};

const AVATAR_ICONS: Record<string, { icon: LucideIcon; gradient: string }> = {
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
};

function getAvatarInfo(avatarId: string | null) {
  if (avatarId && AVATAR_ICONS[avatarId]) return AVATAR_ICONS[avatarId];
  return { icon: User, gradient: "from-purple-500 to-blue-500" };
}

const PODIUM_COLORS = [
  "from-yellow-400 to-amber-500",
  "from-gray-300 to-gray-400",
  "from-amber-600 to-orange-700",
];

type SortKey = "xp" | "coins" | "gems" | "badges" | "inventory";
type Tab = "individual" | "clans" | "teams" | "streaks" | "tournaments";

const SORT_OPTIONS: { key: SortKey; label: string; icon: LucideIcon }[] = [
  { key: "xp", label: "XP", icon: Star },
  { key: "coins", label: "Coins", icon: Coins },
  { key: "gems", label: "Gems", icon: Gem },
  { key: "badges", label: "Badges", icon: Award },
  { key: "inventory", label: "Items", icon: Diamond },
];

const CLAN_SORT_OPTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "totalXP", label: "XP", icon: Star },
  { key: "totalCoins", label: "Coins", icon: Coins },
  { key: "totalGems", label: "Gems", icon: Gem },
  { key: "totalBadges", label: "Badges", icon: Award },
  { key: "memberCount", label: "Members", icon: Users },
];

const TEAM_SORT_OPTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "totalXP", label: "XP", icon: Star },
  { key: "totalCoins", label: "Coins", icon: Coins },
  { key: "totalBadges", label: "Badges", icon: Award },
  { key: "memberCount", label: "Members", icon: Users },
];

function getSortValue(u: LeaderboardUser, key: SortKey): number {
  if (key === "badges") return (u.badges || []).length;
  if (key === "inventory") return (u.inventory || []).length;
  return (u as any)[key] || 0;
}

const CHAMPION_ITEM_LABELS: Record<string, string> = {
  "title-leaderboard-1st": "Leaderboard 1st Title",
  "theme-supreme-champion": "Supreme Champion Theme",
  "avatar-supreme-champion": "Supreme Champion Avatar",
  "deco-supreme-champion": "Supreme Champion Aura",
  "frame-supreme-champion": "Supreme Champion Frame",
  "follower-supreme-champion": "Supreme Champion Follower",
  "badge-style-supreme-champion": "Supreme Champion Badge Style",
  "coin-style-supreme-champion": "Supreme Champion Coin Style",
  "gem-style-supreme-champion": "Supreme Champion Gem Style",
  "title-clan-1st": "Clan Champion Title",
  "theme-clan-champion": "Clan Champion Theme",
  "avatar-clan-champion": "Clan Champion Avatar",
  "deco-clan-champion": "Clan Champion Aura",
  "frame-clan-champion": "Clan Champion Frame",
  "follower-clan-champion": "Clan Champion Follower",
  "badge-style-clan-champion": "Clan Champion Badge Style",
  "coin-style-clan-champion": "Clan Champion Coin Style",
  "gem-style-clan-champion": "Clan Champion Gem Style",
  "title-team-1st": "Team Champion Title",
  "theme-team-champion": "Team Champion Theme",
  "avatar-team-champion": "Team Champion Avatar",
  "deco-team-champion": "Team Champion Aura",
  "frame-team-champion": "Team Champion Frame",
  "follower-team-champion": "Team Champion Follower",
  "badge-style-team-champion": "Team Champion Badge Style",
  "coin-style-team-champion": "Team Champion Coin Style",
  "gem-style-team-champion": "Team Champion Gem Style",
};

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("individual");
  const [sortKey, setSortKey] = useState<SortKey>("xp");
  const [clanSortKey, setClanSortKey] = useState("totalXP");
  const [teamSortKey, setTeamSortKey] = useState("totalXP");
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const notifiedRef = useRef(false);

  const { data: leaderboardData, isLoading } = useQuery<{ leaders: LeaderboardUser[]; newlyGranted: string[] }>({
    queryKey: ["/api/leaderboard"],
  });
  const leaders = leaderboardData?.leaders || [];
  const newlyGranted = leaderboardData?.newlyGranted || [];

  useEffect(() => {
    if (newlyGranted.length > 0 && !notifiedRef.current) {
      notifiedRef.current = true;
      const itemNames = newlyGranted.map(id => CHAMPION_ITEM_LABELS[id] || id).join(", ");
      toast({
        title: "Champion Rewards Unlocked!",
        description: `You earned: ${itemNames}. Equip them in the Shop!`,
        duration: 8000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    }
  }, [newlyGranted]);

  const { data: clansData = [], isLoading: clansLoading } = useQuery<ClanData[]>({
    queryKey: ["/api/clans"],
  });

  const { data: teamsData = [], isLoading: teamsLoading } = useQuery<TeamData[]>({
    queryKey: ["/api/teams"],
  });

  const { data: streakLeaders = [], isLoading: streaksLoading } = useQuery<{ id: number; username: string; winStreak: number; avatar?: string }[]>({
    queryKey: ["/api/leaderboard/win-streaks"],
    enabled: tab === "streaks",
  });

  const { data: tournamentLeaders = [], isLoading: tournamentsLoading } = useQuery<LeaderboardUser[]>({
    queryKey: ["/api/leaderboard/tournaments"],
    enabled: tab === "tournaments",
  });

  const sortedLeaders = [...leaders].sort((a, b) => getSortValue(b, sortKey) - getSortValue(a, sortKey));
  const sortedClans = [...clansData].sort((a, b) => ((b as any)[clanSortKey] || 0) - ((a as any)[clanSortKey] || 0));
  const sortedTeams = [...teamsData].sort((a, b) => ((b as any)[teamSortKey] || 0) - ((a as any)[teamSortKey] || 0));

  const myRank = user ? sortedLeaders.findIndex((l) => l.id === user.id) + 1 : 0;
  const myClanRank = user?.clanId ? sortedClans.findIndex(c => c.id === (user as any).clanId) + 1 : 0;
  const myTeamRank = (user as any)?.teamId ? sortedTeams.findIndex(t => t.id === (user as any).teamId) + 1 : 0;
  const myTournamentRank = user ? tournamentLeaders.findIndex((l) => l.id === user.id) + 1 : 0;

  const loading = tab === "individual" ? isLoading : tab === "clans" ? clansLoading : tab === "teams" ? teamsLoading : tab === "streaks" ? streaksLoading : tournamentsLoading;

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3 mb-2">
        <Trophy className="w-8 h-8 text-yellow-500" /> Leaderboard
      </h1>
      <p className="text-muted-foreground font-medium mb-4">Top science champions!</p>

      <div className="flex gap-2 mb-4">
        <Button
          variant={tab === "individual" ? "default" : "outline"}
          onClick={() => setTab("individual")}
          className="gap-2 font-bold"
          data-testid="tab-individual"
        >
          <User className="w-4 h-4" /> Individual
        </Button>
        <Button
          variant={tab === "clans" ? "default" : "outline"}
          onClick={() => setTab("clans")}
          className="gap-2 font-bold"
          data-testid="tab-clans"
        >
          <Shield className="w-4 h-4" /> Clans
        </Button>
        <Button
          variant={tab === "teams" ? "default" : "outline"}
          onClick={() => setTab("teams")}
          className="gap-2 font-bold"
          data-testid="tab-teams"
        >
          <UsersRound className="w-4 h-4" /> Teams
        </Button>
        <Button
          variant={tab === "streaks" ? "default" : "outline"}
          onClick={() => setTab("streaks")}
          className="gap-2 font-bold"
          data-testid="tab-streaks"
        >
          🔥 Win Streaks
        </Button>
        <Button
          variant={tab === "tournaments" ? "default" : "outline"}
          onClick={() => setTab("tournaments")}
          className="gap-2 font-bold"
          data-testid="tab-tournaments"
        >
          <Trophy className="w-4 h-4" /> Tournaments
        </Button>
      </div>

      {tab === "individual" && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {SORT_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <Button
                key={opt.key}
                size="sm"
                variant={sortKey === opt.key ? "default" : "outline"}
                onClick={() => setSortKey(opt.key)}
                className="gap-1.5 font-bold text-xs"
                data-testid={`sort-${opt.key}`}
              >
                <Icon className="w-3.5 h-3.5" /> {opt.label}
              </Button>
            );
          })}
        </div>
      )}

      {tab === "clans" && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {CLAN_SORT_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <Button
                key={opt.key}
                size="sm"
                variant={clanSortKey === opt.key ? "default" : "outline"}
                onClick={() => setClanSortKey(opt.key)}
                className="gap-1.5 font-bold text-xs"
                data-testid={`sort-clan-${opt.key}`}
              >
                <Icon className="w-3.5 h-3.5" /> {opt.label}
              </Button>
            );
          })}
        </div>
      )}

      {tab === "teams" && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {TEAM_SORT_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <Button
                key={opt.key}
                size="sm"
                variant={teamSortKey === opt.key ? "default" : "outline"}
                onClick={() => setTeamSortKey(opt.key)}
                className="gap-1.5 font-bold text-xs"
                data-testid={`sort-team-${opt.key}`}
              >
                <Icon className="w-3.5 h-3.5" /> {opt.label}
              </Button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "individual" ? (
        <>
          {sortedLeaders.length >= 3 && (
            <div className="flex items-end justify-center gap-4 mb-8 px-4">
              {[1, 0, 2].map((podiumIdx) => {
                const leader = sortedLeaders[podiumIdx];
                if (!leader) return null;
                const PodiumIcon = [Crown, Medal, Medal][podiumIdx];
                const avatar = getAvatarInfo(leader.avatarId);
                const AvatarIcon = avatar.icon;
                return (
                  <motion.div
                    key={leader.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: podiumIdx * 0.15 }}
                    className="text-center flex-1 max-w-[160px]"
                  >
                    <div className="relative mx-auto mb-2" style={{ width: podiumIdx === 0 ? 80 : 64, height: podiumIdx === 0 ? 80 : 64 }}>
                      <div className={`w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br ${PODIUM_COLORS[podiumIdx]} text-white shadow-lg ring-2 ring-white/20`}
                        data-testid={`podium-avatar-${leader.id}`}
                      >
                        <AvatarIcon className={podiumIdx === 0 ? "w-9 h-9" : "w-7 h-7"} />
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 ${podiumIdx === 0 ? "w-4 h-4" : "w-3.5 h-3.5"} rounded-full border-2 border-background ${leader.isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`}
                        data-testid={`podium-status-${leader.id}`}
                        title={leader.isOnline ? "Online" : "Offline"}
                      />
                    </div>
                    <UserNameDisplay username={leader.username} displayName={leader.displayName} nameClassName="text-sm" />
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <PodiumIcon className={`w-4 h-4 ${podiumIdx === 0 ? "text-yellow-500" : podiumIdx === 1 ? "text-gray-400" : "text-amber-600"}`} />
                      <span className="text-xs font-bold">#{podiumIdx + 1}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-bold mt-1">
                      {getSortValue(leader, sortKey).toLocaleString()} {SORT_OPTIONS.find(o => o.key === sortKey)?.label}
                    </Badge>
                    <div className={`mt-2 rounded-t-lg bg-gradient-to-b ${PODIUM_COLORS[podiumIdx]} mx-auto`} style={{ height: podiumIdx === 0 ? 100 : podiumIdx === 1 ? 70 : 50, width: "80%" }} />
                  </motion.div>
                );
              })}
            </div>
          )}

          {myRank > 0 && (
            <Card className="p-4 mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-black text-lg text-purple-500">#{myRank}</span>
                  <span className="font-bold">Your Rank</span>
                </div>
                <Badge variant="secondary" className="font-bold">
                  {getSortValue(user as any, sortKey).toLocaleString()} {SORT_OPTIONS.find(o => o.key === sortKey)?.label}
                </Badge>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {sortedLeaders.map((leader, i) => {
              const avatar = getAvatarInfo(leader.avatarId);
              const AvatarIcon = avatar.icon;
              return (
                <motion.div
                  key={leader.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className={`p-4 flex items-center gap-4 border-border ${leader.id === user?.id ? "ring-2 ring-purple-500/30" : ""} cursor-pointer hover:border-purple-500/30 transition-colors`}
                    data-testid={`leaderboard-row-${leader.id}`}
                    onClick={() => setProfileUsername(leader.username)}
                  >
                    <span className={`font-black text-lg w-8 text-center ${i < 3 ? "text-yellow-500" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full overflow-hidden ${FRAME_MINI_STYLES[leader.equippedCosmetics?.frame || ""] || "ring-1 ring-white/10"}`}
                        data-testid={`avatar-${leader.id}`}
                      >
                        <div className={`w-full h-full rounded-full bg-gradient-to-br ${avatar.gradient} flex items-center justify-center text-white ${PROFILE_ANIM_CLASSES[leader.equippedCosmetics?.profile_animation || ""] || ""}`}>
                          <AvatarIcon className="w-5 h-5" />
                        </div>
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${leader.isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`}
                        data-testid={`status-${leader.id}`}
                        title={leader.isOnline ? "Online" : "Offline"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserNameDisplay username={leader.username} displayName={leader.displayName} nameClassName={`text-sm ${NAME_ANIM_CLASSES[leader.equippedCosmetics?.name_animation || ""] || ""}`} />
                        {leader.isVip && (
                          <Badge className="text-[9px] font-black px-1 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 shrink-0" data-testid={`vip-badge-${leader.id}`}>
                            ✦ VIP
                          </Badge>
                        )}
                      </div>
                      {(() => {
                        const titleId = leader.equippedCosmetics?.title;
                        const title = getTitle(titleId);
                        return title ? (
                          <p className={`text-[10px] font-bold text-purple-500 dark:text-purple-400 leading-none mb-0.5 ${getTitleAnimClass(titleId)}`} data-testid={`title-${leader.id}`}>{title}</p>
                        ) : null;
                      })()}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Lv.{leader.level}</span>
                        <span>-</span>
                        <span className="flex items-center gap-0.5">
                          <Gamepad2 className="w-3 h-3" /> {leader.gamesWon}W/{leader.totalGamesPlayed}G
                        </span>
                        {leader.currentStreak > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-orange-500" /> {leader.currentStreak}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {getSortValue(leader, sortKey).toLocaleString()} {SORT_OPTIONS.find(o => o.key === sortKey)?.label}
                    </Badge>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {sortedLeaders.length === 0 && (
            <div className="text-center py-16">
              <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium text-lg">No players yet!</p>
              <p className="text-sm text-muted-foreground">Play some games to get on the board!</p>
            </div>
          )}
        </>
      ) : tab === "clans" ? (
        <>
          {sortedClans.length >= 3 && (
            <div className="flex items-end justify-center gap-4 mb-8 px-4">
              {[1, 0, 2].map((podiumIdx) => {
                const clan = sortedClans[podiumIdx];
                if (!clan) return null;
                const PodiumIcon = [Crown, Medal, Medal][podiumIdx];
                return (
                  <motion.div
                    key={clan.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: podiumIdx * 0.15 }}
                    className="text-center flex-1 max-w-[160px]"
                    data-testid={`clan-podium-${podiumIdx + 1}`}
                  >
                    <div className={`${podiumIdx === 0 ? "w-20 h-20" : "w-16 h-16"} rounded-xl mx-auto mb-2 flex items-center justify-center shadow-lg ring-2 ring-white/20`}
                      style={{ background: clan.color }}
                    >
                      <span className={podiumIdx === 0 ? "text-3xl" : "text-2xl"}>{CLAN_ICON_EMOJIS[clan.icon] || "🛡️"}</span>
                    </div>
                    <p className="font-bold text-sm truncate">[{clan.tag}] {clan.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <PodiumIcon className={`w-4 h-4 ${podiumIdx === 0 ? "text-yellow-500" : podiumIdx === 1 ? "text-gray-400" : "text-amber-600"}`} />
                      <span className="text-xs font-bold">#{podiumIdx + 1}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-bold mt-1">
                      {((clan as any)[clanSortKey] || 0).toLocaleString()} {CLAN_SORT_OPTIONS.find(o => o.key === clanSortKey)?.label}
                    </Badge>
                    <div className={`mt-2 rounded-t-lg bg-gradient-to-b ${PODIUM_COLORS[podiumIdx]} mx-auto`} style={{ height: podiumIdx === 0 ? 100 : podiumIdx === 1 ? 70 : 50, width: "80%" }} />
                  </motion.div>
                );
              })}
            </div>
          )}

          {myClanRank > 0 && (
            <Card className="p-4 mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-black text-lg text-purple-500">#{myClanRank}</span>
                  <span className="font-bold">Your Clan</span>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {sortedClans.map((clan, i) => (
              <motion.div
                key={clan.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className={`p-4 flex items-center gap-4 border-border ${clan.id === (user as any)?.clanId ? "ring-2 ring-purple-500/30" : ""}`}
                  data-testid={`clan-row-${clan.id}`}
                >
                  <span className={`font-black text-lg w-8 text-center ${i < 3 ? "text-yellow-500" : "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ring-1 ring-white/10"
                    style={{ background: clan.color }}
                  >
                    {CLAN_ICON_EMOJIS[clan.icon] || "🛡️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">[{clan.tag}] {clan.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Users className="w-3 h-3" /> {clan.memberCount}
                      </span>
                      <span>-</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3" /> {clan.totalXP.toLocaleString()} XP
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Gem className="w-3 h-3 text-green-500" /> {clan.totalGems}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-bold text-xs">
                    {((clan as any)[clanSortKey] || 0).toLocaleString()} {CLAN_SORT_OPTIONS.find(o => o.key === clanSortKey)?.label}
                  </Badge>
                </Card>
              </motion.div>
            ))}
          </div>

          {sortedClans.length === 0 && (
            <div className="text-center py-16">
              <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium text-lg">No clans yet!</p>
              <p className="text-sm text-muted-foreground">Create or join a clan to compete!</p>
            </div>
          )}
        </>
      ) : tab === "teams" ? (
        <>
          {sortedTeams.length >= 3 && (
            <div className="flex items-end justify-center gap-4 mb-8 px-4">
              {[1, 0, 2].map((podiumIdx) => {
                const team = sortedTeams[podiumIdx];
                if (!team) return null;
                const PodiumIcon = [Crown, Medal, Medal][podiumIdx];
                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: podiumIdx * 0.15 }}
                    className="text-center flex-1 max-w-[160px]"
                    data-testid={`team-podium-${podiumIdx + 1}`}
                  >
                    <div className={`${podiumIdx === 0 ? "w-20 h-20" : "w-16 h-16"} rounded-xl mx-auto mb-2 flex items-center justify-center shadow-lg ring-2 ring-white/20`}
                      style={{ background: team.color }}
                    >
                      <span className={podiumIdx === 0 ? "text-3xl" : "text-2xl"}>{team.icon || "⚡"}</span>
                    </div>
                    <p className="font-bold text-sm truncate">{team.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <PodiumIcon className={`w-4 h-4 ${podiumIdx === 0 ? "text-yellow-500" : podiumIdx === 1 ? "text-gray-400" : "text-amber-600"}`} />
                      <span className="text-xs font-bold">#{podiumIdx + 1}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-bold mt-1">
                      {((team as any)[teamSortKey] || 0).toLocaleString()} {TEAM_SORT_OPTIONS.find(o => o.key === teamSortKey)?.label}
                    </Badge>
                    <div className={`mt-2 rounded-t-lg bg-gradient-to-b ${PODIUM_COLORS[podiumIdx]} mx-auto`} style={{ height: podiumIdx === 0 ? 100 : podiumIdx === 1 ? 70 : 50, width: "80%" }} />
                  </motion.div>
                );
              })}
            </div>
          )}

          {myTeamRank > 0 && (
            <Card className="p-4 mb-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-black text-lg text-blue-500">#{myTeamRank}</span>
                  <span className="font-bold">Your Team</span>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {sortedTeams.map((team, i) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className={`p-4 flex items-center gap-4 border-border ${team.id === (user as any)?.teamId ? "ring-2 ring-blue-500/30" : ""}`}
                  data-testid={`team-row-${team.id}`}
                >
                  <span className={`font-black text-lg w-8 text-center ${i < 3 ? "text-yellow-500" : "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ring-1 ring-white/10"
                    style={{ background: team.color }}
                  >
                    {team.icon || "⚡"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{team.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Users className="w-3 h-3" /> {team.memberCount}/5
                      </span>
                      <span>-</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3" /> {team.totalXP.toLocaleString()} XP
                      </span>
                      <span>Led by {team.leaderName}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-bold text-xs">
                    {((team as any)[teamSortKey] || 0).toLocaleString()} {TEAM_SORT_OPTIONS.find(o => o.key === teamSortKey)?.label}
                  </Badge>
                </Card>
              </motion.div>
            ))}
          </div>

          {sortedTeams.length === 0 && (
            <div className="text-center py-16">
              <UsersRound className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium text-lg">No teams yet!</p>
              <p className="text-sm text-muted-foreground">Create a team and invite friends to compete!</p>
            </div>
          )}
        </>
      ) : null}

      {tab === "streaks" && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <span className="text-4xl">🔥</span>
            <div>
              <h2 className="font-black text-xl">Win Streak Leaderboard</h2>
              <p className="text-sm text-muted-foreground">Players with the longest current PvP win streaks</p>
            </div>
          </div>
          {user && (
            <Card className="p-4 mb-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <p className="font-bold text-sm">Your streak</p>
                    <p className="text-xs text-muted-foreground">
                      #{(streakLeaders.findIndex(s => s.id === user.id) + 1) || "—"} on leaderboard
                    </p>
                  </div>
                </div>
                <span className="font-black text-2xl text-orange-500">
                  {(user as any).winStreak || 0}
                </span>
              </div>
            </Card>
          )}
          <div className="space-y-2">
            {streakLeaders.map((entry, i) => (
              <motion.div key={entry.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className={`p-4 flex items-center gap-4 border-border ${entry.id === user?.id ? "ring-2 ring-orange-500/30" : ""}`} data-testid={`streak-row-${entry.id}`}>
                  <span className={`font-black text-lg w-8 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{entry.username} {entry.id === user?.id ? "(You)" : ""}</p>
                    <p className="text-[10px] text-muted-foreground">@{entry.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔥</span>
                    <span className="font-black text-lg text-orange-500">{entry.winStreak}</span>
                    <span className="text-xs text-muted-foreground">streak</span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          {streakLeaders.length === 0 && !streaksLoading && (
            <div className="text-center py-16">
              <span className="text-6xl block mb-4">🔥</span>
              <p className="text-muted-foreground font-medium text-lg">No streaks yet!</p>
              <p className="text-sm text-muted-foreground">Win PvP battles to build your streak.</p>
            </div>
          )}
        </>
      )}

      {tab === "tournaments" && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-500" />
            <div>
              <h2 className="font-black text-xl">Tournament Leaderboard</h2>
              <p className="text-sm text-muted-foreground">Players ranked by total tournament XP earned</p>
            </div>
          </div>
          {user && myTournamentRank > 0 && (
            <Card className="p-4 mb-6 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-black text-lg text-yellow-500">#{myTournamentRank}</span>
                  <div>
                    <p className="font-bold text-sm">Your Rank</p>
                    <p className="text-xs text-muted-foreground">{(user as any).tournamentWins || 0} tournament wins</p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-bold">
                  {((user as any).tournamentXp || 0).toLocaleString()} Tournament XP
                </Badge>
              </div>
            </Card>
          )}
          <div className="space-y-2">
            {tournamentLeaders.map((leader, i) => {
              const avatar = getAvatarInfo(leader.avatarId);
              const AvatarIcon = avatar.icon;
              return (
                <motion.div key={leader.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className={`p-4 flex items-center gap-4 border-border ${leader.id === user?.id ? "ring-2 ring-yellow-500/30" : ""}`} data-testid={`tournament-row-${leader.id}`}>
                    <span className={`font-black text-lg w-8 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full overflow-hidden ${FRAME_MINI_STYLES[leader.equippedCosmetics?.frame || ""] || "ring-1 ring-white/10"}`}>
                        <div className={`w-full h-full rounded-full bg-gradient-to-br ${avatar.gradient} flex items-center justify-center text-white`}>
                          <AvatarIcon className="w-5 h-5" />
                        </div>
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${leader.isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} title={leader.isOnline ? "Online" : "Offline"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserNameDisplay username={leader.username} displayName={leader.displayName} nameClassName="text-sm" />
                        {leader.isVip && (
                          <Badge className="text-[9px] font-black px-1 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 shrink-0" data-testid={`tournament-vip-badge-${leader.id}`}>
                            ✦ VIP
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Lv.{leader.level}</span>
                        <span className="flex items-center gap-0.5">
                          <Trophy className="w-3 h-3 text-yellow-500" /> {leader.tournamentWins} wins
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-bold text-xs shrink-0">
                      {(leader.tournamentXp || 0).toLocaleString()} XP
                    </Badge>
                  </Card>
                </motion.div>
              );
            })}
          </div>
          {tournamentLeaders.length === 0 && !tournamentsLoading && (
            <div className="text-center py-16">
              <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium text-lg">No tournament data yet!</p>
              <p className="text-sm text-muted-foreground">Compete in tournaments to appear here.</p>
            </div>
          )}
        </>
      )}
    <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
    </div>
  );
}
