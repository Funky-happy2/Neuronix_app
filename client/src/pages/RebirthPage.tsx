import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Star, Award, Gamepad2, ShoppingBag, Sparkles, Lock, CheckCircle, AlertTriangle, Swords, Flame, Zap, Calendar, Coins, Trophy, Bird, Shield, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getRebirthRequirements, getRebirthMultiplier } from "@/lib/gameData";
import { useState } from "react";

function computeLevel(xp: number): number {
  if (typeof xp !== "number" || isNaN(xp) || xp <= 0) return 1;
  return Math.max(1, Math.floor((125 + Math.sqrt(625 + 300 * xp)) / 150));
}

const REBIRTH_MILESTONES = [
  { level: 1, label: "First Rebirth", badge: "Rebirth Rookie badge", item: "Eternal Flame avatar", icon: Bird, color: "text-orange-400" },
  { level: 5, label: "Rebirth 5", badge: "Rebirth Veteran badge", item: "Rebirth Titan avatar", icon: Shield, color: "text-purple-400" },
  { level: 10, label: "Rebirth 10", badge: "Rebirth Master badge", item: "", icon: Trophy, color: "text-yellow-400" },
];

export default function RebirthPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  const rebirthMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rebirth");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Rebirth Complete!", description: "You've been reborn with a permanent multiplier boost!" });
      setConfirming(false);
    },
    onError: (err: any) => {
      toast({ title: "Can't Rebirth", description: err.message || "Requirements not met", variant: "destructive" });
      setConfirming(false);
    },
  });

  if (!user) return null;
  const u = user as any;
  const rebirthLevel = u.rebirthLevel || 0;
  const currentMultiplier = getRebirthMultiplier(rebirthLevel);
  const currentLevel = computeLevel(u.xp || 0);

  const req = getRebirthRequirements(rebirthLevel);
  const nextMultiplier = getRebirthMultiplier(rebirthLevel + 1);

  const bossesDefeatedCount = Object.keys((u.bossesDefeated || {}) as Record<string, number>).length;

  const checks = [
    { label: "Level", current: currentLevel, required: req.level, icon: Star },
    { label: "Badges", current: (u.badges || []).length, required: req.badges, icon: Award },
    { label: "Games Played", current: u.totalGamesPlayed || 0, required: req.gamesPlayed, icon: Gamepad2 },
    { label: "Shop Items", current: (u.inventory || []).length, required: req.shopItems, icon: ShoppingBag },
    ...(req.bossesDefeated > 0 ? [{ label: "Bosses Defeated", current: bossesDefeatedCount, required: req.bossesDefeated, icon: Swords }] : []),
    ...(req.longestStreak > 0 ? [{ label: "Longest Streak", current: u.longestStreak || 0, required: req.longestStreak, icon: Flame }] : []),
    ...(req.xp > 0 ? [{ label: "Total XP", current: u.xp || 0, required: req.xp, icon: Zap }] : []),
    ...(req.dailyChallenges > 0 ? [{ label: "Daily Challenges", current: u.dailyChallengesCompleted || 0, required: req.dailyChallenges, icon: Calendar }] : []),
    ...(req.totalCoins > 0 ? [{ label: "Neuros", current: u.coins || 0, required: req.totalCoins, icon: Coins }] : []),
  ];

  const allMet = checks.every(c => c.current >= c.required);
  const maxed = rebirthLevel >= 100;

  const bonusPct = currentMultiplier - 100;
  const nextBonusPct = nextMultiplier - 100;
  const exampleBase = 1000;
  const exampleCurrent = Math.floor(exampleBase * (currentMultiplier / 100));
  const exampleNext = Math.floor(exampleBase * (nextMultiplier / 100));

  const nextMilestone = REBIRTH_MILESTONES.find(m => m.level > rebirthLevel);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full px-4 py-1">
            <RefreshCw className="w-5 h-5 text-amber-400" />
            <span className="text-amber-300 font-bold text-sm">REBIRTH SYSTEM</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent" data-testid="text-rebirth-title">
            Rebirth
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Reset your progress to earn a permanent XP and Neuro multiplier. The further you go before rebirthing, the bigger the reward.
          </p>
        </div>

        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-orange-950/20">
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="text-5xl font-bold text-amber-400" data-testid="text-rebirth-level">
                {rebirthLevel}
              </div>
              <div className="text-sm text-muted-foreground">Rebirth Level</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-muted-foreground font-medium">Current Bonus</span>
                </div>
                <div className="text-xl font-bold text-yellow-300" data-testid="text-current-multiplier">
                  +{bonusPct}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {exampleBase} XP → <span className="text-yellow-400 font-semibold">{exampleCurrent} XP</span>
                </div>
              </div>

              {!maxed && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-muted-foreground font-medium">After Next Rebirth</span>
                  </div>
                  <div className="text-xl font-bold text-green-300">
                    +{nextBonusPct}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {exampleBase} XP → <span className="text-green-400 font-semibold">{exampleNext} XP</span>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              This multiplier applies to every XP and Neuro reward you earn — from games, bosses, and daily challenges.
            </p>
          </CardContent>
        </Card>

        {nextMilestone && (
          <Card className="border-purple-500/20 bg-purple-950/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <nextMilestone.icon className={`w-5 h-5 ${nextMilestone.color}`} />
                <span className="text-sm font-bold">Next Milestone: Rebirth {nextMilestone.level}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {nextMilestone.badge && (
                  <Badge variant="outline" className="text-xs gap-1 border-purple-500/30 text-purple-300">
                    <Award className="w-3 h-3" /> {nextMilestone.badge}
                  </Badge>
                )}
                {nextMilestone.item && (
                  <Badge variant="outline" className={`text-xs gap-1 border-amber-500/30 ${nextMilestone.color}`}>
                    <ShoppingBag className="w-3 h-3" /> {nextMilestone.item}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {maxed ? (
          <Card className="border-green-500/30">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
              <p className="text-green-300 font-bold text-lg">Maximum Rebirth Reached!</p>
              <p className="text-muted-foreground text-sm">You've achieved the ultimate multiplier of +{bonusPct}%.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-purple-500/20">
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold text-sm text-purple-300">Requirements for Rebirth {rebirthLevel + 1}</h3>
                {checks.map((check) => {
                  const met = check.current >= check.required;
                  const pct = Math.min((check.current / check.required) * 100, 100);
                  return (
                    <div key={check.label} className="space-y-1" data-testid={`requirement-${check.label.toLowerCase().replace(/\s/g, '-')}`}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <check.icon className={`w-4 h-4 ${met ? "text-green-400" : "text-muted-foreground"}`} />
                          <span className={met ? "text-green-300" : "text-foreground"}>{check.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={met ? "text-green-400" : "text-foreground"}>{check.current.toLocaleString()}</span>
                          <span className="text-muted-foreground">/ {check.required.toLocaleString()}</span>
                          {met ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card className="border-red-500/20 bg-red-950/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-semibold text-red-300">Resets</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✕</span> All Neuros</li>
                    <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✕</span> Win Streak</li>
                    <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✕</span> Games played & win count</li>
                    <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✕</span> Tournament wins</li>
                    <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✕</span> Common & Uncommon shop items</li>
                    <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✕</span> Lab experiment progress</li>
                    <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✕</span> Boss defeat records</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-green-500/20 bg-green-950/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold text-green-300">Kept Forever</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> XP, Level & Sparks</li>
                    <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> Game high scores</li>
                    <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> All earned badges</li>
                    <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> Rare, Epic & Legendary items</li>
                    <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> Unlocked worlds</li>
                    <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> Rebirth level & multiplier</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {confirming ? (
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={() => rebirthMutation.mutate()}
                  disabled={rebirthMutation.isPending || !allMet}
                  data-testid="button-confirm-rebirth"
                >
                  {rebirthMutation.isPending ? "Rebirthing..." : "Yes, Rebirth Now!"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)} data-testid="button-cancel-rebirth">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-6 text-lg"
                disabled={!allMet}
                onClick={() => setConfirming(true)}
                data-testid="button-rebirth"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                {allMet ? `Rebirth to Level ${rebirthLevel + 1}` : "Requirements Not Met"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
