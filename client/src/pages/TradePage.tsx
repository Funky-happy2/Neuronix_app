import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeftRight, Gift, Plus, X, Coins, Check, Loader2, ArrowRight, PackageOpen, Search, Trash2, ShoppingBag, Gem, Zap, FlaskConical, Users, Lock, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { POTIONS } from "@/lib/gameData";
import { ChatPanel } from "@/components/ChatPanel";
import UserProfileModal from "@/components/UserProfileModal";
import type { Trade, ShopItem } from "@shared/schema";

export default function TradePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"market" | "create" | "gift">("market");
  const [offerItems, setOfferItems] = useState<string[]>([]);
  const [offerCoins, setOfferCoins] = useState(0);
  const [offerGems, setOfferGems] = useState(0);
  const [offerXp, setOfferXp] = useState(0);
  const [offerPotions, setOfferPotions] = useState<string[]>([]);
  const [wantItems, setWantItems] = useState<string[]>([]);
  const [wantCoins, setWantCoins] = useState(0);
  const [wantGems, setWantGems] = useState(0);
  const [wantXp, setWantXp] = useState(0);
  const [wantPotions, setWantPotions] = useState<string[]>([]);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [wantItemSearch, setWantItemSearch] = useState("");
  const [maxUses, setMaxUses] = useState<"single" | "unlimited" | "custom">("single");
  const [customMaxUses, setCustomMaxUses] = useState(2);
  const [giftRecipient, setGiftRecipient] = useState("");
  const [giftItem, setGiftItem] = useState("");
  const [giftCoins, setGiftCoins] = useState(0);
  const [giftGems, setGiftGems] = useState(0);
  const [searchFilter, setSearchFilter] = useState("");

  const userInventory: string[] = (user as any)?.inventory || [];
  const userCoins: number = (user as any)?.coins || 0;
  const userGems: number = (user as any)?.gems || 0;

  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
  });

  const { data: shopItems = [] } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop"],
  });

  const itemMap: Record<string, ShopItem> = {};
  for (const item of shopItems) {
    itemMap[item.id] = item;
  }

  const getItemName = (id: string) => itemMap[id]?.name || id;

  const createTradeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trades", {
        offerItems, offerCoins, offerGems, offerXp, offerPotions,
        wantItems, wantCoins, wantGems, wantXp, wantPotions,
        recipientName: recipientName.trim() || undefined,
        maxUses: maxUses === "single" ? undefined : maxUses === "unlimited" ? 0 : customMaxUses,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Trade Listed!", description: "Your trade is now on the market." });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setOfferItems([]);
      setOfferCoins(0);
      setOfferGems(0);
      setOfferXp(0);
      setOfferPotions([]);
      setWantItems([]);
      setWantCoins(0);
      setWantGems(0);
      setWantXp(0);
      setWantPotions([]);
      setRecipientName("");
      setWantItemSearch("");
      setMaxUses("single");
      setCustomMaxUses(2);
      setTab("market");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create trade", variant: "destructive" });
    },
  });

  const acceptTradeMutation = useMutation({
    mutationFn: async (tradeId: number) => {
      const res = await apiRequest("POST", `/api/trades/${tradeId}/accept`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Trade Complete!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to accept trade", variant: "destructive" });
    },
  });

  const cancelTradeMutation = useMutation({
    mutationFn: async (tradeId: number) => {
      const res = await apiRequest("DELETE", `/api/trades/${tradeId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cancelled", description: "Trade removed from market." });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to cancel trade", variant: "destructive" });
    },
  });

  const giftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gift", {
        recipientUsername: giftRecipient,
        itemId: giftItem || undefined,
        coins: giftCoins > 0 ? giftCoins : undefined,
        gems: giftGems > 0 ? giftGems : undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Gift Sent!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setGiftRecipient("");
      setGiftItem("");
      setGiftCoins(0);
      setGiftGems(0);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to send gift", variant: "destructive" });
    },
  });

  const tradeableItems = userInventory.filter(id => {
    const item = itemMap[id];
    if (!item) return false;
    if (item.rewardSource) return false;
    return true;
  });

  const openTrades = trades.filter(t => t.status === "open");
  const myTrades = openTrades.filter(t => t.sellerId === user?.id);
  const otherTrades = openTrades.filter(t => t.sellerId !== user?.id);

  const filteredTrades = searchFilter
    ? otherTrades.filter(t => {
        const s = searchFilter.toLowerCase();
        return t.sellerName.toLowerCase().includes(s)
          || t.offerItems.some(id => getItemName(id).toLowerCase().includes(s))
          || t.wantItems.some(id => getItemName(id).toLowerCase().includes(s));
      })
    : otherTrades;

  const userPotions: string[] = (user as any)?.potions || [];
  const userPotionCounts: Record<string, number> = {};
  for (const p of userPotions) userPotionCounts[p] = (userPotionCounts[p] || 0) + 1;
  const offerPotionCounts: Record<string, number> = {};
  for (const p of offerPotions) offerPotionCounts[p] = (offerPotionCounts[p] || 0) + 1;

  const canCreateTrade = (offerItems.length > 0 || offerCoins > 0 || offerGems > 0 || offerXp > 0 || offerPotions.length > 0)
    && (wantItems.length > 0 || wantCoins > 0 || wantGems > 0 || wantXp > 0 || wantPotions.length > 0);

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-emerald-500" /> Trade Center
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          Trade items safely with other players or send gifts to friends!
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "market" ? "default" : "outline"}
          className="font-bold gap-2"
          onClick={() => setTab("market")}
          data-testid="button-tab-market"
        >
          <ShoppingBag className="w-4 h-4" /> Market
        </Button>
        <Button
          variant={tab === "create" ? "default" : "outline"}
          className="font-bold gap-2"
          onClick={() => setTab("create")}
          data-testid="button-tab-create"
        >
          <Plus className="w-4 h-4" /> Create Trade
        </Button>
        <Button
          variant={tab === "gift" ? "default" : "outline"}
          className="font-bold gap-2"
          onClick={() => setTab("gift")}
          data-testid="button-tab-gift"
        >
          <Gift className="w-4 h-4" /> Send Gift
        </Button>
      </div>

      {tab === "market" && (
        <div>
          {myTrades.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-3 text-muted-foreground">Your Active Trades</h2>
              <div className="grid gap-3">
                {myTrades.map(trade => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    itemMap={itemMap}
                    isOwn={true}
                    userId={user?.id}
                    onCancel={() => cancelTradeMutation.mutate(trade.id)}
                    isPending={cancelTradeMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search trades by player or item name..."
                className="pl-9 font-medium"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                data-testid="input-search-trades"
              />
            </div>
          </div>

          {tradesLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : filteredTrades.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <PackageOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-lg font-bold text-muted-foreground">No trades available</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to list a trade!</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredTrades.map(trade => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  itemMap={itemMap}
                  isOwn={false}
                  userId={user?.id}
                  onAccept={() => acceptTradeMutation.mutate(trade.id)}
                  isPending={acceptTradeMutation.isPending}
                  userInventory={userInventory}
                  userCoins={userCoins}
                  userGems={userGems}
                  onViewProfile={setProfileUsername}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "create" && (
        <div className="space-y-6">
        <Card className="p-4 border-dashed border-muted-foreground/30">
          <label className="text-sm font-semibold text-muted-foreground mb-1 block flex items-center gap-1">
            <Users className="w-4 h-4 inline" /> Send to a specific player <span className="font-normal">(optional — leave blank for public market)</span>
          </label>
          <Input
            placeholder="Username (leave blank to list publicly)"
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
            className="max-w-xs font-bold"
            data-testid="input-recipient-name"
          />
          {recipientName.trim() && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 font-semibold">
              Only <span className="font-black">{recipientName.trim()}</span> will be able to see and accept this trade.
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <label className="text-sm font-semibold text-muted-foreground mb-2 block">Trade uses</label>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant={maxUses === "single" ? "default" : "outline"} onClick={() => setMaxUses("single")} className="font-bold text-xs" data-testid="button-uses-single">1 use (default)</Button>
              <Button size="sm" variant={maxUses === "unlimited" ? "default" : "outline"} onClick={() => setMaxUses("unlimited")} className="font-bold text-xs" data-testid="button-uses-unlimited">♾ Unlimited</Button>
              <Button size="sm" variant={maxUses === "custom" ? "default" : "outline"} onClick={() => setMaxUses("custom")} className="font-bold text-xs" data-testid="button-uses-custom">Custom</Button>
              {maxUses === "custom" && (
                <Input type="number" min={2} max={100} value={customMaxUses} onChange={e => setCustomMaxUses(Math.max(2, parseInt(e.target.value) || 2))} className="w-20 h-8 text-sm font-bold" data-testid="input-custom-uses" />
              )}
            </div>
            {maxUses !== "single" && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {maxUses === "unlimited" ? "No escrow — resources validated live each time someone accepts." : `Up to ${customMaxUses} people can accept this trade. No escrow.`}
              </p>
            )}
          </div>
        </Card>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-5 border-emerald-500/20">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <PackageOpen className="w-5 h-5" /> You Offer
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">Items from your inventory</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {offerItems.map((id, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      {getItemName(id)}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => setOfferItems(offerItems.filter((_, j) => j !== i))} />
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {tradeableItems.filter(id => !offerItems.includes(id)).map(id => (
                    <Button
                      key={id}
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold"
                      onClick={() => setOfferItems([...offerItems, id])}
                      data-testid={`button-offer-${id}`}
                    >
                      <Plus className="w-3 h-3 mr-1" /> {getItemName(id)}
                    </Button>
                  ))}
                  {tradeableItems.filter(id => !offerItems.includes(id)).length === 0 && (
                    <p className="text-xs text-muted-foreground">No tradeable items</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">Neuros to offer</label>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <Input
                    type="number"
                    min={0}
                    max={userCoins}
                    value={offerCoins}
                    onChange={e => setOfferCoins(Math.max(0, Math.min(userCoins, parseInt(e.target.value) || 0)))}
                    className="w-32 font-bold"
                    data-testid="input-offer-coins"
                  />
                  <span className="text-xs text-muted-foreground">/ {userCoins}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">Sparks to offer</label>
                <div className="flex items-center gap-2">
                  <Gem className="w-4 h-4 text-cyan-500" />
                  <Input
                    type="number"
                    min={0}
                    max={userGems}
                    value={offerGems}
                    onChange={e => setOfferGems(Math.max(0, Math.min(userGems, parseInt(e.target.value) || 0)))}
                    className="w-32 font-bold"
                    data-testid="input-offer-gems"
                  />
                  <span className="text-xs text-muted-foreground">/ {userGems}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">XP to offer</label>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <Input
                    type="number"
                    min={0}
                    max={(user as any)?.xp || 0}
                    value={offerXp}
                    onChange={e => setOfferXp(Math.max(0, Math.min((user as any)?.xp || 0, parseInt(e.target.value) || 0)))}
                    className="w-32 font-bold"
                    data-testid="input-offer-xp"
                  />
                  <span className="text-xs text-muted-foreground">/ {(user as any)?.xp || 0}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">Potions to offer</label>
                {offerPotions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {offerPotions.map((id, i) => {
                      const def = POTIONS.find(p => p.id === id);
                      return (
                        <Badge key={i} variant="secondary" className="gap-1 font-bold text-pink-600 dark:text-pink-400">
                          <FlaskConical className="w-3 h-3" /> {def?.name || id}
                          <X className="w-3 h-3 cursor-pointer" onClick={() => setOfferPotions(offerPotions.filter((_, j) => j !== i))} />
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {Object.keys(userPotionCounts).length === 0 && (
                  <p className="text-xs text-muted-foreground">No potions in inventory</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(userPotionCounts).map(([id, count]) => {
                    const def = POTIONS.find(p => p.id === id);
                    const offered = offerPotionCounts[id] || 0;
                    const remaining = count - offered;
                    if (remaining <= 0) return null;
                    return (
                      <Button
                        key={id}
                        size="sm"
                        variant="outline"
                        className="text-xs font-semibold gap-1 text-pink-600 dark:text-pink-400 border-pink-400/40"
                        onClick={() => offerPotions.length < 5 && setOfferPotions([...offerPotions, id])}
                        disabled={offerPotions.length >= 5}
                        data-testid={`button-offer-potion-${id}`}
                      >
                        <Plus className="w-3 h-3" /> {def?.name || id} ({remaining})
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-blue-500/20">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Search className="w-5 h-5" /> You Want
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">Items you want</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {wantItems.map((id, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 font-bold text-blue-600 dark:text-blue-400">
                      {getItemName(id)}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => setWantItems(wantItems.filter((_, j) => j !== i))} />
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Type to search items..."
                    value={wantItemSearch}
                    onChange={e => setWantItemSearch(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-want-item-search"
                  />
                </div>
                {wantItemSearch.trim() && (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {shopItems
                      .filter(i => !i.rewardSource && !wantItems.includes(i.id) && i.name.toLowerCase().includes(wantItemSearch.toLowerCase()))
                      .map(item => (
                        <Button
                          key={item.id}
                          size="sm"
                          variant="outline"
                          className="text-xs font-semibold"
                          onClick={() => { setWantItems([...wantItems, item.id]); setWantItemSearch(""); }}
                          data-testid={`button-want-${item.id}`}
                        >
                          <Plus className="w-3 h-3 mr-1" /> {item.name}
                        </Button>
                    ))}
                    {shopItems.filter(i => !i.rewardSource && !wantItems.includes(i.id) && i.name.toLowerCase().includes(wantItemSearch.toLowerCase())).length === 0 && (
                      <p className="text-xs text-muted-foreground">No items match "{wantItemSearch}"</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">Neuros you want</label>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <Input
                    type="number"
                    min={0}
                    value={wantCoins}
                    onChange={e => setWantCoins(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32 font-bold"
                    data-testid="input-want-coins"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">Sparks you want</label>
                <div className="flex items-center gap-2">
                  <Gem className="w-4 h-4 text-cyan-500" />
                  <Input
                    type="number"
                    min={0}
                    value={wantGems}
                    onChange={e => setWantGems(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32 font-bold"
                    data-testid="input-want-gems"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">XP you want</label>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <Input
                    type="number"
                    min={0}
                    value={wantXp}
                    onChange={e => setWantXp(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32 font-bold"
                    data-testid="input-want-xp"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1 block">Potions you want</label>
                {wantPotions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {wantPotions.map((id, i) => {
                      const def = POTIONS.find(p => p.id === id);
                      return (
                        <Badge key={i} variant="secondary" className="gap-1 font-bold text-blue-600 dark:text-blue-400">
                          <FlaskConical className="w-3 h-3" /> {def?.name || id}
                          <X className="w-3 h-3 cursor-pointer" onClick={() => setWantPotions(wantPotions.filter((_, j) => j !== i))} />
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {POTIONS.map(def => (
                    <Button
                      key={def.id}
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold gap-1 text-blue-600 dark:text-blue-400 border-blue-400/40"
                      onClick={() => wantPotions.length < 5 && setWantPotions([...wantPotions, def.id])}
                      disabled={wantPotions.length >= 5}
                      data-testid={`button-want-potion-${def.id}`}
                    >
                      <Plus className="w-3 h-3" /> {def.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="md:col-span-2">
            <Button
              className="w-full font-bold text-lg gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
              disabled={!canCreateTrade || createTradeMutation.isPending}
              onClick={() => createTradeMutation.mutate()}
              data-testid="button-submit-trade"
            >
              {createTradeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowLeftRight className="w-5 h-5" />}
              {recipientName.trim() ? `Send Trade to ${recipientName.trim()}` : "List Trade on Market"}
            </Button>
          </div>
        </div>
        </div>
      )}

      {tab === "gift" && (
        <Card className="p-6 max-w-lg mx-auto border-pink-500/20">
          <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-pink-600 dark:text-pink-400">
            <Gift className="w-6 h-6" /> Send a Gift
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Send items, coins, or gems to another player. Gifts are one-way and can't be undone!
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1 block">Recipient Username</label>
              <Input
                placeholder="Enter their username..."
                value={giftRecipient}
                onChange={e => setGiftRecipient(e.target.value)}
                className="font-medium"
                data-testid="input-gift-recipient"
              />
            </div>

            <div>
              <label className="text-sm font-semibold mb-1 block">Item to Gift</label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {tradeableItems.map(id => (
                  <Button
                    key={id}
                    size="sm"
                    variant={giftItem === id ? "default" : "outline"}
                    className="text-xs font-semibold"
                    onClick={() => setGiftItem(giftItem === id ? "" : id)}
                    data-testid={`button-gift-item-${id}`}
                  >
                    {giftItem === id && <Check className="w-3 h-3 mr-1" />}
                    {getItemName(id)}
                  </Button>
                ))}
                {tradeableItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">No items to gift</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-1 block">Neuros to Gift</label>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-500" />
                <Input
                  type="number"
                  min={0}
                  max={userCoins}
                  value={giftCoins}
                  onChange={e => setGiftCoins(Math.max(0, Math.min(userCoins, parseInt(e.target.value) || 0)))}
                  className="w-32 font-bold"
                  data-testid="input-gift-coins"
                />
                <span className="text-xs text-muted-foreground">/ {userCoins}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-1 block">Sparks to Gift</label>
              <div className="flex items-center gap-2">
                <Gem className="w-4 h-4 text-cyan-500" />
                <Input
                  type="number"
                  min={0}
                  max={userGems}
                  value={giftGems}
                  onChange={e => setGiftGems(Math.max(0, Math.min(userGems, parseInt(e.target.value) || 0)))}
                  className="w-32 font-bold"
                  data-testid="input-gift-gems"
                />
                <span className="text-xs text-muted-foreground">/ {userGems}</span>
              </div>
            </div>

            <Button
              className="w-full font-bold gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white"
              disabled={!giftRecipient || (!giftItem && giftCoins <= 0 && giftGems <= 0) || giftMutation.isPending}
              onClick={() => giftMutation.mutate()}
              data-testid="button-send-gift"
            >
              {giftMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />}
              Send Gift
            </Button>
          </div>
        </Card>
      )}
      <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
    </div>
  );
}

function TradeCard({ trade, itemMap, isOwn, userId, onAccept, onCancel, isPending, userInventory, userCoins, userGems, onViewProfile }: {
  trade: Trade;
  itemMap: Record<string, ShopItem>;
  isOwn: boolean;
  userId?: number;
  onAccept?: () => void;
  onCancel?: () => void;
  isPending?: boolean;
  userInventory?: string[];
  userCoins?: number;
  userGems?: number;
  onViewProfile?: (username: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const getItemName = (id: string) => itemMap[id]?.name || id;
  const getRarity = (id: string) => itemMap[id]?.rarity || "common";

  const RARITY_COLORS: Record<string, string> = {
    common: "text-gray-500 dark:text-gray-400",
    uncommon: "text-green-500 dark:text-green-400",
    rare: "text-blue-500 dark:text-blue-400",
    epic: "text-purple-500 dark:text-purple-400",
    legendary: "text-yellow-500 dark:text-yellow-400",
  };

  const tradeWantGems = (trade as any).wantGems || 0;
  const tradeOfferGems = (trade as any).offerGems || 0;
  const tradeOfferXp = (trade as any).offerXp || 0;
  const tradeOfferPotions: string[] = Array.isArray((trade as any).offerPotions) ? (trade as any).offerPotions : [];
  const tradeWantXp = (trade as any).wantXp || 0;
  const tradeWantPotions: string[] = Array.isArray((trade as any).wantPotions) ? (trade as any).wantPotions : [];

  const canAccept = !isOwn && userInventory && userCoins !== undefined && userGems !== undefined &&
    trade.wantItems.every(id => userInventory.includes(id)) &&
    trade.wantCoins <= userCoins &&
    tradeWantGems <= userGems;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`p-4 ${isOwn ? "border-emerald-500/20 bg-emerald-500/5" : "border-border"}`} data-testid={`card-trade-${trade.id}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="font-bold text-xs cursor-pointer hover:bg-secondary/80" onClick={() => onViewProfile?.(trade.sellerName)} data-testid={`badge-seller-${trade.id}`}>{trade.sellerName}</Badge>
            {isOwn && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Your Trade</Badge>}
            {(trade as any).recipientName && (
              <Badge className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
                <Lock className="w-2.5 h-2.5" /> Private → {(trade as any).recipientName}
              </Badge>
            )}
            {(trade as any).maxUses === 0 && (
              <Badge className="text-[10px] bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30">♾ Unlimited uses · {(trade as any).timesAccepted || 0} accepted</Badge>
            )}
            {(trade as any).maxUses > 0 && (
              <Badge className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">{((trade as any).maxUses - ((trade as any).timesAccepted || 0))} / {(trade as any).maxUses} uses left</Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">
            {new Date(trade.createdAt).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-lg p-3 min-h-[60px]">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1.5 uppercase tracking-wider">Offering</p>
            <div className="flex flex-wrap gap-1.5">
              {trade.offerItems.map((id, i) => (
                <Badge key={i} variant="outline" className={`text-xs font-semibold ${RARITY_COLORS[getRarity(id)]}`}>
                  {getItemName(id)}
                </Badge>
              ))}
              {trade.offerCoins > 0 && (
                <Badge variant="outline" className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 gap-1">
                  <Coins className="w-3 h-3" /> {trade.offerCoins}
                </Badge>
              )}
              {tradeOfferGems > 0 && (
                <Badge variant="outline" className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 gap-1">
                  <Gem className="w-3 h-3" /> {tradeOfferGems}
                </Badge>
              )}
              {tradeOfferXp > 0 && (
                <Badge variant="outline" className="text-xs font-semibold text-purple-600 dark:text-purple-400 gap-1">
                  <Zap className="w-3 h-3" /> {tradeOfferXp} XP
                </Badge>
              )}
              {tradeOfferPotions.map((id, i) => {
                const def = POTIONS.find(p => p.id === id);
                return (
                  <Badge key={i} variant="outline" className="text-xs font-semibold text-pink-600 dark:text-pink-400 gap-1">
                    <FlaskConical className="w-3 h-3" /> {def?.name || id}
                  </Badge>
                );
              })}
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />

          <div className="flex-1 bg-blue-500/5 dark:bg-blue-500/10 rounded-lg p-3 min-h-[60px]">
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-1.5 uppercase tracking-wider">Wants</p>
            <div className="flex flex-wrap gap-1.5">
              {trade.wantItems.map((id, i) => (
                <Badge key={i} variant="outline" className={`text-xs font-semibold ${RARITY_COLORS[getRarity(id)]}`}>
                  {getItemName(id)}
                </Badge>
              ))}
              {trade.wantCoins > 0 && (
                <Badge variant="outline" className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 gap-1">
                  <Coins className="w-3 h-3" /> {trade.wantCoins}
                </Badge>
              )}
              {tradeWantGems > 0 && (
                <Badge variant="outline" className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 gap-1">
                  <Gem className="w-3 h-3" /> {tradeWantGems}
                </Badge>
              )}
              {tradeWantXp > 0 && (
                <Badge variant="outline" className="text-xs font-semibold text-purple-600 dark:text-purple-400 gap-1">
                  <Zap className="w-3 h-3" /> {tradeWantXp} XP
                </Badge>
              )}
              {tradeWantPotions.map((id, i) => {
                const def = POTIONS.find(p => p.id === id);
                return (
                  <Badge key={i} variant="outline" className="text-xs font-semibold text-pink-600 dark:text-pink-400 gap-1">
                    <FlaskConical className="w-3 h-3" /> {def?.name || id}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-between items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="font-bold gap-1"
            onClick={() => setChatOpen(o => !o)}
            data-testid={`button-chat-trade-${trade.id}`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> {chatOpen ? "Hide Chat" : (isOwn ? "Messages" : "Chat / Bargain")}
          </Button>
          {isOwn ? (
            <Button
              size="sm"
              variant="outline"
              className="font-bold gap-1 text-red-500 border-red-500/30 hover:bg-red-500/10"
              disabled={isPending}
              onClick={onCancel}
              data-testid={`button-cancel-trade-${trade.id}`}
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Cancel
            </Button>
          ) : (
            <Button
              size="sm"
              className="font-bold gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
              disabled={!canAccept || isPending}
              onClick={onAccept}
              data-testid={`button-accept-trade-${trade.id}`}
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {canAccept ? "Accept Trade" : "Can't Accept"}
            </Button>
          )}
        </div>

        <AnimatePresence>
          {chatOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3">
              <p className="text-[10px] text-muted-foreground font-medium mb-1.5">
                {isOwn ? "Messages from interested traders:" : `Bargain with ${trade.sellerName} before you accept.`}
              </p>
              <ChatPanel endpoint={`/api/trades/${trade.id}/messages`} meId={userId} emptyHint="No messages yet — start the conversation!" />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
