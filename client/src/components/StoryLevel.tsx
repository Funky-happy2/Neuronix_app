import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Heart, Timer, ArrowLeft, CheckCircle, XCircle, RotateCcw, Zap, Flag, Swords, Lock, Users } from "lucide-react";
import { BOSS_QUESTIONS_BY_YEAR, type BossQ } from "@/lib/bossQuestions";
import type { StoryLevelSpec } from "@shared/story";

function buildPool(tier: number): BossQ[] {
  const pool: BossQ[] = [];
  for (const id of Object.keys(BOSS_QUESTIONS_BY_YEAR)) {
    const banks = BOSS_QUESTIONS_BY_YEAR[id];
    const qs = banks[tier] || banks[6] || banks[4] || banks[8];
    if (qs) pool.push(...qs);
  }
  return pool.sort(() => Math.random() - 0.5);
}
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

interface MCQ { q: string; options: string[]; correct: number; explanation: string }
function makeMCQ(q: BossQ): MCQ {
  const ans = q.options[q.correct];
  const opts = shuffle(q.options);
  return { q: q.question, options: opts, correct: opts.indexOf(ans), explanation: q.explanation };
}

export function StoryLevel({ level, title, gradient, onWin, onExit }: {
  level: StoryLevelSpec;
  title: string;
  gradient: string;
  onWin: () => void;
  onExit: () => void;
}) {
  const poolRef = useRef(buildPool(level.yearTier));
  const idxRef = useRef(0);
  const [runKey, setRunKey] = useState(0);

  const [mcq, setMcq] = useState<MCQ>(() => makeMCQ(poolRef.current[0]));
  const [chosen, setChosen] = useState<number | null>(null);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [hp, setHp] = useState(level.hp);
  const [pos, setPos] = useState(0);            // traverse
  const isBoss = level.type === "boss";
  const maxBossHp = isBoss ? level.bossHp : 0;
  const [bossHp, setBossHp] = useState(maxBossHp);
  const [enemiesLeft, setEnemiesLeft] = useState(level.type === "swarm" ? level.enemies : 0);  // swarm
  const [pins, setPins] = useState(0);          // lock
  const [shake, setShake] = useState<"boss" | "player" | null>(null);
  const [enraged, setEnraged] = useState(false);
  const [flash, setFlash] = useState<string>("");

  const lockRef = useRef(false);
  const doneRef = useRef(false);
  const baseTime = Math.max(4, level.timeSec - (enraged ? 2 : 0));

  const reset = () => {
    poolRef.current = buildPool(level.yearTier);
    idxRef.current = 0;
    lockRef.current = false;
    doneRef.current = false;
    setMcq(makeMCQ(poolRef.current[0]));
    setChosen(null); setStatus("playing"); setHp(level.hp); setPos(0);
    setBossHp(maxBossHp); setEnemiesLeft(level.type === "swarm" ? level.enemies : 0); setPins(0);
    setEnraged(false); setShake(null); setFlash("");
    setRunKey((k) => k + 1);
  };

  const nextQuestion = useCallback(() => {
    idxRef.current = (idxRef.current + 1) % poolRef.current.length;
    setMcq(makeMCQ(poolRef.current[idxRef.current]));
    setChosen(null);
    lockRef.current = false;
  }, []);

  const finish = (won: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setStatus(won ? "won" : "lost");
  };

  const resolve = useCallback((ok: boolean) => {
    if (lockRef.current || doneRef.current) return;
    lockRef.current = true;
    const hurt = (flashMsg: string) => {
      const nh = hp - 1; setHp(nh); setShake("player"); setFlash(flashMsg);
      if (nh <= 0) { window.setTimeout(() => finish(false), 850); return true; }
      return false;
    };

    if (level.type === "traverse") {
      if (ok) {
        const np = pos + 1; setPos(np); setFlash("Dashed past!");
        if (np >= level.steps) { window.setTimeout(() => finish(true), 700); return; }
      } else if (hurt(`The ${level.hazard} hit you!`)) return;
    } else if (level.type === "boss") {
      if (ok) {
        const nb = bossHp - 1; setBossHp(nb); setShake("boss"); setFlash("A direct hit!");
        if (nb <= 0) { window.setTimeout(() => finish(true), 700); return; }
        if (!enraged && nb <= Math.ceil(maxBossHp / 2)) setEnraged(true);
      } else if (hurt(`${level.bossName} strikes back!`)) return;
    } else if (level.type === "swarm") {
      if (ok) {
        const ne = enemiesLeft - 1; setEnemiesLeft(ne); setShake("boss"); setFlash(`${level.enemyName} defeated!`);
        if (ne <= 0) { window.setTimeout(() => finish(true), 700); return; }
      } else if (hurt(`A ${level.enemyName} struck you!`)) return;
    } else { // lock
      if (ok) {
        const np = pins + 1; setPins(np); setFlash("A tumbler clicks into place!");
        if (np >= level.tumblers) { window.setTimeout(() => finish(true), 700); return; }
      } else {
        setPins((p) => Math.max(0, p - 1));
        if (hurt("The lock resets a tumbler!")) return;
      }
    }
    window.setTimeout(nextQuestion, 850);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, pos, hp, bossHp, enemiesLeft, pins, enraged, maxBossHp, nextQuestion]);

  // Timer — resets each question; tightens when the boss enrages.
  const [timeLeft, setTimeLeft] = useState(baseTime);
  useEffect(() => {
    if (status !== "playing") return;
    setTimeLeft(baseTime);
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); if (!lockRef.current) resolve(false); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcq, status, baseTime]);

  useEffect(() => { if (shake) { const t = setTimeout(() => setShake(null), 350); return () => clearTimeout(t); } }, [shake]);

  const pick = (i: number) => {
    if (chosen !== null || lockRef.current || status !== "playing") return;
    setChosen(i);
    resolve(i === mcq.correct);
  };

  // ── Result ─────────────────────────────────────────────────────────────────
  if (status !== "playing") {
    const won = status === "won";
    const winEmoji = level.type === "boss" ? "🏆" : level.type === "lock" ? "🔓" : level.type === "swarm" ? "⚔️" : "🏁";
    const winTitle = level.type === "boss" ? "Guardian Defeated!" : level.type === "lock" ? "Gate Opened!" : level.type === "swarm" ? "Horde Defeated!" : "Region Crossed!";
    return (
      <div className={`min-h-screen bg-gradient-to-br ${gradient} flex items-center justify-center p-4`}>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-background/95 backdrop-blur rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-6xl mb-3">{won ? winEmoji : "💫"}</div>
          <h2 className="text-2xl font-black mb-1">{won ? winTitle : "You Were Overwhelmed"}</h2>
          <p className="text-muted-foreground font-semibold mb-6">
            {won ? "Your Spark pushed back The Static. The story continues!" : "The Static was too strong this time — but a Neuronaut never gives up."}
          </p>
          <div className="flex gap-3 justify-center">
            {won ? (
              <Button onClick={onWin} className="gap-2 font-black" data-testid="story-level-continue"><Flag className="w-4 h-4" /> Continue Story</Button>
            ) : (
              <>
                <Button onClick={reset} className="gap-2 font-bold" data-testid="story-level-retry"><RotateCcw className="w-4 h-4" /> Try Again</Button>
                <Button onClick={onExit} variant="outline" className="gap-2 font-bold" data-testid="story-level-leave"><ArrowLeft className="w-4 h-4" /> Leave</Button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Playing ─────────────────────────────────────────────────────────────────
  const urgent = timeLeft <= 3;
  return (
    <div key={runKey} className={`min-h-screen bg-gradient-to-br ${gradient} bg-fixed`}>
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" onClick={onExit} className="gap-2 font-semibold text-white/90 hover:text-white hover:bg-white/10" data-testid="story-level-quit">
            <ArrowLeft className="w-4 h-4" /> Quit
          </Button>
          <span className="font-black text-white flex items-center gap-1.5">
            {level.type === "boss" ? <Swords className="w-4 h-4" /> : level.type === "swarm" ? <Users className="w-4 h-4" /> : level.type === "lock" ? <Lock className="w-4 h-4" /> : <Flag className="w-4 h-4" />} {title}
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: level.hp }).map((_, i) => (
              <Heart key={i} className={`w-5 h-5 ${i < hp ? "text-red-400 fill-red-400" : "text-white/25"}`} />
            ))}
          </div>
        </div>

        {/* Stage */}
        {level.type === "traverse" && (
          <div className="bg-white/10 rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between text-white/90 text-xs font-bold mb-2">
              <span>Hazard: {level.hazard}</span>
              <span>{pos}/{level.steps}</span>
            </div>
            <div className="relative h-10 flex items-center">
              <div className="absolute inset-x-0 h-1.5 bg-white/20 rounded-full" />
              {Array.from({ length: level.steps + 1 }).map((_, i) => (
                <div key={i} className="flex-1 flex justify-center relative z-10">
                  <div className={`w-3 h-3 rounded-full ${i <= pos ? "bg-yellow-300" : "bg-white/30"}`} />
                </div>
              ))}
              <motion.div
                className="absolute z-20 text-2xl"
                animate={{ left: `calc(${(pos / level.steps) * 100}% - 12px)` }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >⚡</motion.div>
              <div className="absolute right-0 z-10 text-xl">🏁</div>
            </div>
          </div>
        )}

        {level.type === "boss" && (
          <div className="bg-white/10 rounded-2xl p-4 mb-3 text-center">
            <motion.div
              className="text-6xl mb-1 inline-block"
              animate={shake === "boss" ? { x: [0, -8, 8, -6, 0], rotate: [0, -4, 4, 0] } : enraged ? { scale: [1, 1.08, 1] } : {}}
              transition={shake === "boss" ? { duration: 0.35 } : { duration: 0.8, repeat: enraged ? Infinity : 0 }}
            >{level.bossEmoji}</motion.div>
            <div className="font-black text-white text-lg flex items-center justify-center gap-2">
              {level.bossName}
              {enraged && <Badge className="bg-red-600 text-white border-0 text-[10px] animate-pulse">ENRAGED</Badge>}
            </div>
            <div className="flex items-center gap-1 mt-2 max-w-xs mx-auto">
              {Array.from({ length: maxBossHp }).map((_, i) => (
                <div key={i} className={`h-2.5 flex-1 rounded-full ${i < bossHp ? "bg-rose-400" : "bg-white/20"}`} />
              ))}
            </div>
            {enraged && level.phaseLine && <p className="text-[11px] text-red-200 font-bold mt-1">{level.phaseLine}</p>}
          </div>
        )}

        {level.type === "swarm" && (
          <div className="bg-white/10 rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between text-white/90 text-xs font-bold mb-2">
              <span>{level.enemyName}s remaining</span>
              <span>{enemiesLeft} left</span>
            </div>
            <motion.div className="flex flex-wrap gap-1.5 justify-center" animate={shake === "boss" ? { x: [0, -6, 6, 0] } : {}} transition={{ duration: 0.3 }}>
              {Array.from({ length: level.enemies }).map((_, i) => (
                <span key={i} className={`text-2xl transition-all ${i < enemiesLeft ? "" : "opacity-20 grayscale scale-75"}`}>{level.enemyEmoji}</span>
              ))}
            </motion.div>
          </div>
        )}

        {level.type === "lock" && (
          <div className="bg-white/10 rounded-2xl p-4 mb-3 text-center">
            <div className="text-white/90 text-xs font-bold mb-2">{level.lockName} — set every tumbler!</div>
            <div className="flex items-center gap-1.5 justify-center">
              {Array.from({ length: level.tumblers }).map((_, i) => (
                <motion.div key={i}
                  animate={i < pins ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.3 }}
                  className={`w-6 h-9 rounded-md border-2 flex items-center justify-center text-sm ${i < pins ? "bg-yellow-300 border-yellow-200 text-amber-900" : "bg-white/10 border-white/30"}`}>
                  {i < pins ? "🔑" : ""}
                </motion.div>
              ))}
            </div>
            <div className="text-white/80 text-xs font-bold mt-2">{pins}/{level.tumblers} tumblers</div>
          </div>
        )}

        {/* Timer */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-white text-sm font-bold mb-1">
            <span className="flex items-center gap-1"><Timer className={`w-4 h-4 ${urgent ? "animate-pulse" : ""}`} /> {timeLeft}s</span>
            {flash && <span className="text-white/90">{flash}</span>}
          </div>
          <Progress value={(timeLeft / baseTime) * 100} className={`h-2 ${urgent ? "[&>div]:bg-red-400" : "[&>div]:bg-white"}`} />
        </div>

        {/* Question */}
        <motion.div
          className="bg-background/95 backdrop-blur rounded-3xl p-5 shadow-2xl"
          animate={shake === "player" ? { x: [0, -10, 10, -6, 0] } : {}}
          transition={{ duration: 0.35 }}
        >
          <Card className="p-5 mb-4 border-border bg-card">
            <p className="font-bold text-lg leading-snug" data-testid="story-level-question">{mcq.q}</p>
          </Card>
          <div className="grid gap-2.5">
            {mcq.options.map((opt, i) => {
              const isCorrect = i === mcq.correct;
              const isChosen = i === chosen;
              let cls = "bg-card hover:bg-accent border-border";
              if (chosen !== null) {
                if (isCorrect) cls = "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300";
                else if (isChosen) cls = "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300";
                else cls = "bg-card border-border opacity-60";
              }
              return (
                <button key={i} onClick={() => pick(i)} disabled={chosen !== null} data-testid={`story-level-option-${i}`}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 font-semibold transition-all flex items-center justify-between ${cls}`}>
                  <span>{opt}</span>
                  {chosen !== null && isCorrect && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {chosen !== null && isChosen && !isCorrect && <XCircle className="w-5 h-5 text-red-500" />}
                </button>
              );
            })}
          </div>
          {chosen !== null && (
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`mt-3 text-sm font-medium px-3 py-2 rounded-lg ${chosen === mcq.correct ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
              <Zap className="w-3.5 h-3.5 inline mr-1" />{mcq.explanation}
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
