import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Printer, Star, Trophy, Flame, Zap, Target, Gamepad2,
  FlaskConical, Award, TrendingUp, Calendar
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { GAME_MODES, BADGES } from "@/lib/gameData";
import { motion } from "framer-motion";

interface TeacherPageProps {
  nickname: string;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  badges: string[];
  totalGamesPlayed: number;
  gameScores: Record<string, number>;
}

export default function TeacherPage({
  nickname, xp, level, currentStreak, longestStreak,
  badges, totalGamesPlayed, gameScores,
}: TeacherPageProps) {
  const scienceCategories = ["Physics", "Biology", "Chemistry", "Earth Science", "History"];
  const categoryScores: Record<string, { played: number; total: number }> = {};

  scienceCategories.forEach((cat) => {
    const catGames = GAME_MODES.filter((g) => g.category === cat && !g.isSecret);
    const played = catGames.filter((g) => gameScores[g.id]).length;
    categoryScores[cat] = { played, total: catGames.length };
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8 print:p-2">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-emerald-500" /> Progress Report
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            For teachers and parents - track learning progress.
          </p>
        </div>
        <Button onClick={handlePrint} className="gap-2 font-bold print:hidden" data-testid="button-print-report">
          <Printer className="w-4 h-4" /> Print Report
        </Button>
      </div>

      <Card className="p-6 border-border mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-black text-white">{nickname.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-2xl font-black">{nickname}</h2>
            <p className="text-sm text-muted-foreground font-medium">Neuronix - Player Report</p>
            <p className="text-xs text-muted-foreground">Generated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-xl font-black text-purple-500 dark:text-purple-400">{level}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Level</p>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-xl font-black text-blue-500 dark:text-blue-400">{xp.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Total XP</p>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-xl font-black text-yellow-500 dark:text-yellow-400">{badges.length}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Badges</p>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-xl font-black text-orange-500 dark:text-orange-400">{currentStreak}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Day Streak</p>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-xl font-black text-emerald-500 dark:text-emerald-400">{totalGamesPlayed}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Games Played</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-border mb-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" /> Science Coverage by Subject
        </h3>
        <div className="space-y-4">
          {scienceCategories.map((cat) => {
            const data = categoryScores[cat];
            const pct = data.total > 0 ? (data.played / data.total) * 100 : 0;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-bold">{cat}</span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {data.played}/{data.total} games explored
                  </span>
                </div>
                <Progress value={pct} className="h-3" />
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 border-border mb-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-purple-500" /> Game Scores
        </h3>
        {Object.keys(gameScores).length === 0 ? (
          <p className="text-sm text-muted-foreground">No games played yet. Scores will appear here after playing!</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {GAME_MODES.filter((g) => gameScores[g.id]).map((game) => (
              <div key={game.id} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                <div>
                  <p className="text-sm font-bold">{game.name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{game.category}</p>
                </div>
                <Badge variant="secondary" className="font-bold">
                  <Star className="w-3 h-3 mr-1" /> {gameScores[game.id]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 border-border mb-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" /> Earned Badges
        </h3>
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No badges earned yet. Play games to start collecting!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {BADGES.filter((b) => badges.includes(b.id)).map((badge) => (
              <Badge key={badge.id} variant="secondary" className="text-xs font-bold py-1.5 px-3">
                <Star className="w-3 h-3 mr-1" /> {badge.name}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 border-border print:hidden bg-muted/30">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" /> Engagement Summary
        </h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>Current play streak: <strong className="text-foreground">{currentStreak} days</strong></li>
          <li>Longest play streak: <strong className="text-foreground">{longestStreak} days</strong></li>
          <li>Total games completed: <strong className="text-foreground">{totalGamesPlayed}</strong></li>
          <li>Unique games explored: <strong className="text-foreground">{Object.keys(gameScores).length}/{GAME_MODES.filter(g => !g.isSecret).length}</strong></li>
          <li>Badge collection: <strong className="text-foreground">{badges.length}/{BADGES.length}</strong></li>
        </ul>
      </Card>
    </div>
  );
}
