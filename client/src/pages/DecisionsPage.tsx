import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Gavel, Shield, Ban, AlertTriangle, RotateCcw, Trash2, Crown, Star, Bot, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Decision {
  id: number;
  createdAt: string;
  adminId: number;
  adminName: string;
  type: string;
  targetId: number | null;
  targetName: string | null;
  description: string;
  reversible: boolean;
  appealStatus: "none" | "pending" | "upheld" | "overturned";
  appealText: string | null;
  appealResponse: string | null;
  appealResolvedByName: string | null;
}

const TYPE_META: Record<string, { label: string; icon: typeof Gavel; color: string }> = {
  ban: { label: "Ban", icon: Ban, color: "text-red-500 bg-red-500/10 border-red-500/30" },
  unban: { label: "Unban", icon: Shield, color: "text-green-500 bg-green-500/10 border-green-500/30" },
  strike: { label: "Strike", icon: AlertTriangle, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  "clear-strikes": { label: "Strikes Cleared", icon: CheckCircle, color: "text-green-500 bg-green-500/10 border-green-500/30" },
  "reset-progress": { label: "Progress Reset", icon: RotateCcw, color: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
  deactivate: { label: "Account Deactivated", icon: Trash2, color: "text-red-500 bg-red-500/10 border-red-500/30" },
  "permanent-delete": { label: "Permanent Delete", icon: Trash2, color: "text-red-600 bg-red-600/10 border-red-600/30" },
  revive: { label: "Account Revived", icon: Shield, color: "text-green-500 bg-green-500/10 border-green-500/30" },
  "grant-admin": { label: "Made Admin", icon: Crown, color: "text-purple-500 bg-purple-500/10 border-purple-500/30" },
  "remove-admin": { label: "Admin Removed", icon: Crown, color: "text-purple-500 bg-purple-500/10 border-purple-500/30" },
  "grant-vip": { label: "VIP Granted", icon: Star, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  "remove-vip": { label: "VIP Removed", icon: Star, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  "autoclicker-suspension": { label: "Auto-Suspension", icon: Bot, color: "text-rose-500 bg-rose-500/10 border-rose-500/30" },
  "appeal-overturned": { label: "Appeal Granted", icon: CheckCircle, color: "text-green-500 bg-green-500/10 border-green-500/30" },
  "appeal-upheld": { label: "Appeal Denied", icon: XCircle, color: "text-slate-500 bg-slate-500/10 border-slate-500/30" },
};

const APPEAL_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "⏳ Appeal pending", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  upheld: { label: "Appeal denied", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" },
  overturned: { label: "✅ Appeal granted", cls: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" },
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DecisionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appealingId, setAppealingId] = useState<number | null>(null);
  const [appealText, setAppealText] = useState("");

  const { data: decisions = [], isLoading } = useQuery<Decision[]>({ queryKey: ["/api/decisions"] });

  const appealMutation = useMutation({
    mutationFn: async ({ id, text }: { id: number; text: string }) => {
      const res = await apiRequest("POST", `/api/decisions/${id}/appeal`, { text });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Appeal submitted!", description: "An admin will review your appeal soon. 💜" });
      queryClient.invalidateQueries({ queryKey: ["/api/decisions"] });
      setAppealingId(null);
      setAppealText("");
    },
    onError: (e: any) => toast({ title: "Couldn't submit appeal", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
          <Gavel className="w-8 h-8 text-purple-500" /> Moderation Decisions
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          Every moderation action is logged here with a reason — for full transparency. If a decision about you seems wrong, you can appeal it.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : decisions.length === 0 ? (
        <Card className="p-10 text-center border-border">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-bold text-lg">All clear!</p>
          <p className="text-muted-foreground text-sm">No moderation decisions have been made yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => {
            const meta = TYPE_META[d.type] || { label: d.type.replace(/-/g, " "), icon: Gavel, color: "text-muted-foreground bg-muted border-border" };
            const Icon = meta.icon;
            const isMine = !!user && d.targetId === (user as any).id;
            const canAppeal = isMine && d.appealStatus === "none" && d.type !== "appeal-overturned" && d.type !== "appeal-upheld";
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={`p-4 border-border ${isMine ? "ring-1 ring-purple-500/30" : ""}`} data-testid={`decision-${d.id}`}>
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${meta.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`font-bold border ${meta.color}`}>{meta.label}</Badge>
                        {d.targetName && (
                          <span className="text-sm font-bold">{d.targetName}{isMine && <span className="text-purple-500"> (you)</span>}</span>
                        )}
                        {d.appealStatus !== "none" && (
                          <Badge variant="outline" className={`text-[10px] font-bold ${APPEAL_BADGE[d.appealStatus]?.cls || ""}`}>
                            {APPEAL_BADGE[d.appealStatus]?.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground/90 mt-1.5">{d.description}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1.5">
                        <span>by <span className="font-semibold">{d.adminName}</span></span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {timeAgo(d.createdAt)}</span>
                      </div>

                      {d.appealStatus === "pending" && d.appealText && (
                        <div className="mt-2 text-xs bg-muted/50 rounded-lg p-2">
                          <span className="font-bold">Appeal:</span> {d.appealText}
                        </div>
                      )}
                      {(d.appealStatus === "upheld" || d.appealStatus === "overturned") && d.appealResponse && (
                        <div className="mt-2 text-xs bg-muted/50 rounded-lg p-2">
                          <span className="font-bold">Admin response{d.appealResolvedByName ? ` (${d.appealResolvedByName})` : ""}:</span> {d.appealResponse}
                        </div>
                      )}

                      {canAppeal && appealingId !== d.id && (
                        <Button size="sm" variant="outline" className="mt-2 font-bold text-xs gap-1" onClick={() => { setAppealingId(d.id); setAppealText(""); }} data-testid={`button-appeal-${d.id}`}>
                          <Gavel className="w-3 h-3" /> Appeal this decision
                        </Button>
                      )}
                      {canAppeal && appealingId === d.id && (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={appealText}
                            onChange={(e) => setAppealText(e.target.value)}
                            placeholder="Explain why you think this decision was a mistake…"
                            className="text-sm"
                            rows={3}
                            maxLength={500}
                            data-testid={`appeal-text-${d.id}`}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="font-bold text-xs" disabled={appealMutation.isPending || appealText.trim().length < 5} onClick={() => appealMutation.mutate({ id: d.id, text: appealText })} data-testid={`button-submit-appeal-${d.id}`}>
                              {appealMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Submit appeal"}
                            </Button>
                            <Button size="sm" variant="ghost" className="font-bold text-xs" onClick={() => setAppealingId(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
