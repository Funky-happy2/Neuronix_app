import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Lock, Waves, Flame, Snowflake, TreePine, Orbit,
  Gamepad2, Swords, ShoppingBag, CheckCircle, Trophy,
  Star, ArrowLeft, ArrowRight, Coins, Gem, Sparkles,
  Heart, Shield, Target, Play, Timer, XCircle,
  CloudLightning, Cpu, Skull, Atom, Diamond, Map,
  Bot, Wand2, Bird, Crown, Palette, Zap, Compass,
  Rocket, Circle, Dna, Rainbow, GraduationCap, Brain,
  Magnet, Globe, Eye, FlaskConical, Moon, Award, Medal,
  Check, Undo2, Loader2, User, MousePointer,
  type LucideIcon
} from "lucide-react";
import { WORLDS, GAME_MODES, BOSS_BATTLES, LAB_EXPERIMENTS } from "@/lib/gameData";
import { BOSS_QUESTIONS_BY_YEAR, type BossQ } from "@/lib/bossQuestions";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import GamePlayer from "@/components/GamePlayer";
import type { WorldInfo, BossBattle, BossMutation, GameMode, LabExperiment } from "@shared/schema";
import { ExperimentSimulator } from "@/pages/LabPage";

const WORLD_ICONS: Record<string, LucideIcon> = {
  Waves, Flame, Snowflake, TreePine, Orbit,
  CloudLightning, Cpu, Skull, Atom, Diamond,
};

const SHOP_ICON_MAP: Record<string, LucideIcon> = {
  Bot, Sparkles, Swords, Wand2, Flame, Bird, Diamond, Star, Crown,
  TreePine, Palette, Zap, Shield, Coins, Trophy, Compass, Atom,
  Rocket, Circle, Dna, Rainbow, Timer, GraduationCap, Brain,
  Magnet, Snowflake, Orbit, Globe, Eye, FlaskConical, Waves, Award, Medal, Skull, Moon,
  CloudLightning, Cpu, ShoppingBag,
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  theme: Palette,
  avatar: User,
  decoration: Sparkles,
  follower: MousePointer,
  frame: Award,
  coin_style: Coins,
  gem_style: Gem,
  badge_style: Star,
  title: Crown,
};

function getWorldIcon(iconName: string): LucideIcon {
  return WORLD_ICONS[iconName] || Star;
}

function getBossQuestions(bossId: string, yearLevel: number, mutationLevel: number = 0): BossQ[] {
  const bossQs = BOSS_QUESTIONS_BY_YEAR[bossId];
  if (!bossQs) return [];

  let effectiveYear = yearLevel;
  if (mutationLevel === 1) effectiveYear = Math.min(yearLevel + 2, 8);
  else if (mutationLevel >= 2) effectiveYear = 8;

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
    return combined.sort(() => Math.random() - 0.5).map(q => {
      const correctAnswer = q.options[q.correct];
      const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
      return { ...q, options: shuffledOptions, correct: shuffledOptions.indexOf(correctAnswer) };
    });
  }

  return [...baseQuestions].sort(() => Math.random() - 0.5).map(q => {
    const correctAnswer = q.options[q.correct];
    const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
    return { ...q, options: shuffledOptions, correct: shuffledOptions.indexOf(correctAnswer) };
  });
}

type BossSkill = {
  id: string;
  name: string;
  description: string;
  icon: typeof Shield;
  color: string;
  bgColor: string;
};

const WORLD_BOSS_SKILLS: Record<string, BossSkill> = {
  shieldBurst: { id: "shieldBurst", name: "Shield Burst", description: "Boss blocks 80% of your next attack!", icon: Shield, color: "text-cyan-400", bgColor: "bg-cyan-500/20 border-cyan-500/40" },
  mindWarp: { id: "mindWarp", name: "Mind Warp", description: "Answers will shuffle in 3 seconds!", icon: Orbit, color: "text-purple-400", bgColor: "bg-purple-500/20 border-purple-500/40" },
  powerDrain: { id: "powerDrain", name: "Power Drain", description: "Boss steals 10 HP from you!", icon: Zap, color: "text-red-400", bgColor: "bg-red-500/20 border-red-500/40" },
  doubleStrike: { id: "doubleStrike", name: "Double Strike", description: "Wrong answers deal 2x damage!", icon: Swords, color: "text-orange-400", bgColor: "bg-orange-500/20 border-orange-500/40" },
};

function getWorldBossAvailableSkills(mutationLevel: number): string[] {
  if (mutationLevel >= 2) return ["shieldBurst", "mindWarp", "powerDrain", "doubleStrike"];
  if (mutationLevel === 1) return ["shieldBurst", "mindWarp", "powerDrain"];
  return ["shieldBurst", "powerDrain"];
}

function shouldWorldBossActivateSkill(questionIndex: number, _mutationLevel: number): boolean {
  if (questionIndex === 0) return false;
  return questionIndex % 2 === 1 || Math.random() > 0.4;
}

function pickWorldBossRandomSkill(mutationLevel: number): BossSkill | null {
  const skills = getWorldBossAvailableSkills(mutationLevel);
  if (skills.length === 0) return null;
  return WORLD_BOSS_SKILLS[skills[Math.floor(Math.random() * skills.length)]];
}

function getBossForm(boss: BossBattle, defeatCount: number) {
  if (defeatCount === 0 || boss.mutations.length === 0) {
    return { name: boss.name, title: boss.title, description: boss.description, icon: boss.icon, gradient: boss.gradient, phases: boss.phases, difficulty: boss.difficulty, reward: boss.reward, badgeId: boss.badgeId, mutationLevel: 0 };
  }
  if (defeatCount > boss.mutations.length) {
    const lastMut = boss.mutations[boss.mutations.length - 1];
    return { name: boss.name, title: "Conquered!", description: `You mastered ${boss.name}!`, icon: lastMut.icon, gradient: lastMut.gradient, phases: lastMut.phases, difficulty: "Mastered", reward: lastMut.reward, badgeId: lastMut.badgeId, mutationLevel: boss.mutations.length };
  }
  const mut = boss.mutations[defeatCount - 1];
  return { name: mut.name, title: mut.title, description: mut.description, icon: mut.icon, gradient: mut.gradient, phases: mut.phases, difficulty: mut.difficulty, reward: mut.reward, badgeId: mut.badgeId, mutationLevel: defeatCount };
}

const WBP_ICON_MAP: Record<string, typeof Shield> = {
  "bp-shield-potion": Shield,
  "bp-time-freeze": Timer,
  "bp-double-damage": Swords,
  "bp-heal-potion": Heart,
  "bp-mirror-shield": Sparkles,
  "bp-quick-draw": Zap,
  "bp-poison-strike": Skull,
};

const WBP_COLORS: Record<string, { text: string; bg: string }> = {
  "bp-shield-potion": { text: "text-cyan-400", bg: "bg-cyan-500/20 border-cyan-500/40" },
  "bp-time-freeze": { text: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/40" },
  "bp-double-damage": { text: "text-red-400", bg: "bg-red-500/20 border-red-500/40" },
  "bp-heal-potion": { text: "text-pink-400", bg: "bg-pink-500/20 border-pink-500/40" },
  "bp-mirror-shield": { text: "text-purple-400", bg: "bg-purple-500/20 border-purple-500/40" },
  "bp-quick-draw": { text: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/40" },
  "bp-poison-strike": { text: "text-green-400", bg: "bg-green-500/20 border-green-500/40" },
};

function WorldBossFight({ boss, bossForm, onComplete, onBack, yearLevel = 7, hasLuckyAnswer = false, hasBossInsight = false, hasScienceScanner = false }: {
  boss: BossBattle;
  bossForm: ReturnType<typeof getBossForm>;
  onComplete: (won: boolean) => void;
  onBack: () => void;
  yearLevel?: number;
  hasLuckyAnswer?: boolean;
  hasBossInsight?: boolean;
  hasScienceScanner?: boolean;
}) {
  const { toast } = useToast();
  const questionsRef = useRef<BossQ[] | null>(null);
  if (!questionsRef.current) {
    const allQuestions = getBossQuestions(boss.id, yearLevel, bossForm.mutationLevel);
    const questionCount = Math.min(allQuestions.length, bossForm.phases + 3);
    questionsRef.current = allQuestions.length > 0 ? allQuestions.slice(0, questionCount) : [
      { question: "What is the building block of all matter?", options: ["Atoms", "Stars", "Light", "Sound"], correct: 0, explanation: "Atoms are the basic building blocks of all matter!" },
      { question: "What force keeps us on the ground?", options: ["Wind", "Gravity", "Magnetism", "Friction"], correct: 1, explanation: "Gravity pulls everything toward the center of the Earth!" },
      { question: "What is H2O?", options: ["Oxygen", "Hydrogen", "Water", "Carbon"], correct: 2, explanation: "H2O is the chemical formula for water!" },
      { question: "What gives plants their green color?", options: ["Sunlight", "Water", "Chlorophyll", "Soil"], correct: 2, explanation: "Chlorophyll absorbs light for photosynthesis and reflects green!" },
      { question: "How many planets are in our solar system?", options: ["7", "8", "9", "10"], correct: 1, explanation: "There are 8 planets in our solar system!" },
      { question: "What is the hardest natural substance?", options: ["Gold", "Iron", "Diamond", "Quartz"], correct: 2, explanation: "Diamond is the hardest naturally occurring substance!" },
    ];
  }
  const questions = questionsRef.current;

  const [bossHP, setBossHP] = useState(100);
  const [playerHP, setPlayerHP] = useState(100);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [insightUsed, setInsightUsed] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [activeSkill, setActiveSkill] = useState<BossSkill | null>(null);
  const [skillAnimating, setSkillAnimating] = useState(false);
  const [mindWarpShuffled, setMindWarpShuffled] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<string[] | null>(null);
  const [displayCorrect, setDisplayCorrect] = useState<number | null>(null);

  const { data: wbpData } = useQuery<{ powerups: any[]; owned: Record<string, number> }>({
    queryKey: ["/api/battle-powerups"],
  });
  const [localWbpCounts, setLocalWbpCounts] = useState<Record<string, number> | null>(null);
  const wbpCounts = localWbpCounts ?? wbpData?.owned ?? {};
  const hasWbpPowerups = Object.values(wbpCounts).some(c => c > 0);
  const [activePowerup, setActivePowerup] = useState<string | null>(null);
  const [powerupUsedThisQ, setPowerupUsedThisQ] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [timerFrozen, setTimerFrozen] = useState(false);
  const [doubleDamageActive, setDoubleDamageActive] = useState(false);
  const [quickDrawActive, setQuickDrawActive] = useState(false);
  const [quickDrawTime, setQuickDrawTime] = useState<number | null>(null);
  const [poisonTurns, setPoisonTurns] = useState(0);

  const useWbpPowerup = useCallback(async (powerupId: string) => {
    if (powerupUsedThisQ || selected !== null || gameOver) return;
    const count = wbpCounts[powerupId] || 0;
    if (count <= 0) return;

    setLocalWbpCounts(prev => {
      const next = { ...(prev ?? wbpCounts) };
      next[powerupId] = (next[powerupId] || 0) - 1;
      if (next[powerupId] <= 0) delete next[powerupId];
      return next;
    });
    setPowerupUsedThisQ(true);
    setActivePowerup(powerupId);

    apiRequest("POST", "/api/battle-powerup/use", { powerupId }).catch(() => {});

    if (powerupId === "bp-shield-potion") {
      setShieldActive(true);
      toast({ title: "Shield Potion Active!", description: "Your next wrong answer won't deal damage." });
    } else if (powerupId === "bp-time-freeze") {
      setTimerFrozen(true);
      toast({ title: "Time Freeze!", description: "Timer is paused for this question." });
    } else if (powerupId === "bp-double-damage") {
      setDoubleDamageActive(true);
      toast({ title: "Double Damage!", description: "Your next correct answer deals 2x damage!" });
    } else if (powerupId === "bp-heal-potion") {
      setPlayerHP(prev => Math.min(100, prev + 25));
      toast({ title: "Heal Potion!", description: "Restored 25 HP!" });
    } else if (powerupId === "bp-mirror-shield") {
      if (activeSkill) {
        setActiveSkill(null);
        setBossHP(prev => Math.max(0, prev - 10));
        toast({ title: "Mirror Shield!", description: "Boss skill cancelled and boss took 10 damage!" });
      } else {
        setBossHP(prev => Math.max(0, prev - 10));
        toast({ title: "Mirror Shield!", description: "No boss skill active, but boss took 10 damage!" });
      }
    } else if (powerupId === "bp-quick-draw") {
      setQuickDrawActive(true);
      setQuickDrawTime(Date.now());
      toast({ title: "Quick Draw!", description: "Answer within 3 seconds for +50% damage!" });
    } else if (powerupId === "bp-poison-strike") {
      setPoisonTurns(3);
      toast({ title: "Poison Strike!", description: "Boss takes 5 damage for the next 3 questions!" });
    }
  }, [powerupUsedThisQ, selected, gameOver, wbpCounts, activeSkill, wbpData, toast]);

  const timerMax = bossForm.mutationLevel === 0 ? 0 : bossForm.mutationLevel === 1 ? 20 : 12;
  const [timer, setTimer] = useState(timerMax);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const gameOverRef = useRef(gameOver);
  gameOverRef.current = gameOver;

  useEffect(() => {
    if (hasLuckyAnswer && selected === null && currentQ < questions.length) {
      const currentQuestion = questions[currentQ];
      const wrongIndices = currentQuestion.options.map((_, i) => i).filter(i => i !== currentQuestion.correct);
      const randomWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
      setEliminatedOptions([randomWrong]);
    }
  }, [currentQ, hasLuckyAnswer]);

  useEffect(() => {
    if (gameOver || selected !== null) return;
    const skill = shouldWorldBossActivateSkill(currentQ, bossForm.mutationLevel) ? pickWorldBossRandomSkill(bossForm.mutationLevel) : null;
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

  const timerFrozenRef = useRef(timerFrozen);
  timerFrozenRef.current = timerFrozen;

  useEffect(() => {
    if (timerMax <= 0 || selected !== null || gameOver) return;
    setTimer(timerMax);
    const interval = setInterval(() => {
      if (selectedRef.current !== null || gameOverRef.current) { clearInterval(interval); return; }
      if (timerFrozenRef.current) return;
      setTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQ, timerMax, selected, gameOver]);

  const timerFiredRef = useRef(false);
  useEffect(() => { timerFiredRef.current = false; }, [currentQ]);
  useEffect(() => {
    if (timerMax > 0 && timer === 0 && selected === null && !gameOver && !timerFiredRef.current) {
      timerFiredRef.current = true;
      const q = questions[currentQ];
      const wrongIndices = q.options.map((_, i) => i).filter(i => i !== q.correct);
      handleAnswer(wrongIndices[Math.floor(Math.random() * wrongIndices.length)]);
    }
  }, [timer]);

  const wrongDamage = bossForm.mutationLevel === 0 ? 25 : bossForm.mutationLevel === 1 ? 35 : 50;
  const bossHealOnWrong = bossForm.mutationLevel >= 2 ? 8 : bossForm.mutationLevel === 1 ? 4 : 0;

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    const q = questions[currentQ];
    const effectiveCorrect = (displayCorrect !== null && mindWarpShuffled) ? displayCorrect : q.correct;
    setSelected(idx);
    setShowExplanation(true);

    const isCorrect = idx === effectiveCorrect;
    let damage = 100 / questions.length + 5;
    if (isCorrect && activeSkill?.id === "shieldBurst") {
      damage = damage * 0.2;
    }
    if (isCorrect && doubleDamageActive) {
      damage = damage * 2;
    }
    if (isCorrect && quickDrawActive && quickDrawTime) {
      const elapsed = (Date.now() - quickDrawTime) / 1000;
      if (elapsed <= 3) {
        damage = damage * 1.5;
      }
    }
    let actualWrongDamage = wrongDamage;
    if (!isCorrect && activeSkill?.id === "doubleStrike") {
      actualWrongDamage = wrongDamage * 2;
    }
    if (!isCorrect && shieldActive) {
      actualWrongDamage = 0;
    }
    let poisonDmg = 0;
    if (poisonTurns > 0) {
      poisonDmg = 5;
      setPoisonTurns(prev => prev - 1);
    }
    const nextBossHP = isCorrect ? Math.max(0, bossHP - damage - poisonDmg) : Math.max(0, Math.min(100, bossHP + bossHealOnWrong) - poisonDmg);
    const nextPlayerHP = isCorrect ? playerHP : Math.max(0, playerHP - actualWrongDamage);
    setBossHP(nextBossHP);
    setPlayerHP(nextPlayerHP);

    setTimeout(() => {
      setSelected(null);
      setShowExplanation(false);
      setInsightUsed(false);
      setEliminatedOptions([]);
      setActiveSkill(null);
      setDisplayOptions(null);
      setDisplayCorrect(null);
      setMindWarpShuffled(false);
      setActivePowerup(null);
      setPowerupUsedThisQ(false);
      setShieldActive(false);
      setTimerFrozen(false);
      setDoubleDamageActive(false);
      setQuickDrawActive(false);
      setQuickDrawTime(null);
      if (nextBossHP <= 0) { setWon(true); setGameOver(true); }
      else if (nextPlayerHP <= 0) { setWon(false); setGameOver(true); }
      else if (currentQ + 1 >= questions.length) { setWon(nextPlayerHP > nextBossHP); setGameOver(true); }
      else { setCurrentQ(q => q + 1); }
    }, 2000);
  };

  if (gameOver) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <Card className="p-8 text-center bg-gray-900/90 border-gray-700">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
              {won ? <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" /> : <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />}
            </motion.div>
            <h1 className="text-3xl font-black mb-2 text-white" data-testid="text-world-boss-result">
              {won ? "BOSS DEFEATED!" : "Try Again!"}
            </h1>
            <p className="text-gray-300 font-medium mb-4">
              {won ? `You defeated ${bossForm.name}!` : `${bossForm.name} was too powerful. Keep learning!`}
            </p>
            {won && (
              <div className="flex flex-wrap gap-2 justify-center mb-3">
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 font-bold">
                  +{bossForm.mutationLevel === 0 ? 500 : bossForm.mutationLevel === 1 ? 750 : 1500} XP
                </Badge>
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 font-bold">
                  +{bossForm.mutationLevel === 0 ? 100 : bossForm.mutationLevel === 1 ? 200 : 500} Neuros
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold">
                  {bossForm.badgeId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())} Badge
                </Badge>
                {bossForm.mutationLevel >= 2 && (
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 font-bold">
                    +5 Sparks
                  </Badge>
                )}
              </div>
            )}
            {won && bossForm.mutationLevel < boss.mutations.length && (
              <p className="text-sm font-bold text-orange-400 mb-4 animate-pulse">
                The boss is mutating... A stronger form awaits!
              </p>
            )}
            {won && bossForm.mutationLevel >= boss.mutations.length && bossForm.mutationLevel > 0 && (
              <div className="mb-4">
                <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 mb-1">
                  ULTIMATE VICTORY!
                </p>
                <p className="text-sm font-bold text-emerald-400">
                  You conquered every form of {boss.name}! True science master!
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              {!won && (
                <Button variant="outline" onClick={onBack} className="gap-2 font-bold border-gray-600 text-gray-300" data-testid="button-back-world">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              )}
              <Button onClick={() => onComplete(won)} className="gap-2 font-bold" data-testid="button-collect-world-boss-reward">
                <Sparkles className="w-4 h-4" /> {won ? "Collect Reward" : "Continue"}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const effectiveQ = (() => {
    const base = questions[currentQ];
    if (displayOptions && mindWarpShuffled && displayCorrect !== null) {
      return { ...base, options: displayOptions, correct: displayCorrect };
    }
    return base;
  })();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 font-semibold mb-4 text-white/70 hover:text-white" data-testid="button-retreat-world-boss">
        <ArrowLeft className="w-4 h-4" /> Retreat
      </Button>

      <div className="text-center mb-4">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${bossForm.gradient} mb-2 shadow-lg`}>
          <Swords className="w-7 h-7 text-white drop-shadow-md" />
        </div>
        <h2 className="text-2xl font-black text-white">{bossForm.name}</h2>
        {bossForm.mutationLevel > 0 && (
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mt-1">{bossForm.title}</p>
        )}
        <div className="flex items-center justify-center gap-2 mt-1">
          <Badge className={`text-[10px] ${
            bossForm.mutationLevel === 0 ? "bg-green-500/20 text-green-300 border-green-500/30" :
            bossForm.mutationLevel === 1 ? "bg-orange-500/20 text-orange-300 border-orange-500/30" :
            "bg-red-500/20 text-red-300 border-red-500/30"
          }`}>
            {bossForm.difficulty}
          </Badge>
          {bossForm.mutationLevel > 0 && (
            <Badge className="text-[10px] bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
              Mutation {bossForm.mutationLevel}
            </Badge>
          )}
          {bossForm.mutationLevel > 0 && (
            <Badge className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/30">
              {bossForm.mutationLevel === 1 ? "Timed" : "Fast Timer"} · {wrongDamage} dmg
            </Badge>
          )}
        </div>
      </div>

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
            <Card className={`p-4 border-2 ${activeSkill.bgColor}`} data-testid="card-world-boss-skill-alert">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: 1 }}
                >
                  <activeSkill.icon className={`w-6 h-6 ${activeSkill.color}`} />
                </motion.div>
                <div>
                  <p className={`text-sm font-black ${activeSkill.color}`}>{activeSkill.name}!</p>
                  <p className="text-xs text-gray-400 font-semibold">{activeSkill.description}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {activeSkill && !skillAnimating && selected === null && (
        <div className="mb-3 flex items-center gap-2" data-testid="indicator-active-world-boss-skill">
          <Badge className={`text-xs font-bold gap-1.5 ${activeSkill.bgColor} ${activeSkill.color} border`}>
            <activeSkill.icon className="w-3 h-3" /> {activeSkill.name} Active
          </Badge>
        </div>
      )}

      {timerMax > 0 && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <Timer className={`w-4 h-4 ${timer <= 5 ? "text-red-400" : "text-orange-400"}`} />
          <div className="w-32 bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${timer <= 5 ? "bg-red-500 animate-pulse" : timer <= 10 ? "bg-orange-500" : "bg-green-500"}`}
              style={{ width: `${(timer / timerMax) * 100}%` }}
            />
          </div>
          <span className={`font-bold text-sm ${timer <= 5 ? "text-red-400 animate-pulse" : "text-orange-400"}`}>{timer}s</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-4 bg-blue-900/40 border-blue-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-white">You</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-3 rounded-full transition-all duration-500" style={{ width: `${playerHP}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{Math.round(playerHP)}%</p>
        </Card>
        <Card className={`p-4 border ${bossForm.mutationLevel === 0 ? "bg-red-900/40 border-red-700/50" : bossForm.mutationLevel === 1 ? "bg-orange-900/40 border-orange-600/50" : "bg-purple-900/40 border-purple-600/50"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Swords className={`w-4 h-4 ${bossForm.mutationLevel >= 2 ? "text-purple-400" : "text-red-400"}`} />
            <span className="text-sm font-bold text-white">{bossForm.mutationLevel > 0 ? bossForm.name : "Boss"}</span>
            {bossHealOnWrong > 0 && (
              <span className="text-[10px] text-yellow-400 ml-auto">Heals +{bossHealOnWrong}%</span>
            )}
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all duration-500 bg-gradient-to-r ${bossForm.mutationLevel === 0 ? "from-red-500 to-orange-400" : bossForm.mutationLevel === 1 ? "from-orange-500 to-yellow-400" : "from-purple-500 to-pink-400"}`} style={{ width: `${bossHP}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{Math.round(bossHP)}%</p>
        </Card>
      </div>

      {hasWbpPowerups && (
        <div className="mb-4" data-testid="powerup-toolbar-world">
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(wbpCounts).filter(([_, c]) => c > 0).map(([id, count]) => {
              const BpIcon = WBP_ICON_MAP[id] || Shield;
              const colors = WBP_COLORS[id] || { text: "text-gray-400", bg: "bg-gray-500/20 border-gray-500/40" };
              const isActive = activePowerup === id;
              const bpInfo = wbpData?.powerups?.find((p: any) => p.id === id);
              return (
                <Button
                  key={id}
                  size="sm"
                  variant="outline"
                  disabled={powerupUsedThisQ || selected !== null || gameOver}
                  className={`gap-1.5 font-bold text-xs border ${colors.bg} ${colors.text} ${isActive ? "ring-2 ring-white/50" : ""}`}
                  onClick={() => useWbpPowerup(id)}
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
                <Badge className={`text-xs font-bold gap-1.5 ${WBP_COLORS[activePowerup]?.bg || ""} ${WBP_COLORS[activePowerup]?.text || ""} border`}>
                  {(() => { const I = WBP_ICON_MAP[activePowerup]; return I ? <I className="w-3 h-3" /> : null; })()}
                  {wbpData?.powerups?.find((p: any) => p.id === activePowerup)?.name || activePowerup} Active
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <Card className={`p-6 mb-4 ${bossForm.mutationLevel === 0 ? "bg-gray-900/80 border-gray-700" : bossForm.mutationLevel === 1 ? "bg-gray-900/80 border-orange-700/30" : "bg-gray-900/80 border-purple-700/30"}`}>
        <p className="text-xs text-gray-400 mb-2 font-semibold">Question {currentQ + 1} of {questions.length}</p>
        <h3 className="text-lg font-bold text-white mb-4">{effectiveQ.question}</h3>
        <div className="grid grid-cols-1 gap-2">
          {effectiveQ.options.map((opt, idx) => {
            const isEliminated = eliminatedOptions.includes(idx);
            const eCorrect = (displayCorrect !== null && mindWarpShuffled) ? displayCorrect : effectiveQ.correct;
            if (isEliminated && selected === null) return (
              <button key={idx} className="w-full text-left p-3 rounded-lg border font-medium bg-gray-800/30 border-gray-800 text-gray-600 line-through opacity-50 cursor-not-allowed" disabled data-testid={`world-boss-option-${idx}`}>
                {opt}
              </button>
            );
            let btnClass = "w-full text-left p-3 rounded-lg border font-medium transition-all ";
            if (selected !== null) {
              if (idx === eCorrect) btnClass += "bg-green-500/20 border-green-500 text-green-300";
              else if (idx === selected) btnClass += "bg-red-500/20 border-red-500 text-red-300";
              else btnClass += "bg-gray-800/50 border-gray-700 text-gray-500";
            } else {
              btnClass += "bg-gray-800/50 border-gray-600 text-white hover:border-blue-500 hover:bg-blue-500/10 cursor-pointer";
            }
            return (
              <button key={idx} className={btnClass} onClick={() => handleAnswer(idx)} disabled={selected !== null || isEliminated} data-testid={`world-boss-option-${idx}`}>
                {opt}
              </button>
            );
          })}
        </div>
        {showExplanation && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
            <p className="text-sm text-blue-300">{effectiveQ.explanation}</p>
          </motion.div>
        )}
      </Card>
    </div>
  );
}

export default function WorldsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeWorld, setActiveWorld] = useState<string | null>(null);
  const [playingGame, setPlayingGame] = useState<GameMode | null>(null);
  const [activeLabExperiment, setActiveLabExperiment] = useState<LabExperiment | null>(null);
  const [fightingBoss, setFightingBoss] = useState<BossBattle | null>(null);
  const [fightingForm, setFightingForm] = useState<ReturnType<typeof getBossForm> | null>(null);
  const [worldChallengeFee, setWorldChallengeFee] = useState(0);
  const [unlockedWorlds, setUnlockedWorlds] = useState<string[]>(() => {
    const saved = localStorage.getItem("unlocked-worlds");
    return saved ? JSON.parse(saved) : [];
  });

  const userLevel = (user as any)?.level || 1;
  const userXp = (user as any)?.xp || 0;
  const userCoins = (user as any)?.coins || 0;
  const userGems = (user as any)?.gems || 0;
  const bossesDefeated: Record<string, number> = (user as any)?.bossesDefeated || {};
  const totalBossesDefeated = Object.keys(bossesDefeated).length;
  const userBadges: string[] = (user as any)?.badges || [];
  const gameScores: Record<string, any> = (user as any)?.gameScores || {};
  const yearLevel = (user as any)?.yearLevel || 7;
  const inventory: string[] = (user as any)?.inventory || [];

  const { data: shopItems = [] } = useQuery<any[]>({
    queryKey: ["/api/shop"],
  });

  const userAvatarId = (user as any)?.avatarId || "";
  const equippedCosmetics: Record<string, string> = (user as any)?.equippedCosmetics || {};
  const EQUIPPABLE_CATEGORIES = ["follower", "decoration", "badge_style", "theme", "title", "frame", "coin_style", "gem_style"];

  const buyItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("POST", "/api/shop/buy", { itemId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      toast({ title: "Purchased!", description: "Item added to your collection." });
    },
    onError: (err: any) => {
      toast({ title: "Can't buy", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const equipAvatarMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      const res = await apiRequest("PATCH", "/api/user/progress", { avatarId });
      return res.json();
    },
    onSuccess: (data: any) => {
      const userData = data?.user || data;
      if (userData?.id) {
        queryClient.setQueryData(["/api/user"], userData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Equipped!", description: "Your new avatar is now active." });
    },
  });

  const equipCosmeticMutation = useMutation({
    mutationFn: async ({ itemId, category }: { itemId: string; category: string }) => {
      const res = await apiRequest("POST", "/api/shop/equip-cosmetic", { itemId, category });
      return res.json();
    },
    onSuccess: (data: any, variables) => {
      const userData = data?.user || data;
      if (userData?.id) {
        queryClient.setQueryData(["/api/user"], userData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const updatedCosmetics = userData?.equippedCosmetics || {};
      const nowEquipped = updatedCosmetics[variables.category] === variables.itemId;
      toast({ title: nowEquipped ? "Equipped!" : "Unequipped!", description: nowEquipped ? "Your cosmetic is now active." : "Item has been unequipped." });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("POST", "/api/shop/refund", { itemId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      toast({ title: "Refunded!", description: `You got ${data.refundAmount} Neuros back (70% refund).` });
    },
    onError: (err: any) => {
      toast({ title: "Can't refund", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  function meetsRequirements(world: WorldInfo): boolean {
    if (userLevel < world.unlockLevel) return false;
    if (userXp < world.unlockXp) return false;
    if (totalBossesDefeated < world.unlockBosses) return false;
    if (world.requiredWorldId) {
      const reqWorld = WORLDS.find(w => w.id === world.requiredWorldId);
      if (reqWorld && !bossesDefeated[reqWorld.bossId]) return false;
    }
    return true;
  }

  function isWorldUnlocked(world: WorldInfo): boolean {
    if (unlockedWorlds.includes(world.id)) return true;
    if (!meetsRequirements(world)) return false;
    if (world.gemCost || world.coinCost) return false;
    return true;
  }

  function canAffordWorld(world: WorldInfo): boolean {
    if (world.coinCost && userCoins < world.coinCost) return false;
    if (world.gemCost && userGems < world.gemCost) return false;
    return true;
  }

  async function purchaseWorld(world: WorldInfo) {
    if (!meetsRequirements(world)) return;
    if (!canAffordWorld(world)) {
      toast({ title: "Not Enough Resources", description: "You need more Neuros or Sparks to unlock this world!", variant: "destructive" });
      return;
    }

    try {
      await apiRequest("POST", "/api/worlds/unlock", { worldId: world.id });
      const newUnlocked = [...unlockedWorlds, world.id];
      setUnlockedWorlds(newUnlocked);
      localStorage.setItem("unlocked-worlds", JSON.stringify(newUnlocked));
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: `${world.name} Unlocked!`, description: `Welcome to ${world.name}! Explore games and defeat the boss!` });
    } catch (e: any) {
      toast({ title: "Unlock Failed", description: e.message || "Something went wrong", variant: "destructive" });
    }
  }

  function getWorldProgress(world: WorldInfo) {
    const gamesCompleted = world.gameIds.filter(gid => {
      const score = gameScores[gid];
      return score !== undefined && score !== null && score > 0;
    }).length;
    const bossDefeated = !!bossesDefeated[world.bossId];
    const badgesEarned = world.badgeIds.filter(b => userBadges.includes(b)).length;
    const worldLabs = LAB_EXPERIMENTS.filter(e => e.worldId === world.id);
    const completedExps = ((user?.gameScores as Record<string, any>)?._experiments || []) as string[];
    const labsCompleted = worldLabs.filter(l => completedExps.includes(l.id)).length;
    const totalSteps = world.gameIds.length + worldLabs.length + 1;
    const completedSteps = gamesCompleted + labsCompleted + (bossDefeated ? 1 : 0);
    return { gamesCompleted, totalGames: world.gameIds.length, labsCompleted, totalLabs: worldLabs.length, bossDefeated, badgesEarned, totalBadges: world.badgeIds.length, completedSteps, totalSteps, percent: Math.round((completedSteps / totalSteps) * 100) };
  }

  const currentWorld = activeWorld ? WORLDS.find(w => w.id === activeWorld) : null;
  const currentWorldIcon = currentWorld ? getWorldIcon(currentWorld.icon) : Star;

  if (playingGame && currentWorld) {
    return (
      <div className={`min-h-screen bg-gradient-to-b ${currentWorld.gradient}`}>
        <GamePlayer
          game={playingGame}
          yearLevel={yearLevel}
          onBack={() => setPlayingGame(null)}
          onComplete={() => {
            setPlayingGame(null);
          }}
        />
      </div>
    );
  }

  if (activeLabExperiment && currentWorld) {
    return (
      <div className={`min-h-screen bg-gradient-to-b ${currentWorld.gradient}`}>
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => setActiveLabExperiment(null)} className="gap-2 font-bold text-white/80 hover:text-white hover:bg-white/10 mb-4" data-testid="button-back-from-lab">
            <ArrowLeft className="w-4 h-4" /> Back to {currentWorld.name}
          </Button>
          <ExperimentSimulator
            experiment={activeLabExperiment}
            onComplete={async () => {
              try {
                const gemUpgradesDisabled = localStorage.getItem("cosmetic-gem-upgrades") === "false";
                const res = await apiRequest("POST", "/api/experiment/complete", { experimentId: activeLabExperiment.id, gemUpgradesDisabled });
                const data = await res.json();
                queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                let desc = `You earned ${data.rewards.xp} XP and ${data.rewards.coins} Neuros!`;
                if (data.rewards.badgesEarned?.length > 0) {
                  desc += ` New badge: ${data.rewards.badgesEarned.join(", ")}!`;
                }
                toast({ title: "Experiment Complete!", description: desc });
                apiRequest("POST", "/api/daily-challenge/complete", { challengeType: "lab-experiment" }).catch(() => {});
              } catch {
                toast({ title: "Experiment Complete!", description: "Results recorded." });
              }
              setActiveLabExperiment(null);
            }}
          />
        </div>
      </div>
    );
  }

  const gemUpgradesEnabled = localStorage.getItem("cosmetic-gem-upgrades") !== "false";
  const upgradeUses = (user as any)?.upgradeExpirations as Record<string, number> | undefined;
  const isUpActive = (id: string) => {
    if (!inventory.includes(id)) return false;
    return (upgradeUses?.[id] || 0) > 0;
  };
  const hasLuckyAnswer = inventory.includes("powerup-lucky-answer");
  const hasBossInsight = gemUpgradesEnabled && isUpActive("upgrade-boss-insight");
  const hasScienceScanner = inventory.includes("powerup-science-scanner");

  if (fightingBoss && fightingForm && currentWorld) {
    return (
      <div className={`min-h-screen bg-gradient-to-b ${currentWorld.gradient}`}>
        <WorldBossFight
          boss={fightingBoss}
          bossForm={fightingForm}
          yearLevel={yearLevel}
          hasLuckyAnswer={hasLuckyAnswer}
          hasBossInsight={hasBossInsight}
          hasScienceScanner={hasScienceScanner}
          onBack={() => { setFightingBoss(null); setFightingForm(null); }}
          onComplete={(won) => {
            if (won) {
              const gemUpgradesEnabled = localStorage.getItem("cosmetic-gem-upgrades") !== "false";
              apiRequest("POST", "/api/boss/defeat", { bossId: fightingBoss.id, mutationLevel: fightingForm.mutationLevel, gemUpgradesDisabled: !gemUpgradesEnabled })
                .then(async (r) => {
                  const data = await r.json();
                  const parts: string[] = [];
                  if (data.xpEarned > 0) parts.push(`${data.xpEarned} XP`);
                  if (data.coinsEarned > 0) parts.push(`${data.coinsEarned} Neuros`);
                  if (data.gemsEarned > 0) parts.push(`${data.gemsEarned} Sparks`);
                  if (data.itemsAwarded?.length > 0) parts.push(`${data.itemsAwarded.length} reward item${data.itemsAwarded.length > 1 ? "s" : ""}`);
                  if (data.badgesAwarded?.length > 0) parts.push(`${data.badgesAwarded.length} badge${data.badgesAwarded.length > 1 ? "s" : ""}`);
                  if (parts.length > 0) {
                    toast({ title: "Boss Rewards!", description: `You earned ${parts.join(", ")}!` });
                  }
                  queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                })
                .catch(() => {});
            } else if (worldChallengeFee > 0) {
              toast({ title: "Defeated!", description: `You lost ${worldChallengeFee} Neuros! Train harder and try again.`, variant: "destructive" });
              queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            }
            setFightingBoss(null);
            setFightingForm(null);
            setWorldChallengeFee(0);
          }}
        />
      </div>
    );
  }

  if (currentWorld) {
    const WorldIcon = getWorldIcon(currentWorld.icon);
    const progress = getWorldProgress(currentWorld);
    const worldGames = GAME_MODES.filter(g => currentWorld.gameIds.includes(g.id));
    const worldBoss = BOSS_BATTLES.find(b => b.id === currentWorld.bossId);
    const worldIndex = WORLDS.indexOf(currentWorld);
    const defeatCount = worldBoss ? (bossesDefeated[worldBoss.id] || 0) : 0;

    return (
      <div className={`min-h-screen bg-gradient-to-b ${currentWorld.gradient}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-white/10"
              style={{ left: `${(i * 13 + 7) % 100}%`, top: `${(i * 19 + 5) % 100}%` }}
              animate={{ y: [-20, 20, -20], opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 4 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => setActiveWorld(null)} className="gap-2 font-bold text-white/80 hover:text-white hover:bg-white/10 mb-6" data-testid="button-back-to-map">
            <ArrowLeft className="w-4 h-4" /> Back to World Map
          </Button>

          <div className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <WorldIcon className="w-11 h-11 text-white" />
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2" data-testid="text-world-name">{currentWorld.name}</h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">{currentWorld.description}</p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <Badge variant="outline" className="border-white/30 text-white">World {worldIndex + 1}</Badge>
              <Badge variant="outline" className="border-white/30 text-white">{progress.percent}% Complete</Badge>
            </div>
          </div>

          <Card className="p-4 bg-black/30 border-white/10 mb-8 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm font-semibold">World Progress</span>
              <span className="text-white font-bold text-sm">{progress.completedSteps}/{progress.totalSteps}</span>
            </div>
            <div className="w-full bg-black/30 rounded-full h-3">
              <motion.div
                className="bg-white/80 h-3 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress.percent}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </Card>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <Gamepad2 className="w-6 h-6" /> Games
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {worldGames.map(game => {
                const played = gameScores[game.id] !== undefined && gameScores[game.id] !== null && gameScores[game.id] > 0;
                const highScore = gameScores[game.id] || 0;
                return (
                  <motion.div key={game.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card
                      className="p-5 bg-black/30 border-white/10 hover:border-white/30 transition-all cursor-pointer backdrop-blur-sm group"
                      onClick={() => setPlayingGame(game)}
                      data-testid={`world-play-game-${game.id}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${game.gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <Gamepad2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white">{game.name}</p>
                          <p className="text-white/50 text-xs">{game.category}</p>
                        </div>
                        {played && <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
                      </div>
                      <p className="text-white/60 text-sm mb-3">{game.description}</p>
                      <div className="flex items-center justify-between gap-2">
                        {played ? (
                          <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">High Score: {highScore}</Badge>
                        ) : (
                          <Badge className="bg-white/10 text-white/60 border-white/20 text-xs">Not played</Badge>
                        )}
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 font-bold border-white/30 text-white hover:bg-white/20 text-xs px-2"
                            onClick={(e) => { e.stopPropagation(); navigate(`/lobby?game=${game.id}`); }}
                            data-testid={`button-vs-friend-${game.id}`}
                          >
                            <Swords className="w-3 h-3" /> vs Friend
                          </Button>
                          <Button size="sm" className="gap-1 font-bold" data-testid={`button-play-${game.id}`}>
                            <Play className="w-3 h-3" /> Play
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {(() => {
            const worldLabs = LAB_EXPERIMENTS.filter(e => e.worldId === currentWorld.id);
            const completedExperiments = ((user?.gameScores as Record<string, any>)?._experiments || []) as string[];
            if (worldLabs.length === 0) return null;
            return (
              <div className="mb-8">
                <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                  <FlaskConical className="w-6 h-6" /> Lab Experiments
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {worldLabs.map(lab => {
                    const completed = completedExperiments.includes(lab.id);
                    return (
                      <motion.div key={lab.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Card
                          className="p-5 bg-black/30 border-white/10 hover:border-white/30 transition-all cursor-pointer backdrop-blur-sm group"
                          onClick={() => setActiveLabExperiment(lab)}
                          data-testid={`world-lab-${lab.id}`}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <FlaskConical className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white">{lab.name}</p>
                              <p className="text-white/50 text-xs">{lab.category}</p>
                            </div>
                            {completed && <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
                          </div>
                          <p className="text-white/60 text-sm mb-3">{lab.description}</p>
                          <div className="flex items-center justify-between">
                            {completed ? (
                              <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">Completed</Badge>
                            ) : (
                              <Badge className="bg-white/10 text-white/60 border-white/20 text-xs">Not started</Badge>
                            )}
                            <Button size="sm" className="gap-1 font-bold" data-testid={`button-lab-${lab.id}`}>
                              <FlaskConical className="w-3 h-3" /> Experiment
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {worldBoss && (() => {
            const currentForm = getBossForm(worldBoss, defeatCount);
            const mutLevel = currentForm.mutationLevel;
            const isMaxed = defeatCount > worldBoss.mutations.length;
            const mutLabel = mutLevel === 0 ? "" : `Mutation ${mutLevel}`;
            const diffColors: Record<string, string> = {
              Easy: "bg-green-500/20 text-green-300 border-green-500/30",
              Medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
              Hard: "bg-orange-500/20 text-orange-300 border-orange-500/30",
              Extreme: "bg-red-500/20 text-red-300 border-red-500/30",
              Mastered: "bg-purple-500/20 text-purple-300 border-purple-500/30",
            };
            return (
            <div className="mb-8">
              <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                <Swords className="w-6 h-6" /> World Boss
              </h2>
              <Card className="p-6 bg-black/30 border-white/10 backdrop-blur-sm" data-testid={`world-boss-card-${worldBoss.id}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${currentForm.gradient} flex items-center justify-center`}>
                    <Swords className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-white">{currentForm.name}</h3>
                    {mutLevel > 0 && (
                      <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider">{currentForm.title}</p>
                    )}
                    <p className="text-white/60 text-sm">{currentForm.description}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge className={`text-xs ${defeatCount > 0 ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
                        {defeatCount > 0 ? `Defeated x${defeatCount}` : "Undefeated"}
                      </Badge>
                      <Badge className={`text-xs ${diffColors[currentForm.difficulty] || diffColors.Medium}`}>
                        {currentForm.difficulty}
                      </Badge>
                      <Badge className="bg-white/10 text-white/60 border-white/20 text-xs">
                        {currentForm.phases} Phases
                      </Badge>
                      {mutLabel && (
                        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">
                          {mutLabel}
                        </Badge>
                      )}
                    </div>
                    {!isMaxed && (
                      <div className="mt-2 text-xs text-white/40 flex items-center gap-1.5">
                        <Shield className="w-3 h-3" />
                        {mutLevel === 0 ? "Boss uses skills during battle" : mutLevel === 1 ? "Timed questions · Boss heals on wrong answers · Boss skills" : "Faster timer · Boss heals more · Higher damage · Boss skills"}
                      </div>
                    )}
                    {isMaxed && (
                      <div className="mt-2 text-xs text-purple-300 flex items-center gap-1.5">
                        <Trophy className="w-3 h-3" /> You have fully conquered this boss!
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    className="gap-2 font-bold"
                    onClick={async () => {
                      const form = getBossForm(worldBoss, defeatCount);
                      try {
                        const r = await apiRequest("POST", "/api/boss/challenge", { bossId: worldBoss.id, mutationLevel: form.mutationLevel });
                        if (!r.ok) {
                          const err = await r.json();
                          toast({ title: "Error", description: err.message || "Failed to start challenge.", variant: "destructive" });
                          return;
                        }
                        const data = await r.json();
                        setWorldChallengeFee(data.fee || 0);
                        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                      } catch {
                        toast({ title: "Error", description: "Failed to start challenge.", variant: "destructive" });
                        return;
                      }
                      setFightingBoss(worldBoss);
                      setFightingForm(form);
                    }}
                    data-testid={`button-fight-world-boss-${worldBoss.id}`}
                  >
                    <Swords className="w-4 h-4" />
                    {defeatCount === 0 ? " Challenge Boss" : mutLevel > 0 && !isMaxed ? ` Fight ${mutLabel}` : " Fight Again"}
                  </Button>
                  <span className="text-xs text-yellow-300 font-bold flex items-center gap-1">
                    <Coins className="w-3 h-3" /> {10 + ((defeatCount > 0 ? Math.min(defeatCount, (worldBoss as any).mutations?.length || 0) : 0) * 5)} Neuros
                  </span>
                </div>
              </Card>
            </div>
            );
          })()}

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6" /> Exclusive Items
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {currentWorld.shopItemIds.map((itemId, idx) => {
                const owned = inventory.includes(itemId);
                const shopItem = shopItems.find((s: any) => s.id === itemId);
                const displayName = shopItem?.name || itemId.replace(/(theme-|avatar-|deco-)/g, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                const description = shopItem?.description || "";
                const price = shopItem?.price ?? 0;
                const rarity = shopItem?.rarity || "common";
                const category = shopItem?.category || (itemId.startsWith("theme-") ? "theme" : itemId.startsWith("avatar-") ? "avatar" : "decoration");
                const ItemIcon = SHOP_ICON_MAP[shopItem?.icon] || ShoppingBag;
                const CategoryIcon = CATEGORY_ICONS[category] || ShoppingBag;
                const categoryLabel: Record<string, string> = { theme: "UI Theme", avatar: "Avatar Skin", decoration: "Screen Effect", follower: "Mouse Trail", frame: "Profile Frame", coin_style: "Neuro Style", gem_style: "Spark Style", badge_style: "Badge Style", title: "Title" };
                const categoryDesc: Record<string, string> = {
                  theme: "Changes your app colors and accent tones",
                  avatar: "A unique profile avatar only from this world",
                  decoration: "Floating particles and effects on your screen",
                  follower: "Leaves a trail of particles behind your cursor",
                  frame: "A decorative border around your profile",
                  coin_style: "Changes how your coin counter looks",
                  gem_style: "Changes how your gem counter looks",
                  badge_style: "Changes how your badges are displayed",
                  title: "A title displayed on your profile",
                };
                const rarityGlow: Record<string, string> = {
                  common: "from-gray-400/30 to-gray-600/30",
                  uncommon: "from-green-400/30 to-emerald-600/30",
                  rare: "from-blue-400/30 to-indigo-600/30",
                  epic: "from-purple-400/30 to-violet-600/30",
                  legendary: "from-yellow-400/30 to-amber-600/30",
                };
                const rarityText: Record<string, string> = {
                  common: "text-gray-300", uncommon: "text-green-300",
                  rare: "text-blue-300", epic: "text-purple-300", legendary: "text-yellow-300",
                };
                const rarityBorder: Record<string, string> = {
                  common: "border-gray-500/20", uncommon: "border-green-500/20",
                  rare: "border-blue-500/20", epic: "border-purple-500/20", legendary: "border-yellow-500/30",
                };
                const canBuy = !owned && userCoins >= price && userLevel >= (shopItem?.requiredLevel || 0);
                const isEquippedAvatar = category === "avatar" && userAvatarId === itemId;
                const isEquippedCosmetic = EQUIPPABLE_CATEGORIES.includes(category) && equippedCosmetics[category] === itemId;
                const isEquipped = isEquippedAvatar || isEquippedCosmetic;

                return (
                  <motion.div
                    key={itemId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.08 }}
                  >
                    <Card className={`overflow-hidden border ${rarityBorder[rarity] || rarityBorder.common} bg-black/40 backdrop-blur-sm ${isEquipped ? "ring-2 ring-green-400/50" : ""}`} data-testid={`world-shop-item-${itemId}`}>
                      <div className={`h-28 bg-gradient-to-br ${rarityGlow[rarity] || rarityGlow.common} flex items-center justify-center relative`}>
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentWorld.gradient} flex items-center justify-center shadow-lg`}>
                          <ItemIcon className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                        <Badge className={`absolute top-2 right-2 text-[10px] font-bold ${rarityText[rarity]} bg-black/40 border-white/10`}>
                          {rarity.toUpperCase()}
                        </Badge>
                        <Badge className={`absolute bottom-2 left-2 text-[10px] font-bold bg-white/10 text-white/70 border-white/10 gap-1`}>
                          <CategoryIcon className="w-3 h-3" /> {categoryLabel[category] || category}
                        </Badge>
                        {isEquipped && (
                          <Badge className="absolute top-2 left-2 text-[10px] font-bold bg-green-500/80 text-white border-green-400/50 gap-0.5">
                            <Check className="w-3 h-3" /> Active
                          </Badge>
                        )}
                      </div>

                      <div className="p-4">
                        <p className="font-bold text-white text-sm mb-1">{displayName}</p>
                        {description && <p className="text-white/50 text-xs leading-relaxed line-clamp-2">{description}</p>}
                        <p className="text-white/30 text-[10px] mt-1.5 italic">{categoryDesc[category] || "Exclusive cosmetic item"}</p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          {owned ? (
                            <div className="flex items-center gap-1.5 flex-wrap flex-1">
                              {category === "avatar" ? (
                                isEquippedAvatar ? (
                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs gap-1">
                                    <Check className="w-3 h-3" /> Equipped
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="font-bold text-xs h-7"
                                    disabled={equipAvatarMutation.isPending}
                                    onClick={() => equipAvatarMutation.mutate(itemId)}
                                    data-testid={`button-equip-${itemId}`}
                                  >
                                    Equip
                                  </Button>
                                )
                              ) : EQUIPPABLE_CATEGORIES.includes(category) ? (
                                isEquippedCosmetic ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="font-bold text-xs h-7 bg-green-600/20 border-green-600/40 text-green-400"
                                    disabled={equipCosmeticMutation.isPending}
                                    onClick={() => equipCosmeticMutation.mutate({ itemId, category })}
                                    data-testid={`button-unequip-${itemId}`}
                                  >
                                    <Check className="w-3 h-3 mr-1" /> Equipped
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="font-bold text-xs h-7 border-white/20 text-white hover:bg-white/10"
                                    disabled={equipCosmeticMutation.isPending}
                                    onClick={() => equipCosmeticMutation.mutate({ itemId, category })}
                                    data-testid={`button-equip-${itemId}`}
                                  >
                                    Equip
                                  </Button>
                                )
                              ) : (
                                <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs gap-1">
                                  <Check className="w-3 h-3" /> Owned
                                </Badge>
                              )}
                              {!isEquipped && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="font-bold text-xs h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
                                  disabled={refundMutation.isPending}
                                  onClick={() => refundMutation.mutate(itemId)}
                                  data-testid={`button-refund-${itemId}`}
                                >
                                  <Undo2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1 text-yellow-400 text-sm font-bold">
                                <Coins className="w-4 h-4" /> {price.toLocaleString()}
                              </div>
                              <Button
                                size="sm"
                                className="gap-1 font-bold text-xs h-7"
                                disabled={!canBuy || buyItemMutation.isPending}
                                onClick={() => buyItemMutation.mutate(itemId)}
                                data-testid={`button-buy-${itemId}`}
                              >
                                {buyItemMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingBag className="w-3 h-3" />} Buy
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <Map className="w-12 h-12 text-purple-400 mx-auto mb-3" />
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2" data-testid="worlds-title">World Map</h1>
            <p className="text-gray-400 text-lg">Journey through 10 themed worlds of science!</p>
          </motion.div>
        </div>

        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500/30 via-purple-500/30 to-violet-500/30 transform -translate-x-1/2 hidden md:block" />

          <div className="space-y-6">
            {WORLDS.map((world, index) => {
              const unlocked = isWorldUnlocked(world);
              const meets = meetsRequirements(world);
              const affordable = canAffordWorld(world);
              const progress = getWorldProgress(world);
              const IconComponent = getWorldIcon(world.icon);
              const isEven = index % 2 === 0;

              return (
                <motion.div
                  key={world.id}
                  initial={{ opacity: 0, x: isEven ? -30 : 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.5 }}
                  className={`relative flex items-center gap-4 ${isEven ? "md:flex-row" : "md:flex-row-reverse"}`}
                >
                  <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 z-10">
                    <div className={`w-10 h-10 rounded-full border-4 flex items-center justify-center ${
                      unlocked ? "bg-white border-white text-gray-900" : meets ? "bg-gray-700 border-gray-500 text-gray-300" : "bg-gray-800 border-gray-700 text-gray-500"
                    }`}>
                      <span className="text-xs font-black">{index + 1}</span>
                    </div>
                  </div>

                  <div className={`flex-1 ${isEven ? "md:pr-12" : "md:pl-12"}`}>
                    <Card
                      className={`overflow-hidden border-2 transition-all duration-300 ${
                        unlocked
                          ? "border-white/20 hover:border-white/40 cursor-pointer hover:shadow-lg hover:shadow-white/5"
                          : meets && !unlocked
                          ? "border-yellow-500/30 hover:border-yellow-500/50 cursor-pointer"
                          : "border-gray-800 opacity-50"
                      }`}
                      onClick={() => {
                        if (unlocked) setActiveWorld(world.id);
                      }}
                      data-testid={`world-card-${world.id}`}
                    >
                      <div className={`relative p-5 bg-gradient-to-r ${world.gradient}`}>
                        {!unlocked && !meets && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                            <div className="text-center px-4">
                              <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-300 font-semibold text-sm">
                                Lv {world.unlockLevel} · {world.unlockXp.toLocaleString()} XP · {world.unlockBosses} Bosses
                              </p>
                              {world.requiredWorldId && (
                                <p className="text-gray-400 text-xs mt-1">
                                  Requires: {WORLDS.find(w => w.id === world.requiredWorldId)?.name} boss defeated
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {meets && !unlocked && (world.gemCost || world.coinCost) && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                            <div className="text-center px-4">
                              <Sparkles className="w-8 h-8 text-yellow-400 mx-auto mb-2 animate-pulse" />
                              <p className="text-white font-bold text-sm mb-3">Ready to Unlock!</p>
                              <div className="flex items-center justify-center gap-3 mb-3">
                                {world.coinCost && (
                                  <span className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
                                    <Coins className="w-4 h-4" /> {world.coinCost.toLocaleString()}
                                  </span>
                                )}
                                {world.gemCost && (
                                  <span className="flex items-center gap-1 text-cyan-400 font-bold text-sm">
                                    <Gem className="w-4 h-4" /> {world.gemCost}
                                  </span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                className="font-bold gap-2"
                                disabled={!affordable}
                                onClick={(e) => { e.stopPropagation(); purchaseWorld(world); }}
                                data-testid={`button-unlock-${world.id}`}
                              >
                                {affordable ? (
                                  <><Sparkles className="w-4 h-4" /> Unlock</>
                                ) : (
                                  <><Lock className="w-4 h-4" /> Can't Afford</>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                            <IconComponent className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h2 className="text-xl font-black text-white">{world.name}</h2>
                              <span className="md:hidden text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">#{index + 1}</span>
                            </div>
                            <p className="text-white/75 text-sm line-clamp-2">{world.description}</p>
                          </div>
                          {unlocked && (
                            <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                              <div className="flex items-center gap-2 text-white/80 text-xs font-semibold">
                                <Gamepad2 className="w-3.5 h-3.5" /> {progress.gamesCompleted}/{progress.totalGames}
                                {progress.totalLabs > 0 && <><FlaskConical className="w-3.5 h-3.5 ml-1" /> {progress.labsCompleted}/{progress.totalLabs}</>}
                                <Swords className="w-3.5 h-3.5 ml-1" /> {progress.bossDefeated ? "1/1" : "0/1"}
                              </div>
                              <ArrowRight className="w-4 h-4 text-white/60" />
                            </div>
                          )}
                        </div>

                        {unlocked && (
                          <div className="mt-3">
                            <div className="w-full bg-black/30 rounded-full h-2">
                              <div className="bg-white/80 h-2 rounded-full transition-all duration-500" style={{ width: `${progress.percent}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  <div className={`hidden md:block flex-1 ${isEven ? "md:pl-12" : "md:pr-12"}`} />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
