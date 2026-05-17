import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, Gamepad2, Swords, Search, Zap, Bot, Crown, X, ArrowLeft,
  Wifi, WifiOff, Loader2, Timer, Shield, Heart, CheckCircle, XCircle, Trophy, Coins, Sparkles,
  EyeOff, Hourglass, Eye, Tv, Flame, RotateCcw
} from "lucide-react";
import { GAME_MODES } from "@/lib/gameData";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import GamePlayer from "@/components/GamePlayer";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LobbyPlayer {
  id: number;
  username: string;
  status: "idle" | "queued" | "in_game";
}

interface ChallengeInfo {
  from: { id: number; username: string };
  gameId: string;
}

interface PvpChallengeInfo {
  from: { id: number; username: string };
  wager: number;
}

interface PvpQuestion {
  text: string;
  options: string[];
  index: number;
}

interface PvpMatch {
  roomId: string;
  opponent: { id: number; username: string };
  wager: number;
  totalQuestions: number;
  isBot?: boolean;
}

interface PvpResult {
  players: { id: number; username: string; score: number; answered: number }[];
  winnerId: number | null;
  wager: number;
  rewards: {
    winner: { xp: number; coins: number };
    loser: { xp: number; coins: number };
    draw: { xp: number; coins: number };
  };
  adminBeaterTitle?: string | null;
}

interface ActiveRoom {
  id: string;
  type: "arcade" | "pvp";
  gameId?: string;
  players: { id: number; username: string; score: number }[];
  currentQuestion?: number;
  totalQuestions?: number;
}

interface SpectateData {
  roomId: string;
  gameType: "arcade" | "pvp";
  gameId?: string;
  players: { id: number; username: string; score: number }[];
  questionIndex: number;
  totalQuestions: number;
}

type LobbyMode = "arcade" | "quiz-duel";

export default function LobbyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [myStatus, setMyStatus] = useState<"idle" | "queued" | "in_game">("idle");
  const [selectedGameId, setSelectedGameId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("game");
    return (g && GAME_MODES.find(gm => gm.id === g)) ? g : "gravity-dash";
  });
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [match, setMatch] = useState<{ roomId: string; gameId: string; opponent: { id: number; username: string }; isBot?: boolean } | null>(null);
  const [gameResults, setGameResults] = useState<{ players: { id: number; username: string; score: number }[] } | null>(null);
  const [playingGame, setPlayingGame] = useState<string | null>(null);
  const [botScore, setBotScore] = useState(0);

  const [lobbyMode, setLobbyMode] = useState<LobbyMode>("arcade");
  const [wagerAmount, setWagerAmount] = useState(0);
  const [pvpChallenge, setPvpChallenge] = useState<PvpChallengeInfo | null>(null);
  const [pvpMatch, setPvpMatch] = useState<PvpMatch | null>(null);
  const [pvpQuestion, setPvpQuestion] = useState<PvpQuestion | null>(null);
  const [pvpAnswered, setPvpAnswered] = useState(false);
  const [pvpAnswerResult, setPvpAnswerResult] = useState<{ correct: boolean; correctIndex: number; explanation: string | null; points: number; totalScore: number } | null>(null);
  const [pvpMyScore, setPvpMyScore] = useState(0);
  const [pvpOpponentAnswered, setPvpOpponentAnswered] = useState(0);
  const [pvpResult, setPvpResult] = useState<PvpResult | null>(null);
  const [pvpTimer, setPvpTimer] = useState(15);
  const pvpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pvpSelectedAnswer, setPvpSelectedAnswer] = useState<number | null>(null);

  const { data: bpData } = useQuery<{ powerups: any[]; owned: Record<string, number> }>({
    queryKey: ["/api/battle-powerups"],
  });
  const [pvpBpCounts, setPvpBpCounts] = useState<Record<string, number> | null>(null);
  const pvpBpOwned = pvpBpCounts ?? bpData?.owned ?? {};
  const [pvpActivePowerup, setPvpActivePowerup] = useState<string | null>(null);
  const [pvpShieldActive, setPvpShieldActive] = useState(false);
  const [pvpTimerFrozen, setPvpTimerFrozen] = useState(false);
  const [pvpDoubleDamage, setPvpDoubleDamage] = useState(false);
  const [pvpSabotageActive, setPvpSabotageActive] = useState(false);
  const [pvpHiddenOption, setPvpHiddenOption] = useState<number | null>(null);
  const [pvpPowerupUsedThisQ, setPvpPowerupUsedThisQ] = useState(false);

  const PVP_POWERUP_LIST = [
    { id: "bp-shield-potion", name: "Shield", icon: Shield, color: "text-blue-400" },
    { id: "bp-time-freeze", name: "Freeze", icon: Timer, color: "text-cyan-400" },
    { id: "bp-double-damage", name: "2x Pts", icon: Swords, color: "text-red-400" },
    { id: "bp-answer-sabotage", name: "Sabotage", icon: EyeOff, color: "text-orange-400" },
    { id: "bp-time-drain", name: "Time Drain", icon: Hourglass, color: "text-rose-400" },
  ];

  const usePvpPowerup = async (powerupId: string) => {
    if (pvpPowerupUsedThisQ || !pvpMatch || pvpAnswered) return;
    const count = pvpBpOwned[powerupId] || 0;
    if (count <= 0) return;
    try {
      await apiRequest("POST", "/api/battle-powerup/use", { powerupId });
      setPvpBpCounts(prev => ({ ...(prev ?? bpData?.owned ?? {}), [powerupId]: count - 1 }));
      setPvpPowerupUsedThisQ(true);
      setPvpActivePowerup(powerupId);
      if (powerupId === "bp-shield-potion") setPvpShieldActive(true);
      if (powerupId === "bp-time-freeze") setPvpTimerFrozen(true);
      if (powerupId === "bp-double-damage") setPvpDoubleDamage(true);
      if (powerupId === "bp-answer-sabotage") {
        setPvpSabotageActive(true);
        if (pvpQuestion) {
          const wrongIndices = pvpQuestion.options.map((_: any, i: number) => i).filter((i: number) => i !== pvpQuestion.correct);
          const hideIdx = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
          setPvpHiddenOption(hideIdx);
        }
      }
      if (powerupId === "bp-time-drain") {
        setPvpTimer(prev => Math.max(0, prev - 5));
      }
      toast({ title: "Powerup activated!", description: PVP_POWERUP_LIST.find(p => p.id === powerupId)?.name || "Powerup" });
    } catch {
      toast({ title: "Error", description: "Failed to use powerup", variant: "destructive" });
    }
  };

  const [spectateRooms, setSpectateRooms] = useState<ActiveRoom[]>([]);
  const [spectateData, setSpectateData] = useState<SpectateData | null>(null);
  const [showSpectatePanel, setShowSpectatePanel] = useState(false);

  const pvpTimerFrozenRef = useRef(pvpTimerFrozen);
  pvpTimerFrozenRef.current = pvpTimerFrozen;

  const startPvpTimer = useCallback(() => {
    if (pvpTimerRef.current) clearInterval(pvpTimerRef.current);
    setPvpTimer(15);
    pvpTimerRef.current = setInterval(() => {
      if (pvpTimerFrozenRef.current) return;
      setPvpTimer(prev => {
        if (prev <= 1) {
          if (pvpTimerRef.current) clearInterval(pvpTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const connect = useCallback(() => {
    if (!user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join_lobby", userId: user.id, username: user.username }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "lobby_update") {
        setPlayers(msg.players.filter((p: LobbyPlayer) => p.id !== user.id));
      }

      if (msg.type === "queued") {
        setMyStatus("queued");
      }

      if (msg.type === "match_found") {
        setMyStatus("in_game");
        setMatch(msg);
        setPlayingGame(msg.gameId);
        setBotScore(0);
      }

      if (msg.type === "bot_score_update") {
        setBotScore(msg.botScore);
      }

      if (msg.type === "challenge_received") {
        setChallenge({ from: msg.from, gameId: msg.gameId });
      }

      if (msg.type === "challenge_declined") {
        setChallenge(null);
      }

      if (msg.type === "game_results") {
        setGameResults(msg);
        setMyStatus("idle");
        setPlayingGame(null);
      }

      if (msg.type === "opponent_left") {
        setMyStatus("idle");
        setMatch(null);
        setPlayingGame(null);
      }

      if (msg.type === "pvp_challenge_received") {
        setPvpChallenge({ from: msg.from, wager: msg.wager || 0 });
      }

      if (msg.type === "pvp_challenge_declined") {
        toast({ title: "Challenge Declined", description: "Your quiz duel challenge was declined." });
      }

      if (msg.type === "pvp_queued") {
        setMyStatus("queued");
      }

      if (msg.type === "pvp_start") {
        setMyStatus("in_game");
        setPvpMatch({
          roomId: msg.roomId,
          opponent: msg.opponent,
          wager: msg.wager,
          totalQuestions: msg.totalQuestions,
          isBot: msg.isBot,
        });
        setPvpQuestion(msg.question);
        setPvpMyScore(0);
        setPvpOpponentAnswered(0);
        setPvpAnswered(false);
        setPvpAnswerResult(null);
        setPvpResult(null);
        setPvpSelectedAnswer(null);
        setPvpActivePowerup(null);
        setPvpShieldActive(false);
        setPvpTimerFrozen(false);
        setPvpDoubleDamage(false);
        setPvpSabotageActive(false);
        setPvpHiddenOption(null);
        setPvpPowerupUsedThisQ(false);
        startPvpTimer();
      }

      if (msg.type === "pvp_answer_result") {
        const result = { ...msg };
        if (pvpShieldActive && !result.correct) {
          result.shielded = true;
          result.points = 0;
        }
        if (pvpDoubleDamage && result.correct) {
          const basePoints = result.points || 0;
          result.points = basePoints * 2;
          result.totalScore = (result.totalScore || 0) + basePoints;
        }
        setPvpAnswerResult(result);
        setPvpMyScore(result.totalScore);
        setPvpAnswered(true);
        if (pvpTimerRef.current) clearInterval(pvpTimerRef.current);
      }

      if (msg.type === "pvp_opponent_progress") {
        setPvpOpponentAnswered(msg.answered);
      }

      if (msg.type === "pvp_next_question") {
        setPvpQuestion(msg.question);
        setPvpAnswered(false);
        setPvpAnswerResult(null);
        setPvpSelectedAnswer(null);
        setPvpActivePowerup(null);
        setPvpShieldActive(false);
        setPvpTimerFrozen(false);
        setPvpDoubleDamage(false);
        setPvpSabotageActive(false);
        setPvpHiddenOption(null);
        setPvpPowerupUsedThisQ(false);
        startPvpTimer();
      }

      if (msg.type === "pvp_result") {
        setPvpResult(msg);
        setMyStatus("idle");
        if (pvpTimerRef.current) clearInterval(pvpTimerRef.current);
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      }

      if (msg.type === "pvp_opponent_left") {
        toast({ title: "Opponent Left", description: "Your opponent left the quiz duel." });
        setPvpMatch(null);
        setPvpQuestion(null);
        setPvpResult(null);
        setMyStatus("idle");
        if (pvpTimerRef.current) clearInterval(pvpTimerRef.current);
      }

      if (msg.type === "pvp_error") {
        toast({ title: "Quiz Duel Error", description: msg.message, variant: "destructive" });
        setMyStatus("idle");
      }

      if (msg.type === "active_rooms") {
        setSpectateRooms(msg.rooms);
        setShowSpectatePanel(true);
      }

      if (msg.type === "spectate_snapshot") {
        setSpectateData({
          roomId: msg.roomId,
          gameType: msg.gameType,
          gameId: msg.gameId,
          players: msg.players,
          questionIndex: msg.currentQuestion ?? 0,
          totalQuestions: msg.totalQuestions ?? 10,
        });
        setShowSpectatePanel(false);
      }

      if (msg.type === "spectate_update") {
        setSpectateData(prev => prev ? { ...prev, players: msg.players, questionIndex: msg.questionIndex } : null);
      }

      if (msg.type === "spectate_ended") {
        setSpectateData(null);
        toast({ title: "Match ended", description: "The match you were watching has finished." });
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (mountedRef.current) setTimeout(connect, 3000);
    };
  }, [user, startPvpTimer, toast]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (pvpTimerRef.current) clearInterval(pvpTimerRef.current);
    };
  }, [connect]);

  const joinQueue = () => {
    wsRef.current?.send(JSON.stringify({ type: "queue", gameId: selectedGameId }));
    setMyStatus("queued");
  };

  const cancelQueue = () => {
    wsRef.current?.send(JSON.stringify({ type: "cancel_queue" }));
    setMyStatus("idle");
  };

  const challengePlayer = (targetId: number) => {
    wsRef.current?.send(JSON.stringify({ type: "challenge", targetId, gameId: selectedGameId }));
  };

  const acceptChallenge = () => {
    if (!challenge) return;
    wsRef.current?.send(JSON.stringify({
      type: "accept_challenge",
      challengerId: challenge.from.id,
      gameId: challenge.gameId,
    }));
    setChallenge(null);
  };

  const declineChallenge = () => {
    if (!challenge) return;
    wsRef.current?.send(JSON.stringify({
      type: "decline_challenge",
      challengerId: challenge.from.id,
    }));
    setChallenge(null);
  };

  const pvpChallengePlayer = (targetId: number) => {
    wsRef.current?.send(JSON.stringify({ type: "pvp_challenge", targetId, wager: wagerAmount }));
  };

  const acceptPvpChallenge = () => {
    if (!pvpChallenge) return;
    wsRef.current?.send(JSON.stringify({
      type: "pvp_accept",
      challengerId: pvpChallenge.from.id,
      wager: pvpChallenge.wager,
    }));
    setPvpChallenge(null);
  };

  const declinePvpChallenge = () => {
    if (!pvpChallenge) return;
    wsRef.current?.send(JSON.stringify({
      type: "pvp_decline",
      challengerId: pvpChallenge.from.id,
    }));
    setPvpChallenge(null);
  };

  const joinPvpQueue = () => {
    wsRef.current?.send(JSON.stringify({ type: "pvp_queue", wager: wagerAmount }));
  };

  const cancelPvpQueue = () => {
    wsRef.current?.send(JSON.stringify({ type: "pvp_cancel_queue" }));
    setMyStatus("idle");
  };

  const requestActiveRooms = () => {
    wsRef.current?.send(JSON.stringify({ type: "get_active_rooms" }));
  };

  const startSpectate = (roomId: string) => {
    wsRef.current?.send(JSON.stringify({ type: "start_spectate", roomId }));
  };

  const stopSpectate = () => {
    wsRef.current?.send(JSON.stringify({ type: "stop_spectate" }));
    setSpectateData(null);
    setShowSpectatePanel(false);
  };

  const recoverWinStreakMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/win-streak/recover");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Streak Recovered!", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Can't recover", description: err.message || "Not enough resources", variant: "destructive" });
    },
  });

  const recoverTournamentStreakMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tournament-win-streak/recover");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Streak Recovered!", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Can't recover", description: err.message || "Not enough resources", variant: "destructive" });
    },
  });

  const winStreak = (user as any)?.winStreak || 0;
  const winStreakPeak = (user as any)?.winStreakPeak || 0;
  const tournamentWinStreak = (user as any)?.tournamentWinStreak || 0;
  const tournamentWinStreakPeak = (user as any)?.tournamentWinStreakPeak || 0;
  const canRecoverWin = winStreakPeak > winStreak && winStreakPeak > 0;
  const canRecoverTournament = tournamentWinStreakPeak > tournamentWinStreak && tournamentWinStreakPeak > 0;

  const pvpAnsweredRef = useRef(pvpAnswered);
  pvpAnsweredRef.current = pvpAnswered;
  const pvpMatchRef = useRef(pvpMatch);
  pvpMatchRef.current = pvpMatch;

  useEffect(() => {
    if (pvpTimer === 0 && !pvpAnsweredRef.current && pvpMatchRef.current) {
      wsRef.current?.send(JSON.stringify({
        type: "pvp_answer",
        roomId: pvpMatchRef.current.roomId,
        answerIndex: -1,
      }));
    }
  }, [pvpTimer]);

  const submitPvpAnswer = (answerIndex: number) => {
    if (!pvpMatch || pvpAnswered) return;
    setPvpSelectedAnswer(answerIndex);
    wsRef.current?.send(JSON.stringify({
      type: "pvp_answer",
      roomId: pvpMatch.roomId,
      answerIndex,
    }));
  };

  const leavePvpMatch = () => {
    if (pvpMatch) {
      wsRef.current?.send(JSON.stringify({ type: "pvp_leave", roomId: pvpMatch.roomId }));
    }
    setPvpMatch(null);
    setPvpQuestion(null);
    setPvpResult(null);
    setMyStatus("idle");
    if (pvpTimerRef.current) clearInterval(pvpTimerRef.current);
  };

  const submitScore = async (score: number, won: boolean) => {
    if (match) {
      wsRef.current?.send(JSON.stringify({
        type: "game_score",
        roomId: match.roomId,
        score,
      }));
    }

    try {
      const gemUpgradesDisabled = localStorage.getItem("cosmetic-gem-upgrades") === "false";
      await apiRequest("POST", "/api/game/result", {
        gameId: match?.gameId ?? selectedGameId,
        score,
        won,
        gemUpgradesDisabled,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    } catch {}
  };

  if (spectateData) {
    return (
      <div className="min-h-screen max-w-2xl mx-auto px-4 py-8">
        <Card className="p-4 mb-4 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-sm">Spectating</span>
            <Badge variant="secondary" className="text-xs">
              {spectateData.gameType === "pvp" ? "Quiz Duel" : "Arcade"}
            </Badge>
            {spectateData.gameType === "pvp" && (
              <Badge variant="outline" className="text-xs gap-1">
                <Timer className="w-3 h-3" /> Q{spectateData.questionIndex}/{spectateData.totalQuestions}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={stopSpectate} data-testid="button-stop-spectate">
            <X className="w-4 h-4 mr-1" /> Leave
          </Button>
        </Card>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {spectateData.players.filter(p => p.id > 0).map((player, idx) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="p-4 text-center border-border" data-testid={`card-spectate-player-${player.id}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold text-sm">{player.username.charAt(0).toUpperCase()}</span>
                </div>
                <p className="font-semibold text-sm mb-1 truncate" data-testid={`text-spectate-username-${player.id}`}>{player.username}</p>
                <p className="text-2xl font-black text-purple-400" data-testid={`text-spectate-score-${player.id}`}>{player.score}</p>
                <p className="text-xs text-muted-foreground">points</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {spectateData.gameType === "pvp" && (
          <Card className="p-4 text-center border-border">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Progress</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(spectateData.questionIndex / spectateData.totalQuestions) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Question {spectateData.questionIndex} of {spectateData.totalQuestions}
            </p>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          You are spectating — scores update live after each question
        </p>
      </div>
    );
  }

  if (showSpectatePanel) {
    return (
      <div className="min-h-screen max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setShowSpectatePanel(false)} data-testid="button-back-spectate">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h2 className="font-bold text-lg">Watch a Match</h2>
        </div>

        {spectateRooms.length === 0 ? (
          <Card className="p-8 text-center border-border">
            <Tv className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold mb-1">No active matches</p>
            <p className="text-sm text-muted-foreground">Check back when players are competing.</p>
            <Button className="mt-4" variant="outline" onClick={() => setShowSpectatePanel(false)} data-testid="button-spectate-back">
              Return to Lobby
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {spectateRooms.map(room => (
              <Card key={room.id} className="p-4 border-border" data-testid={`card-spectate-room-${room.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={room.type === "pvp" ? "default" : "secondary"} className="text-xs">
                        {room.type === "pvp" ? "Quiz Duel" : "Arcade"}
                      </Badge>
                      {room.type === "pvp" && room.currentQuestion !== undefined && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Timer className="w-3 h-3" /> Q{room.currentQuestion}/{room.totalQuestions}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {room.players.filter(p => p.id > 0).map((p, i) => (
                        <span key={p.id} className="text-sm">
                          {i > 0 && <span className="text-muted-foreground mx-1">vs</span>}
                          <span className="font-semibold">{p.username}</span>
                          <span className="text-muted-foreground ml-1">({p.score})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => startSpectate(room.id)}
                    className="ml-3 gap-1"
                    data-testid={`button-watch-room-${room.id}`}
                  >
                    <Eye className="w-3 h-3" /> Watch
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (pvpMatch && pvpQuestion && !pvpResult) {
    return (
      <div className="min-h-screen max-w-2xl mx-auto px-4 py-4">
        <Card className="p-3 mb-4 flex items-center justify-between gap-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20">
          <div className="flex items-center gap-2 flex-wrap">
            <Swords className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-sm" data-testid="text-pvp-opponent">VS {pvpMatch.opponent.username}</span>
            {pvpMatch.isBot && <Badge variant="secondary" className="text-xs"><Bot className="w-3 h-3 mr-1" /> Bot</Badge>}
            {pvpMatch.wager > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Coins className="w-3 h-3" /> {pvpMatch.wager} wager
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={leavePvpMatch} data-testid="button-leave-pvp">
            <X className="w-4 h-4" />
          </Button>
        </Card>

        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <Badge variant="outline" className="font-bold gap-1">
            Q {pvpQuestion.index + 1}/10
          </Badge>
          <Badge variant={pvpTimer <= 5 ? "destructive" : "outline"} className="font-bold gap-1" data-testid="badge-pvp-timer">
            <Timer className="w-3 h-3" /> {pvpTimer}s
          </Badge>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">You: <strong data-testid="text-pvp-my-score">{pvpMyScore}</strong></span>
            <span className="text-xs text-muted-foreground">Opp: <strong data-testid="text-pvp-opponent-answered">{pvpOpponentAnswered}/10</strong></span>
          </div>
        </div>

        {Object.values(pvpBpOwned).some(c => c > 0) && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {PVP_POWERUP_LIST.map(bp => {
              const count = pvpBpOwned[bp.id] || 0;
              const isActive = pvpActivePowerup === bp.id;
              const BpIcon = bp.icon;
              return (
                <Button
                  key={bp.id}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className={`gap-1 text-xs font-bold ${isActive ? "bg-purple-500/30 border-purple-500" : ""}`}
                  disabled={count <= 0 || pvpPowerupUsedThisQ || pvpAnswered || pvpTimer === 0}
                  onClick={() => usePvpPowerup(bp.id)}
                  data-testid={`button-pvp-powerup-${bp.id}`}
                >
                  <BpIcon className={`w-3.5 h-3.5 ${bp.color}`} />
                  {bp.name}
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{count}</Badge>
                </Button>
              );
            })}
            {pvpActivePowerup && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1 text-[10px] animate-pulse">
                <Sparkles className="w-3 h-3" /> {PVP_POWERUP_LIST.find(p => p.id === pvpActivePowerup)?.name} Active
              </Badge>
            )}
          </div>
        )}

        <Card className="p-5 mb-4 border-border">
          <h3 className="font-bold text-lg mb-4" data-testid="text-pvp-question">{pvpQuestion.text}</h3>

          <div className="space-y-2">
            {pvpQuestion.options.map((option, idx) => {
              let variant: "outline" | "default" | "destructive" = "outline";
              let extraClass = "";

              if (pvpAnswerResult) {
                if (idx === pvpAnswerResult.correctIndex) {
                  extraClass = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                } else if (idx === pvpSelectedAnswer && !pvpAnswerResult.correct) {
                  if ((pvpAnswerResult as any).shielded) {
                    extraClass = "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400";
                  } else {
                    extraClass = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                  }
                }
              } else if (idx === pvpSelectedAnswer) {
                extraClass = "border-purple-500 bg-purple-500/10";
              }

              if (pvpSabotageActive && pvpHiddenOption === idx && !pvpAnswerResult) {
                return (
                  <button
                    key={idx}
                    className="w-full text-left p-3 rounded-md border font-medium text-sm opacity-30 line-through pointer-events-none border-orange-500/30 bg-orange-500/5"
                    disabled
                    data-testid={`button-pvp-option-${idx}`}
                  >
                    <EyeOff className="w-4 h-4 inline mr-2 text-orange-400" />{option}
                  </button>
                );
              }

              return (
                <button
                  key={idx}
                  className={`w-full text-left p-3 rounded-md border font-medium text-sm transition-colors ${extraClass || "hover-elevate"}`}
                  onClick={() => submitPvpAnswer(idx)}
                  disabled={pvpAnswered || pvpTimer === 0}
                  data-testid={`button-pvp-answer-${idx}`}
                >
                  <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                  {option}
                </button>
              );
            })}
          </div>

          {pvpAnswerResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2"
            >
              {pvpAnswerResult.correct ? (
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 gap-1">
                  <CheckCircle className="w-3 h-3" /> Correct! +{pvpAnswerResult.points} pts
                  {pvpDoubleDamage && " (2x!)"}
                </Badge>
              ) : (pvpAnswerResult as any).shielded ? (
                <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 gap-1">
                  <Shield className="w-3 h-3" /> Shielded! No penalty
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="w-3 h-3" /> Wrong
                </Badge>
              )}
              {pvpAnswerResult.explanation && (
                <span className="text-xs text-muted-foreground">{pvpAnswerResult.explanation}</span>
              )}
            </motion.div>
          )}

          {pvpTimer === 0 && !pvpAnswered && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
              <Badge variant="destructive" className="gap-1">
                <Timer className="w-3 h-3" /> Time's up!
              </Badge>
            </motion.div>
          )}
        </Card>

        <div className="flex justify-center gap-6">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Your Score</p>
            <p className="text-2xl font-black" data-testid="text-pvp-score-display">{pvpMyScore}</p>
          </div>
        </div>
      </div>
    );
  }

  if (pvpResult) {
    const myResult = pvpResult.players.find(p => p.id === user?.id);
    const opponentResult = pvpResult.players.find(p => p.id !== user?.id);
    const won = pvpResult.winnerId === user?.id;
    const isDraw = pvpResult.winnerId === null;

    return (
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="p-8 max-w-md mx-auto text-center border-border">
            {won ? <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" /> :
             isDraw ? <Swords className="w-16 h-16 text-orange-500 mx-auto mb-4" /> :
             <Swords className="w-16 h-16 text-blue-500 mx-auto mb-4" />}
            <h2 className="text-2xl font-black mb-2" data-testid="text-pvp-result-title">
              {won ? "You Won!" : isDraw ? "It's a Draw!" : "Good Fight!"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Quiz Duel Complete</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {pvpResult.players.map((p) => (
                <div key={p.id} className={`p-4 rounded-md ${p.id === user?.id ? "bg-purple-500/10 border border-purple-500/30" : "bg-muted"}`}>
                  <p className="font-bold text-sm" data-testid={`text-pvp-result-name-${p.id}`}>{p.username}</p>
                  <p className="text-3xl font-black" data-testid={`text-pvp-result-score-${p.id}`}>{p.score}</p>
                  <p className="text-xs text-muted-foreground">{p.answered}/10 answered</p>
                </div>
              ))}
            </div>

            <Card className="p-3 mb-6 bg-muted/50 border-border">
              <p className="text-xs font-bold mb-1">Rewards</p>
              {won && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <span className="text-green-600 dark:text-green-400 font-bold">+{pvpResult.rewards.winner.xp} XP</span>
                  <span className="text-yellow-600 dark:text-yellow-400 font-bold">+{pvpResult.rewards.winner.coins} coins</span>
                </div>
              )}
              {!won && !isDraw && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <span className="text-green-600 dark:text-green-400 font-bold">+{pvpResult.rewards.loser.xp} XP</span>
                  {pvpResult.wager > 0 && <span className="text-red-600 dark:text-red-400 font-bold">{pvpResult.rewards.loser.coins} coins</span>}
                </div>
              )}
              {isDraw && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <span className="text-green-600 dark:text-green-400 font-bold">+{pvpResult.rewards.draw.xp} XP</span>
                </div>
              )}
            </Card>

            {won && (user as any)?.winStreak > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center mb-4"
                data-testid="card-win-streak"
              >
                <div className="flex items-center justify-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="font-black text-orange-600 dark:text-orange-400">
                    {(user as any)?.winStreak} Win Streak!
                  </span>
                </div>
              </motion.div>
            )}

            {pvpResult.adminBeaterTitle && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center"
                data-testid="card-admin-beater-title"
              >
                <Crown className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                <p className="font-bold text-sm text-amber-600 dark:text-amber-400">New Title Unlocked!</p>
                <p className="text-base font-black mt-1">⚔️ {pvpResult.adminBeaterTitle}</p>
                <p className="text-xs text-muted-foreground mt-1">Equip it from your shop under Titles</p>
              </motion.div>
            )}

            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={() => { setPvpResult(null); setPvpMatch(null); }} className="font-bold gap-2" data-testid="button-pvp-back-lobby">
                <ArrowLeft className="w-4 h-4" /> Back to Lobby
              </Button>
              <Button variant="outline" onClick={requestActiveRooms} className="gap-2" data-testid="button-watch-match-pvp">
                <Eye className="w-4 h-4" /> Watch a Match
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (playingGame && match && !gameResults) {
    const game = GAME_MODES.find((g) => g.id === playingGame);
    if (game) {
      return (
        <div className="min-h-screen">
          <div className="max-w-4xl mx-auto px-4 py-2">
            <Card className="p-3 mb-4 flex items-center justify-between gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
              <div className="flex items-center gap-2 flex-wrap">
                <Swords className="w-5 h-5 text-purple-500" />
                <span className="font-bold text-sm">VS {match.opponent.username}</span>
                {match.isBot && <Badge variant="secondary" className="text-xs"><Bot className="w-3 h-3 mr-1" /> Bot</Badge>}
              </div>
              {match.isBot && (
                <Badge variant="outline" className="font-bold text-sm gap-1.5">
                  <Bot className="w-4 h-4 text-orange-500" /> {botScore} pts
                </Badge>
              )}
            </Card>
          </div>
          <GamePlayer
            game={game}
            onBack={() => {
              wsRef.current?.send(JSON.stringify({ type: "leave_room", roomId: match.roomId }));
              setMatch(null);
              setPlayingGame(null);
              setMyStatus("idle");
            }}
            onComplete={(score, won) => submitScore(score, won)}
            yearLevel={(user as any)?.yearLevel || 7}
            skipRewardSubmit
          />
        </div>
      );
    }
  }

  if (gameResults) {
    const myResult = gameResults.players.find((p) => p.id === user?.id);
    const opponentResult = gameResults.players.find((p) => p.id !== user?.id);
    const won = myResult && opponentResult ? myResult.score > opponentResult.score : false;

    return (
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="p-8 max-w-md mx-auto text-center border-border">
            {won ? <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" /> : <Swords className="w-16 h-16 text-blue-500 mx-auto mb-4" />}
            <h2 className="text-2xl font-black mb-6">{won ? "You Won!" : "Good Fight!"}</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {gameResults.players.map((p) => (
                <div key={p.id} className={`p-4 rounded-md ${p.id === user?.id ? "bg-purple-500/10 border border-purple-500/30" : "bg-muted"}`}>
                  <p className="font-bold text-sm">{p.username}</p>
                  <p className="text-3xl font-black">{p.score}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={() => { setGameResults(null); setMatch(null); }} className="font-bold gap-2" data-testid="button-back-lobby">
                <ArrowLeft className="w-4 h-4" /> Back to Lobby
              </Button>
              <Button variant="outline" onClick={requestActiveRooms} className="gap-2" data-testid="button-watch-match-arcade">
                <Eye className="w-4 h-4" /> Watch a Match
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-3xl font-black flex items-center gap-3">
          <Users className="w-8 h-8 text-purple-500" /> Multiplayer Lobby
        </h1>
        <Badge variant={connected ? "default" : "destructive"} className="font-bold">
          {connected ? <><Wifi className="w-3 h-3 mr-1" /> Online</> : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
        </Badge>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={lobbyMode === "arcade" ? "default" : "outline"}
          onClick={() => setLobbyMode("arcade")}
          className="font-bold gap-2"
          data-testid="button-mode-arcade"
        >
          <Gamepad2 className="w-4 h-4" /> Arcade
        </Button>
        <Button
          variant={lobbyMode === "quiz-duel" ? "default" : "outline"}
          onClick={() => setLobbyMode("quiz-duel")}
          className="font-bold gap-2"
          data-testid="button-mode-quiz-duel"
        >
          <Swords className="w-4 h-4" /> Quiz Duel
        </Button>
      </div>

      {(winStreak > 0 || canRecoverWin || tournamentWinStreak > 0 || canRecoverTournament) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Card className={`p-4 border-orange-500/20 bg-orange-500/5`} data-testid="card-pvp-win-streak">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">PvP Win Streak</p>
                  <p className="font-black text-orange-600 dark:text-orange-400 text-lg leading-none">
                    {winStreak} <span className="text-xs font-semibold text-muted-foreground">/ peak {winStreakPeak}</span>
                  </p>
                </div>
              </div>
              {canRecoverWin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="font-bold gap-1 text-orange-600 border-orange-500/30 hover:bg-orange-500/10 text-xs"
                  disabled={recoverWinStreakMutation.isPending}
                  onClick={() => recoverWinStreakMutation.mutate()}
                  data-testid="button-recover-win-streak"
                >
                  {recoverWinStreakMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Recover ({winStreakPeak * 50} coins{Math.floor(winStreakPeak / 10) > 0 ? ` + ${Math.floor(winStreakPeak / 10)} gems` : ""})
                </Button>
              )}
            </div>
          </Card>
          <Card className={`p-4 border-yellow-500/20 bg-yellow-500/5`} data-testid="card-tournament-win-streak">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Tournament Win Streak</p>
                  <p className="font-black text-yellow-600 dark:text-yellow-400 text-lg leading-none">
                    {tournamentWinStreak} <span className="text-xs font-semibold text-muted-foreground">/ peak {tournamentWinStreakPeak}</span>
                  </p>
                </div>
              </div>
              {canRecoverTournament && (
                <Button
                  size="sm"
                  variant="outline"
                  className="font-bold gap-1 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/10 text-xs"
                  disabled={recoverTournamentStreakMutation.isPending}
                  onClick={() => recoverTournamentStreakMutation.mutate()}
                  data-testid="button-recover-tournament-streak"
                >
                  {recoverTournamentStreakMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Recover ({tournamentWinStreakPeak * 150} coins{Math.floor(tournamentWinStreakPeak / 5) > 0 ? ` + ${Math.floor(tournamentWinStreakPeak / 5)} gems` : ""})
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {challenge && lobbyMode === "arcade" && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 mb-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-yellow-500" />
                <span className="font-bold">{challenge.from.username} challenges you!</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={acceptChallenge} className="font-bold gap-1" data-testid="button-accept-challenge">
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={declineChallenge} data-testid="button-decline-challenge">
                  Decline
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {pvpChallenge && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 mb-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Swords className="w-5 h-5 text-orange-500" />
                <span className="font-bold">{pvpChallenge.from.username} challenges you to a Quiz Duel!</span>
                {pvpChallenge.wager > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Coins className="w-3 h-3" /> {pvpChallenge.wager} coin wager
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={acceptPvpChallenge} className="font-bold gap-1" data-testid="button-accept-pvp-challenge">
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={declinePvpChallenge} data-testid="button-decline-pvp-challenge">
                  Decline
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          {lobbyMode === "arcade" ? (
            <Card className="p-5 border-border">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" /> Select Game
              </h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {GAME_MODES.filter((g) => !g.isSecret).map((game) => (
                  <button
                    key={game.id}
                    className={`w-full text-left p-2 rounded-md text-sm font-medium transition-colors ${
                      selectedGameId === game.id ? "bg-purple-500/20 text-purple-500" : "hover-elevate"
                    }`}
                    onClick={() => setSelectedGameId(game.id)}
                    data-testid={`select-game-${game.id}`}
                  >
                    {game.name}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                {myStatus === "idle" && (
                  <Button onClick={joinQueue} className="w-full font-bold gap-2" data-testid="button-find-match">
                    <Search className="w-4 h-4" /> Find Match
                  </Button>
                )}
                {myStatus === "queued" && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-bold">Searching...</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Bot fills in after 5 seconds</p>
                    <Button variant="outline" onClick={cancelQueue} className="font-bold text-sm" data-testid="button-cancel-queue">
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-5 border-border">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4" /> Quiz Duel
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Answer 10 community questions head-to-head. Earn points for correct answers, bonus for speed!
              </p>

              <div className="mb-4">
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Coin Wager (optional)</label>
                <Input
                  type="number"
                  min={0}
                  max={user?.coins || 0}
                  value={wagerAmount}
                  onChange={(e) => setWagerAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  data-testid="input-wager"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your coins: {user?.coins || 0}
                </p>
              </div>

              <div className="space-y-2">
                {myStatus === "idle" && (
                  <Button onClick={joinPvpQueue} className="w-full font-bold gap-2" data-testid="button-find-duel">
                    <Search className="w-4 h-4" /> Find Duel
                  </Button>
                )}
                {myStatus === "queued" && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-bold">Searching for opponent...</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">SciBot joins after 10 seconds</p>
                    <Button variant="outline" onClick={cancelPvpQueue} className="font-bold text-sm" data-testid="button-cancel-pvp-queue">
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-xs font-bold mb-2">How it works</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>10 questions from community packs</li>
                  <li>15s per question</li>
                  <li>+1 pt correct, +0.5 bonus if under 5s</li>
                  <li>Winner: 100 XP + 50 coins (+ wager)</li>
                </ul>
              </div>
            </Card>
          )}
        </div>

        <div className="md:col-span-2">
          <Card className="p-5 border-border">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Online Players ({players.length})
            </h3>

            {players.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No other players online right now</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {lobbyMode === "arcade"
                    ? 'Use "Find Match" to play against a bot!'
                    : 'Use "Find Duel" to play against SciBot!'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between gap-2 p-3 bg-muted rounded-md flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                        {player.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{player.username}</p>
                        <Badge variant={player.status === "idle" ? "default" : "secondary"} className="text-[10px]">
                          {player.status === "idle" ? "Available" : player.status === "queued" ? "Searching" : "In Game"}
                        </Badge>
                      </div>
                    </div>
                    {player.status === "idle" && (
                      <div className="flex gap-2">
                        {lobbyMode === "arcade" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="font-bold gap-1"
                            onClick={() => challengePlayer(player.id)}
                            data-testid={`button-challenge-${player.id}`}
                          >
                            <Gamepad2 className="w-3 h-3" /> Challenge
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="font-bold gap-1"
                            onClick={() => pvpChallengePlayer(player.id)}
                            data-testid={`button-pvp-challenge-${player.id}`}
                          >
                            <Swords className="w-3 h-3" /> Quiz Duel
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
