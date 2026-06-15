import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy, Users, Loader2, ArrowLeft, Zap, Coins, Clock, CheckCircle,
  Swords, Star, Medal, Timer, Play, ChevronRight, Crown, Lock, Gem,
  User, Target, Shield, Flame, FlaskConical, Atom, Layers, Sparkles
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useRef } from "react";
import { getTournamentTier, GAME_MODES } from "@/lib/gameData";
import GamePlayer from "@/components/GamePlayer";
import { Gamepad2 } from "lucide-react";

interface TournamentQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface Tournament {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  packId: number | null;
  questions: TournamentQuestion[];
  maxTeams: number;
  startTime: string;
  endTime: string;
  xpReward: number;
  coinReward: number;
  gemReward: number;
  createdAt: string;
  gameMode: string;
  format: string;
  scope: string;
  currentRound: number;
  maxRounds: number;
  bracket: any[];
}

interface TournamentEntry {
  id: number;
  tournamentId: number;
  teamId: number | null;
  teamName: string;
  userId: number | null;
  score: number;
  timeTaken: number;
  completed: boolean;
  playedBy: number[];
  submittedAt: string | null;
  round: number;
  eliminated: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  upcoming: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", label: "Upcoming" },
  active: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", label: "Live Now!" },
  completed: { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", label: "Ended" },
};

const GAME_MODE_INFO: Record<string, { icon: any; color: string; label: string }> = {
  "quiz": { icon: Star, color: "text-yellow-500", label: "Classic Quiz" },
  "speed-round": { icon: Zap, color: "text-orange-500", label: "Speed Round" },
  "survival": { icon: Shield, color: "text-red-500", label: "Survival" },
  "boss-rush": { icon: Swords, color: "text-purple-500", label: "Boss Rush" },
  "lab-challenge": { icon: FlaskConical, color: "text-green-500", label: "Lab Challenge" },
  "element-hunt": { icon: Atom, color: "text-cyan-500", label: "Element Hunt" },
  "arcade": { icon: Gamepad2, color: "text-blue-500", label: "Arcade Game" },
  "duel": { icon: Swords, color: "text-red-500", label: "1v1 Duel" },
};

const FORMAT_INFO: Record<string, { label: string; color: string }> = {
  "open": { label: "Open", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  "elimination": { label: "Elimination", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  "round-robin": { label: "Round Robin", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
};

function formatTimeLeft(endTime: string): string {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

function formatCountdown(startTime: string): string {
  const diff = new Date(startTime).getTime() - Date.now();
  if (diff <= 0) return "Starting now!";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function useCountdown(targetTime: string) {
  const [timeStr, setTimeStr] = useState(() => formatCountdown(targetTime));
  const [isStarted, setIsStarted] = useState(() => new Date(targetTime).getTime() <= Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(targetTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeStr("Starting now!");
        setIsStarted(true);
        clearInterval(interval);
      } else {
        setTimeStr(formatCountdown(targetTime));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return { timeStr, isStarted };
}

const YEAR_TOURNAMENT_QUESTIONS: Record<number, TournamentQuestion[]> = {
  3: [
    { question: "What do plants need to grow?", options: ["Sunlight and water", "Metal", "Plastic", "Moon rocks"], correctIndex: 0, explanation: "Most plants need sunlight, water, air, and soil nutrients." },
    { question: "Which sense uses your eyes?", options: ["Smell", "Sight", "Taste", "Touch"], correctIndex: 1, explanation: "Your eyes help you see." },
    { question: "What is rain made of?", options: ["Sand", "Water", "Smoke", "Sugar"], correctIndex: 1, explanation: "Rain is liquid water falling from clouds." },
  ],
  4: [
    { question: "What planet do we live on?", options: ["Mars", "Earth", "Venus", "Saturn"], correctIndex: 1, explanation: "Earth is our home planet." },
    { question: "What force keeps us on the ground?", options: ["Gravity", "Heat", "Sound", "Light"], correctIndex: 0, explanation: "Gravity pulls objects toward Earth." },
    { question: "What do bees make?", options: ["Honey", "Milk", "Bread", "Oil"], correctIndex: 0, explanation: "Bees make honey from nectar." },
  ],
  5: [
    { question: "What is H2O?", options: ["Oxygen", "Water", "Salt", "Carbon dioxide"], correctIndex: 1, explanation: "H2O is the chemical formula for water." },
    { question: "Which planet is closest to the Sun?", options: ["Venus", "Mercury", "Earth", "Mars"], correctIndex: 1, explanation: "Mercury is the closest planet to the Sun." },
    { question: "What gas do plants take in?", options: ["Carbon dioxide", "Helium", "Neon", "Hydrogen"], correctIndex: 0, explanation: "Plants use carbon dioxide during photosynthesis." },
  ],
  6: [
    { question: "What is the boiling point of water?", options: ["0°C", "50°C", "100°C", "200°C"], correctIndex: 2, explanation: "At sea level, water boils at 100°C." },
    { question: "What gives plants their green colour?", options: ["Chlorophyll", "Calcium", "Carbon", "Salt"], correctIndex: 0, explanation: "Chlorophyll helps plants capture light." },
    { question: "What type of rock forms from lava?", options: ["Igneous", "Sedimentary", "Metamorphic", "Chalk"], correctIndex: 0, explanation: "Igneous rocks form when molten rock cools." },
  ],
  7: [
    { question: "Symbol 'Fe' is which element?", options: ["Fluorine", "Iron", "Francium", "Fermium"], correctIndex: 1, explanation: "Fe is the symbol for iron." },
    { question: "What particle has a negative charge?", options: ["Proton", "Neutron", "Electron", "Nucleus"], correctIndex: 2, explanation: "Electrons carry negative charge." },
    { question: "Which gas is a noble gas?", options: ["Oxygen", "Neon", "Sodium", "Carbon"], correctIndex: 1, explanation: "Neon is a noble gas." },
  ],
  8: [
    { question: "What is the pH of a neutral solution?", options: ["0", "7", "10", "14"], correctIndex: 1, explanation: "A neutral solution has pH 7." },
    { question: "What is Newton's first law about?", options: ["Inertia", "Electricity", "Evolution", "Evaporation"], correctIndex: 0, explanation: "Newton's first law describes inertia." },
    { question: "What bonds share electrons?", options: ["Ionic", "Covalent", "Metallic", "Magnetic"], correctIndex: 1, explanation: "Covalent bonds share electrons between atoms." },
  ],
};

function getYearAdjustedTournamentQuestions(base: TournamentQuestion[], yearLevel: number) {
  const year = Math.min(8, Math.max(3, Number(yearLevel) || 7));
  const yearQs = YEAR_TOURNAMENT_QUESTIONS[year] || YEAR_TOURNAMENT_QUESTIONS[7];
  const targetCount = Math.max(3, base.length || 8);
  return [...yearQs, ...base].slice(0, targetCount).map(q => ({ ...q, options: [...q.options] }));
}

export default function TournamentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewingTournament, setViewingTournament] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playingArcade, setPlayingArcade] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "individual" | "team">("all");

  const userTeamId = (user as any)?.teamId;
  const userId = (user as any)?.id;

  const { data: tournaments = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
    refetchInterval: 30000,
  });

  const { data: tournamentDetail } = useQuery<{ tournament: Tournament; entries: TournamentEntry[] }>({
    queryKey: ["/api/tournaments", viewingTournament],
    enabled: viewingTournament !== null,
    refetchInterval: 10000,
  });

  const joinMutation = useMutation({
    mutationFn: async (tournamentId: number) => {
      const res = await apiRequest("POST", `/api/tournaments/${tournamentId}/join`);
      return res.json();
    },
    onSuccess: (_data, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      if (viewingTournament) queryClient.invalidateQueries({ queryKey: ["/api/tournaments", viewingTournament] });
      const t = tournaments.find(x => x.id === tournamentId);
      if (t?.status === "upcoming") {
        toast({ title: "Enrolled!", description: "You're signed up! Come back when the tournament starts." });
      } else {
        toast({ title: "Registered!", description: "You've been entered into the tournament!" });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const arcadeScoreMutation = useMutation({
    mutationFn: async ({ tournamentId, score }: { tournamentId: number; score: number }) => {
      const res = await apiRequest("POST", `/api/tournaments/${tournamentId}/arcade-score`, { score });
      return res.json();
    },
    onSuccess: (data, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Score Submitted!",
        description: `+${data.rewards?.xp || 0} XP, +${data.rewards?.coins || 0} Neuros`,
      });
    },
    onError: (e: any) => toast({ title: "Error submitting score", description: e.message, variant: "destructive" }),
  });

  const filtered = tournaments.filter(t => {
    if (activeTab === "individual") return t.scope === "individual";
    if (activeTab === "team") return t.scope === "team";
    return true;
  });

  const active = filtered.filter(t => t.status === "active");
  const upcoming = filtered.filter(t => t.status === "upcoming");
  const completed = filtered.filter(t => t.status === "completed").slice(0, 10);

  if (playing && viewingTournament && tournamentDetail) {
    return (
      <TournamentPlay
        tournament={tournamentDetail.tournament}
        onFinish={() => {
          setPlaying(false);
          queryClient.invalidateQueries({ queryKey: ["/api/tournaments", viewingTournament] });
        }}
        userId={userId}
        userYearLevel={(user as any)?.yearLevel || 7}
      />
    );
  }

  if (playingArcade && viewingTournament && tournamentDetail) {
    const arcadeTournament = tournamentDetail.tournament;
    const arcadeGameId = (arcadeTournament.questions as any[])?.[0]?.gameId;
    const arcadeGame = GAME_MODES.find(g => g.id === arcadeGameId);
    if (arcadeGame) {
      return (
        <div>
          <div className="max-w-4xl mx-auto px-4 pt-4">
            <Button variant="ghost" size="sm" className="gap-1 mb-2" onClick={() => setPlayingArcade(false)}>
              <ArrowLeft className="w-4 h-4" /> Back to Tournament
            </Button>
            <p className="text-xs text-muted-foreground font-medium mb-1 px-1">
              Tournament: <span className="font-bold text-foreground">{arcadeTournament.title}</span> — your best score will be submitted!
            </p>
          </div>
          <GamePlayer
            game={arcadeGame}
            onBack={() => setPlayingArcade(false)}
            onComplete={(score) => {
              arcadeScoreMutation.mutate({ tournamentId: viewingTournament, score });
              setPlayingArcade(false);
            }}
            yearLevel={(user as any)?.yearLevel || 7}
            autoStart={false}
            skipRewardSubmit={false}
          />
        </div>
      );
    }
  }

  if (viewingTournament && tournamentDetail) {
    const { tournament, entries } = tournamentDetail;
    const style = STATUS_STYLES[tournament.status] || STATUS_STYLES.upcoming;
    const modeInfo = GAME_MODE_INFO[tournament.gameMode] || GAME_MODE_INFO.quiz;
    const formatInfo = FORMAT_INFO[tournament.format] || FORMAT_INFO.open;
    const ModeIcon = modeInfo.icon;

    const isIndividual = tournament.scope === "individual";
    const isDuel = tournament.gameMode === "duel";
    const myEntry = isIndividual
      ? entries.find(e => e.userId === userId)
      : entries.find(e => e.teamId === userTeamId);
    const hasPlayed = isIndividual
      ? myEntry?.completed
      : myEntry && Array.isArray(myEntry.playedBy) && myEntry.playedBy.includes(userId);
    const isArcade = tournament.gameMode === "arcade";
    const arcadeGameId = isArcade ? (tournament.questions as any[])?.[0]?.gameId : null;
    const arcadeGame = arcadeGameId ? GAME_MODES.find(g => g.id === arcadeGameId) : null;
    const currentDuelRound = isDuel ? (tournament.bracket || []).find((r: any) => r.round === tournament.currentRound) : null;
    const myDuelMatch = currentDuelRound?.matches?.find((m: any) => myEntry && (m.a === myEntry.id || m.b === myEntry.id));
    const duelOpponentId = myDuelMatch && myEntry ? (myDuelMatch.a === myEntry.id ? myDuelMatch.b : myDuelMatch.a) : null;
    const duelOpponent = duelOpponentId ? entries.find(e => e.id === duelOpponentId) : null;
    const hasDuelBye = isDuel && myDuelMatch?.status === "bye";
    const canPlay = !isArcade && !isDuel && tournament.status === "active" && myEntry && !hasPlayed;
    const canPlayDuel = isDuel && tournament.status === "active" && myEntry && !myEntry.eliminated && myDuelMatch && myDuelMatch.status !== "bye" && !myEntry.completed;
    const canPlayArcade = isArcade && tournament.status === "active";
    const canEnroll = !isArcade && tournament.status === "upcoming" && !myEntry && (isIndividual || userTeamId);
    const canJoin = !isArcade && tournament.status === "active" && !myEntry && (isIndividual || userTeamId) && (!isDuel || !(tournament.bracket || []).length);
    const isEnrolled = !isArcade && tournament.status === "upcoming" && !!myEntry;

    const sortedEntries = [...entries].sort((a, b) => b.score - a.score);

    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setViewingTournament(null)} className="gap-1" data-testid="button-back-tournaments">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <ModeIcon className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge className={`${style.bg} ${style.text} border-0 text-xs font-bold`}>{style.label}</Badge>
                <Badge className="bg-white/20 text-white border-0 text-xs">{isIndividual ? "Solo" : "Team"}</Badge>
                <Badge className={`${formatInfo.color} border-0 text-xs font-bold`}>{formatInfo.label}</Badge>
                <Badge className="bg-white/20 text-white border-0 text-xs">{modeInfo.label}</Badge>
              </div>
              <h1 className="text-2xl font-black" data-testid="text-tournament-title">{tournament.title}</h1>
              {tournament.description && <p className="text-sm opacity-90 mt-1">{tournament.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-xs opacity-80 flex-wrap">
                {tournament.status === "upcoming" && (
                  <LiveCountdownSpan startTime={tournament.startTime} />
                )}
                {tournament.status === "active" && (
                  <LiveTimeLeftSpan endTime={tournament.endTime} />
                )}
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {entries.length}/{tournament.maxTeams} {isIndividual ? "players" : "teams"}</span>
                {isArcade ? (
                  <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" /> {arcadeGame?.name || "Arcade Game"}</span>
                ) : (
                  <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {(tournament.questions as TournamentQuestion[]).length} questions</span>
                )}
                {tournament.format === "elimination" && (
                  <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> Round {tournament.currentRound}/{tournament.maxRounds}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <Card className="p-4">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-yellow-500" /> Placement Rewards
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { place: "1st", icon: Crown, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", xp: tournament.xpReward, coins: tournament.coinReward, gems: tournament.gemReward || 5 },
              { place: "2nd", icon: Medal, color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20", xp: Math.floor(tournament.xpReward * 0.6), coins: Math.floor(tournament.coinReward * 0.6), gems: Math.floor((tournament.gemReward || 5) * 0.5) },
              { place: "3rd", icon: Star, color: "text-amber-700 dark:text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", xp: Math.floor(tournament.xpReward * 0.3), coins: Math.floor(tournament.coinReward * 0.3), gems: Math.floor((tournament.gemReward || 5) * 0.25) },
            ].map(p => {
              const PlaceIcon = p.icon;
              return (
                <div key={p.place} className={`rounded-lg border p-3 text-center ${p.bg}`}>
                  <PlaceIcon className={`w-5 h-5 mx-auto mb-1 ${p.color}`} />
                  <p className="text-xs font-black">{p.place}</p>
                  <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                    <p className="flex items-center justify-center gap-0.5"><Zap className="w-2.5 h-2.5 text-purple-500" /> {p.xp} XP</p>
                    <p className="flex items-center justify-center gap-0.5"><Coins className="w-2.5 h-2.5 text-yellow-500" /> {p.coins}</p>
                    <p className="flex items-center justify-center gap-0.5"><Gem className="w-2.5 h-2.5 text-cyan-500" /> {p.gems}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {!isIndividual && !userTeamId && (
          <Card className="p-4 bg-amber-500/5 border-amber-500/20">
            <p className="text-sm text-center flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              You need to be on a <span className="font-bold">team</span> to join team tournaments!
            </p>
          </Card>
        )}

        {tournament.status === "upcoming" && (
          <CountdownBanner startTime={tournament.startTime} />
        )}

        {canEnroll && (
          <Button className="w-full gap-2 font-bold text-base py-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white" onClick={() => joinMutation.mutate(tournament.id)} disabled={joinMutation.isPending} data-testid="button-enroll-tournament">
            {joinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Medal className="w-5 h-5" />}
            {isIndividual ? "Enroll Now" : "Enroll Team"}
          </Button>
        )}

        {isEnrolled && (
          <Card className="p-4 bg-blue-500/5 border-blue-500/20">
            <p className="text-sm text-center flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
              <CheckCircle className="w-4 h-4" /> You're enrolled! Come back when the tournament starts to play.
            </p>
          </Card>
        )}

        {canJoin && (
          <Button className="w-full gap-2 font-bold text-base py-6" onClick={() => joinMutation.mutate(tournament.id)} disabled={joinMutation.isPending} data-testid="button-join-tournament">
            {joinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Swords className="w-5 h-5" />}
            {isIndividual ? "Enter Tournament" : "Enter Team Tournament"}
          </Button>
        )}

        {canPlay && (
          <Button className="w-full gap-2 font-bold text-base py-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600" onClick={() => setPlaying(true)} data-testid="button-play-tournament">
            <Play className="w-5 h-5" /> Play Tournament
          </Button>
        )}
        {canPlayDuel && (
          <Button className="w-full gap-2 font-bold text-base py-6 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600" onClick={() => setPlaying(true)} data-testid="button-play-duel-tournament">
            <Swords className="w-5 h-5" /> Duel {duelOpponent ? `vs ${duelOpponent.teamName}` : "Opponent"}
          </Button>
        )}
        {hasDuelBye && (
          <Card className="p-4 bg-yellow-500/5 border-yellow-500/20">
            <p className="text-sm text-center flex items-center justify-center gap-2 text-yellow-600 dark:text-yellow-400 font-bold">
              <Crown className="w-4 h-4" /> You have a bye this round and automatically move on.
            </p>
          </Card>
        )}
        {canPlayArcade && (
          <div className="space-y-2">
            {arcadeGame && (
              <Card className="p-4 bg-blue-500/5 border-blue-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{arcadeGame.name}</p>
                    <p className="text-xs text-muted-foreground">Play this game — highest score wins! You can play as many times as you like.</p>
                  </div>
                </div>
                {myEntry && <p className="text-xs text-green-600 dark:text-green-400 font-bold mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Your best: {myEntry.score} pts</p>}
              </Card>
            )}
            <Button
              className="w-full gap-2 font-bold text-base py-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              onClick={() => setPlayingArcade(true)}
              data-testid="button-play-arcade-tournament"
            >
              <Gamepad2 className="w-5 h-5" /> {myEntry ? "Play Again (Beat Your Score!)" : "Play Now"}
            </Button>
          </div>
        )}

        {hasPlayed && (
          <Card className="p-4 bg-green-500/5 border-green-500/20">
            <p className="text-sm text-center flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-bold">
              <CheckCircle className="w-4 h-4" /> You've completed this tournament!
            </p>
          </Card>
        )}

        {isDuel && (
          <Card className="p-4">
            <h3 className="font-bold flex items-center gap-2 mb-3">
              <Swords className="w-4 h-4 text-red-500" /> Duel Matches
            </h3>
            <div className="space-y-3">
              {(tournament.bracket || []).map((round: any) => (
                <div key={round.round} className="space-y-1">
                  <p className="text-xs font-black text-muted-foreground">Round {round.round}</p>
                  {(round.matches || []).map((match: any, mi: number) => {
                    const a = entries.find(e => e.id === match.a);
                    const b = entries.find(e => e.id === match.b);
                    const isMine = myEntry && (match.a === myEntry.id || match.b === myEntry.id);
                    return (
                      <div key={mi} className={`rounded-lg border p-2 text-xs ${isMine ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={match.winnerId === match.a ? "font-black text-green-600 dark:text-green-400" : "font-medium"}>{a?.teamName || "TBD"} {match.aScore !== null && match.aScore !== undefined ? `(${match.aScore})` : ""}</span>
                          <Badge variant="outline" className="text-[9px]">{match.status === "bye" ? "BYE" : match.status === "complete" ? "DONE" : "VS"}</Badge>
                          <span className={match.winnerId === match.b ? "font-black text-green-600 dark:text-green-400" : "font-medium"}>{b?.teamName || "Bye"} {match.bScore !== null && match.bScore !== undefined ? `(${match.bScore})` : ""}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>
        )}

        {!isDuel && tournament.format === "elimination" && (
          <Card className="p-4">
            <h3 className="font-bold flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-red-500" /> Elimination Bracket
            </h3>
            <div className="flex items-center gap-2 mb-3">
              {Array.from({ length: tournament.maxRounds }).map((_, ri) => (
                <div key={ri} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                    ri + 1 < tournament.currentRound ? "bg-green-500 text-white" :
                    ri + 1 === tournament.currentRound ? "bg-red-500 text-white ring-2 ring-red-500/30" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {ri + 1}
                  </div>
                  {ri < tournament.maxRounds - 1 && (
                    <div className={`w-6 h-0.5 ${ri + 1 < tournament.currentRound ? "bg-green-500" : "bg-muted"}`} />
                  )}
                </div>
              ))}
              <span className="text-[10px] font-bold text-muted-foreground ml-1">
                Round {tournament.currentRound}/{tournament.maxRounds}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Bottom half eliminated each round. Top scorers advance!
            </p>
            <div className="space-y-1">
              {sortedEntries.map((entry, i) => {
                const isEliminated = entry.eliminated;
                const isMe = entry.userId === userId || entry.teamId === userTeamId;
                return (
                  <div key={entry.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
                    isEliminated ? "opacity-40" :
                    isMe ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/30"
                  }`}>
                    <span className={`font-bold w-5 text-center ${isEliminated ? "line-through" : ""}`}>{i + 1}</span>
                    <span className={`flex-1 font-medium truncate ${isEliminated ? "line-through" : ""}`}>{entry.teamName}</span>
                    {!isEliminated && entry.completed && <Badge variant="outline" className="text-[8px] px-1 py-0 text-green-500 border-green-500/30">R{entry.round}</Badge>}
                    <span className={`font-bold ${isEliminated ? "text-muted-foreground" : "text-purple-500"}`}>{entry.score}</span>
                    {isEliminated && <Badge variant="destructive" className="text-[8px] px-1.5 py-0" data-testid={`badge-eliminated-${entry.id}`}>OUT</Badge>}
                    {!isEliminated && i === 0 && entry.completed && <Crown className="w-3 h-3 text-yellow-500" />}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {tournament.format === "round-robin" && entries.length > 0 && (
          <Card className="p-4">
            <h3 className="font-bold flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-purple-500" /> Round Robin Standings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-1 font-bold">#</th>
                    <th className="text-left py-2 px-2 font-bold">Player</th>
                    <th className="text-center py-2 px-1 font-bold">Score</th>
                    <th className="text-center py-2 px-1 font-bold">Time</th>
                    <th className="text-center py-2 px-1 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry, i) => {
                    const isMe = entry.userId === userId || entry.teamId === userTeamId;
                    return (
                      <tr key={entry.id} className={`border-b border-border/50 ${isMe ? "bg-primary/5" : ""}`}>
                        <td className="py-2 px-1">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${
                            i === 0 ? "bg-yellow-500 text-white" : i === 1 ? "bg-gray-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
                          }`}>{i + 1}</span>
                        </td>
                        <td className="py-2 px-2 font-medium truncate max-w-[120px]">
                          {entry.teamName}
                          {isMe && <Badge variant="outline" className="text-[8px] px-1 py-0 ml-1">You</Badge>}
                        </td>
                        <td className="text-center py-2 px-1 font-bold text-purple-500">{entry.score}</td>
                        <td className="text-center py-2 px-1 text-muted-foreground">{entry.timeTaken}s</td>
                        <td className="text-center py-2 px-1">
                          {entry.completed
                            ? <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-0 text-[8px] px-1 py-0">Done</Badge>
                            : <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 text-[8px] px-1 py-0">Playing</Badge>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <h3 className="font-bold flex items-center gap-2 mb-3">
            <Medal className="w-4 h-4 text-yellow-500" /> Leaderboard
          </h3>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No {isIndividual ? "players" : "teams"} registered yet.</p>
          ) : (
            <div className="space-y-2">
              {sortedEntries.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg ${(entry.userId === userId || entry.teamId === userTeamId) ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/30"}`}
                  data-testid={`entry-${entry.id}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                    i === 0 ? "bg-yellow-500 text-white" : i === 1 ? "bg-gray-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate flex items-center gap-1">
                      {isIndividual && <User className="w-3 h-3 text-muted-foreground" />}
                      {!isIndividual && <Users className="w-3 h-3 text-muted-foreground" />}
                      {entry.teamName}
                      {(entry.userId === userId || entry.teamId === userTeamId) && <Badge variant="outline" className="text-[9px] px-1 py-0">You</Badge>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isIndividual
                        ? (entry.completed ? "Completed" : "In progress")
                        : (entry.completed ? "All members played" : `${(entry.playedBy || []).length} played`)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-purple-500">{entry.score.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{entry.timeTaken}s</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="w-7 h-7 text-yellow-500" />
        <h1 className="text-2xl font-black" data-testid="text-tournaments-title">Tournaments</h1>
      </div>

      <Card className="p-4 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border-yellow-500/20">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground flex-1">
            <span className="font-bold text-foreground">Tournaments</span> are timed science competitions. Enroll before the countdown ends, then compete when it starts! Compete solo or with your team in different game modes for XP, coins, and gems!
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/10 rounded-lg px-3 py-2 border border-yellow-500/20 shrink-0">
            <Crown className="w-4 h-4 text-yellow-400" />
            <div className="text-center">
              <span className="text-lg font-black text-yellow-400" data-testid="text-tournament-wins">{(user as any)?.tournamentWins || 0}</span>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Wins</div>
            </div>
          </div>
        </div>
      </Card>

      <a href="/grand-tournament" className="block">
        <Card className="p-4 bg-gradient-to-r from-yellow-900/30 via-amber-900/30 to-orange-900/30 border-yellow-500/30 hover:border-yellow-400/50 cursor-pointer transition-all" data-testid="banner-grand-tournament">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center shrink-0">
              <Crown className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-yellow-400">Grand Tournament</span>
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">NEW</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Monthly round-robin championship with massive prizes! 5,000 coins + 50 gems for champions! Districts for Year 3-8.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-yellow-500 shrink-0" />
          </div>
        </Card>
      </a>

      <TournamentTierBanner user={user} />


      <div className="flex gap-2">
        {(["all", "individual", "team"] as const).map(tab => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            className="gap-1 font-bold text-xs"
            onClick={() => setActiveTab(tab)}
            data-testid={`button-filter-${tab}`}
          >
            {tab === "all" && <Trophy className="w-3 h-3" />}
            {tab === "individual" && <User className="w-3 h-3" />}
            {tab === "team" && <Users className="w-3 h-3" />}
            {tab === "all" ? "All" : tab === "individual" ? "Solo" : "Team"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No tournaments found!</p>
          <p className="text-sm text-muted-foreground">Check back soon for upcoming competitions.</p>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                <Play className="w-3.5 h-3.5" /> Live Now
              </h2>
              <div className="space-y-2">
                {active.map(t => <TournamentCard key={t.id} tournament={t} onClick={() => setViewingTournament(t.id)} />)}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Upcoming
              </h2>
              <div className="space-y-2">
                {upcoming.map(t => <TournamentCard key={t.id} tournament={t} onClick={() => setViewingTournament(t.id)} />)}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Completed
              </h2>
              <div className="space-y-2">
                {completed.map(t => <TournamentCard key={t.id} tournament={t} onClick={() => setViewingTournament(t.id)} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TournamentCard({ tournament, onClick }: { tournament: Tournament; onClick: () => void }) {
  const style = STATUS_STYLES[tournament.status] || STATUS_STYLES.upcoming;
  const modeInfo = GAME_MODE_INFO[tournament.gameMode] || GAME_MODE_INFO.quiz;
  const formatInfo = FORMAT_INFO[tournament.format] || FORMAT_INFO.open;
  const ModeIcon = modeInfo.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card
        className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onClick}
        data-testid={`card-tournament-${tournament.id}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            tournament.status === "active" ? "bg-gradient-to-br from-green-500 to-emerald-500" :
            tournament.status === "upcoming" ? "bg-gradient-to-br from-blue-500 to-cyan-500" :
            "bg-gradient-to-br from-gray-400 to-gray-500"
          }`}>
            <ModeIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-bold truncate">{tournament.title}</span>
              <Badge className={`${style.bg} ${style.text} border-0 text-[9px] px-1.5 py-0`}>{style.label}</Badge>
              <Badge className={`${formatInfo.color} border-0 text-[9px] px-1.5 py-0`}>{formatInfo.label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-0.5">
                {tournament.scope === "individual" ? <User className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                {tournament.scope === "individual" ? "Solo" : "Team"}
              </span>
              <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> {(tournament.questions as TournamentQuestion[]).length}Q</span>
              <span className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> {tournament.xpReward} XP</span>
              <span className="flex items-center gap-0.5"><Coins className="w-2.5 h-2.5" /> {tournament.coinReward}</span>
              {(tournament.gemReward || 0) > 0 && <span className="flex items-center gap-0.5"><Gem className="w-2.5 h-2.5 text-cyan-500" /> {tournament.gemReward}</span>}
              {tournament.status === "upcoming" && <LiveCountdownSpan startTime={tournament.startTime} />}
              {tournament.status === "active" && <LiveTimeLeftSpan endTime={tournament.endTime} />}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </Card>
    </motion.div>
  );
}

function LiveCountdownSpan({ startTime }: { startTime: string }) {
  const { timeStr } = useCountdown(startTime);
  return (
    <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> Starts in: {timeStr}</span>
  );
}

function LiveTimeLeftSpan({ endTime }: { endTime: string }) {
  const [text, setText] = useState(() => formatTimeLeft(endTime));
  useEffect(() => {
    const interval = setInterval(() => {
      setText(formatTimeLeft(endTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);
  return <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {text}</span>;
}

function CountdownBanner({ startTime }: { startTime: string }) {
  const { timeStr, isStarted } = useCountdown(startTime);

  useEffect(() => {
    if (isStarted) {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
    }
  }, [isStarted]);

  if (isStarted) {
    return (
      <Card className="p-4 bg-green-500/5 border-green-500/20" data-testid="banner-tournament-started">
        <p className="text-sm text-center flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-bold">
          <Play className="w-4 h-4" /> Tournament is starting! Refresh to play.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border-blue-500/20" data-testid="banner-countdown">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400 mb-1 flex items-center justify-center gap-1">
          <Timer className="w-3 h-3" /> Tournament Starts In
        </p>
        <p className="text-3xl font-black text-blue-600 dark:text-blue-300" data-testid="text-countdown">
          {timeStr}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Enroll now to secure your spot!</p>
      </div>
    </Card>
  );
}

function TournamentPlay({ tournament, onFinish, userId, userYearLevel }: { tournament: Tournament; onFinish: () => void; userId: number; userYearLevel: number }) {
  const { toast } = useToast();
  const questions = useMemo(() => getYearAdjustedTournamentQuestions(tournament.questions as TournamentQuestion[], userYearLevel), [tournament.questions, userYearLevel]);
  const yearLevel = Math.min(8, Math.max(3, Number(userYearLevel) || 7));
  const baseTime = tournament.gameMode === "speed-round" ? 15 : tournament.gameMode === "boss-rush" ? 20 : 30;
  const maxTime = baseTime + Math.max(0, (7 - yearLevel) * 3);
  const wrongPenalty = Math.max(2, Math.min(6, yearLevel - 2));
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(maxTime);
  const [totalTime, setTotalTime] = useState(0);
  const [finished, setFinished] = useState(false);
  const [shuffledOptions, setShuffledOptions] = useState<{ text: string; originalIndex: number }[]>([]);
  const [lives, setLives] = useState(tournament.gameMode === "boss-rush" ? 3 : 0);
  const [eliminated, setEliminated] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [streakBonus, setStreakBonus] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef(Date.now());

  // Battle powerups (self-buffs) usable in tournaments.
  const { data: bpData, refetch: refetchBp } = useQuery<{ owned: Record<string, number> }>({ queryKey: ["/api/battle-powerups"] });
  const [bpCounts, setBpCounts] = useState<Record<string, number> | null>(null);
  const bpOwned = bpCounts ?? bpData?.owned ?? {};
  const [tMult, setTMult] = useState(1);
  const [tFrozen, setTFrozen] = useState(false);
  const tFrozenRef = useRef(false);
  tFrozenRef.current = tFrozen;
  const [tPowerupUsed, setTPowerupUsed] = useState(false);
  const [tActivePowerup, setTActivePowerup] = useState<string | null>(null);
  const TOURNEY_POWERUPS = [
    { id: "bp-time-warp", name: "Time Warp" },
    { id: "bp-mega-time", name: "Mega Time" },
    { id: "bp-time-freeze", name: "Freeze" },
    { id: "bp-double-damage", name: "2x Pts" },
    { id: "bp-triple-points", name: "3x Pts" },
    { id: "bp-clarity", name: "Clarity" },
  ];

  const useTournamentPowerup = async (id: string) => {
    if (tPowerupUsed || answered !== null || finished) return;
    if ((bpOwned[id] || 0) <= 0) return;
    try {
      await apiRequest("POST", "/api/battle-powerup/use", { powerupId: id });
      setBpCounts({ ...(bpCounts ?? bpData?.owned ?? {}), [id]: (bpOwned[id] || 0) - 1 });
      setTPowerupUsed(true);
      setTActivePowerup(id);
      if (id === "bp-time-warp") setTimeLeft((p) => p + 6);
      if (id === "bp-mega-time") setTimeLeft((p) => p + 10);
      if (id === "bp-time-freeze") setTFrozen(true);
      if (id === "bp-double-damage") setTMult(2);
      if (id === "bp-triple-points") setTMult(3);
      if (id === "bp-clarity") {
        const correctIdx = questions[currentQ].correctIndex;
        const wrong = shuffledOptions
          .map((opt, i) => ({ i, orig: opt.originalIndex }))
          .filter((o) => o.orig !== correctIdx && !hiddenOptions.includes(o.i));
        if (wrong.length > 1) {
          const hide = wrong[Math.floor(Math.random() * wrong.length)].i;
          setHiddenOptions((prev) => [...prev, hide]);
        }
      }
      refetchBp();
      toast({ title: "Powerup activated!", description: TOURNEY_POWERUPS.find((p) => p.id === id)?.name });
    } catch {
      toast({ title: "Error", description: "Couldn't use powerup", variant: "destructive" });
    }
  };

  const isSurvival = tournament.gameMode === "survival";
  const isBossRush = tournament.gameMode === "boss-rush";
  const isLabChallenge = tournament.gameMode === "lab-challenge";
  const isElementHunt = tournament.gameMode === "element-hunt";

  useEffect(() => {
    if (questions[currentQ]) {
      const opts = questions[currentQ].options.map((text, i) => ({ text, originalIndex: i }));
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      setShuffledOptions(opts);
      setHiddenOptions([]);
    }
  }, [currentQ]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (tFrozenRef.current) return prev; // Freeze powerup pauses the timer
        if (prev <= 1) {
          handleTimeout();
          return maxTime;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleTimeout = () => {
    if (isSurvival) {
      clearInterval(timerRef.current);
      const totalTimeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTotalTime(totalTimeTaken);
      setFinished(true);
      return;
    }
    if (isBossRush) {
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        setEliminated(true);
        clearInterval(timerRef.current);
        const totalTimeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setTotalTime(totalTimeTaken);
        setFinished(true);
      } else {
        setCombo(0);
        nextQuestion();
      }
      return;
    }
    setCombo(0);
    nextQuestion();
  };

  const useHint = () => {
    if (answered !== null || hintsUsed >= 1) return;
    const correctIdx = questions[currentQ].correctIndex;
    const wrongOptions = shuffledOptions
      .map((opt, i) => ({ i, orig: opt.originalIndex }))
      .filter(o => o.orig !== correctIdx && !hiddenOptions.includes(o.i));
    if (wrongOptions.length <= 1) return;
    const toHide = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 1).map(o => o.i);
    setHiddenOptions(prev => [...prev, ...toHide]);
    setHintsUsed(prev => prev + 1);
    setScore(prev => Math.max(0, prev - 5));
  };

  const submitMutation = useMutation({
    mutationFn: async ({ score, timeTaken }: { score: number; timeTaken: number }) => {
      const res = await apiRequest("POST", `/api/tournaments/${tournament.id}/submit`, { score, timeTaken });
      return res.json();
    },
    onSuccess: (data) => {
      const parts = [`${data.rewards.xp} XP`, `${data.rewards.coins} coins`];
      if (data.rewards.gems > 0) parts.push(`${data.rewards.gems} gems`);
      if (data.rewards.tournamentXp > 0) parts.push(`${data.rewards.tournamentXp} Tournament XP`);
      const rankText = data.rewards.rank ? ` Rank #${data.rewards.rank}!` : "";
      const noteText = data.rewards.note ? ` ${data.rewards.note}` : "";
      toast({
        title: `Tournament Round Complete! ${rankText}`,
        description: `You scored ${score} points! Earned ${parts.join(", ")}.${noteText}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      onFinish();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      onFinish();
    },
  });

  const handleAnswer = (optionIndex: number) => {
    if (answered !== null) return;
    const originalIndex = shuffledOptions[optionIndex].originalIndex;
    setAnswered(optionIndex);
    const correct = originalIndex === questions[currentQ].correctIndex;
    if (correct) {
      let basePoints = 15;
      if (tournament.gameMode === "speed-round") basePoints = 25;
      else if (isBossRush) basePoints = 20;
      else if (isElementHunt) basePoints = 10 + Math.floor(timeLeft * 1.5);
      else if (isLabChallenge) basePoints = 15 + (hintsUsed === 0 ? 10 : 0);

      const comboMultiplier = isElementHunt ? combo * 8 : combo * 5;
      const points = Math.round((basePoints + comboMultiplier) * tMult);
      setTMult(1); // multiplier is consumed on the next correct answer
      setScore(prev => prev + points);
      setCombo(prev => prev + 1);
      setStreakBonus(prev => prev + 1);

      if (isElementHunt) {
        setTimeLeft(prev => Math.min(prev + 5, maxTime));
      } else if (isBossRush) {
        setTimeLeft(prev => Math.min(prev + 2, maxTime));
      } else {
        setTimeLeft(prev => Math.min(prev + 3, maxTime));
      }
    } else {
      setCombo(0);
      setStreakBonus(0);
      if (isSurvival) {
        clearInterval(timerRef.current);
        const totalTimeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setTotalTime(totalTimeTaken);
        setFinished(true);
        return;
      }
      if (isBossRush) {
        const newLives = lives - 1;
        setLives(newLives);
        if (newLives <= 0) {
          setEliminated(true);
          clearInterval(timerRef.current);
          const totalTimeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setTotalTime(totalTimeTaken);
          setFinished(true);
          return;
        }
        setTimeLeft(prev => Math.max(prev - 5, 1));
      } else if (isElementHunt) {
        setTimeLeft(prev => Math.max(prev - 6, 1));
      } else {
        setTimeLeft(prev => Math.max(prev - wrongPenalty, 1));
      }
    }
    setTimeout(() => nextQuestion(), isElementHunt ? 600 : 1200);
  };

  const nextQuestion = () => {
    setAnswered(null);
    setHintsUsed(0);
    setTPowerupUsed(false);
    setTFrozen(false);
    setTActivePowerup(null);
    setTMult(1);
    if (currentQ + 1 >= questions.length) {
      clearInterval(timerRef.current);
      const totalTimeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTotalTime(totalTimeTaken);
      setFinished(true);
    } else {
      setCurrentQ(prev => prev + 1);
      setTimeLeft(maxTime);
    }
  };

  useEffect(() => {
    if (finished && !submitMutation.isPending) {
      const totalTimeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
      submitMutation.mutate({ score, timeTaken: totalTimeTaken });
    }
  }, [finished]);

  if (finished) {
    const modeInfo = GAME_MODE_INFO[tournament.gameMode] || GAME_MODE_INFO.quiz;
    const ModeIcon = modeInfo.icon;
    const isDefeated = eliminated || (isSurvival && currentQ < questions.length - 1);
    return (
      <div className="max-w-md mx-auto p-4">
        <Card className="p-8 text-center space-y-4">
          <ModeIcon className={`w-16 h-16 mx-auto ${modeInfo.color}`} />
          <h2 className="text-2xl font-black">
            {isDefeated ? (isBossRush ? "Boss Wins!" : "Eliminated!") : "Tournament Complete!"}
          </h2>
          <p className="text-3xl font-black text-purple-500">{score} pts</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{isSurvival ? `Survived ${currentQ} questions` : isBossRush ? `Cleared ${currentQ}/${questions.length} waves` : `${questions.length} questions`} in {totalTime}s</p>
            {streakBonus > 3 && <p className="text-orange-500 font-bold">Best streak: {streakBonus} in a row!</p>}
          </div>
          {submitMutation.isPending && (
            <p className="text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Submitting score...</p>
          )}
        </Card>
      </div>
    );
  }

  const q = questions[currentQ];
  if (!q) return null;

  const modeInfo = GAME_MODE_INFO[tournament.gameMode] || GAME_MODE_INFO.quiz;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-bold">{isBossRush ? `Wave ${currentQ + 1}` : `${currentQ + 1}/${questions.length}`}</Badge>
          <Badge variant="outline" className={`font-bold text-[9px] ${modeInfo.color}`}>{modeInfo.label}</Badge>
          <Badge variant="outline" className="font-bold text-[9px]">Year {yearLevel}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {isBossRush && (
            <Badge variant="secondary" className="gap-1 font-bold text-red-500">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className={i < lives ? "text-red-500" : "text-muted-foreground/30"}>{i < lives ? "\u2764" : "\u2661"}</span>
              ))}
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 font-bold"><Zap className="w-3 h-3" /> {score}</Badge>
          {combo > 1 && <Badge className="bg-orange-500 text-white text-xs gap-0.5">x{combo}</Badge>}
        </div>
      </div>

      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-500" : isBossRush ? "bg-purple-500" : isElementHunt ? "bg-cyan-500" : "bg-green-500"}`}
          initial={false}
          animate={{ width: `${(timeLeft / maxTime) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <div className="text-center flex items-center justify-center gap-3">
        <span className={`text-sm font-bold ${timeLeft <= 5 ? "text-red-500" : "text-muted-foreground"}`}>
          <Timer className="w-3.5 h-3.5 inline mr-1" />{timeLeft}s
        </span>
        {isSurvival && <span className="text-xs text-red-500 font-semibold">(1 wrong = eliminated!)</span>}
        {isBossRush && <span className="text-xs text-purple-500 font-semibold">Boss takes a life on miss!</span>}
        {isElementHunt && <span className="text-xs text-cyan-500 font-semibold">Speed = more points!</span>}
      </div>

      <Card className="p-5">
        {isLabChallenge && answered === null && hintsUsed === 0 && (
          <div className="flex justify-end mb-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs text-green-600 dark:text-green-400 border-green-500/30" onClick={useHint} data-testid="button-use-hint">
              <FlaskConical className="w-3 h-3" /> Use Lab Hint (-5 pts)
            </Button>
          </div>
        )}
        {Object.values(bpOwned).some((c) => c > 0) && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {TOURNEY_POWERUPS.map((bp) => {
              const count = bpOwned[bp.id] || 0;
              const active = tActivePowerup === bp.id;
              return (
                <Button
                  key={bp.id}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={`gap-1 text-xs font-bold ${active ? "bg-purple-500/30 border-purple-500" : ""}`}
                  disabled={count <= 0 || tPowerupUsed || answered !== null}
                  onClick={() => useTournamentPowerup(bp.id)}
                  data-testid={`tourney-powerup-${bp.id}`}
                >
                  <Sparkles className="w-3 h-3 text-amber-400" /> {bp.name}
                  <Badge variant="secondary" className="ml-0.5 text-[10px] px-1 py-0">{count}</Badge>
                </Button>
              );
            })}
            {tActivePowerup && <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[10px] animate-pulse">{TOURNEY_POWERUPS.find((p) => p.id === tActivePowerup)?.name} active</Badge>}
          </div>
        )}
        <h3 className="text-base font-bold mb-4 leading-relaxed">{q.question}</h3>
        <div className="space-y-2">
          {shuffledOptions.map((opt, i) => {
            if (hiddenOptions.includes(i) && answered === null) return null;
            const isCorrect = opt.originalIndex === q.correctIndex;
            const isSelected = answered === i;
            let btnClass = "w-full justify-start text-left h-auto py-3 px-4 font-medium";
            if (answered !== null) {
              if (isCorrect) btnClass += " bg-green-500/10 border-green-500 text-green-700 dark:text-green-400";
              else if (isSelected) btnClass += " bg-red-500/10 border-red-500 text-red-700 dark:text-red-400";
            }
            if (hiddenOptions.includes(i) && answered !== null) btnClass += " opacity-30";
            return (
              <motion.div key={i} initial={isElementHunt ? { x: -10, opacity: 0 } : false} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}>
                <Button
                  variant="outline"
                  className={btnClass}
                  onClick={() => handleAnswer(i)}
                  disabled={answered !== null || hiddenOptions.includes(i)}
                  data-testid={`button-option-${i}`}
                >
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold mr-3 shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt.text}
                </Button>
              </motion.div>
            );
          })}
        </div>
        {answered !== null && q.explanation && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded-lg p-2">
            {q.explanation}
          </motion.p>
        )}
      </Card>
    </div>
  );
}

function TournamentTierBanner({ user }: { user: any }) {
  const tournamentXp = user?.tournamentXp || 0;
  const tier = getTournamentTier(tournamentXp);

  return (
    <a href="/tournament-rankings" className="block">
      <Card className="p-4 bg-gradient-to-r from-indigo-900/30 via-purple-900/30 to-violet-900/30 border-purple-500/30 hover:border-purple-400/50 cursor-pointer transition-all" data-testid="banner-tournament-rankings">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-2xl shrink-0 shadow-lg`}>
            {tier.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-black ${tier.textColor}`}>{tier.name}</span>
              <ChevronRight className="w-4 h-4 text-purple-400" />
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-1.5 mb-1">
              <motion.div
                className={`h-full bg-gradient-to-r ${tier.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${tier.progress * 100}%` }}
                transition={{ duration: 1 }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{tournamentXp} Tournament XP</span>
              {tier.nextTier && <span>{tier.xpInTier}/{tier.xpForNext} to {tier.nextTier.emoji} {tier.nextTier.name}</span>}
            </div>
          </div>
        </div>
      </Card>
    </a>
  );
}
