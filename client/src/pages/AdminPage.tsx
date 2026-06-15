import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, Users, MessageCircle, Gamepad2, CheckCircle, XCircle,
  Trash2, Eye, Crown, Coins, Gem, Star, Zap, Award, Save, RefreshCw,
  AlertTriangle, RotateCcw, UserX, Trophy, Plus, Loader2, Clock,
  Swords, Heart, Gift, Package, Lock, FlaskConical, Search, ShoppingBag,
  Scale, ThumbsUp, ThumbsDown, Send, History, ArrowRightLeft, School, Pencil, Bot
} from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { CommunityPack, Feedback } from "@shared/schema";
import { BADGES, WORLDS, POTIONS, GAME_MODES as ARCADE_GAME_MODES } from "@/lib/gameData";

type AdminTab = "feedback" | "packs" | "users" | "daily" | "tournaments" | "gt-questions" | "codes" | "messages" | "parliament" | "schools" | "reports";

interface AdminUser {
  id: number;
  username: string;
  displayName?: string;
  xp: number;
  coins: number;
  gems: number;
  level: number;
  badges: string[];
  rebirthLevel: number;
  isAdmin: boolean;
  isUltraAdmin: boolean;
  isVip: boolean;
  banned: boolean;
  strikes: number;
  inventory: string[];
  bossesDefeated: Record<string, number>;
  isDeleted: boolean;
  equippedCosmetics?: Record<string, string>;
}

const ALL_BOSSES = [
  { id: "chaos-storm", name: "The Chaos Storm" },
  { id: "dr-blackout", name: "Dr. Blackout" },
  { id: "mutation-master", name: "The Mutation Master" },
  { id: "professor-meltdown", name: "Professor Meltdown" },
  { id: "gravity-king", name: "The Gravity King" },
  { id: "plague-lord", name: "The Plague Lord" },
  { id: "tecton-the-shaker", name: "Tecton the Shaker" },
  { id: "nebula-queen", name: "The Nebula Queen" },
  { id: "the-void", name: "The Void (Secret)" },
  { id: "professor-paradox", name: "Professor Paradox (Secret)" },
  { id: "king-element", name: "King Element (Secret)" },
  { id: "the-architect", name: "The Architect (Secret)" },
  { id: "dark-matter", name: "Dark Matter (Secret)" },
  { id: "nano-swarm", name: "The Nano Swarm (Secret)" },
  { id: "quantum-computer", name: "The Quantum Computer (Secret)" },
];

const REWARD_ITEMS = [
  { id: "reward-storm-crown", name: "Storm Crown (Decoration)" },
  { id: "reward-circuit-aura", name: "Circuit Aura (Decoration)" },
  { id: "reward-gene-cloak", name: "Gene Cloak (Decoration)" },
  { id: "reward-meltdown-flask", name: "Meltdown Flask (Follower)" },
  { id: "reward-gravity-wings", name: "Gravity Wings (Decoration)" },
  { id: "reward-plague-mask", name: "Plague Mask (Avatar)" },
  { id: "reward-void-shadow", name: "Void Shadow (Follower)" },
  { id: "reward-paradox-clock", name: "Paradox Clock (Decoration)" },
  { id: "reward-element-crown", name: "Element Crown (Avatar)" },
  { id: "reward-omega-title", name: "Omega Slayer Title" },
  { id: "reward-tecton-tremor", name: "Tremor Aura (Decoration)" },
  { id: "reward-nebula-crown", name: "Nebula Crown (Avatar)" },
  { id: "reward-architect-blueprint", name: "Blueprint Follower" },
  { id: "reward-dark-matter-veil", name: "Dark Matter Veil (Decoration)" },
  { id: "reward-nano-companion", name: "Nano Companion (Follower)" },
  { id: "reward-quantum-glitch", name: "Quantum Glitch (Decoration)" },
  { id: "reward-all-bosses", name: "Boss Slayer Avatar" },
  { id: "reward-speed-title", name: "Speed Demon Title" },
  { id: "reward-tournament-title", name: "Tournament Champion Title" },
  { id: "reward-clan-champion", name: "Clan Champion Title" },
];

export default function AdminPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const amUltraAdmin = !!(currentUser as any)?.isUltraAdmin;
  const [tab, setTab] = useState<AdminTab>("feedback");

  const tabs: { id: AdminTab; label: string; icon: any }[] = [
    { id: "parliament", label: "Parliament", icon: Scale },
    { id: "feedback", label: "Feedback", icon: MessageCircle },
    { id: "packs", label: "Packs", icon: Gamepad2 },
    { id: "users", label: "Users", icon: Users },
    { id: "daily", label: "Daily", icon: Star },
    { id: "tournaments", label: "Tournaments", icon: Trophy },
    { id: "gt-questions", label: "GT Questions", icon: Swords },
    { id: "codes", label: "Codes", icon: Gift },
    { id: "messages", label: "Messages", icon: MessageCircle },
    { id: "schools", label: "Apps", icon: School },
    { id: "reports", label: "Reports", icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-black flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-red-500" /> Admin Panel
        </h1>
        <p className="text-muted-foreground font-medium mb-6">Manage the arcade</p>

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <Button
              key={t.id}
              variant={tab === t.id ? "default" : "outline"}
              onClick={() => setTab(t.id)}
              className="gap-2 font-bold"
              data-testid={`tab-admin-${t.id}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </Button>
          ))}
        </div>

        {tab === "parliament" && <ParliamentTab amUltraAdmin={amUltraAdmin} currentUserId={(currentUser as any)?.id} />}
        {tab === "feedback" && <FeedbackTab />}
        {tab === "packs" && <PacksTab />}
        {tab === "users" && <UsersTab />}
        {tab === "daily" && <DailyTab />}
        {tab === "tournaments" && <TournamentsTab />}
        {tab === "gt-questions" && <GTQuestionsTab />}
        {tab === "codes" && <CodesTab />}
        {tab === "messages" && <MessagesTab />}
        {tab === "schools" && <SchoolsTab />}
        {tab === "reports" && <ReportsTab />}
      </motion.div>
    </div>
  );
}

function FeedbackTab() {
  const { toast } = useToast();
  const { data: feedbackList = [], isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/admin/feedback"],
  });
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/feedback/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      toast({ title: "Marked as read" });
    },
  });

  const approveFeedback = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/feedback/${id}/approve`, { xpReward: 50, coinReward: 25 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      toast({ title: "Feedback approved!", description: "User received +50 XP and +25 Neuros as a reward." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: number; reply: string }) =>
      apiRequest("POST", `/api/admin/feedback/${id}/reply`, { reply }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      toast({ title: "Reply sent!", description: "The user will see your reply in their feedback history." });
      setReplyingTo(null);
      setReplyText("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteFeedback = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/feedback/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      toast({ title: "Feedback deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-3">
      {feedbackList.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No feedback yet!</p>
        </Card>
      ) : (
        feedbackList.map(fb => (
          <Card key={fb.id} className={`p-4 ${fb.read ? "opacity-70" : "border-blue-500/30"}`}>
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold">{fb.username}</span>
                  <span className="text-xs text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString()}</span>
                  {!fb.read && <Badge className="bg-blue-500 text-white text-[10px]">New</Badge>}
                  {(fb as any).adminReply && <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 text-[10px]">Replied</Badge>}
                </div>
                <p className="text-sm mb-2">{fb.message}</p>
                {(fb as any).adminReply && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-xs text-blue-600 dark:text-blue-400 mb-2">
                    <span className="font-bold">Your reply: </span>{(fb as any).adminReply}
                  </div>
                )}
                {replyingTo === fb.id && (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply to this user..."
                      className="text-sm min-h-[80px]"
                      maxLength={500}
                      data-testid={`input-reply-${fb.id}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => replyMutation.mutate({ id: fb.id, reply: replyText })}
                        disabled={replyMutation.isPending || !replyText.trim()}
                        data-testid={`button-send-reply-${fb.id}`}
                      >
                        <Send className="w-3 h-3" /> Send Reply
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                {!fb.read && (
                  <Button size="sm" variant="outline" onClick={() => markRead.mutate(fb.id)} className="gap-1" data-testid={`button-read-${fb.id}`}>
                    <Eye className="w-3 h-3" /> Read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-blue-600 border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  onClick={() => { setReplyingTo(replyingTo === fb.id ? null : fb.id); setReplyText((fb as any).adminReply || ""); }}
                  data-testid={`button-reply-${fb.id}`}
                >
                  <Send className="w-3 h-3" /> Reply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-green-600 border-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                  onClick={() => approveFeedback.mutate(fb.id)}
                  disabled={approveFeedback.isPending}
                  data-testid={`button-approve-feedback-${fb.id}`}
                >
                  <CheckCircle className="w-3 h-3" /> Reward
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-red-600 border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => { if (confirm("Delete this feedback?")) deleteFeedback.mutate(fb.id); }}
                  disabled={deleteFeedback.isPending}
                  data-testid={`button-delete-feedback-${fb.id}`}
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function PacksTab() {
  const { toast } = useToast();
  const { data: packs = [], isLoading } = useQuery<CommunityPack[]>({
    queryKey: ["/api/admin/packs"],
  });

  const approve = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/packs/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/packs"] });
      toast({ title: "Pack approved!" });
    },
  });

  const deletePack = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/packs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/packs"] });
      toast({ title: "Pack deleted" });
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-3">
      {packs.length === 0 ? (
        <Card className="p-8 text-center">
          <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No community packs yet!</p>
        </Card>
      ) : (
        packs.map(pack => (
          <Card key={pack.id} className={`p-4 ${pack.approved ? "" : "border-yellow-500/30 bg-yellow-500/5"}`}>
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold">{pack.title}</span>
                  <Badge variant="outline" className="text-xs">{pack.gameMode}</Badge>
                  {pack.approved ? (
                    <Badge className="bg-green-500 text-white text-[10px]">Approved</Badge>
                  ) : (
                    <Badge className="bg-yellow-500 text-white text-[10px]">Pending</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">by {pack.creatorName} | Y{pack.yearLevel} | {pack.plays} plays</p>
                <p className="text-sm mt-1">{pack.description}</p>
              </div>
              <div className="flex gap-2">
                {!pack.approved && (
                  <Button size="sm" onClick={() => approve.mutate(pack.id)} className="gap-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600" data-testid={`button-approve-${pack.id}`}>
                    <CheckCircle className="w-3 h-3" /> Approve
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => deletePack.mutate(pack.id)} className="gap-1" data-testid={`button-delete-pack-${pack.id}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const amUltraAdmin = !!(currentUser as any)?.isUltraAdmin;
  const { data: usersList = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });
  const [editing, setEditing] = useState<number | null>(null);
  const [editData, setEditData] = useState<{ xp: string; coins: string; gems: string; rebirthLevel: string; badges: string }>({ xp: "", coins: "", gems: "", rebirthLevel: "", badges: "" });
  const [bossPanel, setBossPanel] = useState<number | null>(null);
  const [selectedBoss, setSelectedBoss] = useState("");
  const [selectedMutation, setSelectedMutation] = useState("0");
  const [rewardPanel, setRewardPanel] = useState<number | null>(null);
  const [selectedReward, setSelectedReward] = useState("");
  const [givePanel, setGivePanel] = useState<number | null>(null);
  const [renamePanel, setRenamePanel] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [titlePanel, setTitlePanel] = useState<number | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const [giveSubTab, setGiveSubTab] = useState<"items" | "boxes" | "potions">("items");
  const [giveItemSearch, setGiveItemSearch] = useState("");
  const [giveItemCategory, setGiveItemCategory] = useState("all");
  const [giveBoxType, setGiveBoxType] = useState("bronze");
  const [giveBoxQty, setGiveBoxQty] = useState(1);
  const [givePotionId, setGivePotionId] = useState("");
  const [givePotionQty, setGivePotionQty] = useState(1);
  const [giveBoxResults, setGiveBoxResults] = useState<{ reward: string }[]>([]);
  const [proposeModal, setProposeModal] = useState<{ type: string; targetId: number; targetName: string; actionData?: any; isSmallIssue: boolean; label: string } | null>(null);
  const [proposeReason, setProposeReason] = useState("");

  const { data: shopItems = [] } = useQuery<any[]>({ queryKey: ["/api/shop"] });

  const createProposal = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/proposals", data),
    onSuccess: () => {
      toast({ title: "Proposal submitted to Parliament!", description: "Admins can now vote on this." });
      setProposeModal(null);
      setProposeReason("");
    },
    onError: (e: any) => toast({ title: "Failed to create proposal", variant: "destructive" }),
  });

  const grantBossKill = useMutation({
    mutationFn: ({ id, bossId, mutationLevel }: { id: number; bossId: string; mutationLevel: number }) =>
      apiRequest("POST", `/api/admin/users/${id}/grant-boss-kill`, { bossId, mutationLevel }),
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const boss = ALL_BOSSES.find(b => b.id === variables.bossId);
      const mutLabel = variables.mutationLevel === 0 ? "Base" : variables.mutationLevel === 1 ? "Mutation" : "Omega";
      toast({ title: `Granted ${boss?.name || variables.bossId} (${mutLabel}) kill!` });
      setBossPanel(null);
      setSelectedBoss("");
      setSelectedMutation("0");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sealBoss = useMutation({
    mutationFn: ({ id, bossId }: { id: number; bossId: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/seal-boss`, { bossId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const boss = ALL_BOSSES.find(b => b.id === variables.bossId);
      toast({ title: `Sealed ${boss?.name || variables.bossId}! Boss progress removed.` });
      setBossPanel(null);
      setSelectedBoss("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const grantRewardItem = useMutation({
    mutationFn: ({ id, itemId }: { id: number; itemId: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/grant-reward-item`, { itemId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const item = REWARD_ITEMS.find(r => r.id === variables.itemId);
      toast({ title: `Granted ${item?.name || variables.itemId}!` });
      setRewardPanel(null);
      setSelectedReward("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const grantFavourite = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/grant-favourite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Admin's Favourite badge granted with 500 coins!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, displayName }: { id: number; displayName: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/rename`, { displayName }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: `Renamed to "${vars.displayName}"` });
      setRenamePanel(null);
      setRenameValue("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setCustomTitleMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/set-custom-title`, { title }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: vars.title ? `Custom title set to "${vars.title}"` : "Custom title cleared" });
      setTitlePanel(null);
      setTitleValue("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const giveShopItem = useMutation({
    mutationFn: ({ id, itemId }: { id: number; itemId: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/give-shop-item`, { itemId }),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const data = await res.json();
      toast({ title: `Gave "${data.itemName}" to user!` });
    },
    onError: async (e: any) => {
      const data = await e.response?.json().catch(() => ({}));
      toast({ title: data?.message || "Failed to give item", variant: "destructive" });
    },
  });

  const giveMysteryBox = useMutation({
    mutationFn: ({ id, boxType, quantity }: { id: number; boxType: string; quantity: number }) =>
      apiRequest("POST", `/api/admin/users/${id}/give-mystery-box`, { boxType, quantity }),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const data = await res.json();
      setGiveBoxResults(data.results || []);
      toast({ title: `Opened ${data.quantity}× ${data.boxType} box for user!` });
    },
    onError: (e: any) => toast({ title: "Failed to give mystery boxes", variant: "destructive" }),
  });

  const givePotion = useMutation({
    mutationFn: ({ id, potionId, quantity }: { id: number; potionId: string; quantity: number }) =>
      apiRequest("POST", `/api/admin/users/${id}/give-potion`, { potionId, quantity }),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const data = await res.json();
      const pot = POTIONS.find(p => p.id === data.potionId);
      toast({ title: `Gave ${data.quantity}× ${pot?.name || data.potionId}!` });
    },
    onError: (e: any) => toast({ title: "Failed to give potion", variant: "destructive" }),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("POST", `/api/admin/users/${id}/update`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "User updated!" });
      setEditing(null);
    },
  });

  const banUser = useMutation({
    mutationFn: ({ id, banned }: { id: number; banned: boolean }) =>
      apiRequest("POST", `/api/admin/users/${id}/ban`, { banned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User status updated" });
    },
  });

  const strikeUser = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/strike`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Strike given!" });
    },
  });

  const clearStrikes = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/clear-strikes`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Strikes cleared" });
    },
  });

  const resetProgress = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/reset-progress`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Progress reset!" });
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/toggle-admin`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Admin status updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleVip = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/toggle-vip`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "VIP status updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAccount = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Account deactivated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reviveAccount = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/revive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Account revived" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const permanentDelete = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/users/${id}/permanent`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Account permanently deleted", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (user: AdminUser) => {
    setEditing(user.id);
    setEditData({
      xp: String(user.xp),
      coins: String(user.coins),
      gems: String(user.gems),
      rebirthLevel: String(user.rebirthLevel || 0),
      badges: user.badges.join(", "),
    });
  };

  const saveEdit = (userId: number) => {
    const data: any = {
      xp: parseInt(editData.xp) || 0,
      coins: parseInt(editData.coins) || 0,
      gems: parseInt(editData.gems) || 0,
      rebirthLevel: parseInt(editData.rebirthLevel) || 0,
    };
    data.badges = editData.badges.trim()
      ? editData.badges.split(",").map((b: string) => b.trim()).filter(Boolean)
      : [];
    updateUser.mutate({ id: userId, data });
  };

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-3">
      {usersList.map(user => (
        <Card key={user.id} className={`p-4 ${user.isDeleted ? "opacity-60 border-dashed border-red-400 dark:border-red-700" : ""}`}>
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`font-bold ${user.isDeleted ? "line-through text-muted-foreground" : ""}`}>{user.username}</span>
                {user.isDeleted && <Badge className="bg-red-800 text-white text-[10px] gap-0.5"><UserX className="w-2.5 h-2.5" /> Deleted</Badge>}
                {user.isUltraAdmin && <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[10px] gap-0.5"><Crown className="w-2.5 h-2.5" /> Ultra Admin</Badge>}
                {user.isAdmin && !user.isUltraAdmin && <Badge className="bg-red-500 text-white text-[10px]">Admin</Badge>}
                {user.banned && !user.isDeleted && <Badge className="bg-red-600 text-white text-[10px]">Banned</Badge>}
                {user.strikes > 0 && !user.isDeleted && (
                  <Badge className="bg-yellow-500 text-white text-[10px] gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> {user.strikes}/3 Strikes
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs gap-1"><Star className="w-3 h-3" /> Lv.{user.level}</Badge>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-purple-400" /> {user.xp} XP</span>
                <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-yellow-500" /> {user.coins}</span>
                <span className="flex items-center gap-1"><Gem className="w-3 h-3 text-orange-400" /> {user.gems}</span>
                <span className="flex items-center gap-1"><Award className="w-3 h-3" /> {user.badges.length} badges</span>
                {user.rebirthLevel > 0 && <span className="flex items-center gap-1"><RotateCcw className="w-3 h-3 text-pink-500" /> Rebirth {user.rebirthLevel}</span>}
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {user.isDeleted ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { if (confirm(`Revive ${user.username}'s account? They will be able to log in again.`)) reviveAccount.mutate(user.id); }}
                    className="gap-1 font-bold text-xs text-green-600 border-green-500"
                    data-testid={`button-revive-${user.id}`}
                  >
                    <RotateCcw className="w-3 h-3" /> Revive
                  </Button>
                  {amUltraAdmin && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setProposeModal({ type: "permanent-delete", targetId: user.id, targetName: user.username, isSmallIssue: false, label: `Permanently Delete ${user.username}` }); setProposeReason(""); }}
                      className="gap-1 font-bold text-xs"
                      data-testid={`button-permanent-delete-${user.id}`}
                    >
                      <UserX className="w-3 h-3" /> Permanently Delete
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {amUltraAdmin && !user.isUltraAdmin && (
                    <Button
                      size="sm"
                      variant={user.isAdmin ? "destructive" : "outline"}
                      onClick={() => { setProposeModal({ type: "toggle-admin", targetId: user.id, targetName: user.username, isSmallIssue: false, label: user.isAdmin ? `Remove Admin from ${user.username}` : `Make ${user.username} an Admin` }); setProposeReason(""); }}
                      className="gap-1 font-bold text-xs"
                      data-testid={`button-toggle-admin-${user.id}`}
                    >
                      <Crown className="w-3 h-3" /> {user.isAdmin ? "Remove Admin" : "Make Admin"}
                    </Button>
                  )}
                  {(!user.isAdmin || (amUltraAdmin && !user.isUltraAdmin)) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setProposeModal({ type: "strike", targetId: user.id, targetName: user.username, isSmallIssue: false, label: `Strike ${user.username} (${user.strikes + 1}/3)` }); setProposeReason(""); }}
                        className="gap-1 font-bold text-xs text-yellow-600 border-yellow-400"
                        data-testid={`button-strike-${user.id}`}
                      >
                        <AlertTriangle className="w-3 h-3" /> Strike
                      </Button>
                      {user.strikes > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setProposeModal({ type: "clear-strikes", targetId: user.id, targetName: user.username, isSmallIssue: true, label: `Clear Strikes for ${user.username}` }); setProposeReason(""); }}
                          className="gap-1 font-bold text-xs"
                          data-testid={`button-clear-strikes-${user.id}`}
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={user.banned ? "outline" : "destructive"}
                        onClick={() => { setProposeModal({ type: user.banned ? "unban" : "ban", targetId: user.id, targetName: user.username, isSmallIssue: false, label: user.banned ? `Unban ${user.username}` : `Ban ${user.username}` }); setProposeReason(""); }}
                        className="gap-1 font-bold text-xs"
                        data-testid={`button-ban-${user.id}`}
                      >
                        {user.banned ? "Unban" : "Ban"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setProposeModal({ type: "reset-progress", targetId: user.id, targetName: user.username, isSmallIssue: false, label: `Reset All Progress for ${user.username}` }); setProposeReason(""); }}
                        className="gap-1 font-bold text-xs text-orange-600 border-orange-400"
                        data-testid={`button-reset-${user.id}`}
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setProposeModal({ type: "delete", targetId: user.id, targetName: user.username, isSmallIssue: false, label: `Deactivate ${user.username}'s Account` }); setProposeReason(""); }}
                        className="gap-1 font-bold text-xs text-red-600 border-red-400"
                        data-testid={`button-deactivate-${user.id}`}
                      >
                        <UserX className="w-3 h-3" /> Deactivate
                      </Button>
                    </>
                  )}
                </>
              )}
              {!user.isDeleted && (
                <>
                  <Button size="sm" variant="outline" onClick={() => editing === user.id ? setEditing(null) : startEdit(user)} className="font-bold" data-testid={`button-edit-user-${user.id}`}>
                    {editing === user.id ? "Cancel" : "Edit"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setBossPanel(bossPanel === user.id ? null : user.id); setRewardPanel(null); setGivePanel(null); setSelectedBoss(""); setSelectedMutation("0"); }}
                    className="gap-1 font-bold text-xs text-blue-600 dark:text-blue-400 border-blue-400"
                    data-testid={`button-grant-boss-${user.id}`}
                  >
                    <Swords className="w-3 h-3" /> Boss Kill
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setRewardPanel(rewardPanel === user.id ? null : user.id); setBossPanel(null); setGivePanel(null); setSelectedReward(""); }}
                    className="gap-1 font-bold text-xs text-emerald-600 dark:text-emerald-400 border-emerald-400"
                    data-testid={`button-grant-reward-${user.id}`}
                  >
                    <Gift className="w-3 h-3" /> Reward Item
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setGivePanel(givePanel === user.id ? null : user.id); setBossPanel(null); setRewardPanel(null); setGiveBoxResults([]); }}
                    className="gap-1 font-bold text-xs text-violet-600 dark:text-violet-400 border-violet-400"
                    data-testid={`button-give-panel-${user.id}`}
                  >
                    <ShoppingBag className="w-3 h-3" /> Give
                  </Button>
                </>
              )}
              {!user.isDeleted && !(user.badges || []).includes("admins-favourite") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { if (confirm(`Give ${user.username} the Admin's Favourite badge + 500 coins?`)) grantFavourite.mutate(user.id); }}
                  className="gap-1 font-bold text-xs text-pink-600 dark:text-pink-400 border-pink-400"
                  disabled={grantFavourite.isPending}
                  data-testid={`button-grant-favourite-${user.id}`}
                >
                  <Heart className="w-3 h-3" /> Favourite
                </Button>
              )}
              {!user.isDeleted && (user.badges || []).includes("admins-favourite") && (
                <Badge className="bg-pink-500/20 text-pink-600 dark:text-pink-400 text-[10px] gap-0.5 border-pink-400/50">
                  <Heart className="w-2.5 h-2.5" /> Favourite
                </Badge>
              )}
              {!user.isDeleted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { if (confirm(`${user.isVip ? "Remove VIP from" : "Grant VIP to"} ${user.username}?`)) toggleVip.mutate(user.id); }}
                  className={`gap-1 font-bold text-xs ${user.isVip ? "text-amber-700 dark:text-amber-300 border-amber-500 bg-amber-500/10" : "text-amber-600 dark:text-amber-400 border-amber-400"}`}
                  disabled={toggleVip.isPending}
                  data-testid={`button-toggle-vip-${user.id}`}
                >
                  <Star className="w-3 h-3" /> {user.isVip ? "Remove VIP" : "Grant VIP"}
                </Button>
              )}
              {!user.isDeleted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setRenamePanel(renamePanel === user.id ? null : user.id); setTitlePanel(null); setRenameValue(user.displayName || user.username); }}
                  className="gap-1 font-bold text-xs text-orange-600 dark:text-orange-400 border-orange-400"
                  data-testid={`button-rename-${user.id}`}
                >
                  <Pencil className="w-3 h-3" /> Rename
                </Button>
              )}
              {!user.isDeleted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setTitlePanel(titlePanel === user.id ? null : user.id); setRenamePanel(null); const ct = user.equippedCosmetics?.title || ""; setTitleValue(ct.startsWith("custom:") ? ct.slice(7) : ""); }}
                  className="gap-1 font-bold text-xs text-purple-600 dark:text-purple-400 border-purple-400"
                  data-testid={`button-set-title-${user.id}`}
                >
                  <Crown className="w-3 h-3" /> Set Title
                </Button>
              )}
            </div>
          </div>

          {renamePanel === user.id && (
            <div className="mt-3 pt-3 border-t">
              <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2"><Pencil className="w-4 h-4 text-orange-500" /> Rename User</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="New display name..."
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  className="text-sm h-8"
                  maxLength={30}
                  data-testid={`input-rename-${user.id}`}
                />
                <Button
                  size="sm"
                  disabled={renameMutation.isPending || !renameValue.trim()}
                  onClick={() => renameMutation.mutate({ id: user.id, displayName: renameValue.trim() })}
                  className="gap-1 font-bold text-xs"
                  data-testid={`button-rename-submit-${user.id}`}
                >
                  {renameMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">This sets the user's display name (what others see). Username stays the same.</p>
            </div>
          )}

          {titlePanel === user.id && (
            <div className="mt-3 pt-3 border-t">
              <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2"><Crown className="w-4 h-4 text-purple-500" /> Set Custom Title</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Custom title text (leave empty to clear)..."
                  value={titleValue}
                  onChange={e => setTitleValue(e.target.value)}
                  className="text-sm h-8"
                  maxLength={30}
                  data-testid={`input-custom-title-${user.id}`}
                />
                <Button
                  size="sm"
                  disabled={setCustomTitleMutation.isPending}
                  onClick={() => setCustomTitleMutation.mutate({ id: user.id, title: titleValue.trim() })}
                  className="gap-1 font-bold text-xs"
                  data-testid={`button-custom-title-submit-${user.id}`}
                >
                  {setCustomTitleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Set
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Custom titles override any equipped title. They will glow with a purple animation.</p>
            </div>
          )}

          {editing === user.id && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">XP</label>
                  <Input type="number" value={editData.xp} onChange={e => setEditData(d => ({ ...d, xp: e.target.value }))} data-testid="input-edit-xp" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Neuros</label>
                  <Input type="number" value={editData.coins} onChange={e => setEditData(d => ({ ...d, coins: e.target.value }))} data-testid="input-edit-coins" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Sparks</label>
                  <Input type="number" value={editData.gems} onChange={e => setEditData(d => ({ ...d, gems: e.target.value }))} data-testid="input-edit-gems" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Rebirth</label>
                  <Input type="number" min="0" max="100" value={editData.rebirthLevel} onChange={e => setEditData(d => ({ ...d, rebirthLevel: e.target.value }))} data-testid="input-edit-rebirth" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">Badges</label>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 mt-1 space-y-1">
                  {BADGES.map(badge => {
                    const currentBadges = editData.badges.split(",").map(b => b.trim()).filter(Boolean);
                    const isSelected = currentBadges.includes(badge.id);
                    return (
                      <label key={badge.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const newBadges = isSelected
                              ? currentBadges.filter(b => b !== badge.id)
                              : [...currentBadges, badge.id];
                            setEditData(d => ({ ...d, badges: newBadges.join(", ") }));
                          }}
                          data-testid={`checkbox-badge-${badge.id}`}
                        />
                        <span className="font-semibold">{badge.name}</span>
                        <span className="text-muted-foreground">({badge.id})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <Button size="sm" onClick={() => saveEdit(user.id)} disabled={updateUser.isPending} className="gap-1 font-bold" data-testid="button-save-user">
                <Save className="w-3 h-3" /> Save Changes
              </Button>
            </div>
          )}

          {bossPanel === user.id && (
            <div className="mt-3 pt-3 border-t space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-1.5"><Swords className="w-4 h-4 text-blue-500" /> Grant Boss Kill</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Boss</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={selectedBoss}
                    onChange={e => setSelectedBoss(e.target.value)}
                    data-testid={`select-boss-${user.id}`}
                  >
                    <option value="">Select a boss...</option>
                    {ALL_BOSSES.map(b => {
                      const defeated = (user.bossesDefeated || {})[b.id] || 0;
                      return (
                        <option key={b.id} value={b.id}>
                          {b.name} {defeated > 0 ? `(defeated lv${defeated})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Mutation Level</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={selectedMutation}
                    onChange={e => setSelectedMutation(e.target.value)}
                    data-testid={`select-mutation-${user.id}`}
                  >
                    <option value="0">Base Form</option>
                    <option value="1">Mutation 1</option>
                    <option value="2">Omega Form</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => selectedBoss && grantBossKill.mutate({ id: user.id, bossId: selectedBoss, mutationLevel: parseInt(selectedMutation) })}
                  disabled={!selectedBoss || grantBossKill.isPending}
                  className="gap-1 font-bold"
                  data-testid={`button-confirm-boss-${user.id}`}
                >
                  <Swords className="w-3 h-3" /> Grant Kill
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => selectedBoss && sealBoss.mutate({ id: user.id, bossId: selectedBoss })}
                  disabled={!selectedBoss || sealBoss.isPending || !((user.bossesDefeated || {} as any)[selectedBoss])}
                  className="gap-1 font-bold"
                  data-testid={`button-seal-boss-${user.id}`}
                >
                  <Lock className="w-3 h-3" /> Seal Boss
                </Button>
              </div>
            </div>
          )}

          {rewardPanel === user.id && (
            <div className="mt-3 pt-3 border-t space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-1.5"><Gift className="w-4 h-4 text-emerald-500" /> Grant Reward Item</h4>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {REWARD_ITEMS.map(item => {
                  const owned = (user.inventory || []).includes(item.id);
                  return (
                    <label key={item.id} className={`flex items-center gap-2 text-xs p-1 rounded ${owned ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}`}>
                      <input
                        type="radio"
                        name={`reward-${user.id}`}
                        value={item.id}
                        checked={selectedReward === item.id}
                        onChange={() => setSelectedReward(item.id)}
                        disabled={owned}
                        data-testid={`radio-reward-${item.id}-${user.id}`}
                      />
                      <span className="font-semibold">{item.name}</span>
                      {owned && <Badge variant="outline" className="text-[9px] px-1 py-0">Owned</Badge>}
                    </label>
                  );
                })}
              </div>
              <Button
                size="sm"
                onClick={() => selectedReward && grantRewardItem.mutate({ id: user.id, itemId: selectedReward })}
                disabled={!selectedReward || grantRewardItem.isPending}
                className="gap-1 font-bold"
                data-testid={`button-confirm-reward-${user.id}`}
              >
                <Package className="w-3 h-3" /> Grant Item
              </Button>
            </div>
          )}

          {givePanel === user.id && (() => {
            const ITEM_CATEGORIES = ["all", ...Array.from(new Set(shopItems.map((i: any) => i.category)))];
            const filteredItems = shopItems.filter((item: any) => {
              const matchCat = giveItemCategory === "all" || item.category === giveItemCategory;
              const matchSearch = !giveItemSearch || item.name.toLowerCase().includes(giveItemSearch.toLowerCase()) || item.id.toLowerCase().includes(giveItemSearch.toLowerCase());
              return matchCat && matchSearch;
            });
            return (
              <div className="mt-3 pt-3 border-t space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-1.5"><ShoppingBag className="w-4 h-4 text-violet-500" /> Give Items</h4>
                <div className="flex gap-1">
                  {(["items", "boxes", "potions"] as const).map(tab => (
                    <Button key={tab} size="sm" variant={giveSubTab === tab ? "default" : "outline"} onClick={() => { setGiveSubTab(tab); setGiveBoxResults([]); }} className="text-xs capitalize flex-1">
                      {tab === "items" ? <><ShoppingBag className="w-3 h-3 mr-1" /> Shop Items</> : tab === "boxes" ? <><Package className="w-3 h-3 mr-1" /> Mystery Boxes</> : <><FlaskConical className="w-3 h-3 mr-1" /> Potions</>}
                    </Button>
                  ))}
                </div>

                {giveSubTab === "items" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search items..."
                          value={giveItemSearch}
                          onChange={e => setGiveItemSearch(e.target.value)}
                          className="pl-7 h-8 text-xs"
                          data-testid="input-give-item-search"
                        />
                      </div>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={giveItemCategory}
                        onChange={e => setGiveItemCategory(e.target.value)}
                        data-testid="select-give-item-category"
                      >
                        {ITEM_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat === "all" ? "All" : cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="max-h-52 overflow-y-auto border rounded-md divide-y">
                      {filteredItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No items found</p>}
                      {filteredItems.map((item: any) => {
                        const owned = (user.inventory || []).includes(item.id);
                        return (
                          <div key={item.id} className={`flex items-center justify-between px-2 py-1.5 ${owned ? "opacity-40" : "hover:bg-muted/40"}`}>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold truncate block">{item.name}</span>
                              <span className="text-[10px] text-muted-foreground">{item.category} · {item.rarity}</span>
                            </div>
                            {owned ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">Owned</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => giveShopItem.mutate({ id: user.id, itemId: item.id })}
                                disabled={giveShopItem.isPending}
                                className="text-[10px] h-6 px-2 shrink-0"
                                data-testid={`button-give-item-${item.id}-${user.id}`}
                              >
                                Give
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""} shown</p>
                  </div>
                )}

                {giveSubTab === "boxes" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[{ id: "bronze", label: "Bronze Box", emoji: "📦" }, { id: "silver", label: "Silver Box", emoji: "🥈" }, { id: "gold", label: "Gold Box", emoji: "🏆" }].map(box => (
                        <button
                          key={box.id}
                          onClick={() => setGiveBoxType(box.id)}
                          className={`rounded-lg border-2 p-2 text-center transition-all ${giveBoxType === box.id ? "border-violet-500 bg-violet-500/10" : "border-border hover:border-muted-foreground"}`}
                          data-testid={`button-box-type-${box.id}`}
                        >
                          <div className="text-lg mb-0.5">{box.emoji}</div>
                          <div className="text-xs font-bold">{box.label}</div>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground">Quantity</span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setGiveBoxQty(q => Math.max(1, q - 1))} className="h-7 w-7 p-0">−</Button>
                        <span className="w-8 text-center font-bold text-sm">{giveBoxQty}</span>
                        <Button size="sm" variant="outline" onClick={() => setGiveBoxQty(q => Math.min(20, q + 1))} className="h-7 w-7 p-0">+</Button>
                      </div>
                    </div>
                    {giveBoxResults.length > 0 && (
                      <div className="rounded-md bg-orange-500/10 border border-orange-500/20 p-2">
                        <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1.5">Box rewards given:</p>
                        <div className="flex flex-wrap gap-1">
                          {giveBoxResults.map((r, i) => (
                            <Badge key={i} className="text-[10px] bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30">{r.reward}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={() => { setGiveBoxResults([]); giveMysteryBox.mutate({ id: user.id, boxType: giveBoxType, quantity: giveBoxQty }); }}
                      disabled={giveMysteryBox.isPending}
                      className="gap-1 font-bold w-full"
                      data-testid={`button-give-box-${user.id}`}
                    >
                      {giveMysteryBox.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                      Open {giveBoxQty}× {giveBoxType.charAt(0).toUpperCase() + giveBoxType.slice(1)} Box
                    </Button>
                  </div>
                )}

                {giveSubTab === "potions" && (
                  <div className="space-y-3">
                    <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                      {POTIONS.map(potion => (
                        <label key={potion.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/40">
                          <input
                            type="radio"
                            name={`potion-${user.id}`}
                            value={potion.id}
                            checked={givePotionId === potion.id}
                            onChange={() => setGivePotionId(potion.id)}
                            data-testid={`radio-potion-${potion.id}-${user.id}`}
                          />
                          <span className="text-xs font-semibold flex-1">{potion.name}</span>
                          <span className="text-[10px] text-muted-foreground">{potion.description?.slice(0, 30)}...</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground">Quantity</span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setGivePotionQty(q => Math.max(1, q - 1))} className="h-7 w-7 p-0">−</Button>
                        <span className="w-8 text-center font-bold text-sm">{givePotionQty}</span>
                        <Button size="sm" variant="outline" onClick={() => setGivePotionQty(q => Math.min(50, q + 1))} className="h-7 w-7 p-0">+</Button>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => givePotionId && givePotion.mutate({ id: user.id, potionId: givePotionId, quantity: givePotionQty })}
                      disabled={!givePotionId || givePotion.isPending}
                      className="gap-1 font-bold w-full"
                      data-testid={`button-give-potion-${user.id}`}
                    >
                      {givePotion.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
                      Give {givePotionQty}× Potion
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      ))}

      {proposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-500" />
              <h2 className="font-black text-lg">Submit to Parliament</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{proposeModal.label}</span>
            </p>
            {!proposeModal.isSmallIssue && (
              <div className="flex items-center gap-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
                <AlertTriangle className="w-4 h-4 shrink-0" /> This is a major action — all admins must vote before the Speaker can approve it.
              </div>
            )}
            {proposeModal.isSmallIssue && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                <Scale className="w-4 h-4 shrink-0" /> Minor action — the Speaker can approve this alone.
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Reason / Description</label>
              <Textarea
                value={proposeReason}
                onChange={e => setProposeReason(e.target.value)}
                placeholder="Explain why this action is needed..."
                rows={3}
                data-testid="input-propose-reason"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setProposeModal(null)}>Cancel</Button>
              <Button
                disabled={!proposeReason.trim() || createProposal.isPending}
                onClick={() => createProposal.mutate({
                  type: proposeModal.type,
                  targetId: proposeModal.targetId,
                  targetName: proposeModal.targetName,
                  actionData: proposeModal.actionData ?? {},
                  description: `[${proposeModal.label}] ${proposeReason.trim()}`,
                  isSmallIssue: proposeModal.isSmallIssue,
                })}
                data-testid="button-submit-proposal"
              >
                {createProposal.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Proposal
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ParliamentTab({ amUltraAdmin, currentUserId }: { amUltraAdmin: boolean; currentUserId: number }) {
  const { toast } = useToast();
  const [showHistory, setShowHistory] = useState(false);
  const [voteModal, setVoteModal] = useState<{ id: number; targetName: string; description: string } | null>(null);
  const [voteChoice, setVoteChoice] = useState<"yes" | "no">("yes");
  const [voteComment, setVoteComment] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);

  const { data: proposals = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/proposals"],
    refetchInterval: 15000,
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, vote, comment }: { id: number; vote: string; comment: string }) =>
      apiRequest("POST", `/api/admin/proposals/${id}/vote`, { vote, comment }),
    onSuccess: () => {
      toast({ title: "Vote recorded!" });
      setVoteModal(null);
      setVoteComment("");
      refetch();
    },
    onError: (e: any) => toast({ title: "Failed to vote", variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: string }) =>
      apiRequest("POST", `/api/admin/proposals/${id}/resolve`, { decision }),
    onSuccess: () => {
      toast({ title: "Proposal resolved!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      refetch();
    },
    onError: (e: any) => toast({ title: "Failed to resolve", description: (e as any)?.message, variant: "destructive" }),
  });

  const transferMutation = useMutation({
    mutationFn: (targetUsername: string) =>
      apiRequest("POST", "/api/admin/transfer-ultra-admin", { targetUsername }),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Ultra Admin transferred to ${data.newUltraAdmin}!`, description: "You no longer hold this status." });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowTransfer(false);
      setTransferTarget("");
    },
    onError: (e: any) => toast({ title: "Transfer failed", description: e.message, variant: "destructive" }),
  });

  const pending = proposals.filter((p: any) => p.status === "pending");
  const resolved = proposals.filter((p: any) => p.status !== "pending");

  function getVoteSummary(votes: Record<string, any>) {
    const entries = Object.values(votes || {});
    const yes = entries.filter((v: any) => v.vote === "yes").length;
    const no = entries.filter((v: any) => v.vote === "no").length;
    return { yes, no, total: entries.length };
  }

  function typeLabel(type: string) {
    const map: Record<string, string> = {
      ban: "Ban User", unban: "Unban User", strike: "Strike User",
      "clear-strikes": "Clear Strikes", "reset-progress": "Reset Progress",
      delete: "Deactivate Account", "permanent-delete": "Permanently Delete",
      "toggle-admin": "Toggle Admin Status",
    };
    return map[type] || type;
  }

  function statusColor(status: string) {
    if (status === "approved") return "bg-green-500";
    if (status === "rejected") return "bg-red-500";
    return "bg-yellow-500";
  }

  if (isLoading) return <p className="text-muted-foreground">Loading Parliament...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2"><Scale className="w-5 h-5 text-blue-500" /> Admin Parliament</h2>
          <p className="text-sm text-muted-foreground">All major decisions are voted on before taking effect. The Ultra Admin (Speaker) has final say.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-1">
            <History className="w-4 h-4" /> {showHistory ? "Hide History" : "View History"}
          </Button>
          {amUltraAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowTransfer(!showTransfer)} className="gap-1 text-orange-600 border-orange-400">
              <ArrowRightLeft className="w-4 h-4" /> Transfer Speaker Role
            </Button>
          )}
        </div>
      </div>

      {amUltraAdmin && showTransfer && (
        <Card className="p-4 space-y-3 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20">
          <p className="font-bold text-sm flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Transfer Ultra Admin (Speaker) Role</p>
          <p className="text-xs text-muted-foreground">You will permanently lose the Speaker role and all its privileges. The target must already be an admin.</p>
          <div className="flex gap-2">
            <Input value={transferTarget} onChange={e => setTransferTarget(e.target.value)} placeholder="Target admin username" className="flex-1" data-testid="input-transfer-target" />
            <Button
              variant="destructive"
              disabled={!transferTarget.trim() || transferMutation.isPending}
              onClick={() => { if (confirm(`Transfer Speaker role to ${transferTarget}? You CANNOT undo this!`)) transferMutation.mutate(transferTarget.trim()); }}
              data-testid="button-confirm-transfer"
            >
              {transferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Transfer"}
            </Button>
          </div>
        </Card>
      )}

      <div>
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-white text-xs font-black">{pending.length}</span>
          Pending Proposals
        </h3>
        {pending.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Scale className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No pending proposals</p>
            <p className="text-sm">All major actions from the Users tab will appear here for voting.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((p: any) => {
              const voteData = p.votes as Record<string, any> || {};
              const { yes, no, total } = getVoteSummary(voteData);
              const myVote = voteData[String(currentUserId)];
              return (
                <Card key={p.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-yellow-500 text-white text-xs">{typeLabel(p.type)}</Badge>
                        {p.is_small_issue && <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">Minor Issue</Badge>}
                        {!p.is_small_issue && <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">Major Issue</Badge>}
                        <span className="text-xs text-muted-foreground">#{p.id}</span>
                      </div>
                      <p className="font-semibold text-sm">Target: <span className="text-blue-600 dark:text-blue-400">{p.target_name || "—"}</span></p>
                      <p className="text-sm text-muted-foreground">{p.description}</p>
                      <p className="text-xs text-muted-foreground">Proposed by <span className="font-medium">{p.created_by_name}</span> · {new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right space-y-1 shrink-0">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs font-bold text-green-600 flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{yes}</span>
                        <span className="text-xs font-bold text-red-600 flex items-center gap-1"><ThumbsDown className="w-3 h-3" />{no}</span>
                        <span className="text-xs text-muted-foreground">({total} vote{total !== 1 ? "s" : ""})</span>
                      </div>
                      {myVote && (
                        <p className="text-xs text-muted-foreground">Your vote: <span className={`font-bold ${myVote.vote === "yes" ? "text-green-600" : "text-red-600"}`}>{myVote.vote === "yes" ? "✓ Yes" : "✗ No"}</span></p>
                      )}
                    </div>
                  </div>

                  {Object.keys(voteData).length > 0 && (
                    <div className="rounded-md bg-muted/50 p-2 space-y-1">
                      {Object.values(voteData).map((v: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`font-bold shrink-0 ${v.vote === "yes" ? "text-green-600" : "text-red-600"}`}>{v.vote === "yes" ? "✓" : "✗"} {v.username}</span>
                          {v.comment && <span className="text-muted-foreground">— {v.comment}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-green-600 border-green-400"
                      onClick={() => { setVoteModal({ id: p.id, targetName: p.target_name, description: p.description }); setVoteChoice("yes"); setVoteComment(""); }}
                      data-testid={`button-vote-yes-${p.id}`}
                    >
                      <ThumbsUp className="w-3 h-3" /> Vote Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-red-600 border-red-400"
                      onClick={() => { setVoteModal({ id: p.id, targetName: p.target_name, description: p.description }); setVoteChoice("no"); setVoteComment(""); }}
                      data-testid={`button-vote-no-${p.id}`}
                    >
                      <ThumbsDown className="w-3 h-3" /> Vote No
                    </Button>
                    {amUltraAdmin && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                          disabled={resolveMutation.isPending}
                          onClick={() => { if (confirm(`Approve and EXECUTE proposal #${p.id}? This will immediately apply the action.`)) resolveMutation.mutate({ id: p.id, decision: "approve" }); }}
                          data-testid={`button-resolve-approve-${p.id}`}
                        >
                          <CheckCircle className="w-3 h-3" /> Speaker Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-red-600 border-red-400"
                          disabled={resolveMutation.isPending}
                          onClick={() => { if (confirm(`Reject proposal #${p.id}? The action will NOT be taken.`)) resolveMutation.mutate({ id: p.id, decision: "reject" }); }}
                          data-testid={`button-resolve-reject-${p.id}`}
                        >
                          <XCircle className="w-3 h-3" /> Speaker Reject
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showHistory && (
        <div>
          <h3 className="font-bold text-base mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Resolved Proposals</h3>
          {resolved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resolved proposals yet.</p>
          ) : (
            <div className="space-y-2">
              {resolved.map((p: any) => {
                const { yes, no } = getVoteSummary(p.votes as any);
                return (
                  <Card key={p.id} className="p-3 opacity-80 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block w-2 h-2 rounded-full ${statusColor(p.status)}`} />
                      <span className="text-xs font-bold uppercase">{p.status}</span>
                      <Badge variant="outline" className="text-xs">{typeLabel(p.type)}</Badge>
                      <span className="text-xs text-muted-foreground">#{p.id} · {p.target_name || "—"}</span>
                      <span className="text-xs text-green-600 flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" />{yes}</span>
                      <span className="text-xs text-red-600 flex items-center gap-0.5"><ThumbsDown className="w-3 h-3" />{no}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                    {p.resolved_by_name && <p className="text-xs text-muted-foreground">Resolved by <span className="font-medium">{p.resolved_by_name}</span> · {p.resolved_at ? new Date(p.resolved_at).toLocaleDateString() : "—"}</p>}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {voteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              {voteChoice === "yes" ? <ThumbsUp className="w-5 h-5 text-green-500" /> : <ThumbsDown className="w-5 h-5 text-red-500" />}
              <h2 className="font-black text-lg">Cast Your Vote</h2>
            </div>
            <p className="text-sm text-muted-foreground">{voteModal.description}</p>
            <div className="flex gap-2">
              <Button size="sm" variant={voteChoice === "yes" ? "default" : "outline"} className="flex-1 gap-1" onClick={() => setVoteChoice("yes")}><ThumbsUp className="w-4 h-4" /> Yes</Button>
              <Button size="sm" variant={voteChoice === "no" ? "destructive" : "outline"} className="flex-1 gap-1" onClick={() => setVoteChoice("no")}><ThumbsDown className="w-4 h-4" /> No</Button>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Comment (optional)</label>
              <Textarea value={voteComment} onChange={e => setVoteComment(e.target.value)} placeholder="Share your perspective..." rows={2} data-testid="input-vote-comment" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setVoteModal(null)}>Cancel</Button>
              <Button
                disabled={voteMutation.isPending}
                className={voteChoice === "yes" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
                onClick={() => voteMutation.mutate({ id: voteModal.id, vote: voteChoice, comment: voteComment })}
                data-testid="button-submit-vote"
              >
                {voteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Vote"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function DailyTab() {
  const { toast } = useToast();
  const [gameId, setGameId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetScore, setTargetScore] = useState("100");
  const [xpReward, setXpReward] = useState("50");

  const gameOptions = [
    { id: "gravity-dash", name: "Gravity Dash" },
    { id: "dna-decoder", name: "DNA Decoder" },
    { id: "circuit-crafter", name: "Circuit Crafter" },
    { id: "chemistry-mixer", name: "Chemistry Mixer" },
    { id: "time-travel-scientist", name: "Time Travel Scientist" },
    { id: "element-arena", name: "Element Arena" },
    { id: "ecosystem-builder", name: "Ecosystem Builder" },
    { id: "physics-puzzle-rooms", name: "Physics Puzzle Rooms" },
    { id: "weather-commander", name: "Weather Commander" },
    { id: "microbe-defender", name: "Microbe Defender" },
    { id: "boss-challenge", name: "Boss Challenge" },
    { id: "lab-experiment", name: "Lab Experiment" },
    { id: "community-play", name: "Community Play" },
  ];

  const setChallenge = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/daily-challenge", {
      gameId,
      title,
      description,
      targetScore: parseInt(targetScore) || 100,
      xpReward: parseInt(xpReward) || 50,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-challenge"] });
      toast({ title: "Daily challenge set!" });
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not set daily challenge", variant: "destructive" });
    },
  });

  const selectGame = (id: string) => {
    setGameId(id);
    const game = gameOptions.find(g => g.id === id);
    if (game) {
      setTitle(`${game.name} Challenge`);
      setDescription(`Complete the ${game.name.toLowerCase()} challenge to earn bonus XP!`);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <RefreshCw className="w-5 h-5" /> Set Today's Daily Challenge
      </h2>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-muted-foreground">Game</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {gameOptions.map(g => (
              <Button
                key={g.id}
                size="sm"
                variant={gameId === g.id ? "default" : "outline"}
                onClick={() => selectGame(g.id)}
                className="text-xs font-bold"
                data-testid={`button-game-${g.id}`}
              >
                {g.name}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground">Title</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} data-testid="input-daily-title" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground">Description</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} data-testid="input-daily-desc" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground">Target Score</label>
            <Input type="number" value={targetScore} onChange={e => setTargetScore(e.target.value)} data-testid="input-daily-score" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">XP Reward</label>
            <Input type="number" value={xpReward} onChange={e => setXpReward(e.target.value)} data-testid="input-daily-xp" />
          </div>
        </div>
        <Button
          onClick={() => setChallenge.mutate()}
          disabled={!gameId || !title || setChallenge.isPending}
          className="gap-2 font-bold w-full"
          data-testid="button-set-daily"
        >
          <Crown className="w-4 h-4" /> Set Daily Challenge
        </Button>
      </div>
    </Card>
  );
}

function TournamentsTab() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questionSource, setQuestionSource] = useState<"topic" | "custom" | "community">("topic");
  const [topic, setTopic] = useState("");
  const [gameMode, setGameMode] = useState("quiz");
  const [scope, setScope] = useState("individual");
  const [status, setStatus] = useState("active");
  const [startAt, setStartAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [xpReward, setXpReward] = useState("100");
  const [coinReward, setCoinReward] = useState("50");
  const [gemReward, setGemReward] = useState("5");
  const [communityPackId, setCommunityPackId] = useState("");
  const [arcadeGameId, setArcadeGameId] = useState("");
  const [questions, setQuestions] = useState<{ question: string; options: string[]; correctIndex: number }[]>([]);
  const [newQ, setNewQ] = useState("");
  const [newOpts, setNewOpts] = useState(["", "", "", ""]);
  const [newCorrect, setNewCorrect] = useState(0);

  const TOPICS = [
    { key: "space", label: "Space & Astronomy" },
    { key: "biology", label: "Biology & Life Science" },
    { key: "chemistry", label: "Chemistry & Elements" },
    { key: "physics", label: "Physics & Forces" },
    { key: "earth", label: "Earth Science & Geology" },
    { key: "animals", label: "Animals & Ecosystems" },
    { key: "human-body", label: "Human Body & Health" },
    { key: "energy", label: "Energy & Electricity" },
    { key: "weather", label: "Weather & Climate" },
    { key: "ocean", label: "Oceans & Marine Life" },
  ];

  const TOURNAMENT_MODES = [
    { key: "quiz", label: "Quiz Showdown" },
    { key: "speed-round", label: "Speed Round" },
    { key: "survival", label: "Survival Challenge" },
    { key: "boss-rush", label: "Boss Rush" },
    { key: "lab-challenge", label: "Lab Challenge" },
    { key: "element-hunt", label: "Element Hunt" },
    { key: "duel", label: "1v1 Duel Bracket" },
    { key: "arcade", label: "Arcade Game Tournament" },
  ];

  const { data: tournaments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/tournaments"],
  });

  const { data: approvedPacks = [] } = useQuery<any[]>({
    queryKey: ["/api/community/packs"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        title,
        description,
        gameMode,
        scope: gameMode === "duel" ? "individual" : scope,
        format: gameMode === "duel" ? "elimination" : undefined,
        status,
        xpReward: parseInt(xpReward) || 100,
        coinReward: parseInt(coinReward) || 50,
        gemReward: parseInt(gemReward) || 5,
      };
      if (startAt) body.startTime = new Date(startAt).toISOString();
      if (endsAt) body.endTime = new Date(endsAt).toISOString();
      if (gameMode === "arcade") {
        body.questions = [{ gameId: arcadeGameId }];
        body.type = "admin";
      } else if (questionSource === "topic") {
        body.topic = topic;
        body.type = "admin";
      } else if (questionSource === "custom") {
        body.questions = questions;
        body.type = "admin";
      } else {
        body.type = "community";
        body.packId = parseInt(communityPackId);
      }
      await apiRequest("POST", "/api/tournaments", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      toast({ title: "Tournament Created!", description: title });
      setTitle(""); setDescription(""); setQuestions([]); setEndsAt(""); setStartAt(""); setTopic(""); setArcadeGameId("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/tournaments/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      toast({ title: "Tournament Deleted" });
    },
  });

  const addQuestion = () => {
    if (!newQ.trim() || newOpts.some(o => !o.trim())) return;
    setQuestions([...questions, { question: newQ, options: [...newOpts], correctIndex: newCorrect }]);
    setNewQ(""); setNewOpts(["", "", "", ""]); setNewCorrect(0);
  };

  const canCreate = title && !createMutation.isPending && (
    (gameMode === "arcade" && arcadeGameId) ||
    (gameMode !== "arcade" && (
      (questionSource === "topic" && topic) ||
      (questionSource === "custom" && questions.length >= 3) ||
      (questionSource === "community" && communityPackId)
    ))
  );

  return (
    <Card className="p-6">
      <h2 className="text-xl font-black mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-500" /> Create Tournament
      </h2>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground">Title</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tournament title..." data-testid="input-tournament-name" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground">Description</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this tournament about?" data-testid="input-tournament-desc" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground">Game Mode</label>
            <select className="w-full border rounded-md p-2 mt-1 bg-background text-sm" value={gameMode} onChange={e => setGameMode(e.target.value)} data-testid="select-game-mode">
              {TOURNAMENT_MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Scope</label>
            <select className="w-full border rounded-md p-2 mt-1 bg-background text-sm" value={gameMode === "duel" ? "individual" : scope} onChange={e => setScope(e.target.value)} disabled={gameMode === "duel"} data-testid="select-scope">
              <option value="individual">Individual</option>
              <option value="team">Team</option>
            </select>
            {gameMode === "duel" && <p className="text-xs text-muted-foreground mt-1">Duel brackets are always 1v1 individual tournaments.</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground">Status</label>
            <select className="w-full border rounded-md p-2 mt-1 bg-background text-sm" value={status} onChange={e => setStatus(e.target.value)} data-testid="select-status">
              <option value="active">Active (play now)</option>
              <option value="upcoming">Upcoming (scheduled)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Ends At (optional)</label>
            <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} data-testid="input-tournament-ends" />
          </div>
        </div>

        {status === "upcoming" && (
          <div>
            <label className="text-xs font-bold text-muted-foreground">Starts At</label>
            <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} data-testid="input-tournament-start" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3" /> XP Reward</label>
            <Input type="number" value={xpReward} onChange={e => setXpReward(e.target.value)} data-testid="input-xp-reward" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Coins className="w-3 h-3" /> Neuro Reward</label>
            <Input type="number" value={coinReward} onChange={e => setCoinReward(e.target.value)} data-testid="input-coin-reward" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Gem className="w-3 h-3" /> Spark Reward</label>
            <Input type="number" value={gemReward} onChange={e => setGemReward(e.target.value)} data-testid="input-gem-reward" />
          </div>
        </div>

        {gameMode === "arcade" ? (
          <div>
            <label className="text-xs font-bold text-muted-foreground">Arcade Game</label>
            <select className="w-full border rounded-md p-2 mt-1 bg-background text-sm" value={arcadeGameId} onChange={e => setArcadeGameId(e.target.value)} data-testid="select-arcade-game">
              <option value="">Select an arcade game...</option>
              {ARCADE_GAME_MODES.filter(g => !g.isSecret).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Players compete by playing this arcade game — highest score wins!</p>
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold text-muted-foreground">Question Source</label>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant={questionSource === "topic" ? "default" : "outline"} onClick={() => setQuestionSource("topic")} data-testid="button-source-topic">Pick a Topic</Button>
              <Button size="sm" variant={questionSource === "custom" ? "default" : "outline"} onClick={() => setQuestionSource("custom")} data-testid="button-source-custom">Custom Questions</Button>
              <Button size="sm" variant={questionSource === "community" ? "default" : "outline"} onClick={() => setQuestionSource("community")} data-testid="button-source-community">Community Pack</Button>
            </div>
          </div>
        )}

        {gameMode !== "arcade" && questionSource === "topic" && (
          <div>
            <label className="text-xs font-bold text-muted-foreground">Science Topic (8 questions auto-loaded)</label>
            <select className="w-full border rounded-md p-2 mt-1 bg-background text-sm" value={topic} onChange={e => setTopic(e.target.value)} data-testid="select-topic">
              <option value="">Select a topic...</option>
              {TOPICS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        )}

        {gameMode !== "arcade" && questionSource === "community" && (
          <div>
            <label className="text-xs font-bold text-muted-foreground">Community Pack</label>
            <select
              className="w-full border rounded-md p-2 mt-1 bg-background text-sm"
              value={communityPackId}
              onChange={e => setCommunityPackId(e.target.value)}
              data-testid="select-tournament-pack"
            >
              <option value="">Select a pack...</option>
              {approvedPacks.filter((p: any) => p.approved).map((p: any) => (
                <option key={p.id} value={p.id}>{p.title} ({p.questions?.length || 0} questions)</option>
              ))}
            </select>
          </div>
        )}

        {gameMode !== "arcade" && questionSource === "custom" && (
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Questions ({questions.length} added, need 3+)
            </h3>
            <Input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Question text..." data-testid="input-q-text" />
            <div className="grid grid-cols-2 gap-2">
              {newOpts.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={newCorrect === i}
                    onChange={() => setNewCorrect(i)}
                    data-testid={`radio-correct-${i}`}
                  />
                  <Input
                    value={opt}
                    onChange={e => { const n = [...newOpts]; n[i] = e.target.value; setNewOpts(n); }}
                    placeholder={`Option ${i + 1}`}
                    className={newCorrect === i ? "border-green-500" : ""}
                    data-testid={`input-opt-${i}`}
                  />
                </div>
              ))}
            </div>
            <Button size="sm" onClick={addQuestion} className="gap-2" data-testid="button-add-question">
              <Plus className="w-3 h-3" /> Add Question
            </Button>
            {questions.length > 0 && (
              <div className="space-y-1 mt-2">
                {questions.map((q, i) => (
                  <div key={i} className="text-xs p-2 bg-muted rounded flex justify-between items-center">
                    <span className="font-medium">{i + 1}. {q.question}</span>
                    <Button size="sm" variant="ghost" onClick={() => setQuestions(questions.filter((_, j) => j !== i))} data-testid={`button-remove-q-${i}`}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Button
          onClick={() => createMutation.mutate()}
          disabled={!canCreate}
          className="gap-2 font-bold w-full"
          data-testid="button-create-tournament"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
          Create Tournament
        </Button>
      </div>

      <div className="mt-8">
        <h3 className="font-bold mb-3">All Tournaments ({tournaments.length})</h3>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : tournaments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tournaments yet. Create one above!</p>
        ) : (
          <div className="space-y-2">
            {tournaments.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`tournament-item-${t.id}`}>
                <div className="min-w-0 flex-1">
                  <span className="font-bold">{t.title}</span>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={t.status === "active" ? "default" : "outline"} className="text-[10px]">{t.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{t.gameMode}</Badge>
                    <Badge variant="outline" className="text-[10px]">{t.scope}</Badge>
                    {t.endTime && <span className="text-[10px] text-muted-foreground"><Clock className="w-3 h-3 inline" /> Ends {new Date(t.endTime).toLocaleDateString()}</span>}
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(t.id)} data-testid={`button-delete-tournament-${t.id}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

const GT_CATEGORIES = [
  { key: "general", label: "General Science" },
  { key: "space", label: "Space & Astronomy" },
  { key: "biology", label: "Biology & Life Science" },
  { key: "chemistry", label: "Chemistry & Elements" },
  { key: "physics", label: "Physics & Forces" },
  { key: "earth", label: "Earth Science & Geology" },
  { key: "animals", label: "Animals & Ecosystems" },
  { key: "human-body", label: "Human Body & Health" },
  { key: "energy", label: "Energy & Electricity" },
  { key: "weather", label: "Weather & Climate" },
  { key: "ocean", label: "Oceans & Marine Life" },
];

function GTQuestionsTab() {
  const { toast } = useToast();
  const [newQ, setNewQ] = useState("");
  const [newOpts, setNewOpts] = useState(["", "", "", ""]);
  const [newCorrect, setNewCorrect] = useState(0);
  const [newCategory, setNewCategory] = useState("general");
  const [newYearLevel, setNewYearLevel] = useState(0);
  const [filterCategory, setFilterCategory] = useState("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editOpts, setEditOpts] = useState(["", "", "", ""]);
  const [editCorrect, setEditCorrect] = useState(0);
  const [editCategory, setEditCategory] = useState("general");
  const [editYearLevel, setEditYearLevel] = useState(0);

  const { data: questions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/gt-questions"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/gt-questions", {
        question: newQ,
        options: newOpts,
        correctIndex: newCorrect,
        category: newCategory,
        yearLevel: newYearLevel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gt-questions"] });
      toast({ title: "Question Added!" });
      setNewQ("");
      setNewOpts(["", "", "", ""]);
      setNewCorrect(0);
      setNewYearLevel(0);
    },
    onError: () => toast({ title: "Failed to add question", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PUT", `/api/admin/gt-questions/${id}`, {
        question: editQ,
        options: editOpts,
        correctIndex: editCorrect,
        category: editCategory,
        yearLevel: editYearLevel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gt-questions"] });
      toast({ title: "Question Updated!" });
      setEditingId(null);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      await apiRequest("PUT", `/api/admin/gt-questions/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gt-questions"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/gt-questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gt-questions"] });
      toast({ title: "Question Deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const startEdit = (q: any) => {
    setEditingId(q.id);
    setEditQ(q.question);
    setEditOpts([...q.options]);
    setEditCorrect(q.correctIndex);
    setEditCategory(q.category || "general");
    setEditYearLevel(q.yearLevel ?? 0);
  };

  const filtered = filterCategory === "all" ? questions : questions.filter((q: any) => q.category === filterCategory);
  const activeCount = questions.filter((q: any) => q.active).length;
  const canAdd = newQ.trim() && newOpts.every((o: string) => o.trim());

  return (
    <Card className="p-6 bg-card border-2 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Swords className="w-5 h-5 text-purple-500" /> Grand Tournament Questions
        </h2>
        <Badge variant="outline" className="text-sm" data-testid="badge-gt-question-count">
          {activeCount} active / {questions.length} total
        </Badge>
      </div>

      <Card className="p-4 bg-muted/30 border space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add New Question</h3>
        <Input
          placeholder="Question text..."
          value={newQ}
          onChange={e => setNewQ(e.target.value)}
          data-testid="input-gt-new-question"
        />
        <div className="grid grid-cols-2 gap-2">
          {newOpts.map((opt, i) => (
            <div key={i} className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={newCorrect === i ? "default" : "outline"}
                onClick={() => setNewCorrect(i)}
                className={`min-w-[32px] text-xs ${newCorrect === i ? "bg-green-600 hover:bg-green-700" : ""}`}
                data-testid={`button-gt-correct-${i}`}
              >
                {String.fromCharCode(65 + i)}
              </Button>
              <Input
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                value={opt}
                onChange={e => {
                  const updated = [...newOpts];
                  updated[i] = e.target.value;
                  setNewOpts(updated);
                }}
                className="text-sm"
                data-testid={`input-gt-option-${i}`}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-background"
            data-testid="select-gt-category"
          >
            {GT_CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <select
            value={newYearLevel}
            onChange={e => setNewYearLevel(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm bg-background"
            data-testid="select-gt-year-level"
          >
            <option value={0}>All Year Levels</option>
            {[3, 4, 5, 6, 7, 8].map(y => (
              <option key={y} value={y}>Year {y}</option>
            ))}
          </select>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canAdd || createMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 gap-1"
            data-testid="button-gt-add-question"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Question
          </Button>
        </div>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-muted-foreground">Filter:</span>
        <Button
          size="sm"
          variant={filterCategory === "all" ? "default" : "outline"}
          onClick={() => setFilterCategory("all")}
          className="text-xs"
          data-testid="button-gt-filter-all"
        >
          All ({questions.length})
        </Button>
        {GT_CATEGORIES.map(c => {
          const count = questions.filter((q: any) => q.category === c.key).length;
          if (count === 0) return null;
          return (
            <Button
              key={c.key}
              size="sm"
              variant={filterCategory === c.key ? "default" : "outline"}
              onClick={() => setFilterCategory(c.key)}
              className="text-xs"
              data-testid={`button-gt-filter-${c.key}`}
            >
              {c.label} ({count})
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">No questions yet. Add some above!</p>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.map((q: any) => (
            <div
              key={q.id}
              className={`p-3 border rounded-lg space-y-2 ${q.active ? "bg-card" : "bg-muted/50 opacity-60"}`}
              data-testid={`gt-question-item-${q.id}`}
            >
              {editingId === q.id ? (
                <div className="space-y-2">
                  <Input value={editQ} onChange={e => setEditQ(e.target.value)} data-testid="input-gt-edit-question" />
                  <div className="grid grid-cols-2 gap-2">
                    {editOpts.map((opt, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={editCorrect === i ? "default" : "outline"}
                          onClick={() => setEditCorrect(i)}
                          className={`min-w-[32px] text-xs ${editCorrect === i ? "bg-green-600 hover:bg-green-700" : ""}`}
                        >
                          {String.fromCharCode(65 + i)}
                        </Button>
                        <Input
                          value={opt}
                          onChange={e => {
                            const updated = [...editOpts];
                            updated[i] = e.target.value;
                            setEditOpts(updated);
                          }}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      className="border rounded px-2 py-1 text-sm bg-background"
                    >
                      {GT_CATEGORIES.map(c => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                    <select
                      value={editYearLevel}
                      onChange={e => setEditYearLevel(Number(e.target.value))}
                      className="border rounded px-2 py-1 text-sm bg-background"
                    >
                      <option value={0}>All Year Levels</option>
                      {[3, 4, 5, 6, 7, 8].map(y => (
                        <option key={y} value={y}>Year {y}</option>
                      ))}
                    </select>
                    <Button size="sm" onClick={() => updateMutation.mutate(q.id)} disabled={updateMutation.isPending} className="bg-green-600 hover:bg-green-700 gap-1">
                      <Save className="w-3 h-3" /> Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{q.question}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {q.options.map((opt: string, i: number) => (
                          <Badge
                            key={i}
                            variant={i === q.correctIndex ? "default" : "outline"}
                            className={`text-[10px] ${i === q.correctIndex ? "bg-green-600" : ""}`}
                          >
                            {String.fromCharCode(65 + i)}: {opt}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{q.category}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${(q.yearLevel ?? 0) === 0 ? "border-blue-400 text-blue-600 dark:text-blue-400" : "border-green-400 text-green-600 dark:text-green-400"}`}>
                          {(q.yearLevel ?? 0) === 0 ? "All Years" : `Year ${q.yearLevel}`}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">by {q.createdBy}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleMutation.mutate({ id: q.id, active: !q.active })}
                        className={`text-xs ${q.active ? "text-green-600" : "text-red-500"}`}
                        data-testid={`button-gt-toggle-${q.id}`}
                      >
                        {q.active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(q)} data-testid={`button-gt-edit-${q.id}`}>
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(q.id)} data-testid={`button-gt-delete-${q.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const WORLD_OPTIONS = WORLDS.map(w => ({ id: w.id, name: w.name }));

const MYSTERY_BOX_OPTIONS = [
  { id: "bronze", label: "Bronze Box", emoji: "📦" },
  { id: "silver", label: "Silver Box", emoji: "🥈" },
  { id: "gold", label: "Gold Box", emoji: "🏆" },
];

interface CodeEntry {
  id: number;
  code: string;
  coinReward: number;
  gemReward: number;
  xpReward: number;
  mysteryBoxReward: number;
  mysteryBoxType: string;
  itemRewards: string[];
  worldRewards: string[];
  potionRewards: string[];
  message: string | null;
  maxUses: number;
  currentUses: number;
  isFree: boolean;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

function CodesTab() {
  const { toast } = useToast();
  const [newCode, setNewCode] = useState("");
  const [coinReward, setCoinReward] = useState("0");
  const [gemReward, setGemReward] = useState("0");
  const [xpReward, setXpReward] = useState("0");
  const [mysteryBoxReward, setMysteryBoxReward] = useState("0");
  const [mysteryBoxType, setMysteryBoxType] = useState("bronze");
  const [maxUses, setMaxUses] = useState("1");
  const [unlimited, setUnlimited] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedWorlds, setSelectedWorlds] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [itemCategory, setItemCategory] = useState("all");
  const [potionQuantities, setPotionQuantities] = useState<Record<string, number>>({});

  const { data: codes = [], isLoading } = useQuery<CodeEntry[]>({
    queryKey: ["/api/admin/codes"],
  });
  const { data: allShopItems = [] } = useQuery<{ id: string; name: string; category: string; rarity: string }[]>({
    queryKey: ["/api/shop"],
  });

  const toggleItem = (id: string) =>
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleWorld = (id: string) =>
    setSelectedWorlds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const shopCategories = ["all", ...Array.from(new Set(allShopItems.map(i => i.category))).sort()];
  const filteredShopItems = allShopItems.filter(i => {
    const matchCat = itemCategory === "all" || i.category === itemCategory;
    const matchSearch = !itemSearch.trim() || i.name.toLowerCase().includes(itemSearch.toLowerCase()) || i.id.toLowerCase().includes(itemSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const setPotionQty = (id: string, delta: number) => {
    setPotionQuantities(prev => {
      const next = Math.max(0, (prev[id] || 0) + delta);
      if (next === 0) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: next };
    });
  };

  const buildPotionRewardsArray = () => {
    const result: string[] = [];
    for (const [id, qty] of Object.entries(potionQuantities)) {
      for (let i = 0; i < qty; i++) result.push(id);
    }
    return result;
  };

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/codes", {
      code: newCode,
      coinReward: Number(coinReward),
      gemReward: Number(gemReward),
      xpReward: Number(xpReward),
      mysteryBoxReward: Number(mysteryBoxReward),
      mysteryBoxType,
      itemRewards: selectedItems,
      worldRewards: selectedWorlds,
      potionRewards: buildPotionRewardsArray(),
      message: message.trim() || null,
      unlimited,
      maxUses: Number(maxUses),
      expiresAt: expiresAt || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes"] });
      setNewCode(""); setCoinReward("0"); setGemReward("0");
      setXpReward("0"); setMysteryBoxReward("0"); setMaxUses("1");
      setUnlimited(false); setExpiresAt(""); setMessage("");
      setSelectedItems([]); setSelectedWorlds([]);
      toast({ title: "Code created!" });
    },
    onError: async (err: any) => {
      const msg = await err.response?.json().catch(() => ({ message: "Failed to create code" }));
      toast({ title: msg?.message || "Failed to create code", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/codes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes"] });
      toast({ title: "Code deleted" });
    },
  });

  const adminCodes = codes.filter(c => !c.isFree);
  const freeCode = codes.find(c => c.isFree && c.currentUses < c.maxUses);

  return (
    <div className="space-y-6">
      {freeCode && (
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Active Free Code</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <code className="text-lg font-black tracking-wide bg-emerald-500/10 px-3 py-1 rounded-md border border-emerald-500/20">{freeCode.code}</code>
            <Badge variant="secondary" className="gap-1"><Coins className="w-3 h-3" /> {freeCode.coinReward} coins</Badge>
            <Badge variant="outline">{freeCode.currentUses} / {freeCode.maxUses} uses</Badge>
            <p className="text-xs text-muted-foreground">Auto-rotates when max uses reached. Share this with players!</p>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Create New Code</h2>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Code Name</label>
            <Input placeholder="e.g. LAUNCH2025" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} data-testid="input-code-name" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Message (optional — shown to player after redemption)</label>
            <Input placeholder="e.g. Thanks for playing Neuronix!" value={message} onChange={e => setMessage(e.target.value)} data-testid="input-code-message" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Max Uses</label>
            <div className="flex items-center gap-2">
              <Input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} disabled={unlimited} data-testid="input-code-maxuses" className={unlimited ? "opacity-40" : ""} />
              <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap text-sm font-medium select-none">
                <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} data-testid="checkbox-unlimited" className="w-4 h-4 accent-purple-500" />
                Unlimited
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Expires At (optional)</label>
            <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} data-testid="input-code-expiry" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Neuro Reward</label>
            <Input type="number" min="0" value={coinReward} onChange={e => setCoinReward(e.target.value)} data-testid="input-code-coins" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Spark Reward</label>
            <Input type="number" min="0" value={gemReward} onChange={e => setGemReward(e.target.value)} data-testid="input-code-gems" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">XP Reward</label>
            <Input type="number" min="0" value={xpReward} onChange={e => setXpReward(e.target.value)} data-testid="input-code-xp" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Mystery Boxes</label>
            <div className="flex gap-2">
              <select
                value={mysteryBoxType}
                onChange={e => setMysteryBoxType(e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="select-code-boxtype"
              >
                {MYSTERY_BOX_OPTIONS.map(b => (
                  <option key={b.id} value={b.id}>{b.emoji} {b.label}</option>
                ))}
              </select>
              <Input type="number" min="0" value={mysteryBoxReward} onChange={e => setMysteryBoxReward(e.target.value)} className="w-20" placeholder="qty" data-testid="input-code-boxes" />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Unlock Worlds ({selectedWorlds.length} selected)</label>
          <div className="flex flex-wrap gap-2">
            {WORLD_OPTIONS.map(w => (
              <button
                key={w.id}
                onClick={() => toggleWorld(w.id)}
                className={`text-xs px-2 py-1 rounded-md border font-medium transition-colors ${selectedWorlds.includes(w.id) ? "bg-blue-500 text-white border-blue-500" : "border-border text-muted-foreground hover:border-blue-500/50"}`}
                data-testid={`toggle-world-${w.id}`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Give Shop Items ({selectedItems.length} selected)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            <Input
              placeholder="Search items..."
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              className="h-7 text-xs flex-1 min-w-[160px]"
              data-testid="input-item-search"
            />
            <div className="flex flex-wrap gap-1">
              {shopCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setItemCategory(cat)}
                  className={`text-xs px-2 py-1 rounded-md border font-medium transition-colors capitalize ${itemCategory === cat ? "bg-zinc-700 text-white border-zinc-700 dark:bg-zinc-200 dark:text-black dark:border-zinc-200" : "border-border text-muted-foreground hover:border-zinc-500/50"}`}
                  data-testid={`filter-category-${cat}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {selectedItems.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2 p-2 bg-purple-500/5 border border-purple-500/20 rounded-md">
              {selectedItems.map(id => {
                const item = allShopItems.find(i => i.id === id);
                return (
                  <button key={id} onClick={() => toggleItem(id)} className="text-xs px-2 py-0.5 rounded bg-purple-500 text-white flex items-center gap-1 hover:bg-purple-600 transition-colors" data-testid={`selected-item-${id}`}>
                    {item?.name || id} ✕
                  </button>
                );
              })}
            </div>
          )}
          <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2">
            {filteredShopItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No items found</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filteredShopItems.map(it => (
                  <button
                    key={it.id}
                    onClick={() => toggleItem(it.id)}
                    className={`text-xs px-2 py-1 rounded-md border font-medium transition-colors ${selectedItems.includes(it.id) ? "bg-purple-500 text-white border-purple-500" : "border-border text-muted-foreground hover:border-purple-500/50"}`}
                    data-testid={`toggle-item-${it.id}`}
                    title={`${it.id} · ${it.rarity}`}
                  >
                    {it.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">
            Give Potions ({Object.values(potionQuantities).reduce((a, b) => a + b, 0)} total)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POTIONS.map(p => {
              const qty = potionQuantities[p.id] || 0;
              return (
                <div key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${qty > 0 ? "border-purple-500/40 bg-purple-500/5" : "border-border"}`} data-testid={`potion-row-${p.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-muted-foreground truncate">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setPotionQty(p.id, -1)} disabled={qty === 0} className="w-5 h-5 rounded bg-muted flex items-center justify-center font-bold disabled:opacity-30 hover:bg-muted/80" data-testid={`potion-dec-${p.id}`}>−</button>
                    <span className={`w-5 text-center font-bold ${qty > 0 ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground"}`}>{qty}</span>
                    <button onClick={() => setPotionQty(p.id, 1)} className="w-5 h-5 rounded bg-muted flex items-center justify-center font-bold hover:bg-muted/80" data-testid={`potion-inc-${p.id}`}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newCode.trim()} className="gap-2 font-bold" data-testid="button-create-code">
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create Code
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Lock className="w-4 h-4" /> Admin Codes ({adminCodes.length})</h2>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : adminCodes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No codes created yet.</p>
        ) : (
          <div className="space-y-2">
            {adminCodes.map(c => {
              const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
              return (
                <div key={c.id} className={`p-3 rounded-lg border bg-muted/30 ${isExpired ? "border-red-500/40 opacity-60" : "border-border"}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <code className="font-black tracking-wide text-sm">{c.code}</code>
                    {c.maxUses === -1
                      ? <Badge variant="outline" className="text-xs">∞ uses ({c.currentUses} redeemed)</Badge>
                      : <Badge variant="outline" className="text-xs">{c.currentUses}/{c.maxUses} uses</Badge>
                    }
                    {isExpired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
                    {c.expiresAt && !isExpired && (
                      <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400 border-orange-500/30">
                        Expires {new Date(c.expiresAt).toLocaleDateString()}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">by {c.createdBy}</span>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-code-${c.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {c.message && <p className="text-xs italic text-muted-foreground mb-1.5">"{c.message}"</p>}
                  <div className="flex flex-wrap gap-1">
                    {c.coinReward > 0 && <Badge variant="secondary" className="gap-1 text-xs"><Coins className="w-3 h-3" /> {c.coinReward}</Badge>}
                    {c.gemReward > 0 && <Badge variant="secondary" className="gap-1 text-xs"><Gem className="w-3 h-3" /> {c.gemReward}</Badge>}
                    {c.xpReward > 0 && <Badge variant="secondary" className="gap-1 text-xs"><Zap className="w-3 h-3" /> {c.xpReward} XP</Badge>}
                    {c.mysteryBoxReward > 0 && <Badge variant="secondary" className="text-xs">{MYSTERY_BOX_OPTIONS.find(b => b.id === (c.mysteryBoxType || "bronze"))?.emoji || "📦"} {c.mysteryBoxReward}× {MYSTERY_BOX_OPTIONS.find(b => b.id === (c.mysteryBoxType || "bronze"))?.label || "Box"}</Badge>}
                    {(c.worldRewards || []).map(w => <Badge key={w} className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30">🌍 {WORLD_OPTIONS.find(x => x.id === w)?.name || w}</Badge>)}
                    {(c.itemRewards || []).map(i => <Badge key={i} className="text-xs bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30">🎁 {allShopItems.find(x => x.id === i)?.name || i}</Badge>)}
                    {(() => {
                      const potionList = c.potionRewards || [];
                      const counts: Record<string, number> = {};
                      potionList.forEach((pid: string) => { counts[pid] = (counts[pid] || 0) + 1; });
                      return Object.entries(counts).map(([pid, qty]) => (
                        <Badge key={pid} className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">🧪 {qty}× {POTIONS.find(p => p.id === pid)?.name || pid}</Badge>
                      ));
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

interface SiteMessageEntry {
  id: number;
  content: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

function MessagesTab() {
  const { toast } = useToast();
  const [newContent, setNewContent] = useState("");

  const { data: messages = [], isLoading } = useQuery<SiteMessageEntry[]>({
    queryKey: ["/api/admin/messages"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/messages", { content: newContent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setNewContent("");
      toast({ title: "Message posted!" });
    },
    onError: async (err: any) => {
      const msg = await err.response?.json().catch(() => ({ message: "Failed to post message" }));
      toast({ title: msg?.message || "Failed to post message", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({ title: "Message deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/messages/${id}/toggle`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Post a Message
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Active messages cycle on the home page for all players.
        </p>
        <div className="flex gap-3">
          <Input
            placeholder="e.g. Welcome to Neuronix! Update 2.0 is live!"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={e => e.key === "Enter" && newContent.trim() && createMutation.mutate()}
            data-testid="input-message-content"
            className="flex-1"
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !newContent.trim()}
            className="gap-2 font-bold shrink-0"
            data-testid="button-post-message"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Post
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> All Messages ({messages.length})
        </h2>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No messages yet. Post one above!</p>
        ) : (
          <div className="space-y-2">
            {messages.map(m => (
              <div key={m.id} className={`flex items-start gap-3 p-3 rounded-lg border ${m.isActive ? "border-border bg-muted/20" : "border-border/40 bg-muted/5 opacity-50"}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{m.content}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">by {m.createdBy} · {new Date(m.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={m.isActive ? "default" : "outline"} className="text-xs cursor-pointer" onClick={() => toggleMutation.mutate({ id: m.id, isActive: !m.isActive })} data-testid={`toggle-message-${m.id}`}>
                    {m.isActive ? "Active" : "Hidden"}
                  </Badge>
                  <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(m.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-message-${m.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SchoolsTab() {
  const { toast } = useToast();
  const [schoolName, setSchoolName] = useState("");
  const { data: schools = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/schools"] });

  const createMutation = useMutation({
    mutationFn: async (name: string) => (await apiRequest("POST", "/api/schools", { name })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      setSchoolName("");
      toast({ title: "App created!", description: "Teachers can now join this app." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message || "App name may already exist.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/schools/${id}`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      toast({ title: "App deleted." });
    },
    onError: () => toast({ title: "Failed to delete app", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="font-black text-lg flex items-center gap-2 mb-4">
          <School className="w-5 h-5 text-blue-500" /> Apps
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Create school apps here. Teachers must join an app before they can create districts.
        </p>
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="App name..."
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            data-testid="input-school-name"
          />
          <Button
            onClick={() => createMutation.mutate(schoolName)}
            disabled={!schoolName || createMutation.isPending}
            className="font-bold shrink-0"
            data-testid="button-create-school"
          >
            <Plus className="w-4 h-4 mr-1" /> Create App
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : schools.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No apps yet. Create the first one above.</p>
        ) : (
          <div className="space-y-2">
            {schools.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20" data-testid={`row-school-${s.id}`}>
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="font-bold text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">Created {s.createdAt}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Delete app "${s.name}"? Teachers linked to this app will lose their app association.`)) {
                      deleteMutation.mutate(s.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="text-xs font-bold"
                  data-testid={`button-delete-school-${s.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ReportsTab() {
  const { toast } = useToast();
  type Report = { id: number; userId: number; username: string; reason: string; details: string; createdAt: string; reviewed: boolean };
  const { data: reports = [], isLoading, refetch } = useQuery<Report[]>({
    queryKey: ["/api/admin/suspicious-reports"],
    queryFn: async () => {
      const res = await fetch("/api/admin/suspicious-reports", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/suspicious-reports/${id}/reviewed`, {});
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast({ title: "Marked as reviewed" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/suspicious-reports"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/suspicious-reports/${id}`, {});
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast({ title: "Report dismissed" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/suspicious-reports"] }); },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/unsuspend`, {});
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast({ title: "Account unsuspended", description: "The player can play again." }); },
  });

  const unreviewed = reports.filter(r => !r.reviewed);
  const reviewed = reports.filter(r => r.reviewed);
  const REASON_LABELS: Record<string, string> = { autoclicker_detected: "🤖 Auto-Clicker Detected" };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-red-500/20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-red-500" /> Suspicious Activity Reports
            {unreviewed.length > 0 && <Badge className="bg-red-500 text-white text-xs">{unreviewed.length} new</Badge>}
          </h2>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1 font-bold text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-muted-foreground">No reports yet — all clear!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unreviewed.length > 0 && <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Needs Review</p>}
            {unreviewed.map(r => (
              <Card key={r.id} className="p-3 border-red-500/30 bg-red-500/5" data-testid={`report-${r.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 text-xs font-bold">
                        {REASON_LABELS[r.reason] || r.reason}
                      </Badge>
                      <span className="font-black text-sm">@{r.username}</span>
                      <span className="text-xs text-muted-foreground">uid:{r.userId}</span>
                    </div>
                    {r.details && <p className="text-xs text-muted-foreground font-medium break-all">{r.details}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {r.reason.startsWith("autoclicker") && (
                      <Button size="sm" variant="outline" className="text-xs font-bold gap-1 text-blue-600 border-blue-500/30" onClick={() => unsuspendMutation.mutate(r.userId)} disabled={unsuspendMutation.isPending} data-testid={`button-unsuspend-${r.id}`}>
                        <RefreshCw className="w-3 h-3" /> Unsuspend
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs font-bold gap-1 text-emerald-600 border-emerald-500/30" onClick={() => reviewMutation.mutate(r.id)} disabled={reviewMutation.isPending} data-testid={`button-review-${r.id}`}>
                      <CheckCircle className="w-3 h-3" /> Reviewed
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs font-bold gap-1 text-red-500" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending} data-testid={`button-dismiss-${r.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {reviewed.length > 0 && (
              <>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4">Already Reviewed</p>
                {reviewed.map(r => (
                  <Card key={r.id} className="p-3 border-border opacity-60" data-testid={`report-reviewed-${r.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="secondary" className="text-xs font-bold">{REASON_LABELS[r.reason] || r.reason}</Badge>
                          <span className="font-bold text-sm">@{r.username}</span>
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">✓ reviewed</Badge>
                        </div>
                        {r.details && <p className="text-xs text-muted-foreground break-all">{r.details}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
