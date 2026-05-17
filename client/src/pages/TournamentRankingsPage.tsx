import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy, Loader2, ArrowLeft, Star, Medal, Crown, TrendingUp,
  Award, ChevronRight, Zap, Shield
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { TOURNAMENT_TIERS, getTournamentTier } from "@/lib/gameData";

export default function TournamentRankingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{
    rankings: { id: number; username: string; tournamentXp: number; tournamentWins: number; tierIndex: number }[];
    myRank: { id: number; username: string; tournamentXp: number; tournamentWins: number; tierIndex: number } | null;
  }>({
    queryKey: ["/api/tournament-rankings"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-rankings">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const rankings = data?.rankings || [];
  const myRank = data?.myRank;
  const myTier = myRank ? getTournamentTier(myRank.tournamentXp) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tournaments")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Trophy className="w-7 h-7 text-yellow-500" /> Tournament Rankings
          </h1>
          <p className="text-sm text-muted-foreground">Climb the tiers by earning Tournament XP!</p>
        </div>
      </div>

      {myTier && myRank && (
        <Card className="p-5 mb-6 border-2 border-primary/30" data-testid="card-my-tier">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${myTier.color} flex items-center justify-center text-2xl shadow-lg`}>
                {myTier.emoji}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Your Current Tier</div>
                <div className={`text-xl font-black ${myTier.textColor}`} data-testid="text-my-tier-name">{myTier.name}</div>
                <div className="text-xs text-muted-foreground">
                  {myRank.tournamentXp} Tournament XP • {myRank.tournamentWins} Wins
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Rank</div>
              <div className="text-2xl font-black text-primary" data-testid="text-my-rank">
                #{rankings.findIndex(r => r.id === myRank.id) + 1 || "—"}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className={myTier.textColor}>{myTier.emoji} {myTier.name}</span>
              {myTier.nextTier && (
                <span className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  {myTier.nextTier.emoji} {myTier.nextTier.name}
                </span>
              )}
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden" data-testid="progress-tournament-xp">
              <motion.div
                className={`h-full bg-gradient-to-r ${myTier.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${myTier.progress * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <div className="text-xs text-center text-muted-foreground">
              {myTier.nextTier
                ? `${myTier.xpInTier} / ${myTier.xpForNext} XP to next tier`
                : "Max tier reached!"}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 mb-6">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" /> All Tiers
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {TOURNAMENT_TIERS.map((tier, i) => {
            const isCurrentTier = myTier && myTier.tierIndex === i;
            return (
              <div
                key={i}
                className={`border rounded-lg p-2 text-center ${isCurrentTier ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border"}`}
                data-testid={`card-tier-${i}`}
              >
                <div className="text-xl mb-1">{tier.emoji}</div>
                <div className={`text-xs font-bold ${tier.textColor}`}>{tier.name}</div>
                <div className="text-[10px] text-muted-foreground">{tier.minXp}+ XP</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" /> Top 100 Players
        </h3>
        <div className="space-y-1">
          {rankings.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No tournament data yet. Play tournaments to earn Tournament XP!</p>
          )}
          {rankings.map((player, i) => {
            const tier = getTournamentTier(player.tournamentXp);
            const medals = ["🥇", "🥈", "🥉"];
            const isMe = player.id === myRank?.id;
            return (
              <motion.div
                key={player.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  isMe ? "bg-primary/15 border border-primary/30" :
                  i < 3 ? "bg-yellow-500/10" : "bg-muted/30"
                }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                data-testid={`row-ranking-${i}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center font-bold text-sm">
                    {i < 3 ? medals[i] : `#${i + 1}`}
                  </span>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center text-sm`}>
                    {tier.emoji}
                  </div>
                  <div>
                    <div className="font-bold flex items-center gap-1">
                      {player.username}
                      {isMe && <Badge variant="outline" className="text-[9px] px-1 py-0">YOU</Badge>}
                    </div>
                    <div className={`text-[10px] ${tier.textColor}`}>{tier.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold">{player.tournamentXp} XP</div>
                  <div className="text-[10px] text-muted-foreground">{player.tournamentWins} wins</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
