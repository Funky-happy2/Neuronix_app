import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Newspaper, Pin, Loader2, Megaphone, Sparkles, Wrench,
  Calendar, Trash2, Edit, Plus, X, Check, User, MessageCircle, Send, Zap, Gem, Clock, CheckCircle,
  BarChart3, Vote
} from "lucide-react";
import UserProfileModal from "@/components/UserProfileModal";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useState } from "react";
import { getTitle, getTitleAnimClass } from "@/lib/titles";
import { renderMentions, UserNameDisplay } from "@/lib/mentions";

interface NewsPost {
  id: number;
  title: string;
  content: string;
  category: string;
  authorId: number;
  authorName: string;
  authorTitle?: string | null;
  authorIsVip?: boolean;
  pinned: boolean;
  createdAt: string;
  status: string;
  pollQuestion?: string | null;
  pollOptions?: string[] | null;
  pollVotes?: Record<string, number> | null;
}

interface NewsComment {
  id: number;
  postId: number;
  userId: number;
  username: string;
  userTitle?: string | null;
  userIsVip?: boolean;
  content: string;
  createdAt: string;
}

interface NewsReaction {
  id: number;
  postId: number;
  userId: number;
  emoji: string;
}

const CATEGORIES: { value: string; label: string; icon: typeof Newspaper; color: string }[] = [
  { value: "update", label: "Update", icon: Wrench, color: "bg-blue-500" },
  { value: "event", label: "Event", icon: Sparkles, color: "bg-purple-500" },
  { value: "announcement", label: "Announcement", icon: Megaphone, color: "bg-orange-500" },
  { value: "coming-soon", label: "Coming Soon", icon: Calendar, color: "bg-green-500" },
];

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😂", "🤯", "🔥"];

function getCategoryInfo(cat: string) {
  return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function PostPoll({ post }: { post: NewsPost }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const currentUserId = (user as any)?.id;
  const options = post.pollOptions ?? [];
  const votes = post.pollVotes ?? {};
  const myVote = currentUserId != null ? votes[String(currentUserId)] : undefined;
  const hasVoted = myVote !== undefined;
  const counts = options.map((_, i) => Object.values(votes).filter(v => v === i).length);
  const total = counts.reduce((s, c) => s + c, 0);

  const voteMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      const res = await apiRequest("POST", `/api/news/${post.id}/poll-vote`, { optionIndex });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
    },
    onError: (e: any) => toast({ title: "Couldn't vote", description: e.message, variant: "destructive" }),
  });

  if (!post.pollQuestion || options.length === 0) return null;

  return (
    <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30" data-testid={`poll-${post.id}`}>
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-purple-500" />
        <p className="font-bold text-sm">{post.pollQuestion}</p>
      </div>
      <div className="space-y-1.5">
        {options.map((opt, i) => {
          const count = counts[i];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isMyChoice = myVote === i;
          if (hasVoted || !user) {
            return (
              <div
                key={i}
                className={`relative overflow-hidden rounded-md border ${isMyChoice ? "border-purple-500/60 bg-purple-500/5" : "border-border bg-background/50"} px-3 py-1.5 text-xs font-semibold`}
                data-testid={`poll-result-${post.id}-${i}`}
              >
                <div
                  className={`absolute inset-y-0 left-0 ${isMyChoice ? "bg-purple-500/20" : "bg-muted"}`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate">
                    {isMyChoice && <Check className="w-3 h-3 text-purple-500 shrink-0" />}
                    <span className="truncate">{opt}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{pct}% · {count}</span>
                </div>
              </div>
            );
          }
          return (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-semibold h-8"
              disabled={voteMutation.isPending}
              onClick={() => voteMutation.mutate(i)}
              data-testid={`poll-vote-${post.id}-${i}`}
            >
              <Vote className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
              {opt}
            </Button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground font-medium mt-2">
        {total} vote{total === 1 ? "" : "s"}{!user ? " · Log in to vote" : hasVoted ? " · You voted" : ""}
      </p>
    </div>
  );
}

function PostComments({ postId, isAdmin, authorId, onViewProfile }: { postId: number; isAdmin: boolean; authorId: number; onViewProfile?: (username: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const currentUserId = (user as any)?.id;
  const isAuthor = currentUserId === authorId;

  const { data: comments = [] } = useQuery<NewsComment[]>({
    queryKey: ["/api/news", postId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/news/${postId}/comments`);
      return res.json();
    },
  });

  const { data: reactions = [] } = useQuery<NewsReaction[]>({
    queryKey: ["/api/news", postId, "reactions"],
    queryFn: async () => {
      const res = await fetch(`/api/news/${postId}/reactions`);
      return res.json();
    },
  });

  const { data: boostData = { boostCount: 0, boosted: false } } = useQuery<{ boostCount: number; boosted: boolean }>({
    queryKey: ["/api/news", postId, "boosts"],
    queryFn: async () => {
      const res = await fetch(`/api/news/${postId}/boosts`);
      return res.json();
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/news/${postId}/comments`, { content: commentText });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to post comment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news", postId, "comments"] });
      setCommentText("");
    },
    onError: (e: any) => toast({ title: "Oops!", description: e.message, variant: "destructive" }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/news/comments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news", postId, "comments"] });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async (emoji: string) => {
      const res = await apiRequest("POST", `/api/news/${postId}/reactions`, { emoji });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news", postId, "reactions"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const boostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/news/${postId}/boost`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to boost");
      return data as { boosted: boolean; boostCount: number; badgesEarned?: string[]; itemsEarned?: string[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/news", postId, "boosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (data.boosted) {
        const milestoneReached = (data.badgesEarned?.length ?? 0) > 0 || (data.itemsEarned?.length ?? 0) > 0;
        if (milestoneReached) {
          toast({ title: "🏆 Milestone Reached!", description: "Your boost helped the author unlock a new badge or reward!" });
        } else {
          toast({ title: "Boosted! 💎", description: "You boosted this post — the author earned a gem!" });
        }
      } else {
        toast({ title: "Boost removed", description: "Your boost was removed." });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reactionCounts = REACTION_EMOJIS.map(emoji => {
    const count = reactions.filter(r => r.emoji === emoji).length;
    const userReacted = reactions.some(r => r.emoji === emoji && r.userId === currentUserId);
    return { emoji, count, userReacted };
  }).filter(r => r.count > 0 || true);

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex flex-wrap gap-1 mb-2">
        {REACTION_EMOJIS.map(emoji => {
          const info = reactionCounts.find(r => r.emoji === emoji)!;
          return (
            <Button
              key={emoji}
              size="sm"
              variant={info.userReacted ? "default" : "outline"}
              className={`h-7 px-2 text-xs gap-1 ${info.userReacted ? "bg-primary/20 border-primary/40 text-primary hover:bg-primary/30" : ""}`}
              onClick={() => user && reactionMutation.mutate(emoji)}
              disabled={!user || reactionMutation.isPending}
              data-testid={`reaction-${emoji}-${postId}`}
            >
              <span>{emoji}</span>
              {info.count > 0 && <span className="font-bold">{info.count}</span>}
            </Button>
          );
        })}
        {user && !isAuthor && (
          <Button
            size="sm"
            variant={boostData.boosted ? "default" : "outline"}
            className={`h-7 px-2 text-xs gap-1 font-bold ${boostData.boosted ? "bg-orange-500/20 border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/30" : "text-orange-600 dark:text-orange-400 border-orange-400/50 hover:border-orange-400"}`}
            onClick={() => boostMutation.mutate()}
            disabled={boostMutation.isPending}
            data-testid={`boost-${postId}`}
          >
            <Zap className="w-3 h-3" />
            {boostData.boosted ? "Boosted" : "Boost"}
            {boostData.boostCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Gem className="w-2.5 h-2.5" />
                {boostData.boostCount}
              </span>
            )}
          </Button>
        )}
        {isAuthor && boostData.boostCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-orange-500 px-2">
            <Zap className="w-3 h-3" />
            {boostData.boostCount} boost{boostData.boostCount !== 1 ? "s" : ""}
            <Gem className="w-2.5 h-2.5 text-orange-400" />
            +{boostData.boostCount}
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground font-bold h-7"
        onClick={() => setShowComments(!showComments)}
        data-testid={`toggle-comments-${postId}`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? "s" : ""}` : "Comment"}
      </Button>

      {showComments && (
        <div className="mt-2 space-y-2">
          {comments.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2 items-start text-sm" data-testid={`comment-${c.id}`}>
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs cursor-pointer hover:underline" onClick={() => onViewProfile?.(c.username)}>@{c.username}</span>
                      {c.userIsVip && (
                        <span className="text-[8px] font-bold px-1 py-0 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">VIP</span>
                      )}
                      {c.userTitle && (() => {
                        const t = getTitle(c.userTitle);
                        return t ? <span className={`text-[8px] font-bold text-purple-500 dark:text-purple-400 ${getTitleAnimClass(c.userTitle)}`}>{t}</span> : null;
                      })()}
                      <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      {(isAdmin || c.userId === (user as any)?.id) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-red-500 ml-auto"
                          onClick={() => deleteCommentMutation.mutate(c.id)}
                          disabled={deleteCommentMutation.isPending}
                          data-testid={`delete-comment-${c.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-foreground/80 text-xs whitespace-pre-wrap break-words">{renderMentions(c.content, (user as any)?.username)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {user ? (
            <div className="flex gap-2 items-center">
              <Input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="text-xs h-8"
                maxLength={500}
                onKeyDown={e => {
                  if (e.key === "Enter" && commentText.trim()) {
                    commentMutation.mutate();
                  }
                }}
                data-testid={`input-comment-${postId}`}
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => commentMutation.mutate()}
                disabled={!commentText.trim() || commentMutation.isPending}
                data-testid={`submit-comment-${postId}`}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Log in to comment</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = (user as any)?.isAdmin;
  const currentUserId = (user as any)?.id;

  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("update");
  const [pinned, setPinned] = useState(false);
  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const { data: posts = [], isLoading } = useQuery<NewsPost[]>({
    queryKey: ["/api/news"],
  });

  function pollPayload() {
    if (!includePoll) return {};
    const q = pollQuestion.trim();
    const opts = pollOptions.map(o => o.trim()).filter(o => o.length > 0);
    if (!q || opts.length < 2) return {};
    return { pollQuestion: q, pollOptions: opts };
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/news", { title, content, category, pinned, ...pollPayload() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      if (isAdmin) {
        toast({ title: "Posted!", description: "News published" });
      } else {
        toast({ title: "Submitted!", description: "Your post has been sent for admin review." });
      }
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      const payload: any = { title, content, category, pinned };
      const poll = pollPayload();
      if (includePoll && (poll as any).pollQuestion) {
        Object.assign(payload, poll);
      } else if (!includePoll) {
        payload.removePoll = true;
      }
      const res = await apiRequest("PATCH", `/api/news/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ title: "Updated!", description: "News post updated" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/news/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ title: "Removed", description: "Post removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/news/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ title: "Approved!", description: "Post is now live." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setComposing(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setCategory("update");
    setPinned(false);
    setIncludePoll(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  }

  function startEdit(post: NewsPost) {
    setEditingId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setCategory(post.category);
    setPinned(post.pinned);
    if (post.pollQuestion && post.pollOptions && post.pollOptions.length >= 2) {
      setIncludePoll(true);
      setPollQuestion(post.pollQuestion);
      setPollOptions([...post.pollOptions]);
    } else {
      setIncludePoll(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
    }
    setComposing(true);
  }

  const approvedPosts = posts.filter(p => p.status === "approved");
  const pendingPosts = posts.filter(p => p.status === "pending");

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
          <Newspaper className="w-8 h-8 text-blue-500" /> News
        </h1>
        {user && !composing && (
          <Button onClick={() => { resetForm(); setComposing(true); }} className="gap-2 font-bold" data-testid="button-new-post">
            <Plus className="w-4 h-4" /> {isAdmin ? "New Post" : "Submit Post"}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground font-medium mb-6">Latest updates and announcements</p>

      {composing && user && (
        <Card className="p-5 mb-6 border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-lg">{editingId ? "Edit Post" : isAdmin ? "New Post" : "Submit a Post"}</h2>
              {!isAdmin && !editingId && (
                <p className="text-xs text-muted-foreground mt-0.5">An admin will review your post before it goes live.</p>
              )}
            </div>
            <Button size="icon" variant="ghost" onClick={resetForm} data-testid="button-cancel-post">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Post title..."
            className="font-bold"
            data-testid="input-news-title"
          />
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your post here... You can use multiple lines for longer updates."
            rows={5}
            data-testid="input-news-content"
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <Button
                key={cat.value}
                size="sm"
                variant={category === cat.value ? "default" : "outline"}
                onClick={() => setCategory(cat.value)}
                className="gap-1.5 text-xs font-bold"
                data-testid={`category-${cat.value}`}
              >
                <cat.icon className="w-3.5 h-3.5" /> {cat.label}
              </Button>
            ))}
          </div>
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-purple-500" /> Poll {includePoll && <span className="text-[10px] text-muted-foreground font-medium">(optional)</span>}
              </p>
              <Button
                variant={includePoll ? "default" : "outline"}
                size="sm"
                onClick={() => setIncludePoll(!includePoll)}
                className="gap-1.5 font-bold text-xs"
                data-testid="button-toggle-poll"
              >
                {includePoll ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {includePoll ? "Remove poll" : "Add poll"}
              </Button>
            </div>
            {includePoll && (
              <div className="space-y-2">
                <Input
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  placeholder="Poll question..."
                  maxLength={200}
                  className="text-sm"
                  data-testid="input-poll-question"
                />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={opt}
                      onChange={e => setPollOptions(prev => prev.map((p, idx) => idx === i ? e.target.value : p))}
                      placeholder={`Option ${i + 1}`}
                      maxLength={80}
                      className="text-sm"
                      data-testid={`input-poll-option-${i}`}
                    />
                    {pollOptions.length > 2 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-red-500"
                        onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))}
                        data-testid={`remove-poll-option-${i}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPollOptions(prev => [...prev, ""])}
                    className="gap-1.5 font-bold text-xs"
                    data-testid="button-add-poll-option"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add option
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground">2-6 options. Voters can pick one. Editing the poll resets votes.</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            {isAdmin ? (
              <Button
                variant={pinned ? "default" : "outline"}
                size="sm"
                onClick={() => setPinned(!pinned)}
                className="gap-1.5 font-bold text-xs"
                data-testid="button-toggle-pin"
              >
                <Pin className="w-3.5 h-3.5" /> {pinned ? "Pinned" : "Pin this post"}
              </Button>
            ) : <div />}
            <Button
              onClick={() => editingId ? updateMutation.mutate(editingId) : createMutation.mutate()}
              disabled={!title || !content || createMutation.isPending || updateMutation.isPending}
              className="gap-2 font-black"
              data-testid="button-submit-post"
            >
              <Check className="w-4 h-4" /> {editingId ? "Update" : isAdmin ? "Publish" : "Submit for Review"}
            </Button>
          </div>
        </Card>
      )}

      {isAdmin && pendingPosts.length > 0 && (
        <div className="mb-6">
          <h2 className="font-black text-base flex items-center gap-2 mb-3 text-yellow-600 dark:text-yellow-400">
            <Clock className="w-4 h-4" /> Pending Review ({pendingPosts.length})
          </h2>
          <div className="space-y-3">
            {pendingPosts.map(post => {
              const catInfo = getCategoryInfo(post.category);
              const CatIcon = catInfo.icon;
              return (
                <Card key={post.id} className="p-4 border-dashed border-yellow-500/60 bg-yellow-500/5" data-testid={`pending-post-${post.id}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${catInfo.color} flex items-center justify-center text-white shrink-0 mt-0.5`}>
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="font-black leading-tight">{post.title}</h3>
                        <Badge className="text-[10px] bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-400/50 gap-1">
                          <Clock className="w-2.5 h-2.5" /> Pending
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {post.authorName}</span>
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                      <p className="text-sm text-foreground/70 whitespace-pre-wrap line-clamp-3">{post.content}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white h-7"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(post.id)}
                        data-testid={`button-approve-${post.id}`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs font-bold text-red-500 border-red-400/50 h-7 hover:bg-red-500/10"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(post.id)}
                        data-testid={`button-reject-${post.id}`}
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : approvedPosts.length === 0 && !isAdmin ? (
        <div className="text-center py-16">
          <Newspaper className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-medium text-lg">No news yet!</p>
          <p className="text-sm text-muted-foreground">Check back soon for updates.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.filter(p => p.status === "approved" || (!isAdmin && p.authorId === currentUserId && p.status === "pending")).map((post, i) => {
            const catInfo = getCategoryInfo(post.category);
            const CatIcon = catInfo.icon;
            const isPending = post.status === "pending";
            const isMyPendingPost = isPending && post.authorId === currentUserId && !isAdmin;
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={`p-5 ${isPending ? "border-dashed border-yellow-500/50 bg-yellow-500/5" : post.pinned ? "ring-2 ring-yellow-500/30 bg-yellow-500/5" : "border-border"}`}
                  data-testid={`news-post-${post.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${catInfo.color} flex items-center justify-center text-white shrink-0 mt-0.5`}>
                      <CatIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {post.pinned && !isPending && (
                          <Pin className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                        )}
                        {isPending && (
                          <Badge className="text-[10px] bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-400/50 gap-1">
                            <Clock className="w-2.5 h-2.5" /> Pending Review
                          </Badge>
                        )}
                        <h3 className="font-black text-lg leading-tight">{post.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] font-bold gap-1">
                          <CatIcon className="w-3 h-3" /> {catInfo.label}
                        </Badge>
                        <span className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors" onClick={() => setProfileUsername(post.authorName)}>
                          <User className="w-3 h-3" /> {post.authorName}
                        </span>
                        {post.authorIsVip && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">VIP</span>
                        )}
                        {post.authorTitle && (() => {
                          const t = getTitle(post.authorTitle);
                          return t ? <span className={`text-[9px] font-bold text-purple-500 dark:text-purple-400 ${getTitleAnimClass(post.authorTitle)}`}>{t}</span> : null;
                        })()}
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                      <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </div>
                      {!isPending && <PostPoll post={post} />}
                      {!isPending && <PostComments postId={post.id} isAdmin={isAdmin} authorId={post.authorId} onViewProfile={setProfileUsername} />}
                      {isMyPendingPost && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                          Your post is waiting for an admin to review it.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {isAdmin && !isPending && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(post)} data-testid={`button-edit-${post.id}`}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(post.id)} data-testid={`button-delete-${post.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {isMyPendingPost && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(post.id)} data-testid={`button-withdraw-${post.id}`} title="Withdraw submission">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
      <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
    </div>
  );
}
