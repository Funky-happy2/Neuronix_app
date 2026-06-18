import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords, Map as MapIcon, Puzzle, Skull, ArrowLeft, Heart, Timer, Zap,
  Trophy, Star, CheckCircle, XCircle, Play, Lock, Coins, RotateCcw, Flame,
  Orbit, Atom, Sparkles, Gem, Hexagon, AlertTriangle, Loader2, TrendingUp,
  Waves, Mountain, Wind, Sun, Moon, Telescope, ChevronRight, Layers,
} from "lucide-react";
import {
  DIMENSIONS, DIMENSION_GROUPS, DISTRICTS, getDistrict, getDimensionGroup,
  yearToDifficulty, type DimensionDef, type DimensionGroupDef, type DimensionStone,
  type WorldDef, type WorldParams,
} from "@/lib/gameData";
import { BOSS_BATTLES } from "@/lib/gameData";
import { BOSS_QUESTIONS_BY_YEAR, type BossQ } from "@/lib/bossQuestions";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

const DIM_ICONS: Record<string, typeof Swords> = {
  Swords, Map: MapIcon, Puzzle, Skull, Zap, Timer, Orbit, Atom, Sparkles, Flame, Gem, Hexagon,
  Waves, Mountain, Wind, Sun, Moon, Telescope, Layers,
};

interface DimensionsPageProps {
  onAddXP: (amount: number) => void;
  onAddCoins: (amount: number) => void;
  onEarnBadge: (badgeId: string) => void;
  yearLevel: number;
  onSetYearLevel?: (yearLevel: number) => void;
  xp?: number;
  badges?: string[];
}

// ─── Question pool (year-scaled, drawn from every boss bank) ──────────────────
function yearTier(year: number): number {
  if (year <= 4) return 4;
  if (year <= 6) return 6;
  return 8;
}

function buildPool(year: number): BossQ[] {
  const tier = yearTier(year);
  const pool: BossQ[] = [];
  for (const bossId of Object.keys(BOSS_QUESTIONS_BY_YEAR)) {
    const banks = BOSS_QUESTIONS_BY_YEAR[bossId];
    const tierQs = banks[tier] || banks[6] || banks[4] || banks[8];
    if (tierQs) pool.push(...tierQs);
  }
  // Shuffle questions and their options so runs feel fresh.
  return pool
    .map((q) => {
      const correctAns = q.options[q.correct];
      const opts = [...q.options].sort(() => Math.random() - 0.5);
      return { ...q, options: opts, correct: opts.indexOf(correctAns) };
    })
    .sort(() => Math.random() - 0.5);
}

// Year-level / district picker shared across dimension games.
function DimYearPicker({ selectedYear, onPick }: { selectedYear: number; onPick: (y: number) => void }) {
  const diff = yearToDifficulty(selectedYear);
  const district = getDistrict(selectedYear);
  const diffLabel = diff === "easy" ? "Easier" : diff === "hard" ? "Advanced" : "Standard";
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Year</span>
      {DISTRICTS.map((d) => (
        <button
          key={d.id}
          onClick={() => onPick(d.yearLevel)}
          data-testid={`dim-year-${d.yearLevel}`}
          className={`w-8 h-8 rounded-lg font-black text-sm transition-all ${selectedYear === d.yearLevel ? "bg-white text-gray-900 scale-110 shadow-lg" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
        >
          {d.yearLevel}
        </button>
      ))}
      <span className="text-xs font-bold text-white/70">{district.emoji} {district.name} · {diffLabel}</span>
    </div>
  );
}

// Shared multiple-choice question card. Remount with a key to advance.
function QuestionCard({ q, onAnswer, accent = "purple" }: { q: BossQ; onAnswer: (correct: boolean) => void; accent?: string }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const pick = (i: number) => {
    if (chosen !== null) return;
    setChosen(i);
    window.setTimeout(() => onAnswer(i === q.correct), 700);
  };
  return (
    <div>
      <Card className="p-5 mb-4 border-border bg-card">
        <p className="font-bold text-lg leading-snug" data-testid="dim-question">{q.question}</p>
      </Card>
      <div className="grid gap-2.5">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct;
          const isChosen = i === chosen;
          let cls = "bg-card hover:bg-accent border-border";
          if (chosen !== null) {
            if (isCorrect) cls = "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300";
            else if (isChosen) cls = "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300";
            else cls = "bg-card border-border opacity-60";
          }
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={chosen !== null}
              data-testid={`dim-option-${i}`}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 font-semibold transition-all flex items-center justify-between ${cls}`}
            >
              <span>{opt}</span>
              {chosen !== null && isCorrect && <CheckCircle className="w-5 h-5 text-green-500" />}
              {chosen !== null && isChosen && !isCorrect && <XCircle className="w-5 h-5 text-red-500" />}
            </button>
          );
        })}
      </div>
      {chosen !== null && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-3 text-sm font-medium px-3 py-2 rounded-lg ${chosen === q.correct ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
        >
          {q.explanation}
        </motion.p>
      )}
    </div>
  );
}

// Reusable countdown. `runKey` resets the clock when it changes.
function useCountdown(seconds: number, onExpire: () => void, runKey: unknown, active: boolean) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;
  useEffect(() => {
    if (!active) return;
    setTimeLeft(seconds);
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); cbRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, active]);
  return timeLeft;
}

// Every world mini-game gets the same contract: it plays one punishing round and
// reports a single win/lose result. The campaign runner owns everything else.
interface WorldGameProps {
  yearLevel: number;
  params: WorldParams;
  onComplete: (won: boolean, score: number) => void;
}

// ─── 1. GAUNTLET — escalating waves, reach the target wave to clear ───────────
function GauntletGame({ yearLevel, params, onComplete }: WorldGameProps) {
  const winWave = params.winWave ?? 10;
  const startLives = params.lives ?? 2;
  const poolRef = useRef<BossQ[]>(buildPool(yearLevel));
  const [qi, setQi] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(startLives);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const lockRef = useRef(false);
  const doneRef = useRef(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const q = poolRef.current[qi % poolRef.current.length];
  // Punishing, fast timers that tighten every wave.
  const baseTime = Math.max(3, 9 - (wave - 1)) + Math.max(0, 5 - yearLevel);

  const finish = useCallback((won: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true; setDone(true);
    onComplete(won, scoreRef.current);
  }, [onComplete]);

  const resolve = useCallback((correct: boolean) => {
    if (lockRef.current || doneRef.current) return;
    lockRef.current = true;
    if (correct) {
      setScore((s) => s + 10 * wave);
      const nextCount = qi + 1;
      const nextWave = nextCount % 4 === 0 ? wave + 1 : wave; // a wave every 4 questions
      if (nextWave >= winWave) { window.setTimeout(() => finish(true), 600); return; }
      if (nextWave !== wave) setWave(nextWave);
      window.setTimeout(() => { lockRef.current = false; setQi(nextCount); }, 650);
    } else {
      const nl = lives - 1;
      setLives(nl);
      if (nl <= 0) { window.setTimeout(() => finish(false), 650); return; }
      window.setTimeout(() => { lockRef.current = false; setQi((i) => i + 1); }, 650);
    }
  }, [qi, wave, lives, finish, winWave]);

  const timeLeft = useCountdown(baseTime, () => resolve(false), qi, !done);

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: startLives }).map((_, i) => (
            <Heart key={i} className={`w-6 h-6 ${i < lives ? "text-red-500 fill-red-500" : "text-muted-foreground/30"}`} />
          ))}
        </div>
        <Badge className="bg-orange-600 text-white border-0 font-black gap-1"><Flame className="w-4 h-4" /> Wave {wave}/{winWave}</Badge>
        <Badge className="bg-purple-600 text-white border-0 font-black gap-1"><Star className="w-4 h-4 text-yellow-300" /> {score}</Badge>
      </div>
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm font-bold mb-1"><Timer className="w-4 h-4" /> {timeLeft}s</div>
        <Progress value={(timeLeft / baseTime) * 100} className="h-2" />
      </div>
      <QuestionCard key={qi} q={q} onAnswer={resolve} />
    </div>
  );
}

// ─── 2. LABYRINTH — roguelike pick-a-path run ─────────────────────────────────
type NodeType = "battle" | "elite" | "treasure" | "rest";
const NODE_META: Record<NodeType, { label: string; emoji: string; desc: string }> = {
  battle: { label: "Battle", emoji: "⚔️", desc: "Answer or take -2 HP" },
  elite: { label: "Elite", emoji: "☠️", desc: "Tough! Wrong = -3 HP" },
  treasure: { label: "Treasure", emoji: "🎁", desc: "Claim a reward!" },
  rest: { label: "Rest", emoji: "🏕️", desc: "Recover +1 HP" },
};

// Harsher node weighting — mostly battles and elites, rarely a breather.
function randomNodes(): NodeType[] {
  const roll = (): NodeType => {
    const r = Math.random();
    if (r < 0.55) return "battle";
    if (r < 0.80) return "elite";
    if (r < 0.92) return "treasure";
    return "rest";
  };
  const a = roll();
  let b = roll();
  while (b === a) b = roll();
  return [a, b];
}

function LabyrinthGame({ yearLevel, params, onComplete }: WorldGameProps) {
  const totalSteps = params.steps ?? 14;
  const startHp = params.hp ?? 3;
  const poolRef = useRef<BossQ[]>(buildPool(yearLevel));
  const qiRef = useRef(0);
  const [step, setStep] = useState(0);
  const [maxHp, setMaxHp] = useState(startHp);
  const [hp, setHp] = useState(startHp);
  const [score, setScore] = useState(0);
  const [nodes, setNodes] = useState<NodeType[]>(() => randomNodes());
  const [phase, setPhase] = useState<"map" | "battle">("map");
  const [pending, setPending] = useState<NodeType>("battle");
  const [flash, setFlash] = useState<string>("");
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);

  const nextQ = () => poolRef.current[(qiRef.current++) % poolRef.current.length];
  const battleQRef = useRef<BossQ>(poolRef.current[0]);

  const finish = useCallback((won: boolean, finalScore: number) => {
    if (doneRef.current) return;
    doneRef.current = true; setDone(true);
    onComplete(won, finalScore);
  }, [onComplete]);

  const advance = (newHp: number, newScore: number) => {
    if (newHp <= 0) { finish(false, newScore); return; }
    const next = step + 1;
    if (next >= totalSteps) { finish(true, newScore); return; }
    setStep(next);
    setNodes(randomNodes());
    setPhase("map");
  };

  const choose = (t: NodeType) => {
    if (doneRef.current) return;
    if (t === "battle" || t === "elite") {
      battleQRef.current = nextQ();
      setPending(t);
      setPhase("battle");
      return;
    }
    if (t === "treasure") {
      if (Math.random() < 0.4) {
        const nm = maxHp + 1; setMaxHp(nm); const nh = Math.min(nm, hp + 1); setHp(nh);
        setFlash("🎁 Heart Crystal! +1 Max HP");
        advance(nh, score);
      } else {
        const ns = score + 100; setScore(ns);
        setFlash("🎁 Treasure! +100 score");
        advance(hp, ns);
      }
      return;
    }
    // rest — only +1 HP now (was +2)
    const nh = Math.min(maxHp, hp + 1); setHp(nh);
    setFlash("🏕️ Rested. +1 HP");
    advance(nh, score);
  };

  const onBattleAnswer = (correct: boolean) => {
    const elite = pending === "elite";
    if (correct) {
      const gain = elite ? 120 : 50;
      const ns = score + gain; setScore(ns);
      setFlash(`✅ Victory! +${gain} score`);
      advance(hp, ns);
    } else {
      const dmg = elite ? 3 : 2;
      const nh = hp - dmg; setHp(nh);
      setFlash(`💥 Hit! -${dmg} HP`);
      advance(nh, score);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: maxHp }).map((_, i) => (
            <Heart key={i} className={`w-5 h-5 ${i < hp ? "text-red-500 fill-red-500" : "text-muted-foreground/30"}`} />
          ))}
        </div>
        <Badge className="bg-violet-600 text-white border-0 font-black">Step {step + 1}/{totalSteps}</Badge>
        <Badge className="bg-purple-600 text-white border-0 font-black gap-1"><Star className="w-4 h-4 text-yellow-300" /> {score}</Badge>
      </div>
      <Progress value={(step / totalSteps) * 100} className="h-2 mb-4" />

      {flash && phase === "map" && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-sm font-bold text-violet-500 mb-3">{flash}</motion.p>
      )}

      {phase === "map" ? (
        <div>
          <p className="text-center text-sm text-muted-foreground font-medium mb-3">Choose your path…</p>
          <div className="grid grid-cols-2 gap-3">
            {nodes.map((t, i) => (
              <button
                key={i}
                onClick={() => choose(t)}
                data-testid={`lab-node-${t}`}
                className="p-5 rounded-2xl border-2 border-border bg-card hover:border-violet-500 hover:bg-violet-500/5 transition-all text-center"
              >
                <div className="text-4xl mb-2">{NODE_META[t].emoji}</div>
                <div className="font-black">{NODE_META[t].label}</div>
                <div className="text-[11px] text-muted-foreground mt-1 leading-tight">{NODE_META[t].desc}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <Badge className="mb-3 bg-violet-600 text-white border-0 font-bold">{pending === "elite" ? "☠️ Elite Battle" : "⚔️ Battle"}</Badge>
          <QuestionCard key={`${step}-${pending}`} q={battleQRef.current} onAnswer={onBattleAnswer} />
        </div>
      )}
    </div>
  );
}

// ─── 3. NEXUS — beat-the-clock ladder ─────────────────────────────────────────
function NexusGame({ yearLevel, params, onComplete }: WorldGameProps) {
  const totalRungs = params.rungs ?? 16;
  const totalTime = params.timeSec ?? 55;
  const drop = params.dropOnWrong ?? 2;
  const poolRef = useRef<BossQ[]>(buildPool(yearLevel));
  const [qi, setQi] = useState(0);
  const [rung, setRung] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const finish = useCallback((won: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true; setDone(true);
    onComplete(won, scoreRef.current);
  }, [onComplete]);

  const timeLeft = useCountdown(totalTime, () => finish(false), "nexus", !done);

  const onAnswer = (correct: boolean) => {
    if (doneRef.current) return;
    if (correct) {
      const nr = rung + 1;
      setScore((s) => s + 10);
      setRung(nr);
      if (nr >= totalRungs) { window.setTimeout(() => finish(true), 400); return; }
    } else {
      setRung((r) => Math.max(0, r - drop));
    }
    setQi((i) => i + 1);
  };

  const q = poolRef.current[qi % poolRef.current.length];
  const urgent = timeLeft <= 10;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Badge className={`border-0 font-black gap-1 ${urgent ? "bg-red-600 text-white animate-pulse" : "bg-cyan-600 text-white"}`}><Timer className="w-4 h-4" /> {timeLeft}s</Badge>
        <Badge className="bg-blue-600 text-white border-0 font-black">Rung {rung}/{totalRungs}</Badge>
        <Badge className="bg-purple-600 text-white border-0 font-black gap-1"><Star className="w-4 h-4 text-yellow-300" /> {score}</Badge>
      </div>
      <div className="flex gap-4">
        {/* Ladder visual */}
        <div className="flex flex-col-reverse gap-1 w-10 shrink-0">
          {Array.from({ length: totalRungs }).map((_, i) => (
            <div key={i} className={`h-6 rounded flex items-center justify-center text-[10px] font-black ${i < rung ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>
              {i === rung ? "🧗" : i + 1}
            </div>
          ))}
        </div>
        <div className="flex-1">
          <QuestionCard key={qi} q={q} onAnswer={onAnswer} />
        </div>
      </div>
    </div>
  );
}

// ─── 4. COLOSSEUM — boss rush duel, one shared health bar ─────────────────────
function ColosseumGame({ yearLevel, params, onComplete }: WorldGameProps) {
  const bossCount = params.bosses ?? 4;
  const bossHpMax = params.bossHp ?? 5;
  const playerHpMax = params.playerHp ?? 3;
  const poolRef = useRef<BossQ[]>(buildPool(yearLevel));
  const qiRef = useRef(0);
  // Build exactly `bossCount` bosses, cycling the bank if needed.
  const bossesRef = useRef(
    (() => {
      const shuffled = [...BOSS_BATTLES].sort(() => Math.random() - 0.5);
      return Array.from({ length: bossCount }, (_, i) => shuffled[i % shuffled.length]);
    })()
  );
  const [bossIdx, setBossIdx] = useState(0);
  const [bossHp, setBossHp] = useState(bossHpMax);
  const [playerHp, setPlayerHp] = useState(playerHpMax);
  const [qKey, setQKey] = useState(0);
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const defeatedRef = useRef(0);

  const boss = bossesRef.current[bossIdx];
  const q = poolRef.current[qiRef.current % poolRef.current.length];

  const finish = useCallback((won: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true; setDone(true);
    onComplete(won, defeatedRef.current * 100);
  }, [onComplete]);

  const onAnswer = (correct: boolean) => {
    if (doneRef.current) return;
    qiRef.current += 1;
    if (correct) {
      const nb = bossHp - 1;
      if (nb <= 0) {
        defeatedRef.current += 1;
        if (bossIdx + 1 >= bossCount) { window.setTimeout(() => finish(true), 600); return; }
        window.setTimeout(() => {
          setBossIdx((b) => b + 1);
          setBossHp(bossHpMax);
          setQKey((k) => k + 1);
        }, 600);
        return;
      }
      setBossHp(nb);
    } else {
      const np = playerHp - 1;
      setPlayerHp(np);
      if (np <= 0) { window.setTimeout(() => finish(false), 600); return; }
    }
    setQKey((k) => k + 1);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <Badge className="bg-rose-700 text-white border-0 font-black">Boss {bossIdx + 1}/{bossCount}</Badge>
        <div className="flex items-center gap-1" data-testid="player-hp">
          {Array.from({ length: playerHpMax }).map((_, i) => (
            <Heart key={i} className={`w-4 h-4 ${i < playerHp ? "text-green-500 fill-green-500" : "text-muted-foreground/30"}`} />
          ))}
        </div>
      </div>
      <Card className="p-4 mb-4 border-rose-500/40 bg-gradient-to-br from-rose-950/40 to-slate-900/40">
        <div className="flex items-center justify-between mb-2">
          <span className="font-black text-lg">{boss.name}</span>
          <Badge variant="secondary" className="text-[10px]">{boss.title}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-rose-400 mr-1">Boss HP</span>
          {Array.from({ length: bossHpMax }).map((_, i) => (
            <div key={i} className={`h-2.5 flex-1 rounded-full ${i < bossHp ? "bg-rose-500" : "bg-muted"}`} />
          ))}
        </div>
      </Card>
      <QuestionCard key={qKey} q={q} onAnswer={onAnswer} accent="rose" />
    </div>
  );
}

// Render the right engine for a world.
function WorldGame({ world, yearLevel, onComplete }: { world: WorldDef; yearLevel: number; onComplete: (won: boolean, score: number) => void }) {
  const common = { yearLevel, params: world.params, onComplete };
  switch (world.engine) {
    case "gauntlet": return <GauntletGame {...common} />;
    case "roguelike": return <LabyrinthGame {...common} />;
    case "puzzle": return <NexusGame {...common} />;
    case "boss-rush": return <ColosseumGame {...common} />;
    default: return null;
  }
}

// ─── Campaign runner: play every world in a dimension, lose-it-all on a fail ───
interface DimensionRunProps {
  dim: DimensionDef;
  yearLevel: number;
  reward: any | null;     // populated when the run is resolved (server or local)
  resolving: boolean;     // completion request in flight
  onResolve: (won: boolean, totalScore: number) => void;
  onExit: () => void;
  onReplay: () => void;
}

function DimensionRun({ dim, yearLevel, reward, resolving, onResolve, onExit, onReplay }: DimensionRunProps) {
  const worlds = dim.worlds;
  const [worldIdx, setWorldIdx] = useState(0);
  const [phase, setPhase] = useState<"intro" | "playing" | "cleared" | "victory" | "defeat">("intro");
  const [totalScore, setTotalScore] = useState(0);
  const [runKey, setRunKey] = useState(0); // remounts the engine on each world/retry

  const world = worlds[worldIdx];
  const WorldIcon = DIM_ICONS[world?.icon] || Swords;

  const handleWorldComplete = useCallback((won: boolean, score: number) => {
    const nextScore = totalScore + score;
    setTotalScore(nextScore);
    if (!won) {
      setPhase("defeat");
      onResolve(false, nextScore);
      return;
    }
    if (worldIdx + 1 >= worlds.length) {
      setPhase("victory");
      onResolve(true, nextScore);
    } else {
      setPhase("cleared");
    }
  }, [totalScore, worldIdx, worlds.length, onResolve]);

  const startWorld = () => { setRunKey((k) => k + 1); setPhase("playing"); };
  const nextWorld = () => { setWorldIdx((i) => i + 1); setPhase("intro"); };

  // ── Progress rail (shared across phases) ──────────────────────────────────
  const ProgressRail = (
    <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
      {worlds.map((w, i) => {
        const cleared = i < worldIdx || phase === "victory";
        const current = i === worldIdx && phase !== "victory" && phase !== "defeat";
        const Wi = DIM_ICONS[w.icon] || Swords;
        return (
          <div key={w.id} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${
                cleared ? "bg-green-500/20 border-green-500 text-green-100"
                : current ? "bg-white/20 border-white text-white scale-105"
                : "bg-white/5 border-white/20 text-white/50"
              }`}
              data-testid={`world-chip-${w.id}`}
            >
              {cleared ? <CheckCircle className="w-3.5 h-3.5" /> : <Wi className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{w.name}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>
            {i < worlds.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
          </div>
        );
      })}
    </div>
  );

  // ── Reward chips shown on the victory screen ──────────────────────────────
  const RewardChips = reward && (
    <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
      {reward.xp > 0 && <span className="bg-white/15 text-white px-3 py-1 rounded-full flex items-center gap-1 font-bold"><Zap className="w-4 h-4" /> +{reward.xp} XP</span>}
      {reward.coins > 0 && <span className="bg-white/15 text-white px-3 py-1 rounded-full flex items-center gap-1 font-bold"><Coins className="w-4 h-4" /> +{reward.coins}</span>}
      {reward.shards > 0 && <span className="bg-white/15 text-white px-3 py-1 rounded-full flex items-center gap-1 font-bold"><Sparkles className="w-4 h-4" /> +{reward.shards} Shards</span>}
      {reward.wagerRefunded > 0 && <span className="bg-emerald-400/30 text-white px-3 py-1 rounded-full flex items-center gap-1 font-bold"><TrendingUp className="w-4 h-4" /> Wager +50% back</span>}
      {reward.stoneEarned && <span className="bg-amber-400/30 text-white px-3 py-1 rounded-full flex items-center gap-1 font-bold"><Gem className="w-4 h-4" /> Stone claimed!</span>}
      {reward.badgeEarned && <span className="bg-amber-400/30 text-white px-3 py-1 rounded-full flex items-center gap-1 font-bold"><Trophy className="w-4 h-4" /> Badge!</span>}
    </div>
  );

  return (
    <div>
      {ProgressRail}

      <div className="bg-background/95 backdrop-blur rounded-3xl p-5 shadow-2xl">
        {phase === "intro" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8 max-w-md mx-auto">
            <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">World {worldIdx + 1} of {worlds.length}</div>
            <WorldIcon className="w-14 h-14 mx-auto mb-3 text-fuchsia-500" />
            <h2 className="text-3xl font-black mb-1">{world.name}</h2>
            <p className="text-muted-foreground font-semibold mb-1">{world.tagline}</p>
            <p className="text-xs text-red-500 font-bold mb-6 flex items-center justify-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Lose here and the whole dimension resets.
            </p>
            <Button size="lg" onClick={startWorld} className="gap-2 font-black" data-testid="start-world">
              <Play className="w-5 h-5" /> {worldIdx === 0 ? "Begin Campaign" : "Enter World"}
            </Button>
          </motion.div>
        )}

        {phase === "playing" && (
          <WorldGame key={`${dim.id}-${worldIdx}-${runKey}`} world={world} yearLevel={yearLevel} onComplete={handleWorldComplete} />
        )}

        {phase === "cleared" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-10 max-w-md mx-auto">
            <CheckCircle className="w-16 h-16 mx-auto mb-3 text-green-500" />
            <h2 className="text-2xl font-black mb-1">World Cleared!</h2>
            <p className="text-muted-foreground font-semibold mb-6">
              {worlds.length - worldIdx - 1} world{worlds.length - worldIdx - 1 === 1 ? "" : "s"} left. Keep going — don't lose it all now!
            </p>
            <Button size="lg" onClick={nextWorld} className="gap-2 font-black" data-testid="next-world">
              Next World <ChevronRight className="w-5 h-5" />
            </Button>
          </motion.div>
        )}

        {phase === "victory" && (
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8 max-w-md mx-auto">
            <div className="text-6xl mb-3">🏆</div>
            <h2 className="text-3xl font-black mb-2">{dim.name} Conquered!</h2>
            {resolving ? (
              <p className="text-muted-foreground font-bold flex items-center justify-center gap-2 mb-4"><Loader2 className="w-4 h-4 animate-spin" /> Sealing the rift…</p>
            ) : (
              <>
                {RewardChips}
                {reward?.setComplete && reward?.grand && (
                  <div className="bg-gradient-to-r from-purple-600 to-amber-500 text-white rounded-2xl p-4 my-3 font-black shadow-2xl">
                    ♾️ {reward.grand.title} forged! +{reward.grand.coins.toLocaleString()} Neuros, +{reward.grand.gems} gems, +{reward.grand.xp.toLocaleString()} XP and a permanent +{reward.grand.buffXpPct}% XP / +{reward.grand.buffCoinPct}% coins!
                  </div>
                )}
              </>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <Button onClick={onReplay} variant="outline" className="gap-2 font-bold" data-testid="run-replay"><RotateCcw className="w-4 h-4" /> Again</Button>
              <Button onClick={onExit} className="gap-2 font-bold" data-testid="run-exit"><ArrowLeft className="w-4 h-4" /> Dimensions</Button>
            </div>
          </motion.div>
        )}

        {phase === "defeat" && (
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8 max-w-md mx-auto">
            <div className="text-6xl mb-3">💥</div>
            <h2 className="text-3xl font-black mb-1">The Rift Collapsed</h2>
            <p className="text-muted-foreground font-bold mb-2">
              You fell on World {worldIdx + 1} of {worlds.length}. So close, champion — the dimension resets.
            </p>
            {reward?.wagerLost > 0 && (
              <p className="text-red-500 font-black flex items-center justify-center gap-1 mb-2"><AlertTriangle className="w-4 h-4" /> Wager lost: {reward.wagerLost.toLocaleString()} XP</p>
            )}
            {resolving && <p className="text-muted-foreground font-bold flex items-center justify-center gap-2 mb-2"><Loader2 className="w-4 h-4 animate-spin" /> Closing the rift…</p>}
            <div className="flex gap-3 justify-center mt-6">
              <Button onClick={onReplay} className="gap-2 font-bold" data-testid="run-replay"><RotateCcw className="w-4 h-4" /> Try Again</Button>
              <Button onClick={onExit} variant="outline" className="gap-2 font-bold" data-testid="run-exit"><ArrowLeft className="w-4 h-4" /> Dimensions</Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Sacrifice helpers ────────────────────────────────────────────────────────
function sacrificeChips(dim: DimensionDef, group: DimensionGroupDef | undefined): { key: string; icon: typeof Coins; label: string }[] {
  const out: { key: string; icon: typeof Coins; label: string }[] = [];
  if (dim.costCoins) out.push({ key: "coins", icon: Coins, label: `${dim.costCoins.toLocaleString()} Neuros` });
  if (dim.costGems) out.push({ key: "gems", icon: Gem, label: `${dim.costGems} gems` });
  if (dim.costShards) out.push({ key: "shards", icon: Sparkles, label: `${dim.costShards} ${group?.currencyName || "Shards"}` });
  if (dim.sacrificeItem) out.push({ key: "item", icon: Flame, label: `Sacrifice 1 potion / power-up` });
  if (dim.wagerXp) out.push({ key: "wager", icon: AlertTriangle, label: `Wager ${dim.wagerXp.toLocaleString()} XP` });
  return out;
}

// ─── Page shell ───────────────────────────────────────────────────────────────
export default function DimensionsPage({ onAddXP, onAddCoins, onEarnBadge, yearLevel, onSetYearLevel, xp = 0, badges = [] }: DimensionsPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const inventory: string[] = (user as any)?.inventory || [];
  const userXp: number = (user as any)?.xp ?? xp;
  const userBadges: string[] = (user as any)?.badges ?? badges;
  const coins: number = (user as any)?.coins ?? 0;
  const gems: number = (user as any)?.gems ?? 0;
  const exp: Record<string, number> = (user as any)?.upgradeExpirations || {};

  const [active, setActive] = useState<DimensionDef | null>(null);
  const [year, setYear] = useState(yearLevel);
  const [runId, setRunId] = useState(0);
  const [reward, setReward] = useState<any | null>(null);
  const [confirming, setConfirming] = useState<DimensionDef | null>(null);

  useEffect(() => { setYear(yearLevel); }, [yearLevel]);
  const pickYear = (y: number) => { setYear(y); onSetYearLevel?.(y); };

  const shardsOf = (g?: DimensionGroupDef) => (g?.currencyId ? (exp[g.currencyId] || 0) : 0);
  const isUnlocked = (dim: DimensionDef) => userXp >= dim.unlockXp || inventory.includes("dimunlock-" + dim.id);
  const isInfinity = (dim: DimensionDef) => dim.groupId !== "core";
  const hasSacrificeItem = () => inventory.some(i => i.startsWith("potion-") || i.startsWith("powerup-") || i.startsWith("battle-powerup-"));
  const canAfford = (dim: DimensionDef): boolean => {
    const g = getDimensionGroup(dim.groupId);
    if (dim.costCoins && coins < dim.costCoins) return false;
    if (dim.costGems && gems < dim.costGems) return false;
    if (dim.costShards && shardsOf(g) < dim.costShards) return false;
    if (dim.wagerXp && userXp < dim.wagerXp) return false;
    if (dim.sacrificeItem && !hasSacrificeItem()) return false;
    return true;
  };

  const enterMutation = useMutation({
    mutationFn: async (dim: DimensionDef) => {
      const res = await apiRequest("POST", "/api/dimensions/enter", { dimensionId: dim.id });
      return res.json();
    },
    onSuccess: (_d, dim) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setConfirming(null);
      setReward(null);
      setActive(dim);
      setRunId(r => r + 1);
    },
    onError: (e: any) => toast({ title: "Can't enter the rift", description: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: async ({ dim, won }: { dim: DimensionDef; won: boolean }) => {
      const res = await apiRequest("POST", "/api/dimensions/complete", { dimensionId: dim.id, won });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setReward(data);
      if (data.setComplete) toast({ title: "♾️ A GRAND POWER!", description: "All stones united — limitless power is yours!" });
      else if (data.stoneEarned) toast({ title: "Stone claimed!", description: "You cleared every world and seized the stone." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Resolve a finished campaign run. Stone dimensions report to the server;
  // free Core dimensions are settled locally (no sacrifice to lose).
  const handleResolve = useCallback((won: boolean, totalScore: number) => {
    if (!active) return;
    if (active.groupId !== "core") {
      completeMutation.mutate({ dim: active, won });
    } else if (won) {
      const xpGain = active.rewardXp + Math.floor(totalScore / 5);
      const coinGain = active.rewardCoins;
      onAddXP(xpGain);
      onAddCoins(coinGain);
      if (active.badgeId) onEarnBadge(active.badgeId);
      setReward({ won: true, xp: xpGain, coins: coinGain, badgeEarned: active.badgeId, core: true });
    } else {
      setReward({ won: false, xp: 0, coins: 0, core: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onAddXP, onAddCoins, onEarnBadge]);

  const exit = () => { setActive(null); setReward(null); };
  const replay = () => {
    if (active && isInfinity(active)) { const dim = active; setActive(null); setReward(null); setConfirming(dim); }
    else { setReward(null); setRunId(r => r + 1); }
  };
  const tryEnter = (dim: DimensionDef) => {
    if (!isUnlocked(dim)) return;
    if (isInfinity(dim)) setConfirming(dim);
    else { setReward(null); setActive(dim); setRunId(r => r + 1); }
  };

  // ── Active play view ──────────────────────────────────────────────────────
  if (active) {
    const Icon = DIM_ICONS[active.icon] || Swords;
    return (
      <div className={`min-h-screen bg-gradient-to-br ${active.gradient}`}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={exit} className="gap-2 font-semibold text-white/90 hover:text-white hover:bg-white/10" data-testid="dim-back">
              <ArrowLeft className="w-4 h-4" /> Dimensions
            </Button>
            <div className="flex items-center gap-2 text-white">
              <Icon className="w-5 h-5" /> <span className="font-black">{active.name}</span>
            </div>
          </div>
          <div className="mb-5"><DimYearPicker selectedYear={year} onPick={pickYear} /></div>

          <DimensionRun
            key={`${active.id}-${runId}`}
            dim={active}
            yearLevel={year}
            reward={reward}
            resolving={completeMutation.isPending}
            onResolve={handleResolve}
            onExit={exit}
            onReplay={replay}
          />
        </div>
      </div>
    );
  }

  // ── Group browser view ────────────────────────────────────────────────────
  const district = getDistrict(year);

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-3">
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">Dimensions</h1>
        <p className="text-muted-foreground font-medium mt-1">Warped realities, each a campaign of brutal worlds. Clear every world in one run — or lose it all.</p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-8 text-sm flex-wrap">
        <span className="text-muted-foreground font-semibold">Difficulty district:</span>
        <Badge variant="secondary" className="font-bold">{district.emoji} {district.name} · {yearToDifficulty(year)}</Badge>
        <div className="flex items-center gap-1 ml-2">
          {DISTRICTS.map((d) => (
            <button
              key={d.id}
              onClick={() => pickYear(d.yearLevel)}
              data-testid={`dim-page-year-${d.yearLevel}`}
              className={`w-7 h-7 rounded-md font-black text-xs transition-all ${year === d.yearLevel ? "bg-purple-600 text-white scale-110" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              {d.yearLevel}
            </button>
          ))}
        </div>
      </div>

      {DIMENSION_GROUPS.map((group) => {
        const GroupIcon = DIM_ICONS[group.icon] || Hexagon;
        const groupDims = group.dimensionIds.map(id => DIMENSIONS.find(d => d.id === id)!).filter(Boolean);
        const collected = group.stones.filter(s => inventory.includes(s.id)).length;
        const setComplete = group.stones.length > 0 && collected === group.stones.length;
        return (
          <section key={group.id} className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <GroupIcon className="w-7 h-7 text-fuchsia-500" />
              <h2 className={`text-2xl font-black bg-gradient-to-r ${group.gradient} bg-clip-text text-transparent`}>{group.name}</h2>
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-4">{group.tagline}</p>

            {/* Infinity stone tracker + currency */}
            {group.stones.length > 0 && (
              <Card className="p-4 mb-5 border-2 border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/5 to-amber-500/5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                  <div className="flex items-center gap-2 font-black">
                    <Gem className="w-5 h-5 text-fuchsia-500" /> Stone Set
                    <span className="text-muted-foreground font-bold text-sm">{collected}/{group.stones.length} stones</span>
                  </div>
                  {group.currencyId && (
                    <Badge variant="secondary" className="font-bold gap-1" data-testid="rift-shards">
                      {group.currencyEmoji} {shardsOf(group).toLocaleString()} {group.currencyName}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {group.stones.map((s: DimensionStone) => {
                    const owned = inventory.includes(s.id);
                    return (
                      <div key={s.id} className="flex flex-col items-center gap-1" title={s.name}>
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-2xl transition-all ${owned ? "scale-100" : "grayscale opacity-30 scale-90"}`}
                          style={owned ? { boxShadow: `0 0 14px 3px ${s.color}` } : undefined}
                          data-testid={`stone-${s.id}`}
                        >
                          {s.emoji}
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground">{s.name.replace(" Stone", "")}</span>
                      </div>
                    );
                  })}
                </div>
                {setComplete ? (
                  <div className="mt-3 text-center text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-amber-500 flex items-center justify-center gap-1">
                    <TrendingUp className="w-4 h-4 text-amber-500" /> POWERS ACTIVE — +{group.grandReward?.buffXpPct}% XP & +{group.grandReward?.buffCoinPct}% coins!
                  </div>
                ) : group.grandReward && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Collect all {group.stones.length} stones to forge <span className="font-bold text-foreground">{group.grandReward.title}</span> — permanent buffs, a legendary avatar &amp; border, and a {group.grandReward.coins.toLocaleString()} Neuro payout.
                  </p>
                )}
              </Card>
            )}

            <div className="grid md:grid-cols-2 gap-5">
              {groupDims.map((dim) => {
                const Icon = DIM_ICONS[dim.icon] || Swords;
                const unlocked = isUnlocked(dim);
                const ownsStone = dim.stoneId ? inventory.includes(dim.stoneId) : false;
                const earnedBadge = dim.badgeId ? userBadges.includes(dim.badgeId) : false;
                const chips = sacrificeChips(dim, group);
                const affordable = canAfford(dim);
                return (
                  <motion.div key={dim.id} whileHover={unlocked ? { scale: 1.02 } : {}} className="relative">
                    <Card
                      className={`overflow-hidden border-2 transition-all ${!unlocked ? "opacity-70 border-border" : "border-transparent cursor-pointer hover:shadow-2xl"} ${ownsStone ? "ring-2 ring-amber-400/60" : ""}`}
                      onClick={() => unlocked && tryEnter(dim)}
                      data-testid={`dimension-card-${dim.id}`}
                    >
                      <div className={`bg-gradient-to-br ${dim.gradient} p-6 text-white relative`}>
                        <div className="flex items-start justify-between">
                          <Icon className="w-10 h-10 mb-3" />
                          <Badge className="bg-white/20 text-white border-0 font-bold text-[11px]">{dim.structure}</Badge>
                        </div>
                        <h3 className="text-2xl font-black flex items-center gap-2">{dim.name}{ownsStone && <Gem className="w-5 h-5 text-amber-300" />}</h3>
                        <p className="text-white/80 text-sm font-semibold italic">{dim.tagline}</p>
                      </div>
                      <div className="p-5">
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{dim.description}</p>

                        {/* World list — the campaign at a glance */}
                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                          <Layers className="w-4 h-4 text-fuchsia-500 shrink-0" />
                          {dim.worlds.map((w, i) => {
                            const Wi = DIM_ICONS[w.icon] || Swords;
                            return (
                              <span key={w.id} className="flex items-center gap-1">
                                {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
                                <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md" title={`${w.name} · ${w.tagline}`}>
                                  <Wi className="w-3 h-3" /> {w.name}
                                </span>
                              </span>
                            );
                          })}
                        </div>

                        {chips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {chips.map(c => {
                              const C = c.icon;
                              return (
                                <Badge key={c.key} variant="outline" className={`text-[10px] font-bold gap-1 ${c.key === "wager" ? "border-red-400/50 text-red-600 dark:text-red-400" : "border-amber-400/40 text-amber-600 dark:text-amber-400"}`}>
                                  <C className="w-3 h-3" /> {c.label}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        {!unlocked ? (
                          <div className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                            <Lock className="w-4 h-4" /> Unlocks at {dim.unlockXp.toLocaleString()} XP <span className="text-muted-foreground font-medium">(or admin grant)</span>
                          </div>
                        ) : (
                          <Button className={`w-full gap-2 font-bold ${!affordable ? "opacity-60" : ""}`} data-testid={`enter-${dim.id}`}>
                            <Play className="w-4 h-4" /> {chips.length > 0 ? "Sacrifice & Enter" : `Enter ${dim.name}`}
                            {(earnedBadge || ownsStone) && <Trophy className="w-4 h-4 text-amber-300 ml-1" />}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Sacrifice confirmation */}
      <AnimatePresence>
        {confirming && (() => {
          const g = getDimensionGroup(confirming.groupId);
          const chips = sacrificeChips(confirming, g);
          const affordable = canAfford(confirming);
          return (
            <motion.div
              className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirming(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card border-2 border-fuchsia-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-3">
                  <div className="text-4xl mb-2">⚠️</div>
                  <h3 className="text-xl font-black">{confirming.name}</h3>
                  <p className="text-sm text-muted-foreground">{confirming.worlds.length} brutal worlds, one run. Entering demands a sacrifice:</p>
                </div>
                <div className="space-y-2 mb-3">
                  {chips.map(c => {
                    const C = c.icon;
                    return (
                      <div key={c.key} className="flex items-center gap-2 text-sm font-bold bg-muted/50 rounded-lg px-3 py-2">
                        <C className={`w-4 h-4 ${c.key === "wager" ? "text-red-500" : "text-amber-500"}`} /> {c.label}
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-center text-red-500 font-bold bg-red-500/10 rounded-lg px-3 py-2 mb-3 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Lose any world and you forfeit everything — no second chances.
                </div>
                {confirming.stoneId && (
                  <p className="text-xs text-center text-muted-foreground mb-3">Clear all {confirming.worlds.length} worlds to claim a stone{confirming.rewardShards ? ` + ${confirming.rewardShards} ${g?.currencyName}` : ""}. Wagers come back with a 50% bonus on a full clear.</p>
                )}
                {!affordable && (
                  <p className="text-xs text-center text-red-500 font-bold mb-3">You can't afford this sacrifice yet.</p>
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 font-bold gap-1"
                    disabled={!affordable || enterMutation.isPending}
                    onClick={() => enterMutation.mutate(confirming)}
                    data-testid="confirm-sacrifice"
                  >
                    {enterMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />} Sacrifice &amp; Enter
                  </Button>
                  <Button variant="outline" className="font-bold" onClick={() => setConfirming(null)}>Cancel</Button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
