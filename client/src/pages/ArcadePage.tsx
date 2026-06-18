import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Gamepad2, Star, Lock, Trophy, ArrowLeft, Zap, Target,
  Rocket, Dna, FlaskConical, Clock, Atom, TreePine, Puzzle,
  CloudLightning, Shield, Orbit, Sparkles, Pickaxe, Play, Users, Coins, Medal
} from "lucide-react";
import { GAME_MODES } from "@/lib/gameData";
import type { GameMode } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import GamePlayer from "@/components/GamePlayer";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const ICON_MAP: Record<string, any> = {
  Rocket, Dna, Zap, FlaskConical, Clock, Atom, TreePine, Puzzle,
  CloudLightning, Shield, Orbit, Sparkles, Pickaxe
};

const CATEGORIES = ["All", "Physics", "Biology", "Chemistry", "Earth Science", "History", "Engineering"];

interface ArcadePageProps {
  badges: string[];
  onPlayGame: (gameId: string, score: number) => void;
  onAddXP: (amount: number) => void;
  onEarnBadge: (badgeId: string) => void;
  yearLevel: number;
  onSetYearLevel?: (yearLevel: number) => void;
}

export default function ArcadePage({ badges, onPlayGame, onAddXP, onEarnBadge, yearLevel, onSetYearLevel }: ArcadePageProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedGame, setSelectedGame] = useState<GameMode | null>(null);
  const [playingGame, setPlayingGame] = useState<GameMode | null>(null);
  const [challengeInfo, setChallengeInfo] = useState<{ title: string; target: number; xp: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get("game");
    const autoplay = params.get("autoplay");
    const challengeTitle = params.get("challenge");
    const target = params.get("target");
    const xp = params.get("xp");
    if (gameId) {
      const game = GAME_MODES.find((g) => g.id === gameId);
      if (game) {
        if (autoplay === "1") {
          setPlayingGame(game);
          if (challengeTitle) {
            setChallengeInfo({ title: challengeTitle, target: Number(target) || 100, xp: Number(xp) || 50 });
          }
        } else {
          setSelectedGame(game);
        }
      }
    }
  }, [location]);

  const rebirthLevel = user?.rebirthLevel || 0;

  const totalGamesPlayed = user?.totalGamesPlayed || 0;
  const bossesDefeated = Object.keys(user?.bossesDefeated || {}).filter(k => (user?.bossesDefeated?.[k] || 0) > 0).length;
  const userXp = user?.xp || 0;

  const isGameLocked = (game: GameMode) => {
    if (game.isSecret && game.requiredBadges && badges.length < game.requiredBadges) return true;
    if (game.requiredRebirth && rebirthLevel < game.requiredRebirth) return true;
    if (game.requiredXp && userXp < game.requiredXp) return true;
    if (game.requiredGames && totalGamesPlayed < game.requiredGames) return true;
    if (game.requiredBosses && bossesDefeated < game.requiredBosses) return true;
    return false;
  };

  const filteredGames = GAME_MODES.filter((game) => {
    if (game.world) return false;
    if (selectedCategory !== "All" && game.category !== selectedCategory) return false;
    if (isGameLocked(game)) return false;
    return true;
  }).sort((a, b) => {
    if (a.isSecret !== b.isSecret) return a.isSecret ? 1 : -1;
    return 0;
  });

  const lockedSecrets = GAME_MODES.filter((g) => !g.world && isGameLocked(g));

  const handleGameComplete = async () => {
    queryClient.invalidateQueries({ queryKey: ["/api/daily-challenge"] });
    setPlayingGame(null);
    setChallengeInfo(null);
  };

  if (playingGame) {
    return (
      <div>
        {challengeInfo && (
          <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border-b border-yellow-500/30 px-4 py-3">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-sm">{challengeInfo.title}</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-semibold">
                <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                  <Star className="w-4 h-4" /> Goal: {challengeInfo.target} pts
                </span>
                <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                  <Zap className="w-4 h-4" /> +{challengeInfo.xp} XP
                </span>
              </div>
            </div>
          </div>
        )}
        <GamePlayer
          game={playingGame}
          onBack={() => { setPlayingGame(null); setChallengeInfo(null); }}
          onComplete={() => handleGameComplete()}
          yearLevel={yearLevel}
          onSetYearLevel={onSetYearLevel}
          autoStart={!!challengeInfo}
          isChallenge={!!challengeInfo}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        {selectedGame ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Button
              variant="ghost"
              onClick={() => setSelectedGame(null)}
              className="gap-2 mb-4 font-semibold"
              data-testid="button-back-arcade"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Arcade
            </Button>

            <Card className={`p-8 bg-gradient-to-br ${selectedGame.gradient} text-white relative border-0`}>
              <div className="absolute inset-0 bg-black/10 rounded-md" />
              <div className="relative">
                <Badge variant="secondary" className="mb-3 bg-white/20 text-white border-white/20 text-xs font-bold">
                  {selectedGame.category}
                </Badge>
                <h1 className="text-3xl md:text-4xl font-black mb-3">{selectedGame.name}</h1>
                <p className="text-lg text-white/90 mb-6 max-w-2xl">{selectedGame.description}</p>
                <div className="flex gap-3 flex-wrap">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2 font-bold bg-white text-gray-900"
                    onClick={() => setPlayingGame(selectedGame)}
                    data-testid="button-start-game"
                  >
                    <Play className="w-5 h-5" /> Solo Play
                  </Button>
                  <Link href="/lobby">
                    <Button
                      size="lg"
                      variant="secondary"
                      className="gap-2 font-bold bg-white/20 text-white border-white/30"
                      data-testid="button-start-multiplayer"
                    >
                      <Users className="w-5 h-5" /> Multiplayer
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <Card className="p-5 border-border">
                <h3 className="font-bold text-sm uppercase text-muted-foreground mb-2 tracking-wider">How to Play</h3>
                <p className="text-sm leading-relaxed">{selectedGame.howToPlay}</p>
              </Card>
              <Card className="p-5 border-border">
                <h3 className="font-bold text-sm uppercase text-muted-foreground mb-2 tracking-wider">Science Concept</h3>
                <p className="text-sm leading-relaxed">{selectedGame.scienceConcept}</p>
              </Card>
              <Card className="p-5 border-border">
                <h3 className="font-bold text-sm uppercase text-muted-foreground mb-2 tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Scoring
                </h3>
                <p className="text-sm leading-relaxed">{selectedGame.scoring}</p>
              </Card>
              <Card className="p-5 border-border">
                <h3 className="font-bold text-sm uppercase text-muted-foreground mb-2 tracking-wider flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" /> Rewards
                </h3>
                <p className="text-sm leading-relaxed">{selectedGame.reward}</p>
              </Card>
              {user && (
                <Card className="p-5 border-border md:col-span-2">
                  <h3 className="font-bold text-sm uppercase text-muted-foreground mb-3 tracking-wider flex items-center gap-1.5">
                    <Medal className="w-4 h-4 text-amber-500" /> Your High Scores
                  </h3>
                  {(() => {
                    const scores = (user as any)?.gameScores as Record<string, number> || {};
                    const overall = scores[selectedGame.id] || 0;
                    const easy = scores[`${selectedGame.id}:easy`] || 0;
                    const medium = scores[`${selectedGame.id}:medium`] || 0;
                    const hard = scores[`${selectedGame.id}:hard`] || 0;
                    const hasAny = overall > 0 || easy > 0 || medium > 0 || hard > 0;
                    const DIFF_STYLES: Record<string, { label: string; color: string; bg: string }> = {
                      easy:   { label: "Easy",   color: "text-green-600 dark:text-green-400",  bg: "bg-green-500/10 border-green-500/30" },
                      medium: { label: "Medium", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
                      hard:   { label: "Hard",   color: "text-red-600 dark:text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
                    };
                    return hasAny ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="text-4xl font-black text-amber-500" data-testid={`text-highscore-${selectedGame.id}`}>{overall} pts</div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Overall Best</span>
                            <span className="text-xs text-muted-foreground">Play again to beat it!</span>
                          </div>
                        </div>
                        {(easy > 0 || medium > 0 || hard > 0) && (
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                            {(["easy", "medium", "hard"] as const).map((d) => {
                              const val = d === "easy" ? easy : d === "medium" ? medium : hard;
                              const s = DIFF_STYLES[d];
                              return (
                                <div key={d} className={`rounded-lg border px-3 py-2 text-center ${s.bg}`} data-testid={`text-highscore-${selectedGame.id}-${d}`}>
                                  <p className={`text-xs font-bold uppercase tracking-wide ${s.color}`}>{s.label}</p>
                                  <p className={`text-lg font-black ${val > 0 ? s.color : "text-muted-foreground"}`}>
                                    {val > 0 ? `${val}` : "—"}
                                  </p>
                                  {val > 0 && <p className="text-[10px] text-muted-foreground">pts</p>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No score yet — play your first game!</p>
                    );
                  })()}
                </Card>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
                  <Gamepad2 className="w-8 h-8 text-purple-500" /> Game Arcade
                </h1>
                <p className="text-muted-foreground font-medium mt-1">
                  Choose a game mode and start your science adventure!
                </p>
              </div>
              <Badge variant="secondary" className="text-sm font-bold self-start md:self-auto">
                {filteredGames.length} Games Available
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="font-semibold text-xs"
                  data-testid={`button-filter-${cat.toLowerCase().replace(" ", "-")}`}
                >
                  {cat}
                </Button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map((game, i) => {
                const IconComp = ICON_MAP[game.icon] || Gamepad2;
                const gameHighScore = ((user as any)?.gameScores as Record<string, number>)?.[game.id] || 0;
                return (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    <Card
                      className="p-5 border-border cursor-pointer hover-elevate group"
                      onClick={() => setSelectedGame(game)}
                      data-testid={`card-game-${game.id}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-md bg-gradient-to-br ${game.gradient} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                          <IconComp className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold">{game.name}</h3>
                            {game.isSecret && (
                              <Badge variant="destructive" className="text-[10px] font-bold">
                                <Sparkles className="w-3 h-3 mr-0.5" /> SECRET
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-medium mt-0.5 line-clamp-2">
                            {game.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {game.category}
                            </Badge>
                            {gameHighScore > 0 && (
                              <Badge variant="secondary" className="text-[10px] font-bold gap-1 text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-400/30">
                                <Medal className="w-2.5 h-2.5" /> {gameHighScore} pts
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {lockedSecrets.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-black mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-muted-foreground" /> Locked Secret Modes
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lockedSecrets.map((game) => {
                    const reqs: string[] = [];
                    const progBadges: React.ReactNode[] = [];
                    if (game.requiredBadges && badges.length < game.requiredBadges) {
                      reqs.push(`Earn ${game.requiredBadges} badges`);
                      progBadges.push(<Badge key="b" variant="outline" className="text-[10px] font-semibold">{badges.length}/{game.requiredBadges} badges</Badge>);
                    }
                    if (game.requiredRebirth && rebirthLevel < game.requiredRebirth) {
                      reqs.push(`Reach Rebirth ${game.requiredRebirth}`);
                      progBadges.push(<Badge key="r" variant="outline" className="text-[10px] font-semibold">Rebirth {rebirthLevel}/{game.requiredRebirth}</Badge>);
                    }
                    if (game.requiredXp && userXp < game.requiredXp) {
                      reqs.push(`Reach ${game.requiredXp.toLocaleString()} XP`);
                      progBadges.push(<Badge key="x" variant="outline" className="text-[10px] font-semibold">{userXp.toLocaleString()}/{game.requiredXp.toLocaleString()} XP</Badge>);
                    }
                    if (game.requiredGames && totalGamesPlayed < game.requiredGames) {
                      reqs.push(`Play ${game.requiredGames} games`);
                      progBadges.push(<Badge key="g" variant="outline" className="text-[10px] font-semibold">{totalGamesPlayed}/{game.requiredGames} games</Badge>);
                    }
                    if (game.requiredBosses && bossesDefeated < game.requiredBosses) {
                      reqs.push(`Defeat ${game.requiredBosses} bosses`);
                      progBadges.push(<Badge key="bo" variant="outline" className="text-[10px] font-semibold">{bossesDefeated}/{game.requiredBosses} bosses</Badge>);
                    }
                    return (
                      <Card key={game.id} className="p-5 border-border opacity-60">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                            <Lock className="w-7 h-7 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="font-bold">???</h3>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5">
                              {reqs.join(" + ")} to unlock!
                            </p>
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {progBadges}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
