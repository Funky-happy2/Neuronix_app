import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Bot, Brain, CheckCircle, XCircle } from "lucide-react";

const PAIRS: [string, string][] = [
  ["🔴", "🔵"],
  ["⭐", "🌙"],
  ["🐶", "🐱"],
  ["🌳", "🌺"],
  ["🍎", "🍊"],
  ["🚀", "✈️"],
  ["🌊", "🔥"],
  ["💎", "🪙"],
  ["🎮", "🎵"],
  ["🐸", "🦊"],
  ["🌈", "⚡"],
  ["🧊", "🌋"],
];

type Challenge = { majority: string; odd: string; oddIdx: number };

function makeChallenge(): Challenge {
  const [a, b] = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  const [majority, odd] = Math.random() < 0.5 ? [a, b] : [b, a];
  const oddIdx = Math.floor(Math.random() * 9);
  return { majority, odd, oddIdx };
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
  const [attempts, setAttempts] = useState(0);

  const cells = useMemo(
    () => Array.from({ length: 9 }, (_, i) => (i === challenge.oddIdx ? challenge.odd : challenge.majority)),
    [challenge]
  );

  const reset = () => {
    setChallenge(makeChallenge());
    setSelected(null);
    setResult(null);
  };

  const handlePick = (idx: number) => {
    if (result) return;
    setSelected(idx);
    const correct = idx === challenge.oddIdx;
    setResult(correct ? "correct" : "wrong");
    if (correct) {
      setTimeout(() => onPass(), 650);
    } else {
      setAttempts(a => a + 1);
      setTimeout(() => reset(), 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" data-testid="human-check-overlay">
      <AnimatePresence mode="wait">
        <motion.div
          key={challenge.oddIdx + challenge.odd}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          className="w-full max-w-sm"
        >
          <Card className="p-6 border-2 border-purple-500/40 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="font-black text-lg leading-tight">{title}</h2>
                <p className="text-xs text-muted-foreground font-medium">Tap the one that's different! 🔍</p>
              </div>
              {onClose && (
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none" data-testid="button-captcha-close">✕</button>
              )}
            </div>

            <div className="bg-muted/40 rounded-xl p-3 mb-4 text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Which one doesn't belong?</p>
              <div className="grid grid-cols-3 gap-2">
                {cells.map((emoji, i) => {
                  let ring = "ring-2 ring-transparent";
                  if (selected === i && result === "correct") ring = "ring-2 ring-emerald-500 bg-emerald-500/20 scale-110";
                  if (selected === i && result === "wrong") ring = "ring-2 ring-red-500 bg-red-500/20";
                  if (result === "wrong" && i === challenge.oddIdx) ring = "ring-2 ring-emerald-500 bg-emerald-500/10";
                  return (
                    <motion.button
                      key={i}
                      whileHover={!result ? { scale: 1.08 } : {}}
                      whileTap={!result ? { scale: 0.92 } : {}}
                      onClick={() => handlePick(i)}
                      disabled={!!result}
                      className={`text-4xl py-3 rounded-xl border border-border bg-background transition-all cursor-pointer ${ring}`}
                      data-testid={`captcha-cell-${i}`}
                    >
                      {emoji}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {result === "correct" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2 text-emerald-500 font-bold text-sm">
                <CheckCircle className="w-4 h-4" /> You found it! You're definitely human! 🎉
              </motion.div>
            )}
            {result === "wrong" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2 text-red-500 font-bold text-sm">
                <XCircle className="w-4 h-4" /> Not that one! Try again...
              </motion.div>
            )}
            {!result && attempts > 0 && (
              <p className="text-center text-xs text-muted-foreground">Attempt {attempts + 1} — look carefully! 👀</p>
            )}
            {!result && attempts === 0 && (
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                <Bot className="w-3.5 h-3.5" />
                <p className="text-xs font-medium">This stops bots from cheating!</p>
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
