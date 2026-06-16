import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gift, Coins, Gem, Zap, Loader2, CheckCircle, RefreshCw, Package, Globe, Star, FlaskConical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WORLDS, POTIONS } from "@/lib/gameData";

interface FreeCode {
  code: string;
  coinReward: number;
  maxUses: number;
  currentUses: number;
}

interface RedeemResult {
  success: boolean;
  coinReward: number;
  gemReward: number;
  xpReward: number;
  mysteryBoxReward: number;
  mysteryBoxType: string;
  boxResults: { reward: string }[];
  itemRewards: string[];
  worldRewards: string[];
  potionRewards: string[];
  message: string | null;
}

const BOX_LABELS: Record<string, { label: string; emoji: string }> = {
  bronze: { label: "Bronze Box", emoji: "📦" },
  silver: { label: "Silver Box", emoji: "🥈" },
  gold: { label: "Gold Box", emoji: "🏆" },
};

function getWorldName(id: string) {
  return WORLDS.find(w => w.id === id)?.name || id;
}

function unlockWorldsInLocalStorage(worldIds: string[]) {
  try {
    const saved = localStorage.getItem("unlocked-worlds");
    const current: string[] = saved ? JSON.parse(saved) : [];
    const updated = [...new Set([...current, ...worldIds])];
    localStorage.setItem("unlocked-worlds", JSON.stringify(updated));
  } catch {}
}

export default function RedeemPage() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [lastResult, setLastResult] = useState<RedeemResult | null>(null);

  const { data: freeCode, refetch: refetchFree } = useQuery<FreeCode | null>({
    queryKey: ["/api/codes/free"],
  });

  const redeemMutation = useMutation({
    mutationFn: (codeStr: string) => apiRequest("POST", "/api/codes/redeem", { code: codeStr }),
    onSuccess: async (res) => {
      const data: RedeemResult = await res.json();
      setLastResult(data);
      setCode("");
      refetchFree();
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      if (data.worldRewards?.length > 0) {
        unlockWorldsInLocalStorage(data.worldRewards);
      }

      const parts: string[] = [];
      if (data.coinReward > 0) parts.push(`${data.coinReward} Neuros`);
      if (data.gemReward > 0) parts.push(`${data.gemReward} Sparks`);
      if (data.xpReward > 0) parts.push(`${data.xpReward} XP`);
      if (data.mysteryBoxReward > 0) {
        const boxLabel = BOX_LABELS[data.mysteryBoxType || "bronze"]?.label || "Mystery Box";
        parts.push(`${data.mysteryBoxReward}× ${boxLabel} opened`);
      }
      if (data.worldRewards?.length > 0) parts.push(`${data.worldRewards.length} world unlock${data.worldRewards.length > 1 ? "s" : ""}`);
      if (data.itemRewards?.length > 0) parts.push(`${data.itemRewards.length} item${data.itemRewards.length > 1 ? "s" : ""}`);
      if (data.potionRewards?.length > 0) parts.push(`${data.potionRewards.length} potion${data.potionRewards.length > 1 ? "s" : ""}`);
      toast({ title: `Code redeemed!${parts.length > 0 ? " You got " + parts.join(", ") + "!" : ""}` });
    },
    onError: async (err: any) => {
      const msg = await err.response?.json().catch(() => ({ message: "Failed to redeem code" }));
      toast({ title: msg?.message || "Failed to redeem code", variant: "destructive" });
    },
  });

  const handleRedeem = () => {
    if (!code.trim()) return;
    setLastResult(null);
    redeemMutation.mutate(code.trim());
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-black flex items-center gap-3 mb-2">
          <Gift className="w-8 h-8 text-purple-500" /> Redeem a Code
        </h1>
        <p className="text-muted-foreground font-medium mb-8">
          Enter a code to claim coins, gems, items, worlds, and more!
        </p>

        {freeCode && (
          <Card className="p-4 border-emerald-500/30 bg-emerald-500/5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Free Code</span>
              <Badge variant="secondary" className="text-xs ml-auto">{freeCode.currentUses}/{freeCode.maxUses} claimed</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              A free code is always available — redeem it for <strong>{freeCode.coinReward} Neuros</strong>. Once {freeCode.maxUses} players use it, a new one appears.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <code className="text-xl font-black tracking-widest bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                {freeCode.code}
              </code>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setCode(freeCode.code)} data-testid="button-use-free-code">
                <RefreshCw className="w-3 h-3" /> Use this code
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-6 mb-6">
          <h2 className="font-bold mb-4">Enter Your Code</h2>
          <div className="flex gap-3">
            <Input
              placeholder="e.g. LAUNCH2025"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleRedeem()}
              className="font-mono font-bold tracking-wider text-lg"
              data-testid="input-redeem-code"
            />
            <Button onClick={handleRedeem} disabled={redeemMutation.isPending || !code.trim()} className="gap-2 font-bold shrink-0" data-testid="button-redeem-code">
              {redeemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              Redeem
            </Button>
          </div>
        </Card>

        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="p-6 border-purple-500/30 bg-purple-500/5 text-center">
                <CheckCircle className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                <h2 className="text-xl font-black mb-1">Code Redeemed!</h2>
                {lastResult.message && (
                  <p className="text-sm italic text-muted-foreground mb-4 max-w-sm mx-auto">"{lastResult.message}"</p>
                )}
                {!lastResult.message && <div className="mb-4" />}
                <div className="flex gap-3 justify-center flex-wrap">
                  {lastResult.coinReward > 0 && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20">
                      <Coins className="w-5 h-5 text-yellow-500" />
                      <span className="font-black text-lg">+{lastResult.coinReward}</span>
                      <span className="text-sm text-muted-foreground">coins</span>
                    </div>
                  )}
                  {lastResult.gemReward > 0 && (
                    <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20">
                      <Gem className="w-5 h-5 text-blue-500" />
                      <span className="font-black text-lg">+{lastResult.gemReward}</span>
                      <span className="text-sm text-muted-foreground">gems</span>
                    </div>
                  )}
                  {lastResult.xpReward > 0 && (
                    <div className="flex items-center gap-2 bg-purple-500/10 px-4 py-2 rounded-lg border border-purple-500/20">
                      <Zap className="w-5 h-5 text-purple-500" />
                      <span className="font-black text-lg">+{lastResult.xpReward}</span>
                      <span className="text-sm text-muted-foreground">XP</span>
                    </div>
                  )}
                
                </div>

                {lastResult.boxResults?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-bold mb-2 flex items-center justify-center gap-2">
                      <Package className="w-4 h-4 text-orange-500" />
                      {BOX_LABELS[lastResult.mysteryBoxType || "bronze"]?.emoji || "📦"} {lastResult.mysteryBoxReward}× {BOX_LABELS[lastResult.mysteryBoxType || "bronze"]?.label || "Mystery Box"} Opened!
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {lastResult.boxResults.map((r, i) => (
                        <Badge key={i} className="bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30">
                          {r.reward}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {lastResult.worldRewards?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-bold mb-2 flex items-center justify-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500" /> Worlds Unlocked!
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {lastResult.worldRewards.map(w => (
                        <Badge key={w} className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30">
                          {getWorldName(w)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {lastResult.itemRewards?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-bold mb-2 flex items-center justify-center gap-2">
                      <Star className="w-4 h-4 text-purple-500" /> Items Added to Inventory!
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {lastResult.itemRewards.map(i => (
                        <Badge key={i} className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30">
                          {i}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {lastResult.potionRewards?.length > 0 && (() => {
                  const counts: Record<string, number> = {};
                  lastResult.potionRewards.forEach(pid => { counts[pid] = (counts[pid] || 0) + 1; });
                  return (
                    <div className="mt-4">
                      <p className="text-sm font-bold mb-2 flex items-center justify-center gap-2">
                        <FlaskConical className="w-4 h-4 text-emerald-500" /> Potions Added!
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {Object.entries(counts).map(([pid, qty]) => {
                          const def = POTIONS.find(p => p.id === pid);
                          return (
                            <Badge key={pid} className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                              🧪 {qty}× {def?.name || pid}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
