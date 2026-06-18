import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, MessagesSquare } from "lucide-react";

interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string;
}

// A lightweight polling chat used by Trades (bargain with the owner) and Quests
// (bargain / get details). `endpoint` is the messages URL, e.g. "/api/trades/3/messages".
export function ChatPanel({
  endpoint,
  meId,
  canSend = true,
  emptyHint = "No messages yet — say hello!",
  disabledHint,
}: {
  endpoint: string;
  meId?: number;
  canSend?: boolean;
  emptyHint?: string;
  disabledHint?: string;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: [endpoint],
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", endpoint, { content });
      return res.json();
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || send.isPending) return;
    send.mutate(t);
  };

  return (
    <div className="flex flex-col h-72 border rounded-xl bg-muted/30 overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-1">
            <MessagesSquare className="w-6 h-6 opacity-50" /> {emptyHint}
          </div>
        ) : (
          messages.map((m) => {
            const mine = meId != null && m.senderId === meId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.id}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${mine ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                  {!mine && <div className="text-[10px] font-bold opacity-70 mb-0.5">{m.senderName}</div>}
                  <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {canSend ? (
        <form onSubmit={submit} className="flex gap-2 p-2 border-t bg-background">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            maxLength={500}
            data-testid="chat-input"
          />
          <Button type="submit" size="icon" disabled={!text.trim() || send.isPending} data-testid="chat-send">
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      ) : (
        <div className="p-2 border-t bg-background text-center text-xs text-muted-foreground">{disabledHint || "Chat is closed."}</div>
      )}
    </div>
  );
}
