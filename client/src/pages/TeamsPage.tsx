import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renderMentions, UserNameDisplay } from "@/lib/mentions";
import UserProfileModal from "@/components/UserProfileModal";
import { resolveAvatarIcon } from "@/lib/avatarIcons";
import {
  Users, Star, Award, Crown, Loader2, Plus, LogOut, UserMinus,
  ArrowLeft, Coins, Copy, Check, Link2, Trophy, Zap, MessageCircle, Send, Pencil, Save,
  Rocket, FlaskConical, Bot, Sparkles, Swords, Wand2, Flame, Bird, Diamond,
  Snowflake, Orbit, Shield, Vote, CheckCircle, Moon, Globe, Waves, Cpu, Atom, TreePine,
  Telescope, Mountain, Wind, Sun, Hexagon, Footprints, TrendingUp,
  GraduationCap, Calendar, RefreshCw, Gamepad2, Medal, Gem, Skull,
  type LucideIcon
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

const TEAM_ICONS = ["⚡", "🔥", "🌟", "🚀", "🎯", "💎", "🦁", "🐉", "🦅", "🐺", "🎮", "🏆", "⚔️", "🛡️", "🌈", "🧪", "🔬", "🌍", "☄️", "🪐"];
const TEAM_COLORS = [
  "hsl(220, 85%, 55%)", "hsl(260, 85%, 55%)", "hsl(330, 85%, 55%)",
  "hsl(0, 85%, 55%)", "hsl(25, 85%, 55%)", "hsl(45, 85%, 55%)",
  "hsl(120, 65%, 45%)", "hsl(170, 75%, 45%)", "hsl(190, 85%, 50%)",
  "hsl(280, 70%, 50%)", "hsl(200, 85%, 55%)", "hsl(350, 80%, 50%)",
];

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
};

interface Team {
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
  createdAt: string;
  election?: any;
}

interface TeamMember {
  id: number;
  username: string;
  displayName?: string | null;
  xp: number;
  level: number;
  coins: number;
  badges: string[];
  avatarId: string;
}

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

export default function TeamsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [viewingTeam, setViewingTeam] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("⚡");
  const [newColor, setNewColor] = useState("hsl(220, 85%, 55%)");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"my-team" | "leaderboard" | "join">("my-team");
  const [editingStyle, setEditingStyle] = useState(false);
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const inviteFromUrl = urlParams.get("invite");

  useEffect(() => {
    if (inviteFromUrl) {
      setJoinCode(inviteFromUrl);
      setTab("join");
    }
  }, [inviteFromUrl]);

  const userTeamId = (user as any)?.teamId;

  const { data: allTeams = [], isLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: teamDetail } = useQuery<{ team: Team; members: TeamMember[] }>({
    queryKey: ["/api/teams", viewingTeam],
    enabled: viewingTeam !== null,
  });

  const { data: myTeamDetail } = useQuery<{ team: Team; members: TeamMember[] }>({
    queryKey: ["/api/teams", userTeamId],
    enabled: !!userTeamId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/teams", { name: newName, icon: newIcon, color: newColor });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Team Created!", description: `${newName} is ready! Share the invite link with friends.` });
      setCreating(false);
      setNewName("");
      setNewIcon("⚡");
      setNewColor("hsl(220, 85%, 55%)");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const joinMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", `/api/teams/join/${code}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Joined Team!", description: "Welcome to the team!" });
      setJoinCode("");
      setTab("my-team");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/leave`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Left Team", description: "You have left the team." });
      setViewingTeam(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const kickMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/kick`, { userId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (viewingTeam) queryClient.invalidateQueries({ queryKey: ["/api/teams", viewingTeam] });
      toast({ title: "Member kicked", description: data.message || "Member removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const voteKickMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/kick/vote`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (viewingTeam) queryClient.invalidateQueries({ queryKey: ["/api/teams", viewingTeam] });
      toast({ title: data.resolved ? "Vote complete" : "Vote recorded", description: data.message });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, icon, color }: { teamId: number; icon: string; color: string }) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/update`, { icon, color });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Team Updated!", description: "Your team's look has been saved." });
      setEditingStyle(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startElectionMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/election/start`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Election Started!", description: "All team members can now vote for the new leader." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const voteElectionMutation = useMutation({
    mutationFn: async ({ teamId, candidateId }: { teamId: number; candidateId: number }) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/election/vote`, { candidateId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Vote Cast!", description: "Your vote has been recorded." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyInviteLink = (code: string) => {
    const url = `${window.location.origin}/teams?invite=${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link Copied!", description: "Share this link with friends to invite them!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: chatMessages = [] } = useQuery<{ id: number; username: string; content: string; createdAt: string; userId: number }[]>({
    queryKey: ["/api/chat/team", viewingTeam || userTeamId],
    enabled: (viewingTeam !== null || !!userTeamId) && (user as any)?.teamId === (viewingTeam || userTeamId),
    refetchInterval: 5000,
  });

  const sendChatMutation = useMutation({
    mutationFn: async (content: string) => {
      const teamId = viewingTeam || userTeamId;
      const res = await apiRequest("POST", `/api/chat/team/${teamId}`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/team", viewingTeam || userTeamId] });
      setChatMsg("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (viewingTeam && teamDetail) {
    const { team, members } = teamDetail;
    const isLeader = team.leaderId === (user as any)?.id;
    const isMember = (user as any)?.teamId === team.id;
    const kickVote = (team.election as any)?.type === "kick" && (team.election as any)?.active ? (team.election as any) : null;

    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setViewingTeam(null); setEditingStyle(false); }} className="gap-1" data-testid="button-back-teams">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <Card className="p-5 overflow-hidden">
          <div className="rounded-xl p-4 mb-4 -mx-1 relative overflow-hidden" style={{ background: team.color }}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl shadow-lg">
                {team.icon || "⚡"}
              </div>
              <div className="flex-1 text-white">
                <h2 className="text-xl font-black" data-testid="text-team-name">{team.name}</h2>
                <p className="text-xs opacity-80">Led by {team.leaderName} · {team.memberCount}/5 members</p>
              </div>
              {isLeader && !editingStyle && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/80 hover:text-white hover:bg-white/20 gap-1"
                  onClick={() => { setEditingStyle(true); setEditIcon(team.icon || "⚡"); setEditColor(team.color); }}
                  data-testid="button-edit-team-style"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {editingStyle && isLeader && (
            <div className="bg-muted/30 rounded-lg p-4 mb-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customize Team</h4>
              <div>
                <p className="text-xs font-bold mb-2">Team Icon</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_ICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setEditIcon(ic)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${editIcon === ic ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 scale-110" : "bg-muted hover:bg-muted/80"}`}
                      data-testid={`button-icon-${ic}`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold mb-2">Team Color</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${editColor === c ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                      data-testid={`button-color-team`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={() => updateTeamMutation.mutate({ teamId: team.id, icon: editIcon, color: editColor })} disabled={updateTeamMutation.isPending} data-testid="button-save-team-style">
                  {updateTeamMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingStyle(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <Zap className="w-4 h-4 mx-auto text-purple-400 mb-0.5" />
              <p className="text-sm font-bold">{team.totalXP.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Team XP</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <Coins className="w-4 h-4 mx-auto text-yellow-500 mb-0.5" />
              <p className="text-sm font-bold">{team.totalCoins.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Team Neuros</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <Award className="w-4 h-4 mx-auto text-emerald-500 mb-0.5" />
              <p className="text-sm font-bold">{team.totalBadges}</p>
              <p className="text-[10px] text-muted-foreground">Team Badges</p>
            </div>
          </div>

          {isMember && (
            <div className="bg-muted/30 rounded-lg p-3 mb-4">
              <p className="text-xs font-bold mb-1.5 flex items-center gap-1"><Link2 className="w-3 h-3" /> Invite Link</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/teams?invite=${team.inviteCode}`}
                  className="text-xs h-8"
                  data-testid="input-invite-link"
                />
                <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={() => copyInviteLink(team.inviteCode)} data-testid="button-copy-invite">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          <h3 className="text-sm font-bold mb-2">Members ({members.length}/5)</h3>
          <div className="space-y-2">
            {members.map((m) => {
              const avatarInfo = resolveAvatarIcon(m.avatarId);
              const AvatarIcon = avatarInfo.icon;
              const equippedTitle = (m.equippedCosmetics || {} as any)["title"];
              return (
                <div key={m.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2 cursor-pointer hover:bg-muted/50 transition-colors" data-testid={`member-${m.id}`} onClick={() => setProfileUsername(m.username)}>
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarInfo.gradient} flex items-center justify-center shrink-0`}>
                    <AvatarIcon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <UserNameDisplay username={m.username} displayName={m.displayName} nameClassName="text-xs" />
                      {m.id === team.leaderId && <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-0 text-[9px] px-1 py-0 gap-0.5"><Crown className="w-2.5 h-2.5" /> Leader</Badge>}
                      {equippedTitle && <Badge variant="outline" className="text-[9px] px-1 py-0">{TITLE_DISPLAY[equippedTitle] || equippedTitle.replace(/^(title-|reward-)/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Lv.{m.level} · {m.xp.toLocaleString()} XP · {(m.badges || []).length} badges · {(m.coins || 0).toLocaleString()} coins</p>
                  </div>
                  {isLeader && m.id !== team.leaderId && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 text-xs" onClick={() => kickMutation.mutate({ teamId: team.id, userId: m.id })} disabled={kickMutation.isPending} title="Kick member" data-testid={`button-kick-${m.id}`}>
                      <UserMinus className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {isMember && kickVote && (
            <Card className="mt-4 p-4 border-red-500/30 bg-red-500/5">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                <UserMinus className="w-4 h-4 text-red-500" /> Kick Vote
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Owner requested removing <span className="font-bold text-foreground">{kickVote.targetName}</span>. Everyone except the owner and that player must approve.
              </p>
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary" className="font-bold" data-testid="badge-kick-vote-progress">
                  {Object.keys(kickVote.votes || {}).length}/{kickVote.requiredVotes || 0} approvals
                </Badge>
                {kickVote.eligibleVoters?.some((v: any) => v.id === (user as any)?.id) && !kickVote.votes?.[String((user as any)?.id)] && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="font-bold gap-1"
                    onClick={() => voteKickMutation.mutate(team.id)}
                    disabled={voteKickMutation.isPending}
                    data-testid="button-approve-kick-team"
                  >
                    {voteKickMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Approve
                  </Button>
                )}
                {kickVote.votes?.[String((user as any)?.id)] && (
                  <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-0 gap-1" data-testid="badge-kick-voted">
                    <CheckCircle className="w-3 h-3" /> You approved
                  </Badge>
                )}
              </div>
            </Card>
          )}

          {isMember && (() => {
            const election = (team as any).election;
            const hasActiveElection = election?.active === true && election?.type !== "kick";
            const hasWinner = election?.type !== "kick" && election?.winner;
            const userVotedFor = election?.votes?.[(user as any)?.id?.toString()];
            const totalVotes = election?.candidates ? election.candidates.reduce((sum: number, c: any) => sum + c.votes, 0) : 0;
            const electionStartedAt = election?.startedAt ? new Date(election.startedAt).getTime() : 0;
            const electionEndsAt = electionStartedAt + 24 * 60 * 60 * 1000;

            return (
              <Card className="mt-4 p-4 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Vote className="w-4 h-4 text-indigo-500" /> Leader Election
                </h3>

                {!hasActiveElection && !hasWinner && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Start an election to vote for a new team leader. All members become candidates.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => startElectionMutation.mutate(team.id)}
                      disabled={startElectionMutation.isPending}
                      data-testid="button-call-election"
                    >
                      {startElectionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Vote className="w-3.5 h-3.5" />}
                      Call Election
                    </Button>
                  </div>
                )}

                {hasActiveElection && !hasWinner && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Vote for who you want as the new team leader!</p>
                      <ElectionCountdown endsAt={electionEndsAt} />
                    </div>
                    <div className="space-y-1.5">
                      {(election.candidates || []).map((candidate: { id: number; username: string; votes: number }) => {
                        const isVotedFor = userVotedFor === candidate.id;
                        const votePercent = totalVotes > 0 ? Math.round((candidate.votes / totalVotes) * 100) : 0;
                        return (
                          <div key={candidate.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2" data-testid={`election-candidate-${candidate.id}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold">@{candidate.username}</span>
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                  <Vote className="w-3 h-3" /> {candidate.votes}
                                </Badge>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
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
                                variant="outline"
                                className="text-xs gap-1"
                                onClick={() => voteElectionMutation.mutate({ teamId: team.id, candidateId: candidate.id })}
                                disabled={voteElectionMutation.isPending}
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
                  </div>
                )}

                {hasWinner && (
                  <div className="space-y-3">
                    <div className="bg-muted/30 rounded-lg p-3 text-center space-y-1">
                      <Crown className="w-6 h-6 mx-auto text-yellow-500" />
                      <p className="text-sm font-bold">@{election.winner.username}</p>
                      <p className="text-xs text-muted-foreground">Won the election with {election.winner.votes} vote{election.winner.votes !== 1 ? "s" : ""}!</p>
                    </div>
                    {election.candidates && election.candidates.length > 1 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-muted-foreground">Final Results</p>
                        {[...election.candidates].sort((a: any, b: any) => b.votes - a.votes).map((candidate: any) => {
                          const finalTotalVotes = election.candidates.reduce((s: number, c: any) => s + c.votes, 0);
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
                      onClick={() => startElectionMutation.mutate(team.id)}
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

          {isMember && (
            <Button variant="outline" size="sm" className="w-full mt-4 text-red-500 gap-1" onClick={() => leaveMutation.mutate(team.id)} data-testid="button-leave-team">
              <LogOut className="w-3.5 h-3.5" /> Leave Team
            </Button>
          )}

          {!isMember && !userTeamId && team.memberCount < 5 && (
            <Button size="sm" className="w-full mt-4 gap-1" onClick={() => joinMutation.mutate(team.inviteCode)} data-testid="button-join-team">
              <Plus className="w-3.5 h-3.5" /> Join Team
            </Button>
          )}
        </Card>

        {isMember && (
          <Card className="p-4">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" /> Team Chat
            </h3>
            <div className="h-64 overflow-y-auto bg-muted/30 rounded-lg p-3 mb-3 space-y-2" data-testid="chat-messages-team">
              {chatMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No messages yet. Say hello to your team!</p>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.userId === (user as any)?.id ? "items-end" : "items-start"}`} data-testid={`chat-msg-${msg.id}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${msg.userId === (user as any)?.id ? "bg-blue-500 text-white" : "bg-muted"}`}>
                    <p className={`text-[10px] font-bold mb-0.5 cursor-pointer hover:underline ${msg.userId === (user as any)?.id ? "text-blue-200" : "text-muted-foreground"}`} onClick={() => setProfileUsername(msg.username)}>@{msg.username}</p>
                    <p className="text-sm break-words">{renderMentions(msg.content, (user as any)?.username)}</p>
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
                data-testid="input-chat-team"
              />
              <Button
                size="sm"
                onClick={() => chatMsg.trim() && sendChatMutation.mutate(chatMsg.trim())}
                disabled={!chatMsg.trim() || sendChatMutation.isPending}
                className="shrink-0"
                data-testid="button-send-chat-team"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold" data-testid="text-teams-title">Teams</h1>
      </div>

      <Card className="p-4 mb-2 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border-blue-500/20">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">Teams</span> are small squads of up to 5 friends. Teams are invite-only — share your unique invite link to let friends join. Work together as a tight-knit group and climb the team leaderboard with your combined XP and badges!
        </p>
      </Card>

      <div className="flex gap-1">
        {(["my-team", "leaderboard", "join"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "ghost"} size="sm" className="text-xs font-bold capitalize" onClick={() => setTab(t)} data-testid={`button-tab-${t}`}>
            {t === "my-team" ? "My Team" : t === "leaderboard" ? "Browse" : "Join Team"}
          </Button>
        ))}
      </div>

      {tab === "my-team" && (
        <div className="space-y-4">
          {userTeamId && myTeamDetail ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setViewingTeam(userTeamId)} data-testid="card-my-team">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow" style={{ backgroundColor: myTeamDetail.team.color }}>
                    {myTeamDetail.team.icon || "⚡"}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold">{myTeamDetail.team.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{myTeamDetail.team.memberCount}/5 members · {myTeamDetail.team.totalXP.toLocaleString()} XP</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {myTeamDetail.team.leaderId === (user as any)?.id ? "Leader" : "Member"}
                  </Badge>
                </div>

                <div className="mt-3 bg-muted/30 rounded-lg p-2">
                  <p className="text-xs font-bold mb-1 flex items-center gap-1"><Link2 className="w-3 h-3" /> Invite Link</p>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Input readOnly value={`${window.location.origin}/teams?invite=${myTeamDetail.team.inviteCode}`} className="text-[10px] h-7" />
                    <Button size="sm" variant="outline" className="h-7 gap-1 shrink-0 text-[10px]" onClick={() => copyInviteLink(myTeamDetail.team.inviteCode)} data-testid="button-copy-invite-quick">
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : (
            <Card className="p-6 text-center space-y-3">
              <Users className="w-10 h-10 mx-auto text-muted-foreground" />
              <h3 className="text-sm font-bold">You're not on a team yet!</h3>
              <p className="text-xs text-muted-foreground">Create a team or join one with an invite link.</p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" className="gap-1" onClick={() => setCreating(true)} data-testid="button-create-team">
                  <Plus className="w-3.5 h-3.5" /> Create Team
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setTab("join")} data-testid="button-go-join">
                  <Link2 className="w-3.5 h-3.5" /> Join Team
                </Button>
              </div>
            </Card>
          )}

          {creating && (
            <Card className="p-4 space-y-4">
              <h3 className="text-sm font-bold">Create a Team</h3>
              <Input placeholder="Team name (2-24 characters)" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={24} data-testid="input-team-name" />
              <div>
                <p className="text-xs font-bold mb-2">Choose an Icon</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_ICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setNewIcon(ic)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${newIcon === ic ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 scale-110" : "bg-muted hover:bg-muted/80"}`}
                      data-testid={`button-new-icon-${ic}`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold mb-2">Choose a Color</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${newColor === c ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                      data-testid={`button-new-color`}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-3 flex items-center gap-3 relative overflow-hidden" style={{ background: newColor }}>
                <div className="absolute inset-0 bg-black/30" />
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-xl relative z-10">{newIcon}</div>
                <div className="text-white relative z-10">
                  <p className="font-bold text-sm">{newName || "Team Name"}</p>
                  <p className="text-[10px] opacity-80">Preview</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || newName.length < 2} data-testid="button-confirm-create">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "join" && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-1"><Link2 className="w-4 h-4" /> Join with Invite Code</h3>
          <p className="text-xs text-muted-foreground">Paste an invite code or link from a friend to join their team.</p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter invite code..."
              value={joinCode}
              onChange={(e) => {
                const val = e.target.value;
                const match = val.match(/invite=([A-Z0-9]+)/i);
                setJoinCode(match ? match[1] : val.trim());
              }}
              data-testid="input-join-code"
            />
            <Button size="sm" onClick={() => joinMutation.mutate(joinCode)} disabled={joinMutation.isPending || !joinCode} data-testid="button-join-code">
              {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
            </Button>
          </div>
          {userTeamId && <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">You need to leave your current team before joining another one.</p>}
        </Card>
      )}

      {tab === "leaderboard" && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-1"><Users className="w-4 h-4 text-purple-500" /> All Teams</h3>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : allTeams.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center p-4">No teams yet. Be the first to create one!</p>
          ) : (
            allTeams.map((team, i) => (
              <motion.div key={team.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card
                  className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setViewingTeam(team.id)}
                  data-testid={`card-team-${team.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ backgroundColor: team.color }}>
                      <span className="text-lg">{team.icon || "⚡"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{team.name}</p>
                      <p className="text-[10px] text-muted-foreground">{team.memberCount}/5 · Led by {team.leaderName}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}
    <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
    </div>
  );
}
