import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChatPanel } from "@/components/ChatPanel";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText, Coins, Gem, Plus, Loader2, MessageSquare, Check, X, User,
  CheckCircle2, Hourglass, Handshake, Ban,
} from "lucide-react";

interface Quest {
  id: number;
  posterId: number;
  posterName: string;
  title: string;
  description: string;
  rewardCoins: number;
  rewardGems: number;
  status: "open" | "assigned" | "completed" | "cancelled";
  assigneeId: number | null;
  assigneeName: string | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_META: Record<Quest["status"], { label: string; cls: string; icon: typeof Hourglass }> = {
  open: { label: "Open", cls: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/40", icon: Hourglass },
  assigned: { label: "In Progress", cls: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40", icon: Handshake },
  completed: { label: "Completed", cls: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/40", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border", icon: Ban },
};

export default function QuestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const meId = (user as any)?.id as number | undefined;
  const restricted = (user as any)?.restricted === true;
  const coins = (user as any)?.coins ?? 0;
  const gems = (user as any)?.gems ?? 0;

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardCoins, setRewardCoins] = useState("");
  const [rewardGems, setRewardGems] = useState("");
  const [openChat, setOpenChat] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "mine">("all");

  const { data: quests = [], isLoading } = useQuery<Quest[]>({ queryKey: ["/api/quests"], refetchInterval: 8000 });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  };
  const err = (e: any) => toast({ title: "Oops", description: e.message, variant: "destructive" });

  const createQuest = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quests", {
        title, description,
        rewardCoins: Number(rewardCoins) || 0,
        rewardGems: Number(rewardGems) || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Quest posted!", description: "Your payment is held safely until the quest is done." });
      setTitle(""); setDescription(""); setRewardCoins(""); setRewardGems(""); setShowForm(false);
      refresh();
    },
    onError: err,
  });

  const accept = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/quests/${id}/accept`, {})).json(),
    onSuccess: () => { toast({ title: "Quest accepted!", description: "Chat with the poster to sort out details." }); refresh(); },
    onError: err,
  });
  const complete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/quests/${id}/complete`, {})).json(),
    onSuccess: () => { toast({ title: "Quest completed!", description: "Payment released to the helper." }); refresh(); },
    onError: err,
  });
  const cancel = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/quests/${id}/cancel`, {})).json(),
    onSuccess: () => { toast({ title: "Quest cancelled", description: "Your payment has been refunded." }); refresh(); },
    onError: err,
  });

  const visible = quests.filter((q) => {
    if (filter === "open") return q.status === "open";
    if (filter === "mine") return q.posterId === meId || q.assigneeId === meId;
    return q.status !== "cancelled" || q.posterId === meId;
  });

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-fuchsia-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
          <ScrollText className="w-9 h-9 text-amber-500" /> Quest Board
        </h1>
        <p className="text-muted-foreground font-medium mt-1">Post a task and offer a reward, or take on someone else's quest. Chat to bargain or get the details!</p>
      </div>

      {restricted && (
        <Card className="p-3 mb-4 border-amber-400/50 bg-amber-500/10 text-center text-sm font-bold text-amber-600 dark:text-amber-400">
          You're on a guest pass — you can read quests and chat is limited, but you can't post or accept.
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {(["all", "open", "mine"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`quest-filter-${f}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold capitalize transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              {f === "mine" ? "My Quests" : f}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowForm((s) => !s)} disabled={restricted} className="gap-2 font-bold" data-testid="quest-new">
          <Plus className="w-4 h-4" /> Post a Quest
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="p-5 mb-5 border-2 border-amber-400/40">
              <h3 className="font-black mb-3">New Quest</h3>
              <div className="space-y-3">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quest title (e.g. Help me beat the Power Rift!)" maxLength={100} data-testid="quest-title" />
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the task and what you need…" maxLength={1000} rows={3} data-testid="quest-desc" />
                <div className="flex gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <Input type="number" min={0} value={rewardCoins} onChange={(e) => setRewardCoins(e.target.value)} placeholder="Neuros" className="w-28" data-testid="quest-coins" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Gem className="w-4 h-4 text-fuchsia-500" />
                    <Input type="number" min={0} value={rewardGems} onChange={(e) => setRewardGems(e.target.value)} placeholder="Gems" className="w-28" data-testid="quest-gems" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">You have {coins.toLocaleString()} Neuros &amp; {gems} gems. The reward is held safely until you mark the quest complete (refunded if you cancel).</p>
                <div className="flex gap-2">
                  <Button onClick={() => createQuest.mutate()} disabled={createQuest.isPending || !title.trim() || !description.trim()} className="gap-2 font-bold" data-testid="quest-submit">
                    {createQuest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Post Quest
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)} className="font-bold">Cancel</Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-bold">No quests here yet.</p>
          <p className="text-sm">Be the first to post one!</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((q) => {
            const meta = STATUS_META[q.status];
            const StatusIcon = meta.icon;
            const mine = q.posterId === meId;
            const isAssignee = q.assigneeId === meId;
            const canAccept = q.status === "open" && !mine && !restricted;
            const chatOpen = openChat === q.id;
            // Chat is open to everyone while the quest is open; once assigned only poster + helper.
            const canChat = q.status === "open" ? !restricted : (mine || isAssignee);
            return (
              <Card key={q.id} className="p-5" data-testid={`quest-card-${q.id}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-black leading-tight">{q.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {q.posterName}{mine && " (you)"}</span>
                      {q.assigneeName && <span className="flex items-center gap-1"><Handshake className="w-3 h-3" /> {q.assigneeName}{isAssignee && " (you)"}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 font-bold gap-1 ${meta.cls}`}><StatusIcon className="w-3 h-3" /> {meta.label}</Badge>
                </div>

                <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-3">{q.description}</p>

                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-sm font-bold text-muted-foreground">Reward:</span>
                  {q.rewardCoins > 0 && <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-0 gap-1"><Coins className="w-3 h-3" /> {q.rewardCoins.toLocaleString()}</Badge>}
                  {q.rewardGems > 0 && <Badge className="bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border-0 gap-1"><Gem className="w-3 h-3" /> {q.rewardGems}</Badge>}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {canAccept && (
                    <Button size="sm" onClick={() => accept.mutate(q.id)} disabled={accept.isPending} className="gap-1.5 font-bold" data-testid={`quest-accept-${q.id}`}>
                      <Check className="w-4 h-4" /> Accept Quest
                    </Button>
                  )}
                  {mine && q.status === "assigned" && (
                    <Button size="sm" onClick={() => complete.mutate(q.id)} disabled={complete.isPending} className="gap-1.5 font-bold bg-green-600 hover:bg-green-700" data-testid={`quest-complete-${q.id}`}>
                      <CheckCircle2 className="w-4 h-4" /> Mark Complete &amp; Pay
                    </Button>
                  )}
                  {mine && (q.status === "open" || q.status === "assigned") && (
                    <Button size="sm" variant="outline" onClick={() => cancel.mutate(q.id)} disabled={cancel.isPending} className="gap-1.5 font-bold" data-testid={`quest-cancel-${q.id}`}>
                      <X className="w-4 h-4" /> Cancel
                    </Button>
                  )}
                  {(q.status === "open" || q.status === "assigned") && (
                    <Button size="sm" variant="ghost" onClick={() => setOpenChat(chatOpen ? null : q.id)} className="gap-1.5 font-bold" data-testid={`quest-chat-${q.id}`}>
                      <MessageSquare className="w-4 h-4" /> {chatOpen ? "Hide Chat" : "Chat"}
                    </Button>
                  )}
                </div>

                <AnimatePresence>
                  {chatOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3">
                      <ChatPanel
                        endpoint={`/api/quests/${q.id}/messages`}
                        meId={meId}
                        canSend={canChat}
                        emptyHint="Ask for details or make an offer!"
                        disabledHint={restricted ? "Guest passes can't chat here." : "Only the poster and helper can chat now."}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
