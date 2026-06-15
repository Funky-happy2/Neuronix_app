import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Star, Zap, Trophy, Heart, Timer, Play, RotateCcw,
  CheckCircle, XCircle, ArrowRight, Sparkles, X, Coins, Award, TrendingUp
} from "lucide-react";
import type { GameMode } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MATCHING_THEMES, SORTING_THEMES, RUNNER_THEMES, MEMORY_THEMES,
  WORD_SCRAMBLE_THEMES, REACTION_TAP_THEMES, CLICKER_THEMES,
  CATCH_FALLING_THEMES, DEFENSE_THEMES, SLIDER_MATCH_THEMES,
  LAUNCHER_THEMES, MAZE_THEMES, GRAVITY_MAZE_THEMES,
} from "@/lib/worldGameThemes";
import { WORLDS } from "@/lib/gameData";
import { getQuizExplanation } from "@/lib/quizExplanations";

interface GameRewards {
  xp: number;
  coins: number;
  dailyBonus: { xp: number; coins: number } | null;
  badgesEarned: string[];
  itemsAwarded: string[];
  activeUpgrades: string[];
}

interface GamePlayerProps {
  game: GameMode;
  onBack: () => void;
  onComplete: (score: number, won: boolean, difficulty: string) => void;
  yearLevel?: number;
  autoStart?: boolean;
  skipRewardSubmit?: boolean;
  isChallenge?: boolean;
  forcedDifficulty?: 'easy' | 'medium' | 'hard';
  onScoreChange?: (score: number) => void;
  gravityModifier?: string;
  autoLoop?: boolean;
}

export default function GamePlayer({ game, onBack, onComplete, yearLevel = 7, autoStart = false, skipRewardSubmit = false, isChallenge = false, forcedDifficulty, onScoreChange, gravityModifier, autoLoop = false }: GamePlayerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const gemUpgradesEnabled = localStorage.getItem("cosmetic-gem-upgrades") !== "false";
  const prevHighScore = useRef<number>(((user as any)?.gameScores as Record<string, number>)?.[game.id] || 0);
  const upgradeUses = (user as any)?.upgradeExpirations as Record<string, number> | undefined;
  const isUpActive = (id: string) => {
    if (!user?.inventory?.includes(id)) return false;
    return (upgradeUses?.[id] || 0) > 0;
  };
  const hasExtraTime = gemUpgradesEnabled && isUpActive("upgrade-extra-time");
  const hasLuckyAnswer = user?.inventory?.includes("powerup-lucky-answer") ?? false;
  const hasScienceScanner = user?.inventory?.includes("powerup-science-scanner") ?? false;
  const luckyAnswerLevel = hasLuckyAnswer ? (((user as any)?.itemLevels || {})["powerup-lucky-answer"] || 0) : 0;
  const [phase, setPhase] = useState<"intro" | "playing" | "result">(autoStart || forcedDifficulty ? "playing" : "intro");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(forcedDifficulty ?? 'medium');
  const [rewards, setRewards] = useState<GameRewards | null>(null);
  const [highScores, setHighScores] = useState<{ overall: number; easy: number; medium: number; hard: number } | null>(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const rewardsSubmittedRef = useRef(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("neuronix-game-music", {
      detail: { id: game.id, category: game.category },
    }));
    return () => {
      window.dispatchEvent(new CustomEvent("neuronix-game-music", { detail: null }));
    };
  }, [game.id, game.category]);

  // Broadcast live score to any stream viewers (no-op when not streaming).
  useEffect(() => { onScoreChange?.(score); }, [score, onScoreChange]);

  // Live-stream mode: auto-restart after death so the broadcast never freezes.
  useEffect(() => {
    if (phase === "result" && autoLoop) {
      const t = setTimeout(() => {
        setScore(0);
        setGameOver(false);
        setRewards(null);
        rewardsSubmittedRef.current = false;
        setPhase("playing");
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [phase, autoLoop]);

  // Global anti-autoclicker watchdog — runs across every mini-game while playing.
  // Inhumanly fast + perfectly uniform input patterns trigger an account suspension.
  const autoFlaggedRef = useRef(false);
  useEffect(() => {
    if (phase !== "playing" || !user) return;
    const stamps: number[] = [];
    const onInput = () => {
      const now = Date.now();
      stamps.push(now);
      if (stamps.length > 40) stamps.shift();
      if (autoFlaggedRef.current || stamps.length < 16) return;
      const recent = stamps.slice(-16);
      const intervals = recent.slice(1).map((t, i) => t - recent[i]);
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const stdDev = Math.sqrt(intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / intervals.length);
      // Humans vary; bots are fast AND metronome-uniform.
      if (mean < 95 && stdDev < 22) {
        autoFlaggedRef.current = true;
        apiRequest("POST", "/api/report/suspicious", {
          reason: "autoclicker_detected",
          details: `${game.id}: mean interval ${Math.round(mean)}ms, stdDev ${Math.round(stdDev)}ms over 16 inputs`,
        }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/user"] })).catch(() => {});
        toast({
          title: "Suspicious activity detected",
          description: "Automated clicking was detected. Your account has been suspended for review.",
          variant: "destructive",
        });
        handleGameEnd(0);
      }
    };
    window.addEventListener("pointerdown", onInput);
    window.addEventListener("keydown", onInput);
    return () => {
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
    };
  }, [phase, user, game.id, toast]);

  const submitGameResult = useCallback((finalScore: number, won: boolean, diff: string) => {
    if (rewardsSubmittedRef.current) return;
    rewardsSubmittedRef.current = true;
    setRewardsLoading(true);
    apiRequest("POST", "/api/game/result", {
      gameId: game.id,
      score: finalScore,
      won,
      difficulty: diff,
      gemUpgradesDisabled: !gemUpgradesEnabled,
      isChallenge,
    }).then(async (res) => {
      const data = await res.json();
      setRewards(data.rewards);
      if (data.highScores) setHighScores(data.highScores);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const r = data.rewards;
      if (r) {
        const parts = [];
        if (r.xp) parts.push(`+${r.xp} XP`);
        if (r.coins) parts.push(`+${r.coins} Neuros`);
        if (r.dailyBonus) parts.push(`Daily Bonus: +${r.dailyBonus.xp} XP, +${r.dailyBonus.coins} Neuros`);
        if (r.badgesEarned?.length > 0) parts.push(`${r.badgesEarned.length} badge${r.badgesEarned.length > 1 ? 's' : ''} earned!`);
        toast({
          title: won ? "Awesome Job!" : "Good Try!",
          description: parts.join(" | "),
        });
      }
    }).catch(() => {}).finally(() => setRewardsLoading(false));
  }, [game.id, gemUpgradesEnabled, toast, isChallenge]);

  const handleGameEnd = useCallback((finalScore?: number) => {
    if (typeof finalScore === 'number') {
      setScore(finalScore);
    }
    setPhase("result");
    setGameOver(true);
  }, []);

  useEffect(() => {
    if (phase === "result" && !skipRewardSubmit && !rewardsSubmittedRef.current) {
      const won = score >= 100;
      submitGameResult(score, won, difficulty);
    }
  }, [phase, score, difficulty, skipRewardSubmit, submitGameResult]);

  const worldInfo = game.world ? WORLDS.find(w => w.id === game.world) : null;

  const WORLD_EMOJIS: Record<string, string> = {
    "ocean-depths": "🌊", "volcanic-core": "🌋", "frozen-tundra": "❄️",
    "jungle-canopy": "🌿", "space-station": "🚀", "crystal-caverns": "💎",
    "storm-citadel": "⛈️", "cyber-grid": "🤖", "dino-valley": "🦕", "quantum-realm": "⚛️",
  };

  const WORLD_FLAVOR: Record<string, string> = {
    "ocean-depths": "Dive deep into the abyss...",
    "volcanic-core": "Feel the heat of the Earth's core...",
    "frozen-tundra": "Brave the freezing winds...",
    "jungle-canopy": "Navigate the living canopy...",
    "space-station": "Explore the cosmos...",
    "crystal-caverns": "Discover hidden minerals...",
    "storm-citadel": "Harness the lightning...",
    "cyber-grid": "Enter the digital frontier...",
    "dino-valley": "Walk among ancient giants...",
    "quantum-realm": "Bend the laws of physics...",
  };

  if (phase === "intro") {
    const isWorldGame = !!worldInfo;
    const worldEmoji = game.world ? WORLD_EMOJIS[game.world] || "🌍" : "";
    const worldFlavor = game.world ? WORLD_FLAVOR[game.world] || "" : "";

    return (
      <div className={`min-h-screen ${isWorldGame ? '' : 'max-w-4xl mx-auto'} px-4 py-8`}>
        <Button variant="ghost" onClick={onBack} className="gap-2 mb-4 font-semibold text-white/90 hover:text-white hover:bg-white/10" data-testid="button-back">
          <ArrowLeft className="w-4 h-4" /> {isWorldGame ? worldInfo.name : "Back"}
        </Button>

        {isWorldGame ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="text-6xl mb-3"
              >
                {worldEmoji}
              </motion.div>
              <p className="text-white/60 italic text-sm">{worldFlavor}</p>
            </div>

            <Card className={`p-8 bg-black/30 backdrop-blur-md text-white border border-white/10 shadow-2xl max-w-2xl mx-auto`}>
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/20 text-xs font-bold">
                  {worldInfo.name}
                </Badge>
                <Badge variant="secondary" className="bg-white/10 text-white/80 border-white/10 text-xs">
                  {game.category}
                </Badge>
              </div>

              <h1 className="text-3xl font-black mb-2" data-testid="text-game-title">{game.name}</h1>
              <p className="text-white/80 mb-5 leading-relaxed">{game.description}</p>

              <div className="bg-white/5 rounded-xl p-4 mb-5 border border-white/10">
                <h3 className="font-bold mb-2 text-sm uppercase tracking-wider text-white/60">How to Play</h3>
                <p className="text-white/70 text-sm leading-relaxed">{game.howToPlay}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-white/50 text-xs mb-1">Scoring</p>
                  <p className="text-white/90 font-medium">{game.scoring}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-white/50 text-xs mb-1">Science</p>
                  <p className="text-white/90 font-medium">{game.scienceConcept?.split(",")[0] || game.category}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold mb-3 text-xs uppercase tracking-wider text-white/50">Difficulty</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className={`font-bold border-2 transition-all capitalize flex-1 ${difficulty === 'easy' ? 'bg-green-500 text-white border-green-400 shadow-lg scale-105' : 'bg-green-500/20 text-green-100 border-green-400/40 hover:bg-green-500/40'}`}
                    onClick={() => setDifficulty('easy')}
                    data-testid="button-difficulty-easy"
                  >
                    Easy
                  </Button>
                  <Button
                    variant="outline"
                    className={`font-bold border-2 transition-all capitalize flex-1 ${difficulty === 'medium' ? 'bg-amber-500 text-white border-amber-400 shadow-lg scale-105' : 'bg-amber-500/20 text-amber-100 border-amber-400/40 hover:bg-amber-500/40'}`}
                    onClick={() => setDifficulty('medium')}
                    data-testid="button-difficulty-medium"
                  >
                    Medium
                  </Button>
                  <Button
                    variant="outline"
                    className={`font-bold border-2 transition-all capitalize flex-1 ${difficulty === 'hard' ? 'bg-red-500 text-white border-red-400 shadow-lg scale-105' : 'bg-red-500/20 text-red-100 border-red-400/40 hover:bg-red-500/40'}`}
                    onClick={() => setDifficulty('hard')}
                    data-testid="button-difficulty-hard"
                  >
                    Hard
                  </Button>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full gap-2 font-bold bg-white text-gray-900 hover:bg-white/90 text-lg h-14 shadow-lg"
                onClick={() => setPhase("playing")}
                data-testid="button-start-game"
              >
                <Play className="w-6 h-6" /> Enter {game.name}
              </Button>
            </Card>
          </motion.div>
        ) : (
          <Card className={`p-8 bg-gradient-to-br ${game.gradient} text-white border-0`}>
            <Badge variant="secondary" className="mb-3 bg-white/20 text-white border-white/20 text-xs font-bold">
              {game.category}
            </Badge>
            <h1 className="text-3xl font-black mb-3" data-testid="text-game-title">{game.name}</h1>
            <p className="text-white/90 mb-4">{game.description}</p>
            <div className="bg-white/10 rounded-lg p-4 mb-6">
              <h3 className="font-bold mb-2">How to Play:</h3>
              <p className="text-white/80 text-sm">{game.howToPlay}</p>
            </div>
            <div className="mb-6">
              <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-white/70">Select Difficulty:</h3>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className={`font-bold border-2 transition-all ${difficulty === 'easy' ? 'bg-green-500 text-white border-green-400 shadow-lg scale-105' : 'bg-green-500/20 text-green-100 border-green-400/40 hover:bg-green-500/40'}`}
                  onClick={() => setDifficulty('easy')}
                  data-testid="button-difficulty-easy"
                >
                  Easy
                </Button>
                <Button
                  variant="outline"
                  className={`font-bold border-2 transition-all ${difficulty === 'medium' ? 'bg-amber-500 text-white border-amber-400 shadow-lg scale-105' : 'bg-amber-500/20 text-amber-100 border-amber-400/40 hover:bg-amber-500/40'}`}
                  onClick={() => setDifficulty('medium')}
                  data-testid="button-difficulty-medium"
                >
                  Medium
                </Button>
                <Button
                  variant="outline"
                  className={`font-bold border-2 transition-all ${difficulty === 'hard' ? 'bg-red-500 text-white border-red-400 shadow-lg scale-105' : 'bg-red-500/20 text-red-100 border-red-400/40 hover:bg-red-500/40'}`}
                  onClick={() => setDifficulty('hard')}
                  data-testid="button-difficulty-hard"
                >
                  Hard
                </Button>
              </div>
            </div>
            <Button
              size="lg"
              className="gap-2 font-bold bg-white text-gray-900 hover:bg-white/90"
              onClick={() => setPhase("playing")}
              data-testid="button-start-game"
            >
              <Play className="w-5 h-5" /> Start Game
            </Button>
          </Card>
        )}
      </div>
    );
  }

  if (phase === "result") {
    const won = score >= 100;
    const isNewHighScore = score > prevHighScore.current;
    const oldBest = prevHighScore.current;
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <Card className="p-8 max-w-md mx-auto border-border">
            {isNewHighScore ? (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
              >
                <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-2" />
                <Badge className="mb-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-400/50 font-black text-sm px-3 py-1 gap-1.5">
                  🏆 New High Score!
                </Badge>
              </motion.div>
            ) : won ? (
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            ) : (
              <Star className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            )}
            <h2 className="text-2xl font-black mb-2" data-testid="text-result-title">{won ? "Awesome Job!" : "Good Try!"}</h2>
            <p className="text-4xl font-black text-purple-500 mb-1" data-testid="text-result-score">{score} pts</p>
            {!isNewHighScore && oldBest > 0 && (
              <p className="text-xs text-muted-foreground mb-2">Your best: {oldBest} pts</p>
            )}
            {isNewHighScore && oldBest > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mb-2">Beat your old best of {oldBest} pts!</p>
            )}
            {highScores && (
              <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                {(["easy", "medium", "hard"] as const).map(d => (
                  highScores[d] > 0 && (
                    <span key={d} className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${d === difficulty ? "bg-purple-500/20 text-purple-600 dark:text-purple-400" : "bg-muted text-muted-foreground"}`}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}: {highScores[d]}
                    </span>
                  )
                ))}
              </div>
            )}

            {rewardsLoading && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Sparkles className="w-4 h-4" />
                </motion.div>
                <span className="text-sm">Calculating rewards...</span>
              </div>
            )}

            {rewards && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 space-y-2"
              >
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1.5 bg-purple-500/15 text-purple-400 px-3 py-1.5 rounded-full" data-testid="text-xp-earned">
                    <Zap className="w-4 h-4" />
                    <span className="font-bold">+{rewards.xp} XP</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-yellow-500/15 text-yellow-400 px-3 py-1.5 rounded-full" data-testid="text-coins-earned">
                    <Coins className="w-4 h-4" />
                    <span className="font-bold">+{rewards.coins} Neuros</span>
                  </div>
                </div>

                {rewards.dailyBonus && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-center gap-1.5 bg-green-500/15 text-green-400 px-3 py-1.5 rounded-full text-sm mx-auto w-fit"
                    data-testid="text-daily-bonus"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="font-bold">Daily Bonus: +{rewards.dailyBonus.xp} XP, +{rewards.dailyBonus.coins} Neuros</span>
                  </motion.div>
                )}

                {rewards.badgesEarned.length > 0 && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-wrap items-center justify-center gap-2"
                  >
                    {rewards.badgesEarned.map((badge) => (
                      <div key={badge} className="flex items-center gap-1 bg-amber-500/15 text-amber-400 px-2 py-1 rounded-full text-xs" data-testid={`badge-earned-${badge}`}>
                        <Award className="w-3 h-3" />
                        <span className="font-bold">{badge.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {rewards.activeUpgrades.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    Boosted by {rewards.activeUpgrades.length} active upgrade{rewards.activeUpgrades.length > 1 ? 's' : ''}!
                  </p>
                )}
              </motion.div>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={() => { setPhase("intro"); setScore(0); setGameOver(false); setRewards(null); rewardsSubmittedRef.current = false; }} variant="outline" className="gap-2 font-bold" data-testid="button-play-again">
                <RotateCcw className="w-4 h-4" /> Play Again
              </Button>
              <Button onClick={() => onComplete(score, won, difficulty)} className="gap-2 font-bold" data-testid="button-finish">
                <ArrowRight className="w-4 h-4" /> Finish
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="sm" onClick={() => handleGameEnd(score)} data-testid="button-quit">
          <X className="w-4 h-4 mr-1" /> Quit
        </Button>
        <Badge className="font-black text-xl px-5 py-2 bg-purple-600 text-white border-0 gap-2 rounded-full" data-testid="score-overlay">
          <Star className="w-5 h-5 text-yellow-300" /> {score} pts
        </Badge>
      </div>

      <GameEngine
        gameType={game.gameType}
        gameId={game.id}
        onScore={(pts) => setScore((prev) => Math.max(0, prev + pts))}
        onEnd={(finalScore) => handleGameEnd(finalScore)}
        score={score}
        yearLevel={yearLevel}
        difficulty={difficulty}
        extraTime={hasExtraTime ? 10 : 0}
        hasLuckyAnswer={hasLuckyAnswer}
        hasScienceScanner={hasScienceScanner}
        luckyAnswerLevel={luckyAnswerLevel}
        gravityModifier={gravityModifier}
      />
    </div>
  );
}

interface GameEngineProps {
  gameType: string;
  gameId: string;
  onScore: (pts: number) => void;
  onEnd: (score?: number) => void;
  score: number;
  yearLevel: number;
  difficulty: 'easy' | 'medium' | 'hard';
  extraTime: number;
  hasLuckyAnswer: boolean;
  hasScienceScanner: boolean;
  luckyAnswerLevel?: number;
  gravityModifier?: string;
}

function GameEngine({ gameType, gameId, onScore, onEnd, score, yearLevel, difficulty, extraTime, hasLuckyAnswer, hasScienceScanner, luckyAnswerLevel = 0, gravityModifier }: GameEngineProps) {
  switch (gameType) {
    case "runner": return <RunnerGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} gravityModifier={gravityModifier} />;
    case "matching": return <MatchingGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "pipe_puzzle": return <PipePuzzleGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "mixing": return <MixingGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "sorting": return <SortingGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "acid_base": return <AcidBaseGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "food_chain": return <FoodChainGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "drag_puzzle": return <TectonicGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "connect_dots": return <ConnectDotsGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "cell_surgeon": return <CellSurgeonGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "rocket_engineer": return <RocketEngineerGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "speed_quiz": return <SpeedQuizGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} yearLevel={yearLevel} difficulty={difficulty} extraTime={extraTime} hasLuckyAnswer={hasLuckyAnswer} hasScienceScanner={hasScienceScanner} luckyAnswerLevel={luckyAnswerLevel} />;
    case "clicker": return <ClickerGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "launcher": return <LauncherGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "slider_match": return <SliderMatchGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "defense": return <DefenseGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "volcano": return <VolcanoGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "planet_painter": return <PlanetPainterGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "space_builder": return <SpaceBuilderGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "maze": return <MazeGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "memory": return <MemoryGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "reaction_tap": return <ReactionTapGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "word_scramble": return <WordScrambleGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "catch_falling": return <CatchFallingGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "gravity_maze": return <GravityMazeGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "space_invaders": return <SpaceInvadersGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "sequence": return <SequenceGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    case "chain_reaction": return <ChainReactionGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
    default: return <RunnerGame gameId={gameId} onScore={onScore} onEnd={onEnd} score={score} difficulty={difficulty} extraTime={extraTime} />;
  }
}

interface MiniGameProps {
  gameId?: string;
  onScore: (pts: number) => void;
  onEnd: (score?: number) => void;
  score: number;
  difficulty: 'easy' | 'medium' | 'hard';
  extraTime: number;
  gravityModifier?: string;
}

function RunnerGame({ gameId, onScore, onEnd, score, difficulty, extraTime, gravityModifier }: MiniGameProps) {
  const diffSettings = {
    easy: { speed: 2, obstacleInterval: 120 },
    medium: { speed: 3, obstacleInterval: 90 },
    hard: { speed: 4, obstacleInterval: 60 },
  };
  const ds = diffSettings[difficulty];
  const isLavaEscape = gameId === "lava-escape";
  // Ranked gravity modifiers tweak the race.
  let mSpeed = ds.speed, mInterval = ds.obstacleInterval, mGravity = isLavaEscape ? 0 : 0.5;
  const starInterval = gravityModifier === "star-rush" ? 30 : 60;
  const playerR = gravityModifier === "tiny-player" ? 9 : 15;
  if (gravityModifier === "hyperspeed") mSpeed = Math.round(mSpeed * 1.6 * 10) / 10;
  if (gravityModifier === "low-gravity") mGravity *= 0.5;
  if (gravityModifier === "spike-storm") mInterval = Math.max(35, Math.floor(mInterval * 0.6));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    playerY: isLavaEscape ? 170 : 200,
    playerVY: 0,
    gravity: mGravity,
    obstacles: [] as { x: number; y: number; w: number; h: number }[],
    stars: [] as { x: number; y: number; collected: boolean }[],
    frame: 0,
    speed: mSpeed,
    alive: true,
    localScore: 0,
    obstacleInterval: mInterval,
    starInterval,
    playerR,
  });
  const [isJumping, setIsJumping] = useState(false);

  const jump = useCallback(() => {
    if (gameRef.current.alive) {
      gameRef.current.playerVY = -10;
      setIsJumping(true);
      setTimeout(() => setIsJumping(false), 300);
    }
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if ((e.code === "Space" || e.key === "ArrowUp") && g.alive) {
        e.preventDefault();
        g.playerVY = -10;
        setIsJumping(true);
        setTimeout(() => setIsJumping(false), 300);
      } else if (e.key === "ArrowDown" && g.alive && isLavaEscape) {
        e.preventDefault();
        g.playerVY = 10;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isLavaEscape]);

  const rt = gameId ? RUNNER_THEMES[gameId] : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gameRef.current;

    const animate = () => {
      if (!g.alive) return;

      g.frame++;

      if (g.frame % 60 === 0) {
        g.localScore += 5;
        onScore(5);
      }

      if (isLavaEscape) {
        g.playerVY *= 0.88;
      } else {
        g.playerVY += g.gravity;
      }
      g.playerY += g.playerVY;

      if (g.playerY > 340) { g.playerY = 340; g.playerVY = 0; }
      if (g.playerY < 0) { g.playerY = 0; g.playerVY = 0; }

      if (g.frame % g.obstacleInterval === 0) {
        // Coordinated top+bottom spikes: gap shifts position each wave,
        // so staying in the middle is never permanently safe.
        // Min gap = 370 - maxSpike = 90 px ≥ 4× player height (always passable).
        const totalSpike = isLavaEscape
          ? 190 + Math.random() * 90   // 190–280 px: aggressive, forces constant movement
          : 150 + Math.random() * 70;  // 150–220 px: moderate, gravity already limits player
        const ceilFrac = 0.25 + Math.random() * 0.5; // ceiling gets 25–75% of spike budget
        const ceilH = Math.max(40, Math.floor(totalSpike * ceilFrac));
        const floorH = Math.max(40, Math.floor(totalSpike - ceilH));
        g.obstacles.push({ x: 600, y: 370 - floorH, w: 25, h: floorH });
        // Lava escape: ceiling spike always spawns (player can float forever otherwise)
        // Gravity dash: 75% chance (up from 40% — gravity already pressures the player)
        if (isLavaEscape || Math.random() < 0.75) {
          g.obstacles.push({ x: 600, y: 0, w: 25, h: ceilH });
        }
      }
      if (g.frame % g.starInterval === 0) {
        g.stars.push({ x: 600, y: 50 + Math.random() * 250, collected: false });
      }

      g.obstacles = g.obstacles.filter((o) => o.x > -30);
      g.stars = g.stars.filter((s) => s.x > -20);

      for (const o of g.obstacles) o.x -= g.speed;
      for (const s of g.stars) s.x -= g.speed;

      for (const s of g.stars) {
        if (!s.collected && Math.abs(60 - s.x) < 25 && Math.abs(g.playerY - s.y) < 25) {
          s.collected = true;
          g.localScore += 10;
          onScore(10);
        }
      }

      const hw = g.playerR + 5;
      for (const o of g.obstacles) {
        if (60 + hw > o.x && 60 < o.x + o.w && g.playerY + hw > o.y && g.playerY < o.y + o.h) {
          g.alive = false;
          onEnd(g.localScore);
          return;
        }
      }

      if (g.frame % 300 === 0) g.speed += 0.3;
      if (g.frame % 500 === 0 && !isLavaEscape) g.gravity = (0.3 + Math.random() * 0.5) * (gravityModifier === "low-gravity" ? 0.5 : 1);

      ctx.clearRect(0, 0, 600, 400);

      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, rt?.bgGradient[0] || "#1a1a3e");
      gradient.addColorStop(1, rt?.bgGradient[1] || "#2d1b69");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 400);

      ctx.fillStyle = rt?.groundColor || "#4a3f8a";
      ctx.fillRect(0, 370, 600, 30);

      ctx.fillStyle = rt?.playerColor || (isJumping ? "#60ff60" : "#4ade80");
      ctx.beginPath();
      ctx.arc(60, g.playerY + 10, g.playerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(65, g.playerY + 6, 4, 0, Math.PI * 2);
      ctx.fill();

      for (const o of g.obstacles) {
        ctx.fillStyle = rt?.obstacleColor || "#ef4444";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = rt?.obstacleAccent || "#dc2626";
        ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
      }

      for (const s of g.stars) {
        if (!s.collected) {
          ctx.fillStyle = rt?.collectibleColor || "#fbbf24";
          ctx.beginPath();
          ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = rt?.collectibleAccent || "#fef3c7";
          ctx.beginPath();
          ctx.arc(s.x - 2, s.y - 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = "#a78bfa";
      ctx.font = "bold 12px Oxanium, sans-serif";
      ctx.fillText(isLavaEscape ? "Zero Gravity!" : (rt?.label || `Gravity: ${g.gravity.toFixed(1)}`), 10, 20);
      ctx.fillText(`Speed: ${g.speed.toFixed(1)}`, 10, 36);

      requestAnimationFrame(animate);
    };
    const animId = requestAnimationFrame(animate);
    return () => {
      g.alive = false;
    };
  }, []);

  const moveDown = () => {
    if (gameRef.current.alive && isLavaEscape) {
      gameRef.current.playerVY = 10;
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="rounded-xl border-2 border-purple-500/30 cursor-pointer w-full max-w-[600px]"
        onClick={jump}
        onTouchStart={jump}
        data-testid="game-canvas"
      />
      {isLavaEscape ? (
        <div className="flex gap-3 items-center">
          <button className="px-4 py-2 rounded-lg bg-purple-600/30 border border-purple-500/40 font-bold text-sm text-purple-300" onClick={jump} onTouchStart={jump}>▲ Up</button>
          <p className="text-xs text-muted-foreground font-medium">Zero Gravity! Use Up/Down to float through lava!</p>
          <button className="px-4 py-2 rounded-lg bg-red-600/30 border border-red-500/40 font-bold text-sm text-red-300" onClick={moveDown} onTouchStart={moveDown}>▼ Down</button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground font-medium">
          {rt ? `Jump to dodge ${rt.obstacleName} and collect ${rt.collectibleName}!` : "Click / Tap / Space to jump! Dodge red blocks, collect stars!"}
        </p>
      )}
    </div>
  );
}

function MatchingGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const theme = gameId ? MATCHING_THEMES[gameId] : null;
  const pairs = theme?.pairs || [
    { base: "A", match: "T", color: "#ef4444" },
    { base: "T", match: "A", color: "#3b82f6" },
    { base: "G", match: "C", color: "#22c55e" },
    { base: "C", match: "G", color: "#f59e0b" },
  ];
  const prompt = theme?.prompt || "Match the base pair for:";
  const options = theme?.options || ["A", "T", "G", "C"];

  const matchingTime = { easy: 45, medium: 30, hard: 20 };
  const [current, setCurrent] = useState(() => pairs[Math.floor(Math.random() * pairs.length)]);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(matchingTime[difficulty] + extraTime);
  const [localScore, setLocalScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          onEnd(scoreRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChoice = (choice: string) => {
    if (choice === current.match) {
      const pts = 20 + combo * 5;
      setCombo((c) => c + 1);
      setLocalScore((s) => s + pts);
      onScore(pts);
      setFeedback("Correct!");
    } else {
      setCombo(0);
      setFeedback("Wrong!");
    }
    setCurrent(pairs[Math.floor(Math.random() * pairs.length)]);
    setTimeout(() => setFeedback(null), 500);
  };

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-6">
        <Badge variant="secondary" className="font-bold">
          <Timer className="w-3 h-3 mr-1" /> {timeLeft}s
        </Badge>
        <Badge variant="outline" className="font-bold">
          Combo: {combo}x
        </Badge>
      </div>

      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground font-medium mb-2">{prompt}</p>
        <motion.div
          key={current.base}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-4xl font-black text-white"
          style={{ backgroundColor: current.color }}
        >
          {current.base}
        </motion.div>
        {feedback && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-2 font-bold ${feedback === "Correct!" ? "text-green-500" : "text-red-500"}`}
          >
            {feedback}
          </motion.p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <Button
            key={opt}
            size="lg"
            variant="outline"
            className="text-2xl font-black h-16"
            onClick={() => handleChoice(opt)}
            data-testid={`button-base-${opt}`}
          >
            {opt}
          </Button>
        ))}
      </div>
    </Card>
  );
}

// Pipe connectivity: which directions each pipe type connects
// 0=━ (W,E)  1=┃ (N,S)  2=┏ (E,S)  3=┓ (W,S)  4=┗ (E,N)  5=┛ (W,N)
const PIPE_CONNECTS: Record<number, string[]> = {
  0: ["W", "E"],
  1: ["N", "S"],
  2: ["E", "S"],
  3: ["W", "S"],
  4: ["E", "N"],
  5: ["W", "N"],
};
const OPP: Record<string, string> = { N: "S", S: "N", E: "W", W: "E" };
const DELTA: Record<string, [number, number]> = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };

const DIR_TO_PIPE: Record<string, number> = {
  "EW": 0, "WE": 0,
  "NS": 1, "SN": 1,
  "ES": 2, "SE": 2,
  "SW": 3, "WS": 3,
  "EN": 4, "NE": 4,
  "NW": 5, "WN": 5,
};

function generatePuzzle(size: number): number[][] {
  // Build a random path from (0,0) to (size-1,size-1) moving only right/down
  const path: [number, number][] = [[0, 0]];
  let r = 0, c = 0;
  while (r !== size - 1 || c !== size - 1) {
    const canRight = c < size - 1;
    const canDown = r < size - 1;
    if (canRight && canDown) {
      if (Math.random() < 0.5) { c++; } else { r++; }
    } else if (canRight) { c++; } else { r++; }
    path.push([r, c]);
  }

  // Assign correct pipe type to each path cell based on entry/exit direction
  const solution: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  for (let i = 0; i < path.length; i++) {
    const [pr, pc] = path[i];
    const dirs = new Set<string>();
    if (i > 0) {
      const [ppR, ppC] = path[i - 1];
      if (ppR < pr) dirs.add("N");
      if (ppR > pr) dirs.add("S");
      if (ppC < pc) dirs.add("W");
      if (ppC > pc) dirs.add("E");
    }
    if (i < path.length - 1) {
      const [nR, nC] = path[i + 1];
      if (nR < pr) dirs.add("N");
      if (nR > pr) dirs.add("S");
      if (nC < pc) dirs.add("W");
      if (nC > pc) dirs.add("E");
    }
    const dirStr = [...dirs].sort().join("");
    solution[pr][pc] = DIR_TO_PIPE[dirStr] ?? 0;
  }
  // Fill non-path cells with random pipes
  const pathSet = new Set(path.map(([pr, pc]) => `${pr},${pc}`));
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!pathSet.has(`${row},${col}`)) {
        solution[row][col] = Math.floor(Math.random() * 6);
      }
    }
  }
  // Scramble all tiles by random rotations (1-5 steps so none are already correct by chance)
  return solution.map(row => row.map(t => (t + 1 + Math.floor(Math.random() * 5)) % 6));
}

function isCircuitComplete(grid: number[][], size: number): boolean {
  const visited = new Set<string>();
  const queue: [number, number][] = [[0, 0]];
  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (r === size - 1 && c === size - 1) return true;
    for (const dir of PIPE_CONNECTS[grid[r][c]]) {
      const [dr, dc] = DELTA[dir];
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      if (visited.has(`${nr},${nc}`)) continue;
      if (PIPE_CONNECTS[grid[nr][nc]].includes(OPP[dir])) {
        queue.push([nr, nc]);
      }
    }
  }
  return false;
}

function PipePuzzleGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const SIZE = 4;
  const PIPE_TYPES = ["━", "┃", "┏", "┓", "┗", "┛"];

  const pipeTime = { easy: 60, medium: 45, hard: 30 };
  const [grid, setGrid] = useState<number[][]>(() => generatePuzzle(SIZE));
  const [solved, setSolved] = useState(false);
  const [wrongFeedback, setWrongFeedback] = useState(false);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(pipeTime[difficulty] + extraTime);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const rotateTile = (r: number, c: number) => {
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = (next[r][c] + 1) % 6;
      return next;
    });
  };

  const checkSolution = () => {
    if (!isCircuitComplete(grid, SIZE)) {
      setWrongFeedback(true);
      setTimeout(() => setWrongFeedback(false), 1200);
      return;
    }
    const pts = 50;
    onScore(pts);
    setSolved(true);
    setTimeout(() => {
      setGrid(generatePuzzle(SIZE));
      setSolved(false);
      setLevel((l) => l + 1);
    }, 1000);
  };

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold">
          <Timer className="w-3 h-3 mr-1" /> {timeLeft}s
        </Badge>
        <Badge variant="outline" className="font-bold">Level {level}</Badge>
      </div>

      <p className="text-sm text-muted-foreground mb-4 text-center font-medium">
        Click tiles to rotate them. Connect the path from top-left to bottom-right!
      </p>

      <div className="grid gap-1 mx-auto" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, maxWidth: 280 }}>
        {grid.map((row, r) =>
          row.map((tile, c) => (
            <motion.button
              key={`${r}-${c}`}
              whileTap={{ scale: 0.9 }}
              className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                r === 0 && c === 0
                  ? "bg-green-500/20 border-green-500"
                  : r === SIZE - 1 && c === SIZE - 1
                  ? "bg-yellow-500/20 border-yellow-500"
                  : "bg-muted border-border hover:border-purple-500"
              }`}
              onClick={() => rotateTile(r, c)}
              data-testid={`tile-${r}-${c}`}
            >
              {PIPE_TYPES[tile]}
            </motion.button>
          ))
        )}
      </div>

      <Button onClick={checkSolution} className="w-full mt-4 font-bold" data-testid="button-check-circuit">
        <Zap className="w-4 h-4 mr-2" /> Check Circuit
      </Button>

      {solved && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-3">
          <p className="text-green-500 font-bold">⚡ Circuit Complete! +50 pts</p>
        </motion.div>
      )}
      {wrongFeedback && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-3">
          <p className="text-red-500 font-bold">🔌 Circuit not connected — keep rotating!</p>
        </motion.div>
      )}
    </Card>
  );
}

function MixingGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const chemicals = [
    { name: "Red Acid", color: "#ef4444", value: 0 },
    { name: "Blue Base", color: "#3b82f6", value: 1 },
    { name: "Green Catalyst", color: "#22c55e", value: 2 },
    { name: "Yellow Solution", color: "#eab308", value: 3 },
  ];
  const targetCombos = [
    { recipe: [0, 1], name: "Purple Potion", result: "#8b5cf6" },
    { recipe: [1, 2], name: "Teal Elixir", result: "#14b8a6" },
    { recipe: [0, 3], name: "Orange Brew", result: "#f97316" },
    { recipe: [2, 3], name: "Lime Solution", result: "#84cc16" },
  ];

  const mixTime = { easy: 55, medium: 40, hard: 25 };
  const [target, setTarget] = useState(() => targetCombos[Math.floor(Math.random() * 4)]);
  const [beaker, setBeaker] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(mixTime[difficulty] + extraTime);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const addChemical = (idx: number) => {
    if (beaker.length >= 2) return;
    const newBeaker = [...beaker, idx];
    setBeaker(newBeaker);

    if (newBeaker.length === 2) {
      const sorted = [...newBeaker].sort();
      const targetSorted = [...target.recipe].sort();
      if (sorted[0] === targetSorted[0] && sorted[1] === targetSorted[1]) {
        onScore(25);
        setFeedback("Perfect mix!");
        setTimeout(() => {
          setTarget(targetCombos[Math.floor(Math.random() * 4)]);
          setBeaker([]);
          setFeedback(null);
          setRound((r) => r + 1);
        }, 800);
      } else {
        setFeedback("Wrong mix!");
        setTimeout(() => { setBeaker([]); setFeedback(null); }, 800);
      }
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Round {round}</Badge>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground font-medium mb-2">Create:</p>
        <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center border-4 border-dashed border-muted-foreground/30" style={{ backgroundColor: target.result }}>
          <span className="text-white text-xs font-bold drop-shadow">{target.name}</span>
        </div>
      </div>

      <div className="flex justify-center gap-2 mb-6 h-24">
        <div className="w-20 h-24 rounded-b-xl border-2 border-muted-foreground/30 flex flex-col-reverse items-center relative overflow-hidden" style={{ backgroundColor: "#1a1a2e" }}>
          {beaker.map((c, i) => (
            <motion.div key={i} initial={{ y: -50 }} animate={{ y: 0 }} className="w-full h-10" style={{ backgroundColor: chemicals[c].color, opacity: 0.8 }} />
          ))}
        </div>
      </div>

      {feedback && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center font-bold mb-3 ${feedback.includes("Perfect") ? "text-green-500" : "text-red-500"}`}>
          {feedback}
        </motion.p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {chemicals.map((chem, i) => (
          <Button key={i} variant="outline" className="h-14 font-bold gap-2" onClick={() => addChemical(i)} disabled={beaker.length >= 2} data-testid={`button-chem-${i}`}>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: chem.color }} />
            {chem.name}
          </Button>
        ))}
      </div>

      <Button variant="ghost" className="w-full mt-2 text-sm" onClick={() => setBeaker([])} data-testid="button-clear-beaker">
        Clear Beaker
      </Button>
    </Card>
  );
}

function SortingGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const st = gameId ? SORTING_THEMES[gameId] : null;
  const allEvents = st?.events || [
    { text: "Archimedes discovers buoyancy", year: -250 },
    { text: "Galileo uses telescope", year: 1609 },
    { text: "Newton publishes laws of motion", year: 1687 },
    { text: "Ben Franklin's kite experiment", year: 1752 },
    { text: "Darwin publishes Origin of Species", year: 1859 },
    { text: "Marie Curie discovers radium", year: 1898 },
    { text: "Einstein publishes E=mc²", year: 1905 },
    { text: "First Moon landing", year: 1969 },
    { text: "World Wide Web invented", year: 1989 },
    { text: "Human genome mapped", year: 2003 },
  ];

  const sortTime = { easy: 60, medium: 45, hard: 30 };
  const [events, setEvents] = useState<typeof allEvents>([]);
  const [timeLeft, setTimeLeft] = useState(sortTime[difficulty] + extraTime);
  const [round, setRound] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    loadRound();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadRound = () => {
    const shuffled = [...allEvents].sort(() => Math.random() - 0.5).slice(0, 5);
    const randomized = [...shuffled].sort(() => Math.random() - 0.5);
    setEvents(randomized);
  };

  const moveItem = (fromIdx: number, toIdx: number) => {
    const newEvents = [...events];
    const [item] = newEvents.splice(fromIdx, 1);
    newEvents.splice(toIdx, 0, item);
    setEvents(newEvents);
  };

  const checkOrder = () => {
    let correct = 0;
    for (let i = 0; i < events.length - 1; i++) {
      if (events[i].year <= events[i + 1].year) correct++;
    }
    const pts = correct * 30;
    onScore(pts);
    if (correct === events.length - 1) {
      setFeedback("Perfect order!");
    } else {
      setFeedback(`${correct}/${events.length - 1} correct`);
    }
    setTimeout(() => {
      loadRound();
      setFeedback(null);
      setRound((r) => r + 1);
    }, 1500);
  };

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Round {round}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4 text-center font-medium">{st?.instruction || "Sort these events from earliest to latest! Use the arrows."}</p>

      <div className="space-y-2 mb-4">
        {events.map((event, i) => (
          <motion.div key={event.text} layout className="flex items-center gap-2 bg-muted rounded-lg p-3">
            <div className="flex flex-col">
              <button className="text-xs hover:text-purple-500" onClick={() => i > 0 && moveItem(i, i - 1)} disabled={i === 0}>▲</button>
              <button className="text-xs hover:text-purple-500" onClick={() => i < events.length - 1 && moveItem(i, i + 1)} disabled={i === events.length - 1}>▼</button>
            </div>
            <span className="text-sm font-medium flex-1">{event.text}</span>
            <Badge variant="outline" className="text-xs shrink-0">{i + 1}</Badge>
          </motion.div>
        ))}
      </div>

      {feedback && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center font-bold mb-3 ${feedback.includes("Perfect") ? "text-green-500" : "text-yellow-500"}`}>
          {feedback}
        </motion.p>
      )}

      <Button onClick={checkOrder} className="w-full font-bold" data-testid="button-check-order">
        Check Order
      </Button>
    </Card>
  );
}

function AcidBaseGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const substances = [
    { name: "Lemon Juice", type: "acid", pH: 2, hint: "Sour citrus" },
    { name: "Vinegar", type: "acid", pH: 3, hint: "Sour liquid" },
    { name: "Stomach Acid", type: "acid", pH: 1, hint: "Digestive" },
    { name: "Cola", type: "acid", pH: 2.5, hint: "Fizzy drink" },
    { name: "Tomato Juice", type: "acid", pH: 4, hint: "Red veggie drink" },
    { name: "Battery Acid", type: "acid", pH: 0.5, hint: "Very dangerous!" },
    { name: "Acid Rain", type: "acid", pH: 4.2, hint: "Pollution" },
    { name: "Orange Juice", type: "acid", pH: 3.5, hint: "Breakfast drink" },
    { name: "Baking Soda", type: "base", pH: 9, hint: "Used in cooking" },
    { name: "Soap", type: "base", pH: 10, hint: "Cleaning agent" },
    { name: "Bleach", type: "base", pH: 13, hint: "Strong cleaner" },
    { name: "Ammonia", type: "base", pH: 11, hint: "Sharp smell" },
    { name: "Toothpaste", type: "base", pH: 9.5, hint: "Dental care" },
    { name: "Drain Cleaner", type: "base", pH: 14, hint: "Very corrosive!" },
    { name: "Antacid", type: "base", pH: 10, hint: "Tummy relief" },
    { name: "Milk of Magnesia", type: "base", pH: 10.5, hint: "Medicine" },
    { name: "Pure Water", type: "neutral", pH: 7, hint: "H₂O" },
    { name: "Salt Water", type: "neutral", pH: 7, hint: "NaCl solution" },
    { name: "Blood", type: "neutral", pH: 7.4, hint: "Body fluid" },
    { name: "Milk", type: "neutral", pH: 6.7, hint: "From cows" },
    { name: "Saliva", type: "neutral", pH: 7.1, hint: "In your mouth" },
    { name: "Tears", type: "neutral", pH: 7.2, hint: "Eye drops" },
  ];

  const timeLimit = { easy: 60, medium: 45, hard: 30 };
  const [timeLeft, setTimeLeft] = useState(timeLimit[difficulty] + extraTime);
  const [current, setCurrent] = useState<typeof substances[0] | null>(null);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(difficulty === "easy");
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const nextSubstance = () => {
    const available = substances.filter(s => !used.has(s.name));
    if (available.length === 0) { onEnd(scoreRef.current); return; }
    const pick = available[Math.floor(Math.random() * available.length)];
    setCurrent(pick);
    setUsed(prev => { const n = new Set(Array.from(prev)); n.add(pick.name); return n; });
  };

  useEffect(() => { nextSubstance(); }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sortInto = (bin: "acid" | "base" | "neutral") => {
    if (!current) return;
    const correct = current.type === bin;
    if (correct) {
      const streakBonus = streak >= 3 ? 10 : streak >= 5 ? 20 : 0;
      onScore(15 + streakBonus);
      setStreak(s => s + 1);
      setFeedback({ text: `Correct! pH ${current.pH}${streakBonus > 0 ? ` +${streakBonus} streak bonus!` : ""}`, correct: true });
    } else {
      setStreak(0);
      setFeedback({ text: `Wrong! ${current.name} is ${current.type} (pH ${current.pH})`, correct: false });
    }
    setTimeout(() => { setFeedback(null); nextSubstance(); }, 1200);
  };

  if (!current) return null;

  const bins = [
    { type: "acid" as const, label: "ACID", color: "from-red-500 to-red-600", emoji: "🔴", range: "pH 0-6" },
    { type: "neutral" as const, label: "NEUTRAL", color: "from-green-500 to-green-600", emoji: "🟢", range: "pH 7" },
    { type: "base" as const, label: "BASE", color: "from-blue-500 to-blue-600", emoji: "🔵", range: "pH 8-14" },
  ];

  return (
    <Card className="p-6 max-w-lg mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Streak: {streak}🔥</Badge>
      </div>

      <div className="text-center mb-6">
        <motion.div
          key={current.name}
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/40 rounded-xl p-6 mb-3"
        >
          <p className="text-xs text-muted-foreground font-semibold mb-1">Sort this substance:</p>
          <h3 className="text-2xl font-black">{current.name}</h3>
          {showHint && <p className="text-xs text-muted-foreground mt-1">💡 {current.hint}</p>}
        </motion.div>

        {!showHint && difficulty !== "easy" && (
          <button onClick={() => setShowHint(true)} className="text-xs text-muted-foreground underline mb-2">Show hint</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {bins.map(bin => (
          <Button
            key={bin.type}
            onClick={() => sortInto(bin.type)}
            className={`h-20 flex flex-col gap-1 bg-gradient-to-b ${bin.color} text-white font-bold border-0 hover:scale-105 transition-transform`}
            data-testid={`button-sort-${bin.type}`}
          >
            <span className="text-2xl">{bin.emoji}</span>
            <span className="text-xs font-black">{bin.label}</span>
            <span className="text-[10px] opacity-75">{bin.range}</span>
          </Button>
        ))}
      </div>

      {feedback && (
        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-center font-bold text-sm ${feedback.correct ? "text-green-500" : "text-red-500"}`}
        >
          {feedback.correct ? "✓ " : "✗ "}{feedback.text}
        </motion.p>
      )}

      <div className="mt-4 w-full bg-muted rounded-full h-2">
        <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${(used.size / substances.length) * 100}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-1">{used.size}/{substances.length} substances</p>
    </Card>
  );
}

function FoodChainGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const chains = [
    { organisms: ["Grass", "Grasshopper", "Frog", "Snake", "Eagle"], ecosystem: "Grassland" },
    { organisms: ["Phytoplankton", "Zooplankton", "Small Fish", "Tuna", "Shark"], ecosystem: "Ocean" },
    { organisms: ["Algae", "Tadpole", "Dragonfly", "Frog", "Heron"], ecosystem: "Pond" },
    { organisms: ["Oak Tree", "Caterpillar", "Robin", "Hawk"], ecosystem: "Forest" },
    { organisms: ["Seaweed", "Sea Urchin", "Otter", "Orca"], ecosystem: "Kelp Forest" },
    { organisms: ["Lichen", "Caribou", "Wolf", "Bear"], ecosystem: "Arctic" },
    { organisms: ["Corn", "Mouse", "Snake", "Owl"], ecosystem: "Farm" },
    { organisms: ["Berries", "Rabbit", "Fox", "Mountain Lion"], ecosystem: "Mountain" },
    { organisms: ["Nectar", "Bee", "Spider", "Bird", "Cat"], ecosystem: "Garden" },
    { organisms: ["Dead Leaves", "Worm", "Mole", "Hawk"], ecosystem: "Woodland" },
    { organisms: ["Cactus", "Lizard", "Roadrunner", "Coyote"], ecosystem: "Desert" },
    { organisms: ["Bamboo", "Panda", "Snow Leopard"], ecosystem: "Mountain" },
  ];

  const timeLimit = { easy: 75, medium: 55, hard: 40 };
  const chainLength = { easy: 3, medium: 4, hard: 5 };
  const [timeLeft, setTimeLeft] = useState(timeLimit[difficulty] + extraTime);
  const [round, setRound] = useState(1);
  const [currentChain, setCurrentChain] = useState<{ organisms: string[]; ecosystem: string } | null>(null);
  const [shuffled, setShuffled] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [usedChains, setUsedChains] = useState<Set<number>>(new Set());
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const loadChain = () => {
    const maxLen = chainLength[difficulty];
    const available = chains
      .map((c, i) => ({ ...c, idx: i }))
      .filter(c => !usedChains.has(c.idx) && c.organisms.length <= maxLen + 1);
    if (available.length === 0) { onEnd(scoreRef.current); return; }
    const pick = available[Math.floor(Math.random() * available.length)];
    const trimmed = pick.organisms.slice(0, maxLen);
    setCurrentChain({ organisms: trimmed, ecosystem: pick.ecosystem });
    setShuffled([...trimmed].sort(() => Math.random() - 0.5));
    setSelected([]);
    setUsedChains(prev => { const n = new Set(Array.from(prev)); n.add(pick.idx); return n; });
  };

  useEffect(() => { loadChain(); }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const selectOrganism = (org: string) => {
    if (selected.includes(org)) return;
    const newSelected = [...selected, org];
    setSelected(newSelected);

    if (newSelected.length === currentChain!.organisms.length) {
      const correct = newSelected.every((o, i) => o === currentChain!.organisms[i]);
      if (correct) {
        const pts = newSelected.length * 20;
        onScore(pts);
        setFeedback({ text: `Perfect chain! +${pts} pts`, correct: true });
      } else {
        let correctLinks = 0;
        for (let i = 0; i < newSelected.length; i++) {
          if (newSelected[i] === currentChain!.organisms[i]) correctLinks++;
        }
        const pts = correctLinks * 10;
        if (pts > 0) onScore(pts);
        setFeedback({ text: `${correctLinks}/${newSelected.length} correct positions (+${pts})`, correct: false });
      }
      setTimeout(() => {
        setFeedback(null);
        setRound(r => r + 1);
        loadChain();
      }, 1500);
    }
  };

  const removeFromChain = (idx: number) => {
    setSelected(prev => prev.slice(0, idx));
  };

  if (!currentChain) return null;

  const trophicLabels = ["Producer", "Primary Consumer", "Secondary Consumer", "Tertiary Consumer", "Apex Predator"];

  return (
    <Card className="p-6 max-w-lg mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Round {round}</Badge>
      </div>

      <div className="text-center mb-4">
        <p className="text-xs text-muted-foreground font-semibold mb-1">Build the food chain for:</p>
        <Badge className="text-sm font-bold bg-green-600 text-white">🌍 {currentChain.ecosystem}</Badge>
        <p className="text-xs text-muted-foreground mt-2 font-medium">Click organisms in order: Producer → Apex Predator</p>
      </div>

      <div className="mb-4 space-y-2">
        {currentChain.organisms.map((_, i) => (
          <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border-2 border-dashed ${selected[i] ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-muted"}`}>
            <span className="text-xs font-bold text-muted-foreground w-28 shrink-0">{trophicLabels[i] || `Level ${i + 1}`}</span>
            {i > 0 && <span className="text-muted-foreground">←</span>}
            {selected[i] ? (
              <button onClick={() => removeFromChain(i)} className="flex-1 text-left font-bold text-sm text-green-700 dark:text-green-400 hover:line-through">
                {selected[i]}
              </button>
            ) : (
              <span className="flex-1 text-sm text-muted-foreground/50">?</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {shuffled.map(org => {
          const isUsed = selected.includes(org);
          return (
            <Button
              key={org}
              size="sm"
              variant={isUsed ? "ghost" : "secondary"}
              disabled={isUsed}
              onClick={() => selectOrganism(org)}
              className={`font-bold text-xs ${isUsed ? "opacity-30" : "hover:scale-105 transition-transform"}`}
              data-testid={`button-organism-${org.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {org}
            </Button>
          );
        })}
      </div>

      {feedback && (
        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-center font-bold text-sm ${feedback.correct ? "text-green-500" : "text-yellow-500"}`}
        >
          {feedback.correct ? "🎉 " : "🔗 "}{feedback.text}
        </motion.p>
      )}
    </Card>
  );
}

function TectonicGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const plates = [
    { name: "Pacific Plate", type: "oceanic", fact: "Largest tectonic plate on Earth" },
    { name: "North American Plate", type: "continental", fact: "Contains most of North America and western Atlantic" },
    { name: "Eurasian Plate", type: "continental", fact: "Contains Europe and most of Asia" },
    { name: "African Plate", type: "continental", fact: "Contains all of Africa" },
    { name: "Antarctic Plate", type: "continental", fact: "Surrounds Antarctica" },
    { name: "Indo-Australian Plate", type: "continental", fact: "Contains India and Australia" },
    { name: "South American Plate", type: "continental", fact: "Contains South America and western Atlantic" },
    { name: "Nazca Plate", type: "oceanic", fact: "Being subducted under South America" },
    { name: "Philippine Plate", type: "oceanic", fact: "Small plate near the Philippines" },
    { name: "Juan de Fuca Plate", type: "oceanic", fact: "Tiny plate near Pacific Northwest" },
  ];

  const boundaries = [
    { type: "convergent", emoji: "💥", description: "Plates push together", result: "Mountains or trenches form" },
    { type: "divergent", emoji: "↔️", description: "Plates pull apart", result: "New crust forms (mid-ocean ridges)" },
    { type: "transform", emoji: "⚡", description: "Plates slide past each other", result: "Earthquakes (like San Andreas Fault)" },
  ];

  const questions = [
    { q: "What happens when oceanic and continental plates collide?", a: "Subduction - oceanic plate goes under", options: ["Subduction - oceanic plate goes under", "They bounce apart", "Nothing happens", "Both plates sink"] },
    { q: "What boundary creates new ocean floor?", a: "Divergent", options: ["Convergent", "Divergent", "Transform", "Subductive"] },
    { q: "The San Andreas Fault is what type of boundary?", a: "Transform", options: ["Convergent", "Divergent", "Transform", "Subductive"] },
    { q: "What drives tectonic plate movement?", a: "Convection currents in the mantle", options: ["Wind", "Convection currents in the mantle", "Ocean waves", "Magnetic forces"] },
    { q: "The Himalayas formed from what type of collision?", a: "Continental-continental convergent", options: ["Continental-continental convergent", "Oceanic-oceanic divergent", "Transform", "Volcanic eruption"] },
    { q: "What is the Ring of Fire?", a: "Zone of earthquakes and volcanoes around the Pacific", options: ["A volcano", "Zone of earthquakes and volcanoes around the Pacific", "A meteor crater", "A type of lava"] },
    { q: "What is Pangaea?", a: "An ancient supercontinent", options: ["A volcano", "An ancient supercontinent", "A tectonic plate", "An earthquake scale"] },
    { q: "Which plate is being subducted under South America?", a: "Nazca Plate", options: ["Pacific Plate", "Nazca Plate", "Antarctic Plate", "African Plate"] },
  ];

  const timeLimit = { easy: 60, medium: 45, hard: 35 };
  const [timeLeft, setTimeLeft] = useState(timeLimit[difficulty] + extraTime);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"classify" | "boundary" | "question">("classify");
  const [currentPlate, setCurrentPlate] = useState(plates[0]);
  const [currentBoundary, setCurrentBoundary] = useState(boundaries[0]);
  const [currentQuestion, setCurrentQuestion] = useState(questions[0]);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => { nextRound(); }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const nextRound = () => {
    const r = round + 1;
    setRound(r);
    const phaseType = r % 3;
    if (phaseType === 1) {
      setPhase("classify");
      setCurrentPlate(plates[Math.floor(Math.random() * plates.length)]);
    } else if (phaseType === 2) {
      setPhase("boundary");
      setCurrentBoundary(boundaries[Math.floor(Math.random() * boundaries.length)]);
    } else {
      setPhase("question");
      setCurrentQuestion(questions[Math.floor(Math.random() * questions.length)]);
    }
    setFeedback(null);
  };

  const answerClassify = (type: string) => {
    const correct = currentPlate.type === type;
    if (correct) { onScore(20); setFeedback({ text: `Correct! ${currentPlate.fact}`, correct: true }); }
    else { setFeedback({ text: `Wrong! ${currentPlate.name} is ${currentPlate.type}`, correct: false }); }
    setTimeout(nextRound, 1500);
  };

  const answerBoundary = (result: string) => {
    const correct = result === currentBoundary.type;
    if (correct) { onScore(25); setFeedback({ text: `Yes! ${currentBoundary.result}`, correct: true }); }
    else { setFeedback({ text: `Not quite! "${currentBoundary.description}" = ${currentBoundary.type}`, correct: false }); }
    setTimeout(nextRound, 1500);
  };

  const answerQuestion = (answer: string) => {
    const correct = answer === currentQuestion.a;
    if (correct) { onScore(30); setFeedback({ text: "Correct!", correct: true }); }
    else { setFeedback({ text: `Answer: ${currentQuestion.a}`, correct: false }); }
    setTimeout(nextRound, 1500);
  };

  return (
    <Card className="p-6 max-w-lg mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Round {round}</Badge>
      </div>

      {phase === "classify" && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-semibold mb-2">Classify this tectonic plate:</p>
          <div className="bg-gradient-to-br from-amber-100 to-orange-200 dark:from-amber-900/40 dark:to-orange-800/40 rounded-xl p-6 mb-4">
            <h3 className="text-2xl font-black">🌍 {currentPlate.name}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => answerClassify("oceanic")} className="h-16 bg-gradient-to-b from-blue-500 to-blue-600 text-white font-bold border-0" data-testid="button-oceanic">
              🌊 Oceanic
            </Button>
            <Button onClick={() => answerClassify("continental")} className="h-16 bg-gradient-to-b from-green-600 to-green-700 text-white font-bold border-0" data-testid="button-continental">
              🏔️ Continental
            </Button>
          </div>
        </div>
      )}

      {phase === "boundary" && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-semibold mb-2">What boundary type is this?</p>
          <div className="bg-gradient-to-br from-red-100 to-orange-200 dark:from-red-900/40 dark:to-orange-800/40 rounded-xl p-6 mb-4">
            <p className="text-3xl mb-1">{currentBoundary.emoji}</p>
            <h3 className="text-lg font-black">{currentBoundary.description}</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {boundaries.map(b => (
              <Button key={b.type} onClick={() => answerBoundary(b.type)} variant="secondary" className="h-14 font-bold text-xs capitalize" data-testid={`button-boundary-${b.type}`}>
                {b.emoji} {b.type}
              </Button>
            ))}
          </div>
        </div>
      )}

      {phase === "question" && (
        <div>
          <p className="text-sm font-bold text-center mb-4">{currentQuestion.q}</p>
          <div className="grid grid-cols-1 gap-2">
            {currentQuestion.options.map(opt => (
              <Button key={opt} onClick={() => answerQuestion(opt)} variant="outline" className="text-left font-medium text-sm h-auto py-3 justify-start" data-testid={`button-tectonic-answer-${currentQuestion.options.indexOf(opt)}`}>
                {opt}
              </Button>
            ))}
          </div>
        </div>
      )}

      {feedback && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center font-bold text-sm mt-4 ${feedback.correct ? "text-green-500" : "text-red-500"}`}>
          {feedback.correct ? "✓ " : "✗ "}{feedback.text}
        </motion.p>
      )}
    </Card>
  );
}

function ConnectDotsGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const constellations = [
    { name: "Big Dipper", stars: [{x: 20, y: 30}, {x: 35, y: 25}, {x: 50, y: 28}, {x: 60, y: 35}, {x: 65, y: 50}, {x: 55, y: 55}, {x: 45, y: 52}], fact: "Part of Ursa Major (Great Bear)" },
    { name: "Orion", stars: [{x: 40, y: 15}, {x: 30, y: 30}, {x: 50, y: 30}, {x: 35, y: 45}, {x: 40, y: 50}, {x: 45, y: 45}, {x: 40, y: 70}], fact: "Named after a hunter from Greek mythology" },
    { name: "Cassiopeia", stars: [{x: 20, y: 40}, {x: 35, y: 25}, {x: 50, y: 35}, {x: 65, y: 20}, {x: 80, y: 30}], fact: "W-shaped constellation named after a queen" },
    { name: "Leo", stars: [{x: 25, y: 20}, {x: 35, y: 15}, {x: 50, y: 20}, {x: 55, y: 35}, {x: 45, y: 50}, {x: 30, y: 45}], fact: "The Lion constellation, a zodiac sign" },
    { name: "Scorpius", stars: [{x: 30, y: 20}, {x: 35, y: 30}, {x: 40, y: 40}, {x: 50, y: 50}, {x: 60, y: 55}, {x: 65, y: 65}, {x: 55, y: 75}], fact: "Contains the red supergiant star Antares" },
    { name: "Cygnus", stars: [{x: 40, y: 15}, {x: 40, y: 35}, {x: 20, y: 45}, {x: 60, y: 45}, {x: 40, y: 60}], fact: "The Swan, contains the Northern Cross" },
    { name: "Draco", stars: [{x: 75, y: 15}, {x: 65, y: 25}, {x: 50, y: 22}, {x: 40, y: 30}, {x: 35, y: 45}, {x: 45, y: 55}, {x: 55, y: 50}, {x: 60, y: 65}], fact: "The Dragon, a circumpolar constellation" },
    { name: "Lyra", stars: [{x: 50, y: 20}, {x: 40, y: 35}, {x: 60, y: 35}, {x: 35, y: 50}, {x: 65, y: 50}], fact: "Contains Vega, one of the brightest stars" },
  ];

  const starsPerConstellation = { easy: 4, medium: 6, hard: 8 };
  const decoyCount = { easy: 1, medium: 3, hard: 5 };
  const timeLimit = { easy: 40, medium: 30, hard: 22 };
  const wrongPenalty = { easy: 2, medium: 3, hard: 5 };
  const [timeLeft, setTimeLeft] = useState(timeLimit[difficulty] + extraTime);
  const [round, setRound] = useState(0);
  const [current, setCurrent] = useState<typeof constellations[0] | null>(null);
  const [allStars, setAllStars] = useState<{x: number; y: number; isReal: boolean; realIdx: number}[]>([]);
  const [connected, setConnected] = useState<number[]>([]);
  const [correctOrder, setCorrectOrder] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [miniMsg, setMiniMsg] = useState<string | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const generateDecoys = (realStars: {x: number; y: number}[], count: number) => {
    const decoys: {x: number; y: number}[] = [];
    for (let i = 0; i < count; i++) {
      let tries = 0;
      while (tries < 50) {
        const dx = 10 + Math.random() * 80;
        const dy = 10 + Math.random() * 80;
        const tooClose = [...realStars, ...decoys].some(s => Math.hypot(s.x - dx, s.y - dy) < 8);
        if (!tooClose) { decoys.push({ x: dx, y: dy }); break; }
        tries++;
      }
    }
    return decoys;
  };

  const loadConstellation = useCallback((r: number) => {
    const pick = constellations[r % constellations.length];
    const maxStars = Math.min(pick.stars.length, starsPerConstellation[difficulty]);
    const realStars = pick.stars.slice(0, maxStars);
    const decoys = generateDecoys(realStars, decoyCount[difficulty]);

    const combined: {x: number; y: number; isReal: boolean; realIdx: number}[] = [
      ...realStars.map((s, i) => ({ ...s, isReal: true, realIdx: i })),
      ...decoys.map(s => ({ ...s, isReal: false, realIdx: -1 })),
    ].sort(() => Math.random() - 0.5);

    const order = combined.reduce<number[]>((acc, star, displayIdx) => {
      if (star.isReal) acc.push(displayIdx);
      return acc;
    }, []);
    order.sort((a, b) => combined[a].realIdx - combined[b].realIdx);

    setCurrent(pick);
    setAllStars(combined);
    setCorrectOrder(order);
    setConnected([]);
    setFeedback(null);
    setWrongFlash(null);
    setMiniMsg(null);
    setMistakes(0);
    setShowGuide(difficulty === "easy");
  }, [difficulty]);

  useEffect(() => { loadConstellation(0); }, [loadConstellation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const realStarCount = allStars.filter(s => s.isReal).length;

  const clickStar = (displayIdx: number) => {
    if (connected.includes(displayIdx)) return;
    if (feedback) return;
    const star = allStars[displayIdx];

    if (!star.isReal) {
      setWrongFlash(displayIdx);
      setMistakes(m => m + 1);
      setMiniMsg("Not a constellation star! -" + wrongPenalty[difficulty] + "s");
      setTimeLeft(t => Math.max(1, t - wrongPenalty[difficulty]));
      setTimeout(() => { setWrongFlash(null); setMiniMsg(null); }, 800);
      return;
    }

    const nextExpected = correctOrder[connected.length];
    const newConnected = [...connected, displayIdx];
    setConnected(newConnected);

    if (displayIdx !== nextExpected) {
      setWrongFlash(displayIdx);
      setMiniMsg("Wrong order!");
      setTimeout(() => { setWrongFlash(null); setMiniMsg(null); }, 600);
    }

    if (newConnected.length === realStarCount) {
      let correctCount = 0;
      for (let i = 0; i < newConnected.length; i++) {
        if (newConnected[i] === correctOrder[i]) correctCount++;
      }
      const allCorrect = correctCount === newConnected.length;
      const basePoints = allCorrect ? realStarCount * 25 + 50 : correctCount * 15;
      const mistakePenalty = mistakes * 5;
      const pts = Math.max(5, basePoints - mistakePenalty);
      onScore(pts);
      setFeedback({
        text: allCorrect
          ? `Perfect! ${current?.fact}${mistakes > 0 ? ` (-${mistakePenalty} for ${mistakes} miss${mistakes > 1 ? "es" : ""})` : ""}`
          : `${correctCount}/${newConnected.length} in order (+${pts})`,
        correct: allCorrect && mistakes === 0
      });
      setTimeout(() => {
        setRound(r => {
          const nextRound = r + 1;
          setTimeout(() => loadConstellation(nextRound), 100);
          return nextRound;
        });
      }, 1800);
    }
  };

  if (!current) return null;

  const realConnected = connected.filter(idx => allStars[idx]?.isReal).length;

  return (
    <Card className="p-6 max-w-lg mx-auto border-border">
      <div className="flex justify-between items-center mb-3">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">⭐ {current.name}</Badge>
        {mistakes > 0 && <Badge variant="destructive" className="font-bold">Misses: {mistakes}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground text-center mb-1 font-medium">
        Find the constellation stars and click them in order! {decoyCount[difficulty] > 0 ? "Watch out for fake stars!" : ""}
      </p>
      {miniMsg && (
        <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-center text-xs font-bold text-red-500 mb-1">{miniMsg}</motion.p>
      )}

      <div className="relative bg-gradient-to-b from-indigo-950 to-slate-900 rounded-xl aspect-square mb-4 overflow-hidden">
        {showGuide && connected.length === 0 && correctOrder.map((displayIdx, i) => {
          if (i === 0) return null;
          const from = allStars[correctOrder[i - 1]];
          const to = allStars[displayIdx];
          return (
            <svg key={`guide-${i}`} className="absolute inset-0 w-full h-full pointer-events-none opacity-15">
              <line x1={`${from.x}%`} y1={`${from.y}%`} x2={`${to.x}%`} y2={`${to.y}%`} stroke="white" strokeWidth="1" strokeDasharray="4 4" />
            </svg>
          );
        })}

        {connected.length > 1 && connected.map((displayIdx, i) => {
          if (i === 0) return null;
          const from = allStars[connected[i - 1]];
          const to = allStars[displayIdx];
          return (
            <svg key={`line-${i}`} className="absolute inset-0 w-full h-full pointer-events-none">
              <line x1={`${from.x}%`} y1={`${from.y}%`} x2={`${to.x}%`} y2={`${to.y}%`} stroke="yellow" strokeWidth="2" />
            </svg>
          );
        })}

        {allStars.map((star, idx) => {
          const isConnected = connected.includes(idx);
          const isNext = showGuide && connected.length < correctOrder.length && correctOrder[connected.length] === idx;
          const isWrongFlash = wrongFlash === idx;
          return (
            <button
              key={idx}
              onClick={() => clickStar(idx)}
              className={`absolute w-6 h-6 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                isWrongFlash ? "bg-red-500 scale-150 shadow-lg shadow-red-500/60" :
                isConnected ? "bg-yellow-400 scale-125 shadow-lg shadow-yellow-400/50" :
                isNext ? "bg-white/80 animate-pulse scale-110" :
                "bg-white/60 hover:bg-white hover:scale-125"
              }`}
              style={{ left: `${star.x}%`, top: `${star.y}%` }}
              data-testid={`button-star-${idx}`}
            >
              {isConnected && <span className="text-[8px] font-black text-indigo-900">{connected.indexOf(idx) + 1}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>{realConnected}/{realStarCount} stars connected</span>
        {difficulty === "easy" && !showGuide && <button onClick={() => setShowGuide(true)} className="underline" data-testid="button-show-guide">Show guide</button>}
      </div>

      {feedback && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center font-bold text-sm mt-3 ${feedback.correct ? "text-green-500" : "text-yellow-500"}`}>
          {feedback.correct ? "⭐ " : "🌟 "}{feedback.text}
        </motion.p>
      )}
    </Card>
  );
}

function CellSurgeonGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const organelles = [
    { name: "Nucleus", emoji: "🟣", role: "Control center - contains DNA", fix: "Repair the nuclear membrane" },
    { name: "Mitochondria", emoji: "🔋", role: "Powerhouse - makes energy (ATP)", fix: "Restore ATP production" },
    { name: "Ribosome", emoji: "🔵", role: "Protein factory", fix: "Realign the mRNA reader" },
    { name: "Cell Membrane", emoji: "🛡️", role: "Gatekeeper - controls what enters/exits", fix: "Patch the phospholipid bilayer" },
    { name: "Endoplasmic Reticulum", emoji: "🌀", role: "Transport highway for proteins", fix: "Unclog the protein channels" },
    { name: "Golgi Body", emoji: "📦", role: "Packaging & shipping center", fix: "Recalibrate the vesicle sorter" },
    { name: "Lysosome", emoji: "♻️", role: "Recycling center - breaks down waste", fix: "Neutralize the enzyme leak" },
    { name: "Chloroplast", emoji: "🌿", role: "Photosynthesis (plant cells only)", fix: "Realign the thylakoid discs" },
    { name: "Vacuole", emoji: "💧", role: "Storage tank for water and nutrients", fix: "Seal the vacuole membrane" },
    { name: "Cytoplasm", emoji: "🧪", role: "Jelly filling that holds everything", fix: "Restore the cytoplasmic gel consistency" },
  ];

  const symptoms = [
    { symptom: "Cell has no energy!", answer: "Mitochondria", hint: "Which organelle makes ATP?" },
    { symptom: "DNA is exposed and damaged!", answer: "Nucleus", hint: "Where is DNA stored?" },
    { symptom: "Proteins aren't being made!", answer: "Ribosome", hint: "Which organelle reads mRNA?" },
    { symptom: "Toxins are flooding in!", answer: "Cell Membrane", hint: "What controls entry to the cell?" },
    { symptom: "Waste is piling up!", answer: "Lysosome", hint: "Which organelle digests waste?" },
    { symptom: "Proteins can't reach their destination!", answer: "Endoplasmic Reticulum", hint: "What transports proteins?" },
    { symptom: "Molecules aren't getting packaged!", answer: "Golgi Body", hint: "What packages proteins for export?" },
    { symptom: "Plant cell can't make food from sunlight!", answer: "Chloroplast", hint: "Where does photosynthesis occur?" },
    { symptom: "Cell is dehydrated - storage failed!", answer: "Vacuole", hint: "What stores water in cells?" },
  ];

  const timeLimit = { easy: 70, medium: 50, hard: 35 };
  const optionCount = { easy: 3, medium: 4, hard: 5 };
  const [timeLeft, setTimeLeft] = useState(timeLimit[difficulty] + extraTime);
  const [currentCase, setCurrentCase] = useState<typeof symptoms[0] | null>(null);
  const [options, setOptions] = useState<typeof organelles>([]);
  const [round, setRound] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean; detail?: string } | null>(null);
  const [usedCases, setUsedCases] = useState<number[]>([]);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const loadCase = () => {
    const available = symptoms.map((s, i) => ({ ...s, idx: i })).filter(s => !usedCases.includes(s.idx));
    if (available.length === 0) { onEnd(scoreRef.current); return; }
    const pick = available[Math.floor(Math.random() * available.length)];
    setCurrentCase(pick);
    setUsedCases(prev => [...prev, pick.idx]);

    const correctOrg = organelles.find(o => o.name === pick.answer)!;
    const wrongOrgs = organelles.filter(o => o.name !== pick.answer).sort(() => Math.random() - 0.5).slice(0, optionCount[difficulty] - 1);
    const allOptions = [correctOrg, ...wrongOrgs].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
    setShowHint(false);
    setFeedback(null);
    setRound(r => r + 1);
  };

  useEffect(() => { loadCase(); }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const diagnose = (orgName: string) => {
    if (!currentCase) return;
    const correct = orgName === currentCase.answer;
    const org = organelles.find(o => o.name === orgName)!;
    if (correct) {
      const streakBonus = streak >= 3 ? 15 : 0;
      onScore(25 + streakBonus);
      setStreak(s => s + 1);
      setFeedback({ text: `Correct diagnosis!`, correct: true, detail: `${org.emoji} ${org.fix}` });
    } else {
      setStreak(0);
      const correctOrg = organelles.find(o => o.name === currentCase.answer)!;
      setFeedback({ text: `Wrong! It was the ${correctOrg.name}`, correct: false, detail: correctOrg.role });
    }
    setTimeout(loadCase, 1800);
  };

  if (!currentCase) return null;

  return (
    <Card className="p-6 max-w-lg mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <div className="flex gap-2">
          <Badge variant="outline" className="font-bold">Case #{round}</Badge>
          {streak >= 2 && <Badge className="bg-orange-500 text-white font-bold text-[10px]">🔥 {streak}x streak</Badge>}
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-100 to-pink-200 dark:from-red-900/40 dark:to-pink-800/40 rounded-xl p-5 mb-4 text-center">
        <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-1 uppercase tracking-wider">⚠️ Patient Symptom</p>
        <h3 className="text-lg font-black">{currentCase.symptom}</h3>
        {!showHint && difficulty !== "easy" && (
          <button onClick={() => setShowHint(true)} className="text-xs text-muted-foreground underline mt-2">Need a hint?</button>
        )}
        {(showHint || difficulty === "easy") && (
          <p className="text-xs text-muted-foreground mt-2 font-medium">💡 {currentCase.hint}</p>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground font-semibold mb-3">Which organelle needs repair?</p>

      <div className="grid grid-cols-1 gap-2 mb-3">
        {options.map(org => (
          <Button
            key={org.name}
            onClick={() => diagnose(org.name)}
            variant="outline"
            className="h-auto py-3 justify-start gap-3 font-medium text-sm hover:scale-[1.02] transition-transform"
            data-testid={`button-organelle-${org.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <span className="text-xl">{org.emoji}</span>
            <div className="text-left">
              <span className="font-bold">{org.name}</span>
              {difficulty === "easy" && <p className="text-[10px] text-muted-foreground">{org.role}</p>}
            </div>
          </Button>
        ))}
      </div>

      {feedback && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className={`font-bold text-sm ${feedback.correct ? "text-green-500" : "text-red-500"}`}>
            {feedback.correct ? "✓ " : "✗ "}{feedback.text}
          </p>
          {feedback.detail && <p className="text-xs text-muted-foreground mt-1">{feedback.detail}</p>}
        </motion.div>
      )}
    </Card>
  );
}

function RocketEngineerGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const engines = [
    { name: "Ion Thruster", thrust: 15, weight: 5, cost: 80, desc: "Low thrust, very light" },
    { name: "Chemical Rocket", thrust: 55, weight: 30, cost: 150, desc: "Balanced option" },
    { name: "Nuclear Engine", thrust: 75, weight: 50, cost: 350, desc: "Strong but heavy" },
    { name: "Plasma Drive", thrust: 65, weight: 25, cost: 400, desc: "Efficient, costly" },
    { name: "Antimatter Core", thrust: 95, weight: 60, cost: 550, desc: "Max power, max cost" },
  ];

  const fuels = [
    { name: "Hydrogen", amount: 70, weight: 20, efficiency: 85, cost: 100 },
    { name: "Kerosene", amount: 55, weight: 35, efficiency: 60, cost: 60 },
    { name: "Solid Booster", amount: 90, weight: 55, efficiency: 40, cost: 80 },
    { name: "Xenon Gas", amount: 30, weight: 8, efficiency: 95, cost: 200 },
    { name: "Liquid Methane", amount: 65, weight: 25, efficiency: 75, cost: 140 },
  ];

  const shields = [
    { name: "None", protection: 0, weight: 0, cost: 0, desc: "No protection" },
    { name: "Basic Shield", protection: 30, weight: 15, cost: 100, desc: "Blocks light debris" },
    { name: "Thermal Shield", protection: 60, weight: 30, cost: 200, desc: "Handles re-entry" },
    { name: "Plasma Shield", protection: 90, weight: 45, cost: 350, desc: "Maximum protection" },
  ];

  const diffConfig = {
    easy: { missions: 3, budget: 900, targetMult: 1.0, hazardChance: 0.15, timerSec: 45 },
    medium: { missions: 4, budget: 750, targetMult: 1.3, hazardChance: 0.3, timerSec: 35 },
    hard: { missions: 5, budget: 600, targetMult: 1.6, hazardChance: 0.5, timerSec: 25 },
  };

  const missionTargets = [
    { name: "Satellite Deploy", target: 250, points: 80, minShield: 0 },
    { name: "Space Station Resupply", target: 350, points: 120, minShield: 20 },
    { name: "Lunar Orbit", target: 500, points: 180, minShield: 40 },
    { name: "Mars Transfer", target: 650, points: 250, minShield: 50 },
    { name: "Deep Space Probe", target: 800, points: 350, minShield: 70 },
  ];

  const cfg = diffConfig[difficulty];
  const [mission, setMission] = useState(0);
  const [budget, setBudget] = useState(cfg.budget);
  const [selectedEngine, setSelectedEngine] = useState<number | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<number | null>(null);
  const [selectedShield, setSelectedShield] = useState<number>(0);
  const [launched, setLaunched] = useState(false);
  const [launchResult, setLaunchResult] = useState<{ altitude: number; success: boolean; message: string; hazard: string | null } | null>(null);
  const [timeLeft, setTimeLeft] = useState(cfg.timerSec + extraTime);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    if (launched || mission >= cfg.missions) return;
    if (timeLeft <= 0) {
      onEnd(scoreRef.current);
      return;
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, launched, mission]);

  const curMission = missionTargets[mission % missionTargets.length];
  const scaledTarget = Math.round(curMission.target * cfg.targetMult);

  const totalCost = (selectedEngine !== null ? engines[selectedEngine].cost : 0) +
    (selectedFuel !== null ? fuels[selectedFuel].cost : 0) +
    shields[selectedShield].cost;
  const overBudget = totalCost > budget;

  const engine = selectedEngine !== null ? engines[selectedEngine] : null;
  const fuel = selectedFuel !== null ? fuels[selectedFuel] : null;
  const shield = shields[selectedShield];
  const totalWeight = (engine?.weight || 0) + (fuel?.weight || 0) + (shield?.weight || 0);

  const calculateLaunch = () => {
    if (selectedEngine === null || selectedFuel === null || overBudget) return;
    const e = engines[selectedEngine];
    const f = fuels[selectedFuel];
    const s = shields[selectedShield];

    const tWeight = e.weight + f.weight + s.weight;
    const thrustRatio = e.thrust / tWeight;
    const fuelEff = (f.amount * f.efficiency) / 100;
    const dragPenalty = 0.85 + Math.random() * 0.15;
    const rawAlt = thrustRatio * fuelEff * 8 * dragPenalty;

    const hazards = ["Micrometeorite shower!", "Solar flare interference!", "Debris field collision!", "Fuel line leak!"];
    const hitHazard = Math.random() < cfg.hazardChance;
    let hazardText: string | null = null;
    let altAfterHazard = rawAlt;
    if (hitHazard) {
      hazardText = hazards[Math.floor(Math.random() * hazards.length)];
      const protection = s.protection / 100;
      const damage = (1 - protection) * (0.3 + Math.random() * 0.3);
      altAfterHazard = rawAlt * (1 - damage);
    }

    const altitude = Math.round(altAfterHazard);
    const success = altitude >= scaledTarget && s.protection >= curMission.minShield;
    const failedShield = altitude >= scaledTarget && s.protection < curMission.minShield;

    let pts = 0;
    if (success) {
      const efficiency = Math.max(0, 1 - (totalCost / cfg.budget));
      pts = curMission.points + Math.round((altitude - scaledTarget) * 0.3) + Math.round(efficiency * 50);
      const timeBonus = Math.round(timeLeft * 2);
      pts += timeBonus;
    } else {
      pts = Math.round(altitude * 0.15);
    }
    onScore(pts);

    const newBudget = budget - totalCost;
    setBudget(newBudget);

    let msg = "";
    if (success) {
      msg = `${curMission.name} complete! Reached ${altitude}km (target: ${scaledTarget}km) (+${pts} pts)`;
    } else if (failedShield) {
      msg = `Reached ${altitude}km but shield too weak! Need ${curMission.minShield}% protection. (+${pts} pts)`;
    } else {
      msg = `Only ${altitude}km of ${scaledTarget}km needed. (+${pts} pts)`;
    }

    setLaunched(true);
    setLaunchResult({ altitude, success, message: msg, hazard: hazardText });

    setTimeout(() => {
      if (mission + 1 >= cfg.missions || newBudget <= 0) {
        onEnd(scoreRef.current + pts);
      } else {
        setMission(m => m + 1);
        setSelectedEngine(null);
        setSelectedFuel(null);
        setSelectedShield(0);
        setLaunched(false);
        setLaunchResult(null);
        setTimeLeft(cfg.timerSec);
      }
    }, 3000);
  };

  return (
    <Card className="p-6 max-w-lg mx-auto border-border">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <Badge variant="secondary" className="font-bold" data-testid="text-mission-num">🚀 Mission {mission + 1}/{cfg.missions}</Badge>
        <Badge variant="outline" className="font-bold text-[10px]" data-testid="text-mission-target">Target: {scaledTarget}km</Badge>
        <Badge variant={budget < 200 ? "destructive" : "secondary"} className="font-bold text-[10px]" data-testid="text-budget">💰 ${budget}</Badge>
        <Badge variant={timeLeft <= 10 ? "destructive" : "secondary"} className={`font-bold text-[10px] ${timeLeft <= 10 ? "animate-pulse" : ""}`} data-testid="text-timer">⏱ {timeLeft}s</Badge>
      </div>

      <div className="text-[10px] text-muted-foreground mb-3 p-2 bg-muted/50 rounded-lg">
        <p className="font-bold">{curMission.name}</p>
        <p>Min shield: {curMission.minShield}% | Budget left for all remaining missions!</p>
      </div>

      {!launched ? (
        <>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1.5 uppercase">Engine:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {engines.map((e, i) => {
                  const tooExpensive = (e.cost + (selectedFuel !== null ? fuels[selectedFuel].cost : 0) + shields[selectedShield].cost) > budget && selectedEngine !== i;
                  return (
                    <Button key={e.name} size="sm" variant={selectedEngine === i ? "default" : "outline"}
                      onClick={() => setSelectedEngine(i)} className={`h-auto py-1.5 text-[11px] font-bold ${tooExpensive ? "opacity-40" : ""}`} data-testid={`button-engine-${i}`}>
                      <div className="text-center">
                        <p>{e.name}</p>
                        <p className="text-[9px] opacity-75">T:{e.thrust} W:{e.weight} ${e.cost}</p>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1.5 uppercase">Fuel:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {fuels.map((f, i) => (
                  <Button key={f.name} size="sm" variant={selectedFuel === i ? "default" : "outline"}
                    onClick={() => setSelectedFuel(i)} className="h-auto py-1.5 text-[11px] font-bold" data-testid={`button-fuel-${i}`}>
                    <div className="text-center">
                      <p>{f.name}</p>
                      <p className="text-[9px] opacity-75">A:{f.amount} E:{f.efficiency}% ${f.cost}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1.5 uppercase">Shield:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {shields.map((s, i) => (
                  <Button key={s.name} size="sm" variant={selectedShield === i ? "default" : "outline"}
                    onClick={() => setSelectedShield(i)} className="h-auto py-1.5 text-[11px] font-bold" data-testid={`button-shield-${i}`}>
                    <div className="text-center">
                      <p>{s.name}</p>
                      <p className="text-[9px] opacity-75">Prot:{s.protection}% W:{s.weight} ${s.cost}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-muted text-xs font-medium space-y-0.5">
            <div className="flex justify-between">
              <span>Total Weight:</span><span className="font-bold">{totalWeight} units</span>
            </div>
            {engine && <div className="flex justify-between">
              <span>Thrust/Weight:</span><span className={`font-bold ${engine.thrust / (totalWeight || 1) < 1 ? "text-red-500" : "text-green-500"}`}>{(engine.thrust / (totalWeight || 1)).toFixed(2)}</span>
            </div>}
            <div className="flex justify-between">
              <span>Mission Cost:</span><span className={`font-bold ${overBudget ? "text-red-500" : ""}`}>${totalCost}{overBudget ? " (OVER BUDGET!)" : ""}</span>
            </div>
          </div>

          <Button
            onClick={calculateLaunch}
            disabled={selectedEngine === null || selectedFuel === null || overBudget}
            className="w-full mt-3 font-bold gap-2"
            data-testid="button-launch"
          >
            🚀 LAUNCH!
          </Button>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: launchResult?.success ? -30 : 0 }}
            transition={{ duration: 1.5 }}
            className="text-5xl mb-3"
          >
            🚀
          </motion.div>
          {launchResult && (
            <>
              {launchResult.hazard && (
                <Badge variant="destructive" className="mb-2 text-xs font-bold gap-1">⚠️ {launchResult.hazard}</Badge>
              )}
              <h3 className={`text-lg font-black mb-1.5 ${launchResult.success ? "text-green-500" : "text-orange-500"}`}>
                {launchResult.success ? "MISSION SUCCESS!" : "MISSION FAILED"}
              </h3>
              <p className="text-xs font-medium text-muted-foreground">{launchResult.message}</p>
            </>
          )}
        </motion.div>
      )}
    </Card>
  );
}

function SpeedQuizGame({ gameId, onScore, onEnd, score, yearLevel = 7, difficulty, extraTime, hasLuckyAnswer = false, hasScienceScanner = false, luckyAnswerLevel = 0 }: MiniGameProps & { gameId: string; yearLevel?: number; hasLuckyAnswer?: boolean; hasScienceScanner?: boolean; luckyAnswerLevel?: number }) {
  const questionsByYear: Record<number, { q: string; a: string; opts: string[] }[]> = {
    3: [
      { q: "What do plants need to grow?", a: "Sunlight and water", opts: ["Darkness", "Sunlight and water", "Ice", "Metal"] },
      { q: "Which animal lays eggs?", a: "Chicken", opts: ["Dog", "Cat", "Chicken", "Horse"] },
      { q: "What do we use our lungs for?", a: "Breathing", opts: ["Eating", "Breathing", "Walking", "Thinking"] },
      { q: "What colour is the sky on a sunny day?", a: "Blue", opts: ["Green", "Blue", "Red", "Yellow"] },
      { q: "Which part of a plant grows underground?", a: "Roots", opts: ["Leaves", "Roots", "Flowers", "Stem"] },
      { q: "What is rain made of?", a: "Water", opts: ["Milk", "Water", "Juice", "Sand"] },
      { q: "How many legs does a dog have?", a: "4", opts: ["2", "4", "6", "8"] },
      { q: "Which season is the hottest?", a: "Summer", opts: ["Winter", "Summer", "Autumn", "Spring"] },
      { q: "What do caterpillars turn into?", a: "Butterflies", opts: ["Spiders", "Butterflies", "Beetles", "Ants"] },
      { q: "Where does the Sun go at night?", a: "It doesn't move, Earth spins", opts: ["It sleeps", "It disappears", "It doesn't move, Earth spins", "It goes behind the Moon"] },
      { q: "What do we call frozen water?", a: "Ice", opts: ["Steam", "Ice", "Mud", "Cloud"] },
      { q: "Which animal can fly?", a: "Bird", opts: ["Fish", "Bird", "Cow", "Snake"] },
      { q: "Which sense do we use our nose for?", a: "Smell", opts: ["Seeing", "Hearing", "Smell", "Tasting"] },
      { q: "What do cows give us to drink?", a: "Milk", opts: ["Eggs", "Milk", "Honey", "Juice"] },
      { q: "How many legs does an insect have?", a: "6", opts: ["4", "6", "8", "2"] },
    ],
    4: [
      { q: "What planet do we live on?", a: "Earth", opts: ["Mars", "Earth", "Venus", "Jupiter"] },
      { q: "What is the biggest animal on Earth?", a: "Blue whale", opts: ["Elephant", "Blue whale", "Giraffe", "Shark"] },
      { q: "What do bees make?", a: "Honey", opts: ["Milk", "Honey", "Bread", "Juice"] },
      { q: "How many legs does a spider have?", a: "8", opts: ["6", "8", "10", "4"] },
      { q: "What keeps us stuck to the ground?", a: "Gravity", opts: ["Magnets", "Gravity", "Glue", "Wind"] },
      { q: "Which is NOT a state of matter?", a: "Energy", opts: ["Solid", "Liquid", "Gas", "Energy"] },
      { q: "What organ pumps blood around your body?", a: "Heart", opts: ["Brain", "Heart", "Lungs", "Stomach"] },
      { q: "What do we call a baby frog?", a: "Tadpole", opts: ["Cub", "Tadpole", "Kitten", "Chick"] },
      { q: "Which material is magnetic?", a: "Iron", opts: ["Wood", "Iron", "Plastic", "Paper"] },
      { q: "What is the Sun?", a: "A star", opts: ["A planet", "A star", "A moon", "A comet"] },
      { q: "What do we call animals that eat only plants?", a: "Herbivores", opts: ["Carnivores", "Herbivores", "Omnivores", "Predators"] },
      { q: "Which planet is famous for its rings?", a: "Saturn", opts: ["Mars", "Saturn", "Mercury", "Venus"] },
      { q: "What gas do we need to breathe in?", a: "Oxygen", opts: ["Carbon dioxide", "Oxygen", "Helium", "Hydrogen"] },
      { q: "Which part of a plant makes seeds?", a: "Flower", opts: ["Root", "Stem", "Flower", "Leaf"] },
      { q: "What is the closest star to Earth?", a: "The Sun", opts: ["The Moon", "The Sun", "Mars", "Sirius"] },
    ],
    5: [
      { q: "What gas do plants breathe in?", a: "Carbon dioxide", opts: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"] },
      { q: "What is H2O?", a: "Water", opts: ["Air", "Water", "Salt", "Sugar"] },
      { q: "Which planet is closest to the Sun?", a: "Mercury", opts: ["Venus", "Mercury", "Earth", "Mars"] },
      { q: "What force keeps us on the ground?", a: "Gravity", opts: ["Magnetism", "Gravity", "Friction", "Wind"] },
      { q: "Which state of matter is ice?", a: "Solid", opts: ["Liquid", "Solid", "Gas", "Plasma"] },
      { q: "How many planets are in our solar system?", a: "8", opts: ["7", "8", "9", "10"] },
      { q: "What do plants make during photosynthesis?", a: "Food and oxygen", opts: ["Water", "Food and oxygen", "Carbon dioxide", "Soil"] },
      { q: "What is the hardest natural material?", a: "Diamond", opts: ["Gold", "Diamond", "Iron", "Glass"] },
      { q: "Which part of the body controls thinking?", a: "Brain", opts: ["Heart", "Brain", "Lungs", "Bones"] },
      { q: "What causes day and night?", a: "Earth spinning", opts: ["The Moon", "Earth spinning", "Clouds", "The Sun moving"] },
      { q: "What do we call animals with a backbone?", a: "Vertebrates", opts: ["Invertebrates", "Vertebrates", "Mammals", "Insects"] },
      { q: "Which force slows down a sliding object?", a: "Friction", opts: ["Gravity", "Friction", "Magnetism", "Thrust"] },
      { q: "How long does Earth take to orbit the Sun?", a: "1 year", opts: ["1 day", "1 month", "1 year", "10 years"] },
      { q: "What do we call water turning into a gas?", a: "Evaporation", opts: ["Condensation", "Evaporation", "Freezing", "Melting"] },
      { q: "Which organ do fish use to breathe?", a: "Gills", opts: ["Lungs", "Gills", "Skin", "Fins"] },
    ],
    6: [
      { q: "What is the boiling point of water?", a: "100°C", opts: ["50°C", "100°C", "200°C", "0°C"] },
      { q: "What gas do we breathe out?", a: "Carbon dioxide", opts: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"] },
      { q: "Which organ controls your body?", a: "Brain", opts: ["Heart", "Brain", "Liver", "Lungs"] },
      { q: "What type of rock forms from lava?", a: "Igneous", opts: ["Sedimentary", "Igneous", "Metamorphic", "Limestone"] },
      { q: "What is the largest organ in the body?", a: "Skin", opts: ["Brain", "Skin", "Liver", "Heart"] },
      { q: "What is the chemical symbol for oxygen?", a: "O", opts: ["Ox", "O", "O2", "Og"] },
      { q: "Sound travels fastest through which material?", a: "Solids", opts: ["Air", "Solids", "Liquids", "Vacuum"] },
      { q: "What gives plants their green colour?", a: "Chlorophyll", opts: ["Cellulose", "Chlorophyll", "Carbon", "Calcium"] },
      { q: "What is the freezing point of water?", a: "0°C", opts: ["-10°C", "0°C", "10°C", "32°C"] },
      { q: "Which planet is known as the Red Planet?", a: "Mars", opts: ["Venus", "Mars", "Jupiter", "Saturn"] },
      { q: "What do we call molten rock under the ground?", a: "Magma", opts: ["Lava", "Magma", "Ash", "Crystal"] },
      { q: "Which blood cells fight infection?", a: "White blood cells", opts: ["Red blood cells", "White blood cells", "Platelets", "Plasma"] },
      { q: "Which planet is the largest?", a: "Jupiter", opts: ["Saturn", "Jupiter", "Neptune", "Earth"] },
      { q: "What is a group of the same atoms called?", a: "Element", opts: ["Mixture", "Element", "Compound", "Solution"] },
      { q: "What do we call the path a planet takes around the Sun?", a: "Orbit", opts: ["Axis", "Orbit", "Rotation", "Gravity"] },
    ],
    7: [
      { q: "Symbol 'Fe' is which element?", a: "Iron", opts: ["Iron", "Fluorine", "Fermium", "Francium"] },
      { q: "Symbol 'Au' is which element?", a: "Gold", opts: ["Gold", "Silver", "Aluminum", "Argon"] },
      { q: "Symbol 'Na' is which element?", a: "Sodium", opts: ["Nitrogen", "Sodium", "Neon", "Nickel"] },
      { q: "Symbol 'Hg' is which element?", a: "Mercury", opts: ["Mercury", "Helium", "Hydrogen", "Hafnium"] },
      { q: "Atomic number 1 is?", a: "Hydrogen", opts: ["Helium", "Hydrogen", "Lithium", "Boron"] },
      { q: "Symbol 'K' is which element?", a: "Potassium", opts: ["Krypton", "Potassium", "Calcium", "Carbon"] },
      { q: "Which is a noble gas?", a: "Neon", opts: ["Nitrogen", "Neon", "Sodium", "Nickel"] },
      { q: "Lightest element?", a: "Hydrogen", opts: ["Helium", "Hydrogen", "Lithium", "Carbon"] },
      { q: "What is photosynthesis?", a: "Plants making food from sunlight", opts: ["Plants making food from sunlight", "Animals breathing", "Rocks forming", "Water evaporating"] },
      { q: "What particle has a negative charge?", a: "Electron", opts: ["Proton", "Electron", "Neutron", "Photon"] },
      { q: "What is the charge of a neutron?", a: "Neutral", opts: ["Positive", "Negative", "Neutral", "Changing"] },
      { q: "Which organ filters waste from your blood?", a: "Kidney", opts: ["Liver", "Kidney", "Lung", "Heart"] },
      { q: "What type of energy does a moving object have?", a: "Kinetic", opts: ["Potential", "Kinetic", "Chemical", "Thermal"] },
      { q: "Which planet appears to spin on its side?", a: "Uranus", opts: ["Neptune", "Uranus", "Saturn", "Mars"] },
      { q: "What is the chemical formula for table salt?", a: "NaCl", opts: ["NaCl", "KCl", "HCl", "NaOH"] },
    ],
    8: [
      { q: "What is the pH of a neutral solution?", a: "7", opts: ["0", "7", "14", "1"] },
      { q: "What is the powerhouse of the cell?", a: "Mitochondria", opts: ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"] },
      { q: "What is Newton's first law about?", a: "Inertia", opts: ["Gravity", "Inertia", "Acceleration", "Magnetism"] },
      { q: "What is an isotope?", a: "Same element, different neutrons", opts: ["Same element, different neutrons", "Different element", "A type of molecule", "A charged atom"] },
      { q: "What type of wave is sound?", a: "Longitudinal", opts: ["Transverse", "Longitudinal", "Electromagnetic", "Standing"] },
      { q: "What is the formula for speed?", a: "Distance ÷ Time", opts: ["Force × Mass", "Distance ÷ Time", "Mass × Acceleration", "Energy ÷ Power"] },
      { q: "What bonds share electrons?", a: "Covalent", opts: ["Ionic", "Covalent", "Metallic", "Hydrogen"] },
      { q: "DNA stands for?", a: "Deoxyribonucleic acid", opts: ["Deoxyribonucleic acid", "Dynamic nuclear acid", "Dual nitrogen acid", "Direct nucleic acid"] },
      { q: "What is the unit of force?", a: "Newton", opts: ["Joule", "Newton", "Watt", "Pascal"] },
      { q: "Which gas makes up most of our atmosphere?", a: "Nitrogen", opts: ["Oxygen", "Nitrogen", "Carbon dioxide", "Argon"] },
      { q: "What is the SI unit of energy?", a: "Joule", opts: ["Newton", "Joule", "Watt", "Pascal"] },
      { q: "Which subatomic particle decides which element an atom is?", a: "Protons", opts: ["Electrons", "Protons", "Neutrons", "Photons"] },
      { q: "What is Newton's second law?", a: "F = ma", opts: ["E = mc²", "F = ma", "V = IR", "PV = nRT"] },
      { q: "How do plants lose water through their leaves?", a: "Transpiration", opts: ["Respiration", "Transpiration", "Digestion", "Condensation"] },
      { q: "What does Ohm's law state?", a: "V = IR", opts: ["V = IR", "F = ma", "E = mc²", "P = IV"] },
    ],
    9: [
      { q: "What is the acceleration due to gravity on Earth?", a: "9.8 m/s²", opts: ["1.6 m/s²", "9.8 m/s²", "100 m/s²", "3.7 m/s²"] },
      { q: "What pH range do acids have?", a: "Below 7", opts: ["Below 7", "Exactly 7", "Above 7", "Above 14"] },
      { q: "What is the chemical formula for carbon dioxide?", a: "CO₂", opts: ["CO", "CO₂", "C₂O", "CaCO₃"] },
      { q: "Which molecule stores energy for use in cells?", a: "ATP", opts: ["DNA", "ATP", "RNA", "NaCl"] },
      { q: "Which law says energy cannot be created or destroyed?", a: "Conservation of energy", opts: ["Newton's first law", "Conservation of energy", "Ohm's law", "Boyle's law"] },
      { q: "What is the unit of frequency?", a: "Hertz", opts: ["Decibel", "Hertz", "Watt", "Joule"] },
      { q: "What kind of reaction releases heat?", a: "Exothermic", opts: ["Endothermic", "Exothermic", "Neutral", "Catalytic"] },
      { q: "Which group contains the most reactive metals?", a: "Alkali metals", opts: ["Noble gases", "Alkali metals", "Halogens", "Transition metals"] },
      { q: "What force holds the nucleus of an atom together?", a: "Strong nuclear force", opts: ["Gravity", "Strong nuclear force", "Friction", "Magnetism"] },
      { q: "What is the speed of light in a vacuum?", a: "300,000 km/s", opts: ["300 km/s", "30,000 km/s", "300,000 km/s", "3,000 km/s"] },
    ],
  };

  const yr = yearLevel || 7;
  const elementQuestions = (questionsByYear[yr] || questionsByYear[7]);

  const quizSettings = {
    easy: { time: 45, correctBonus: 5, wrongPenalty: 1 },
    medium: { time: 30, correctBonus: 3, wrongPenalty: 2 },
    hard: { time: 20, correctBonus: 2, wrongPenalty: 3 },
  };
  const qs = quizSettings[difficulty];
  const [questions] = useState(() =>
    elementQuestions
      .sort(() => Math.random() - 0.5)
      .map(q => ({ ...q, opts: [...q.opts].sort(() => Math.random() - 0.5) }))
  );
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(qs.time + extraTime);
  const [combo, setCombo] = useState(0);
  const [review, setReview] = useState<{ chosen: string; correct: boolean; exp: string } | null>(null);
  const reviewRef = useRef(false);
  reviewRef.current = !!review;
  const [luckyUsesLeft, setLuckyUsesLeft] = useState(() => hasLuckyAnswer ? (1 + luckyAnswerLevel) : 0);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const scienceTopics: Record<string, string> = {
    "What planet do we live on?": "Astronomy",
    "What gas do plants breathe in?": "Biology",
    "How many legs does a spider have?": "Biology",
    "What is H2O?": "Chemistry",
    "Which planet is closest to the Sun?": "Astronomy",
    "What force keeps us on the ground?": "Physics",
    "What do plants need to grow?": "Biology",
    "Which state of matter is ice?": "Physics",
    "What organ pumps blood?": "Biology",
    "How many planets are in our solar system?": "Astronomy",
    "What is the boiling point of water?": "Chemistry",
    "What gas do we breathe out?": "Biology",
    "Which organ controls your body?": "Biology",
    "What type of rock forms from lava?": "Earth Science",
    "What is the largest organ in the body?": "Biology",
    "What is the chemical symbol for oxygen?": "Chemistry",
    "Sound travels fastest through which material?": "Physics",
    "What gives plants their green colour?": "Biology",
    "What is the freezing point of water?": "Chemistry",
    "Which planet is known as the Red Planet?": "Astronomy",
    "Symbol 'Fe' is which element?": "Chemistry",
    "Symbol 'Au' is which element?": "Chemistry",
    "Symbol 'Na' is which element?": "Chemistry",
    "Symbol 'Hg' is which element?": "Chemistry",
    "Atomic number 1 is?": "Chemistry",
    "Symbol 'K' is which element?": "Chemistry",
    "Which is a noble gas?": "Chemistry",
    "Lightest element?": "Chemistry",
    "What is photosynthesis?": "Biology",
    "What particle has a negative charge?": "Physics",
    "What is the pH of a neutral solution?": "Chemistry",
    "What is the powerhouse of the cell?": "Biology",
    "What is Newton's first law about?": "Physics",
    "What is an isotope?": "Chemistry",
    "What type of wave is sound?": "Physics",
    "What is the formula for speed?": "Physics",
    "What bonds share electrons?": "Chemistry",
    "DNA stands for?": "Biology",
    "What is the unit of force?": "Physics",
    "Which gas makes up most of our atmosphere?": "Earth Science",
    "What is Avogadro's number?": "Chemistry",
    "What is the formula for kinetic energy?": "Physics",
    "What organelle does photosynthesis?": "Biology",
    "What is an exothermic reaction?": "Chemistry",
    "What is the unit of electrical resistance?": "Physics",
    "What is the process of cell division called?": "Biology",
    "E = mc² was proposed by?": "Physics",
    "What is the charge of a proton?": "Physics",
    "What is the molar mass of water?": "Chemistry",
    "Ohm's law states V = ?": "Physics",
  };

  const [filteredOpts, setFilteredOpts] = useState(() => {
    if (questions.length > 0) return questions[0].opts;
    return [];
  });

  useEffect(() => {
    const timer = setInterval(() => {
      // Pause the countdown while the player is reading the explanation —
      // reviewing what you got wrong should never cost you time.
      if (reviewRef.current) return;
      setTimeLeft((t) => {
        if (t <= 0) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const answer = (choice: string) => {
    if (review) return; // already answered this question — waiting for "Next"
    if (current >= questions.length) { onEnd(scoreRef.current); return; }
    const q = questions[current];
    const isCorrect = choice === q.a;
    if (isCorrect) {
      const pts = 15 + combo * 5;
      onScore(pts);
      setCombo((c) => c + 1);
      setTimeLeft((t) => Math.min(t + qs.correctBonus, 60));
    } else {
      setCombo(0);
      setTimeLeft((t) => Math.max(t - qs.wrongPenalty, 0));
    }
    setReview({ chosen: choice, correct: isCorrect, exp: getQuizExplanation(q.q, q.a) });
  };

  const nextQuestion = () => {
    setReview(null);
    if (current + 1 >= questions.length) {
      onEnd(scoreRef.current);
    } else {
      const nextQ = questions[current + 1];
      setFilteredOpts(nextQ.opts);
      setCurrent((c) => c + 1);
    }
  };

  const useLucky = () => {
    if (luckyUsesLeft <= 0 || !hasLuckyAnswer) return;
    setLuckyUsesLeft(prev => prev - 1);
    const q = questions[current];
    const wrongOpts = filteredOpts.filter(o => o !== q.a);
    if (wrongOpts.length <= 1) return;
    const removeIdx = Math.floor(Math.random() * wrongOpts.length);
    const removed = wrongOpts[removeIdx];
    setFilteredOpts(filteredOpts.filter(o => o !== removed));
  };

  if (current >= questions.length) return null;
  const q = questions[current];
  const topic = hasScienceScanner ? (scienceTopics[q.q] || "Science") : null;

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant={review ? "outline" : timeLeft < 10 ? "destructive" : "secondary"} className="font-bold">
          <Timer className="w-3 h-3 mr-1" /> {review ? "paused" : `${timeLeft}s`}
        </Badge>
        <div className="flex gap-2 items-center">
          {hasLuckyAnswer && (
            <Button
              size="sm"
              variant={luckyUsesLeft <= 0 ? "ghost" : "secondary"}
              disabled={luckyUsesLeft <= 0}
              onClick={useLucky}
              className="text-xs h-7 px-2"
              data-testid="button-lucky-answer"
            >
              Lucky {luckyAnswerLevel > 0 ? `(${luckyUsesLeft})` : "Answer"}
            </Button>
          )}
          <Badge variant="outline" className="font-bold">Combo: {combo}x</Badge>
        </div>
      </div>

      {topic && (
        <div className="text-center mb-2">
          <Badge variant="secondary" className="text-xs" data-testid="badge-science-topic">
            Topic: {topic}
          </Badge>
        </div>
      )}

      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground mb-2">{current + 1}/{questions.length}</p>
        <h3 className="text-lg font-bold">{q.q}</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {filteredOpts.map((opt) => {
          const isAnswer = opt === q.a;
          const isChosen = review?.chosen === opt;
          let stateClass = "";
          if (review) {
            if (isAnswer) stateClass = "bg-green-500 text-white border-green-500 hover:bg-green-500";
            else if (isChosen) stateClass = "bg-red-500 text-white border-red-500 hover:bg-red-500";
            else stateClass = "opacity-50";
          }
          return (
            <Button
              key={opt}
              variant="outline"
              className={`h-14 font-bold text-sm ${stateClass}`}
              disabled={!!review}
              onClick={() => answer(opt)}
              data-testid={`button-answer-${opt}`}
            >
              {opt}
            </Button>
          );
        })}
      </div>

      {review && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <div className={`rounded-xl p-3 text-sm ${review.correct ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
            <p className="font-bold mb-1" data-testid="text-quiz-verdict">
              {review.correct ? "✅ Correct!" : `Not quite — the answer is "${q.a}"`}
            </p>
            <p className="opacity-90"><span className="font-semibold">Why? </span>{review.exp}</p>
          </div>
          <Button className="w-full mt-3 font-bold" onClick={nextQuestion} data-testid="button-quiz-next">
            {current + 1 >= questions.length ? "Finish" : "Next →"}
          </Button>
        </motion.div>
      )}
    </Card>
  );
}

function ClickerGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const ct = gameId ? CLICKER_THEMES[gameId] : null;
  const clickerTime = { easy: 60, medium: 45, hard: 30 };
  const [organisms, setOrganisms] = useState<{ id: number; type: string; x: number; y: number; emoji: string }[]>([]);
  const [balance, setBalance] = useState(50);
  const [timeLeft, setTimeLeft] = useState(clickerTime[difficulty] + extraTime);
  const nextId = useRef(0);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const { user } = useAuth();
  const clickTimestamps = useRef<number[]>([]);
  const reportedRef = useRef(false);
  const [flagged, setFlagged] = useState(false);

  const recordClick = () => {
    const now = Date.now();
    const ts = clickTimestamps.current;
    ts.push(now);
    if (ts.length > 30) ts.shift();
    if (reportedRef.current || ts.length < 12) return;
    const recent = ts.slice(-12);
    const intervals = recent.slice(1).map((t, i) => t - recent[i]);
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(intervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / intervals.length);
    const tooFast = mean < 80;
    const tooUniform = stdDev < 25;
    if (tooFast && tooUniform && user) {
      reportedRef.current = true;
      setFlagged(true);
      apiRequest("POST", "/api/report/suspicious", {
        reason: "autoclicker_detected",
        details: `Clicker game: mean interval ${Math.round(mean)}ms, stdDev ${Math.round(stdDev)}ms over 12 clicks`,
      }).catch(() => {});
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const producers = organisms.filter((o) => o.type === "producer").length;
      const consumers = organisms.filter((o) => o.type === "consumer").length;
      const decomposers = organisms.filter((o) => o.type === "decomposer").length;
      const total = organisms.length;

      let newBalance = 50;
      if (producers > 0) newBalance += producers * 10;
      if (consumers > 0) newBalance -= consumers * 15;
      if (decomposers > 0) newBalance += decomposers * 5;
      newBalance = Math.max(0, Math.min(100, newBalance));

      if (newBalance >= 35 && newBalance <= 75 && total > 0) {
        const diversityBonus = (producers > 0 && consumers > 0 && decomposers > 0) ? 5 : 0;
        const sizeBonus = Math.min(Math.floor(total / 3), 5);
        onScore(10 + diversityBonus + sizeBonus);
      }
      setBalance(newBalance);
    }, 1500);
    return () => clearInterval(interval);
  }, [organisms]);

  const addOrganism = (type: string, emoji: string) => {
    recordClick();
    setOrganisms((prev) => [
      ...prev,
      { id: nextId.current++, type, x: 50 + Math.random() * 200, y: 30 + Math.random() * 180, emoji },
    ]);
  };

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant={balance >= 35 && balance <= 75 ? "default" : "destructive"} className="font-bold">
          {ct?.balanceLabel || "Balance"}: {balance}%
        </Badge>
      </div>

      {flagged && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/40 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2" data-testid="autoclicker-warning">
          ⚠️ Unusual click pattern detected. Admins have been notified.
        </div>
      )}

      <div className={`relative w-full h-60 rounded-xl bg-gradient-to-b ${ct ? ct.bgGradient : "from-sky-200 to-green-300 dark:from-sky-900 dark:to-green-900"} mb-4 overflow-hidden`}>
        {organisms.map((o) => (
          <motion.div
            key={o.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1, x: [0, Math.random() * 10 - 5, 0], y: [0, Math.random() * 10 - 5, 0] }}
            transition={{ x: { repeat: Infinity, duration: 2 }, y: { repeat: Infinity, duration: 3 } }}
            className="absolute text-2xl cursor-pointer"
            style={{ left: o.x, top: o.y }}
            onClick={() => { recordClick(); setOrganisms((prev) => prev.filter((p) => p.id !== o.id)); }}
          >
            {o.emoji}
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center mb-3 font-medium">
        {balance >= 35 && balance <= 75 ? (ct?.balancedMsg || "Ecosystem balanced! Earning points!") : (ct?.unbalancedMsg || "Ecosystem unbalanced! Adjust your organisms!")}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="font-bold text-sm" onClick={() => addOrganism("producer", ct?.producers.emoji || "🌿")} data-testid="button-add-plant">
          {ct?.producers.label || "🌿 Plant"}
        </Button>
        <Button variant="outline" className="font-bold text-sm" onClick={() => addOrganism("consumer", ct?.consumers.emoji || "🐰")} data-testid="button-add-animal">
          {ct?.consumers.label || "🐰 Animal"}
        </Button>
        <Button variant="outline" className="font-bold text-sm" onClick={() => addOrganism("decomposer", ct?.decomposers.emoji || "🍄")} data-testid="button-add-decomposer">
          {ct?.decomposers.label || "🍄 Fungi"}
        </Button>
      </div>
    </Card>
  );
}

function LauncherGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const lt = gameId ? LAUNCHER_THEMES[gameId] : null;
  const launcherShots = { easy: 8, medium: 5, hard: 3 };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(50);
  const [shots, setShots] = useState(launcherShots[difficulty]);
  const [targets, setTargets] = useState<{ x: number; y: number; hit: boolean }[]>([]);
  const [projectile, setProjectile] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [round, setRound] = useState(1);
  const [bonusMsg, setBonusMsg] = useState("");
  const animRef = useRef<number>();
  const scoreRef = useRef(score);
  const endedRef = useRef(false);
  const roundClearedRef = useRef(false);
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  scoreRef.current = score;

  useEffect(() => {
    spawnTargets(1);
  }, []);

  const spawnTargets = (r: number) => {
    const count = Math.min(3 + Math.floor((r - 1) / 2), 6);
    const newTargets = [];
    for (let i = 0; i < count; i++) {
      const x = 150 + Math.random() * 400;
      const y = 200 + Math.random() * 130;
      newTargets.push({ x, y, hit: false });
    }
    setTargets(newTargets);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const draw = () => {
      ctx.clearRect(0, 0, 600, 400);

      const bg = ctx.createLinearGradient(0, 0, 0, 400);
      bg.addColorStop(0, lt?.bgGradient?.[0] || "#87ceeb");
      bg.addColorStop(1, lt?.bgGradient?.[1] || "#90ee90");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 600, 400);

      ctx.fillStyle = lt?.groundColor || "#654321";
      ctx.fillRect(0, 350, 600, 50);

      ctx.save();
      ctx.translate(50, 340);
      ctx.rotate(-angle * Math.PI / 180);
      ctx.fillStyle = lt?.projectileAccent || "#333";
      ctx.fillRect(0, -5, 40, 10);
      ctx.restore();
      ctx.fillStyle = lt?.projectileColor || "#555";
      ctx.beginPath();
      ctx.arc(50, 340, 15, 0, Math.PI * 2);
      ctx.fill();

      for (const t of targets) {
        if (!t.hit) {
          ctx.fillStyle = lt?.targetColor || "#ef4444";
          ctx.beginPath();
          ctx.arc(t.x, t.y, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = lt?.targetAccent || "#ef4444";
          ctx.beginPath();
          ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (projectile) {
        ctx.fillStyle = lt?.projectileColor || "#333";
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [angle, targets, projectile]);

  useEffect(() => {
    if (!projectile) return;
    const interval = setInterval(() => {
      setProjectile((p) => {
        if (!p) return null;
        const nx = p.x + p.vx;
        const ny = p.y + p.vy;
        const nvy = p.vy + 0.3;

        if (ny > 360 || nx > 620) {
          clearInterval(interval);
          return null;
        }

        for (const t of targets) {
          if (!t.hit && Math.hypot(nx - t.x, ny - t.y) < 20) {
            t.hit = true;
            onScore(30);
            setTargets([...targets]);
          }
        }

        return { x: nx, y: ny, vx: p.vx, vy: nvy };
      });
    }, 16);
    return () => clearInterval(interval);
  }, [projectile]);

  const allTargetsHit = targets.length > 0 && targets.every((t) => t.hit);

  useEffect(() => {
    if (allTargetsHit && !endedRef.current) {
      roundClearedRef.current = true;
      if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);
      const bonus = shots * 15;
      if (bonus > 0) {
        onScore(bonus);
        setBonusMsg(`Round ${round} clear! +${bonus} bonus for ${shots} extra shot${shots > 1 ? "s" : ""}!`);
      } else {
        setBonusMsg(`Round ${round} clear!`);
      }
      setTimeout(() => {
        const nextRound = round + 1;
        setRound(nextRound);
        spawnTargets(nextRound);
        setShots(launcherShots[difficulty]);
        setProjectile(null);
        roundClearedRef.current = false;
        setTimeout(() => setBonusMsg(""), 1500);
      }, 1200);
    }
  }, [allTargetsHit]);

  const launch = () => {
    if (shots <= 0 || allTargetsHit || endedRef.current) {
      if (!endedRef.current && shots <= 0 && !roundClearedRef.current) { endedRef.current = true; onEnd(scoreRef.current); }
      return;
    }
    const rad = angle * Math.PI / 180;
    const speed = power / 8;
    setProjectile({ x: 50, y: 340, vx: Math.cos(rad) * speed, vy: -Math.sin(rad) * speed });
    setShots((s) => {
      const newS = s - 1;
      if (newS <= 0) {
        endTimeoutRef.current = setTimeout(() => {
          if (!endedRef.current && !roundClearedRef.current) {
            endedRef.current = true;
            onEnd(scoreRef.current);
          }
        }, 2000);
      }
      return newS;
    });
  };

  return (
    <div className="max-w-[600px] mx-auto">
      {lt?.label && (
        <p className="text-center text-sm font-bold text-purple-400 mb-2" data-testid="text-launcher-label">{lt.label}</p>
      )}
      <div className="flex justify-between items-center mb-3">
        <Badge variant="secondary" className="font-bold">{lt?.projectileName ? `${lt.projectileName}: ${shots}` : `Shots: ${shots}`}</Badge>
        <Badge className="font-bold bg-purple-600 text-white border-0">Round {round}</Badge>
        <Badge variant="outline" className="font-bold">
          {lt?.targetName || "Targets"}: {targets.filter((t) => t.hit).length}/{targets.length}
        </Badge>
      </div>
      {bonusMsg && (
        <div className="text-center mb-3 p-2 rounded-lg bg-green-500/20 border border-green-500/30">
          <p className="text-green-600 dark:text-green-400 font-black text-lg">
            {bonusMsg}
          </p>
        </div>
      )}
      <canvas ref={canvasRef} width={600} height={400} className="rounded-xl border-2 border-border w-full" data-testid="launcher-canvas" />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-sm font-bold mb-1">Angle: {angle}°</p>
          <input type="range" min={10} max={80} value={angle} onChange={(e) => setAngle(+e.target.value)} className="w-full" data-testid="slider-angle" />
        </div>
        <div>
          <p className="text-sm font-bold mb-1">Power: {power}%</p>
          <input type="range" min={10} max={100} value={power} onChange={(e) => setPower(+e.target.value)} className="w-full" data-testid="slider-power" />
        </div>
      </div>
      <Button onClick={launch} className="w-full mt-3 font-bold" disabled={shots <= 0 || allTargetsHit} data-testid="button-launch">
        Launch!
      </Button>
    </div>
  );
}

function SpaceInvadersGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const ds = {
    easy: { shipSpeed: 8, enemyCols: 5, enemyRows: 3, enemySpeed: 0.4, fireRate: 0.003, bulletSpeed: 4 },
    medium: { shipSpeed: 7, enemyCols: 6, enemyRows: 4, enemySpeed: 0.6, fireRate: 0.006, bulletSpeed: 5 },
    hard: { shipSpeed: 6, enemyCols: 7, enemyRows: 4, enemySpeed: 0.8, fireRate: 0.01, bulletSpeed: 6 },
  }[difficulty];

  const W = 600, H = 400;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const stateRef = useRef({
    shipX: W / 2,
    bullets: [] as { x: number; y: number }[],
    enemyBullets: [] as { x: number; y: number }[],
    enemies: [] as { x: number; y: number; alive: boolean; type: number }[],
    enemyDir: 1,
    enemyOffsetX: 0,
    enemyOffsetY: 0,
    wave: 1,
    lives: 3,
    keys: {} as Record<string, boolean>,
    lastShot: 0,
    ended: false,
    score: score,
    waveCleared: false,
    waveClearTimer: 0,
  });
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const spawnEnemies = useCallback((wave: number) => {
    const s = stateRef.current;
    const rows = Math.min(ds.enemyRows + Math.floor((wave - 1) / 3), 6);
    const cols = Math.min(ds.enemyCols + Math.floor((wave - 1) / 2), 9);
    const enemies: typeof s.enemies = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({ x: 60 + c * 55, y: 30 + r * 40, alive: true, type: r % 3 });
      }
    }
    s.enemies = enemies;
    s.enemyDir = 1;
    s.enemyOffsetX = 0;
    s.enemyOffsetY = 0;
    s.enemyBullets = [];
    s.waveCleared = false;
  }, [ds]);

  useEffect(() => {
    spawnEnemies(1);
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key] = true;
      if (["ArrowLeft", "ArrowRight", " ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
    };
    const handleKeyUp = (e: KeyboardEvent) => { stateRef.current.keys[e.key] = false; };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const gameLoop = () => {
      const s = stateRef.current;
      if (s.ended) return;

      if (s.keys["ArrowLeft"] || s.keys["a"]) s.shipX = Math.max(20, s.shipX - ds.shipSpeed);
      if (s.keys["ArrowRight"] || s.keys["d"]) s.shipX = Math.min(W - 20, s.shipX + ds.shipSpeed);

      const now = Date.now();
      if ((s.keys[" "] || s.keys["ArrowUp"]) && now - s.lastShot > 250) {
        s.bullets.push({ x: s.shipX, y: H - 50 });
        s.lastShot = now;
      }

      s.bullets = s.bullets.filter(b => { b.y -= ds.bulletSpeed; return b.y > 0; });

      if (!s.waveCleared) {
        s.enemyOffsetX += ds.enemySpeed * s.enemyDir * (1 + (s.wave - 1) * 0.15);
        const rightmost = Math.max(...s.enemies.filter(e => e.alive).map(e => e.x + s.enemyOffsetX));
        const leftmost = Math.min(...s.enemies.filter(e => e.alive).map(e => e.x + s.enemyOffsetX));
        if (rightmost > W - 30 || leftmost < 30) {
          s.enemyDir *= -1;
          s.enemyOffsetY += 12;
        }

        for (const e of s.enemies) {
          if (!e.alive) continue;
          if (Math.random() < ds.fireRate * (1 + (s.wave - 1) * 0.1)) {
            s.enemyBullets.push({ x: e.x + s.enemyOffsetX, y: e.y + s.enemyOffsetY + 15 });
          }
        }
      }

      s.enemyBullets = s.enemyBullets.filter(b => { b.y += 3; return b.y < H; });

      for (const b of s.bullets) {
        for (const e of s.enemies) {
          if (!e.alive) continue;
          const ex = e.x + s.enemyOffsetX;
          const ey = e.y + s.enemyOffsetY;
          if (Math.abs(b.x - ex) < 18 && Math.abs(b.y - ey) < 15) {
            e.alive = false;
            b.y = -100;
            const pts = (e.type === 0 ? 30 : e.type === 1 ? 20 : 10);
            s.score += pts;
            onScore(pts);
          }
        }
      }

      for (const b of s.enemyBullets) {
        if (Math.abs(b.x - s.shipX) < 18 && Math.abs(b.y - (H - 40)) < 15) {
          s.lives--;
          b.y = H + 100;
          if (s.lives <= 0) {
            s.ended = true;
            onEnd(s.score);
            return;
          }
        }
      }

      const bottomEnemy = Math.max(...s.enemies.filter(e => e.alive).map(e => e.y + s.enemyOffsetY), 0);
      if (bottomEnemy > H - 70) {
        s.ended = true;
        onEnd(s.score);
        return;
      }

      if (!s.waveCleared && s.enemies.every(e => !e.alive)) {
        s.waveCleared = true;
        s.waveClearTimer = now;
        const waveBonus = s.wave * 50;
        s.score += waveBonus;
        onScore(waveBonus);
      }

      if (s.waveCleared && now - s.waveClearTimer > 2000) {
        s.wave++;
        spawnEnemies(s.wave);
      }

      ctx.fillStyle = "#0a0a2e";
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`;
        const sx = (i * 97 + s.wave * 13) % W;
        const sy = (i * 53 + s.wave * 7) % H;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      const shipColors = ["#00ff88", "#00ccff", "#ff6600"];
      ctx.fillStyle = shipColors[(s.wave - 1) % 3];
      ctx.beginPath();
      ctx.moveTo(s.shipX, H - 50);
      ctx.lineTo(s.shipX - 18, H - 30);
      ctx.lineTo(s.shipX + 18, H - 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(s.shipX - 2, H - 55, 4, 8);

      ctx.shadowBlur = 6;
      ctx.shadowColor = "#00ff88";
      for (const b of s.bullets) {
        ctx.fillStyle = "#00ff88";
        ctx.fillRect(b.x - 1.5, b.y, 3, 10);
      }
      ctx.shadowBlur = 0;

      ctx.shadowBlur = 4;
      ctx.shadowColor = "#ff4444";
      for (const b of s.enemyBullets) {
        ctx.fillStyle = "#ff4444";
        ctx.fillRect(b.x - 1.5, b.y, 3, 8);
      }
      ctx.shadowBlur = 0;

      const enemyEmojis = ["#ff3333", "#ff9900", "#cc66ff"];
      for (const e of s.enemies) {
        if (!e.alive) continue;
        const ex = e.x + s.enemyOffsetX;
        const ey = e.y + s.enemyOffsetY;
        ctx.fillStyle = enemyEmojis[e.type];
        ctx.beginPath();
        ctx.moveTo(ex, ey - 12);
        ctx.lineTo(ex - 15, ey + 8);
        ctx.lineTo(ex - 8, ey + 4);
        ctx.lineTo(ex - 12, ey + 12);
        ctx.lineTo(ex - 4, ey + 6);
        ctx.lineTo(ex, ey + 10);
        ctx.lineTo(ex + 4, ey + 6);
        ctx.lineTo(ex + 12, ey + 12);
        ctx.lineTo(ex + 8, ey + 4);
        ctx.lineTo(ex + 15, ey + 8);
        ctx.closePath();
        ctx.fill();
      }

      if (s.waveCleared) {
        ctx.fillStyle = "rgba(0,255,136,0.9)";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`WAVE ${s.wave} CLEARED! +${s.wave * 50}`, W / 2, H / 2);
        ctx.font = "16px sans-serif";
        ctx.fillText("Next wave incoming...", W / 2, H / 2 + 30);
      }

      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Wave ${s.wave}`, 10, 20);
      ctx.textAlign = "right";
      ctx.fillText(`Lives: ${"<3 ".repeat(s.lives)}`, W - 10, 20);

      animRef.current = requestAnimationFrame(gameLoop);
    };

    animRef.current = requestAnimationFrame(gameLoop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  const handleMove = (dir: "left" | "right" | "shoot") => {
    const s = stateRef.current;
    if (dir === "left") s.shipX = Math.max(20, s.shipX - 30);
    else if (dir === "right") s.shipX = Math.min(W - 20, s.shipX + 30);
    else {
      const now = Date.now();
      if (now - s.lastShot > 200) {
        s.bullets.push({ x: s.shipX, y: H - 50 });
        s.lastShot = now;
      }
    }
  };

  return (
    <div className="max-w-[600px] mx-auto">
      <p className="text-center text-sm font-bold text-green-400 mb-2" data-testid="text-space-invaders-label">Asteroid Defense Force</p>
      <canvas ref={canvasRef} width={W} height={H} className="rounded-xl border-2 border-border w-full" data-testid="space-invaders-canvas" />
      <div className="grid grid-cols-3 gap-2 mt-3 max-w-[250px] mx-auto">
        <Button size="sm" variant="outline" onClick={() => handleMove("left")} data-testid="button-move-left">◀</Button>
        <Button size="sm" variant="default" onClick={() => handleMove("shoot")} data-testid="button-shoot">FIRE</Button>
        <Button size="sm" variant="outline" onClick={() => handleMove("right")} data-testid="button-move-right">▶</Button>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">Arrow keys to move, Space to fire</p>
    </div>
  );
}

function SliderMatchGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const smt = gameId ? SLIDER_MATCH_THEMES[gameId] : null;
  const weatherTypes = smt ? smt.targets.map(t => ({ name: t.name, temp: t.val1, humidity: t.val2, pressure: t.val3, emoji: t.emoji })) : [
    { name: "Sunny", temp: 85, humidity: 20, pressure: 75, emoji: "☀️" },
    { name: "Rainy", temp: 55, humidity: 90, pressure: 30, emoji: "🌧️" },
    { name: "Snowy", temp: 20, humidity: 70, pressure: 45, emoji: "❄️" },
    { name: "Stormy", temp: 65, humidity: 95, pressure: 15, emoji: "⛈️" },
    { name: "Foggy", temp: 45, humidity: 85, pressure: 50, emoji: "🌫️" },
    { name: "Windy", temp: 60, humidity: 40, pressure: 25, emoji: "💨" },
  ];

  const sliderTime = { easy: 55, medium: 40, hard: 25 };
  const [target, setTarget] = useState(() => weatherTypes[Math.floor(Math.random() * weatherTypes.length)]);
  const [temp, setTemp] = useState(50);
  const [humidity, setHumidity] = useState(50);
  const [pressure, setPressure] = useState(50);
  const [timeLeft, setTimeLeft] = useState(sliderTime[difficulty] + extraTime);
  const [round, setRound] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkMatch = () => {
    const tDiff = Math.abs(temp - target.temp);
    const hDiff = Math.abs(humidity - target.humidity);
    const pDiff = Math.abs(pressure - target.pressure);
    const totalDiff = tDiff + hDiff + pDiff;

    let pts = 0;
    if (totalDiff < 30) { pts = 50; setFeedback("Perfect match!"); }
    else if (totalDiff < 60) { pts = 30; setFeedback("Close!"); }
    else if (totalDiff < 100) { pts = 15; setFeedback("Almost there!"); }
    else { pts = 5; setFeedback("Keep trying!"); }

    onScore(pts);
    setTimeout(() => {
      setTarget(weatherTypes[Math.floor(Math.random() * weatherTypes.length)]);
      setFeedback(null);
      setRound((r) => r + 1);
    }, 1000);
  };

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Round {round}</Badge>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground mb-2 font-medium">{smt?.prompt || "Create this weather:"}</p>
        <div className="text-5xl mb-2">{target.emoji}</div>
        <h3 className="text-xl font-bold">{target.name}</h3>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <div className="flex justify-between text-sm font-bold mb-1">
            <span>{smt?.sliders[0].emoji || "🌡️"} {smt?.sliders[0].label || "Temperature"}</span><span>{temp}{smt?.sliders[0].unit || "°F"}</span>
          </div>
          <input type="range" min={0} max={100} value={temp} onChange={(e) => setTemp(+e.target.value)} className="w-full" data-testid="slider-temp" />
        </div>
        <div>
          <div className="flex justify-between text-sm font-bold mb-1">
            <span>{smt?.sliders[1].emoji || "💧"} {smt?.sliders[1].label || "Humidity"}</span><span>{humidity}{smt?.sliders[1].unit || "%"}</span>
          </div>
          <input type="range" min={0} max={100} value={humidity} onChange={(e) => setHumidity(+e.target.value)} className="w-full" data-testid="slider-humidity" />
        </div>
        <div>
          <div className="flex justify-between text-sm font-bold mb-1">
            <span>{smt?.sliders[2].emoji || "🎈"} {smt?.sliders[2].label || "Pressure"}</span><span>{pressure}{smt?.sliders[2].unit || "%"}</span>
          </div>
          <input type="range" min={0} max={100} value={pressure} onChange={(e) => setPressure(+e.target.value)} className="w-full" data-testid="slider-pressure" />
        </div>
      </div>

      {feedback && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center font-bold mb-3 ${feedback.includes("Perfect") ? "text-green-500" : "text-yellow-500"}`}>
          {feedback}
        </motion.p>
      )}

      <Button onClick={checkMatch} className="w-full font-bold" data-testid="button-check-weather">
        {smt?.buttonLabel || "Create Weather!"}
      </Button>
    </Card>
  );
}

function DefenseGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const dt = gameId ? DEFENSE_THEMES[gameId] : null;
  const defenseTime = { easy: 45, medium: 30, hard: 20 };
  const [germs, setGerms] = useState<{ id: number; x: number; y: number; speed: number; type: string }[]>([]);
  const [health, setHealth] = useState(100);
  const [timeLeft, setTimeLeft] = useState(defenseTime[difficulty] + extraTime);
  const [wave, setWave] = useState(1);
  const nextId = useRef(0);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const spawner = setInterval(() => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 160;
      setGerms((prev) => [
        ...prev,
        {
          id: nextId.current++,
          x: 150 + Math.cos(angle) * dist,
          y: 130 + Math.sin(angle) * dist,
          speed: 0.5 + wave * 0.15,
          type: (dt?.enemies || ["🦠", "🧫", "🦠", "🧬"])[Math.floor(Math.random() * (dt?.enemies.length || 4))],
        },
      ]);
    }, 1500 - wave * 100);
    return () => clearInterval(spawner);
  }, [wave]);

  useEffect(() => {
    const mover = setInterval(() => {
      setGerms((prev) => {
        const updated = prev.map((g) => {
          const dx = 150 - g.x;
          const dy = 130 - g.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 20) return null;
          return {
            ...g,
            x: g.x + (dx / dist) * g.speed * 2,
            y: g.y + (dy / dist) * g.speed * 2,
          };
        });

        const reached = updated.filter((g) => g === null).length;
        if (reached > 0) {
          setHealth((h) => {
            const newH = h - reached * 10;
            if (newH <= 0) { onEnd(scoreRef.current); return 0; }
            return newH;
          });
        }

        return updated.filter((g) => g !== null) as typeof prev;
      });
    }, 50);
    return () => clearInterval(mover);
  }, []);

  const killGerm = (id: number) => {
    setGerms((prev) => prev.filter((g) => g.id !== id));
    onScore(10);
  };

  return (
    <Card className="p-4 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-3">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant={health < 30 ? "destructive" : "default"} className="font-bold">
          <Heart className="w-3 h-3 mr-1" /> {health}%
        </Badge>
      </div>

      <div className={`relative w-[300px] h-[260px] mx-auto rounded-xl bg-gradient-to-br overflow-hidden ${dt ? `${dt.bgGradient} dark:${dt.bgGradientDark}` : "from-pink-100 to-red-100 dark:from-pink-950 dark:to-red-950"}`}>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-red-200 dark:bg-red-900 border-2 border-red-400 flex items-center justify-center text-lg">
          {dt?.centerEmoji || "🫀"}
        </div>

        {germs.map((g) => (
          <motion.button
            key={g.id}
            className="absolute text-xl cursor-pointer hover:scale-125 transition-transform"
            style={{ left: g.x - 10, top: g.y - 10 }}
            onClick={() => killGerm(g.id)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            data-testid={`germ-${g.id}`}
          >
            {g.type}
          </motion.button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-3 font-medium">
        {dt?.instruction || "Click the germs before they reach the cell!"}
      </p>
    </Card>
  );
}

function SpaceBuilderGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const PARTS = [
    { id: "cockpit", emoji: "🛸", name: "Cockpit", stat: "control", color: "#eab308", desc: "Command center" },
    { id: "engine", emoji: "🔥", name: "Engine", stat: "speed", color: "#ef4444", desc: "Propulsion system" },
    { id: "wing_l", emoji: "◀️", name: "Left Wing", stat: "stability", color: "#3b82f6", desc: "Left stabilizer" },
    { id: "wing_r", emoji: "▶️", name: "Right Wing", stat: "stability", color: "#3b82f6", desc: "Right stabilizer" },
    { id: "shield", emoji: "🛡️", name: "Shield", stat: "defense", color: "#06b6d4", desc: "Energy shield" },
    { id: "laser", emoji: "💥", name: "Laser", stat: "power", color: "#a855f7", desc: "Weapon system" },
    { id: "solar", emoji: "☀️", name: "Solar Panel", stat: "energy", color: "#f59e0b", desc: "Power source" },
    { id: "lab", emoji: "🔬", name: "Science Lab", stat: "science", color: "#22c55e", desc: "Research module" },
    { id: "cargo", emoji: "📦", name: "Cargo Bay", stat: "capacity", color: "#78716c", desc: "Storage hold" },
    { id: "comm", emoji: "📡", name: "Antenna", stat: "comms", color: "#ec4899", desc: "Communications" },
    { id: "armor", emoji: "🧱", name: "Armor Plate", stat: "defense", color: "#64748b", desc: "Hull armor" },
    { id: "booster", emoji: "🚀", name: "Booster", stat: "speed", color: "#f97316", desc: "Extra thrust" },
  ];

  const MISSIONS = [
    { name: "Science Explorer", required: { science: 2, energy: 1, comms: 1 }, bonus: "Needs labs, solar panels & antenna!", size: 6 },
    { name: "Battle Cruiser", required: { power: 2, defense: 2, speed: 1 }, bonus: "Needs weapons, shields & engines!", size: 7 },
    { name: "Cargo Hauler", required: { capacity: 2, speed: 1, energy: 1 }, bonus: "Needs cargo bays, engines & power!", size: 6 },
    { name: "Stealth Scout", required: { speed: 2, comms: 1, control: 1 }, bonus: "Needs engines, antenna & cockpit!", size: 5 },
    { name: "Space Station", required: { science: 1, defense: 1, energy: 1, comms: 1, capacity: 1 }, bonus: "Needs a bit of everything!", size: 8 },
  ];

  const builderTime = { easy: 80, medium: 60, hard: 40 };
  const SIZE = 5;
  const [mission, setMission] = useState(() => MISSIONS[Math.floor(Math.random() * MISSIONS.length)]);
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(builderTime[difficulty] + extraTime);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [shipScore, setShipScore] = useState(0);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const placedCount = Object.keys(grid).length;

  const getStats = (g: Record<string, string>) => {
    const stats: Record<string, number> = {};
    Object.values(g).forEach(partId => {
      const part = PARTS.find(p => p.id === partId);
      if (part) stats[part.stat] = (stats[part.stat] || 0) + 1;
    });
    return stats;
  };

  const calcShipScore = (g: Record<string, string>) => {
    const stats = getStats(g);
    let pts = Object.keys(g).length * 10;
    const req = mission.required;
    let metAll = true;
    for (const [stat, needed] of Object.entries(req)) {
      if ((stats[stat] || 0) >= needed) {
        pts += 30;
      } else {
        metAll = false;
      }
    }
    if (metAll) pts += 50;
    const hasBothWings = Object.values(g).includes("wing_l") && Object.values(g).includes("wing_r");
    if (hasBothWings) pts += 20;
    const hasCockpit = Object.values(g).includes("cockpit");
    if (hasCockpit) pts += 15;
    const hasEngine = Object.values(g).includes("engine") || Object.values(g).includes("booster");
    if (hasEngine) pts += 15;
    return pts;
  };

  const placePart = (x: number, y: number) => {
    if (!selectedPart) {
      setFeedback("Select a part first!");
      setTimeout(() => setFeedback(null), 800);
      return;
    }
    const key = `${x},${y}`;
    if (grid[key]) {
      const newGrid = { ...grid };
      delete newGrid[key];
      setGrid(newGrid);
      setFeedback("Part removed!");
      setTimeout(() => setFeedback(null), 600);
      return;
    }
    if (placedCount >= mission.size) {
      setFeedback(`Max ${mission.size} parts for this mission!`);
      setTimeout(() => setFeedback(null), 800);
      return;
    }
    const newGrid = { ...grid, [key]: selectedPart };
    setGrid(newGrid);
    onScore(10);
    setFeedback("+10 Part placed!");
    setTimeout(() => setFeedback(null), 600);
  };

  const launchShip = () => {
    const pts = calcShipScore(grid);
    setShipScore(pts);
    setShowScore(true);
    onScore(pts);
    setTimeout(() => {
      setShowScore(false);
      const nextLevel = level + 1;
      setLevel(nextLevel);
      setMission(MISSIONS[(MISSIONS.indexOf(mission) + 1) % MISSIONS.length]);
      setGrid({});
      setSelectedPart(null);
    }, 2500);
  };

  const stats = getStats(grid);

  return (
    <Card className="p-4 max-w-lg mx-auto border-border">
      <div className="flex justify-between items-center mb-3">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Ship #{level}</Badge>
      </div>

      <div className="bg-indigo-500/10 rounded-lg p-3 mb-3 border border-indigo-500/20">
        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Mission: {mission.name}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{mission.bonus}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(mission.required).map(([stat, needed]) => (
            <Badge key={stat} variant="secondary" className={`text-[10px] font-bold gap-1 ${(stats[stat] || 0) >= needed ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"}`}>
              {stat}: {stats[stat] || 0}/{needed} {(stats[stat] || 0) >= needed ? "✓" : ""}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center mb-3">
        {PARTS.map((part) => (
          <motion.button
            key={part.id}
            whileTap={{ scale: 0.9 }}
            className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 border-2 transition-all ${
              selectedPart === part.id
                ? "border-white bg-indigo-600 text-white shadow-lg scale-105"
                : "border-border bg-muted/50 hover:border-indigo-400"
            }`}
            onClick={() => setSelectedPart(part.id)}
            data-testid={`button-part-${part.id}`}
          >
            <span>{part.emoji}</span>
            <span className="hidden sm:inline">{part.name}</span>
          </motion.button>
        ))}
      </div>

      <p className="text-[10px] text-center text-muted-foreground mb-2 font-medium">
        Parts: {placedCount}/{mission.size} | Click to place, click placed part to remove
      </p>

      <div className="grid gap-1 mx-auto mb-3 bg-slate-900/50 rounded-lg p-2 border border-slate-700/50" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, maxWidth: 280 }}>
        {Array.from({ length: SIZE }, (_, y) =>
          Array.from({ length: SIZE }, (_, x) => {
            const key = `${x},${y}`;
            const partId = grid[key];
            const part = partId ? PARTS.find(p => p.id === partId) : null;
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.9 }}
                className={`w-12 h-12 rounded-md border-2 flex items-center justify-center text-xl transition-all ${
                  part
                    ? "bg-indigo-600/30 border-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.3)]"
                    : "bg-slate-800/60 border-slate-700/40 hover:border-indigo-500/50 cursor-pointer"
                }`}
                onClick={() => placePart(x, y)}
                data-testid={`cell-${x}-${y}`}
              >
                {part ? part.emoji : ""}
              </motion.button>
            );
          })
        )}
      </div>

      {feedback && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center font-bold text-sm mb-2 ${feedback.includes("+") ? "text-green-400" : "text-orange-400"}`}>
          {feedback}
        </motion.p>
      )}

      {showScore && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-lg mb-2">
          <p className="text-2xl font-black text-indigo-400">🚀 Ship Launched!</p>
          <p className="text-lg font-bold text-green-400">+{shipScore} points!</p>
        </motion.div>
      )}

      {placedCount >= 3 && !showScore && (
        <Button
          className="w-full font-bold gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
          onClick={launchShip}
          data-testid="button-launch"
        >
          🚀 Launch Ship! (Score: ~{calcShipScore(grid)} pts)
        </Button>
      )}
    </Card>
  );
}

function MazeGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const mzt = gameId ? MAZE_THEMES[gameId] : null;
  const mazeTime = { easy: 60, medium: 45, hard: 30 };
  const SIZE = 7;
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [exitPos] = useState({ x: SIZE - 1, y: SIZE - 1 });
  const [walls, setWalls] = useState<boolean[][]>(() => {
    const w = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => Math.random() < 0.3));
    w[0][0] = false;
    w[SIZE - 1][SIZE - 1] = false;
    return w;
  });
  const [timeLeft, setTimeLeft] = useState(mazeTime[difficulty] + extraTime);
  const [level, setLevel] = useState(1);
  const [shifting, setShifting] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [stars, setStars] = useState<{ x: number; y: number }[]>(() => {
    const s = [];
    for (let i = 0; i < 3; i++) {
      s.push({ x: 1 + Math.floor(Math.random() * (SIZE - 2)), y: 1 + Math.floor(Math.random() * (SIZE - 2)) });
    }
    return s;
  });
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const playerPosRef = useRef(playerPos);
  playerPosRef.current = playerPos;

  useEffect(() => {
    const shift = setInterval(() => {
      setShifting(true);
      setTimeout(() => {
        const pp = playerPosRef.current;
        setWalls(Array.from({ length: SIZE }, (_, r) =>
          Array.from({ length: SIZE }, (_, c) => {
            if ((r === pp.y && c === pp.x) || (r === exitPos.y && c === exitPos.x)) return false;
            if (r === 0 && c === 0) return false;
            return Math.random() < 0.3;
          })
        ));
        setTimeout(() => setShifting(false), 300);
      }, 200);
    }, 3000);
    return () => clearInterval(shift);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      let nx = playerPos.x, ny = playerPos.y;
      if (e.key === "ArrowUp") ny--;
      else if (e.key === "ArrowDown") ny++;
      else if (e.key === "ArrowLeft") nx--;
      else if (e.key === "ArrowRight") nx++;
      else return;
      e.preventDefault();

      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) return;
      if (walls[ny][nx]) return;

      setPlayerPos({ x: nx, y: ny });

      const starIdx = stars.findIndex((s) => s.x === nx && s.y === ny);
      if (starIdx >= 0) {
        onScore(15);
        setStars((prev) => prev.filter((_, i) => i !== starIdx));
      }

      if (nx === exitPos.x && ny === exitPos.y) {
        onScore(50);
        setCelebrating(true);
        setTimeout(() => {
          setCelebrating(false);
          setPlayerPos({ x: 0, y: 0 });
          setLevel((l) => l + 1);
          setStars(Array.from({ length: 3 }, () => ({
            x: 1 + Math.floor(Math.random() * (SIZE - 2)),
            y: 1 + Math.floor(Math.random() * (SIZE - 2)),
          })));
        }, 1500);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playerPos, walls, stars]);

  const movePlayer = (dx: number, dy: number) => {
    if (celebrating) return;
    const nx = playerPos.x + dx;
    const ny = playerPos.y + dy;
    if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || walls[ny][nx]) return;
    setPlayerPos({ x: nx, y: ny });

    const starIdx = stars.findIndex((s) => s.x === nx && s.y === ny);
    if (starIdx >= 0) {
      onScore(15);
      setStars((prev) => prev.filter((_, i) => i !== starIdx));
    }

    if (nx === exitPos.x && ny === exitPos.y) {
      onScore(50);
      setCelebrating(true);
      setTimeout(() => {
        setCelebrating(false);
        setPlayerPos({ x: 0, y: 0 });
        setLevel((l) => l + 1);
        setStars(Array.from({ length: 3 }, () => ({
          x: 1 + Math.floor(Math.random() * (SIZE - 2)),
          y: 1 + Math.floor(Math.random() * (SIZE - 2)),
        })));
      }, 1500);
    }
  };

  return (
    <Card className={`p-6 max-w-md mx-auto border-border ${mzt ? `bg-gradient-to-br ${mzt.bgGradient}` : ""}`}>
      {mzt?.label && (
        <p className="text-center text-sm font-bold text-purple-300 mb-2" data-testid="text-maze-label">{mzt.label}</p>
      )}
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Level {level}</Badge>
      </div>

      {shifting && !celebrating && (
        <div className="text-center text-xs font-bold text-cyan-400 mb-1 animate-pulse">
          ⚡ WALLS SHIFTING ⚡
        </div>
      )}

      {celebrating && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-4 mb-3 bg-gradient-to-r from-green-500/20 via-cyan-500/20 to-green-500/20 rounded-xl border-2 border-green-400/50"
        >
          <p className="text-3xl font-black text-green-400 mb-1">🎉 LEVEL COMPLETE! 🎉</p>
          <p className="text-lg font-bold text-cyan-300">+50 Points!</p>
          <p className="text-sm text-muted-foreground mt-1">Entering Level {level + 1}...</p>
        </motion.div>
      )}

      <div className="relative">
        <div className={`grid gap-1 mx-auto mb-4 ${celebrating ? "opacity-40" : ""}`} style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, maxWidth: 280 }}>
          {walls.map((row, y) =>
            row.map((isWall, x) => {
              const isPlayer = playerPos.x === x && playerPos.y === y;
              const isExit = x === exitPos.x && y === exitPos.y;
              const hasStar = stars.some((s) => s.x === x && s.y === y);
              return (
                <div
                  key={`${y}-${x}`}
                  className={`w-9 h-9 rounded flex items-center justify-center text-lg font-bold ${
                    shifting ? "opacity-70" : ""
                  } ${
                    isWall
                      ? "border-2 shadow-[inset_0_0_8px_rgba(168,85,247,0.5)]"
                      : isExit
                      ? "bg-green-500/30 border-2 border-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]"
                      : "bg-slate-800/60 border border-slate-700/50"
                  }`}
                  style={{
                    transition: "all 0.3s ease",
                    ...(isWall ? { backgroundColor: mzt?.wallColor || "#7e22ce", borderColor: mzt?.wallColor || "#a855f7" } : {}),
                    ...(!isWall && !isExit ? { backgroundColor: mzt?.pathColor ? `${mzt.pathColor}99` : undefined } : {}),
                  }}
                >
                  {isWall && "🧱"}
                  {isPlayer && (celebrating ? "🎉" : (mzt?.playerEmoji || "🚀"))}
                  {hasStar && !isPlayer && !isWall && (mzt?.collectibleEmoji || "⭐")}
                  {isExit && !isPlayer && !isWall && (mzt?.exitEmoji || "🚪")}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 max-w-[140px] mx-auto">
        <div />
        <Button size="sm" variant="outline" onClick={() => movePlayer(0, -1)} disabled={celebrating} data-testid="button-up">▲</Button>
        <div />
        <Button size="sm" variant="outline" onClick={() => movePlayer(-1, 0)} disabled={celebrating} data-testid="button-left">◀</Button>
        <Button size="sm" variant="outline" onClick={() => movePlayer(0, 1)} disabled={celebrating} data-testid="button-down">▼</Button>
        <Button size="sm" variant="outline" onClick={() => movePlayer(1, 0)} disabled={celebrating} data-testid="button-right">▶</Button>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-3 font-medium">
        {mzt?.instruction || "Walls shift every few seconds! Use arrow keys or buttons to navigate."}
      </p>
    </Card>
  );
}

function MemoryGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const memoryTime = { easy: 80, medium: 60, hard: 40 };
  const mt = gameId ? MEMORY_THEMES[gameId] : null;
  const fossils = mt?.emojis || ["🦕", "🦖", "🐚", "🦴", "🌿", "🪨", "🐟", "🦑"];

  const [cards, setCards] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(memoryTime[difficulty] + extraTime);
  const [pairs, setPairs] = useState(0);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const subset = fossils.slice(0, 6);
    const deck = [...subset, ...subset]
      .sort(() => Math.random() - 0.5)
      .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
    setCards(deck);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const flipCard = (idx: number) => {
    if (cards[idx].flipped || cards[idx].matched || selected.length >= 2) return;

    const newCards = [...cards];
    newCards[idx].flipped = true;
    setCards(newCards);
    const newSelected = [...selected, idx];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      const [a, b] = newSelected;
      if (cards[a].emoji === newCards[b].emoji) {
        setTimeout(() => {
          const matched = [...newCards];
          matched[a].matched = true;
          matched[b].matched = true;
          setCards(matched);
          setSelected([]);
          setPairs((p) => p + 1);
          onScore(25);

          if (matched.every((c) => c.matched)) {
            setTimeout(() => {
              const subset = fossils.sort(() => Math.random() - 0.5).slice(0, 6);
              const newDeck = [...subset, ...subset]
                .sort(() => Math.random() - 0.5)
                .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
              setCards(newDeck);
              setPairs(0);
            }, 1000);
          }
        }, 300);
      } else {
        setTimeout(() => {
          const reset = [...newCards];
          reset[a].flipped = false;
          reset[b].flipped = false;
          setCards(reset);
          setSelected([]);
        }, 800);
      }
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Pairs: {pairs}</Badge>
      </div>

      <div className="grid grid-cols-4 gap-2 mx-auto max-w-[280px]">
        {cards.map((card, i) => (
          <motion.button
            key={card.id}
            whileTap={{ scale: 0.95 }}
            className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl border-2 transition-all ${
              card.matched
                ? (mt?.matchedColor || "bg-green-500/20 border-green-500")
                : card.flipped
                ? (mt?.flippedColor || "bg-amber-500/20 border-amber-500")
                : "bg-muted border-border hover:border-purple-500 cursor-pointer"
            }`}
            onClick={() => flipCard(i)}
            data-testid={`card-${i}`}
          >
            {card.flipped || card.matched ? card.emoji : "?"}
          </motion.button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4 font-medium">
        {mt?.instruction || "Find all matching fossil pairs!"}
      </p>
    </Card>
  );
}

function VolcanoGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const volcanoTime = { easy: 50, medium: 35, hard: 22 };
  const targetZoneSize = { easy: 20, medium: 12, hard: 7 };
  const [pressure, setPressure] = useState(0);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [erupting, setErupting] = useState(false);
  const [round, setRound] = useState(1);
  const [targetZone, setTargetZone] = useState({ min: 60, max: 60 + targetZoneSize[difficulty] });
  const [timeLeft, setTimeLeft] = useState(volcanoTime[difficulty] + extraTime);
  const [gameOver, setGameOver] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const allIngredients = [
    { id: "baking-soda", name: "Baking Soda", emoji: "🧪", pressureAdd: difficulty === 'easy' ? 15 : difficulty === 'medium' ? 12 : 8, color: "bg-white" },
    { id: "vinegar", name: "Vinegar", emoji: "🫗", pressureAdd: difficulty === 'easy' ? 18 : difficulty === 'medium' ? 22 : 28, color: "bg-amber-200" },
    { id: "dish-soap", name: "Dish Soap", emoji: "🧴", pressureAdd: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 8 : 5, color: "bg-blue-200" },
    { id: "food-color", name: "Red Dye", emoji: "🔴", pressureAdd: difficulty === 'easy' ? 5 : difficulty === 'medium' ? 3 : 2, color: "bg-red-300" },
    { id: "mentos", name: "Mentos", emoji: "🍬", pressureAdd: difficulty === 'easy' ? 22 : difficulty === 'medium' ? 28 : 35, color: "bg-gray-200" },
    { id: "warm-water", name: "Warm Water", emoji: "💧", pressureAdd: difficulty === 'easy' ? 12 : difficulty === 'medium' ? 10 : 7, color: "bg-cyan-200" },
  ];

  useEffect(() => {
    if (gameOver) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerEruption();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [round, gameOver]);

  useEffect(() => {
    if (gameOver || erupting || difficulty === 'easy') return;
    const driftRate = difficulty === 'hard' ? 800 : 1500;
    const driftTimer = setInterval(() => {
      setPressure(prev => {
        if (prev <= 0) return 0;
        const leak = difficulty === 'hard' ? 3 : 1.5;
        return Math.max(0, prev - leak);
      });
    }, driftRate);
    return () => clearInterval(driftTimer);
  }, [round, gameOver, erupting, difficulty]);

  useEffect(() => {
    if (pressure > 100 && !erupting) {
      triggerEruption();
    }
  }, [pressure]);

  const addIngredient = (ing: typeof allIngredients[0]) => {
    if (erupting || gameOver) return;
    setIngredients(prev => [...prev, ing.id]);
    setPressure(prev => Math.min(prev + ing.pressureAdd, 110));
  };

  const triggerEruption = () => {
    setErupting(true);
    setShowResult(true);

    let points = 0;
    if (pressure >= targetZone.min && pressure <= targetZone.max) {
      points = difficulty === 'easy' ? 80 + (round * 15) : difficulty === 'medium' ? 65 + (round * 12) : 50 + (round * 10);
    } else if (pressure > 100) {
      points = difficulty === 'easy' ? 15 : 10;
    } else {
      const dist = pressure < targetZone.min
        ? targetZone.min - pressure
        : pressure - targetZone.max;
      points = Math.max(5, 40 - dist * 3);
    }
    onScore(points);

    setTimeout(() => {
      if (round >= (difficulty === 'hard' ? 4 : 3)) {
        setGameOver(true);
        setTimeout(() => onEnd(), 2000);
      } else {
        setRound(r => r + 1);
        setPressure(0);
        setIngredients([]);
        setErupting(false);
        setShowResult(false);
        setTimeLeft(volcanoTime[difficulty]);
        const zoneSize = targetZoneSize[difficulty] - (round * 2);
        const minStart = 45 + round * 15;
        setTargetZone({
          min: minStart,
          max: minStart + Math.max(5, zoneSize),
        });
      }
    }, 2500);
  };

  const pressureColor = pressure > 100
    ? "bg-red-500"
    : pressure >= targetZone.min && pressure <= targetZone.max
    ? "bg-green-500"
    : pressure > targetZone.max
    ? "bg-orange-500"
    : "bg-blue-500";

  return (
    <Card className="p-6 max-w-md mx-auto border-border" data-testid="volcano-game">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Round {round}/{difficulty === 'hard' ? 4 : 3}</Badge>
      </div>

      <div className="relative flex flex-col items-center mb-4">
        <div className="relative w-32 h-40">
          <div className="absolute bottom-0 w-full">
            <div className="mx-auto w-16 h-8 bg-red-900 rounded-t-lg" />
            <div className="mx-auto w-24 h-6 bg-red-800 rounded-t-sm" />
            <div className="mx-auto w-32 h-4 bg-red-700 rounded-b-lg" />
          </div>
          {erupting && (
            <motion.div
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: [0, 1.5, 2], y: [-10, -40, -60] }}
              transition={{ duration: 1.5 }}
              className="absolute top-0 left-1/2 -translate-x-1/2"
            >
              <span className="text-4xl">🌋</span>
            </motion.div>
          )}
          {erupting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 2 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 text-2xl whitespace-nowrap"
            >
              💥🔥💥
            </motion.div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Pressure</span>
          <span>{Math.round(pressure)}%</span>
        </div>
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden relative">
          <div className="absolute h-full bg-green-500/30 rounded-full" style={{ left: `${targetZone.min}%`, width: `${targetZone.max - targetZone.min}%` }} />
          <motion.div
            className={`h-full rounded-full ${pressureColor}`}
            animate={{ width: `${Math.min(pressure, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>Too weak</span>
          <span className="text-green-500 font-bold">Sweet Spot!</span>
          <span>Too much!</span>
        </div>
      </div>

      {showResult && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`text-center p-3 rounded-lg mb-3 font-bold ${
            pressure >= targetZone.min && pressure <= targetZone.max
              ? "bg-green-500/20 text-green-400"
              : pressure > 100
              ? "bg-red-500/20 text-red-400"
              : "bg-amber-500/20 text-amber-400"
          }`}
        >
          {pressure >= targetZone.min && pressure <= targetZone.max
            ? "🌋 PERFECT ERUPTION! 🌋"
            : pressure > 100
            ? "💥 KABOOM! Overloaded!"
            : "😐 Weak eruption..."}
        </motion.div>
      )}

      {!erupting && !gameOver && (
        <div className="grid grid-cols-3 gap-2">
          {allIngredients.map(ing => (
            <motion.button
              key={ing.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`p-2 rounded-lg border-2 border-border hover:border-orange-500 flex flex-col items-center gap-1 ${ing.color}`}
              onClick={() => addIngredient(ing)}
              data-testid={`ingredient-${ing.id}`}
            >
              <span className="text-xl">{ing.emoji}</span>
              <span className="text-[10px] font-bold text-foreground">{ing.name}</span>
            </motion.button>
          ))}
        </div>
      )}

      {!erupting && !gameOver && (
        <Button
          className="w-full mt-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
          onClick={() => triggerEruption()}
          data-testid="erupt-button"
        >
          🌋 ERUPT NOW!
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center mt-3 font-medium">
        Add ingredients to hit the green zone, then erupt!
      </p>
    </Card>
  );
}

function PlanetPainterGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const painterTime = { easy: 45, medium: 30, hard: 18 };
  const maxClicks = { easy: 15, medium: 12, hard: 9 };
  const [elements, setElements] = useState({ water: 0, land: 0, atmosphere: 0, life: 0 });
  const [timeLeft, setTimeLeft] = useState(painterTime[difficulty] + extraTime);
  const [gameOver, setGameOver] = useState(false);
  const [round, setRound] = useState(1);
  const [planetName, setPlanetName] = useState("New World");
  const [showScore, setShowScore] = useState(false);
  const [clicksLeft, setClicksLeft] = useState(maxClicks[difficulty]);

  const elementOptions = [
    { id: "water", name: "Water", emoji: "💧", color: "bg-blue-500 hover:bg-blue-600", key: "water" as const },
    { id: "land", name: "Land", emoji: "🏔️", color: "bg-amber-600 hover:bg-amber-700", key: "land" as const },
    { id: "atmosphere", name: "Air", emoji: "💨", color: "bg-cyan-400 hover:bg-cyan-500", key: "atmosphere" as const },
    { id: "life", name: "Life", emoji: "🌱", color: "bg-green-500 hover:bg-green-600", key: "life" as const },
  ];

  useEffect(() => {
    if (gameOver) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          scorePlanet();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [round, gameOver]);

  const addElement = (key: keyof typeof elements) => {
    if (gameOver || showScore || clicksLeft <= 0) return;
    setElements(prev => ({ ...prev, [key]: Math.min(prev[key] + 1, 10) }));
    setClicksLeft(prev => prev - 1);
  };

  const idealRecipes: Record<number, Record<string, number>> = {
    1: { water: 3, land: 3, atmosphere: 2, life: 2 },
    2: { water: 2, land: 4, atmosphere: 3, life: 3 },
    3: { water: 4, land: 2, atmosphere: 3, life: 2 },
  };

  const scorePlanet = () => {
    setShowScore(true);
    const total = elements.water + elements.land + elements.atmosphere + elements.life;
    if (total === 0) {
      onScore(3);
      finishRound();
      return;
    }

    const ideal = idealRecipes[round] || idealRecipes[1];

    let balance = 0;
    for (const key of Object.keys(ideal) as (keyof typeof elements)[]) {
      const diff = Math.abs(elements[key] - (ideal[key as keyof typeof ideal] || 0));
      if (diff === 0) balance += 20;
      else if (diff === 1) balance += 10;
      else if (diff === 2) balance += 3;
    }

    const hasAll = elements.water > 0 && elements.land > 0 && elements.atmosphere > 0 && elements.life > 0;
    const diversityBonus = hasAll ? 15 : 0;
    const diffMult = difficulty === 'easy' ? 1.2 : difficulty === 'medium' ? 1.0 : 0.85;

    const points = Math.max(5, Math.round((balance + diversityBonus) * diffMult));
    onScore(points);
    finishRound();
  };

  const finishRound = () => {
    setTimeout(() => {
      if (round >= 3) {
        setGameOver(true);
        setTimeout(() => onEnd(), 2000);
      } else {
        setRound(r => r + 1);
        setElements({ water: 0, land: 0, atmosphere: 0, life: 0 });
        setTimeLeft(painterTime[difficulty]);
        setClicksLeft(maxClicks[difficulty]);
        setShowScore(false);
        setPlanetName(["Terra Nova", "Kepler-X", "Gaia Prime"][round] || "New World");
      }
    }, 2500);
  };

  const total = elements.water + elements.land + elements.atmosphere + elements.life;
  const waterPct = total ? (elements.water / total) * 100 : 0;
  const landPct = total ? (elements.land / total) * 100 : 0;
  const atmPct = total ? (elements.atmosphere / total) * 100 : 0;
  const lifePct = total ? (elements.life / total) * 100 : 0;

  const habitability = Math.min(100, Math.round(
    (elements.water > 0 ? 20 : 0) +
    (elements.land > 0 ? 20 : 0) +
    (elements.atmosphere > 0 ? 20 : 0) +
    (elements.life > 0 ? 20 : 0) +
    (total >= 4 ? 10 : 0) +
    (total >= 8 ? 10 : 0)
  ));

  return (
    <Card className="p-6 max-w-md mx-auto border-border" data-testid="planet-painter-game">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold text-xs">{clicksLeft} adds left</Badge>
        <Badge variant="outline" className="font-bold">Planet {round}/3</Badge>
      </div>

      <div className="text-center mb-4">
        <p className="text-sm font-bold text-muted-foreground mb-2">Building: {planetName}</p>
        <div className="relative w-32 h-32 mx-auto rounded-full border-4 border-border overflow-hidden" style={{
          background: total === 0
            ? "hsl(0, 0%, 30%)"
            : `conic-gradient(
                hsl(210, 80%, 50%) 0% ${waterPct}%,
                hsl(30, 70%, 45%) ${waterPct}% ${waterPct + landPct}%,
                hsl(190, 60%, 70%) ${waterPct + landPct}% ${waterPct + landPct + atmPct}%,
                hsl(120, 60%, 40%) ${waterPct + landPct + atmPct}% 100%
              )`
        }}>
          {total === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-3xl">🪨</div>
          )}
          {elements.life > 3 && (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 flex items-center justify-center text-2xl"
            >
              🌍
            </motion.div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Habitability</span>
          <span className="font-bold text-green-400">{habitability}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
            animate={{ width: `${habitability}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 mb-3 text-center text-xs">
        {elementOptions.map(el => (
          <div key={el.id}>
            <span className="text-muted-foreground">{el.emoji} {elements[el.key]}</span>
          </div>
        ))}
      </div>

      {showScore && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`text-center p-3 rounded-lg mb-3 font-bold ${
            habitability >= 80
              ? "bg-green-500/20 text-green-400"
              : habitability >= 50
              ? "bg-amber-500/20 text-amber-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {habitability >= 80
            ? "🌍 Beautiful world! Life thrives!"
            : habitability >= 50
            ? "🌎 Decent planet! Needs work."
            : "🪨 Barren world... try more balance!"}
        </motion.div>
      )}

      {!showScore && !gameOver && (
        <div className="grid grid-cols-2 gap-2">
          {elementOptions.map(el => (
            <motion.button
              key={el.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`p-3 rounded-lg text-white font-bold flex items-center justify-center gap-2 ${el.color}`}
              onClick={() => addElement(el.key)}
              data-testid={`element-${el.id}`}
            >
              <span className="text-lg">{el.emoji}</span>
              <span className="text-sm">{el.name}</span>
            </motion.button>
          ))}
        </div>
      )}

      {!showScore && !gameOver && (
        <Button
          className="w-full mt-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
          onClick={() => scorePlanet()}
          data-testid="finish-planet-button"
        >
          🌍 FINISH PLANET
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center mt-3 font-medium">
        Balance water, land, air & life for a habitable world!
      </p>
    </Card>
  );
}

function ReactionTapGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const isElementArena = gameId === "element-arena";
  const ds = isElementArena
    ? { easy: { time: 75, pts: 25, label: 'name' }, medium: { time: 65, pts: 30, label: 'symbol' }, hard: { time: 55, pts: 35, label: 'number' } }[difficulty]
    : { easy: { time: 45, pts: 15, label: 'name' }, medium: { time: 35, pts: 20, label: 'symbol' }, hard: { time: 25, pts: 25, label: 'number' } }[difficulty];
  const rtt = gameId ? REACTION_TAP_THEMES[gameId] : null;
  const allElements = rtt?.items || [
    { num: 1, sym: "H", name: "Hydrogen", color: "#ef4444" },
    { num: 2, sym: "He", name: "Helium", color: "#a855f7" },
    { num: 3, sym: "Li", name: "Lithium", color: "#f97316" },
    { num: 4, sym: "Be", name: "Beryllium", color: "#eab308" },
    { num: 5, sym: "B", name: "Boron", color: "#22c55e" },
    { num: 6, sym: "C", name: "Carbon", color: "#6b7280" },
    { num: 7, sym: "N", name: "Nitrogen", color: "#3b82f6" },
    { num: 8, sym: "O", name: "Oxygen", color: "#06b6d4" },
    { num: 9, sym: "F", name: "Fluorine", color: "#14b8a6" },
    { num: 10, sym: "Ne", name: "Neon", color: "#ec4899" },
  ];
  const ELEMENTS = isElementArena ? allElements.slice(0, difficulty === "hard" ? 8 : 6) : allElements;
  const [timeLeft, setTimeLeft] = useState(ds.time + extraTime);
  const [bubbles, setBubbles] = useState<{ id: number; el: typeof ELEMENTS[0]; x: number; y: number }[]>([]);
  const [nextNum, setNextNum] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const idRef = useRef(0);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const spawner = setInterval(() => {
      setBubbles(prev => {
        const needsNext = !prev.some(b => b.el.num === nextNum);
        const el = isElementArena && needsNext
          ? ELEMENTS.find(item => item.num === nextNum) || ELEMENTS[0]
          : ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
        const maxBubbles = isElementArena ? 12 : 8;
        return [...prev.slice(-(maxBubbles - 1)), { id: idRef.current++, el, x: 8 + Math.random() * 74, y: 8 + Math.random() * 62 }];
      });
    }, isElementArena ? 800 : 1500);
    return () => clearInterval(spawner);
  }, [nextNum, isElementArena]);

  const tapBubble = (id: number, num: number) => {
    if (num === nextNum) {
      onScore(ds.pts);
      setNextNum(n => n >= ELEMENTS.length ? 1 : n + 1);
      setBubbles(prev => prev.filter(b => b.id !== id));
      setFeedback("Correct! +" + ds.pts);
    } else {
      const penalty = isElementArena ? 1 : 3;
      setTimeLeft(t => Math.max(0, t - penalty));
      setFeedback(`Wrong! -${penalty}s`);
    }
    setTimeout(() => setFeedback(null), 600);
  };

  const nextEl = ELEMENTS.find(e => e.num === nextNum);
  const getLabel = (el: typeof ELEMENTS[0]) => ds.label === 'name' ? el.name : ds.label === 'symbol' ? el.sym : String(el.num);

  return (
    <Card className="p-4 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-2">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Next: {nextEl ? nextEl.name + " (" + nextEl.sym + ")" : "?"}</Badge>
      </div>
      {feedback && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center text-sm font-bold mb-1 ${feedback.startsWith("Correct") ? "text-green-500" : "text-red-500"}`}>{feedback}</motion.p>}
      <div className={`relative w-full h-72 bg-gradient-to-b ${rtt?.bgGradient || "from-indigo-950 to-purple-950"} rounded-xl overflow-hidden`}>
        <AnimatePresence>
          {bubbles.map(b => (
            <motion.button
              key={b.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, x: [0, 8, -8, 0], y: [0, -6, 6, 0] }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ x: { repeat: Infinity, duration: 3 }, y: { repeat: Infinity, duration: 2.5 } }}
              className={`absolute ${isElementArena ? "w-16 h-16" : "w-14 h-14"} rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg cursor-pointer`}
              style={{ left: `${b.x}%`, top: `${b.y}%`, backgroundColor: b.el.color }}
              onClick={() => tapBubble(b.id, b.el.num)}
              data-testid={`bubble-${b.el.sym}`}
            >
              {getLabel(b.el)}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2 font-medium">
        {isElementArena ? "Easier mode: the next element appears more often, bubbles are bigger, and wrong taps only cost 1 second." : rtt?.instruction || "Tap elements in ascending atomic number order!"}
      </p>
    </Card>
  );
}

function WordScrambleGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const ds = { easy: { time: 60, pts: 20, maxLen: 5 }, medium: { time: 45, pts: 30, maxLen: 7 }, hard: { time: 30, pts: 40, maxLen: 8 } }[difficulty];
  const wst = gameId ? WORD_SCRAMBLE_THEMES[gameId] : null;
  const ALL_WORDS: { word: string; cat: string }[] = wst?.words || [
    { word: "atom", cat: "Chemistry" }, { word: "cell", cat: "Biology" }, { word: "gene", cat: "Biology" },
    { word: "orbit", cat: "Physics" }, { word: "force", cat: "Physics" }, { word: "mass", cat: "Physics" },
    { word: "wave", cat: "Physics" }, { word: "lens", cat: "Physics" }, { word: "acid", cat: "Chemistry" },
    { word: "base", cat: "Chemistry" }, { word: "ion", cat: "Chemistry" }, { word: "bond", cat: "Chemistry" },
    { word: "core", cat: "Physics" }, { word: "flux", cat: "Physics" }, { word: "mole", cat: "Chemistry" },
    { word: "volt", cat: "Physics" }, { word: "watt", cat: "Physics" }, { word: "ohms", cat: "Physics" },
    { word: "plasma", cat: "Physics" }, { word: "proton", cat: "Physics" }, { word: "neutron", cat: "Physics" },
    { word: "photon", cat: "Physics" }, { word: "enzyme", cat: "Biology" }, { word: "genome", cat: "Biology" },
    { word: "fusion", cat: "Physics" }, { word: "quasar", cat: "Physics" }, { word: "nebula", cat: "Physics" },
    { word: "isotope", cat: "Chemistry" }, { word: "element", cat: "Chemistry" }, { word: "nucleus", cat: "Physics" },
    { word: "protein", cat: "Biology" }, { word: "gravity", cat: "Physics" }, { word: "magnetic", cat: "Physics" },
    { word: "molecule", cat: "Chemistry" }, { word: "electron", cat: "Physics" }, { word: "organism", cat: "Biology" },
    { word: "chromosome", cat: "Biology" },
  ];

  const wordPool = ALL_WORDS.filter(w => w.word.length <= ds.maxLen && w.word.length >= (ds.maxLen - 2));
  const shuffle = (s: string) => s.split('').sort(() => Math.random() - 0.5).join('');
  const pickWord = () => { const w = wordPool[Math.floor(Math.random() * wordPool.length)]; return { ...w, scrambled: shuffle(w.word) }; };

  const [timeLeft, setTimeLeft] = useState(ds.time + extraTime);
  const [current, setCurrent] = useState(() => pickWord());
  const [selected, setSelected] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const letters = current.scrambled.split('');
  const built = selected.map(i => letters[i]).join('');

  const tapLetter = (idx: number) => {
    if (selected.includes(idx)) return;
    const next = [...selected, idx];
    setSelected(next);
    if (next.length === current.word.length) {
      const attempt = next.map(i => letters[i]).join('');
      if (attempt === current.word) {
        onScore(ds.pts);
        setFeedback("Correct! +" + ds.pts);
        setTimeout(() => { setCurrent(pickWord()); setSelected([]); setRound(r => r + 1); setFeedback(null); }, 700);
      } else {
        setFeedback("Try again!");
        setTimeout(() => { setSelected([]); setFeedback(null); }, 700);
      }
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge variant="outline" className="font-bold">Round {round}</Badge>
      </div>
      <div className="text-center mb-2">
        <Badge className="bg-blue-600 text-white border-0 mb-3">{current.cat}</Badge>
        <p className="text-sm text-muted-foreground font-medium mb-1">Unscramble the science word:</p>
        <div className="flex justify-center gap-1 mb-4 min-h-[44px]">
          {current.word.split('').map((_, i) => (
            <div key={i} className="w-9 h-9 rounded border-2 border-border flex items-center justify-center text-lg font-black uppercase">
              {built[i] || ""}
            </div>
          ))}
        </div>
        {feedback && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-sm font-bold mb-2 ${feedback.startsWith("Correct") ? "text-green-500" : "text-red-500"}`}>{feedback}</motion.p>}
      </div>
      <div className="flex justify-center gap-2 flex-wrap mb-3">
        {letters.map((l, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            disabled={selected.includes(i)}
            className={`w-10 h-10 rounded-lg font-black text-lg uppercase transition-all ${selected.includes(i) ? "bg-muted text-muted-foreground opacity-40" : "bg-purple-600 text-white cursor-pointer"}`}
            onClick={() => tapLetter(i)}
            data-testid={`letter-${i}`}
          >
            {l}
          </motion.button>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-full font-bold" onClick={() => setSelected([])} data-testid="button-clear">Clear</Button>
    </Card>
  );
}

function CatchFallingGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const ds = { easy: { time: 50, speed: 1.5, beaker: 80, correct: 10, wrong: -5 }, medium: { time: 40, speed: 2.5, beaker: 60, correct: 15, wrong: -10 }, hard: { time: 30, speed: 3.5, beaker: 45, correct: 20, wrong: -15 } }[difficulty];
  const cft = gameId ? CATCH_FALLING_THEMES[gameId] : null;
  const CATEGORIES = cft?.categories || [
    { label: "Catch metals!", items: ["Fe", "Cu", "Au", "Ag", "Zn", "Pb"], bad: ["O2", "N2", "He", "CO2"] },
    { label: "Catch gases!", items: ["O2", "N2", "He", "CO2", "H2", "Ar"], bad: ["Fe", "Cu", "Au", "NaCl"] },
    { label: "Catch acids!", items: ["HCl", "H2SO4", "HNO3", "H3PO4"], bad: ["NaOH", "KOH", "Ca", "Mg"] },
  ];
  const [timeLeft, setTimeLeft] = useState(ds.time + extraTime);
  const [catIdx, setCatIdx] = useState(0);
  const [beakerX, setBeakerX] = useState(50);
  const [items, setItems] = useState<{ id: number; label: string; good: boolean; x: number; y: number }[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const idRef = useRef(0);
  const scoreRef = useRef(score);
  const containerRef = useRef<HTMLDivElement>(null);
  scoreRef.current = score;
  const cat = CATEGORIES[catIdx % CATEGORIES.length];

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        if ((ds.time - t + 1) % 15 === 0) setCatIdx(c => c + 1);
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const spawner = setInterval(() => {
      const allItems = [...cat.items.map(l => ({ label: l, good: true })), ...cat.bad.map(l => ({ label: l, good: false }))];
      const pick = allItems[Math.floor(Math.random() * allItems.length)];
      setItems(prev => [...prev.slice(-10), { id: idRef.current++, ...pick, x: 5 + Math.random() * 85, y: 0 }]);
    }, 1200);
    return () => clearInterval(spawner);
  }, [catIdx]);

  useEffect(() => {
    const fall = setInterval(() => {
      setItems(prev => {
        const next = prev.map(it => ({ ...it, y: it.y + ds.speed }));
        const caught: number[] = [];
        for (const it of next) {
          if (it.y >= 85 && Math.abs(it.x - beakerX) < (ds.beaker / 4)) {
            caught.push(it.id);
            if (it.good) { onScore(ds.correct); setFeedback("+" + ds.correct); }
            else { onScore(ds.wrong); setFeedback(String(ds.wrong)); }
            setTimeout(() => setFeedback(null), 500);
          }
        }
        return next.filter(it => it.y < 100 && !caught.includes(it.id));
      });
    }, 50);
    return () => clearInterval(fall);
  }, [beakerX, catIdx]);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setBeakerX(Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100)));
  };

  return (
    <Card className="p-4 max-w-md mx-auto border-border">
      <div className="flex justify-between items-center mb-2">
        <Badge variant="secondary" className="font-bold"><Timer className="w-3 h-3 mr-1" /> {timeLeft}s</Badge>
        <Badge className="bg-amber-600 text-white border-0 font-bold">{cat.label}</Badge>
      </div>
      {feedback && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center text-sm font-bold mb-1 ${feedback.startsWith("+") ? "text-green-500" : "text-red-500"}`}>{feedback}</motion.p>}
      <div
        ref={containerRef}
        className={`relative w-full h-72 bg-gradient-to-b ${cft?.bgGradient || "from-sky-950 to-indigo-950"} rounded-xl overflow-hidden cursor-pointer select-none`}
        onMouseMove={handleMove}
        onTouchMove={handleMove}
        data-testid="catch-area"
      >
        {items.map(it => (
          <motion.div
            key={it.id}
            className={`absolute text-sm font-black px-2 py-1 rounded-full ${it.good ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
            style={{ left: `${it.x}%`, top: `${it.y}%` }}
          >
            {it.label}
          </motion.div>
        ))}
        <div
          className="absolute bottom-1 rounded-t-lg bg-blue-400 border-2 border-blue-300 flex items-end justify-center text-xs font-bold text-blue-900 transition-all"
          style={{ left: `${beakerX - ds.beaker / 8}%`, width: `${ds.beaker / 4}%`, height: 32 }}
          data-testid="beaker"
        >
          {cft?.catcherLabel || "Beaker"}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2 font-medium">{cft?.instruction || "Move mouse/finger to catch the right elements!"}</p>
    </Card>
  );
}

function GravityMazeGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const gmt = gameId ? GRAVITY_MAZE_THEMES[gameId] : null;
  const ds = {
    easy: { time: 70, levels: 5, gridSize: 6, starCount: 3, wallCount: 4 },
    medium: { time: 55, levels: 7, gridSize: 7, starCount: 4, wallCount: 6 },
    hard: { time: 45, levels: 9, gridSize: 8, starCount: 5, wallCount: 9 },
  }[difficulty];

  const CELL = Math.floor(280 / ds.gridSize);

  type Dir = "up" | "down" | "left" | "right";
  const [ball, setBall] = useState({ row: 0, col: 0 });
  const [stars, setStars] = useState<{ row: number; col: number }[]>([]);
  const [walls, setWalls] = useState<{ row: number; col: number }[]>([]);
  const [gravDir, setGravDir] = useState<Dir>("down");
  const [level, setLevel] = useState(0);
  const [flips, setFlips] = useState(0);
  const [collected, setCollected] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ds.time + extraTime);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const flipsRef = useRef(flips);
  flipsRef.current = flips;
  const levelRef = useRef(level);
  levelRef.current = level;

  const DEFAULT_FACTS = [
    "Gravity pulls everything toward the center of mass!",
    "On the Moon, gravity is 1/6th of Earth's!",
    "Astronauts float because they're in free-fall!",
    "Newton discovered gravity watching an apple fall!",
    "Heavier objects don't fall faster (in a vacuum)!",
    "Gravity keeps planets orbiting the Sun!",
    "Black holes have the strongest gravity in the universe!",
    "You weigh less at the equator due to Earth's spin!",
  ];
  const FACTS = gmt?.facts || DEFAULT_FACTS;

  const generateLevel = useCallback((lvl: number) => {
    const g = ds.gridSize;
    const numStars = Math.min(ds.starCount + Math.floor(lvl / 2), Math.floor(g * g * 0.3));
    const numWalls = Math.min(ds.wallCount + Math.floor(lvl / 2), Math.floor(g * g * 0.35));

    const getSlidePathCells = (
      startR: number, startC: number,
      dr: number, dc: number,
      wallSet: Set<string>
    ) => {
      const cells: string[] = [];
      let r = startR, c = startC;
      while (true) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= g || nc < 0 || nc >= g || wallSet.has(`${nr},${nc}`)) break;
        r = nr; c = nc;
        cells.push(`${r},${c}`);
      }
      return { dest: { row: r, col: c }, cells };
    };

    const isSolvable = (
      ballR: number, ballC: number,
      starList: { row: number; col: number }[],
      wallSet: Set<string>
    ) => {
      const dirs = [
        { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
        { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
      ];
      const visited = new Set<string>();
      const queue: string[] = [`${ballR},${ballC}`];
      visited.add(`${ballR},${ballC}`);
      const touchable = new Set<string>();
      touchable.add(`${ballR},${ballC}`);

      while (queue.length > 0) {
        const pos = queue.shift()!;
        const [cr, cc] = pos.split(",").map(Number);
        for (const { dr, dc } of dirs) {
          const { dest, cells } = getSlidePathCells(cr, cc, dr, dc, wallSet);
          cells.forEach(c => touchable.add(c));
          const key = `${dest.row},${dest.col}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push(key);
          }
        }
      }

      return starList.every(s => touchable.has(`${s.row},${s.col}`));
    };

    for (let attempt = 0; attempt < 100; attempt++) {
      const occupied = new Set<string>();
      const startRow = Math.floor(Math.random() * g);
      const startCol = Math.floor(Math.random() * g);
      occupied.add(`${startRow},${startCol}`);

      const tryStars: { row: number; col: number }[] = [];
      for (let i = 0; i < numStars * 10 && tryStars.length < numStars; i++) {
        const r = Math.floor(Math.random() * g);
        const c = Math.floor(Math.random() * g);
        const key = `${r},${c}`;
        if (!occupied.has(key)) { tryStars.push({ row: r, col: c }); occupied.add(key); }
      }
      if (tryStars.length < numStars) continue;

      const tryWalls: { row: number; col: number }[] = [];
      for (let i = 0; i < numWalls * 10 && tryWalls.length < numWalls; i++) {
        const r = Math.floor(Math.random() * g);
        const c = Math.floor(Math.random() * g);
        const key = `${r},${c}`;
        if (!occupied.has(key)) { tryWalls.push({ row: r, col: c }); occupied.add(key); }
      }

      const wallSet = new Set(tryWalls.map(w => `${w.row},${w.col}`));
      if (isSolvable(startRow, startCol, tryStars, wallSet)) {
        setBall({ row: startRow, col: startCol });
        setStars(tryStars);
        setWalls(tryWalls);
        setGravDir("down");
        setFlips(0);
        setCollected(0);
        return;
      }
    }

    const startRow = 0, startCol = 0;
    const fallbackStars = [];
    for (let i = 1; i <= numStars && i < g; i++) fallbackStars.push({ row: i, col: 0 });
    setBall({ row: startRow, col: startCol });
    setStars(fallbackStars);
    setWalls([]);
    setGravDir("down");
    setFlips(0);
    setCollected(0);
  }, [ds.gridSize, ds.starCount, ds.wallCount]);

  useEffect(() => {
    generateLevel(0);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); onEnd(scoreRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isWall = useCallback((r: number, c: number) => {
    return walls.some(w => w.row === r && w.col === c);
  }, [walls]);

  const applyGravity = useCallback((dir: Dir) => {
    if (moving) return;
    setMoving(true);
    setFlips(f => f + 1);
    setGravDir(dir);

    let bRow = ball.row;
    let bCol = ball.col;
    const dr = dir === "down" ? 1 : dir === "up" ? -1 : 0;
    const dc = dir === "right" ? 1 : dir === "left" ? -1 : 0;
    let collectedThisMove = 0;
    const remainingStars = [...stars];

    const step = () => {
      const nextR = bRow + dr;
      const nextC = bCol + dc;

      if (nextR < 0 || nextR >= ds.gridSize || nextC < 0 || nextC >= ds.gridSize || isWall(nextR, nextC)) {
        setBall({ row: bRow, col: bCol });
        setMoving(false);
        if (collectedThisMove > 0) {
          const curFlips = flipsRef.current;
          const bonus = Math.max(0, 10 - curFlips) * 2;
          const pts = collectedThisMove * 25 + bonus;
          onScore(pts);
          setFeedback(`+${pts} pts!`);
          setTimeout(() => setFeedback(null), 800);
        }
        if (remainingStars.length === 0) {
          const curFlips = flipsRef.current;
          const curLevel = levelRef.current;
          const efficiencyBonus = Math.max(0, 30 - curFlips * 3);
          if (efficiencyBonus > 0) onScore(efficiencyBonus);
          setFeedback(`Level clear! ${efficiencyBonus > 0 ? `+${efficiencyBonus} efficiency bonus!` : ""}`);
          setTimeout(() => {
            setFeedback(null);
            if (curLevel + 1 >= ds.levels) {
              onEnd(scoreRef.current);
            } else {
              setLevel(l => l + 1);
              generateLevel(curLevel + 1);
            }
          }, 1000);
        }
        return;
      }

      bRow = nextR;
      bCol = nextC;
      setBall({ row: bRow, col: bCol });

      const starIdx = remainingStars.findIndex(s => s.row === bRow && s.col === bCol);
      if (starIdx !== -1) {
        remainingStars.splice(starIdx, 1);
        setStars([...remainingStars]);
        setCollected(c => c + 1);
        collectedThisMove++;
      }

      setTimeout(step, 80);
    };

    setTimeout(step, 50);
  }, [ball, stars, walls, moving, flips, level, ds.gridSize, ds.levels, isWall, generateLevel, onScore, onEnd]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (moving) return;
      if (e.key === "ArrowUp") applyGravity("up");
      else if (e.key === "ArrowDown") applyGravity("down");
      else if (e.key === "ArrowLeft") applyGravity("left");
      else if (e.key === "ArrowRight") applyGravity("right");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [applyGravity, moving]);

  const dirArrow: Record<Dir, string> = { up: "^", down: "v", left: "<", right: ">" };

  return (
    <Card className={`p-4 max-w-md mx-auto border-border ${gmt ? `bg-gradient-to-br ${gmt.bgGradient}` : ""}`}>
      {gmt?.label && (
        <p className="text-center text-sm font-bold text-violet-300 mb-2" data-testid="text-gravity-maze-label">{gmt.label}</p>
      )}
      <div className="flex justify-between items-center mb-2">
        <Badge variant={timeLeft < 10 ? "destructive" : "secondary"} className="font-bold">
          <Timer className="w-3 h-3 mr-1" /> {timeLeft}s
        </Badge>
        <div className="flex gap-2">
          <Badge variant="outline" className="font-bold">Level {level + 1}/{ds.levels}</Badge>
          <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 font-bold">
            <Star className="w-3 h-3 mr-1 fill-yellow-500" /> {collected}/{collected + stars.length}
          </Badge>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 mb-2">
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 text-center">
          {FACTS[level % FACTS.length]} | Gravity: {dirArrow[gravDir]} | Flips: {flips}
        </p>
      </div>

      {feedback && (
        <motion.p initial={{ opacity: 0, scale: 1.3 }} animate={{ opacity: 1, scale: 1 }} className="text-center font-black text-sm mb-1 text-green-500">
          {feedback}
        </motion.p>
      )}

      <div
        className="relative mx-auto rounded-xl overflow-hidden border-2 border-border mb-3"
        style={{ width: ds.gridSize * CELL, height: ds.gridSize * CELL, backgroundColor: gmt?.pathColor || undefined }}
        data-testid="gravity-maze"
      >
        {Array.from({ length: ds.gridSize }).map((_, r) =>
          Array.from({ length: ds.gridSize }).map((_, c) => (
            <div
              key={`${r}-${c}`}
              className="absolute border border-gray-200/30 dark:border-gray-700/30"
              style={{ left: c * CELL, top: r * CELL, width: CELL, height: CELL }}
            />
          ))
        )}

        {walls.map((w, i) => (
          <div
            key={`wall-${i}`}
            className="absolute rounded-sm"
            style={{ left: w.col * CELL + 2, top: w.row * CELL + 2, width: CELL - 4, height: CELL - 4, backgroundColor: gmt?.wallColor || "#4b5563" }}
          />
        ))}

        {stars.map((s, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute flex items-center justify-center"
            style={{ left: s.col * CELL, top: s.row * CELL, width: CELL, height: CELL }}
            animate={{ scale: [1, 1.2, 1], rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
          >
            {gmt?.exitEmoji ? <span className="text-lg">{gmt.exitEmoji}</span> : <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />}
          </motion.div>
        ))}

        <motion.div
          className="absolute rounded-full border-2 shadow-lg flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 border-blue-300"
          style={{ width: CELL - 6, height: CELL - 6 }}
          animate={{ left: ball.col * CELL + 3, top: ball.row * CELL + 3 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {gmt?.playerEmoji && <span className="text-sm">{gmt.playerEmoji}</span>}
        </motion.div>
      </div>

      <div className="flex justify-center items-center gap-4">
        <div className="grid grid-cols-3 gap-1">
          <div />
          <Button size="sm" variant="outline" onClick={() => applyGravity("up")} disabled={moving} className="font-black h-10 w-10" data-testid="button-gravity-up">
            <ArrowLeft className="w-4 h-4 rotate-90" />
          </Button>
          <div />
          <Button size="sm" variant="outline" onClick={() => applyGravity("left")} disabled={moving} className="font-black h-10 w-10" data-testid="button-gravity-left">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyGravity("down")} disabled={moving} className="font-black h-10 w-10" data-testid="button-gravity-down">
            <ArrowRight className="w-4 h-4 rotate-90" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyGravity("right")} disabled={moving} className="font-black h-10 w-10" data-testid="button-gravity-right">
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={() => { if (!moving) { onScore(-15); setFeedback("Reset! -15 pts"); setTimeout(() => setFeedback(null), 800); generateLevel(levelRef.current); } }} disabled={moving} className="font-black h-10 gap-1 text-red-500 border-red-500/30 hover:bg-red-500/10" data-testid="button-reset-level">
          <RotateCcw className="w-4 h-4" /> Reset (-15)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2 font-medium">Tap arrows or use keyboard to flip gravity! Press Reset to restart the level.</p>
    </Card>
  );
}

function SequenceGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const ds = {
    easy: { startLen: 3, maxLen: 8, showTime: 800, lives: 3 },
    medium: { startLen: 4, maxLen: 10, showTime: 600, lives: 2 },
    hard: { startLen: 5, maxLen: 12, showTime: 450, lives: 2 },
  }[difficulty];

  const PADS = [
    { id: 0, label: "Fossil", color: "bg-amber-600", activeColor: "bg-amber-400", borderColor: "border-amber-500" },
    { id: 1, label: "Bone", color: "bg-gray-500", activeColor: "bg-gray-300", borderColor: "border-gray-400" },
    { id: 2, label: "Shell", color: "bg-cyan-600", activeColor: "bg-cyan-400", borderColor: "border-cyan-500" },
    { id: 3, label: "Leaf", color: "bg-green-600", activeColor: "bg-green-400", borderColor: "border-green-500" },
    { id: 4, label: "Tooth", color: "bg-red-600", activeColor: "bg-red-400", borderColor: "border-red-500" },
    { id: 5, label: "Amber", color: "bg-yellow-600", activeColor: "bg-yellow-400", borderColor: "border-yellow-500" },
  ];

  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<"showing" | "input" | "success" | "fail">("showing");
  const [activePad, setActivePad] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [lives, setLives] = useState(ds.lives);
  const [seqLength, setSeqLength] = useState(ds.startLen);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const generateSequence = useCallback((len: number) => {
    const padCount = Math.min(4 + Math.floor(len / 3), PADS.length);
    const seq: number[] = [];
    for (let i = 0; i < len; i++) {
      seq.push(Math.floor(Math.random() * padCount));
    }
    return seq;
  }, []);

  const showSequence = useCallback((seq: number[]) => {
    setPhase("showing");
    setPlayerInput([]);
    let i = 0;
    const showNext = () => {
      if (i < seq.length) {
        setActivePad(seq[i]);
        setTimeout(() => {
          setActivePad(null);
          i++;
          setTimeout(showNext, 200);
        }, ds.showTime);
      } else {
        setPhase("input");
      }
    };
    setTimeout(showNext, 500);
  }, [ds.showTime]);

  useEffect(() => {
    const seq = generateSequence(seqLength);
    setSequence(seq);
    showSequence(seq);
  }, []);

  const handlePadClick = (padId: number) => {
    if (phase !== "input") return;
    const newInput = [...playerInput, padId];
    setPlayerInput(newInput);
    setActivePad(padId);
    setTimeout(() => setActivePad(null), 200);

    const idx = newInput.length - 1;
    if (newInput[idx] !== sequence[idx]) {
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        setPhase("fail");
        onEnd(scoreRef.current);
      } else {
        setPhase("fail");
        setTimeout(() => {
          showSequence(sequence);
          setPlayerInput([]);
        }, 1000);
      }
      return;
    }

    if (newInput.length === sequence.length) {
      const pts = sequence.length * 15;
      onScore(pts);
      setPhase("success");
      setTimeout(() => {
        const nextLen = Math.min(seqLength + 1, ds.maxLen);
        setSeqLength(nextLen);
        setRound(r => r + 1);
        const newSeq = generateSequence(nextLen);
        setSequence(newSeq);
        showSequence(newSeq);
      }, 1200);
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <p className="text-center text-sm font-bold text-amber-400 mb-2" data-testid="text-sequence-label">Fossil Memory Sequence</p>
      <div className="flex justify-between items-center mb-4">
        <Badge variant="secondary" className="font-bold">Round {round}</Badge>
        <Badge variant="outline" className="font-bold">Length: {seqLength}</Badge>
        <Badge variant={lives <= 1 ? "destructive" : "secondary"} className="font-bold">Lives: {lives}</Badge>
      </div>

      {phase === "showing" && (
        <div className="text-center py-3 mb-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm font-bold text-blue-400 animate-pulse" data-testid="text-sequence-watch">Watch the sequence...</p>
        </div>
      )}
      {phase === "success" && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-3 mb-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-lg font-black text-green-400" data-testid="text-sequence-success">Correct! +{sequence.length * 15} pts</p>
        </motion.div>
      )}
      {phase === "fail" && lives > 0 && (
        <div className="text-center py-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm font-bold text-red-400" data-testid="text-sequence-fail">Wrong! Try again...</p>
        </div>
      )}
      {phase === "input" && (
        <div className="text-center py-2 mb-3">
          <p className="text-sm font-bold text-muted-foreground" data-testid="text-sequence-input">
            Your turn! {playerInput.length}/{sequence.length}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        {PADS.slice(0, Math.min(4 + Math.floor(seqLength / 3), PADS.length)).map((pad) => (
          <motion.button
            key={pad.id}
            whileTap={{ scale: 0.9 }}
            className={`h-20 rounded-xl border-2 ${pad.borderColor} font-bold text-white text-sm transition-all ${
              activePad === pad.id ? `${pad.activeColor} shadow-lg scale-105` : pad.color
            } ${phase !== "input" ? "opacity-60" : "cursor-pointer hover:brightness-110"}`}
            onClick={() => handlePadClick(pad.id)}
            disabled={phase !== "input"}
            data-testid={`button-pad-${pad.id}`}
          >
            {pad.label}
          </motion.button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center font-medium">
        Watch the pattern, then repeat it! Sequences get longer each round.
      </p>
    </Card>
  );
}

function ChainReactionGame({ gameId, onScore, onEnd, score, difficulty, extraTime }: MiniGameProps) {
  const ds = {
    easy: { time: 60, chainLen: 4, options: 3 },
    medium: { time: 50, chainLen: 5, options: 4 },
    hard: { time: 40, chainLen: 6, options: 4 },
  }[difficulty];

  type ChainLink = { question: string; answer: string; options: string[]; hint: string };

  const CHAINS: ChainLink[][] = [
    [
      { question: "What do plants absorb from sunlight?", answer: "Energy", options: ["Water", "Soil", "Energy"], hint: "Photosynthesis starts with..." },
      { question: "Plants use energy to convert CO2 and water into...", answer: "Glucose", options: ["Protein", "Glucose", "Salt"], hint: "A type of sugar" },
      { question: "Glucose is used by cells in what process?", answer: "Respiration", options: ["Digestion", "Respiration", "Circulation"], hint: "Breathing at cell level" },
      { question: "Respiration releases energy and what gas?", answer: "CO2", options: ["O2", "CO2", "N2"], hint: "Plants absorb this" },
      { question: "CO2 is taken in by plants again during...", answer: "Photosynthesis", options: ["Photosynthesis", "Osmosis", "Mitosis"], hint: "The cycle repeats!" },
      { question: "Photosynthesis mainly occurs in which organelle?", answer: "Chloroplast", options: ["Nucleus", "Chloroplast", "Ribosome"], hint: "Contains chlorophyll" },
    ],
    [
      { question: "The Sun heats water in the ocean. What happens?", answer: "Evaporation", options: ["Freezing", "Evaporation", "Condensation"], hint: "Liquid to gas" },
      { question: "Water vapor rises and cools, forming...", answer: "Clouds", options: ["Clouds", "Rivers", "Ice caps"], hint: "Visible in the sky" },
      { question: "Water drops in clouds fall as...", answer: "Precipitation", options: ["Evaporation", "Precipitation", "Transpiration"], hint: "Rain, snow, etc." },
      { question: "Precipitation collects in rivers and flows to...", answer: "Ocean", options: ["Space", "Mountains", "Ocean"], hint: "The largest water body" },
      { question: "Water also returns to air from plants through...", answer: "Transpiration", options: ["Transpiration", "Absorption", "Filtration"], hint: "Through leaf pores" },
      { question: "This entire process is called the...", answer: "Water Cycle", options: ["Food Chain", "Water Cycle", "Rock Cycle"], hint: "Endless loop of H2O" },
    ],
    [
      { question: "Igneous rock is broken down by weather into...", answer: "Sediment", options: ["Magma", "Sediment", "Crystal"], hint: "Tiny particles" },
      { question: "Sediment layers compress over time to form...", answer: "Sedimentary Rock", options: ["Sedimentary Rock", "Metamorphic Rock", "Lava"], hint: "Layered rock type" },
      { question: "Heat and pressure transform sedimentary rock into...", answer: "Metamorphic Rock", options: ["Igneous Rock", "Metamorphic Rock", "Sand"], hint: "Changed by pressure" },
      { question: "When metamorphic rock melts deep underground it becomes...", answer: "Magma", options: ["Magma", "Soil", "Mineral"], hint: "Molten rock" },
      { question: "When magma cools and solidifies it forms...", answer: "Igneous Rock", options: ["Igneous Rock", "Fossil", "Sandstone"], hint: "From cooling lava" },
      { question: "This entire process is called the...", answer: "Rock Cycle", options: ["Water Cycle", "Rock Cycle", "Carbon Cycle"], hint: "Rocks transform endlessly" },
    ],
    [
      { question: "The food chain starts with which organisms?", answer: "Producers", options: ["Predators", "Producers", "Decomposers"], hint: "They make their own food" },
      { question: "Producers are eaten by...", answer: "Primary Consumers", options: ["Primary Consumers", "Apex Predators", "Fungi"], hint: "Herbivores" },
      { question: "Primary consumers are eaten by...", answer: "Secondary Consumers", options: ["Producers", "Secondary Consumers", "Decomposers"], hint: "Small predators" },
      { question: "Secondary consumers are eaten by...", answer: "Tertiary Consumers", options: ["Tertiary Consumers", "Plants", "Bacteria"], hint: "Top predators" },
      { question: "When organisms die, they are broken down by...", answer: "Decomposers", options: ["Consumers", "Producers", "Decomposers"], hint: "Fungi and bacteria" },
      { question: "Decomposers return nutrients to the soil for...", answer: "Producers", options: ["Producers", "Predators", "Parasites"], hint: "The cycle restarts" },
    ],
  ];

  const [currentChain, setCurrentChain] = useState<ChainLink[]>([]);
  const [linkIndex, setLinkIndex] = useState(0);
  const [chainCount, setChainCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ds.time + extraTime);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const scoreRef = useRef(score);
  const endedRef = useRef(false);
  scoreRef.current = score;

  const startNewChain = useCallback(() => {
    const available = CHAINS.filter((_, i) => !completed.includes(i));
    if (available.length === 0) {
      if (!endedRef.current) { endedRef.current = true; onEnd(scoreRef.current); }
      return;
    }
    const idx = CHAINS.indexOf(available[Math.floor(Math.random() * available.length)]);
    const chain = CHAINS[idx].slice(0, ds.chainLen);
    chain.forEach(link => {
      while (link.options.length < ds.options) {
        link.options.push("Unknown");
      }
      link.options.sort(() => Math.random() - 0.5);
    });
    setCurrentChain(chain);
    setLinkIndex(0);
    setShowHint(false);
    setCompleted(prev => [...prev, idx]);
  }, [completed, ds]);

  useEffect(() => {
    startNewChain();
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && !endedRef.current) {
      endedRef.current = true;
      onEnd(scoreRef.current);
      return;
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const handleAnswer = (answer: string) => {
    const link = currentChain[linkIndex];
    if (!link) return;

    if (answer === link.answer) {
      const pts = 20 + streak * 5;
      onScore(pts);
      setStreak(s => s + 1);
      setFeedback({ text: `Correct! +${pts}`, correct: true });
      setShowHint(false);

      if (linkIndex + 1 >= currentChain.length) {
        const chainBonus = 40;
        onScore(chainBonus);
        setChainCount(c => c + 1);
        setTimeout(() => {
          setFeedback({ text: `Chain Complete! +${chainBonus} bonus!`, correct: true });
          setTimeout(() => {
            setFeedback(null);
            startNewChain();
          }, 1000);
        }, 600);
      } else {
        setTimeout(() => {
          setFeedback(null);
          setLinkIndex(i => i + 1);
        }, 600);
      }
    } else {
      setStreak(0);
      setFeedback({ text: `Wrong! The answer was: ${link.answer}`, correct: false });
      setTimeout(() => {
        setFeedback(null);
        if (linkIndex + 1 >= currentChain.length) {
          startNewChain();
        } else {
          setLinkIndex(i => i + 1);
        }
      }, 1200);
    }
  };

  const link = currentChain[linkIndex];

  return (
    <Card className="p-6 max-w-md mx-auto border-border">
      <p className="text-center text-sm font-bold text-cyan-400 mb-2" data-testid="text-chain-label">Science Chain Reaction</p>
      <div className="flex justify-between items-center mb-3">
        <Badge variant={timeLeft < 10 ? "destructive" : "secondary"} className="font-bold">
          <Timer className="w-3 h-3 mr-1" /> {timeLeft}s
        </Badge>
        <Badge variant="outline" className="font-bold">Chain {chainCount + 1}</Badge>
        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-bold">Streak: {streak}</Badge>
      </div>

      <div className="flex gap-1 mb-4">
        {currentChain.map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all ${
              i < linkIndex ? "bg-green-500" : i === linkIndex ? "bg-cyan-400 animate-pulse" : "bg-gray-700"
            }`}
            data-testid={`chain-progress-${i}`}
          />
        ))}
      </div>

      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-center py-2 mb-3 rounded-lg border ${
            feedback.correct ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
          }`}
        >
          <p className={`text-sm font-bold ${feedback.correct ? "text-green-400" : "text-red-400"}`} data-testid="text-chain-feedback">
            {feedback.text}
          </p>
        </motion.div>
      )}

      {link && !feedback && (
        <div className="mb-4">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 mb-3">
            <p className="text-sm text-muted-foreground mb-1">Link {linkIndex + 1} of {currentChain.length}</p>
            <p className="text-base font-bold" data-testid="text-chain-question">{link.question}</p>
          </div>

          <div className="grid gap-2">
            {link.options.map((opt, i) => (
              <Button
                key={i}
                variant="outline"
                className="w-full text-left justify-start font-bold h-auto py-3"
                onClick={() => handleAnswer(opt)}
                data-testid={`button-chain-option-${i}`}
              >
                {opt}
              </Button>
            ))}
          </div>

          {!showHint && (
            <Button variant="ghost" size="sm" className="mt-2 w-full text-muted-foreground" onClick={() => { setShowHint(true); onScore(-5); }} data-testid="button-show-hint">
              Show Hint (-5 pts)
            </Button>
          )}
          {showHint && (
            <p className="text-xs text-yellow-400 text-center mt-2 font-medium" data-testid="text-chain-hint">Hint: {link.hint}</p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center font-medium">
        Answer each link correctly to complete the science chain!
      </p>
    </Card>
  );
}
