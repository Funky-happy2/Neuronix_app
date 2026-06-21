import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { renderMentions, UserNameDisplay } from "@/lib/mentions";
import UserProfileModal from "@/components/UserProfileModal";
import { resolveAvatarIcon } from "@/lib/avatarIcons";
import {
  Shield, Users, Star, Gem, Award, Crown, Loader2,
  Plus, LogOut, UserMinus, ArrowLeft, Coins, MessageCircle, Send,
  Pencil, Save, Target, Scroll, Sparkles, UserCheck, X,
  Rocket, FlaskConical, Bot, Swords, Wand2, Flame, Bird, Diamond,
  ShieldPlus, ShieldMinus, ClipboardList, Check, Trash2, CirclePlus,
  Snowflake, Orbit, Vote, CheckCircle, Play, Moon, Globe, Waves, Zap, Cpu, Atom, TreePine,
  Telescope, Mountain, Wind, Sun, Hexagon, Footprints, TrendingUp,
  GraduationCap, Calendar, RefreshCw, Gamepad2, Medal, Skull, Trophy,
  type LucideIcon
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { ALL_QUESTIONS, type Question } from "@/lib/questionBank";

interface JoinTestQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface ClanElection {
  active: boolean;
  candidates: { id: number; username: string; votes: number }[];
  votes: Record<string, number>;
  startedAt: string;
  startedBy: number;
  totalMembers: number;
  winner?: { id: number; username: string; votes: number };
}

interface Clan {
  id: number;
  name: string;
  tag: string;
  description: string;
  leaderId: number;
  leaderName: string;
  coLeaders: number[];
  icon: string;
  color: string;
  motto: string;
  goals: string;
  plans: string;
  attributes: string;
  recruiting: boolean;
  joinTest: JoinTestQuestion[];
  memberCount: number;
  totalXP: number;
  totalCoins: number;
  totalGems: number;
  totalBadges: number;
  election: ClanElection | null;
  createdAt: string;
}

interface ClanMember {
  id: number;
  username: string;
  displayName?: string | null;
  xp: number;
  level: number;
  coins: number;
  gems: number;
  badges: string[];
  avatarId: string;
  equippedCosmetics: Record<string, string>;
  inventory: string[];
  totalGamesPlayed: number;
  currentStreak: number;
}

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
  "avatar-supreme-champion": { icon: Gem, gradient: "from-yellow-400 to-orange-600" },
};

const TITLE_DISPLAY: Record<string, string> = {
  "title-explorer": "Explorer",
  "title-champion": "Champion",
  "title-legend": "Legend",
  "title-professor": "Professor",
  "title-mastermind": "Mastermind",
  "reward-omega-title": "Omega Slayer",
  "reward-speed-title": "Speed Demon",
  "title-leaderboard-1st": "#1 Player",
  "title-clan-1st": "#1 Clan Leader",
  "title-team-1st": "#1 Team Captain",
  "reward-tournament-title": "Tournament Champion",
  "reward-clan-champion": "Clan Champion",
};

interface ClanBattle {
  id: number;
  challengerClanId: number;
  challengerClanName: string;
  defenderClanId: number;
  defenderClanName: string;
  status: string;
  matchups: {
    round: number;
    challengerUserId: number | null;
    challengerUsername: string;
    defenderUserId: number | null;
    defenderUsername: string;
    challengerScore: number;
    defenderScore: number;
    completed: boolean;
  }[];
  challengerScore: number;
  defenderScore: number;
  winnerId: number | null;
  winnerName: string | null;
  gemReward: number;
  xpReward: number;
  createdAt: string;
  completedAt: string | null;
}

const CLAN_COLORS = [
  "hsl(270, 85%, 55%)", "hsl(210, 85%, 55%)", "hsl(150, 70%, 45%)",
  "hsl(340, 80%, 55%)", "hsl(45, 95%, 50%)", "hsl(0, 75%, 55%)",
  "hsl(180, 80%, 50%)", "hsl(25, 95%, 50%)", "hsl(300, 75%, 50%)",
  "hsl(120, 65%, 45%)", "hsl(190, 85%, 50%)", "hsl(15, 90%, 55%)",
];

const CLAN_ICONS = ["Shield", "Sword", "Crown", "Star", "Fire", "Lightning", "Dragon", "Skull", "Diamond", "Rocket"];
const CLAN_ICON_EMOJIS: Record<string, string> = {
  Shield: "🛡️", Sword: "⚔️", Crown: "👑", Star: "⭐", Fire: "🔥",
  Lightning: "⚡", Dragon: "🐉", Skull: "💀", Diamond: "💎", Rocket: "🚀",
};

function ElectionCountdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  if (remaining <= 0) {
    return <Badge variant="secondary" className="text-[10px] gap-1" data-testid="badge-election-ended"><CheckCircle className="w-3 h-3" /> Election ended - awaiting results</Badge>;
  }

  return (
    <Badge variant="outline" className="text-[10px] gap-1 font-mono tabular-nums" data-testid="badge-election-countdown">
      {hours.toString().padStart(2, "0")}:{minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")} left
    </Badge>
  );
}

export default function ClansPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [viewingClan, setViewingClan] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newMotto, setNewMotto] = useState("");
  const [selectedColor, setSelectedColor] = useState(CLAN_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState("Shield");
  const [editingCover, setEditingCover] = useState(false);
  const [editFields, setEditFields] = useState({
    description: "", motto: "", goals: "", plans: "", attributes: "", recruiting: true, icon: "Shield", color: CLAN_COLORS[0],
    joinTest: [] as JoinTestQuestion[],
  });
  const [testQuiz, setTestQuiz] = useState<{ clanId: number; questions: { question: string; options: string[] }[]; answers: number[] } | null>(null);

  const { data: allClans = [], isLoading } = useQuery<Clan[]>({
    queryKey: ["/api/clans"],
  });

  const { data: clanDetail, isLoading: detailLoading } = useQuery<{ clan: Clan; members: ClanMember[] }>({
    queryKey: ["/api/clans", viewingClan],
    enabled: viewingClan !== null,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clans", {
        name: newName, tag: newTag, description: newDesc, color: selectedColor, icon: selectedIcon, motto: newMotto,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Clan Created!", description: `[${newTag.toUpperCase()}] ${newName} is ready!` });
      setCreating(false);
      setNewName(""); setNewTag(""); setNewDesc(""); setNewMotto("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const joinMutation = useMutation({
    mutationFn: async ({ clanId, answers }: { clanId: number; answers?: number[] }) => {
      const res = await apiRequest("POST", `/api/clans/${clanId}/join`, answers ? { answers } : {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (viewingClan) queryClient.invalidateQueries({ queryKey: ["/api/clans", viewingClan] });
      setTestQuiz(null);
      toast({ title: "Joined!", description: "Welcome to the clan!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const tryJoinClan = (clan: Clan) => {
    const test = Array.isArray(clan.joinTest) ? clan.joinTest : [];
    if (test.length > 0) {
      setTestQuiz({ clanId: clan.id, questions: test.map(q => ({ question: q.question, options: q.options })), answers: new Array(test.length).fill(-1) });
    } else {
      joinMutation.mutate({ clanId: clan.id });
    }
  };

  const leaveMutation = useMutation({
    mutationFn: async (clanId: number) => {
      const res = await apiRequest("POST", `/api/clans/${clanId}/leave`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setViewingClan(null);
      toast({ title: "Left clan", description: "You left the clan" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const kickMutation = useMutation({
    mutationFn: async ({ clanId, userId }: { clanId: number; userId: number }) => {
      const res = await apiRequest("POST", `/api/clans/${clanId}/kick`, { userId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      if (viewingClan) queryClient.invalidateQueries({ queryKey: ["/api/clans", viewingClan] });
      toast({ title: "Member kicked", description: data.message || "Member removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const adminDeleteMutation = useMutation({
    mutationFn: async (clanId: number) => {
      const res = await apiRequest("POST", `/api/admin/clans/${clanId}/delete`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setViewingClan(null);
      toast({ title: "Clan deleted", description: data.message || "Clan removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const voteKickMutation = useMutation({
    mutationFn: async (clanId: number) => {
      const res = await apiRequest("POST", `/api/clans/${clanId}/kick/vote`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      if (viewingClan) queryClient.invalidateQueries({ queryKey: ["/api/clans", viewingClan] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: data.resolved ? "Vote complete" : "Vote recorded", description: data.message });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ clanId, userId }: { clanId: number; userId: number }) => {
      const res = await apiRequest("POST", `/api/clans/${clanId}/promote`, { userId });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clans", vars.clanId] });
      toast({ title: "Promoted!", description: "Member is now a co-leader" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const demoteMutation = useMutation({
    mutationFn: async ({ clanId, userId }: { clanId: number; userId: number }) => {
      const res = await apiRequest("POST", `/api/clans/${clanId}/demote`, { userId });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clans", vars.clanId] });
      toast({ title: "Demoted", description: "Member is no longer a co-leader" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startElectionMutation = useMutation({
    mutationFn: async (clanId: number) => {
      const res = await apiRequest("POST", `/api/clans/${clanId}/election/start`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      if (viewingClan) queryClient.invalidateQueries({ queryKey: ["/api/clans", viewingClan] });
      toast({ title: "Election Started!", description: "Members can now vote for a new leader." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const voteElectionMutation = useMutation({
    mutationFn: async ({ clanId, candidateId }: { clanId: number; candidateId: number }) => {
      const res = await apiRequest("POST", `/api/clans/${clanId}/election/vote`, { candidateId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      if (viewingClan) queryClient.invalidateQueries({ queryKey: ["/api/clans", viewingClan] });
      toast({ title: "Vote Cast!", description: "Your vote has been recorded." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [viewingBattle, setViewingBattle] = useState<number | null>(null);
  const [challengingClan, setChallengingClan] = useState(false);
  const [battleQuiz, setBattleQuiz] = useState<{
    battleId: number;
    roundIndex: number;
    questions: { question: string; options: string[]; correct: number }[];
    currentQ: number;
    score: number;
    answers: number[];
    finished: boolean;
  } | null>(null);

  const { data: clanBattles = [] } = useQuery<ClanBattle[]>({
    queryKey: ["/api/clan-battles"],
    enabled: !!(user as any)?.clanId,
    refetchInterval: 15000,
  });

  const challengeMutation = useMutation({
    mutationFn: async (defenderClanId: number) => {
      const res = await apiRequest("POST", "/api/clan-battles/challenge", { defenderClanId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles"] });
      setChallengingClan(false);
      toast({ title: "Challenge Sent!", description: "Waiting for the other clan to accept." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const acceptBattleMutation = useMutation({
    mutationFn: async (battleId: number) => {
      const res = await apiRequest("POST", `/api/clan-battles/${battleId}/accept`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles"] });
      toast({ title: "Challenge Accepted!", description: "The battle is now active!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const declineBattleMutation = useMutation({
    mutationFn: async (battleId: number) => {
      const res = await apiRequest("POST", `/api/clan-battles/${battleId}/decline`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles"] });
      toast({ title: "Declined", description: "Challenge declined." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitBattleScoreMutation = useMutation({
    mutationFn: async ({ battleId, roundIndex, score }: { battleId: number; roundIndex: number; score: number }) => {
      const res = await apiRequest("POST", `/api/clan-battles/${battleId}/submit-score`, { roundIndex, score });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles"] });
      if (data.allDone) {
        toast({ title: "Battle Complete!", description: `Final score: ${data.challengerTotal} - ${data.defenderTotal}` });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      } else {
        toast({ title: "Score Submitted!", description: "Waiting for the opponent." });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateClanMutation = useMutation({
    mutationFn: async ({ clanId, data }: { clanId: number; data: any }) => {
      const res = await apiRequest("POST", `/api/clans/${clanId}/update`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      if (viewingClan) queryClient.invalidateQueries({ queryKey: ["/api/clans", viewingClan] });
      toast({ title: "Clan Updated!", description: "Your clan's cover page has been saved." });
      setEditingCover(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const myClan = allClans.find(c => c.id === (user as any)?.clanId);

  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: chatMessages = [] } = useQuery<{ id: number; username: string; content: string; createdAt: string; userId: number }[]>({
    queryKey: ["/api/chat/clan", viewingClan],
    enabled: viewingClan !== null && (user as any)?.clanId === viewingClan,
    refetchInterval: 5000,
  });

  const sendChatMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/chat/clan/${viewingClan}`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/clan", viewingClan] });
      setChatMsg("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const startEditCover = (clan: Clan) => {
    setEditFields({
      description: clan.description || "",
      motto: clan.motto || "",
      goals: clan.goals || "",
      plans: clan.plans || "",
      attributes: clan.attributes || "",
      recruiting: clan.recruiting !== false,
      icon: clan.icon || "Shield",
      color: clan.color || CLAN_COLORS[0],
      joinTest: Array.isArray(clan.joinTest) ? clan.joinTest : [],
    });
    setEditingCover(true);
  };

  if (viewingClan && clanDetail) {
    const { clan, members } = clanDetail;
    const coLeaderIds = Array.isArray(clan.coLeaders) ? clan.coLeaders : [];
    const isOwner = clan.leaderId === user?.id;
    const isCoLeader = coLeaderIds.includes(user?.id ?? -1);
    const isLeader = isOwner || isCoLeader;
    const isMember = (user as any)?.clanId === clan.id;
    const clanEmoji = CLAN_ICON_EMOJIS[clan.icon] || "🛡️";
    const hasCoverContent = clan.motto || clan.goals || clan.plans || clan.attributes;
    const kickVote = (clan.election as any)?.type === "kick" && (clan.election as any)?.active ? (clan.election as any) : null;

    return (
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => { setViewingClan(null); setEditingCover(false); }} className="gap-2" data-testid="button-back-clans">
            <ArrowLeft className="w-4 h-4" /> Back to Clans
          </Button>
          {(user as any)?.isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1"
              disabled={adminDeleteMutation.isPending}
              onClick={() => { if (window.confirm(`Delete the clan "${clan.name}"? This removes every member and cannot be undone.`)) adminDeleteMutation.mutate(clan.id); }}
              data-testid="button-admin-delete-clan"
            >
              <Trash2 className="w-4 h-4" /> Delete Clan (Admin)
            </Button>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden mb-6 relative" style={{ background: clan.color }}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="px-6 py-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-4xl shadow-xl">
                {clanEmoji}
              </div>
              <div className="flex-1 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-white/20 text-white border-0 text-xs font-bold">[{clan.tag}]</Badge>
                  {clan.recruiting !== false ? (
                    <Badge className="bg-green-500/80 text-white border-0 text-[10px] gap-0.5"><UserCheck className="w-2.5 h-2.5" /> Recruiting</Badge>
                  ) : (
                    <Badge className="bg-red-500/80 text-white border-0 text-[10px] gap-0.5"><X className="w-2.5 h-2.5" /> Closed</Badge>
                  )}
                </div>
                <h1 className="text-3xl font-black" data-testid="text-clan-name">{clan.name}</h1>
                {clan.motto && (
                  <p className="text-sm italic opacity-90 mt-1">"{clan.motto}"</p>
                )}
                <p className="text-xs opacity-70 mt-1">Led by <span className="font-bold">{clan.leaderName}</span> · Founded {new Date(clan.createdAt).toLocaleDateString()}</p>
              </div>
              {isLeader && !editingCover && (
                <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/20 gap-1 self-start" onClick={() => startEditCover(clan)} data-testid="button-edit-cover">
                  <Pencil className="w-4 h-4" /> Edit
                </Button>
              )}
            </div>
          </div>
        </div>

        {editingCover && isLeader && (
          <Card className="p-5 mb-6 space-y-4 border-2 border-dashed border-purple-500/30">
            <h3 className="font-bold flex items-center gap-2"><Pencil className="w-4 h-4 text-purple-500" /> Edit Clan Cover Page</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold mb-1 block">Clan Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {CLAN_ICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setEditFields(f => ({ ...f, icon: ic }))}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${editFields.icon === ic ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 scale-110" : "bg-muted hover:bg-muted/80"}`}
                      data-testid={`button-icon-${ic}`}
                    >
                      {CLAN_ICON_EMOJIS[ic]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold mb-1 block">Clan Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {CLAN_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditFields(f => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-full transition-all ${editFields.color === c ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                      data-testid={`button-clan-color`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold mb-1 block">Motto (short tagline)</label>
              <Input value={editFields.motto} onChange={e => setEditFields(f => ({ ...f, motto: e.target.value }))} maxLength={100} placeholder="e.g. Science rules, we conquer!" data-testid="input-edit-motto" />
            </div>
            <div>
              <label className="text-xs font-bold mb-1 block">Description</label>
              <Textarea value={editFields.description} onChange={e => setEditFields(f => ({ ...f, description: e.target.value }))} maxLength={500} placeholder="Tell people what your clan is about..." rows={3} data-testid="input-edit-desc" />
            </div>
            <div>
              <label className="text-xs font-bold mb-1 block flex items-center gap-1"><Target className="w-3.5 h-3.5 text-blue-500" /> Goals</label>
              <Textarea value={editFields.goals} onChange={e => setEditFields(f => ({ ...f, goals: e.target.value }))} maxLength={500} placeholder="What is your clan working towards? e.g. Top 3 on the leaderboard, Defeat all bosses..." rows={3} data-testid="input-edit-goals" />
            </div>
            <div>
              <label className="text-xs font-bold mb-1 block flex items-center gap-1"><Scroll className="w-3.5 h-3.5 text-emerald-500" /> Plans</label>
              <Textarea value={editFields.plans} onChange={e => setEditFields(f => ({ ...f, plans: e.target.value }))} maxLength={500} placeholder="What are your clan's upcoming plans? e.g. Weekly science challenges, Boss battle events..." rows={3} data-testid="input-edit-plans" />
            </div>
            <div>
              <label className="text-xs font-bold mb-1 block flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Attributes</label>
              <Textarea value={editFields.attributes} onChange={e => setEditFields(f => ({ ...f, attributes: e.target.value }))} maxLength={500} placeholder="What makes your clan special? e.g. Friendly, Competitive, Helpful, Active daily..." rows={3} data-testid="input-edit-attributes" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold">Open for Recruiting?</label>
              <Button
                size="sm"
                variant={editFields.recruiting ? "default" : "outline"}
                className="gap-1 text-xs"
                onClick={() => setEditFields(f => ({ ...f, recruiting: !f.recruiting }))}
                data-testid="button-toggle-recruiting"
              >
                {editFields.recruiting ? <><UserCheck className="w-3 h-3" /> Yes, Recruiting</> : <><X className="w-3 h-3" /> Closed</>}
              </Button>
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <label className="text-xs font-bold mb-2 block flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-indigo-500" /> Entry Test (optional, up to 5 questions)
              </label>
              <p className="text-[11px] text-muted-foreground mb-3">Add science questions that joiners must answer correctly to join your clan. Leave empty for open joining.</p>
              {editFields.joinTest.map((q, qi) => (
                <Card key={qi} className="p-3 mb-3 bg-muted/30 border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Question {qi + 1}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-600" onClick={() => setEditFields(f => ({ ...f, joinTest: f.joinTest.filter((_, i) => i !== qi) }))} data-testid={`button-remove-q-${qi}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Input
                    value={q.question}
                    onChange={e => setEditFields(f => ({ ...f, joinTest: f.joinTest.map((qq, i) => i === qi ? { ...qq, question: e.target.value } : qq) }))}
                    maxLength={200}
                    placeholder="e.g. What planet is closest to the Sun?"
                    className="text-sm"
                    data-testid={`input-test-q-${qi}`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map(oi => (
                      <div key={oi} className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditFields(f => ({ ...f, joinTest: f.joinTest.map((qq, i) => i === qi ? { ...qq, correctIndex: oi } : qq) }))}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${q.correctIndex === oi ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/40"}`}
                          data-testid={`button-correct-${qi}-${oi}`}
                        >
                          {q.correctIndex === oi && <Check className="w-3 h-3" />}
                        </button>
                        <Input
                          value={q.options[oi] || ""}
                          onChange={e => { const val = e.target.value; setEditFields(f => ({ ...f, joinTest: f.joinTest.map((qq, i) => i === qi ? { ...qq, options: qq.options.map((o, j) => j === oi ? val : o) } : qq) })); }}
                          maxLength={100}
                          placeholder={`Option ${oi + 1}`}
                          className="text-xs h-8"
                          data-testid={`input-opt-${qi}-${oi}`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Click the green circle to mark the correct answer</p>
                </Card>
              ))}
              {editFields.joinTest.length < 5 && (
                <Button size="sm" variant="outline" className="gap-1 text-xs font-bold" onClick={() => setEditFields(f => ({ ...f, joinTest: [...f.joinTest, { question: "", options: ["", "", "", ""], correctIndex: 0 }] }))} data-testid="button-add-test-question">
                  <CirclePlus className="w-3.5 h-3.5" /> Add Question
                </Button>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="gap-1 font-bold" onClick={() => updateClanMutation.mutate({ clanId: clan.id, data: editFields })} disabled={updateClanMutation.isPending} data-testid="button-save-cover">
                {updateClanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Cover Page
              </Button>
              <Button variant="ghost" onClick={() => setEditingCover(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {(clan.description || hasCoverContent) && !editingCover && (
          <Card className="p-5 mb-6">
            {clan.description && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">{clan.description}</p>
              </div>
            )}
            {hasCoverContent && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {clan.goals && (
                  <div className="bg-blue-500/5 dark:bg-blue-500/10 rounded-xl p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" /> Goals
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">{clan.goals}</p>
                  </div>
                )}
                {clan.plans && (
                  <div className="bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                      <Scroll className="w-3.5 h-3.5" /> Plans
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">{clan.plans}</p>
                  </div>
                )}
                {clan.attributes && (
                  <div className="bg-amber-500/5 dark:bg-amber-500/10 rounded-xl p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Attributes
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">{clan.attributes}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        <Card className="p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <Users className="w-4 h-4 mx-auto mb-1 text-blue-500" />
              <p className="font-black text-lg">{clan.memberCount}</p>
              <p className="text-[10px] text-muted-foreground">Members</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <Star className="w-4 h-4 mx-auto mb-1 text-yellow-500" />
              <p className="font-black text-lg">{clan.totalXP.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total XP</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <Coins className="w-4 h-4 mx-auto mb-1 text-amber-600 dark:text-amber-400" />
              <p className="font-black text-lg">{clan.totalCoins.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total Neuros</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <Gem className="w-4 h-4 mx-auto mb-1 text-green-500" />
              <p className="font-black text-lg">{clan.totalGems}</p>
              <p className="text-[10px] text-muted-foreground">Total Sparks</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <Award className="w-4 h-4 mx-auto mb-1 text-purple-500" />
              <p className="font-black text-lg">{clan.totalBadges}</p>
              <p className="text-[10px] text-muted-foreground">Total Badges</p>
            </div>
          </div>

          <div className="flex gap-2">
            {!isMember && !(user as any)?.clanId && clan.recruiting !== false && (
              <Button onClick={() => tryJoinClan(clan)} disabled={joinMutation.isPending} className="gap-2 font-bold" data-testid="button-join-clan">
                <Plus className="w-4 h-4" /> {Array.isArray(clan.joinTest) && clan.joinTest.length > 0 ? "Take Entry Test" : "Join Clan"}
              </Button>
            )}
            {!isMember && !(user as any)?.clanId && clan.recruiting === false && (
              <p className="text-sm text-muted-foreground italic">This clan is not currently recruiting.</p>
            )}
            {isMember && (
              <Button variant="destructive" onClick={() => leaveMutation.mutate(clan.id)} disabled={leaveMutation.isPending} className="gap-2 font-bold" data-testid="button-leave-clan">
                <LogOut className="w-4 h-4" /> Leave Clan
              </Button>
            )}
          </div>
        </Card>

        {isMember && kickVote && (
          <Card className="p-4 mb-6 border-red-500/30 bg-red-500/5">
            <h2 className="text-lg font-black mb-2 flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-red-500" /> Kick Vote
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Owner requested removing <span className="font-bold text-foreground">{kickVote.targetName}</span>. Everyone except the owner and that player must approve.
            </p>
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary" className="font-bold" data-testid="badge-kick-vote-progress">
                {Object.keys(kickVote.votes || {}).length}/{kickVote.requiredVotes || 0} approvals
              </Badge>
              {kickVote.eligibleVoters?.some((v: any) => v.id === user?.id) && !kickVote.votes?.[String(user?.id)] && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="font-bold gap-1"
                  onClick={() => voteKickMutation.mutate(clan.id)}
                  disabled={voteKickMutation.isPending}
                  data-testid="button-approve-kick-clan"
                >
                  {voteKickMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Approve
                </Button>
              )}
              {kickVote.votes?.[String(user?.id)] && (
                <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-0 gap-1" data-testid="badge-kick-voted">
                  <CheckCircle className="w-3 h-3" /> You approved
                </Badge>
              )}
            </div>
          </Card>
        )}

        {isMember && (
          <Card className="p-4 mb-6 border-border">
            <h2 className="text-lg font-black mb-3 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-purple-500" /> Clan Chat
            </h2>
            <div className="h-64 overflow-y-auto bg-muted/30 rounded-lg p-3 mb-3 space-y-2" data-testid="chat-messages-clan">
              {chatMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No messages yet. Say hello to your clan!</p>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.userId === user?.id ? "items-end" : "items-start"}`} data-testid={`chat-msg-${msg.id}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${msg.userId === user?.id ? "bg-purple-500 text-white" : "bg-muted"}`}>
                    <p className={`text-[10px] font-bold mb-0.5 cursor-pointer hover:underline ${msg.userId === user?.id ? "text-purple-200" : "text-muted-foreground"}`} onClick={() => setProfileUsername(msg.username)}>@{msg.username}</p>
                    <p className="text-sm break-words">{renderMentions(msg.content, user?.username)}</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <Input
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                placeholder="Type a message..."
                maxLength={500}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatMsg.trim()) {
                    sendChatMutation.mutate(chatMsg.trim());
                  }
                }}
                data-testid="input-chat-clan"
              />
              <Button
                size="sm"
                onClick={() => chatMsg.trim() && sendChatMutation.mutate(chatMsg.trim())}
                disabled={!chatMsg.trim() || sendChatMutation.isPending}
                className="shrink-0"
                data-testid="button-send-chat-clan"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {isMember && (() => {
          const election = clan.election;
          const hasActiveElection = election?.active === true && (election as any)?.type !== "kick";
          const hasWinner = (election as any)?.type !== "kick" && election?.winner;
          const userVotedFor = election?.votes ? (election.votes as Record<string, number>)[String(user?.id)] : undefined;
          const totalVotes = election?.candidates ? election.candidates.reduce((sum, c) => sum + c.votes, 0) : 0;
          const electionStartedAt = election?.startedAt ? new Date(election.startedAt).getTime() : 0;
          const electionEndsAt = electionStartedAt + 24 * 60 * 60 * 1000;

          return (
            <Card className="p-4 mb-6 border-border">
              <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                <Vote className="w-5 h-5 text-indigo-500" /> Leadership Election
              </h2>

              {!hasActiveElection && !hasWinner && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    No election is currently active. Any member can call an election to let everyone vote on new leadership.
                  </p>
                  <Button
                    onClick={() => startElectionMutation.mutate(clan.id)}
                    disabled={startElectionMutation.isPending}
                    className="gap-2 font-bold"
                    data-testid="button-call-election"
                  >
                    {startElectionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Vote className="w-4 h-4" />}
                    Call Election
                  </Button>
                </div>
              )}

              {hasActiveElection && !hasWinner && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      An election is in progress! Vote for your preferred candidate.
                    </p>
                    <ElectionCountdown endsAt={electionEndsAt} />
                  </div>
                  <div className="space-y-2 mb-3">
                    {(election!.candidates || []).map((candidate) => {
                      const votePercent = totalVotes > 0 ? Math.round((candidate.votes / totalVotes) * 100) : 0;
                      const isVotedFor = userVotedFor === candidate.id;
                      return (
                        <div key={candidate.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg" data-testid={`election-candidate-${candidate.id}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-sm">@{candidate.username}</p>
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Vote className="w-3 h-3" /> {candidate.votes}
                              </Badge>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${votePercent}%` }}
                                data-testid={`vote-bar-${candidate.id}`}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{votePercent}% of votes</p>
                          </div>
                          {!userVotedFor && (
                            <Button
                              size="sm"
                              onClick={() => voteElectionMutation.mutate({ clanId: clan.id, candidateId: candidate.id })}
                              disabled={voteElectionMutation.isPending}
                              className="gap-1 font-bold"
                              data-testid={`button-vote-${candidate.id}`}
                            >
                              {voteElectionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Vote className="w-3 h-3" />}
                              Vote
                            </Button>
                          )}
                          {isVotedFor && (
                            <Badge variant="default" className="text-[10px] gap-0.5"><CheckCircle className="w-3 h-3" /> Voted</Badge>
                          )}
                          {userVotedFor && !isVotedFor && (
                            <Badge variant="secondary" className="text-[10px]">--</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {(election!.candidates || []).length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No candidates registered yet.</p>
                  )}
                </div>
              )}

              {hasWinner && (
                <div className="space-y-3">
                  <div className="bg-muted/30 rounded-lg p-4 text-center space-y-1">
                    <Crown className="w-7 h-7 mx-auto text-yellow-500" />
                    <p className="text-base font-black">@{election!.winner!.username}</p>
                    <p className="text-xs text-muted-foreground">Won the election with {election!.winner!.votes} vote{election!.winner!.votes !== 1 ? "s" : ""}!</p>
                  </div>
                  {election!.candidates && election!.candidates.length > 1 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-muted-foreground">Final Results</p>
                      {[...election!.candidates].sort((a, b) => b.votes - a.votes).map((candidate) => {
                        const finalTotalVotes = election!.candidates.reduce((s, c) => s + c.votes, 0);
                        const pct = finalTotalVotes > 0 ? Math.round((candidate.votes / finalTotalVotes) * 100) : 0;
                        return (
                          <div key={candidate.id} className="flex items-center gap-2 text-xs">
                            <span className="font-bold w-24 truncate">@{candidate.username}</span>
                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-muted-foreground w-10 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 w-full"
                    onClick={() => startElectionMutation.mutate(clan.id)}
                    disabled={startElectionMutation.isPending}
                    data-testid="button-new-election"
                  >
                    {startElectionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Vote className="w-3.5 h-3.5" />}
                    Call New Election
                  </Button>
                </div>
              )}
            </Card>
          );
        })()}

        {isMember && battleQuiz && (
          <Card className="p-5 mb-6 border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-red-500/5">
            <div className="text-center mb-4">
              <Swords className="w-8 h-8 text-red-500 mx-auto mb-1" />
              <h3 className="text-lg font-black" data-testid="text-battle-quiz-title">Clan Battle Round</h3>
              <p className="text-xs text-muted-foreground">Answer 5 science questions. Each correct answer = 200 points!</p>
            </div>

            {!battleQuiz.finished ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="text-xs">Question {battleQuiz.currentQ + 1} / 5</Badge>
                  <Badge variant="secondary" className="text-xs"><Star className="w-3 h-3 mr-0.5" /> {battleQuiz.score} pts</Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                  <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${((battleQuiz.currentQ) / 5) * 100}%` }} />
                </div>
                <div className="bg-muted/40 rounded-xl p-4">
                  <p className="font-bold text-sm mb-4" data-testid="text-battle-question">{battleQuiz.questions[battleQuiz.currentQ]?.question || "Loading..."}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(battleQuiz.questions[battleQuiz.currentQ]?.options || []).map((opt, oi) => (
                      <Button
                        key={oi}
                        variant="outline"
                        onClick={() => {
                          const q = battleQuiz.questions[battleQuiz.currentQ];
                          if (!q) return;
                          const correct = oi === q.correct;
                          const newScore = battleQuiz.score + (correct ? 200 : 0);
                          const newAnswers = [...battleQuiz.answers, oi];
                          const nextQ = battleQuiz.currentQ + 1;
                          const totalQs = battleQuiz.questions.length;

                          if (nextQ >= totalQs) {
                            setBattleQuiz({ ...battleQuiz, currentQ: nextQ, answers: newAnswers, score: newScore, finished: true });
                            submitBattleScoreMutation.mutate({
                              battleId: battleQuiz.battleId,
                              roundIndex: battleQuiz.roundIndex,
                              score: newScore,
                            });
                          } else {
                            setBattleQuiz({ ...battleQuiz, currentQ: nextQ, answers: newAnswers, score: newScore });
                          }
                        }}
                        className="p-3 h-auto text-sm font-semibold text-left justify-start"
                        data-testid={`button-battle-answer-${oi}`}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                  <Award className="w-8 h-8 text-amber-500" />
                </div>
                <p className="text-2xl font-black" data-testid="text-battle-final-score">{battleQuiz.score} / {battleQuiz.questions.length * 200}</p>
                <p className="text-sm text-muted-foreground">
                  You got {battleQuiz.score / 200} out of {battleQuiz.questions.length} correct!
                </p>
                <div className="space-y-1 text-xs text-left bg-muted/30 rounded-lg p-3">
                  {battleQuiz.questions.map((q, qi) => {
                    const wasCorrect = battleQuiz.answers[qi] === q.correct;
                    return (
                      <div key={qi} className="flex items-start gap-2">
                        {wasCorrect ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                        )}
                        <span className={wasCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {q.question} — {q.options[q.correct]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Button onClick={() => setBattleQuiz(null)} className="gap-2 font-bold" data-testid="button-battle-quiz-done">
                  <ArrowLeft className="w-4 h-4" /> Back to Battle
                </Button>
              </div>
            )}
          </Card>
        )}

        {isMember && !battleQuiz && (
          <Card className="p-4 mb-6 border-border">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-500" /> Clan Battles
              </h2>
              {isLeader && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 font-bold"
                  onClick={() => setChallengingClan(!challengingClan)}
                  data-testid="button-challenge-clan"
                >
                  <Swords className="w-3.5 h-3.5" /> {challengingClan ? "Cancel" : "Challenge"}
                </Button>
              )}
            </div>

            {challengingClan && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-muted-foreground">Select a clan to challenge:</p>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {allClans.filter(c => c.id !== clan.id).map(c => (
                    <div key={c.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg" data-testid={`challenge-target-${c.id}`}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: c.color }}>
                        {CLAN_ICON_EMOJIS[c.icon] || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">[{c.tag}] {c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.memberCount} members</p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1 font-bold text-xs"
                        onClick={() => challengeMutation.mutate(c.id)}
                        disabled={challengeMutation.isPending}
                        data-testid={`button-send-challenge-${c.id}`}
                      >
                        <Swords className="w-3 h-3" /> Challenge
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clanBattles.length > 0 ? (
              <div className="space-y-3">
                {clanBattles.slice(0, 10).map(battle => {
                  const isChallenger = battle.challengerClanId === clan.id;
                  const opponentName = isChallenger ? battle.defenderClanName : battle.challengerClanName;
                  const myScore = isChallenger ? battle.challengerScore : battle.defenderScore;
                  const theirScore = isChallenger ? battle.defenderScore : battle.challengerScore;
                  const won = battle.winnerId === clan.id;
                  const lost = battle.winnerId !== null && battle.winnerId !== clan.id;
                  const isPending = battle.status === "pending";
                  const isActive = battle.status === "active";
                  const needsAccept = isPending && !isChallenger;
                  const roundsCompleted = battle.matchups.filter(m => m.completed).length;
                  const totalRounds = battle.matchups.length;

                  return (
                    <div
                      key={battle.id}
                      className={`rounded-lg border overflow-visible cursor-pointer transition-colors hover:border-red-500/30 ${
                        won ? "bg-green-500/5 border-green-500/20" :
                        lost ? "bg-red-500/5 border-red-500/20" :
                        isActive ? "bg-amber-500/5 border-amber-500/20" :
                        "bg-muted/30 border-border"
                      }`}
                      onClick={() => setViewingBattle(viewingBattle === battle.id ? null : battle.id)}
                      data-testid={`battle-card-${battle.id}`}
                    >
                      <div className="p-3 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold">vs {opponentName}</p>
                            {isPending && <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 text-[9px]">Pending</Badge>}
                            {isActive && <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-[9px]">Active</Badge>}
                            {won && <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-0 text-[9px]">Won!</Badge>}
                            {lost && <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0 text-[9px]">Lost</Badge>}
                            {battle.status === "declined" && <Badge className="bg-gray-500/10 text-gray-500 border-0 text-[9px]">Declined</Badge>}
                          </div>
                          {(isActive || battle.status === "completed") && (
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-sm font-black">
                                <span className={myScore > theirScore ? "text-green-600 dark:text-green-400" : ""}>{myScore}</span>
                                <span className="text-muted-foreground mx-1">-</span>
                                <span className={theirScore > myScore ? "text-red-600 dark:text-red-400" : ""}>{theirScore}</span>
                              </p>
                              <span className="text-[10px] text-muted-foreground">{roundsCompleted}/{totalRounds} rounds done</span>
                            </div>
                          )}
                        </div>
                        {needsAccept && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="gap-1 font-bold text-xs"
                              onClick={(e) => { e.stopPropagation(); acceptBattleMutation.mutate(battle.id); }}
                              disabled={acceptBattleMutation.isPending}
                              data-testid={`button-accept-battle-${battle.id}`}
                            >
                              <Check className="w-3 h-3" /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 text-xs"
                              onClick={(e) => { e.stopPropagation(); declineBattleMutation.mutate(battle.id); }}
                              disabled={declineBattleMutation.isPending}
                              data-testid={`button-decline-battle-${battle.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        {(isActive || battle.status === "completed") && (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] gap-0.5"><Gem className="w-3 h-3 text-purple-500" /> {battle.gemReward}</Badge>
                            <Badge variant="secondary" className="text-[10px] gap-0.5"><Star className="w-3 h-3 text-amber-500" /> {battle.xpReward}</Badge>
                          </div>
                        )}
                      </div>

                      {viewingBattle === battle.id && (isActive || battle.status === "completed") && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-xs font-bold text-muted-foreground">Matchups ({totalRounds} rounds)</p>
                            {isActive && (
                              <div className="w-24 bg-muted rounded-full h-1.5">
                                <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${(roundsCompleted / totalRounds) * 100}%` }} />
                              </div>
                            )}
                          </div>

                          <div className="bg-muted/20 rounded-lg overflow-visible">
                            <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-x-2 gap-y-0 text-[10px] font-bold text-muted-foreground px-3 py-1.5 border-b border-border">
                              <span></span>
                              <span>{isChallenger ? clan.name : opponentName}</span>
                              <span className="text-center">Score</span>
                              <span className="text-right">{isChallenger ? opponentName : clan.name}</span>
                              <span></span>
                            </div>

                            {battle.matchups.map((m, mi) => {
                              const isMyRound = m.challengerUserId === user?.id || m.defenderUserId === user?.id;
                              const iAmChallenger = m.challengerUserId === user?.id;
                              const myRoundScore = iAmChallenger ? m.challengerScore : m.defenderScore;
                              const canSubmit = isActive && isMyRound && !m.completed && myRoundScore === 0;
                              const challengerWon = m.completed && m.challengerScore > m.defenderScore;
                              const defenderWon = m.completed && m.defenderScore > m.challengerScore;
                              const tied = m.completed && m.challengerScore === m.defenderScore;

                              return (
                                <div key={mi} className={`grid grid-cols-[auto_1fr_auto_1fr_auto] gap-x-2 items-center px-3 py-2 text-xs ${
                                  isMyRound ? "bg-purple-500/8" : ""
                                } ${mi < battle.matchups.length - 1 ? "border-b border-border/50" : ""}`}>
                                  <span className="text-[10px] font-bold text-muted-foreground w-6">R{m.round}</span>
                                  <span className={`font-semibold truncate ${challengerWon ? "text-green-600 dark:text-green-400" : defenderWon ? "text-red-600 dark:text-red-400" : ""}`}>
                                    {m.challengerUsername}
                                    {isMyRound && m.challengerUserId === user?.id && <span className="text-[9px] text-purple-500 ml-1">(you)</span>}
                                  </span>
                                  <span className={`text-center font-black text-sm min-w-[60px] ${m.completed ? "" : "text-muted-foreground"}`}>
                                    {m.challengerScore} - {m.defenderScore}
                                  </span>
                                  <span className={`font-semibold truncate text-right ${defenderWon ? "text-green-600 dark:text-green-400" : challengerWon ? "text-red-600 dark:text-red-400" : ""}`}>
                                    {m.defenderUsername}
                                    {isMyRound && m.defenderUserId === user?.id && <span className="text-[9px] text-purple-500 ml-1">(you)</span>}
                                  </span>
                                  <div className="w-8 flex justify-end">
                                    {m.completed ? (
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                    ) : canSubmit ? (
                                      <Button
                                        size="sm"
                                        className="text-[10px] gap-0.5 font-bold"
                                        onClick={() => startBattleQuiz(battle.id, mi)}
                                        disabled={submitBattleScoreMutation.isPending}
                                        data-testid={`button-battle-play-${battle.id}-${mi}`}
                                      >
                                        <Play className="w-3 h-3" /> Play
                                      </Button>
                                    ) : !m.completed ? (
                                      <span className="text-[9px] text-muted-foreground italic">waiting</span>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {isActive && (
                            <Card className="p-3 bg-gradient-to-r from-amber-500/5 to-purple-500/5 border-amber-500/20">
                              <p className="text-[10px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1"><Award className="w-3 h-3" /> Rewards for winning clan</p>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 text-xs font-bold">
                                  <Gem className="w-3.5 h-3.5 text-purple-500" /> {battle.gemReward} Sparks
                                </div>
                                <div className="flex items-center gap-1 text-xs font-bold">
                                  <Star className="w-3.5 h-3.5 text-amber-500" /> {battle.xpReward} XP
                                </div>
                                <span className="text-[10px] text-muted-foreground">per member</span>
                              </div>
                            </Card>
                          )}

                          {battle.status === "completed" && (
                            <div className={`text-center py-3 rounded-lg ${won ? "bg-green-500/10" : lost ? "bg-red-500/10" : "bg-muted/30"}`}>
                              {battle.winnerName ? (
                                <>
                                  <p className="text-sm font-black flex items-center justify-center gap-1.5">
                                    <Crown className={`w-4 h-4 ${won ? "text-amber-500" : "text-muted-foreground"}`} />
                                    <span className={won ? "text-green-600 dark:text-green-400" : lost ? "text-red-600 dark:text-red-400" : ""}>{battle.winnerName}</span> wins!
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">+{battle.gemReward} Sparks, +{battle.xpReward} XP awarded to all members</p>
                                </>
                              ) : (
                                <p className="text-sm font-bold text-muted-foreground">Draw - no winner</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No battles yet. Leaders and co-leaders can challenge other clans!
              </p>
            )}
          </Card>
        )}

        <h2 className="text-xl font-black mb-3 flex items-center gap-2">
          <Users className="w-5 h-5" /> Members ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map((m, i) => {
            const avatarInfo = resolveAvatarIcon(m.avatarId);
            const AvatarIcon = avatarInfo.icon;
            const isMemberCoLeader = coLeaderIds.includes(m.id);
            const isMemberOwner = m.id === clan.leaderId;
            const equippedTitle = (m.equippedCosmetics || {})["title"];
            return (
              <Card key={m.id} className={`p-3 flex items-center gap-3 border-border ${m.id === user?.id ? "ring-2 ring-purple-500/30" : ""} cursor-pointer hover:border-purple-500/30 transition-colors`} onClick={() => setProfileUsername(m.username)}>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarInfo.gradient} flex items-center justify-center shrink-0`}>
                  <AvatarIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate flex items-center gap-1 flex-wrap">
                    <UserNameDisplay username={m.username} displayName={m.displayName} nameClassName="text-sm" />
                    {isMemberOwner && (
                      <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-0 text-[9px] px-1 py-0 gap-0.5 ml-1"><Crown className="w-2.5 h-2.5" /> Owner</Badge>
                    )}
                    {isMemberCoLeader && !isMemberOwner && (
                      <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-0 text-[9px] px-1 py-0 gap-0.5 ml-1"><Shield className="w-2.5 h-2.5" /> Co-Leader</Badge>
                    )}
                    {equippedTitle && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">{TITLE_DISPLAY[equippedTitle] || equippedTitle.replace(/^(title-|reward-)/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Lv.{m.level}</span>
                    <span className="flex items-center gap-0.5"><Star className="w-3 h-3" /> {m.xp.toLocaleString()}</span>
                    <span className="flex items-center gap-0.5"><Award className="w-3 h-3" /> {(m.badges || []).length}</span>
                    <span className="flex items-center gap-0.5"><Coins className="w-3 h-3" /> {(m.coins || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isOwner && m.id !== user?.id && !isMemberCoLeader && (
                    <Button size="sm" variant="ghost" onClick={() => promoteMutation.mutate({ clanId: clan.id, userId: m.id })} className="text-blue-500 hover:text-blue-600 h-8" title="Promote to Co-Leader" data-testid={`button-promote-${m.id}`}>
                      <ShieldPlus className="w-4 h-4" />
                    </Button>
                  )}
                  {isOwner && isMemberCoLeader && (
                    <Button size="sm" variant="ghost" onClick={() => demoteMutation.mutate({ clanId: clan.id, userId: m.id })} className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 h-8" title="Remove Co-Leader" data-testid={`button-demote-${m.id}`}>
                      <ShieldMinus className="w-4 h-4" />
                    </Button>
                  )}
                  {isOwner && m.id !== user?.id && !isMemberOwner && (
                    <Button size="sm" variant="ghost" onClick={() => kickMutation.mutate({ clanId: clan.id, userId: m.id })} disabled={kickMutation.isPending} className="text-red-500 hover:text-red-600 h-8" title="Kick member" data-testid={`button-kick-${m.id}`}>
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="min-h-screen max-w-md mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => setCreating(false)} className="gap-2 mb-4" data-testid="button-back-from-create">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <h1 className="text-2xl font-black mb-6 flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-500" /> Create a Clan
        </h1>

        <Card className="p-6 space-y-4 border-border">
          <div>
            <label className="text-sm font-bold mb-1 block">Clan Name</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} maxLength={24} placeholder="Science Squad" data-testid="input-clan-name" />
          </div>
          <div>
            <label className="text-sm font-bold mb-1 block">Tag (up to 5 letters)</label>
            <Input value={newTag} onChange={e => setNewTag(e.target.value.toUpperCase().slice(0, 5))} maxLength={5} placeholder="SCI" data-testid="input-clan-tag" />
          </div>
          <div>
            <label className="text-sm font-bold mb-1 block">Description</label>
            <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="A clan for science lovers!" data-testid="input-clan-desc" />
          </div>
          <div>
            <label className="text-sm font-bold mb-1 block">Motto (optional)</label>
            <Input value={newMotto} onChange={e => setNewMotto(e.target.value)} maxLength={100} placeholder="Knowledge is power!" data-testid="input-clan-motto" />
          </div>
          <div>
            <label className="text-sm font-bold mb-1 block">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {CLAN_ICONS.map(ic => (
                <button
                  key={ic}
                  onClick={() => setSelectedIcon(ic)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${selectedIcon === ic ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 scale-110" : "bg-muted hover:bg-muted/80"}`}
                  data-testid={`button-create-icon-${ic}`}
                >
                  {CLAN_ICON_EMOJIS[ic]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-bold mb-1 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {CLAN_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === c ? "ring-2 ring-offset-2 ring-purple-500 scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                  data-testid={`color-${c}`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden relative" style={{ background: selectedColor }}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="px-4 py-3 flex items-center gap-3 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">{CLAN_ICON_EMOJIS[selectedIcon]}</div>
              <div className="text-white">
                <p className="text-xs opacity-80">[{newTag || "TAG"}]</p>
                <p className="font-black">{newName || "Clan Name"}</p>
                {newMotto && <p className="text-xs italic opacity-80">"{newMotto}"</p>}
              </div>
            </div>
          </div>

          <Button
            className="w-full gap-2 font-black"
            onClick={() => createMutation.mutate()}
            disabled={!newName || !newTag || createMutation.isPending}
            data-testid="button-create-clan-submit"
          >
            <Shield className="w-4 h-4" /> Create Clan
          </Button>
        </Card>
      </div>
    );
  }

  if (testQuiz) {
    const allAnswered = testQuiz.answers.every(a => a >= 0);
    return (
      <div className="min-h-screen max-w-2xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => setTestQuiz(null)} className="gap-2 mb-4" data-testid="button-back-test">
          <ArrowLeft className="w-4 h-4" /> Cancel
        </Button>
        <Card className="p-6 border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
          <div className="text-center mb-6">
            <ClipboardList className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
            <h2 className="text-2xl font-black">Clan Entry Test</h2>
            <p className="text-sm text-muted-foreground mt-1">Answer all questions correctly to join!</p>
          </div>
          <div className="space-y-5">
            {testQuiz.questions.map((q, qi) => (
              <div key={qi} className="bg-muted/30 rounded-xl p-4">
                <p className="font-bold text-sm mb-3">{qi + 1}. {q.question}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => setTestQuiz(prev => prev ? { ...prev, answers: prev.answers.map((a, i) => i === qi ? oi : a) } : null)}
                      className={`p-3 rounded-lg text-sm font-semibold text-left transition-all ${testQuiz.answers[qi] === oi ? "bg-indigo-500 text-white ring-2 ring-indigo-400" : "bg-muted hover:bg-muted/80"}`}
                      data-testid={`button-answer-${qi}-${oi}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button
            className="w-full mt-6 gap-2 font-black text-base"
            disabled={!allAnswered || joinMutation.isPending}
            onClick={() => joinMutation.mutate({ clanId: testQuiz.clanId, answers: testQuiz.answers })}
            data-testid="button-submit-test"
          >
            {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
            Submit Answers
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
          <Shield className="w-8 h-8 text-purple-500" /> Clans
        </h1>
        {user && (
          <Button onClick={() => setCreating(true)} className="gap-2 font-bold" data-testid="button-create-clan">
            <Plus className="w-4 h-4" /> Create Clan
          </Button>
        )}
      </div>
      <Card className="p-4 mb-6 bg-gradient-to-r from-purple-500/5 to-indigo-500/5 border-purple-500/20">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">Clans</span> are large groups of players who band together under a shared name and tag. Anyone can browse and join a clan — no invite needed! Clans have no member limit and compete on the leaderboard by combining everyone's XP, coins, gems, and badges. Create your own or join an existing one!
        </p>
      </Card>

      {myClan && (
        <Card className="p-4 mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-colors"
          onClick={() => setViewingClan(myClan.id)}
          data-testid="my-clan-card"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow" style={{ backgroundColor: myClan.color }}>
              {CLAN_ICON_EMOJIS[myClan.icon] || "🛡️"}
            </div>
            <div className="flex-1">
              <p className="font-bold">[{myClan.tag}] {myClan.name}</p>
              <p className="text-xs text-muted-foreground">{myClan.memberCount} members - Your clan</p>
            </div>
            <Badge variant="secondary" className="font-bold"><Star className="w-3 h-3 mr-1" /> {myClan.totalXP.toLocaleString()} XP</Badge>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {allClans.map((clan, i) => (
            <motion.div
              key={clan.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card
                className="p-4 flex items-center gap-4 border-border cursor-pointer hover:border-purple-500/30 transition-colors"
                onClick={() => setViewingClan(clan.id)}
                data-testid={`clan-card-${clan.id}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow"
                  style={{ background: clan.color }}
                >
                  {CLAN_ICON_EMOJIS[clan.icon] || "🛡️"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate">[{clan.tag}] {clan.name}</p>
                    {clan.recruiting !== false && (
                      <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-[9px] px-1.5 py-0">Open</Badge>
                    )}
                    {Array.isArray(clan.joinTest) && clan.joinTest.length > 0 && (
                      <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 text-[9px] px-1.5 py-0 gap-0.5">
                        <ClipboardList className="w-2.5 h-2.5" /> Test
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {clan.memberCount}</span>
                    <span>-</span>
                    <span className="flex items-center gap-0.5"><Star className="w-3 h-3" /> {clan.totalXP.toLocaleString()} XP</span>
                    <span className="flex items-center gap-0.5"><Gem className="w-3 h-3 text-green-500" /> {clan.totalGems}</span>
                  </div>
                </div>
                {user && !(user as any).clanId && clan.recruiting !== false && (
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); tryJoinClan(clan); }} disabled={joinMutation.isPending} className="font-bold gap-1" data-testid={`button-join-${clan.id}`}>
                    <Plus className="w-3 h-3" /> {Array.isArray(clan.joinTest) && clan.joinTest.length > 0 ? "Test" : "Join"}
                  </Button>
                )}
              </Card>
            </motion.div>
          ))}

          {allClans.length === 0 && (
            <div className="text-center py-16">
              <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium text-lg">No clans yet!</p>
              <p className="text-sm text-muted-foreground">Be the first to create one!</p>
            </div>
          )}
        </div>
      )}
    <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
    </div>
  );
}
