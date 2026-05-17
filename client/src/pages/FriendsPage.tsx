import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserPlus, UserCheck, UserX, Clock, Send, MessageCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import UserProfileModal from "@/components/UserProfileModal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserNameDisplay } from "@/lib/mentions";

type Friendship = {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  status: "pending" | "accepted";
  createdAt: string;
  friendDisplayName?: string | null;
};

type DirectMessage = {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  content: string;
  createdAt: string;
  isRead: boolean;
};

type ChatTarget = { id: number; name: string; displayName?: string | null };

function ChatPanel({ friend, currentUserId, onBack }: { friend: ChatTarget; currentUserId: number; onBack: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<DirectMessage[]>({
    queryKey: ["/api/messages", friend.id],
    queryFn: async () => {
      const res = await fetch(`/api/messages/${friend.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/messages/${friend.id}`, { content });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", friend.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="flex flex-col h-[70vh] max-h-[600px]">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 font-bold" data-testid="button-chat-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-black">
          {friend.name[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">
            {friend.displayName || friend.name}
          </p>
          <p className="text-xs text-muted-foreground">@{friend.name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3" data-testid="chat-messages">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <MessageCircle className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm font-medium">No messages yet!</p>
            <p className="text-muted-foreground text-xs">Say hi to {friend.displayName || friend.name} 👋</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm font-medium break-words ${
                  isMe
                    ? "bg-blue-500 text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`} data-testid={`msg-${msg.id}`}>
                  {msg.content}
                  <div className={`text-[10px] mt-0.5 ${isMe ? "text-blue-100" : "text-muted-foreground"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={e => setText(e.target.value.slice(0, 300))}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          className="font-medium text-sm"
          data-testid="input-chat-message"
          disabled={sendMutation.isPending}
        />
        <Button
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          className="gap-1 font-bold px-3"
          data-testid="button-chat-send"
        >
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-right mt-1">{text.length}/300</p>
    </div>
  );
}

export default function FriendsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"friends" | "requests" | "sent">("friends");
  const [searchUsername, setSearchUsername] = useState("");
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<ChatTarget | null>(null);

  const { data: friendships = [], isLoading } = useQuery<Friendship[]>({
    queryKey: ["/api/friends"],
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/messages/unread-count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 10000,
    enabled: !!user,
  });

  const unreadCount = unreadData?.count ?? 0;

  const accepted = friendships.filter(f => f.status === "accepted");
  const incoming = friendships.filter(f => f.status === "pending" && f.receiverId === user?.id);
  const sent = friendships.filter(f => f.status === "pending" && f.senderId === user?.id);

  const getFriendName = (f: Friendship) =>
    f.senderId === user?.id ? f.receiverName : f.senderName;

  const getFriendId = (f: Friendship) =>
    f.senderId === user?.id ? f.receiverId : f.senderId;

  const sendRequestMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest("POST", "/api/friends/request", { username });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      setSearchUsername("");
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/friends/${id}/accept`, {});
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Friend request accepted!" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/friends/${id}/decline`, {});
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request declined." });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/friends/${id}`, {});
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Friend removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3 mb-2">
        <Users className="w-8 h-8 text-blue-500" /> Friends
        {unreadCount > 0 && (
          <Badge className="bg-red-500 text-white text-xs font-black">{unreadCount} new</Badge>
        )}
      </h1>
      <p className="text-muted-foreground font-medium mb-6">Connect with other science champions!</p>

      <AnimatePresence mode="wait">
        {chatTarget ? (
          <motion.div key="chat" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <Card className="p-5 border-blue-500/20">
              <ChatPanel
                friend={chatTarget}
                currentUserId={user?.id ?? 0}
                onBack={() => {
                  setChatTarget(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
                }}
              />
            </Card>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="p-4 mb-6 border-blue-500/20">
              <label className="text-sm font-bold mb-2 block text-muted-foreground">Send a friend request</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter username..."
                  value={searchUsername}
                  onChange={e => setSearchUsername(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchUsername.trim() && sendRequestMutation.mutate(searchUsername.trim())}
                  className="max-w-xs font-bold"
                  data-testid="input-friend-username"
                />
                <Button
                  onClick={() => searchUsername.trim() && sendRequestMutation.mutate(searchUsername.trim())}
                  disabled={!searchUsername.trim() || sendRequestMutation.isPending}
                  className="gap-2 font-bold"
                  data-testid="button-send-request"
                >
                  <Send className="w-4 h-4" /> Send Request
                </Button>
              </div>
            </Card>

            <div className="flex gap-2 mb-5">
              <Button
                variant={tab === "friends" ? "default" : "outline"}
                onClick={() => setTab("friends")}
                className="gap-2 font-bold"
                data-testid="tab-friends"
              >
                <UserCheck className="w-4 h-4" /> Friends
                {accepted.length > 0 && <Badge className="ml-1 text-[10px] bg-blue-500">{accepted.length}</Badge>}
              </Button>
              <Button
                variant={tab === "requests" ? "default" : "outline"}
                onClick={() => setTab("requests")}
                className="gap-2 font-bold"
                data-testid="tab-requests"
              >
                <UserPlus className="w-4 h-4" /> Requests
                {incoming.length > 0 && <Badge className="ml-1 text-[10px] bg-red-500">{incoming.length}</Badge>}
              </Button>
              <Button
                variant={tab === "sent" ? "default" : "outline"}
                onClick={() => setTab("sent")}
                className="gap-2 font-bold"
                data-testid="tab-sent"
              >
                <Clock className="w-4 h-4" /> Sent
                {sent.length > 0 && <Badge className="ml-1 text-[10px] bg-muted-foreground">{sent.length}</Badge>}
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground">Loading...</div>
            ) : (
              <AnimatePresence mode="wait">
                {tab === "friends" && (
                  <motion.div key="friends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    {accepted.length === 0 ? (
                      <div className="text-center py-16">
                        <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium text-lg">No friends yet!</p>
                        <p className="text-sm text-muted-foreground">Send a request to someone to get started.</p>
                      </div>
                    ) : accepted.map(f => (
                      <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="p-4 flex items-center justify-between border-border hover:border-purple-500/30 transition-colors" data-testid={`card-friend-${f.id}`}>
                          <div
                            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                            onClick={() => setProfileUsername(getFriendName(f))}
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                              {getFriendName(f)[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <UserNameDisplay username={getFriendName(f)} displayName={f.friendDisplayName} nameClassName="text-sm" />
                              <p className="text-xs text-muted-foreground mt-0.5">Friends since {new Date(f.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 font-bold text-xs text-blue-500 hover:text-blue-600 border-blue-500/30"
                              onClick={() => setChatTarget({ id: getFriendId(f), name: getFriendName(f), displayName: f.friendDisplayName })}
                              data-testid={`button-chat-${f.id}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> Chat
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 text-red-500 hover:text-red-600 font-bold text-xs"
                              onClick={e => { e.stopPropagation(); removeMutation.mutate(f.id); }}
                              disabled={removeMutation.isPending}
                              data-testid={`button-remove-${f.id}`}
                            >
                              <UserX className="w-3.5 h-3.5" /> Remove
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {tab === "requests" && (
                  <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    {incoming.length === 0 ? (
                      <div className="text-center py-16">
                        <UserPlus className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium text-lg">No pending requests!</p>
                        <p className="text-sm text-muted-foreground">When someone sends you a request, it will appear here.</p>
                      </div>
                    ) : incoming.map(f => (
                      <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="p-4 flex items-center justify-between border-border" data-testid={`card-request-${f.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-black text-lg">
                              {getFriendName(f)[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold">{getFriendName(f)}</p>
                              <p className="text-xs text-muted-foreground">Sent {new Date(f.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="gap-1.5 font-bold text-xs bg-emerald-500 hover:bg-emerald-600" onClick={() => acceptMutation.mutate(f.id)} disabled={acceptMutation.isPending} data-testid={`button-accept-${f.id}`}>
                              <UserCheck className="w-3.5 h-3.5" /> Accept
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5 font-bold text-xs text-red-500 hover:text-red-600" onClick={() => declineMutation.mutate(f.id)} disabled={declineMutation.isPending} data-testid={`button-decline-${f.id}`}>
                              <UserX className="w-3.5 h-3.5" /> Decline
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {tab === "sent" && (
                  <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    {sent.length === 0 ? (
                      <div className="text-center py-16">
                        <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium text-lg">No sent requests!</p>
                        <p className="text-sm text-muted-foreground">Requests you've sent will appear here.</p>
                      </div>
                    ) : sent.map(f => (
                      <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="p-4 flex items-center justify-between border-border" data-testid={`card-sent-${f.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-gray-400 to-slate-600 flex items-center justify-center text-white font-black text-lg">
                              {getFriendName(f)[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold">{getFriendName(f)}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pending since {new Date(f.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="gap-2 text-red-500 hover:text-red-600 font-bold text-xs" onClick={() => removeMutation.mutate(f.id)} disabled={removeMutation.isPending} data-testid={`button-cancel-${f.id}`}>
                            <UserX className="w-3.5 h-3.5" /> Cancel
                          </Button>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
    </div>
  );
}
