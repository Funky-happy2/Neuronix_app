import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap, Coins, Sparkles, Shield, Flame, Star, Lock, ShoppingCart, Play, Clock, Gem, Plus, Award, Rocket, Undo2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { POTIONS, type PotionDef } from "@/lib/gameData";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Zap, Coins, Sparkles, Shield, Flame, Star, Award, Rocket,
};

const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-500 bg-gray-500/10 border-gray-500/20",
  uncommon: "text-green-500 bg-green-500/10 border-green-500/20",
  rare: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  epic: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  legendary: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
};

function computeLevel(xp: number): number {
  let level = 1;
  let xpCheck = 0;
  for (let l = 1; l <= 100; l++) {
    xpCheck += l * 100 + (l - 1) * 50;
    if (xp < xpCheck) { level = l; break; }
  }
  return level;
}

function timeLeft(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function PotionCard({ potion, canBuy, onBuy, buying }: { potion: PotionDef; canBuy: boolean; onBuy: () => void; buying: boolean }) {
  const Icon = ICON_MAP[potion.icon] || Zap;
  return (
    <Card className="border-purple-500/20 hover:border-purple-500/40 transition-colors" data-testid={`card-potion-${potion.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${potion.color} flex items-center justify-center shrink-0`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm">{potion.name}</h3>
              <Badge className={`text-[10px] font-bold border ${RARITY_COLORS[potion.rarity]}`}>
                {potion.rarity.toUpperCase()}
              </Badge>
              {potion.requiredRebirth > 0 && (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
                  Rebirth {potion.requiredRebirth}+
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{potion.description}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {potion.durationMinutes >= 60 ? `${potion.durationMinutes / 60}h` : `${potion.durationMinutes}m`}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={!canBuy || buying}
          onClick={onBuy}
          data-testid={`button-buy-${potion.id}`}
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1" />
          {potion.price} {potion.currency === "gems" ? <Gem className="w-3 h-3 ml-0.5 text-orange-400" /> : <Coins className="w-3 h-3 ml-0.5 text-yellow-400" />}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PotionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const buyMutation = useMutation({
    mutationFn: async (potionId: string) => {
      const res = await apiRequest("POST", "/api/potions/buy", { potionId });
      return res.json();
    },
    onSuccess: (_, potionId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const p = POTIONS.find(p => p.id === potionId);
      toast({ title: "Potion Purchased!", description: `${p?.name || "Potion"} added to your inventory.` });
    },
    onError: (err: any) => {
      toast({ title: "Purchase Failed", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (potionId: string) => {
      const res = await apiRequest("POST", "/api/potions/activate", { potionId });
      return res.json();
    },
    onSuccess: (_, potionId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const p = POTIONS.find(p => p.id === potionId);
      toast({ title: "Potion Activated!", description: `${p?.name || "Potion"} is now active!` });
    },
    onError: (err: any) => {
      toast({ title: "Activation Failed", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (potionId: string) => {
      const res = await apiRequest("POST", "/api/potions/refund", { potionId });
      return res.json();
    },
    onSuccess: (data: any, potionId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const p = POTIONS.find(p => p.id === potionId);
      const currIcon = data.currency === "gems" ? "💎" : "🪙";
      toast({ title: "Potion Sold", description: `${p?.name || "Potion"} refunded for ${data.refund} ${currIcon} (50% back).` });
    },
    onError: (err: any) => {
      toast({ title: "Refund Failed", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async (potionId: string) => {
      const res = await apiRequest("POST", `/api/shop/upgrade-item/${potionId}`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Potion Upgraded!", description: `Potion upgraded to Level ${data.newLevel}! Effects are now stronger. (${data.coinsSpent} coins)` });
    },
    onError: (err: any) => {
      toast({ title: "Can't upgrade", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  if (!user) return null;
  const u = user as any;
  const currentLevel = computeLevel(u.xp || 0);
  const rebirthLevel = u.rebirthLevel || 0;
  const userPotions: string[] = u.potions || [];
  const itemLevels: Record<string, number> = u.itemLevels || {};
  const UPGRADE_MAX = 2;
  const UPGRADE_COSTS: Record<number, number> = { 1: 200, 2: 500 };
  const activePotions: { potionId: string; expiresAt: number }[] = ((u.activePotions || []) as any[]).filter(
    (p: any) => p.expiresAt > Date.now()
  );

  const inventoryCounts: Record<string, number> = {};
  userPotions.forEach(id => { inventoryCounts[id] = (inventoryCounts[id] || 0) + 1; });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 rounded-full px-4 py-1">
            <Zap className="w-5 h-5 text-purple-400" />
            <span className="text-purple-300 font-bold text-sm">POTIONS LAB</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-fuchsia-500 bg-clip-text text-transparent" data-testid="text-potions-title">
            Potions
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Buy and activate temporary boosts to supercharge your gameplay!
          </p>
        </div>

        {activePotions.length > 0 && (
          <Card className="border-green-500/30 bg-green-950/10">
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold text-green-300 text-sm flex items-center gap-2">
                <Play className="w-4 h-4" /> Active Effects
              </h3>
              <div className="grid gap-2">
                {activePotions.map((ap, i) => {
                  const def = POTIONS.find(p => p.id === ap.potionId);
                  if (!def) return null;
                  const Icon = ICON_MAP[def.icon] || Zap;
                  return (
                    <div key={i} className="flex items-center gap-3 bg-green-900/20 rounded-lg p-2" data-testid={`active-potion-${i}`}>
                      <div className={`w-8 h-8 rounded bg-gradient-to-br ${def.color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{def.name}</div>
                        <div className="text-xs text-muted-foreground">{def.description}</div>
                      </div>
                      <Badge variant="outline" className="border-green-500/40 text-green-400 text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {timeLeft(ap.expiresAt)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="shop" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="shop" data-testid="tab-shop">Shop</TabsTrigger>
            <TabsTrigger value="inventory" data-testid="tab-inventory">
              Inventory {userPotions.length > 0 && `(${userPotions.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shop" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POTIONS.map((potion) => {
                const levelOk = currentLevel >= potion.requiredLevel;
                const rebirthOk = rebirthLevel >= potion.requiredRebirth;
                const affordCoins = potion.currency === "coins" && (u.coins || 0) >= potion.price;
                const affordGems = potion.currency === "gems" && (u.gems || 0) >= potion.price;
                const canBuy = levelOk && rebirthOk && (affordCoins || affordGems);

                if (!levelOk || !rebirthOk) {
                  const Icon = ICON_MAP[potion.icon] || Zap;
                  return (
                    <Card key={potion.id} className="border-gray-700/30 opacity-60" data-testid={`card-potion-locked-${potion.id}`}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                          <Lock className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-400">{potion.name}</div>
                          <div className="text-xs text-gray-500">
                            {!levelOk ? `Unlock at Level ${potion.requiredLevel}` : `Requires Rebirth ${potion.requiredRebirth}`}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <PotionCard
                    key={potion.id}
                    potion={potion}
                    canBuy={canBuy}
                    onBuy={() => buyMutation.mutate(potion.id)}
                    buying={buyMutation.isPending}
                  />
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="mt-4">
            {Object.keys(inventoryCounts).length === 0 ? (
              <Card className="border-dashed border-muted-foreground/20">
                <CardContent className="p-8 text-center">
                  <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No potions yet. Buy some from the shop!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(inventoryCounts).map(([potionId, count]) => {
                  const def = POTIONS.find(p => p.id === potionId);
                  if (!def) return null;
                  const Icon = ICON_MAP[def.icon] || Zap;
                  return (
                    <Card key={potionId} className="border-purple-500/20" data-testid={`inventory-${potionId}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${def.color} flex items-center justify-center shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-sm">{def.name}</h3>
                              <Badge variant="secondary" className="text-[10px]">x{count}</Badge>
                              {(itemLevels[potionId] || 0) > 0 && (
                                <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
                                  Lv {itemLevels[potionId]}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{def.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
                            onClick={() => activateMutation.mutate(potionId)}
                            disabled={activateMutation.isPending}
                            data-testid={`button-activate-${potionId}`}
                          >
                            <Play className="w-3.5 h-3.5 mr-1" />
                            Use 1
                          </Button>
                          {(() => {
                            const REFUND_MAP: Record<string, { price: number; currency: string }> = {
                              "potion-xp-small": { price: 200, currency: "coins" }, "potion-xp-large": { price: 500, currency: "coins" },
                              "potion-coin-small": { price: 200, currency: "coins" }, "potion-coin-large": { price: 500, currency: "coins" },
                              "potion-lucky": { price: 350, currency: "coins" }, "potion-badge-double": { price: 400, currency: "coins" },
                              "potion-shield": { price: 3, currency: "gems" }, "potion-mega": { price: 8, currency: "gems" },
                              "potion-xp-mega": { price: 15, currency: "gems" }, "potion-coin-mega": { price: 10, currency: "gems" },
                              "potion-ultra-boost": { price: 20, currency: "gems" },
                            };
                            const r = REFUND_MAP[potionId];
                            if (!r) return null;
                            const refundAmt = Math.floor(r.price * 0.5);
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs gap-1 border-red-500/30 text-red-500 hover:bg-red-500/10"
                                onClick={() => refundMutation.mutate(potionId)}
                                disabled={refundMutation.isPending}
                                data-testid={`button-refund-${potionId}`}
                              >
                                <Undo2 className="w-3 h-3" />
                                Sell {refundAmt}{r.currency === "gems" ? "💎" : "🪙"}
                              </Button>
                            );
                          })()}
                          {(itemLevels[potionId] || 0) < UPGRADE_MAX ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-bold text-xs gap-0.5 border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                              disabled={upgradeMutation.isPending || (u.coins || 0) < (UPGRADE_COSTS[(itemLevels[potionId] || 0) + 1] || 0)}
                              onClick={() => upgradeMutation.mutate(potionId)}
                              data-testid={`button-upgrade-potion-${potionId}`}
                            >
                              <Plus className="w-3 h-3" /> Lv{(itemLevels[potionId] || 0) + 1} ({UPGRADE_COSTS[(itemLevels[potionId] || 0) + 1]})
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="font-bold text-xs gap-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 flex items-center px-2">
                              <Star className="w-3 h-3" /> Max
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
