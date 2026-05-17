import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Star, Zap, Trophy, Heart, Timer, Play,
  CheckCircle, XCircle, Sparkles, X, Users, Crown
} from "lucide-react";
import type { GameMode } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { getQuestionsForGame } from "@/lib/questionBank";

interface MultiplayerGameProps {
  game: GameMode;
  onBack: () => void;
  onComplete: (score: number) => void;
}

export default function MultiplayerGame({ game, onBack, onComplete }: MultiplayerGameProps) {
  const [phase, setPhase] = useState<"setup" | "playing" | "result">("setup");
  const [player1Name, setPlayer1Name] = useState("Player 1");
  const [player2Name, setPlayer2Name] = useState("Player 2");
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [currentQ, setCurrentQ] = useState(0);
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [p1Correct, setP1Correct] = useState(0);
  const [p2Correct, setP2Correct] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [stars, setStars] = useState<{x: number; y: number; id: number}[]>([]);
  const starIdRef = useRef(0);

  const questions = getQuestionsForGame(game.id).slice(0, 6);
  const totalRounds = questions.length;

  useEffect(() => {
    if (phase !== "playing" || showExplanation) return;
    if (timeLeft <= 0) {
      handleSelect(-1);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, phase, showExplanation]);

  const spawnStars = useCallback((count: number) => {
    const newStars = Array.from({ length: count }, () => ({
      x: Math.random() * 80 + 10,
      y: Math.random() * 60 + 20,
      id: starIdRef.current++,
    }));
    setStars((prev) => [...prev, ...newStars]);
    setTimeout(() => {
      setStars((prev) => prev.filter((s) => !newStars.find((ns) => ns.id === s.id)));
    }, 1000);
  }, []);

  const handleSelect = useCallback((idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    setShowExplanation(true);

    const isCorrect = idx === questions[currentQ].correct;
    if (isCorrect) {
      const points = 20 + timeLeft * 2;
      if (currentPlayer === 1) {
        setP1Score((s) => s + points);
        setP1Correct((c) => c + 1);
      } else {
        setP2Score((s) => s + points);
        setP2Correct((c) => c + 1);
      }
      spawnStars(5);
    }

    setTimeout(() => {
      setShowExplanation(false);
      setSelected(null);
      setTimeLeft(15);

      if (currentPlayer === 1) {
        setCurrentPlayer(2);
      } else {
        if (currentQ + 1 >= totalRounds) {
          setPhase("result");
        } else {
          setCurrentQ((q) => q + 1);
          setCurrentPlayer(1);
        }
      }
    }, 2000);
  }, [selected, currentQ, questions, currentPlayer, timeLeft, totalRounds, spawnStars]);

  if (phase === "setup") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className={`p-8 text-center bg-gradient-to-br ${game.gradient} text-white border-0`}>
            <div className="absolute inset-0 bg-black/10 rounded-md" />
            <div className="relative">
              <Users className="w-12 h-12 mx-auto mb-3" />
              <h1 className="text-3xl font-black mb-2">Multiplayer Battle!</h1>
              <p className="text-white/85 mb-6">{game.name} - 2 Player Challenge</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Player 1</label>
                  <input
                    type="text"
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value || "Player 1")}
                    className="w-full px-3 py-2 rounded-md bg-white/20 text-white placeholder-white/50 text-sm font-semibold text-center border border-white/20 focus:outline-none focus:border-white/50"
                    placeholder="Player 1"
                    maxLength={15}
                    data-testid="input-player1-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Player 2</label>
                  <input
                    type="text"
                    value={player2Name}
                    onChange={(e) => setPlayer2Name(e.target.value || "Player 2")}
                    className="w-full px-3 py-2 rounded-md bg-white/20 text-white placeholder-white/50 text-sm font-semibold text-center border border-white/20 focus:outline-none focus:border-white/50"
                    placeholder="Player 2"
                    maxLength={15}
                    data-testid="input-player2-name"
                  />
                </div>
              </div>

              <div className="flex justify-center gap-6 mb-6 text-sm font-semibold">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> 2 Players
                </div>
                <div className="flex items-center gap-1.5">
                  <Timer className="w-4 h-4" /> 15s per turn
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4" /> {totalRounds} Rounds
                </div>
              </div>

              <p className="text-xs text-white/70 mb-4">
                Both players answer the same question each round. Whoever scores higher wins!
              </p>

              <Button
                size="lg"
                variant="secondary"
                className="gap-2 font-bold bg-white text-gray-900 text-lg px-10"
                onClick={() => setPhase("playing")}
                data-testid="button-start-multiplayer"
              >
                <Play className="w-5 h-5" /> START BATTLE!
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (phase === "result") {
    const winner = p1Score > p2Score ? 1 : p2Score > p1Score ? 2 : 0;
    const winnerName = winner === 1 ? player1Name : winner === 2 ? player2Name : "Tie";

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full"
        >
          <Card className="p-8 text-center border-border">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
            >
              <Crown className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            </motion.div>

            <h1 className="text-3xl font-black mb-1">
              {winner === 0 ? "It's a Tie!" : `${winnerName} Wins!`}
            </h1>
            <p className="text-muted-foreground font-medium mb-6">
              {game.name} - Multiplayer Battle Results
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className={`p-4 border-2 ${winner === 1 ? "border-yellow-500 bg-yellow-500/5" : "border-border"}`}>
                {winner === 1 && <Crown className="w-5 h-5 text-yellow-500 mx-auto mb-1" />}
                <p className="font-bold text-sm mb-2">{player1Name}</p>
                <p className="text-3xl font-black text-purple-500 dark:text-purple-400">{p1Score}</p>
                <p className="text-xs text-muted-foreground font-semibold">points</p>
                <p className="text-xs text-muted-foreground mt-1">{p1Correct}/{totalRounds} correct</p>
              </Card>
              <Card className={`p-4 border-2 ${winner === 2 ? "border-yellow-500 bg-yellow-500/5" : "border-border"}`}>
                {winner === 2 && <Crown className="w-5 h-5 text-yellow-500 mx-auto mb-1" />}
                <p className="font-bold text-sm mb-2">{player2Name}</p>
                <p className="text-3xl font-black text-blue-500 dark:text-blue-400">{p2Score}</p>
                <p className="text-xs text-muted-foreground font-semibold">points</p>
                <p className="text-xs text-muted-foreground mt-1">{p2Correct}/{totalRounds} correct</p>
              </Card>
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={onBack} className="gap-2 font-bold" data-testid="button-back-multiplayer">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={() => onComplete(Math.max(p1Score, p2Score))}
                className="gap-2 font-bold"
                data-testid="button-finish-multiplayer"
              >
                <Sparkles className="w-4 h-4" /> Finish
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const q = questions[currentQ];
  const isP1Turn = currentPlayer === 1;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 font-semibold" data-testid="button-quit-multiplayer">
          <X className="w-4 h-4" /> Quit
        </Button>
        <div className="flex items-center gap-4">
          <Badge variant={isP1Turn ? "default" : "outline"} className="font-bold">
            {player1Name}: {p1Score}
          </Badge>
          <Badge variant={!isP1Turn ? "default" : "outline"} className="font-bold">
            {player2Name}: {p2Score}
          </Badge>
        </div>
      </div>

      <motion.div
        key={`${currentQ}-${currentPlayer}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-4"
      >
        <Card className={`p-4 text-center border-2 ${isP1Turn ? "border-purple-500/30 bg-purple-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>
          <div className="flex items-center justify-center gap-2">
            <Users className={`w-5 h-5 ${isP1Turn ? "text-purple-500" : "text-blue-500"}`} />
            <p className="font-bold text-sm">
              {isP1Turn ? player1Name : player2Name}'s Turn
            </p>
          </div>
        </Card>
      </motion.div>

      <div className="mb-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            Round {currentQ + 1} of {totalRounds}
          </p>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Timer className={`w-4 h-4 ${timeLeft <= 5 ? "text-red-500" : "text-muted-foreground"}`} />
            <span className={timeLeft <= 5 ? "text-red-500" : ""}>{timeLeft}s</span>
          </div>
        </div>
        <Progress value={((currentQ * 2 + (currentPlayer - 1)) / (totalRounds * 2)) * 100} className="h-2" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentQ}-${currentPlayer}`}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 mb-4 border-border">
            <h2 className="text-xl md:text-2xl font-bold text-center mb-2">
              {q.question}
            </h2>
            <p className="text-xs text-center text-muted-foreground font-medium">
              {game.scienceConcept}
            </p>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {q.options.map((opt, i) => {
              let borderClass = "border-border";
              let bgClass = "";
              if (selected !== null) {
                if (i === q.correct) {
                  borderClass = "border-emerald-500 dark:border-emerald-400";
                  bgClass = "bg-emerald-500/10 dark:bg-emerald-500/15";
                } else if (i === selected && i !== q.correct) {
                  borderClass = "border-red-500 dark:border-red-400";
                  bgClass = "bg-red-500/10 dark:bg-red-500/15";
                }
              }

              return (
                <Card
                  key={i}
                  className={`p-4 cursor-pointer border-2 ${borderClass} ${bgClass} ${selected === null ? "hover-elevate" : ""}`}
                  onClick={() => selected === null && handleSelect(i)}
                  data-testid={`button-mp-answer-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      selected !== null && i === q.correct
                        ? "bg-emerald-500 text-white"
                        : selected === i && i !== q.correct
                        ? "bg-red-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {selected !== null && i === q.correct ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : selected === i && i !== q.correct ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        String.fromCharCode(65 + i)
                      )}
                    </div>
                    <span className="font-semibold text-sm">{opt}</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4 mt-4 border-border bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/20">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  {q.explanation}
                </p>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="fixed pointer-events-none z-50"
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          initial={{ opacity: 1, scale: 0 }}
          animate={{ opacity: 0, scale: 1.5, y: -40 }}
          transition={{ duration: 0.8 }}
        >
          <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
        </motion.div>
      ))}
    </div>
  );
}
