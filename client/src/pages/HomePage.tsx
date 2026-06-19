import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Gamepad2, Rocket, Star, Zap, Trophy, ArrowRight, Sparkles,
  FlaskConical, Swords, Clock, Flame, Target, Loader2, CheckCircle,
  Map, Waves, Snowflake, TreePine, Orbit, CloudLightning, Cpu, Skull, Atom, Diamond,
  Lock, Megaphone, ChevronLeft, ChevronRight,
  type LucideIcon
} from "lucide-react";
import { GAME_MODES, BADGES, WORLDS, BOSS_BATTLES } from "@/lib/gameData";
import { StoryBanner } from "@/components/StoryBanner";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { DailyChallenge } from "@shared/schema";

interface SiteMessage { id: number; content: string; createdBy: string; }

function MessageBanner() {
  const { data: messages = [] } = useQuery<SiteMessage[]>({
    queryKey: ["/api/messages"],
    refetchInterval: 60000,
  });
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = setInterval(() => {
      setDir(1);
      setIdx(i => (i + 1) % messages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [messages.length]);

  if (messages.length === 0) return null;

  const go = (delta: number) => {
    setDir(delta);
    setIdx(i => (i + delta + messages.length) % messages.length);
  };

  return (
    <div className="border-b border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/10 px-4 py-2.5 overflow-hidden">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <Megaphone className="w-4 h-4 text-purple-500 shrink-0" />
        <div className="flex-1 overflow-hidden relative h-5">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.p
              key={idx}
              custom={dir}
              initial={{ opacity: 0, y: dir > 0 ? 16 : -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: dir > 0 ? -16 : 16 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 text-sm font-semibold text-purple-700 dark:text-purple-300 truncate"
              data-testid="text-site-message"
            >
              {messages[idx].content}
            </motion.p>
          </AnimatePresence>
        </div>
        {messages.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => go(-1)} className="p-0.5 rounded hover:bg-purple-500/20 transition-colors" data-testid="button-message-prev">
              <ChevronLeft className="w-3.5 h-3.5 text-purple-500" />
            </button>
            <span className="text-xs text-muted-foreground">{idx + 1}/{messages.length}</span>
            <button onClick={() => go(1)} className="p-0.5 rounded hover:bg-purple-500/20 transition-colors" data-testid="button-message-next">
              <ChevronRight className="w-3.5 h-3.5 text-purple-500" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface HomePageProps {
  xp: number;
  level: number;
  streak: number;
  badges: string[];
  totalGamesPlayed: number;
}

const WORLD_ICONS: Record<string, LucideIcon> = {
  Waves, Flame, Snowflake, TreePine, Orbit,
  CloudLightning, Cpu, Skull, Atom, Diamond,
};

export default function HomePage({ xp, level, streak, badges, totalGamesPlayed }: HomePageProps) {
  const { user } = useAuth();
  const featuredGame = GAME_MODES.filter(g => !g.world)[Math.floor(Date.now() / 86400000) % 10] || GAME_MODES[0];

  const { data: dailyChallenge, isLoading: challengeLoading } = useQuery<DailyChallenge & { completed?: boolean }>({
    queryKey: ["/api/daily-challenge"],
  });

  const specialChallenges: Record<string, { name: string; link: string }> = {
    "boss-challenge": { name: "Boss Practice", link: "/bosses" },
    "lab-experiment": { name: "Lab Day", link: "/lab" },
    "community-play": { name: "Community Explorer", link: "/community" },
  };

  const isSpecialChallenge = dailyChallenge && specialChallenges[dailyChallenge.gameId];
  const dailyChallengeGame = dailyChallenge
    ? GAME_MODES.find((g) => g.id === dailyChallenge.gameId) || GAME_MODES[0]
    : GAME_MODES[(Math.floor(Date.now() / 86400000) + 3) % 10];
  const challengeLink = isSpecialChallenge
    ? specialChallenges[dailyChallenge!.gameId].link
    : `/arcade?game=${dailyChallengeGame.id}&autoplay=1&challenge=${encodeURIComponent(dailyChallenge?.title || '')}&target=${dailyChallenge?.targetScore || 100}&xp=${dailyChallenge?.xpReward || 50}`;

  return (
    <div className="min-h-screen">
      <MessageBanner />
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <StoryBanner />
      </div>
      <section className="relative py-16 md:py-24 px-4 overflow-visible">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-blue-600/10 to-emerald-600/10 dark:from-purple-600/30 dark:via-blue-600/20 dark:to-emerald-600/10" />
        <div className="absolute inset-0 overflow-visible">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-purple-400/30 dark:bg-purple-400/40"
              style={{
                left: `${(i * 17 + 5) % 100}%`,
                top: `${(i * 23 + 10) % 100}%`,
              }}
              animate={{
                y: [-10, 10, -10],
                opacity: [0.3, 0.7, 0.3],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 3 + (i % 3),
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="mb-4 text-sm font-bold px-4 py-1.5">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Ages 9-13
            </Badge>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight mb-4">
              <span className="bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 bg-clip-text text-transparent">
                Neuronix
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 font-medium">
              Where science feels like an arcade game! Explore 10 worlds, play 49+ game modes,
              battle 20+ bosses, run 16 experiments, and earn 130+ badges.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/arcade">
                <Button size="lg" className="text-base font-bold gap-2 px-8" data-testid="button-play-now">
                  <Gamepad2 className="w-5 h-5" />
                  Play Now
                </Button>
              </Link>
              <Link href="/lab">
                <Button size="lg" variant="outline" className="text-base font-bold gap-2 px-8" data-testid="button-explore-lab">
                  <FlaskConical className="w-5 h-5" />
                  Explore Lab
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-12 max-w-3xl mx-auto"
          >
            {[
              { icon: Map, label: "Worlds", value: String(WORLDS.length), color: "text-cyan-500 dark:text-cyan-400" },
              { icon: Gamepad2, label: "Game Modes", value: `${GAME_MODES.filter(g => !g.isSecret).length}+`, color: "text-purple-500 dark:text-purple-400" },
              { icon: Swords, label: "Boss Battles", value: `${BOSS_BATTLES.length}+`, color: "text-red-500 dark:text-red-400" },
              { icon: Trophy, label: "Badges", value: `${BADGES.length}+`, color: "text-yellow-500 dark:text-yellow-400" },
            ].map((stat) => (
              <Card key={stat.label} className="p-4 text-center border-border">
                <stat.icon className={`w-7 h-7 mx-auto mb-1.5 ${stat.color}`} />
                <p className="text-2xl font-black">{stat.value}</p>
                <p className="text-xs text-muted-foreground font-semibold">{stat.label}</p>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className={`p-6 border-border bg-gradient-to-br ${featuredGame.gradient} text-white relative group`}>
              <div className="absolute inset-0 bg-black/10 rounded-md" />
              <div className="relative">
                <Badge variant="secondary" className="mb-3 text-xs font-bold bg-white/20 text-white border-white/20">
                  <Star className="w-3 h-3 mr-1" />
                  Featured Game
                </Badge>
                <h2 className="text-2xl font-black mb-2">{featuredGame.name}</h2>
                <p className="text-sm text-white/85 mb-4 leading-relaxed">
                  {featuredGame.description}
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/20 text-xs font-semibold">
                    {featuredGame.category}
                  </Badge>
                </div>
                <Link href={`/arcade?game=${featuredGame.id}&autoplay=1`}>
                  <Button variant="secondary" className="gap-2 font-bold bg-white/20 text-white border-white/20" data-testid="button-play-featured">
                    Play Now <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="p-6 border-border border-2 border-dashed border-yellow-500/30 dark:border-yellow-500/40 bg-yellow-500/5 dark:bg-yellow-500/5">
              {challengeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-md bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Daily Challenge</p>
                      <h3 className="font-bold text-lg">{dailyChallenge?.title || (isSpecialChallenge ? specialChallenges[dailyChallenge!.gameId].name : dailyChallengeGame.name)}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {dailyChallenge?.description || `Score ${dailyChallenge?.targetScore || 500}+ points to earn bonus XP!`}
                    {" "}Challenges reset every day.
                  </p>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 font-semibold text-yellow-600 dark:text-yellow-400">
                        <Zap className="w-4 h-4" /> +{dailyChallenge?.xpReward || 50} XP
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-400">
                        <Clock className="w-4 h-4" /> Resets at midnight
                      </span>
                    </div>
                  </div>
                  <Link href={challengeLink}>
                    {dailyChallenge?.completed ? (
                      <Button variant="secondary" className="gap-2 font-bold w-full" data-testid="button-daily-challenge-completed">
                        <CheckCircle className="w-4 h-4 text-green-500" /> Completed! Play Again
                      </Button>
                    ) : (
                      <Button className="gap-2 font-bold w-full" data-testid="button-daily-challenge">
                        Accept Challenge <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </Link>
                </>
              )}
            </Card>
          </motion.div>
        </div>
      </section>

      {totalGamesPlayed > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="p-6 border-border">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-purple-500" /> Your Progress
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Level</p>
                  <p className="text-3xl font-black text-purple-500 dark:text-purple-400">{level}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Total XP</p>
                  <p className="text-3xl font-black text-blue-500 dark:text-blue-400">{xp.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Badges</p>
                  <p className="text-3xl font-black text-yellow-500 dark:text-yellow-400">{badges.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase flex items-center gap-1">
                    <Flame className="w-3 h-3" /> Streak
                  </p>
                  <p className="text-3xl font-black text-orange-500 dark:text-orange-400">{streak} days</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-muted-foreground">XP to next level</p>
                  <p className="text-xs font-bold">{xp % (level * 100 + (level - 1) * 50)} / {level * 100 + (level - 1) * 50}</p>
                </div>
                <Progress value={(xp % (level * 100 + (level - 1) * 50)) / (level * 100 + (level - 1) * 50) * 100} className="h-3" />
              </div>
            </Card>
          </motion.div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
          <Gamepad2 className="w-6 h-6 text-purple-500" /> Quick Play
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {GAME_MODES.filter(g => !g.isSecret).slice(0, 5).map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}
            >
              <Link href={`/arcade?game=${game.id}&autoplay=1`}>
                <Card className={`p-4 border-border cursor-pointer hover-elevate group`} data-testid={`card-quickplay-${game.id}`}>
                  <div className={`w-12 h-12 rounded-md bg-gradient-to-br ${game.gradient} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                    <Gamepad2 className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-sm mb-0.5">{game.name}</h3>
                  <p className="text-[11px] text-muted-foreground font-medium">{game.category}</p>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-6">
          <Link href="/arcade">
            <Button variant="outline" className="gap-2 font-bold" data-testid="button-view-all-games">
              View All Games <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
          <Map className="w-6 h-6 text-cyan-500" /> Explore Worlds
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {WORLDS.slice(0, 5).map((world, i) => {
            const WorldIcon = WORLD_ICONS[world.icon] || Star;
            const userLevel = (user as any)?.level || 1;
            const isUnlocked = userLevel >= world.unlockLevel;
            return (
              <motion.div
                key={world.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
              >
                <Link href="/worlds">
                  <Card className={`p-4 border-border cursor-pointer hover-elevate group relative overflow-hidden`} data-testid={`card-world-${world.id}`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${world.gradient} opacity-20 group-hover:opacity-30 transition-opacity`} />
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-md bg-gradient-to-br ${world.gradient} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                        {isUnlocked ? (
                          <WorldIcon className="w-6 h-6 text-white" />
                        ) : (
                          <Lock className="w-5 h-5 text-white/60" />
                        )}
                      </div>
                      <h3 className="font-bold text-sm mb-0.5">{world.name}</h3>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {isUnlocked ? `${world.gameIds.length} Games${world.bossId ? " · 1 Boss" : ""}` : `Lv ${world.unlockLevel}`}
                      </p>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
        <div className="text-center mt-6">
          <Link href="/worlds">
            <Button variant="outline" className="gap-2 font-bold" data-testid="button-view-all-worlds">
              View All {WORLDS.length} Worlds <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8 pb-16">
        <Card className="p-8 border-border bg-gradient-to-br from-purple-600/10 via-blue-600/5 to-emerald-600/10 dark:from-purple-600/20 dark:via-blue-600/10 dark:to-emerald-600/10 text-center">
          <Sparkles className="w-10 h-10 text-purple-500 mx-auto mb-3" />
          <h2 className="text-2xl font-black mb-2">Ready to become a Science Legend?</h2>
          <p className="text-muted-foreground font-medium max-w-lg mx-auto mb-6">
            Explore {WORLDS.length} worlds, blast through {GAME_MODES.filter(g => !g.isSecret).length}+ game modes, defeat {BOSS_BATTLES.length}+ epic bosses,
            run crazy experiments, and collect {BADGES.length}+ badges. Your science adventure starts NOW!
          </p>
          <Link href="/worlds">
            <Button size="lg" className="text-base font-bold gap-2 px-10" data-testid="button-start-adventure">
              <Rocket className="w-5 h-5" />
              Start Your Adventure
            </Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}
