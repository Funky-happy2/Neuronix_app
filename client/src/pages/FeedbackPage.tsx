import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, CheckCircle, Inbox, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Feedback } from "@shared/schema";

export default function FeedbackPage() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tab, setTab] = useState<"send" | "history">("send");

  const { data: myFeedback = [], refetch } = useQuery<Feedback[]>({
    queryKey: ["/api/my-feedback"],
  });

  const handleSubmit = async () => {
    if (message.trim().length < 3) {
      toast({ title: "Too short", description: "Please write at least 3 characters", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await apiRequest("POST", "/api/feedback", { message: message.trim() });
      setSent(true);
      setMessage("");
      refetch();
      toast({ title: "Sent!", description: "Thanks for your feedback! The admin will see it soon." });
    } catch {
      toast({ title: "Error", description: "Failed to send feedback. Try again!", variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-black flex items-center gap-3 mb-2">
          <MessageCircle className="w-8 h-8 text-blue-500" /> Feedback
        </h1>
        <p className="text-muted-foreground font-medium mb-6">
          Got an idea, found a bug, or just want to say hi? Send your message to the admin!
        </p>

        <div className="flex gap-2 mb-6">
          <Button variant={tab === "send" ? "default" : "outline"} onClick={() => setTab("send")} className="gap-2 font-bold" data-testid="tab-feedback-send">
            <Send className="w-4 h-4" /> Send Feedback
          </Button>
          <Button variant={tab === "history" ? "default" : "outline"} onClick={() => setTab("history")} className="gap-2 font-bold relative" data-testid="tab-feedback-history">
            <Inbox className="w-4 h-4" /> My Submissions
            {myFeedback.some(f => f.adminReply) && (
              <Badge className="bg-green-500 text-white text-[9px] px-1 py-0 absolute -top-1 -right-1">Reply!</Badge>
            )}
          </Button>
        </div>

        {tab === "send" && (
          sent ? (
            <Card className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
              <p className="text-muted-foreground mb-4">The admin will read your feedback soon.</p>
              <Button onClick={() => setSent(false)} className="font-bold" data-testid="button-send-another">
                Send Another Message
              </Button>
            </Card>
          ) : (
            <Card className="p-6">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your feedback, suggestions, or bug reports here..."
                className="min-h-[150px] text-base mb-4"
                maxLength={1000}
                data-testid="input-feedback"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{message.length}/1000</span>
                <Button
                  onClick={handleSubmit}
                  disabled={sending || message.trim().length < 3}
                  className="gap-2 font-bold"
                  data-testid="button-send-feedback"
                >
                  <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send Feedback"}
                </Button>
              </div>
            </Card>
          )
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {myFeedback.length === 0 ? (
              <Card className="p-8 text-center">
                <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No submissions yet. Send some feedback!</p>
              </Card>
            ) : (
              myFeedback.map(fb => (
                <Card key={fb.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString()}</span>
                    {fb.adminReply ? (
                      <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 text-[9px]">Replied</Badge>
                    ) : fb.read ? (
                      <Badge variant="secondary" className="text-[9px]">Read</Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[9px]">Pending</Badge>
                    )}
                  </div>
                  <p className="text-sm mb-3 text-muted-foreground">{fb.message}</p>
                  {fb.adminReply && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-blue-500 mb-1">Admin Reply</p>
                        <p className="text-sm">{fb.adminReply}</p>
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
