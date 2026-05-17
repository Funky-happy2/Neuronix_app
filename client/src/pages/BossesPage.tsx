import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Swords, CloudLightning, Zap, Bug, Shield, Star, ArrowLeft,
  Heart, Trophy, Play, Sparkles, Target, CheckCircle, XCircle, Timer,
  FlaskConical, Orbit, Lock, Crown, Moon, Cpu, Mountain, Settings, Gem, Coins,
  Waves, Flame, Snowflake, TreePine, Diamond, Skull, Atom
} from "lucide-react";
import { BOSS_BATTLES } from "@/lib/gameData";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { BossBattle, BossMutation } from "@shared/schema";
import { BOSS_QUESTIONS_BY_YEAR, type BossQ } from "@/lib/bossQuestions";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

const BP_ICON_MAP: Record<string, typeof Shield> = {
  "bp-shield-potion": Shield,
  "bp-time-freeze": Timer,
  "bp-double-damage": Swords,
  "bp-heal-potion": Heart,
  "bp-mirror-shield": Sparkles,
  "bp-quick-draw": Zap,
  "bp-poison-strike": Skull,
};

const BP_COLORS: Record<string, { text: string; bg: string }> = {
  "bp-shield-potion": { text: "text-cyan-400", bg: "bg-cyan-500/20 border-cyan-500/40" },
  "bp-time-freeze": { text: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/40" },
  "bp-double-damage": { text: "text-red-400", bg: "bg-red-500/20 border-red-500/40" },
  "bp-heal-potion": { text: "text-pink-400", bg: "bg-pink-500/20 border-pink-500/40" },
  "bp-mirror-shield": { text: "text-purple-400", bg: "bg-purple-500/20 border-purple-500/40" },
  "bp-quick-draw": { text: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/40" },
  "bp-poison-strike": { text: "text-green-400", bg: "bg-green-500/20 border-green-500/40" },
};

const ICON_MAP: Record<string, any> = {
  CloudLightning, Zap, Bug, FlaskConical, Orbit, Shield, Crown, Timer, Star, Moon, Cpu, Mountain, Settings, Waves, Flame, Snowflake, TreePine, Diamond, Skull, Atom,
};

type BossSkill = {
  id: string;
  name: string;
  description: string;
  icon: typeof Shield;
  color: string;
  bgColor: string;
};

const BOSS_SKILLS: Record<string, BossSkill> = {
  shieldBurst: { id: "shieldBurst", name: "Shield Burst", description: "Boss blocks 80% of your next attack!", icon: Shield, color: "text-cyan-400", bgColor: "bg-cyan-500/20 border-cyan-500/40" },
  mindWarp: { id: "mindWarp", name: "Mind Warp", description: "Answers will shuffle in 3 seconds!", icon: Orbit, color: "text-purple-400", bgColor: "bg-purple-500/20 border-purple-500/40" },
  powerDrain: { id: "powerDrain", name: "Power Drain", description: "Boss steals 10 HP from you!", icon: Zap, color: "text-red-400", bgColor: "bg-red-500/20 border-red-500/40" },
  doubleStrike: { id: "doubleStrike", name: "Double Strike", description: "Wrong answers deal 2x damage!", icon: Swords, color: "text-orange-400", bgColor: "bg-orange-500/20 border-orange-500/40" },
};

function getAvailableSkills(mutationLevel: number): string[] {
  if (mutationLevel >= 2) return ["shieldBurst", "mindWarp", "powerDrain", "doubleStrike"];
  if (mutationLevel === 1) return ["shieldBurst", "powerDrain"];
  return [];
}

function shouldActivateSkill(questionIndex: number, mutationLevel: number): boolean {
  if (mutationLevel === 0 || questionIndex === 0) return false;
  if (mutationLevel >= 2) {
    return questionIndex % 2 === 0 || (questionIndex % 3 === 0 && Math.random() > 0.3);
  }
  return questionIndex % 3 === 0 && Math.random() > 0.4;
}

function pickRandomSkill(mutationLevel: number): BossSkill | null {
  const skills = getAvailableSkills(mutationLevel);
  if (skills.length === 0) return null;
  return BOSS_SKILLS[skills[Math.floor(Math.random() * skills.length)]];
}

interface BossPageProps {
  onAddXP: (amount: number) => void;
  onAddCoins: (amount: number) => void;
  onEarnBadge: (badgeId: string) => void;
  onDefeatBoss: (bossId: string) => void;
  bossesDefeated: Record<string, number>;
  yearLevel: number;
  xp?: number;
  badges?: string[];
  totalGamesPlayed?: number;
}


function getBossQuestions(bossId: string, yearLevel: number, mutationLevel: number = 0): BossQ[] {
  const bossQs = BOSS_QUESTIONS_BY_YEAR[bossId];
  if (!bossQs) return [];

  let effectiveYear = yearLevel;
  if (mutationLevel === 1) {
    effectiveYear = Math.min(yearLevel + 2, 8);
  } else if (mutationLevel >= 2) {
    effectiveYear = 8;
  }

  let baseQuestions: BossQ[];
  if (bossQs[effectiveYear]) baseQuestions = bossQs[effectiveYear];
  else if (effectiveYear <= 4) baseQuestions = bossQs[4] || bossQs[6] || [];
  else if (effectiveYear >= 7) baseQuestions = bossQs[8] || bossQs[6] || [];
  else baseQuestions = bossQs[6] || [];

  if (mutationLevel > 0) {
    const allTierQuestions: BossQ[] = [];
    for (const tier of [4, 6, 8]) {
      if (bossQs[tier]) allTierQuestions.push(...bossQs[tier]);
    }
    const extraQuestions = allTierQuestions.filter(q => !baseQuestions.includes(q));
    const shuffledExtra = extraQuestions.sort(() => Math.random() - 0.5);
    const extraCount = mutationLevel === 1 ? 4 : 8;
    const combined = [...baseQuestions, ...shuffledExtra.slice(0, extraCount)];
    return combined
      .sort(() => Math.random() - 0.5)
      .map(q => {
        const correctAnswer = q.options[q.correct];
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
        const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
        return { ...q, options: shuffledOptions, correct: newCorrectIndex };
      });
  }

  return [...baseQuestions]
    .sort(() => Math.random() - 0.5)
    .map(q => {
      const correctAnswer = q.options[q.correct];
      const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
      const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
      return { ...q, options: shuffledOptions, correct: newCorrectIndex };
    });
}

function getBossForm(boss: BossBattle, defeatCount: number): { name: string; title: string; description: string; icon: string; gradient: string; phases: number; difficulty: string; reward: string; badgeId: string; mutationLevel: number } {
  if (defeatCount === 0 || boss.mutations.length === 0) {
    return { name: boss.name, title: boss.title, description: boss.description, icon: boss.icon, gradient: boss.gradient, phases: boss.phases, difficulty: boss.difficulty, reward: boss.reward, badgeId: boss.badgeId, mutationLevel: 0 };
  }
  if (defeatCount > boss.mutations.length) {
    const lastMut = boss.mutations[boss.mutations.length - 1];
    return { name: boss.name, title: "Conquered!", description: `You have completely mastered ${boss.name}! All ${boss.mutations.length + 1} forms defeated. You are a true science champion!`, icon: lastMut.icon, gradient: lastMut.gradient, phases: lastMut.phases, difficulty: "Mastered", reward: lastMut.reward, badgeId: lastMut.badgeId, mutationLevel: boss.mutations.length };
  }
  const mutIdx = defeatCount - 1;
  const mut = boss.mutations[mutIdx];
  return { name: mut.name, title: mut.title, description: mut.description, icon: mut.icon, gradient: mut.gradient, phases: mut.phases, difficulty: mut.difficulty, reward: mut.reward, badgeId: mut.badgeId, mutationLevel: mutIdx + 1 };
}

function BossFight({ boss, bossForm, onComplete, onBack, yearLevel = 7, isReplay = false, hasBossInsight = false, hasLuckyAnswer = false, hasScienceScanner = false, itemLevels = {} }: { boss: BossBattle; bossForm: ReturnType<typeof getBossForm>; onComplete: (won: boolean) => void; onBack: () => void; yearLevel?: number; isReplay?: boolean; hasBossInsight?: boolean; hasLuckyAnswer?: boolean; hasScienceScanner?: boolean; itemLevels?: Record<string, number> }) {
  const { toast } = useToast();
  const questionsRef = useRef<BossQ[] | null>(null);
  if (!questionsRef.current) {
    const allQuestions = getBossQuestions(boss.id, yearLevel, bossForm.mutationLevel);
    const questionCount = Math.min(allQuestions.length, bossForm.phases + 3);
    questionsRef.current = allQuestions.slice(0, questionCount);
  }
  const questions = questionsRef.current;

  const [phase, setPhase] = useState(0);
  const [bossHP, setBossHP] = useState(100);
  const [playerHP, setPlayerHP] = useState(100);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [lockedQuestion, setLockedQuestion] = useState<BossQ | null>(null);
  const [insightUsed, setInsightUsed] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [activeSkill, setActiveSkill] = useState<BossSkill | null>(null);
  const [skillAnimating, setSkillAnimating] = useState(false);
  const [mindWarpShuffled, setMindWarpShuffled] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<string[] | null>(null);
  const [displayCorrect, setDisplayCorrect] = useState<number | null>(null);

  const { data: bpData } = useQuery<{ powerups: any[]; owned: Record<string, number> }>({
    queryKey: ["/api/battle-powerups"],
  });
  const [localBpCounts, setLocalBpCounts] = useState<Record<string, number> | null>(null);
  const bpCounts = localBpCounts ?? bpData?.owned ?? {};
  const hasPowerups = Object.values(bpCounts).some(c => c > 0);
  const [activePowerup, setActivePowerup] = useState<string | null>(null);
  const [powerupUsedThisQ, setPowerupUsedThisQ] = useState(false);
  const [shieldHitsLeft, setShieldHitsLeft] = useState(0);
  const [timerFrozen, setTimerFrozen] = useState(false);
  const [damageMultiplier, setDamageMultiplier] = useState(1);
  const [quickDrawActive, setQuickDrawActive] = useState(false);
  const [quickDrawTime, setQuickDrawTime] = useState<number | null>(null);
  const [poisonTurns, setPoisonTurns] = useState(0);
  const [poisonDmgPerTurn, setPoisonDmgPerTurn] = useState(5);

  const usePowerup = useCallback(async (powerupId: string) => {
    if (powerupUsedThisQ || selected !== null || gameOver) return;
    const count = bpCounts[powerupId] || 0;
    if (count <= 0) return;

    setLocalBpCounts(prev => {
      const next = { ...(prev ?? bpCounts) };
      next[powerupId] = (next[powerupId] || 0) - 1;
      if (next[powerupId] <= 0) delete next[powerupId];
      return next;
    });
    setPowerupUsedThisQ(true);
    setActivePowerup(powerupId);

    apiRequest("POST", "/api/battle-powerup/use", { powerupId }).catch(() => {});

    const bpName = bpData?.powerups?.find(p => p.id === powerupId)?.name || powerupId;

    const bpLvl = (itemLevels[powerupId] || 0);
    if (powerupId === "bp-shield-potion") {
      const hits = [1, 2, 3][bpLvl] ?? 3;
      setShieldHitsLeft(hits);
      toast({ title: "Shield Potion Active!", description: hits > 1 ? `Blocks the next ${hits} wrong answers! (Lv${bpLvl})` : "Your next wrong answer won't deal damage." });
    } else if (powerupId === "bp-time-freeze") {
      setTimerFrozen(true);
      toast({ title: "Time Freeze!", description: "Timer is paused for this question." });
    } else if (powerupId === "bp-double-damage") {
      const mult = [2, 3, 4][bpLvl] ?? 4;
      setDamageMultiplier(mult);
      toast({ title: mult > 2 ? `${mult}x Damage!` : "Double Damage!", description: `Your next correct answer deals ${mult}x damage!` });
    } else if (powerupId === "bp-heal-potion") {
      const healAmt = [25, 40, 60][bpLvl] ?? 60;
      setPlayerHP(prev => Math.min(100, prev + healAmt));
      toast({ title: "Heal Potion!", description: `Restored ${healAmt} HP!${bpLvl > 0 ? ` (Lv${bpLvl} upgrade)` : ""}` });
    } else if (powerupId === "bp-mirror-shield") {
      const mirrorDmg = [10, 20, 30][bpLvl] ?? 30;
      if (activeSkill) {
        setActiveSkill(null);
        setBossHP(prev => Math.max(0, prev - mirrorDmg));
        if (activeSkill.id === "powerDrain") {
          setPlayerHP(prev => Math.min(100, prev + 10));
          toast({ title: "Reflected!", description: `Power Drain reflected! Boss took ${mirrorDmg} damage and you healed 10 HP!` });
        } else if (activeSkill.id === "doubleStrike") {
          const reflectMult = [2, 3, 4][bpLvl] ?? 4;
          setDamageMultiplier(reflectMult);
          toast({ title: "Reflected!", description: `Double Strike turned against the boss! Boss took ${mirrorDmg} damage + your next hit deals ${reflectMult}x!` });
        } else if (activeSkill.id === "mindWarp") {
          setDisplayOptions(null);
          setDisplayCorrect(null);
          setMindWarpShuffled(false);
          toast({ title: "Reflected!", description: `Mind Warp reflected! Options restored and boss took ${mirrorDmg} damage!` });
        } else {
          toast({ title: "Reflected!", description: `${activeSkill.name} reflected! Boss took ${mirrorDmg} damage!` });
        }
      } else {
        setBossHP(prev => Math.max(0, prev - mirrorDmg));
        toast({ title: "Mirror Shield!", description: `No skill active, but boss took ${mirrorDmg} damage!` });
      }
    } else if (powerupId === "bp-quick-draw") {
      const bonusPct = [50, 75, 100][bpLvl] ?? 100;
      setQuickDrawActive(true);
      setQuickDrawTime(Date.now());
      toast({ title: "Quick Draw!", description: `Answer within 3 seconds for +${bonusPct}% damage!` });
    } else if (powerupId === "bp-poison-strike") {
      const turnCount = [3, 4, 5][bpLvl] ?? 5;
      const dmgPerTurn = [5, 7, 10][bpLvl] ?? 10;
      setPoisonTurns(turnCount);
      setPoisonDmgPerTurn(dmgPerTurn);
      toast({ title: "Poison Strike!", description: `Boss takes ${dmgPerTurn} damage for the next ${turnCount} questions!` });
    }
  }, [powerupUsedThisQ, selected, gameOver, bpCounts, activeSkill, bpData, itemLevels, toast]);

  useEffect(() => {
    if (gameOver || selected !== null) return;
    const skill = shouldActivateSkill(currentQ, bossForm.mutationLevel) ? pickRandomSkill(bossForm.mutationLevel) : null;
    setActiveSkill(skill);
    setMindWarpShuffled(false);
    setDisplayOptions(null);
    setDisplayCorrect(null);
    if (skill) {
      setSkillAnimating(true);
      setTimeout(() => setSkillAnimating(false), 1500);
      if (skill.id === "powerDrain") {
        setPlayerHP(prev => Math.max(0, prev - 10));
      }
      if (skill.id === "mindWarp") {
        setTimeout(() => {
          if (selectedRef.current !== null || gameOverRef.current) return;
          const currentQuestion = questions[currentQ];
          if (!currentQuestion) return;
          const correctAnswer = currentQuestion.options[currentQuestion.correct];
          const shuffled = [...currentQuestion.options].sort(() => Math.random() - 0.5);
          const newCorrectIdx = shuffled.indexOf(correctAnswer);
          setDisplayOptions(shuffled);
          setDisplayCorrect(newCorrectIdx);
          setMindWarpShuffled(true);
          setEliminatedOptions(prev => {
            if (prev.length === 0) return prev;
            const oldElimTexts = prev.map(i => currentQuestion.options[i]);
            const newElim = oldElimTexts
              .map(t => shuffled.indexOf(t))
              .filter(i => i !== -1 && i !== newCorrectIdx);
            if (newElim.length === 0) {
              const wrongIndices = shuffled.map((_, i) => i).filter(i => i !== newCorrectIdx);
              return wrongIndices.length > 0 ? [wrongIndices[Math.floor(Math.random() * wrongIndices.length)]] : [];
            }
            return newElim;
          });
        }, 3000);
      }
    }
  }, [currentQ]);

  const timerMax = bossForm.mutationLevel === 0 ? 0 : bossForm.mutationLevel === 1 ? 20 : 12;
  const [timer, setTimer] = useState(timerMax);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const gameOverRef = useRef(gameOver);
  gameOverRef.current = gameOver;

  const timerFrozenRef = useRef(timerFrozen);
  timerFrozenRef.current = timerFrozen;

  useEffect(() => {
    if (timerMax <= 0 || selected !== null || gameOver) return;
    setTimer(timerMax);
    const interval = setInterval(() => {
      if (selectedRef.current !== null || gameOverRef.current) {
        clearInterval(interval);
        return;
      }
      if (timerFrozenRef.current) return;
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQ, timerMax, selected, gameOver]);

  const timerFiredRef = useRef(false);
  useEffect(() => {
    timerFiredRef.current = false;
  }, [currentQ]);

  useEffect(() => {
    if (timerMax > 0 && timer === 0 && selected === null && !gameOver && !timerFiredRef.current) {
      timerFiredRef.current = true;
      const currentQuestion = questions[currentQ];
      const wrongIndices = currentQuestion.options.map((_, i) => i).filter(i => i !== currentQuestion.correct);
      const randomWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
      handleAnswer(randomWrong);
    }
  }, [timer]);

  useEffect(() => {
    if (hasLuckyAnswer && selected === null && currentQ < questions.length) {
      const currentQuestion = questions[currentQ];
      const wrongIndices = currentQuestion.options.map((_, i) => i).filter(i => i !== currentQuestion.correct);
      const randomWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
      setEliminatedOptions(prev => prev.length === 0 || prev.every(e => e !== randomWrong) ? [randomWrong] : prev);
    }
  }, [currentQ, hasLuckyAnswer]);

  const wrongDamage = bossForm.mutationLevel === 0 ? 25 : bossForm.mutationLevel === 1 ? 35 : 50;
  const bossHealOnWrong = bossForm.mutationLevel >= 2 ? 8 : bossForm.mutationLevel === 1 ? 4 : 0;

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    const currentQuestion = questions[currentQ];
    const effectiveCorrect = (displayCorrect !== null && mindWarpShuffled) ? displayCorrect : currentQuestion.correct;
    const lockedQ = (displayOptions && mindWarpShuffled && displayCorrect !== null)
      ? { ...currentQuestion, options: displayOptions, correct: displayCorrect }
      : currentQuestion;
    setLockedQuestion(lockedQ);
    setSelected(idx);
    setShowExplanation(true);

    const isCorrect = idx === effectiveCorrect;
    let damage = 100 / questions.length + 5;
    if (isCorrect && activeSkill?.id === "shieldBurst") {
      damage = damage * 0.2;
    }
    if (isCorrect && damageMultiplier > 1) {
      damage = damage * damageMultiplier;
    }
    if (isCorrect && quickDrawActive && quickDrawTime) {
      const elapsed = (Date.now() - quickDrawTime) / 1000;
      const bonusMult = itemLevels["bp-quick-draw"] === 2 ? 2.0 : itemLevels["bp-quick-draw"] === 1 ? 1.75 : 1.5;
      if (elapsed <= 3) {
        damage = damage * bonusMult;
      }
    }
    let actualWrongDamage = wrongDamage;
    if (!isCorrect && activeSkill?.id === "doubleStrike") {
      actualWrongDamage = wrongDamage * 2;
    }
    if (!isCorrect && shieldHitsLeft > 0) {
      actualWrongDamage = 0;
      setShieldHitsLeft(prev => prev - 1);
    }
    let poisonDmg = 0;
    if (poisonTurns > 0) {
      poisonDmg = poisonDmgPerTurn;
      setPoisonTurns(prev => prev - 1);
    }
    const nextBossHP = isCorrect ? Math.max(0, bossHP - damage - poisonDmg) : Math.max(0, Math.min(100, bossHP + bossHealOnWrong) - poisonDmg);
    const nextPlayerHP = isCorrect ? playerHP : Math.max(0, playerHP - actualWrongDamage);

    setBossHP(nextBossHP);
    setPlayerHP(nextPlayerHP);

    setTimeout(() => {
      setSelected(null);
      setShowExplanation(false);
      setLockedQuestion(null);
      setInsightUsed(false);
      setEliminatedOptions([]);
      setActiveSkill(null);
      setDisplayOptions(null);
      setDisplayCorrect(null);
      setMindWarpShuffled(false);
      setActivePowerup(null);
      setPowerupUsedThisQ(false);
      setTimerFrozen(false);
      setDamageMultiplier(1);
      setQuickDrawActive(false);
      setQuickDrawTime(null);

      if (nextBossHP <= 0) {
        setWon(true);
        setGameOver(true);
      } else if (nextPlayerHP <= 0) {
        setWon(false);
        setGameOver(true);
      } else if (currentQ + 1 >= questions.length) {
        setWon(nextPlayerHP > nextBossHP);
        setGameOver(true);
      } else {
        setCurrentQ((q) => q + 1);
        if ((currentQ + 1) % Math.ceil(questions.length / bossForm.phases) === 0) {
          setPhase((p) => p + 1);
        }
      }
    }, 2000);
  };

  if (gameOver) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <Card className={`p-8 text-center border-border`}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
              {won ? (
                <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              ) : (
                <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              )}
            </motion.div>
            <h1 className="text-3xl font-black mb-2" data-testid="text-boss-result">
              {won ? "BOSS DEFEATED!" : "Try Again!"}
            </h1>
            <p className="text-muted-foreground font-medium mb-2">
              {won
                ? `You defeated ${bossForm.name}! ${isReplay ? "Great practice!" : "Incredible science knowledge!"}`
                : `${bossForm.name} was too powerful this time. Keep learning and try again!`}
            </p>
            {won && !isReplay && (
              <div className="flex flex-wrap gap-2 justify-center mb-3">
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 font-bold">
                  +{bossForm.mutationLevel === 0 ? 500 : bossForm.mutationLevel === 1 ? 750 : 1500} XP
                </Badge>
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 font-bold">
                  +{bossForm.mutationLevel === 0 ? 100 : bossForm.mutationLevel === 1 ? 200 : 500} Coins
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold">
                  {bossForm.badgeId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())} Badge
                </Badge>
                {bossForm.mutationLevel >= 2 && (
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 font-bold">
                    +5 Gems
                  </Badge>
                )}
              </div>
            )}
            {won && isReplay && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-bold mb-3">
                Replay Mode - Just for fun!
              </Badge>
            )}
            {won && !isReplay && bossForm.mutationLevel < boss.mutations.length && (
              <p className="text-sm font-bold text-orange-500 dark:text-orange-400 mb-4">
                The boss is mutating... A stronger form awaits!
              </p>
            )}
            {won && !isReplay && bossForm.mutationLevel >= boss.mutations.length && bossForm.mutationLevel > 0 && (
              <div className="mb-4">
                <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 mb-1">
                  ULTIMATE VICTORY!
                </p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  You conquered every form of {boss.name}! You are a true science master!
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center mt-4">
              {!won && (
                <Button variant="outline" onClick={onBack} className="gap-2 font-bold" data-testid="button-back-bosses">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              )}
              <Button onClick={() => onComplete(won)} className="gap-2 font-bold" data-testid="button-collect-boss-reward">
                <Sparkles className="w-4 h-4" /> {won ? "Collect Reward" : "Continue"}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const effectiveQ = (() => {
    if (lockedQuestion) return lockedQuestion;
    const base = questions[currentQ];
    if (displayOptions && mindWarpShuffled && displayCorrect !== null) {
      return { ...base, options: displayOptions, correct: displayCorrect };
    }
    return base;
  })();
  const IconComp = ICON_MAP[bossForm.icon] || Swords;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 font-semibold mb-4" data-testid="button-quit-boss">
        <ArrowLeft className="w-4 h-4" /> Retreat
      </Button>

      {bossForm.mutationLevel > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="destructive" className="text-xs font-bold gap-1">
            <Sparkles className="w-3 h-3" /> Mutation Level {bossForm.mutationLevel}
          </Badge>
          <span className="text-xs text-muted-foreground font-semibold">{bossForm.difficulty} Difficulty</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-bold">Your HP</span>
          </div>
          <div className="w-full bg-muted rounded-full h-4 overflow-visible">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
              animate={{ width: `${playerHP}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">{Math.round(playerHP)}%</p>
        </Card>

        <Card className={`p-4 border-border bg-gradient-to-br ${bossForm.gradient} text-white border-0`}>
          <div className="flex items-center gap-2 mb-2">
            <IconComp className="w-4 h-4" />
            <span className="text-sm font-bold">{bossForm.name}</span>
          </div>
          <div className="w-full bg-black/20 rounded-full h-4 overflow-visible">
            <motion.div
              className="h-full rounded-full bg-white/80"
              animate={{ width: `${bossHP}%` }}
            />
          </div>
          <p className="text-xs text-white/80 mt-1 font-semibold">{Math.round(bossHP)}% - Phase {phase + 1}/{bossForm.phases}</p>
        </Card>
      </div>

      {hasPowerups && (
        <div className="mb-4" data-testid="powerup-toolbar">
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(bpCounts).filter(([_, c]) => c > 0).map(([id, count]) => {
              const BpIcon = BP_ICON_MAP[id] || Shield;
              const colors = BP_COLORS[id] || { text: "text-gray-400", bg: "bg-gray-500/20 border-gray-500/40" };
              const isActive = activePowerup === id;
              const bpInfo = bpData?.powerups?.find(p => p.id === id);
              return (
                <Button
                  key={id}
                  size="sm"
                  variant="outline"
                  disabled={powerupUsedThisQ || selected !== null || gameOver}
                  className={`gap-1.5 font-bold text-xs border ${colors.bg} ${colors.text} ${isActive ? "ring-2 ring-white/50" : ""}`}
                  onClick={() => usePowerup(id)}
                  data-testid={`button-powerup-${id}`}
                >
                  <BpIcon className="w-3.5 h-3.5" />
                  <span>{bpInfo?.name || id.replace("bp-", "").replace(/-/g, " ")}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-0">{count}</Badge>
                </Button>
              );
            })}
          </div>
          <AnimatePresence>
            {activePowerup && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2"
              >
                <Badge className={`text-xs font-bold gap-1.5 ${BP_COLORS[activePowerup]?.bg || ""} ${BP_COLORS[activePowerup]?.text || ""} border`}>
                  {(() => { const I = BP_ICON_MAP[activePowerup]; return I ? <I className="w-3 h-3" /> : null; })()}
                  {bpData?.powerups?.find(p => p.id === activePowerup)?.name || activePowerup} Active
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {activeSkill && skillAnimating && (
          <motion.div
            key={`skill-${currentQ}`}
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="mb-4"
          >
            <Card className={`p-4 border-2 ${activeSkill.bgColor}`} data-testid="card-boss-skill-alert">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: 1 }}
                >
                  <activeSkill.icon className={`w-6 h-6 ${activeSkill.color}`} />
                </motion.div>
                <div>
                  <p className={`text-sm font-black ${activeSkill.color}`}>{activeSkill.name}!</p>
                  <p className="text-xs text-muted-foreground font-semibold">{activeSkill.description}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {activeSkill && !skillAnimating && selected === null && (
        <div className="mb-3 flex items-center gap-2" data-testid="indicator-active-boss-skill">
          <Badge className={`text-xs font-bold gap-1.5 ${activeSkill.bgColor} ${activeSkill.color} border`}>
            <activeSkill.icon className="w-3 h-3" /> {activeSkill.name} Active
          </Badge>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
        >
          <Card className="p-6 mb-4 border-border">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <Badge variant="secondary" className="text-xs font-bold">
                <Target className="w-3 h-3 mr-1" /> Attack {currentQ + 1}/{questions.length}
              </Badge>
              {timerMax > 0 && selected === null && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${timer <= 3 ? "bg-red-500" : timer <= 6 ? "bg-amber-500" : "bg-green-500"}`}
                      animate={{ width: `${(timer / timerMax) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className={`text-xs font-black tabular-nums ${timer <= 3 ? "text-red-500 animate-pulse" : timer <= 6 ? "text-amber-500" : "text-muted-foreground"}`}>{timer}s</span>
                </div>
              )}
              {hasBossInsight && !insightUsed && selected === null && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-bold gap-1"
                  onClick={() => {
                    const currentQuestion = questions[currentQ];
                    const wrongIndices = currentQuestion.options
                      .map((_, i) => i)
                      .filter(i => i !== currentQuestion.correct);
                    const shuffled = wrongIndices.sort(() => Math.random() - 0.5);
                    setEliminatedOptions(shuffled.slice(0, 2));
                    setInsightUsed(true);
                  }}
                  data-testid="button-boss-insight"
                >
                  <Sparkles className="w-3 h-3" /> 50/50 Hint
                </Button>
              )}
            </div>
            <h2 className="text-lg font-bold">{effectiveQ.question}</h2>
            {hasScienceScanner && (
              <Badge variant="outline" className="mt-2 text-[10px] font-bold gap-1 text-purple-500 border-purple-500/30">
                <FlaskConical className="w-3 h-3" /> {bossForm.title.replace(/^(Mutated |Omega )/, "").replace(/ Boss$/, "")}
              </Badge>
            )}
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {effectiveQ.options.map((opt, i) => {
              const isEliminated = eliminatedOptions.includes(i);
              const effectiveCorrect = (displayCorrect !== null && mindWarpShuffled) ? displayCorrect : effectiveQ.correct;
              let extraClass = "";
              if (selected !== null) {
                if (i === effectiveCorrect) extraClass = "border-emerald-500 bg-emerald-500/10";
                else if (i === selected) extraClass = "border-red-500 bg-red-500/10";
              }

              return (
                <Card
                  key={i}
                  className={`p-4 cursor-pointer border-2 border-border ${extraClass} ${selected === null ? "hover-elevate" : ""} ${isEliminated ? "opacity-30 pointer-events-none" : ""}`}
                  onClick={() => !isEliminated && handleAnswer(i)}
                  data-testid={`button-boss-answer-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      selected !== null && i === effectiveCorrect ? "bg-emerald-500 text-white" :
                      selected === i && i !== effectiveCorrect ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {selected !== null && i === effectiveCorrect ? <CheckCircle className="w-5 h-5" /> :
                       selected === i && i !== effectiveCorrect ? <XCircle className="w-5 h-5" /> :
                       String.fromCharCode(65 + i)}
                    </div>
                    <span className="font-semibold text-sm">{isEliminated ? "---" : opt}</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {showExplanation && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4 mt-4 border-border bg-blue-500/5 border-blue-500/20">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  {effectiveQ.explanation}
                </p>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function BossesPage({ onAddXP, onAddCoins, onEarnBadge, onDefeatBoss, bossesDefeated, yearLevel, xp = 0, badges = [], totalGamesPlayed = 0 }: BossPageProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const rebirthLevel = user?.rebirthLevel || 0;
  const gemUpgradesEnabled = localStorage.getItem("cosmetic-gem-upgrades") !== "false";
  const upgradeUses = (user as any)?.upgradeExpirations as Record<string, number> | undefined;
  const isUpActive = (id: string) => {
    if (!user?.inventory?.includes(id)) return false;
    return (upgradeUses?.[id] || 0) > 0;
  };
  const hasBossInsight = gemUpgradesEnabled && isUpActive("upgrade-boss-insight");
  const hasBossRush = gemUpgradesEnabled && isUpActive("upgrade-boss-rush");
  const hasLuckyAnswer = user?.inventory?.includes("powerup-lucky-answer") ?? false;
  const hasScienceScanner = user?.inventory?.includes("powerup-science-scanner") ?? false;
  const [fightingBoss, setFightingBoss] = useState<BossBattle | null>(null);
  const [fightingForm, setFightingForm] = useState<ReturnType<typeof getBossForm> | null>(null);
  const [isReplay, setIsReplay] = useState(false);
  const [challengeFee, setChallengeFee] = useState(0);

  const startFight = async (boss: BossBattle, replayLevel?: number) => {
    const defeatCount = bossesDefeated[boss.id] || 0;
    const mutLevel = replayLevel !== undefined ? replayLevel : Math.min(defeatCount, boss.mutations.length);
    const isReplayFight = replayLevel !== undefined;

    try {
      const r = await apiRequest("POST", "/api/boss/challenge", { bossId: boss.id, mutationLevel: mutLevel });
      if (!r.ok) {
        const err = await r.json();
        toast({ title: "Error", description: err.message || "Failed to start challenge.", variant: "destructive" });
        return;
      }
      const data = await r.json();
      setChallengeFee(data.fee || 0);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    } catch {
      toast({ title: "Error", description: "Failed to start challenge.", variant: "destructive" });
      return;
    }

    if (replayLevel !== undefined) {
      const form = getBossForm(boss, replayLevel);
      setFightingBoss(boss);
      setFightingForm(form);
      setIsReplay(true);
    } else {
      const form = getBossForm(boss, defeatCount);
      setFightingBoss(boss);
      setFightingForm(form);
      setIsReplay(false);
    }
  };

  if (fightingBoss && fightingForm) {
    return (
      <BossFight
        boss={fightingBoss}
        bossForm={fightingForm}
        yearLevel={yearLevel}
        isReplay={isReplay}
        hasBossInsight={hasBossInsight}
        hasLuckyAnswer={hasLuckyAnswer}
        hasScienceScanner={hasScienceScanner}
        itemLevels={(user as any)?.itemLevels || {}}
        onBack={() => { setFightingBoss(null); setFightingForm(null); setIsReplay(false); }}
        onComplete={(won) => {
          if (won && !isReplay) {
            apiRequest("POST", "/api/daily-challenge/complete", { challengeType: "boss-challenge" }).catch(() => {});
            
            apiRequest("POST", "/api/boss/defeat", { bossId: fightingBoss.id, mutationLevel: fightingForm.mutationLevel, gemUpgradesDisabled: !gemUpgradesEnabled })
              .then(async (r) => {
                const data = await r.json();
                const parts: string[] = [];
                if (data.xpEarned > 0) parts.push(`${data.xpEarned} XP`);
                if (data.coinsEarned > 0) parts.push(`${data.coinsEarned} coins`);
                if (data.gemsEarned > 0) parts.push(`${data.gemsEarned} gems`);
                if (data.itemsAwarded?.length > 0) parts.push(`${data.itemsAwarded.length} reward item${data.itemsAwarded.length > 1 ? "s" : ""}`);
                if (data.badgesAwarded?.length > 0) parts.push(`${data.badgesAwarded.length} badge${data.badgesAwarded.length > 1 ? "s" : ""}`);
                if (parts.length > 0) {
                  toast({ title: "Boss Rewards!", description: `You earned ${parts.join(", ")}!` });
                }
                queryClient.invalidateQueries({ queryKey: ["/api/user"] });
              })
              .catch(() => {});
          } else if (!won) {
            toast({ title: "Defeated!", description: challengeFee > 0 ? `You lost ${challengeFee} coins! Train harder and try again!` : "Train harder and try again!", variant: "destructive" });
          }
          setFightingBoss(null);
          setFightingForm(null);
          setIsReplay(false);
          setChallengeFee(0);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
          <Swords className="w-8 h-8 text-red-500" /> Boss Battles
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          Face science-themed bosses! Defeat them and watch them mutate into stronger forms!
        </p>
        <Badge variant="secondary" className="mt-2 text-xs font-bold" data-testid="text-boss-year-level">
          Year {yearLevel} questions {yearLevel <= 4 ? "(Easier)" : yearLevel >= 7 ? "(Advanced)" : "(Standard)"}
        </Badge>
      </div>

      <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {BOSS_BATTLES.filter(b => !b.isSecret && !b.world).map((boss, i) => {
          const defeatCount = bossesDefeated[boss.id] || 0;
          const form = getBossForm(boss, defeatCount);
          const IconComp = ICON_MAP[form.icon] || Swords;
          const maxMutations = boss.mutations.length;
          const rebirthLocked = boss.requiredRebirth && rebirthLevel < boss.requiredRebirth;

          if (rebirthLocked) {
            return (
              <motion.div
                key={boss.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card className="border-border bg-muted/50 relative opacity-70" data-testid={`card-boss-${boss.id}`}>
                  <div className="relative p-6 text-center">
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mx-auto mb-3">
                      <Lock className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-black mb-1">{boss.name}</h3>
                    <p className="text-xs text-muted-foreground font-semibold mb-2">{boss.title}</p>
                    <Badge variant="outline" className="text-[10px] font-bold gap-1">
                      <Lock className="w-3 h-3" /> Requires Rebirth {boss.requiredRebirth} (You: {rebirthLevel})
                    </Badge>
                  </div>
                </Card>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={boss.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Card className={`border-0 bg-gradient-to-br ${form.gradient} text-white relative group`} data-testid={`card-boss-${boss.id}`}>
                <div className="absolute inset-0 bg-black/15 rounded-md" />
                <div className="relative p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <IconComp className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-white/70">{form.title}</p>
                      <h3 className="text-xl font-black">{form.name}</h3>
                    </div>
                  </div>

                  {defeatCount > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="text-[10px] font-bold bg-white/20 text-white border-white/20 gap-1">
                        <Crown className="w-3 h-3" /> Defeated {defeatCount}x
                      </Badge>
                      {defeatCount <= maxMutations && (
                        <Badge variant="secondary" className="text-[10px] font-bold bg-red-500/30 text-white border-red-500/20 gap-1">
                          <Sparkles className="w-3 h-3" /> MUTATED!
                        </Badge>
                      )}
                    </div>
                  )}

                  <p className="text-sm text-white/85 mb-4 leading-relaxed">
                    {form.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {boss.scienceConcepts.map((concept) => (
                      <Badge key={concept} variant="secondary" className="text-[10px] font-bold bg-white/15 text-white border-white/15">
                        {concept}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 mb-4 text-xs text-white/70 font-semibold">
                    <span>{form.phases} Phases</span>
                    <span>{form.difficulty} Difficulty</span>
                  </div>

                  <div className="flex items-center gap-2 mb-1 text-xs">
                    <Trophy className="w-4 h-4 text-yellow-300" />
                    <span className="font-bold text-yellow-200">{form.reward} + {form.mutationLevel === 0 ? 100 : form.mutationLevel === 1 ? 200 : 500} Coins</span>
                  </div>
                  {form.mutationLevel >= 2 && (
                    <div className="flex items-center gap-2 mb-4 text-xs">
                      <Gem className="w-4 h-4 text-cyan-300" />
                      <span className="font-bold text-cyan-200">Defeat {form.name} to earn 5 Gems + Omega Slayer Title!</span>
                    </div>
                  )}
                  {form.mutationLevel === 0 && boss.mutations.length >= 2 && (
                    <div className="flex items-center gap-2 mb-4 text-xs">
                      <Sparkles className="w-4 h-4 text-purple-300/70" />
                      <span className="font-semibold text-white/50">Defeat all mutations to unlock the Omega form for 5 Gems + rewards!</span>
                    </div>
                  )}
                  {form.mutationLevel === 1 && (
                    <div className="flex items-center gap-2 mb-4 text-xs">
                      <Sparkles className="w-4 h-4 text-purple-300/70" />
                      <span className="font-semibold text-white/50">One more mutation to reach the Omega form - 5 Gems await!</span>
                    </div>
                  )}
                  {form.mutationLevel < 2 && boss.mutations.length < 2 && <div className="mb-3" />}

                  {defeatCount > 0 && defeatCount <= maxMutations && (
                    <div className="flex items-center gap-1.5 mb-3 text-[10px] text-white/60 font-semibold">
                      <span>Mutation {Math.min(defeatCount, maxMutations)}/{maxMutations}</span>
                      <div className="flex gap-1">
                        {Array.from({ length: maxMutations }).map((_, mi) => (
                          <div key={mi} className={`w-2 h-2 rounded-full ${mi < defeatCount ? "bg-red-400" : "bg-white/20"}`} />
                        ))}
                      </div>
                    </div>
                  )}

                  {defeatCount > maxMutations ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-white/60 text-center uppercase tracking-wider">All stages conquered! Replay for fun:</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1 gap-1 font-bold bg-white/20 text-white border-white/20 text-xs"
                          onClick={() => startFight(boss, 0)}
                          data-testid={`button-replay-${boss.id}-0`}
                        >
                          Original
                        </Button>
                        {boss.mutations.map((mut, mi) => (
                          <Button
                            key={mi}
                            size="sm"
                            variant="secondary"
                            className="flex-1 gap-1 font-bold bg-white/20 text-white border-white/20 text-xs"
                            onClick={() => startFight(boss, mi + 1)}
                            data-testid={`button-replay-${boss.id}-${mi + 1}`}
                          >
                            Mut {mi + 1}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 w-full">
                      <Button
                        variant="secondary"
                        className="w-full gap-2 font-bold bg-white/20 text-white border-white/20"
                        onClick={() => startFight(boss)}
                        data-testid={`button-fight-${boss.id}`}
                      >
                        <Swords className="w-4 h-4" /> {defeatCount > 0 ? "Challenge Again" : "Challenge Boss"}
                      </Button>
                      <span className="text-xs text-yellow-300 font-bold flex items-center gap-1">
                        <Coins className="w-3 h-3" /> {10 + (Math.min(defeatCount, boss.mutations.length) * 5)} coins
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-12 mb-8">
        <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3">
          <Lock className="w-7 h-7 text-purple-500" /> Secret Bosses
        </h2>
        <p className="text-muted-foreground font-medium mt-1">
          Legendary hidden bosses unlocked by your achievements!
        </p>
      </div>

      <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {BOSS_BATTLES.filter(b => b.isSecret && !b.world).map((boss, i) => {
          const unlockCtx = { xp, bossesDefeated, badges, totalGamesPlayed };
          const meetsRebirthReq = !boss.requiredRebirth || rebirthLevel >= boss.requiredRebirth;
          const meetsXpReq = !boss.requiredXp || xp >= boss.requiredXp;
          const meetsBadgesReq = !boss.requiredBadges || badges.length >= boss.requiredBadges;
          const meetsGamesReq = !boss.requiredGames || totalGamesPlayed >= boss.requiredGames;
          const meetsBossesReq = !boss.requiredBosses || Object.keys(bossesDefeated).filter(k => (bossesDefeated[k] || 0) > 0).length >= boss.requiredBosses;
          const isUnlocked = meetsRebirthReq && meetsXpReq && meetsBadgesReq && meetsGamesReq && meetsBossesReq && (boss.unlockCheck ? boss.unlockCheck(unlockCtx) : true);
          const defeatCount = bossesDefeated[boss.id] || 0;
          const form = getBossForm(boss, defeatCount);
          const IconComp = ICON_MAP[form.icon] || Swords;
          const maxMutations = boss.mutations.length;

          return (
            <motion.div
              key={boss.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Card className={`border-0 relative group ${isUnlocked ? `bg-gradient-to-br ${form.gradient} text-white` : "bg-gradient-to-br from-gray-800 to-gray-900 text-white/50"}`} data-testid={`card-boss-${boss.id}`}>
                <div className={`absolute inset-0 rounded-md ${isUnlocked ? "bg-black/15" : "bg-black/40"}`} />
                <div className="relative p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-14 h-14 rounded-md flex items-center justify-center flex-shrink-0 ${isUnlocked ? "bg-white/20 group-hover:scale-105 transition-transform" : "bg-white/10"}`}>
                      {isUnlocked ? <IconComp className="w-7 h-7" /> : <Lock className="w-7 h-7 text-white/40" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                        {isUnlocked ? form.title : "??? SECRET BOSS ???"}
                      </p>
                      <h3 className="text-xl font-black">{isUnlocked ? form.name : "???"}</h3>
                    </div>
                  </div>

                  {!isUnlocked && (
                    <div className="mb-4 space-y-1.5">
                      <Badge variant="secondary" className="text-[10px] font-bold bg-purple-500/30 text-purple-300 border-purple-500/20 gap-1">
                        <Lock className="w-3 h-3" /> {boss.unlockRequirement || "Secret"}
                      </Badge>
                      <div className="flex flex-wrap gap-1">
                        {boss.requiredRebirth && !meetsRebirthReq && (
                          <Badge variant="secondary" className="text-[10px] font-bold bg-orange-500/30 text-orange-300 border-orange-500/20 gap-1">
                            Rebirth {rebirthLevel}/{boss.requiredRebirth}
                          </Badge>
                        )}
                        {boss.requiredXp && !meetsXpReq && (
                          <Badge variant="secondary" className="text-[10px] font-bold bg-orange-500/30 text-orange-300 border-orange-500/20 gap-1">
                            {xp.toLocaleString()}/{boss.requiredXp.toLocaleString()} XP
                          </Badge>
                        )}
                        {boss.requiredBadges && !meetsBadgesReq && (
                          <Badge variant="secondary" className="text-[10px] font-bold bg-orange-500/30 text-orange-300 border-orange-500/20 gap-1">
                            {badges.length}/{boss.requiredBadges} badges
                          </Badge>
                        )}
                        {boss.requiredGames && !meetsGamesReq && (
                          <Badge variant="secondary" className="text-[10px] font-bold bg-orange-500/30 text-orange-300 border-orange-500/20 gap-1">
                            {totalGamesPlayed}/{boss.requiredGames} games
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {isUnlocked && defeatCount > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="text-[10px] font-bold bg-white/20 text-white border-white/20 gap-1">
                        <Crown className="w-3 h-3" /> Defeated {defeatCount}x
                      </Badge>
                      {defeatCount <= maxMutations && (
                        <Badge variant="secondary" className="text-[10px] font-bold bg-red-500/30 text-white border-red-500/20 gap-1">
                          <Sparkles className="w-3 h-3" /> MUTATED!
                        </Badge>
                      )}
                    </div>
                  )}

                  <p className="text-sm text-white/85 mb-4 leading-relaxed">
                    {isUnlocked ? form.description : "This boss is locked. Complete the unlock requirement to reveal this legendary challenge!"}
                  </p>

                  {isUnlocked && (
                    <>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {boss.scienceConcepts.map((concept) => (
                          <Badge key={concept} variant="secondary" className="text-[10px] font-bold bg-white/15 text-white border-white/15">
                            {concept}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 mb-4 text-xs text-white/70 font-semibold">
                        <span>{form.phases} Phases</span>
                        <span>{form.difficulty} Difficulty</span>
                      </div>

                      <div className="flex items-center gap-2 mb-1 text-xs">
                        <Trophy className="w-4 h-4 text-yellow-300" />
                        <span className="font-bold text-yellow-200">{form.reward} + {form.mutationLevel === 0 ? 100 : form.mutationLevel === 1 ? 200 : 500} Coins</span>
                      </div>
                      {form.mutationLevel >= 2 && (
                        <div className="flex items-center gap-2 mb-4 text-xs">
                          <Gem className="w-4 h-4 text-cyan-300" />
                          <span className="font-bold text-cyan-200">Defeat {form.name} (Omega) to earn 5 Gems + Omega Slayer Title!</span>
                        </div>
                      )}
                      {form.mutationLevel < 2 && <div className="mb-3" />}

                      {defeatCount > 0 && defeatCount <= maxMutations && (
                        <div className="flex items-center gap-1.5 mb-3 text-[10px] text-white/60 font-semibold">
                          <span>Mutation {Math.min(defeatCount, maxMutations)}/{maxMutations}</span>
                          <div className="flex gap-1">
                            {Array.from({ length: maxMutations }).map((_, mi) => (
                              <div key={mi} className={`w-2 h-2 rounded-full ${mi < defeatCount ? "bg-red-400" : "bg-white/20"}`} />
                            ))}
                          </div>
                        </div>
                      )}

                      {defeatCount > maxMutations ? (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-white/60 text-center uppercase tracking-wider">All stages conquered! Replay for fun:</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 gap-1 font-bold bg-white/20 text-white border-white/20 text-xs"
                              onClick={() => startFight(boss, 0)}
                              data-testid={`button-replay-${boss.id}-0`}
                            >
                              Original
                            </Button>
                            {boss.mutations.map((mut, mi) => (
                              <Button
                                key={mi}
                                size="sm"
                                variant="secondary"
                                className="flex-1 gap-1 font-bold bg-white/20 text-white border-white/20 text-xs"
                                onClick={() => startFight(boss, mi + 1)}
                                data-testid={`button-replay-${boss.id}-${mi + 1}`}
                              >
                                Mut {mi + 1}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          className="w-full gap-2 font-bold bg-white/20 text-white border-white/20"
                          onClick={() => startFight(boss)}
                          data-testid={`button-fight-${boss.id}`}
                        >
                          <Swords className="w-4 h-4" /> {defeatCount > 0 ? "Challenge Again" : "Challenge Boss"}
                        </Button>
                      )}
                    </>
                  )}

                  {!isUnlocked && (
                    <Button
                      variant="secondary"
                      className="w-full gap-2 font-bold bg-white/10 text-white/40 border-white/10 cursor-not-allowed"
                      disabled
                      data-testid={`button-fight-${boss.id}-locked`}
                    >
                      <Lock className="w-4 h-4" /> Locked
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card className="p-6 mt-8 border-border bg-muted/50">
        <h2 className="font-bold mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" /> How Boss Battles Work
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Target className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-500" />
            <span>Each boss tests you on multiple science topics you've practiced in the arcade games.</span>
          </li>
          <li className="flex items-start gap-2">
            <Heart className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
            <span>Wrong answers deal damage to your HP. Lose all HP and you'll need to try again!</span>
          </li>
          <li className="flex items-start gap-2">
            <Star className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-500" />
            <span>Correct answers damage the boss. Drain all boss HP to win amazing rewards!</span>
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
            <span>Defeated bosses MUTATE into stronger forms with more phases and harder challenges! Each boss has 2 mutation levels.</span>
          </li>
          <li className="flex items-start gap-2">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
            <span>Each form awards its own unique badge. Defeat all bosses to earn the Boss Slayer badge!</span>
          </li>
          <li className="flex items-start gap-2">
            <Coins className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-500" />
            <span>Boss challenges cost coins to enter (10 + 5 per mutation level). If you lose, the coins are gone! Win to earn big rewards.</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
