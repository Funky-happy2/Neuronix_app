import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Swords, Loader2, Shield, Trophy, Star, Gem, Users,
  ArrowLeft, Check, X, Zap, Crown, Flame, Diamond, Rocket,
  type LucideIcon,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface BattleMatchup {
  round: number;
  challengerUserId: number;
  challengerUsername: string;
  defenderUserId: number;
  defenderUsername: string;
  challengerScore: number | null;
  defenderScore: number | null;
  completed: boolean;
}

interface ClanBattle {
  id: number;
  challengerClanId: number;
  challengerClanName: string;
  defenderClanId: number;
  defenderClanName: string;
  status: "pending" | "active" | "completed" | "declined";
  matchups: BattleMatchup[];
  challengerScore: number;
  defenderScore: number;
  winnerId: number | null;
  winnerName: string | null;
  gemReward: number;
  xpReward: number;
}

interface BrowseClan {
  id: number;
  name: string;
  tag: string;
  memberCount: number;
  totalXP: number;
  icon: string;
  color: string;
}

const CLAN_ICON_MAP: Record<string, LucideIcon> = {
  Shield, Sword: Swords, Crown, Star, Fire: Flame, Lightning: Zap,
  Diamond, Rocket,
};

export default function ClanBattlePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewingBattle, setViewingBattle] = useState<number | null>(null);
  const [showChallenge, setShowChallenge] = useState(false);

  const userClanId = (user as any)?.clanId;

  const { data: battles = [], isLoading } = useQuery<ClanBattle[]>({
    queryKey: ["/api/clan-battles"],
    enabled: !!userClanId,
  });

  const { data: battleDetail, isLoading: detailLoading } = useQuery<ClanBattle>({
    queryKey: ["/api/clan-battles", viewingBattle],
    enabled: viewingBattle !== null,
  });

  const { data: allClans = [] } = useQuery<BrowseClan[]>({
    queryKey: ["/api/clans"],
    enabled: showChallenge,
  });

  const challengeMutation = useMutation({
    mutationFn: async (defenderClanId: number) => {
      const res = await apiRequest("POST", "/api/clan-battles/challenge", { defenderClanId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles"] });
      toast({ title: "Challenge Sent!", description: "Waiting for the other clan to respond." });
      setShowChallenge(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: async (battleId: number) => {
      const res = await apiRequest("POST", `/api/clan-battles/${battleId}/accept`);
      return res.json();
    },
    onSuccess: (_, battleId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles", battleId] });
      toast({ title: "Battle Accepted!", description: "The war begins!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: async (battleId: number) => {
      const res = await apiRequest("POST", `/api/clan-battles/${battleId}/decline`);
      return res.json();
    },
    onSuccess: (_, battleId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles", battleId] });
      toast({ title: "Battle Declined" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitScoreMutation = useMutation({
    mutationFn: async ({ battleId, roundIndex }: { battleId: number; roundIndex: number }) => {
      const score = Math.floor(Math.random() * 151) + 50;
      const res = await apiRequest("POST", `/api/clan-battles/${battleId}/submit-score`, { roundIndex, score });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clan-battles", vars.battleId] });
      toast({ title: "Round Played!", description: "Your score has been submitted." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!userClanId) {
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3 mb-6">
          <Swords className="w-8 h-8 text-red-500" /> Clan Wars
        </h1>
        <Card className="p-8 text-center">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-bold mb-2" data-testid="text-no-clan">Join a clan first!</p>
          <p className="text-sm text-muted-foreground">You need to be in a clan to participate in clan wars.</p>
        </Card>
      </div>
    );
  }

  if (viewingBattle && battleDetail) {
    const battle = battleDetail;
    const isChallenger = battle.challengerClanId === userClanId;
    const isDefender = battle.defenderClanId === userClanId;
    const isPending = battle.status === "pending";
    const isActive = battle.status === "active";
    const isCompleted = battle.status === "completed";
    const isDeclined = battle.status === "declined";

    return (
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => setViewingBattle(null)} className="gap-2 mb-4" data-testid="button-back-battles">
          <ArrowLeft className="w-4 h-4" /> Back to Battles
        </Button>

        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="text-center flex-1">
              <p className="font-black text-lg" data-testid="text-challenger-name">{battle.challengerClanName}</p>
              <p className="text-3xl font-black text-blue-500" data-testid="text-challenger-score">{battle.challengerScore}</p>
            </div>
            <div className="text-center">
              <Swords className="w-8 h-8 text-red-500 mx-auto mb-1" />
              <Badge
                variant={isCompleted ? "default" : isPending ? "outline" : isDeclined ? "destructive" : "secondary"}
                data-testid="badge-battle-status"
              >
                {battle.status.toUpperCase()}
              </Badge>
            </div>
            <div className="text-center flex-1">
              <p className="font-black text-lg" data-testid="text-defender-name">{battle.defenderClanName}</p>
              <p className="text-3xl font-black text-red-500" data-testid="text-defender-score">{battle.defenderScore}</p>
            </div>
          </div>

          {isPending && isDefender && (
            <div className="flex gap-2 justify-center">
              <Button onClick={() => acceptMutation.mutate(battle.id)} disabled={acceptMutation.isPending} className="gap-2 font-bold" data-testid="button-accept-battle">
                <Check className="w-4 h-4" /> Accept
              </Button>
              <Button variant="destructive" onClick={() => declineMutation.mutate(battle.id)} disabled={declineMutation.isPending} className="gap-2 font-bold" data-testid="button-decline-battle">
                <X className="w-4 h-4" /> Decline
              </Button>
            </div>
          )}

          {isCompleted && battle.winnerName && (
            <div className="text-center mt-4 p-4 bg-yellow-500/10 rounded-xl">
              <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="font-black text-lg" data-testid="text-winner-name">{battle.winnerName} Wins!</p>
              <div className="flex items-center justify-center gap-4 mt-2">
                {battle.xpReward > 0 && (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-xp-reward">
                    <Star className="w-3 h-3" /> +{battle.xpReward} XP
                  </Badge>
                )}
                {battle.gemReward > 0 && (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-gem-reward">
                    <Gem className="w-3 h-3" /> +{battle.gemReward} Gems
                  </Badge>
                )}
              </div>
            </div>
          )}
        </Card>

        {(isActive || isCompleted) && Array.isArray(battle.matchups) && battle.matchups.length > 0 && (
          <div>
            <h2 className="text-xl font-black mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" /> Matchups
            </h2>
            <div className="space-y-2">
              {battle.matchups.map((m, i) => {
                const canPlay = isActive && !m.completed && (
                  (isChallenger && m.challengerUserId === user?.id && (!m.challengerScore || m.challengerScore === 0)) ||
                  (isDefender && m.defenderUserId === user?.id && (!m.defenderScore || m.defenderScore === 0))
                );
                return (
                  <Card key={i} className="p-4" data-testid={`matchup-card-${i}`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 text-center">
                        <p className="text-sm font-bold" data-testid={`text-matchup-challenger-${i}`}>{m.challengerUsername}</p>
                        <p className="text-lg font-black text-blue-500">{m.challengerScore ?? "-"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground font-bold">Round {m.round}</p>
                        {m.completed && <Badge variant="secondary" className="text-[10px]">Done</Badge>}
                      </div>
                      <div className="flex-1 text-center">
                        <p className="text-sm font-bold" data-testid={`text-matchup-defender-${i}`}>{m.defenderUsername}</p>
                        <p className="text-lg font-black text-red-500">{m.defenderScore ?? "-"}</p>
                      </div>
                    </div>
                    {canPlay && (
                      <div className="text-center mt-3">
                        <Button
                          onClick={() => submitScoreMutation.mutate({ battleId: battle.id, roundIndex: i })}
                          disabled={submitScoreMutation.isPending}
                          className="gap-2 font-bold"
                          data-testid={`button-play-round-${i}`}
                        >
                          {submitScoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                          Play Round
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showChallenge) {
    const challengeClans = allClans.filter((c: any) => c.id !== userClanId);
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => setShowChallenge(false)} className="gap-2 mb-4" data-testid="button-back-from-challenge">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h1 className="text-2xl font-black mb-4 flex items-center gap-2">
          <Swords className="w-6 h-6 text-red-500" /> Challenge a Clan
        </h1>
        <div className="space-y-2">
          {challengeClans.map((clan) => (
            <Card key={clan.id} className="p-4 flex items-center gap-4" data-testid={`challenge-clan-${clan.id}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow"
                style={{ background: clan.color || "hsl(270, 85%, 55%)" }}
              >
                {(() => { const Icon = CLAN_ICON_MAP[clan.icon] || Shield; return <Icon className="w-5 h-5 text-white" />; })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">[{clan.tag}] {clan.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {clan.memberCount}</span>
                  <span className="flex items-center gap-0.5"><Star className="w-3 h-3" /> {clan.totalXP?.toLocaleString()} XP</span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => challengeMutation.mutate(clan.id)}
                disabled={challengeMutation.isPending}
                className="gap-1 font-bold"
                data-testid={`button-challenge-${clan.id}`}
              >
                <Swords className="w-3 h-3" /> Challenge
              </Button>
            </Card>
          ))}
          {challengeClans.length === 0 && (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No other clans available to challenge.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const pendingBattles = battles.filter(b => b.status === "pending");
  const activeBattles = battles.filter(b => b.status === "active");
  const completedBattles = battles.filter(b => b.status === "completed" || b.status === "declined");

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
          <Swords className="w-8 h-8 text-red-500" /> Clan Wars
        </h1>
        <Button onClick={() => setShowChallenge(true)} className="gap-2 font-bold" data-testid="button-new-challenge">
          <Swords className="w-4 h-4" /> Challenge a Clan
        </Button>
      </div>

      <Card className="p-4 mb-6 bg-gradient-to-r from-red-500/5 to-orange-500/5 border-red-500/20">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">Clan Wars</span> pit your clan against another in a series of matchup rounds. Challenge rival clans, battle it out, and earn gems and XP for victory!
        </p>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {pendingBattles.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-yellow-500" /> Pending ({pendingBattles.length})
              </h2>
              <div className="space-y-2">
                {pendingBattles.map(b => {
                  const isDefender = b.defenderClanId === userClanId;
                  return (
                    <Card key={b.id} className="p-4 flex items-center gap-4 flex-wrap" data-testid={`battle-card-${b.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{b.challengerClanName} vs {b.defenderClanName}</p>
                        <Badge variant="outline" className="text-[10px] mt-1">Pending</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDefender && (
                          <>
                            <Button size="sm" onClick={() => acceptMutation.mutate(b.id)} disabled={acceptMutation.isPending} className="gap-1 font-bold" data-testid={`button-accept-${b.id}`}>
                              <Check className="w-3 h-3" /> Accept
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => declineMutation.mutate(b.id)} disabled={declineMutation.isPending} className="gap-1 font-bold" data-testid={`button-decline-${b.id}`}>
                              <X className="w-3 h-3" /> Decline
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setViewingBattle(b.id)} data-testid={`button-view-${b.id}`}>
                          View
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {activeBattles.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-500" /> Active ({activeBattles.length})
              </h2>
              <div className="space-y-2">
                {activeBattles.map(b => (
                  <Card key={b.id} className="p-4 flex items-center gap-4 cursor-pointer hover:border-red-500/30 transition-colors flex-wrap"
                    onClick={() => setViewingBattle(b.id)}
                    data-testid={`battle-card-${b.id}`}
                  >
                    <Swords className="w-5 h-5 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{b.challengerClanName} vs {b.defenderClanName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="text-blue-500 font-bold">{b.challengerScore}</span>
                        <span>-</span>
                        <span className="text-red-500 font-bold">{b.defenderScore}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Active</Badge>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {completedBattles.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" /> Completed ({completedBattles.length})
              </h2>
              <div className="space-y-2">
                {completedBattles.map(b => (
                  <Card key={b.id} className="p-4 flex items-center gap-4 cursor-pointer hover:border-yellow-500/30 transition-colors flex-wrap"
                    onClick={() => setViewingBattle(b.id)}
                    data-testid={`battle-card-${b.id}`}
                  >
                    <Trophy className="w-5 h-5 text-yellow-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{b.challengerClanName} vs {b.defenderClanName}</p>
                      {b.winnerName && <p className="text-xs text-muted-foreground">Winner: <span className="font-bold text-foreground">{b.winnerName}</span></p>}
                      {b.status === "declined" && <p className="text-xs text-red-500 font-bold">Declined</p>}
                    </div>
                    <Badge variant={b.status === "declined" ? "destructive" : "secondary"} className="text-[10px]">
                      {b.status === "declined" ? "Declined" : "Completed"}
                    </Badge>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {battles.length === 0 && (
            <div className="text-center py-16">
              <Swords className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium text-lg" data-testid="text-no-battles">No battles yet!</p>
              <p className="text-sm text-muted-foreground">Challenge another clan to start a war.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
