import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renderMentions } from "@/lib/mentions";
import {
  Trophy, Users, Loader2, ArrowLeft, Zap, Coins, Clock,
  Swords, Star, Medal, Crown, Gem, User, Shield, Flame,
  FlaskConical, Brain, ChevronRight, Target, Award, MapPin,
  MessageCircle, Send, Timer, TrendingUp
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import { DISTRICTS, GRAND_TOURNAMENT_EVENTS, GRAND_TOURNAMENT_PRIZES } from "@/lib/gameData";
import { Link } from "wouter";

const EVENT_ICONS: Record<string, any> = {
  "solo-quiz-championship": Brain,
  "speed-science-sprint": Zap,
  "survival-showdown": Shield,
  "team-science-bowl": Users,
  "lab-challenge-relay": FlaskConical,
  "boss-rush-relay": Swords,
};

interface GrandEntry {
  id: number;
  tournamentId: number;
  userId: number | null;
  username: string;
  teamId: number | null;
  teamName: string | null;
  groupIndex: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  totalScore: number;
  matchesPlayed: number;
  eliminated: boolean;
  knockoutSeed: number | null;
  finalRank: number | null;
  pendingScore: number | null;
}

interface GrandTournamentData {
  id: number;
  month: string;
  status: string;
  phase: string;
  district: string;
  eventType: string;
  scope: string;
  groups: any[];
  knockoutBracket: any[];
  standings: any[];
  currentRound: number;
  totalGroupRounds: number;
  prizes: any;
  entries: GrandEntry[];
  participantCount: number;
}

interface DistrictBattleData {
  totalScore: number;
  playerCount: number;
  avgScore: number;
}

type MainTab = "events" | "district-chat" | "year-battle";

function useCountdownTimer(endTimeIso: string | undefined) {
  const [timeStr, setTimeStr] = useState("");
  useEffect(() => {
    if (!endTimeIso) return;
    const update = () => {
      const diff = new Date(endTimeIso).getTime() - Date.now();
      if (diff <= 0) { setTimeStr("Tournament Starting Now!"); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeStr(`${days}d ${hours}h ${mins}m ${secs}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTimeIso]);
  return timeStr;
}

export default function GrandTournamentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedScope, setSelectedScope] = useState<"individual" | "team">("individual");
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("events");

  const { data, isLoading } = useQuery<{
    tournaments: GrandTournamentData[];
    currentMonth: string;
    userDistrict: string | null;
    msUntilStart: number;
    nextTournamentStart: string;
    districtBattle: Record<string, DistrictBattleData>;
  }>({
    queryKey: ["/api/grand-tournament"],
    refetchInterval: 30000,
  });

  const registerMutation = useMutation({
    mutationFn: async (eventType: string) => {
      const res = await apiRequest("POST", "/api/grand-tournament/register", { eventType });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Registered!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/grand-tournament"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async ({ eventType, score }: { eventType: string; score: number }) => {
      const res = await apiRequest("POST", "/api/grand-tournament/submit", { eventType, score });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.status === "pending") {
        toast({ title: "Score Submitted!", description: data.message });
      } else if (data.status === "matched") {
        const title = data.matchResult === "win" ? "Victory!" : data.matchResult === "draw" ? "Draw!" : "Defeat";
        toast({ title, description: data.message });
      } else {
        toast({ title: "Match Recorded!", description: data.message });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/grand-tournament"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const countdown = useCountdownTimer(data?.nextTournamentStart);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-grand-tournament">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  const tournaments = data?.tournaments || [];
  const userDistrict = selectedDistrict || data?.userDistrict || "year-7";
  const currentMonth = data?.currentMonth || "";
  const monthLabel = currentMonth ? new Date(currentMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "This Month";
  const districtBattle = data?.districtBattle || {};

  const events = selectedScope === "individual" ? GRAND_TOURNAMENT_EVENTS.individual : GRAND_TOURNAMENT_EVENTS.team;
  const districtTournaments = tournaments.filter(t => t.district === userDistrict);
  const scopeTournaments = districtTournaments.filter(t => t.scope === selectedScope);

  const allEvents = [...GRAND_TOURNAMENT_EVENTS.individual, ...GRAND_TOURNAMENT_EVENTS.team];
  const currentEvent = selectedEvent ? allEvents.find(e => e.id === selectedEvent) : null;
  const currentTournament = selectedEvent ? scopeTournaments.find(t => t.eventType === selectedEvent) : null;

  const userEntry = currentTournament?.entries?.find((e: GrandEntry) => e.userId === (user as any)?.id);
  const isRegistered = !!userEntry;

  const totalPrizePool = {
    coins: GRAND_TOURNAMENT_PRIZES.first.coins + GRAND_TOURNAMENT_PRIZES.second.coins + GRAND_TOURNAMENT_PRIZES.third.coins,
    gems: GRAND_TOURNAMENT_PRIZES.first.gems + GRAND_TOURNAMENT_PRIZES.second.gems + GRAND_TOURNAMENT_PRIZES.third.gems,
    xp: GRAND_TOURNAMENT_PRIZES.first.xp + GRAND_TOURNAMENT_PRIZES.second.xp + GRAND_TOURNAMENT_PRIZES.third.xp,
  };

  if (selectedEvent && currentEvent && currentTournament) {
    return (
      <EventDetailView
        event={currentEvent}
        tournament={currentTournament}
        userEntry={userEntry}
        isRegistered={isRegistered}
        onBack={() => setSelectedEvent(null)}
        onRegister={() => registerMutation.mutate(currentEvent.id)}
        onSubmitScore={(score: number) => submitMutation.mutate({ eventType: currentEvent.id, score })}
        isRegistering={registerMutation.isPending}
        isSubmitting={submitMutation.isPending}
        userId={(user as any)?.id}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-400" />
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500" data-testid="title-grand-tournament">
              Grand Tournament
            </h1>
            <Trophy className="w-10 h-10 text-yellow-400" />
          </div>
          <p className="text-gray-400 text-lg">{monthLabel} - Monthly Round-Robin Championship</p>
        </div>

        <Card className="bg-gradient-to-r from-red-900/30 via-orange-900/30 to-yellow-900/30 border-orange-500/30 p-4">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Timer className="w-6 h-6 text-orange-400 animate-pulse" />
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wider">Next Tournament Starts In</p>
              <p className="text-2xl font-black text-orange-300 font-mono tracking-wide" data-testid="text-countdown-timer">
                {countdown || "Loading..."}
              </p>
            </div>
            <Timer className="w-6 h-6 text-orange-400 animate-pulse" />
          </div>
        </Card>

        <Card className="bg-gradient-to-r from-yellow-900/40 via-amber-900/40 to-orange-900/40 border-yellow-500/30 p-6">
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold text-yellow-300 flex items-center justify-center gap-2">
              <Crown className="w-6 h-6" /> Total Prize Pool <Crown className="w-6 h-6" />
            </h2>
            <div className="flex items-center justify-center gap-8 text-lg flex-wrap">
              <span className="flex items-center gap-1 text-yellow-400 font-bold" data-testid="text-prize-coins">
                <Coins className="w-5 h-5" /> {totalPrizePool.coins.toLocaleString()} Coins
              </span>
              <span className="flex items-center gap-1 text-purple-400 font-bold" data-testid="text-prize-gems">
                <Gem className="w-5 h-5" /> {totalPrizePool.gems} Gems
              </span>
              <span className="flex items-center gap-1 text-cyan-400 font-bold" data-testid="text-prize-xp">
                <Zap className="w-5 h-5" /> {totalPrizePool.xp.toLocaleString()} XP
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-400 mt-2">
              <span>🥇 1st: {GRAND_TOURNAMENT_PRIZES.first.coins} coins + {GRAND_TOURNAMENT_PRIZES.first.gems} gems + {GRAND_TOURNAMENT_PRIZES.first.xp} XP</span>
              <span>🥈 2nd: {GRAND_TOURNAMENT_PRIZES.second.coins} coins + {GRAND_TOURNAMENT_PRIZES.second.gems} gems + {GRAND_TOURNAMENT_PRIZES.second.xp} XP</span>
              <span>🥉 3rd: {GRAND_TOURNAMENT_PRIZES.third.coins} coins + {GRAND_TOURNAMENT_PRIZES.third.gems} gems + {GRAND_TOURNAMENT_PRIZES.third.xp} XP</span>
            </div>
          </div>
        </Card>

        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" /> Select Your District
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {DISTRICTS.map(d => (
              <Button
                key={d.id}
                variant={userDistrict === d.id ? "default" : "outline"}
                className={`${userDistrict === d.id
                  ? `bg-gradient-to-r ${d.color} text-white border-0`
                  : "border-gray-600 text-gray-300 hover:text-white"
                }`}
                onClick={() => setSelectedDistrict(d.id)}
                data-testid={`button-district-${d.id}`}
              >
                <span className="mr-1">{d.emoji}</span> {d.name}
              </Button>
            ))}
          </div>
          {data?.userDistrict && (
            <p className="text-sm text-gray-500">Your district: {DISTRICTS.find(d => d.id === data.userDistrict)?.name || data.userDistrict}</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={mainTab === "events" ? "default" : "outline"}
            className={mainTab === "events" ? "bg-yellow-600 hover:bg-yellow-700" : "border-gray-600 text-gray-300"}
            onClick={() => setMainTab("events")}
            data-testid="button-tab-events"
          >
            <Trophy className="w-4 h-4 mr-2" /> Events
          </Button>
          <Button
            variant={mainTab === "district-chat" ? "default" : "outline"}
            className={mainTab === "district-chat" ? "bg-indigo-600 hover:bg-indigo-700" : "border-gray-600 text-gray-300"}
            onClick={() => setMainTab("district-chat")}
            data-testid="button-tab-district-chat"
          >
            <MessageCircle className="w-4 h-4 mr-2" /> District Chat
          </Button>
          <Button
            variant={mainTab === "year-battle" ? "default" : "outline"}
            className={mainTab === "year-battle" ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300"}
            onClick={() => setMainTab("year-battle")}
            data-testid="button-tab-year-battle"
          >
            <Swords className="w-4 h-4 mr-2" /> Year Level Battle
          </Button>
          <Link href="/district-battles">
            <Button
              variant="outline"
              className="border-orange-600 text-orange-400 hover:bg-orange-600/20"
              data-testid="button-district-battles"
            >
              <Flame className="w-4 h-4 mr-2" /> District Battles
            </Button>
          </Link>
        </div>

        {mainTab === "events" && (
          <>
            <div className="flex gap-2">
              <Button
                variant={selectedScope === "individual" ? "default" : "outline"}
                className={selectedScope === "individual" ? "bg-blue-600 hover:bg-blue-700" : "border-gray-600 text-gray-300"}
                onClick={() => { setSelectedScope("individual"); setSelectedEvent(null); }}
                data-testid="button-scope-individual"
              >
                <User className="w-4 h-4 mr-2" /> Individual Events
              </Button>
              <Button
                variant={selectedScope === "team" ? "default" : "outline"}
                className={selectedScope === "team" ? "bg-green-600 hover:bg-green-700" : "border-gray-600 text-gray-300"}
                onClick={() => { setSelectedScope("team"); setSelectedEvent(null); }}
                data-testid="button-scope-team"
              >
                <Users className="w-4 h-4 mr-2" /> Team Events
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {events.map(event => {
                const Icon = EVENT_ICONS[event.id] || Trophy;
                const tournament = scopeTournaments.find(t => t.eventType === event.id);
                const participantCount = tournament?.participantCount || 0;
                const status = tournament?.status || "registration";
                const phase = tournament?.phase || "group";
                const myEntry = tournament?.entries?.find((e: GrandEntry) => e.userId === (user as any)?.id);

                return (
                  <motion.div key={event.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card
                      className="bg-gray-800/80 border-gray-700 hover:border-yellow-500/50 cursor-pointer p-5 space-y-3 transition-all"
                      onClick={() => setSelectedEvent(event.id)}
                      data-testid={`card-event-${event.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
                            <Icon className="w-6 h-6 text-yellow-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white">{event.name}</h3>
                            <p className="text-sm text-gray-400">{event.description}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <Badge variant="outline" className={`
                          ${status === "registration" ? "border-green-500 text-green-400" :
                            status === "active" ? "border-blue-500 text-blue-400" :
                            "border-gray-500 text-gray-400"}
                        `}>
                          {status === "registration" ? "Open" : status === "active" ? (phase === "knockout" ? "Knockout" : "Group Stage") : "Completed"}
                        </Badge>
                        <span className="text-gray-400 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {participantCount} joined
                        </span>
                      </div>

                      {myEntry && (
                        <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-2 text-sm">
                          <span className="text-yellow-400 font-medium">Your Record:</span>
                          <span className="text-gray-300 ml-2">
                            {myEntry.wins}W - {myEntry.draws}D - {myEntry.losses}L ({myEntry.points} pts)
                          </span>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            <Card className="bg-gray-800/60 border-gray-700 p-5">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" /> How It Works
              </h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400">
                <div className="space-y-1">
                  <p className="text-white font-medium">1. Group Stage (Matchmaking)</p>
                  <p>Play 5 rounds! You'll be paired with opponents who have similar wins. Whoever scores higher wins the match. Draws? Both go through! Win = 3 pts, Draw = 1 pt, Loss = 0 pts.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium">2. Knockout Stage</p>
                  <p>Top players from groups face off in quarterfinals, semifinals, and the grand final!</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium">3. Massive Prizes</p>
                  <p>Champions win 5,000 coins, 50 gems, 500 XP and the exclusive Grand Champion title!</p>
                </div>
              </div>
            </Card>

            <DistrictLeaderboard tournaments={districtTournaments} districtId={userDistrict} />
          </>
        )}

        {mainTab === "district-chat" && (
          <DistrictChat yearLevel={(user as any)?.yearLevel || 7} district={data?.userDistrict || `year-${(user as any)?.yearLevel || 7}`} />
        )}

        {mainTab === "year-battle" && (
          <YearLevelBattle districtBattle={districtBattle} userDistrict={data?.userDistrict || null} />
        )}
      </motion.div>
    </div>
  );
}

function DistrictChat({ yearLevel, district }: { yearLevel: number; district: string }) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const districtInfo = DISTRICTS.find(d => d.id === district);

  const { data: messages = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/chat/district", yearLevel],
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/chat/district/${yearLevel}`, { content });
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/district", yearLevel] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
  };

  return (
    <Card className="bg-gray-800/60 border-gray-700 overflow-hidden">
      <div className={`bg-gradient-to-r ${districtInfo?.color || "from-blue-500 to-indigo-500"} p-4`}>
        <h3 className="font-bold text-white flex items-center gap-2 text-lg">
          <MessageCircle className="w-5 h-5" />
          {districtInfo?.emoji} {districtInfo?.name} District Chat
        </h3>
        <p className="text-white/70 text-sm">Chat with other {districtInfo?.name} students in the Grand Tournament!</p>
      </div>

      <div className="h-80 overflow-y-auto p-4 space-y-3" data-testid="district-chat-messages">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No messages yet! Be the first to say hi to your district!</p>
          </div>
        )}
        {messages.map((msg: any) => (
          <div key={msg.id} className="flex gap-2" data-testid={`chat-message-${msg.id}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {msg.username?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">{msg.username}</span>
                <span className="text-gray-500 text-xs">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-gray-300 text-sm break-words">{renderMentions(msg.content, (user as any)?.username)}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-700 p-3 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={`Message ${districtInfo?.name} district...`}
          className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          maxLength={500}
          data-testid="input-district-chat"
        />
        <Button
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700"
          onClick={handleSend}
          disabled={!message.trim() || sendMutation.isPending}
          data-testid="button-send-district-chat"
        >
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </Card>
  );
}

function YearLevelBattle({ districtBattle, userDistrict }: { districtBattle: Record<string, DistrictBattleData>; userDistrict: string | null }) {
  const sorted = DISTRICTS
    .map(d => ({
      ...d,
      data: districtBattle[d.id] || { totalScore: 0, playerCount: 0, avgScore: 0 },
    }))
    .sort((a, b) => b.data.totalScore - a.data.totalScore);

  const maxScore = Math.max(...sorted.map(d => d.data.totalScore), 1);

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-red-900/30 via-purple-900/30 to-blue-900/30 border-red-500/30 p-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-purple-400 to-blue-400 flex items-center justify-center gap-3">
            <Swords className="w-7 h-7 text-red-400" /> Year Level Battle <Swords className="w-7 h-7 text-blue-400" />
          </h2>
          <p className="text-gray-400">Which year level is the smartest? Every score your district earns helps your year level climb the ranks!</p>
          <p className="text-gray-500 text-sm">All tournament scores from every player in each year level are combined. Play more events to help your district win!</p>
        </div>
      </Card>

      <div className="space-y-3">
        {sorted.map((d, idx) => {
          const barWidth = maxScore > 0 ? (d.data.totalScore / maxScore) * 100 : 0;
          const isUser = d.id === userDistrict;
          const rankEmoji = idx === 0 ? "🏆" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card
                className={`p-4 transition-all ${isUser ? "bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-500/40 ring-1 ring-blue-500/20" : "bg-gray-800/60 border-gray-700"}`}
                data-testid={`card-year-battle-${d.id}`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold w-10 text-center">{rankEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{d.emoji}</span>
                        <span className="font-bold text-white">{d.name}</span>
                        {isUser && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">YOUR DISTRICT</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {d.data.playerCount} players
                        </span>
                        <span className="text-yellow-400 font-bold flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {d.data.totalScore.toLocaleString()} pts
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-4 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${d.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(barWidth, 2)}%` }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>Avg per player: {d.data.avgScore}</span>
                      {idx === 0 && d.data.totalScore > 0 && <span className="text-yellow-400 font-bold">Leading!</span>}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card className="bg-gray-800/40 border-gray-700 p-4">
        <h3 className="font-bold text-white mb-2 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-400" /> Year Level Battle Rewards
        </h3>
        <div className="grid grid-cols-3 gap-3 text-sm text-center">
          <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3">
            <div className="text-xl mb-1">🏆</div>
            <div className="font-bold text-yellow-400">1st Place Year</div>
            <div className="text-gray-400 text-xs">All players get 500 bonus coins + "District Champion" badge</div>
          </div>
          <div className="bg-gray-900/30 border border-gray-600 rounded-lg p-3">
            <div className="text-xl mb-1">🥈</div>
            <div className="font-bold text-gray-300">2nd Place Year</div>
            <div className="text-gray-400 text-xs">All players get 250 bonus coins</div>
          </div>
          <div className="bg-orange-900/20 border border-orange-500/20 rounded-lg p-3">
            <div className="text-xl mb-1">🥉</div>
            <div className="font-bold text-orange-400">3rd Place Year</div>
            <div className="text-gray-400 text-xs">All players get 100 bonus coins</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EventDetailView({
  event,
  tournament,
  userEntry,
  isRegistered,
  onBack,
  onRegister,
  onSubmitScore,
  isRegistering,
  isSubmitting,
  userId,
}: {
  event: any;
  tournament: GrandTournamentData;
  userEntry: GrandEntry | undefined;
  isRegistered: boolean;
  onBack: () => void;
  onRegister: () => void;
  onSubmitScore: (score: number) => void;
  isRegistering: boolean;
  isSubmitting: boolean;
  userId: number;
}) {
  const Icon = EVENT_ICONS[event.id] || Trophy;
  const entries = tournament.entries || [];
  const sortedEntries = [...entries].sort((a, b) => b.points - a.points || b.totalScore - a.totalScore);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white" data-testid="button-back-events">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Events
        </Button>

        <Card className="bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border-yellow-500/30 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
              <Icon className="w-8 h-8 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white" data-testid="text-event-title">{event.name}</h2>
              <p className="text-gray-400">{event.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline" className={`
                  ${tournament.status === "registration" ? "border-green-500 text-green-400" :
                    tournament.status === "active" ? "border-blue-500 text-blue-400" :
                    "border-gray-500 text-gray-400"}
                `}>
                  {tournament.status === "registration" ? "Registration Open" :
                   tournament.phase === "knockout" ? "Knockout Stage" :
                   tournament.status === "active" ? "Group Stage" : "Completed"}
                </Badge>
                <span className="text-gray-400 text-sm">{entries.length} participants</span>
              </div>
            </div>
          </div>
        </Card>

        {!isRegistered && tournament.status === "registration" && (
          <Card className="bg-green-900/20 border-green-500/30 p-6 text-center">
            <h3 className="text-xl font-bold text-green-400 mb-2">Join This Event!</h3>
            <p className="text-gray-400 mb-4">Register to compete in the round-robin group stage</p>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white px-8"
              onClick={onRegister}
              disabled={isRegistering}
              data-testid="button-register-event"
            >
              {isRegistering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
              Register Now
            </Button>
          </Card>
        )}

        {isRegistered && userEntry && (
          <Card className="bg-blue-900/20 border-blue-500/30 p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
              <Star className="w-5 h-5" /> Your Progress
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatBox label="Matches" value={`${userEntry.matchesPlayed}/${tournament.totalGroupRounds}`} />
              <StatBox label="Wins" value={String(userEntry.wins)} color="text-green-400" />
              <StatBox label="Draws" value={String(userEntry.draws)} color="text-yellow-400" />
              <StatBox label="Losses" value={String(userEntry.losses)} color="text-red-400" />
              <StatBox label="Points" value={String(userEntry.points)} color="text-cyan-400" />
            </div>
            <div className="mt-3 text-sm text-gray-400">
              Total Score: {userEntry.totalScore} | Avg Score: {userEntry.matchesPlayed > 0 ? Math.round(userEntry.totalScore / userEntry.matchesPlayed) : 0}
            </div>
          </Card>
        )}

        {isRegistered && tournament.status === "registration" && (
          <Card className="bg-amber-900/20 border-amber-500/30 p-4 text-center">
            <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-amber-400 font-medium">Tournament hasn't started yet!</p>
            <p className="text-gray-400 text-sm mt-1">You're registered. Come back when the tournament begins to play your matches.</p>
          </Card>
        )}

        {isRegistered && tournament.status === "active" && userEntry && userEntry.pendingScore !== null && userEntry.pendingScore !== undefined && (
          <Card className="bg-indigo-900/20 border-indigo-500/30 p-6 text-center">
            <Loader2 className="w-8 h-8 text-indigo-400 mx-auto mb-3 animate-spin" />
            <h3 className="text-lg font-bold text-indigo-400 mb-2">Waiting for Opponent...</h3>
            <p className="text-gray-400 text-sm">Your score of <span className="text-white font-bold">{userEntry.pendingScore}</span> has been submitted.</p>
            <p className="text-gray-500 text-xs mt-2">You'll be matched with a player who has a similar number of wins. Check back soon!</p>
          </Card>
        )}

        {isRegistered && tournament.status === "active" && userEntry && (userEntry.pendingScore === null || userEntry.pendingScore === undefined) && userEntry.matchesPlayed < tournament.totalGroupRounds && tournament.phase !== "knockout" && (
          <Card className="bg-purple-900/20 border-purple-500/30 p-6 text-center">
            <h3 className="text-lg font-bold text-purple-400 mb-2">Play a Match!</h3>
            <p className="text-gray-400 mb-4 text-sm">
              Round {userEntry.matchesPlayed + 1} of {tournament.totalGroupRounds} - Answer science questions and get paired with an opponent!
            </p>
            <p className="text-gray-500 text-xs mb-3">You'll be matched against a player with similar wins. Higher score wins!</p>
            <QuickPlayMatch onSubmit={onSubmitScore} isSubmitting={isSubmitting} gameMode={event.gameMode} />
          </Card>
        )}

        {isRegistered && userEntry && userEntry.matchesPlayed >= tournament.totalGroupRounds && tournament.phase === "group" && (
          <Card className="bg-amber-900/20 border-amber-500/30 p-4 text-center">
            <p className="text-amber-400 font-medium">All group matches completed! Waiting for other players to finish...</p>
          </Card>
        )}

        {tournament.phase === "knockout" && tournament.knockoutBracket && (tournament.knockoutBracket as any[]).length > 0 && (
          <KnockoutBracket bracket={tournament.knockoutBracket as any[]} />
        )}

        {(tournament.groups as any[])?.length > 0 && (
          <Card className="bg-gray-800/60 border-gray-700 p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-400" /> Recent Match Results
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[...(tournament.groups as any[])].reverse().map((match: any, idx: number) => (
                <div key={idx} className="bg-gray-900/50 rounded-lg p-3 flex items-center justify-between text-sm" data-testid={`match-result-${idx}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${match.result === match.player1?.entryId ? "text-green-400" : match.result === "draw" ? "text-yellow-400" : "text-red-400"}`}>
                      {match.player1?.username}
                    </span>
                    <span className="text-gray-500">({match.player1?.score})</span>
                  </div>
                  <Badge variant="outline" className={`mx-2 text-xs ${match.result === "draw" ? "border-yellow-500 text-yellow-400" : "border-gray-600 text-gray-400"}`}>
                    {match.result === "draw" ? "DRAW" : "VS"}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">({match.player2?.score})</span>
                    <span className={`font-medium ${match.result === match.player2?.entryId ? "text-green-400" : match.result === "draw" ? "text-yellow-400" : "text-red-400"}`}>
                      {match.player2?.username}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="bg-gray-800/60 border-gray-700 p-5">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <Medal className="w-5 h-5 text-yellow-400" /> Standings
          </h3>
          {sortedEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No participants yet. Be the first to register!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">Player</th>
                    <th className="text-center py-2 px-1">P</th>
                    <th className="text-center py-2 px-1">W</th>
                    <th className="text-center py-2 px-1">D</th>
                    <th className="text-center py-2 px-1">L</th>
                    <th className="text-center py-2 px-1">Pts</th>
                    <th className="text-center py-2 px-1">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-gray-700/50 ${entry.userId === userId ? "bg-blue-900/20" : ""} ${entry.eliminated ? "opacity-50" : ""}`}
                      data-testid={`row-standing-${entry.id}`}
                    >
                      <td className="py-2 px-2">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                      </td>
                      <td className="py-2 px-2 font-medium text-white">
                        {entry.username}
                        {entry.eliminated && <span className="text-red-400 text-xs ml-1">(eliminated)</span>}
                        {entry.userId === userId && <span className="text-blue-400 text-xs ml-1">(you)</span>}
                      </td>
                      <td className="text-center py-2 px-1 text-gray-400">{entry.matchesPlayed}</td>
                      <td className="text-center py-2 px-1 text-green-400">{entry.wins}</td>
                      <td className="text-center py-2 px-1 text-yellow-400">{entry.draws}</td>
                      <td className="text-center py-2 px-1 text-red-400">{entry.losses}</td>
                      <td className="text-center py-2 px-1 text-cyan-400 font-bold">{entry.points}</td>
                      <td className="text-center py-2 px-1 text-gray-300">{entry.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="bg-gray-800/40 border-gray-700 p-4">
          <h3 className="font-bold text-white mb-2 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" /> Prizes for This Event
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <PrizeCard rank="1st" prize={GRAND_TOURNAMENT_PRIZES.first} emoji="🥇" />
            <PrizeCard rank="2nd" prize={GRAND_TOURNAMENT_PRIZES.second} emoji="🥈" />
            <PrizeCard rank="3rd" prize={GRAND_TOURNAMENT_PRIZES.third} emoji="🥉" />
            <PrizeCard rank="Participation" prize={GRAND_TOURNAMENT_PRIZES.participation} emoji="🎗️" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${color || "text-white"}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

function PrizeCard({ rank, prize, emoji }: { rank: string; prize: any; emoji: string }) {
  return (
    <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700">
      <div className="text-xl mb-1">{emoji}</div>
      <div className="font-bold text-white text-sm">{rank}</div>
      <div className="text-yellow-400 text-xs">{prize.coins} coins</div>
      {prize.gems > 0 && <div className="text-purple-400 text-xs">{prize.gems} gems</div>}
      <div className="text-cyan-400 text-xs">{prize.xp} XP</div>
      {prize.title && <div className="text-amber-300 text-xs mt-1">"{prize.title}"</div>}
    </div>
  );
}

function KnockoutBracket({ bracket }: { bracket: any[] }) {
  return (
    <Card className="bg-gray-800/60 border-gray-700 p-5">
      <h3 className="font-bold text-white mb-4 flex items-center gap-2">
        <Swords className="w-5 h-5 text-red-400" /> Knockout Bracket
      </h3>
      <div className="space-y-3">
        {bracket.map((match: any, idx: number) => (
          <div key={idx} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-500 mb-2 uppercase font-medium">{match.round} - Match {match.match}</div>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${match.winner === match.player1?.entryId ? "text-green-400 font-bold" : "text-white"}`}>
                <User className="w-4 h-4" />
                {match.player1?.name || "TBD"}
                <span className="text-gray-400 text-sm ml-1">{match.player1?.score || 0}</span>
              </div>
              <span className="text-gray-500 font-bold text-sm">VS</span>
              <div className={`flex items-center gap-2 ${match.winner === match.player2?.entryId ? "text-green-400 font-bold" : "text-white"}`}>
                <span className="text-gray-400 text-sm mr-1">{match.player2?.score || 0}</span>
                {match.player2?.name || "TBD"}
                <User className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const QUICK_QUESTIONS = [
  { q: "What particle orbits the nucleus of an atom?", opts: ["Proton", "Neutron", "Electron", "Photon"], ans: 2 },
  { q: "What is the chemical formula for table salt?", opts: ["NaCl", "KBr", "CaCO₃", "H₂SO₄"], ans: 0 },
  { q: "What type of wave is sound?", opts: ["Transverse", "Electromagnetic", "Longitudinal", "Gamma"], ans: 2 },
  { q: "What organelle carries out photosynthesis?", opts: ["Mitochondria", "Ribosome", "Chloroplast", "Vacuole"], ans: 2 },
  { q: "What is the SI unit of energy?", opts: ["Newton", "Watt", "Joule", "Pascal"], ans: 2 },
  { q: "How many chromosomes do humans have?", opts: ["23", "44", "46", "48"], ans: 2 },
  { q: "What layer of the atmosphere contains the ozone layer?", opts: ["Troposphere", "Stratosphere", "Mesosphere", "Thermosphere"], ans: 1 },
  { q: "What metal is liquid at room temperature?", opts: ["Lead", "Mercury", "Tin", "Gallium"], ans: 1 },
  { q: "What is the main function of red blood cells?", opts: ["Fight infection", "Carry oxygen", "Clot wounds", "Digest food"], ans: 1 },
  { q: "What type of energy is stored in a stretched rubber band?", opts: ["Kinetic", "Thermal", "Elastic potential", "Chemical"], ans: 2 },
  { q: "What is the boiling point of water in Celsius?", opts: ["90°C", "100°C", "110°C", "120°C"], ans: 1 },
  { q: "Which planet has the Great Red Spot?", opts: ["Mars", "Saturn", "Jupiter", "Neptune"], ans: 2 },
  { q: "What is the smallest unit of life?", opts: ["Atom", "Molecule", "Cell", "Organ"], ans: 2 },
  { q: "What causes rust on iron?", opts: ["Water only", "Air only", "Oxygen and moisture", "Sunlight"], ans: 2 },
  { q: "What type of rock is marble?", opts: ["Igneous", "Sedimentary", "Metamorphic", "Volcanic"], ans: 2 },
  { q: "What is the function of the small intestine?", opts: ["Store food", "Absorb nutrients", "Pump blood", "Filter air"], ans: 1 },
  { q: "What are the building blocks of proteins?", opts: ["Sugars", "Fatty acids", "Amino acids", "Nucleotides"], ans: 2 },
  { q: "What instrument measures wind speed?", opts: ["Barometer", "Thermometer", "Anemometer", "Seismograph"], ans: 2 },
  { q: "Which gas is essential for combustion?", opts: ["Nitrogen", "Hydrogen", "Oxygen", "Helium"], ans: 2 },
  { q: "What is the process of water changing from liquid to gas?", opts: ["Condensation", "Evaporation", "Sublimation", "Freezing"], ans: 1 },
  { q: "What planet is tilted on its side?", opts: ["Neptune", "Saturn", "Uranus", "Pluto"], ans: 2 },
  { q: "What type of joint is the knee?", opts: ["Ball and socket", "Pivot", "Hinge", "Gliding"], ans: 2 },
  { q: "What is an alloy?", opts: ["A pure metal", "A mixture of metals", "A type of gas", "A mineral"], ans: 1 },
  { q: "What process do yeast cells use to make bread rise?", opts: ["Photosynthesis", "Fermentation", "Respiration", "Osmosis"], ans: 1 },
  { q: "What is the densest planet in the solar system?", opts: ["Jupiter", "Mars", "Earth", "Mercury"], ans: 2 },
  { q: "What does DNA stand for?", opts: ["Deoxyribose Nuclear Acid", "Deoxyribonucleic Acid", "Dinitrogen Acid", "Dynamic Nucleic Arrangement"], ans: 1 },
  { q: "What is the main gas released by volcanoes?", opts: ["Oxygen", "Nitrogen", "Water vapour", "Helium"], ans: 2 },
  { q: "What phenomenon causes a stick to look bent in water?", opts: ["Reflection", "Refraction", "Diffraction", "Absorption"], ans: 1 },
  { q: "How many planets in our solar system have rings?", opts: ["1", "2", "4", "6"], ans: 2 },
  { q: "What vitamin helps blood clot?", opts: ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin K"], ans: 3 },
  { q: "What is the chemical symbol for iron?", opts: ["Ir", "In", "Fe", "I"], ans: 2 },
  { q: "What type of rock are fossils usually found in?", opts: ["Igneous", "Sedimentary", "Metamorphic", "Volcanic"], ans: 1 },
  { q: "What is the unit of frequency?", opts: ["Volt", "Hertz", "Ampere", "Ohm"], ans: 1 },
  { q: "What is the largest bone in the human body?", opts: ["Humerus", "Tibia", "Femur", "Spine"], ans: 2 },
  { q: "What do plants release during photosynthesis?", opts: ["Carbon dioxide", "Nitrogen", "Oxygen", "Hydrogen"], ans: 2 },
  { q: "What is the most common element in Earth's crust?", opts: ["Iron", "Silicon", "Oxygen", "Aluminium"], ans: 2 },
  { q: "What part of the eye controls how much light enters?", opts: ["Retina", "Cornea", "Iris", "Lens"], ans: 2 },
  { q: "What are the two types of electric charge?", opts: ["Hot and cold", "Positive and negative", "Strong and weak", "Up and down"], ans: 1 },
  { q: "What is the study of fossils called?", opts: ["Geology", "Palaeontology", "Archaeology", "Biology"], ans: 1 },
  { q: "What causes a lunar eclipse?", opts: ["Moon blocks Sun", "Earth blocks sunlight from Moon", "Sun goes dark", "Moon rotates"], ans: 1 },
];

function QuickPlayMatch({ onSubmit, isSubmitting, gameMode }: { onSubmit: (score: number) => void; isSubmitting: boolean; gameMode: string }) {
  const { data: apiQuestions, isError: apiError } = useQuery<any[]>({
    queryKey: ["/api/gt-questions/active"],
  });
  const [playing, setPlaying] = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [questions, setQuestions] = useState<{ q: string; opts: string[]; ans: number }[]>([]);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(gameMode === "speed-round" ? 10 : 20);
  const [finished, setFinished] = useState(false);
  const questionsInitialized = useRef(false);

  useEffect(() => {
    if (questionsInitialized.current) return;
    if (apiError) {
      setQuestions([...QUICK_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5));
      questionsInitialized.current = true;
      return;
    }
    if (apiQuestions === undefined) return;
    let pool: { q: string; opts: string[]; ans: number }[];
    if (apiQuestions.length >= 5) {
      pool = apiQuestions.map((aq: any) => ({
        q: aq.question,
        opts: aq.options as string[],
        ans: aq.correctIndex,
      }));
    } else {
      pool = QUICK_QUESTIONS;
    }
    setQuestions([...pool].sort(() => Math.random() - 0.5).slice(0, 5));
    questionsInitialized.current = true;
  }, [apiQuestions, apiError]);

  const currentQ = questions[questionIdx];

  const handleAnswer = (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
    const correct = idx === currentQ.ans;
    if (correct) {
      const basePoints = gameMode === "speed-round" ? 25 : 15;
      const comboBonus = Math.min(combo, 3) * 5;
      setScore(s => s + basePoints + comboBonus);
      setCombo(c => c + 1);
    } else {
      setCombo(0);
      if (gameMode === "survival") {
        setTimeout(() => {
          setFinished(true);
        }, 800);
        return;
      }
    }
    setTimeout(() => {
      if (questionIdx + 1 >= questions.length) {
        setFinished(true);
      } else {
        setQuestionIdx(i => i + 1);
        setAnswered(null);
        setTimeLeft(gameMode === "speed-round" ? 10 : 20);
      }
    }, 800);
  };

  if (finished) {
    return (
      <div className="space-y-3">
        <p className="text-2xl font-bold text-white">Match Complete!</p>
        <p className="text-yellow-400 text-lg">Score: {score} points</p>
        <Button
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
          onClick={() => onSubmit(score)}
          disabled={isSubmitting}
          data-testid="button-submit-score"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
          Submit Score
        </Button>
      </div>
    );
  }

  if (questions.length === 0) {
    return <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-400" />;
  }

  if (!playing) {
    return (
      <Button
        className="bg-purple-600 hover:bg-purple-700 text-white px-8"
        onClick={() => setPlaying(true)}
        data-testid="button-start-match"
      >
        <Flame className="w-4 h-4 mr-2" /> Start Match
      </Button>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Question {questionIdx + 1}/{questions.length}</span>
        <span className="text-yellow-400 font-bold">Score: {score}</span>
        {combo > 1 && <span className="text-orange-400 font-bold">x{combo} Combo!</span>}
      </div>
      <p className="text-white font-medium text-lg">{currentQ.q}</p>
      <div className="grid grid-cols-2 gap-2">
        {currentQ.opts.map((opt, idx) => (
          <Button
            key={idx}
            variant="outline"
            className={`text-left justify-start py-3 ${
              answered !== null
                ? idx === currentQ.ans
                  ? "bg-green-600/30 border-green-500 text-green-300"
                  : idx === answered
                    ? "bg-red-600/30 border-red-500 text-red-300"
                    : "border-gray-700 text-gray-500"
                : "border-gray-600 text-white hover:bg-gray-700"
            }`}
            onClick={() => handleAnswer(idx)}
            disabled={answered !== null}
            data-testid={`button-answer-${idx}`}
          >
            {opt}
          </Button>
        ))}
      </div>
    </div>
  );
}

function DistrictLeaderboard({ tournaments, districtId }: { tournaments: GrandTournamentData[]; districtId: string }) {
  const playerScores: Record<string, { username: string; totalPoints: number; totalWins: number; events: number }> = {};

  for (const t of tournaments) {
    for (const entry of (t.entries || [])) {
      if (!playerScores[entry.username]) {
        playerScores[entry.username] = { username: entry.username, totalPoints: 0, totalWins: 0, events: 0 };
      }
      playerScores[entry.username].totalPoints += entry.points;
      playerScores[entry.username].totalWins += entry.wins;
      playerScores[entry.username].events++;
    }
  }

  const sorted = Object.values(playerScores).sort((a, b) => b.totalPoints - a.totalPoints || b.totalWins - a.totalWins);
  const district = DISTRICTS.find(d => d.id === districtId);

  if (sorted.length === 0) return null;

  return (
    <Card className="bg-gray-800/60 border-gray-700 p-5">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2">
        <Crown className="w-5 h-5 text-yellow-400" /> {district?.emoji} {district?.name} District Leaderboard
      </h3>
      <div className="space-y-2">
        {sorted.slice(0, 10).map((player, idx) => (
          <div key={player.username} className="flex items-center justify-between bg-gray-900/30 rounded-lg px-3 py-2" data-testid={`row-leader-${idx}`}>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold w-8 text-center">
                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
              </span>
              <span className="text-white font-medium">{player.username}</span>
              <span className="text-gray-500 text-xs">{player.events} events</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-400">{player.totalWins}W</span>
              <span className="text-cyan-400 font-bold">{player.totalPoints} pts</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
