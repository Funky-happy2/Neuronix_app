import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Link2, Copy, CheckCheck, Coins, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface ReferralData {
  code: string;
  usedCount: number;
  maxUses: number;
}

export default function InvitePage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: referral, isLoading } = useQuery<ReferralData>({
    queryKey: ["/api/referral/my-link"],
  });

  const inviteUrl = referral
    ? `${window.location.origin}/auth?ref=${referral.code}`
    : "";

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast({ title: "Invite link copied!" });
    setTimeout(() => setCopied(false), 2500);
  };

  const remaining = referral ? referral.maxUses - referral.usedCount : 4;

  return (
    <div className="min-h-screen max-w-xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-purple-500" /> Invite Friends
          </h1>
          <p className="text-muted-foreground font-medium">
            Share your personal invite link. When a friend signs up using it, you both get <strong>100 coins</strong>!
          </p>
        </div>

        <Card className="p-6 border-purple-500/30 bg-purple-500/5">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-purple-500" />
            <span className="font-bold text-purple-600 dark:text-purple-400">Your Invite Rewards</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-background rounded-lg border border-border p-3 text-center">
              <Coins className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-2xl font-black">+100</p>
              <p className="text-xs text-muted-foreground">coins for you</p>
            </div>
            <div className="bg-background rounded-lg border border-border p-3 text-center">
              <Coins className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-2xl font-black">+100</p>
              <p className="text-xs text-muted-foreground">coins for them</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              {referral ? `${referral.usedCount} / ${referral.maxUses}` : "0 / 4"} used
            </Badge>
            <span>{remaining > 0 ? `${remaining} invite${remaining !== 1 ? "s" : ""} remaining` : "All invites used up"}</span>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Your Invite Link
          </h2>

          {isLoading ? (
            <div className="h-12 bg-muted animate-pulse rounded-lg" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 font-mono text-sm break-all">
                {inviteUrl}
              </div>
              <Button
                onClick={handleCopy}
                disabled={!referral || remaining === 0}
                className="w-full gap-2 font-bold"
                data-testid="button-copy-invite"
              >
                {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Invite Link"}
              </Button>
              {remaining === 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  You've used all 4 invites. Thanks for spreading the word!
                </p>
              )}
            </div>
          )}
        </Card>

        <Card className="p-4 border-border bg-muted/20">
          <h3 className="font-bold text-sm mb-2">How it works</h3>
          <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
            <li>Copy your personal invite link above</li>
            <li>Share it with a friend who hasn't joined Neuronix yet</li>
            <li>They sign up using your link</li>
            <li>You <strong>both</strong> get 100 coins instantly!</li>
            <li>You can invite up to 4 friends total</li>
          </ol>
        </Card>
      </motion.div>
    </div>
  );
}
