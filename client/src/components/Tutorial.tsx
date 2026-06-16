import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Gamepad2, Map, Swords, FlaskConical, ShoppingBag,
  Rocket, ArrowLeft, ArrowRight, X, Sparkles, Trophy,
  Users, Star, Zap, ShoppingCart, FlaskRound, Newspaper,
  Gift, UserCircle, Target, Sword, Crown, Repeat2,
  MessageSquare, Coins
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TutorialProps {
  onComplete: () => void;
}

interface TutorialStep {
  title: string;
  description: string;
  icon: any;
  gradient: string;
  bullets: { icon: any; text: string }[];
}

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to Neuronix!",
    description: "Get ready for an epic science adventure. You'll play games, battle bosses, collect rewards, and grow from a rookie scientist into a Neuronix legend!",
    icon: Sparkles,
    gradient: "from-purple-600 to-blue-600",
    bullets: [
      { icon: Zap, text: "Earn XP to level up and unlock exclusive content" },
      { icon: Coins, text: "Collect Neuros and Sparks to spend in the shop" },
      { icon: Star, text: "Earn badges by completing challenges and milestones" },
    ],
  },
  {
    title: "The Arcade",
    description: "The heart of Neuronix — 49+ science games spanning Physics, Chemistry, Biology, Astronomy, and more!",
    icon: Gamepad2,
    gradient: "from-blue-500 to-cyan-500",
    bullets: [
      { icon: Target, text: "Filter games by subject, difficulty, or year level" },
      { icon: Trophy, text: "Score high to earn XP, Neuros, and badges" },
      { icon: Star, text: "Some games unlock special shop items when mastered" },
    ],
  },
  {
    title: "Daily Challenges",
    description: "A fresh challenge every single day! Complete it to earn bonus XP and build your daily streak.",
    icon: Target,
    gradient: "from-orange-500 to-amber-500",
    bullets: [
      { icon: Zap, text: "New challenge resets every 24 hours" },
      { icon: Star, text: "Longer streaks = bigger streak bonus rewards" },
      { icon: ShoppingBag, text: "Use a Streak Shield potion to protect your streak" },
    ],
  },
  {
    title: "Explore Worlds",
    description: "10 themed worlds, each with their own exclusive games, boss, and rare shop items you can't get anywhere else!",
    icon: Map,
    gradient: "from-cyan-500 to-emerald-500",
    bullets: [
      { icon: Map, text: "Worlds unlock as you progress and spend Neuros/Sparks" },
      { icon: Swords, text: "Each world has a unique final boss to defeat" },
      { icon: ShoppingBag, text: "Exclusive themes, avatars, and decos per world" },
    ],
  },
  {
    title: "Boss Battles",
    description: "Challenge 20+ science bosses in epic question-and-answer battles. Answer correctly to deal damage and earn massive rewards!",
    icon: Swords,
    gradient: "from-red-500 to-orange-500",
    bullets: [
      { icon: Zap, text: "Each boss drops XP, Neuros, and sometimes Sparks" },
      { icon: Star, text: "Defeating all bosses in a world unlocks special prizes" },
      { icon: Trophy, text: "Use boss battle powerups to gain an edge in fights" },
    ],
  },
  {
    title: "The Lab",
    description: "Run real interactive science experiments with live simulations — electricity, gravity, chemistry, and more!",
    icon: FlaskConical,
    gradient: "from-emerald-500 to-teal-500",
    bullets: [
      { icon: FlaskConical, text: "6 experiments: circuit builder, gravity lab, and more" },
      { icon: Zap, text: "Each experiment rewards XP on completion" },
      { icon: Star, text: "Lab XP counts toward your level and badge progress" },
    ],
  },
  {
    title: "PvP Lobby",
    description: "Challenge other real players to live head-to-head science quiz battles!",
    icon: Sword,
    gradient: "from-violet-500 to-purple-600",
    bullets: [
      { icon: Users, text: "Find opponents from across the globe in real time" },
      { icon: Trophy, text: "Win to earn Neuros and climb the PvP ranking" },
      { icon: Zap, text: "Use powerup items mid-match to turn the tide" },
    ],
  },
  {
    title: "Clans & Clan Battles",
    description: "Create or join a clan, team up with friends, and compete in weekly Clan Battle events!",
    icon: Users,
    gradient: "from-pink-500 to-rose-500",
    bullets: [
      { icon: Users, text: "Clans earn shared XP — the more you play, the better" },
      { icon: Trophy, text: "Top clan each week earns the Clan Champion theme" },
      { icon: Sword, text: "Clan Battles pit two clans against each other directly" },
    ],
  },
  {
    title: "Teams & District Battles",
    description: "Join a team (Science, Tech, Art, Sport) and battle in district-wide competitions!",
    icon: Crown,
    gradient: "from-amber-500 to-orange-500",
    bullets: [
      { icon: Crown, text: "The #1 team earns an exclusive Team Champion theme" },
      { icon: Trophy, text: "District Battles score is based on your whole team's XP" },
      { icon: Star, text: "Switch teams anytime from your Profile settings" },
    ],
  },
  {
    title: "Tournaments & Grand Tournament",
    description: "Compete in timed tournaments and the ultimate Grand Tournament for huge prizes!",
    icon: Trophy,
    gradient: "from-yellow-500 to-amber-500",
    bullets: [
      { icon: Trophy, text: "Regular tournaments run for 24–72 hours" },
      { icon: Crown, text: "Grand Tournament: answer 20 questions to set your score" },
      { icon: Star, text: "Top finishers earn exclusive titles and the Victory Theme" },
    ],
  },
  {
    title: "Shop, Potions & Mystery Boxes",
    description: "Spend your Neuros and Sparks on avatars, themes, decorations, potions, and mystery boxes!",
    icon: ShoppingCart,
    gradient: "from-fuchsia-500 to-pink-500",
    bullets: [
      { icon: ShoppingBag, text: "Themes, avatars, and decos customise your profile" },
      { icon: FlaskRound, text: "Potions give you XP or Neuro boosts for a limited time" },
      { icon: Gift, text: "Mystery Boxes (Bronze/Silver/Gold) drop random rare items" },
    ],
  },
  {
    title: "Badges, Rebirth & Leaderboard",
    description: "Collect badges, hit max level and Rebirth to prestige, and race up the global leaderboard!",
    icon: Star,
    gradient: "from-teal-500 to-cyan-600",
    bullets: [
      { icon: Star, text: "100+ badges for playing games, beating bosses, and more" },
      { icon: Repeat2, text: "Rebirth resets your level for a prestige star and bonuses" },
      { icon: Trophy, text: "Leaderboard ranks individual players, clans, and teams" },
    ],
  },
  {
    title: "Trade, News & Community",
    description: "Trade shop items with other players, read the latest news, and vote on community-made question packs!",
    icon: Newspaper,
    gradient: "from-blue-500 to-indigo-600",
    bullets: [
      { icon: Repeat2, text: "Trade lets you swap inventory items with friends" },
      { icon: Newspaper, text: "News posts keep you updated on events and updates" },
      { icon: MessageSquare, text: "Community packs are player-made quizzes you can rate" },
    ],
  },
  {
    title: "Codes, Invites & Profile",
    description: "Redeem gift codes for free rewards, invite friends for bonus Neuros, and build your profile!",
    icon: Gift,
    gradient: "from-green-500 to-emerald-600",
    bullets: [
      { icon: Gift, text: "Redeem codes for Neuros, Sparks, potions, items, and more" },
      { icon: Users, text: "Your unique invite link earns you 100 Neuros per friend" },
      { icon: UserCircle, text: "Your profile shows stats, badges, inventory and scores" },
    ],
  },
  {
    title: "You're Ready!",
    description: "That's everything Neuronix has to offer. Jump in, explore, and have an amazing time. The more you play, the more you unlock!",
    icon: Rocket,
    gradient: "from-purple-500 to-pink-500",
    bullets: [
      { icon: Zap, text: "Start with the Arcade or a Daily Challenge" },
      { icon: Users, text: "Join a clan for team rewards and battles" },
      { icon: Star, text: "Check the Leaderboard to see how you rank globally" },
    ],
  },
];

export default function Tutorial({ onComplete }: TutorialProps) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const current = STEPS[step];
  const StepIcon = current.icon;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const go = (delta: number) => {
    setDir(delta);
    setStep(s => s + delta);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="tutorial-overlay">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <Card className="border-0 overflow-hidden shadow-2xl">
          <div className={`bg-gradient-to-br ${current.gradient} p-7 text-white relative`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onComplete}
              className="absolute top-3 right-3 text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
              data-testid="button-skip-tutorial"
            >
              <X className="w-4 h-4" />
            </Button>

            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                initial={{ opacity: 0, x: dir > 0 ? 40 : -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir > 0 ? -40 : 40 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.05 }}
                  className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm"
                >
                  <StepIcon className="w-7 h-7" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-black mb-1 leading-tight" data-testid="text-tutorial-title">{current.title}</h2>
                  <p className="text-white/85 text-sm leading-relaxed">{current.description}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="px-6 pt-4 pb-2 bg-card">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.ul
                key={step}
                custom={dir}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.05 }}
                className="space-y-2 mb-4"
              >
                {current.bullets.map((b, i) => {
                  const BIcon = b.icon;
                  return (
                    <li key={i} className="flex items-center gap-2.5 text-sm">
                      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <BIcon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-foreground/80">{b.text}</span>
                    </li>
                  );
                })}
              </motion.ul>
            </AnimatePresence>

            <div className="flex items-center justify-center gap-1 mb-4">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDir(i > step ? 1 : -1); setStep(i); }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted"
                  }`}
                  data-testid={`dot-tutorial-${i}`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pb-2">
              <Button
                variant="ghost"
                onClick={() => go(-1)}
                disabled={isFirst}
                className="gap-1.5 font-semibold"
                data-testid="button-tutorial-prev"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onComplete}
                className="text-muted-foreground text-xs"
                data-testid="button-tutorial-skip"
              >
                Skip Tutorial
              </Button>

              {isLast ? (
                <Button
                  onClick={onComplete}
                  className="gap-1.5 font-bold"
                  data-testid="button-tutorial-finish"
                >
                  <Rocket className="w-4 h-4" /> Let's Go!
                </Button>
              ) : (
                <Button
                  onClick={() => go(1)}
                  className="gap-1.5 font-semibold"
                  data-testid="button-tutorial-next"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
