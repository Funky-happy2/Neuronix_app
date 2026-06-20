import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Heart, Timer, Zap, Star, Flame, CheckCircle, XCircle, RotateCcw,
  ArrowLeft, Scissors, Snowflake, SkipForward, Coins, Loader2, Keyboard, ToggleLeft,
} from "lucide-react";
import { DISTRICTS, getDistrict, yearToDifficulty } from "@/lib/gameData";
import { type BossQ } from "@/lib/bossQuestions";
import { buildTopicPool, yearToTier } from "@/lib/questionTopics";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BrainBlitzPageProps {
  yearLevel: number;
  onSetYearLevel?: (yearLevel: number) => void;
}

// ─── Question pool (year-scaled, optionally filtered to a subject) ────────────
function buildPool(year: number, topic?: string): BossQ[] {
  return buildTopicPool(yearToTier(year), topic);
}

// Subjects the player can blitz (uses the shared topic→bosses map).
const SUBJECTS: { id?: string; label: string; emoji: string }[] = [
  { id: undefined, label: "Everything", emoji: "🎲" },
  { id: "physics", label: "Physics", emoji: "🪐" },
  { id: "chemistry", label: "Chemistry", emoji: "⚗️" },
  { id: "biology", label: "Biology", emoji: "🧬" },
  { id: "space", label: "Space", emoji: "🌌" },
  { id: "weather", label: "Weather", emoji: "⛈️" },
  { id: "electricity", label: "Energy", emoji: "⚡" },
];

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const stripArticle = (s: string) => s.replace(/^(the|a|an) /, "");
function typedMatches(typed: string, answer: string): boolean {
  const a = normalize(typed), b = normalize(answer);
  if (!a) return false;
  return a === b || stripArticle(a) === stripArticle(b);
}

// ─── Challenge formats derived from a multiple-choice question ─────────────────
type Challenge =
  | { kind: "mcq"; q: string; options: string[]; correct: number; explanation: string }
  | { kind: "tf"; q: string; claim: string; isTrue: boolean; explanation: string }
  | { kind: "type"; q: string; answer: string; explanation: string };

function makeChallenge(q: BossQ): Challenge {
  const answer = q.options[q.correct];
  const shortAnswer = answer.length <= 18 && answer.split(" ").length <= 2;
  // Weighted choice of format. Type-It only when the answer is short & fair.
  const roll = Math.random();
  if (roll < 0.34) {
    const opts = shuffle(q.options);
    return { kind: "mcq", q: q.question, options: opts, correct: opts.indexOf(answer), explanation: q.explanation };
  }
  if (roll < 0.68 || !shortAnswer) {
    const useTrue = Math.random() < 0.5;
    const wrongs = q.options.filter((_, i) => i !== q.correct);
    const claim = useTrue ? answer : wrongs[Math.floor(Math.random() * wrongs.length)];
    return { kind: "tf", q: q.question, claim, isTrue: claim === answer, explanation: q.explanation };
  }
  return { kind: "type", q: q.question, answer, explanation: q.explanation };
}

// ─── Run mutators (pick one — gives each run a different feel) ─────────────────
interface Mutator {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  lives: number;
  baseTime: number;       // seconds per question
  pointMult: number;      // score multiplier
  livesLostOnWrong: number;
  color: string;          // tailwind gradient
}
const MUTATORS: Mutator[] = [
  { id: "standard", name: "Standard", emoji: "🧠", blurb: "3 lives, balanced timer. A fair brain workout.", lives: 3, baseTime: 12, pointMult: 1, livesLostOnWrong: 1, color: "from-blue-500 to-cyan-500" },
  { id: "marathon", name: "Marathon", emoji: "🐢", blurb: "5 lives, relaxed timer. Great for a long, chill streak.", lives: 5, baseTime: 16, pointMult: 0.85, livesLostOnWrong: 1, color: "from-green-500 to-emerald-600" },
  { id: "time-attack", name: "Time Attack", emoji: "⚡", blurb: "Snappy timers, +35% points. Think fast!", lives: 3, baseTime: 7, pointMult: 1.35, livesLostOnWrong: 1, color: "from-amber-500 to-orange-600" },
  { id: "sudden-death", name: "Sudden Death", emoji: "💀", blurb: "ONE life, double points. How far can you go?", lives: 1, baseTime: 11, pointMult: 2, livesLostOnWrong: 1, color: "from-rose-600 to-red-800" },
  { id: "combo-frenzy", name: "Combo Frenzy", emoji: "🔥", blurb: "Combos build faster & score huge — but mistakes cost 2 lives.", lives: 4, baseTime: 10, pointMult: 1.2, livesLostOnWrong: 2, color: "from-fuchsia-500 to-purple-700" },
  { id: "glass-cannon", name: "Glass Cannon", emoji: "💎", blurb: "One life, but 2.5× points. High risk, high reward!", lives: 1, baseTime: 12, pointMult: 2.5, livesLostOnWrong: 1, color: "from-pink-500 to-rose-700" },
  { id: "speedrun", name: "Speedrun", emoji: "🏃", blurb: "Blink-and-you-miss-it timers, +50% points.", lives: 2, baseTime: 5, pointMult: 1.5, livesLostOnWrong: 1, color: "from-yellow-500 to-amber-600" },
  { id: "iron-will", name: "Iron Will", emoji: "🛡️", blurb: "6 lives, easy timer. The friendliest way to learn.", lives: 6, baseTime: 18, pointMult: 0.7, livesLostOnWrong: 1, color: "from-slate-500 to-gray-700" },
];

const MAX_QUESTIONS = 60; // safety bound for an endless run
const comboMultiplier = (streak: number, frenzy: boolean) => {
  const step = frenzy ? 2 : 3;          // questions per multiplier bump
  return Math.min(frenzy ? 8 : 5, 1 + Math.floor(streak / step));
};

interface PowerUps { fiftyFifty: number; freeze: number; skip: number }

export default function BrainBlitzPage({ yearLevel, onSetYearLevel }: BrainBlitzPageProps) {
  const [phase, setPhase] = useState<"menu" | "playing">("menu");
  const [year, setYear] = useState(yearLevel);
  const [mutator, setMutator] = useState<Mutator>(MUTATORS[0]);
  const [topic, setTopic] = useState<string | undefined>(undefined);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => { setYear(yearLevel); }, [yearLevel]);
  const pickYear = (y: number) => { setYear(y); onSetYearLevel?.(y); };

  const start = (m: Mutator) => { setMutator(m); setRunKey(k => k + 1); setPhase("playing"); };

  const district = getDistrict(year);

  if (phase === "playing") {
    return (
      <BlitzRun
        key={runKey}
        year={year}
        mutator={mutator}
        topic={topic}
        onExit={() => setPhase("menu")}
        onReplay={() => setRunKey(k => k + 1)}
      />
    );
  }

  // ── Menu ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
          <Brain className="w-10 h-10 text-blue-500" /> Brain Blitz
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          A fast mash-up of question styles — multiple choice, true/false and type-it. Build combos, grab power-ups, and pick a twist to keep every run fresh!
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-6 text-sm flex-wrap">
        <span className="text-muted-foreground font-semibold">Year:</span>
        {DISTRICTS.map((d) => (
          <button
            key={d.id}
            onClick={() => pickYear(d.yearLevel)}
            data-testid={`blitz-year-${d.yearLevel}`}
            className={`w-8 h-8 rounded-lg font-black text-sm transition-all ${year === d.yearLevel ? "bg-blue-600 text-white scale-110" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {d.yearLevel}
          </button>
        ))}
        <Badge variant="secondary" className="font-bold">{district.emoji} {district.name} · {yearToDifficulty(year)}</Badge>
      </div>

      <h2 className="font-black text-lg mb-2 text-center">Pick a subject</h2>
      <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
        {SUBJECTS.map((s) => (
          <button
            key={s.label}
            onClick={() => setTopic(s.id)}
            data-testid={`blitz-subject-${s.id ?? "all"}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${topic === s.id ? "bg-blue-600 text-white scale-105" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      <h2 className="font-black text-lg mb-3 text-center">Pick your twist</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {MUTATORS.map((m) => (
          <motion.button
            key={m.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => start(m)}
            data-testid={`blitz-mutator-${m.id}`}
            className="text-left rounded-2xl overflow-hidden border-2 border-border hover:border-transparent hover:shadow-2xl transition-all"
          >
            <div className={`bg-gradient-to-br ${m.color} p-4 text-white`}>
              <div className="text-3xl mb-1">{m.emoji}</div>
              <div className="text-xl font-black">{m.name}</div>
            </div>
            <div className="p-4 bg-card">
              <p className="text-sm text-muted-foreground font-medium mb-2">{m.blurb}</p>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500" /> {m.lives}</span>
                <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5 text-amber-500" /> {m.baseTime}s</span>
                <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-500" /> ×{m.pointMult}</span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-5">
        Start with one of each power-up: <Scissors className="inline w-3 h-3" /> 50/50, <Snowflake className="inline w-3 h-3" /> Freeze, <SkipForward className="inline w-3 h-3" /> Skip — earn more by chaining correct answers.
      </p>
    </div>
  );
}

// ─── A single Brain Blitz run ─────────────────────────────────────────────────
function BlitzRun({ year, mutator, topic, onExit, onReplay }: { year: number; mutator: Mutator; topic?: string; onExit: () => void; onReplay: () => void }) {
  const { toast } = useToast();
  const poolRef = useRef<BossQ[]>(buildPool(year, topic));
  const idxRef = useRef(0);
  const frenzy = mutator.id === "combo-frenzy";

  const [challenge, setChallenge] = useState<Challenge>(() => makeChallenge(poolRef.current[0]));
  const [qNum, setQNum] = useState(1);
  const [lives, setLives] = useState(mutator.lives);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [powerups, setPowerups] = useState<PowerUps>({ fiftyFifty: 1, freeze: 1, skip: 1 });

  const [chosen, setChosen] = useState<number | null>(null);   // mcq
  const [tfPick, setTfPick] = useState<boolean | null>(null);  // true/false
  const [typed, setTyped] = useState("");
  const [typeResult, setTypeResult] = useState<null | boolean>(null);
  const [hidden, setHidden] = useState<number[]>([]);          // 50/50 removed options
  const [feedback, setFeedback] = useState<null | { ok: boolean; gained: number }>(null);
  const [floatText, setFloatText] = useState<{ id: number; text: string; ok: boolean } | null>(null);

  const lockRef = useRef(false);
  const finishedRef = useRef(false);

  // ── Result submission ──────────────────────────────────────────────────────
  const [done, setDone] = useState(false);
  const [rewards, setRewards] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const finalRef = useRef({ score: 0, correct: 0, best: 0, q: 0 });

  const mult = comboMultiplier(streak, frenzy);
  // Timer tightens slightly as the run goes on.
  const questionTime = Math.max(4, mutator.baseTime - Math.floor(qNum / 8));

  const endRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    finalRef.current = { score, correct: correctCount, best: bestCombo, q: qNum };
    setDone(true);
    setSubmitting(true);
    const won = correctCount >= 15; // a "win" = a strong streak of correct answers
    apiRequest("POST", "/api/game/result", {
      gameId: "brain-blitz",
      score,
      won,
      difficulty: yearToDifficulty(year),
    })
      .then(async (res) => {
        const data = await res.json();
        setRewards(data.rewards);
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, correctCount, bestCombo, qNum, year]);

  // ── Advance to the next question (or end) ────────────────────────────────
  const nextQuestion = useCallback(() => {
    if (qNum >= MAX_QUESTIONS) { endRun(); return; }
    idxRef.current = (idxRef.current + 1) % poolRef.current.length;
    setChallenge(makeChallenge(poolRef.current[idxRef.current]));
    setChosen(null); setTfPick(null); setTyped(""); setTypeResult(null); setHidden([]);
    setFeedback(null);
    setQNum((n) => n + 1);
    lockRef.current = false;
  }, [qNum, endRun]);

  // ── Resolve an answer ────────────────────────────────────────────────────
  const resolve = useCallback((ok: boolean) => {
    if (lockRef.current) return;
    lockRef.current = true;

    if (ok) {
      const newStreak = streak + 1;
      // Base + a speed bonus, scaled by combo, the run mutator, and a small bonus
      // for the harder "type it" format. Kept modest so it's not a farming outlier.
      const gained = Math.round((7 + Math.round((timeLeftRef.current / questionTime) * 5)) * comboMultiplier(streak, frenzy) * mutator.pointMult * (challenge.kind === "type" ? 1.35 : 1));
      setScore((s) => s + gained);
      setStreak(newStreak);
      setBestCombo((b) => Math.max(b, newStreak));
      setCorrectCount((c) => c + 1);
      setFeedback({ ok: true, gained });
      setFloatText({ id: Date.now(), text: `+${gained}${comboMultiplier(streak, frenzy) > 1 ? ` ×${comboMultiplier(streak, frenzy)}` : ""}`, ok: true });
      // Earn a power-up every 5-combo milestone.
      if (newStreak > 0 && newStreak % 5 === 0) {
        const kinds: (keyof PowerUps)[] = ["fiftyFifty", "freeze", "skip"];
        const k = kinds[Math.floor(Math.random() * kinds.length)];
        setPowerups((p) => ({ ...p, [k]: p[k] + 1 }));
        toast({ title: "Power-up earned!", description: `Combo ${newStreak}! You gained an extra ${k === "fiftyFifty" ? "50/50" : k === "freeze" ? "Freeze" : "Skip"}.` });
      }
      window.setTimeout(nextQuestion, 900);
    } else {
      const nl = lives - mutator.livesLostOnWrong;
      setLives(Math.max(0, nl));
      setStreak(0);
      setFeedback({ ok: false, gained: 0 });
      setFloatText({ id: Date.now(), text: mutator.livesLostOnWrong > 1 ? `-${mutator.livesLostOnWrong} lives` : "Miss!", ok: false });
      if (nl <= 0) { window.setTimeout(endRun, 1100); return; }
      window.setTimeout(nextQuestion, 1100);
    }
  }, [streak, lives, mutator, frenzy, challenge.kind, questionTime, nextQuestion, endRun, toast]);

  // ── Timer ────────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(questionTime);
  const timeLeftRef = useRef(questionTime);
  timeLeftRef.current = timeLeft;
  useEffect(() => {
    if (done) return;
    setTimeLeft(questionTime);
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          if (!lockRef.current) resolve(false); // ran out of time = miss
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qNum, done]);

  // ── Power-up actions ───────────────────────────────────────────────────────
  const useFiftyFifty = () => {
    if (challenge.kind !== "mcq" || powerups.fiftyFifty <= 0 || chosen !== null) return;
    const wrongIdx = challenge.options.map((_, i) => i).filter((i) => i !== challenge.correct);
    setHidden(shuffle(wrongIdx).slice(0, 2));
    setPowerups((p) => ({ ...p, fiftyFifty: p.fiftyFifty - 1 }));
  };
  const useFreeze = () => {
    if (powerups.freeze <= 0) return;
    setTimeLeft((t) => t + 6);
    setPowerups((p) => ({ ...p, freeze: p.freeze - 1 }));
    setFloatText({ id: Date.now(), text: "+6s ❄️", ok: true });
  };
  const useSkip = () => {
    if (powerups.skip <= 0 || lockRef.current) return;
    setPowerups((p) => ({ ...p, skip: p.skip - 1 }));
    lockRef.current = true;
    nextQuestion();
  };

  // ── Answer handlers ────────────────────────────────────────────────────────
  const pickMcq = (i: number) => {
    if (challenge.kind !== "mcq" || chosen !== null || lockRef.current) return;
    setChosen(i);
    resolve(i === challenge.correct);
  };
  const pickTf = (val: boolean) => {
    if (challenge.kind !== "tf" || tfPick !== null || lockRef.current) return;
    setTfPick(val);
    resolve(val === challenge.isTrue);
  };
  const submitTyped = () => {
    if (challenge.kind !== "type" || typeResult !== null || lockRef.current || !typed.trim()) return;
    const ok = typedMatches(typed, challenge.answer);
    setTypeResult(ok);
    resolve(ok);
  };

  // ── Result screen ──────────────────────────────────────────────────────────
  if (done) {
    const f = finalRef.current;
    const accuracy = f.q > 0 ? Math.round((f.correct / f.q) * 100) : 0;
    return (
      <div className="min-h-screen max-w-md mx-auto px-4 py-12 text-center">
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl mb-3">{f.correct >= 15 ? "🏆" : "🧠"}</div>
          <h2 className="text-3xl font-black mb-1">Blitz Complete!</h2>
          <p className="text-muted-foreground font-bold mb-5">{mutator.emoji} {mutator.name}</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <Stat label="Score" value={f.score.toLocaleString()} icon={Star} />
            <Stat label="Best Combo" value={`×${comboMultiplier(f.best, frenzy)} (${f.best})`} icon={Flame} />
            <Stat label="Correct" value={`${f.correct}`} icon={CheckCircle} />
            <Stat label="Accuracy" value={`${accuracy}%`} icon={Brain} />
          </div>
          {submitting ? (
            <p className="text-muted-foreground font-bold flex items-center justify-center gap-2 mb-4"><Loader2 className="w-4 h-4 animate-spin" /> Tallying rewards…</p>
          ) : rewards ? (
            <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
              {rewards.xp > 0 && <span className="bg-primary/10 px-3 py-1 rounded-full flex items-center gap-1 font-bold"><Zap className="w-4 h-4 text-blue-500" /> +{rewards.xp} XP</span>}
              {rewards.coins > 0 && <span className="bg-amber-500/10 px-3 py-1 rounded-full flex items-center gap-1 font-bold"><Coins className="w-4 h-4 text-amber-500" /> +{rewards.coins}</span>}
            </div>
          ) : null}
          <div className="flex gap-3 justify-center">
            <Button onClick={onReplay} variant="outline" className="gap-2 font-bold" data-testid="blitz-again"><RotateCcw className="w-4 h-4" /> Play Again</Button>
            <Button onClick={onExit} className="gap-2 font-bold" data-testid="blitz-exit"><ArrowLeft className="w-4 h-4" /> Menu</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────
  const urgent = timeLeft <= 4;
  return (
    <div className={`min-h-screen bg-gradient-to-br ${mutator.color} bg-fixed`}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" onClick={onExit} className="gap-2 font-semibold text-white/90 hover:text-white hover:bg-white/10" data-testid="blitz-back">
            <ArrowLeft className="w-4 h-4" /> Quit
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: mutator.lives }).map((_, i) => (
              <Heart key={i} className={`w-6 h-6 ${i < lives ? "text-red-400 fill-red-400" : "text-white/30"}`} />
            ))}
          </div>
        </div>

        {/* HUD */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-white">
          <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
            <div className="text-[10px] font-bold uppercase opacity-80">Score</div>
            <div className="text-lg font-black" data-testid="blitz-score">{score.toLocaleString()}</div>
          </div>
          <div className={`rounded-xl px-3 py-2 text-center ${mult > 1 ? "bg-yellow-400/30" : "bg-white/15"}`}>
            <div className="text-[10px] font-bold uppercase opacity-80">Combo</div>
            <div className="text-lg font-black flex items-center justify-center gap-1"><Flame className={`w-4 h-4 ${mult > 1 ? "text-yellow-300" : "opacity-60"}`} /> ×{mult}</div>
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
            <div className="text-[10px] font-bold uppercase opacity-80">Question</div>
            <div className="text-lg font-black">#{qNum}</div>
          </div>
        </div>

        {/* Timer */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm font-bold mb-1 text-white"><Timer className={`w-4 h-4 ${urgent ? "animate-pulse" : ""}`} /> {timeLeft}s</div>
          <Progress value={(timeLeft / questionTime) * 100} className={`h-2 ${urgent ? "[&>div]:bg-red-400" : "[&>div]:bg-white"}`} />
        </div>

        {/* Question card */}
        <div className="relative bg-background/95 backdrop-blur rounded-3xl p-5 shadow-2xl">
          <AnimatePresence>
            {floatText && (
              <motion.div
                key={floatText.id}
                initial={{ opacity: 0, y: 0, scale: 0.8 }}
                animate={{ opacity: 1, y: -30, scale: 1.1 }}
                exit={{ opacity: 0 }}
                onAnimationComplete={() => setFloatText(null)}
                className={`absolute left-1/2 -translate-x-1/2 top-2 z-10 font-black text-xl ${floatText.ok ? "text-green-500" : "text-red-500"}`}
              >
                {floatText.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Format badge */}
          <div className="flex items-center justify-between mb-3">
            <Badge className="bg-blue-600 text-white border-0 font-black gap-1">
              {challenge.kind === "mcq" && <><ToggleLeft className="w-3.5 h-3.5" /> Multiple Choice</>}
              {challenge.kind === "tf" && <><CheckCircle className="w-3.5 h-3.5" /> True or False</>}
              {challenge.kind === "type" && <><Keyboard className="w-3.5 h-3.5" /> Type It!</>}
            </Badge>
            {/* Power-ups */}
            <div className="flex items-center gap-1.5">
              <PowerBtn icon={Scissors} count={powerups.fiftyFifty} onClick={useFiftyFifty} disabled={challenge.kind !== "mcq" || chosen !== null} title="50/50" testid="blitz-5050" />
              <PowerBtn icon={Snowflake} count={powerups.freeze} onClick={useFreeze} title="Freeze +6s" testid="blitz-freeze" />
              <PowerBtn icon={SkipForward} count={powerups.skip} onClick={useSkip} title="Skip" testid="blitz-skip" />
            </div>
          </div>

          <Card className="p-5 mb-4 border-border bg-card">
            <p className="font-bold text-lg leading-snug" data-testid="blitz-question">{challenge.q}</p>
          </Card>

          {/* MCQ */}
          {challenge.kind === "mcq" && (
            <div className="grid gap-2.5">
              {challenge.options.map((opt, i) => {
                if (hidden.includes(i)) return <div key={i} className="h-[52px] rounded-xl border-2 border-dashed border-border/40 opacity-30" />;
                const isCorrect = i === challenge.correct;
                const isChosen = i === chosen;
                let cls = "bg-card hover:bg-accent border-border";
                if (chosen !== null) {
                  if (isCorrect) cls = "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300";
                  else if (isChosen) cls = "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300";
                  else cls = "bg-card border-border opacity-60";
                }
                return (
                  <button key={i} onClick={() => pickMcq(i)} disabled={chosen !== null} data-testid={`blitz-mcq-${i}`}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 font-semibold transition-all flex items-center justify-between ${cls}`}>
                    <span>{opt}</span>
                    {chosen !== null && isCorrect && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {chosen !== null && isChosen && !isCorrect && <XCircle className="w-5 h-5 text-red-500" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* True / False */}
          {challenge.kind === "tf" && (
            <div>
              <Card className="p-4 mb-4 bg-muted/40 border-border">
                <p className="text-sm text-muted-foreground font-semibold mb-1">Is this the right answer?</p>
                <p className="font-black text-lg">“{challenge.claim}”</p>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                {[true, false].map((val) => {
                  const picked = tfPick === val;
                  const isRight = val === challenge.isTrue;
                  let cls = val ? "bg-green-500/10 hover:bg-green-500/20 border-green-500/40 text-green-700 dark:text-green-300" : "bg-red-500/10 hover:bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300";
                  if (tfPick !== null) {
                    if (isRight) cls = "bg-green-500/25 border-green-500 text-green-700 dark:text-green-300";
                    else if (picked) cls = "bg-red-500/25 border-red-500 text-red-700 dark:text-red-300";
                    else cls = "opacity-50 border-border";
                  }
                  return (
                    <button key={String(val)} onClick={() => pickTf(val)} disabled={tfPick !== null} data-testid={`blitz-tf-${val}`}
                      className={`py-5 rounded-2xl border-2 font-black text-xl transition-all ${cls}`}>
                      {val ? "✓ TRUE" : "✗ FALSE"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Type It */}
          {challenge.kind === "type" && (
            <div>
              <form onSubmit={(e) => { e.preventDefault(); submitTyped(); }} className="flex gap-2">
                <Input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={typeResult !== null}
                  placeholder={`Type your answer (${challenge.answer.length} letters)…`}
                  className="font-bold text-lg"
                  data-testid="blitz-type-input"
                />
                <Button type="submit" disabled={!typed.trim() || typeResult !== null} className="font-bold shrink-0" data-testid="blitz-type-submit">Submit</Button>
              </form>
              {typeResult !== null && (
                <p className={`mt-3 font-bold ${typeResult ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {typeResult ? "Correct! 🎉" : `The answer was: ${challenge.answer}`}
                </p>
              )}
            </div>
          )}

          {/* Explanation on resolve */}
          {feedback && (
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`mt-3 text-sm font-medium px-3 py-2 rounded-lg ${feedback.ok ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
              {challenge.explanation}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Star }) {
  return (
    <div className="bg-muted/50 rounded-xl p-3">
      <div className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-center gap-1"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className="text-lg font-black mt-0.5">{value}</div>
    </div>
  );
}

function PowerBtn({ icon: Icon, count, onClick, disabled, title, testid }: { icon: typeof Scissors; count: number; onClick: () => void; disabled?: boolean; title: string; testid: string }) {
  const off = count <= 0 || disabled;
  return (
    <button
      onClick={onClick}
      disabled={off}
      title={title}
      data-testid={testid}
      className={`relative w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-all ${off ? "border-border opacity-40" : "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20"}`}
    >
      <Icon className="w-4 h-4" />
      <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">{count}</span>
    </button>
  );
}
