import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Bot, Brain, CheckCircle, XCircle, Shield } from "lucide-react";

const EMOJI_PAIRS: [string, string][] = [
  ["🔴", "🟠"], ["⭐", "✨"], ["🐶", "🐺"], ["🌳", "🌲"], ["🍎", "🍅"],
  ["🚀", "🛸"], ["🌊", "💧"], ["💎", "🔷"], ["🐸", "🐢"], ["🌈", "🎏"],
  ["🧊", "🔲"], ["🦊", "🐱"], ["🍊", "🟧"], ["🌙", "🍌"], ["⚡", "✂️"],
];

// How many challenges in a row the player must clear to prove they're human.
const ROUNDS_REQUIRED = 2;

type OddChallenge = {
  kind: "odd";
  cells: string[];
  answerIdx: number;
  prompt: string;
};
type CountChallenge = {
  kind: "count";
  cells: string[];
  target: string;
  options: number[];
  answer: number;
  prompt: string;
};
type SequenceChallenge = {
  kind: "sequence";
  visible: number[];
  options: number[];
  answer: number;
  prompt: string;
};

type Challenge = OddChallenge | CountChallenge | SequenceChallenge;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeOdd(): OddChallenge {
  // 4x4 grid with a single, visually-similar odd one out — harder than a 3x3.
  const [majority, odd] = shuffle(EMOJI_PAIRS[Math.floor(Math.random() * EMOJI_PAIRS.length)]);
  const answerIdx = Math.floor(Math.random() * 16);
  const cells = Array.from({ length: 16 }, (_, i) => (i === answerIdx ? odd : majority));
  return { kind: "odd", cells, answerIdx, prompt: "Tap the ONE that's slightly different" };
}

function makeCount(): CountChallenge {
  const [target, other] = shuffle(EMOJI_PAIRS[Math.floor(Math.random() * EMOJI_PAIRS.length)]);
  const total = 16;
  const answer = 3 + Math.floor(Math.random() * 5); // 3–7 of them
  const cells = shuffle([
    ...Array(answer).fill(target),
    ...Array(total - answer).fill(other),
  ]);
  const opts = new Set<number>([answer]);
  while (opts.size < 4) opts.add(Math.max(1, answer + Math.floor(Math.random() * 7) - 3));
  return { kind: "count", cells, target, answer, options: shuffle(Array.from(opts)), prompt: `How many ${target} do you see?` };
}

function makeSequence(): SequenceChallenge {
  const start = 1 + Math.floor(Math.random() * 6);
  const step = 2 + Math.floor(Math.random() * 4);
  const seq = [start, start + step, start + 2 * step, start + 3 * step];
  const answer = start + 4 * step;
  const opts = new Set<number>([answer]);
  const deltas = [step, -step, 1, -1, 2 * step, step + 1];
  let di = 0;
  while (opts.size < 4 && di < 50) {
    const cand = answer + deltas[di % deltas.length] + Math.floor(Math.random() * 3) - 1;
    if (cand > 0 && cand !== answer) opts.add(cand);
    di++;
  }
  while (opts.size < 4) opts.add(answer + opts.size * step + 1);
  return {
    kind: "sequence",
    visible: seq,
    answer,
    options: shuffle(Array.from(opts)),
    prompt: "What number comes next in the pattern?",
  };
}

function makeChallenge(): Challenge {
  const r = Math.random();
  if (r < 0.34) return makeOdd();
  if (r < 0.67) return makeCount();
  return makeSequence();
}

interface HumanCheckProps {
  onPass: () => void;
  onClose?: () => void;
  title?: string;
}

export default function HumanCheck({ onPass, onClose, title = "Quick Check!" }: HumanCheckProps) {
  const [challenge, setChallenge] = useState<Challenge>(makeChallenge);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [cleared, setCleared] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const next = useCallback((resetProgress: boolean) => {
    setChallenge(makeChallenge());
    setSelected(null);
    setResult(null);
    if (resetProgress) setCleared(0);
  }, []);

  const judge = useCallback((isCorrect: boolean, pickIdx: number | null) => {
    if (result) return;
    setSelected(pickIdx);
    setResult(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      const newCleared = cleared + 1;
      setCleared(newCleared);
      if (newCleared >= ROUNDS_REQUIRED) {
        setTimeout(() => onPass(), 650);
      } else {
        setTimeout(() => next(false), 700);
      }
    } else {
      setAttempts((a) => a + 1);
      setTimeout(() => next(true), 1100);
    }
  }, [result, cleared, next, onPass]);

  const grid = useMemo(() => {
    if (challenge.kind === "odd" || challenge.kind === "count") return challenge.cells;
    return null;
  }, [challenge]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" data-testid="human-check-overlay">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${challenge.kind}-${cleared}-${attempts}`}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          className="w-full max-w-sm"
        >
          <Card className="p-6 border-2 border-purple-500/40 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="font-black text-lg leading-tight">{title}</h2>
                <p className="text-xs text-muted-foreground font-medium">{challenge.prompt} 🔍</p>
              </div>
              {onClose && (
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none" data-testid="button-captcha-close">✕</button>
              )}
            </div>

            {/* Progress pips — must clear ROUNDS_REQUIRED in a row */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {Array.from({ length: ROUNDS_REQUIRED }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i < cleared ? "w-8 bg-emerald-500" : "w-5 bg-muted"}`}
                />
              ))}
              <span className="text-[10px] font-bold text-muted-foreground ml-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> {cleared}/{ROUNDS_REQUIRED}
              </span>
            </div>

            <div className="bg-muted/40 rounded-xl p-3 mb-4 text-center">
              {(challenge.kind === "odd" || challenge.kind === "count") && grid && (
                <div className="grid grid-cols-4 gap-1.5">
                  {grid.map((emoji, i) => {
                    const isOdd = challenge.kind === "odd";
                    let ring = "ring-2 ring-transparent";
                    if (isOdd) {
                      if (selected === i && result === "correct") ring = "ring-2 ring-emerald-500 bg-emerald-500/20 scale-110";
                      if (selected === i && result === "wrong") ring = "ring-2 ring-red-500 bg-red-500/20";
                      if (result === "wrong" && i === (challenge as OddChallenge).answerIdx) ring = "ring-2 ring-emerald-500 bg-emerald-500/10";
                    }
                    return (
                      <motion.button
                        key={i}
                        whileHover={!result && isOdd ? { scale: 1.08 } : {}}
                        whileTap={!result && isOdd ? { scale: 0.92 } : {}}
                        onClick={() => isOdd && judge(i === (challenge as OddChallenge).answerIdx, i)}
                        disabled={!!result || !isOdd}
                        className={`text-2xl py-2 rounded-lg border border-border bg-background transition-all ${isOdd ? "cursor-pointer" : ""} ${ring}`}
                        data-testid={`captcha-cell-${i}`}
                      >
                        {emoji}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {challenge.kind === "sequence" && (
                <div className="flex items-center justify-center gap-2 py-3 flex-wrap">
                  {challenge.visible.map((n, i) => (
                    <span key={i} className="text-2xl font-black text-purple-500">{n}<span className="text-muted-foreground mx-0.5">,</span></span>
                  ))}
                  <span className="text-2xl font-black text-muted-foreground">?</span>
                </div>
              )}
            </div>

            {(challenge.kind === "count" || challenge.kind === "sequence") && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                {challenge.options.map((opt, i) => {
                  const correctVal = challenge.kind === "count" ? challenge.answer : challenge.answer;
                  let cls = "border-border bg-background hover:border-purple-500";
                  if (result && selected === i && result === "correct") cls = "border-emerald-500 bg-emerald-500/20";
                  if (result && selected === i && result === "wrong") cls = "border-red-500 bg-red-500/20";
                  if (result === "wrong" && opt === correctVal) cls = "border-emerald-500 bg-emerald-500/10";
                  return (
                    <button
                      key={i}
                      onClick={() => judge(opt === correctVal, i)}
                      disabled={!!result}
                      className={`text-lg font-black py-2 rounded-lg border-2 transition-all ${cls}`}
                      data-testid={`captcha-option-${i}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {result === "correct" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2 text-emerald-500 font-bold text-sm">
                <CheckCircle className="w-4 h-4" /> {cleared >= ROUNDS_REQUIRED ? "You're human! 🎉" : "Nice! One more..."}
              </motion.div>
            )}
            {result === "wrong" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2 text-red-500 font-bold text-sm">
                <XCircle className="w-4 h-4" /> Not quite — starting over, look carefully...
              </motion.div>
            )}
            {!result && (
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                <Bot className="w-3.5 h-3.5" />
                <p className="text-xs font-medium">This keeps bots and cheaters out!</p>
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
