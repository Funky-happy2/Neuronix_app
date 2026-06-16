import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart, Rocket, Plus, Trash2, Play, ArrowLeft, X,
  Users, Trophy, Timer, CheckCircle, XCircle, Sparkles,
  BookOpen, Gamepad2, Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { CommunityPack, CommunityQuestion } from "@shared/schema";
import { getTitle, getTitleAnimClass } from "@/lib/titles";

type TabType = "browse" | "create" | "my-packs";

const GAME_MODE_OPTIONS = [
  { value: "speed_quiz", label: "Speed Quiz" },
  { value: "matching", label: "Memory Match" },
  { value: "fill_blank", label: "Fill the Blank" },
  { value: "elimination", label: "Elimination Round" },
  { value: "type_answer", label: "Type the Answer" },
];

interface QuestionDraft {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const emptyQuestion = (): QuestionDraft => ({
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
});

type PackWithQuestions = CommunityPack & { questions: CommunityQuestion[] };

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabType>("browse");
  const [playingPack, setPlayingPack] = useState<PackWithQuestions | null>(null);

  const { data: packs = [], isLoading } = useQuery<CommunityPack[]>({
    queryKey: ["/api/community/packs"],
  });

  const { data: myPacks = [] } = useQuery<CommunityPack[]>({
    queryKey: ["/api/community/my-packs"],
  });

  if (playingPack) {
    return (
      <PlayCommunityPack
        pack={playingPack}
        onBack={() => setPlayingPack(null)}
        onFinish={() => {
          setPlayingPack(null);
          queryClient.invalidateQueries({ queryKey: ["/api/community/packs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/community/my-packs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-cyan-400" />
        <h1 className="text-3xl font-black tracking-tight">Community Hub</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {([
          { id: "browse" as TabType, label: "Browse Packs", icon: BookOpen },
          { id: "create" as TabType, label: "Create Pack", icon: Plus },
          { id: "my-packs" as TabType, label: "My Packs", icon: Star },
        ]).map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            onClick={() => setTab(t.id)}
            className="gap-2 font-bold"
            data-testid={`tab-${t.id}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </Button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "browse" && (
          <motion.div key="browse" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <BrowseTab packs={packs} isLoading={isLoading} onPlay={setPlayingPack} />
          </motion.div>
        )}
        {tab === "create" && (
          <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <CreateTab onCreated={() => {
              setTab("my-packs");
              queryClient.invalidateQueries({ queryKey: ["/api/community/packs"] });
              queryClient.invalidateQueries({ queryKey: ["/api/community/my-packs"] });
            }} />
          </motion.div>
        )}
        {tab === "my-packs" && (
          <motion.div key="my-packs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <MyPacksTab packs={myPacks} onPlay={setPlayingPack} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BrowseTab({ packs, isLoading, onPlay }: { packs: CommunityPack[]; isLoading: boolean; onPlay: (p: PackWithQuestions) => void }) {
  const [search, setSearch] = useState("");

  const filtered = packs.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.creatorName.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground font-semibold">Loading packs...</div>;
  }

  return (
    <div>
      <Input
        placeholder="Search packs by title or creator..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
        data-testid="input-search-packs"
      />

      {filtered.length === 0 ? (
        <Card className="p-8 text-center border-border">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-lg font-bold mb-1">No packs yet!</p>
          <p className="text-sm text-muted-foreground">Be the first to create a question pack for the community.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pack) => (
            <PackCard key={pack.id} pack={pack} onPlay={onPlay} showCreator />
          ))}
        </div>
      )}
    </div>
  );
}

function PackCard({ pack, onPlay, showCreator, onDelete }: {
  pack: CommunityPack;
  onPlay: (p: PackWithQuestions) => void;
  showCreator?: boolean;
  onDelete?: (id: number) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [liked, setLiked] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const [localLikes, setLocalLikes] = useState(pack.likes);
  const [localBoosts, setLocalBoosts] = useState(pack.boosts);

  useEffect(() => {
    if (user) {
      apiRequest("GET", `/api/community/packs/${pack.id}/reactions`).then(async (res) => {
        const data = await res.json();
        setLiked(data.liked);
        setBoosted(data.boosted);
      }).catch(() => {});
    }
  }, [pack.id, user]);

  const handlePlay = async () => {
    setLoadingPlay(true);
    try {
      const res = await apiRequest("GET", `/api/community/packs/${pack.id}`);
      const data = await res.json();
      onPlay(data as PackWithQuestions);
    } catch {
      toast({ title: "Error", description: "Failed to load pack", variant: "destructive" });
    }
    setLoadingPlay(false);
  };

  const handleReact = async (type: "like" | "boost") => {
    try {
      const res = await apiRequest("POST", `/api/community/packs/${pack.id}/react`, { type });
      const data = await res.json();
      if (type === "like") {
        setLiked(data.action === "added");
        setLocalLikes((l) => data.action === "added" ? l + 1 : Math.max(0, l - 1));
      } else {
        setBoosted(data.action === "added");
        setLocalBoosts((b) => data.action === "added" ? b + 1 : Math.max(0, b - 1));
      }
    } catch {
      toast({ title: "Error", description: "Can't react to your own pack", variant: "destructive" });
    }
  };

  const isOwn = user?.id === pack.creatorId;

  return (
    <Card className="p-4 border-border hover:border-cyan-500/30 transition-colors" data-testid={`card-pack-${pack.id}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-bold text-lg leading-tight">{pack.title}</h3>
          {showCreator && (
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <p className="text-xs text-muted-foreground font-semibold">by {pack.creatorName}</p>
              {(pack as any).creatorIsVip && (
                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">VIP</span>
              )}
              {(pack as any).creatorTitle && (() => {
                const titleText = getTitle((pack as any).creatorTitle);
                return titleText ? (
                  <span className={`text-[9px] font-bold text-purple-500 dark:text-purple-400 ${getTitleAnimClass((pack as any).creatorTitle)}`}>{titleText}</span>
                ) : null;
              })()}
            </div>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px] font-bold ml-2">{GAME_MODE_OPTIONS.find(m => m.value === pack.gameMode)?.label || "Speed Quiz"}</Badge>
      </div>

      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{pack.description}</p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {pack.plays}</span>
        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {localLikes}</span>
        <span className="flex items-center gap-1"><Rocket className="w-3 h-3" /> {localBoosts}</span>
        <Badge variant="outline" className="text-[10px]">Y{pack.yearLevel}</Badge>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handlePlay} disabled={loadingPlay} className="gap-1.5 font-bold flex-1" data-testid={`button-play-pack-${pack.id}`}>
          <Gamepad2 className="w-3.5 h-3.5" /> {loadingPlay ? "Loading..." : "Play"}
        </Button>
        {!isOwn && (
          <>
            <Button size="sm" variant={liked ? "default" : "outline"} onClick={() => handleReact("like")} className="gap-1 font-bold" data-testid={`button-like-pack-${pack.id}`}>
              <Heart className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`} />
            </Button>
            <Button size="sm" variant={boosted ? "default" : "outline"} onClick={() => handleReact("boost")} className="gap-1 font-bold bg-gradient-to-r from-purple-500 to-pink-500 border-0 text-white hover:opacity-80" data-testid={`button-boost-pack-${pack.id}`}>
              <Rocket className={`w-3.5 h-3.5 ${boosted ? "fill-current" : ""}`} />
            </Button>
          </>
        )}
        {onDelete && isOwn && (
          <Button size="sm" variant="destructive" onClick={() => onDelete(pack.id)} className="gap-1 font-bold" data-testid={`button-delete-pack-${pack.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function MyPacksTab({ packs, onPlay }: { packs: CommunityPack[]; onPlay: (p: PackWithQuestions) => void }) {
  const { toast } = useToast();

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/community/packs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/my-packs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/packs"] });
      toast({ title: "Deleted!", description: "Your pack has been removed." });
    },
  });

  if (packs.length === 0) {
    return (
      <Card className="p-8 text-center border-border">
        <Star className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-lg font-bold mb-1">No packs created yet</p>
        <p className="text-sm text-muted-foreground">Create your first question pack and share it with the community!</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {packs.map((pack) => (
        <PackCard key={pack.id} pack={pack} onPlay={onPlay} onDelete={(id) => deleteMut.mutate(id)} />
      ))}
    </div>
  );
}

function CreateTab({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gameMode, setGameMode] = useState("speed_quiz");
  const [yearLevel, setYearLevel] = useState(7);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion(), emptyQuestion(), emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);

  const updateQuestion = (idx: number, field: keyof QuestionDraft, value: any) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIdx].options];
      opts[oIdx] = value;
      copy[qIdx] = { ...copy[qIdx], options: opts };
      return copy;
    });
  };

  const addQuestion = () => {
    if (questions.length >= 20) return;
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 3) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Missing title", description: "Give your pack a name!", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Missing description", description: "Describe what your pack is about!", variant: "destructive" });
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        toast({ title: `Question ${i + 1}`, description: "Enter the question text!", variant: "destructive" });
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        toast({ title: `Question ${i + 1}`, description: "Fill in all 4 answer options!", variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/community/packs", {
        title,
        description,
        gameMode,
        yearLevel,
        questions,
      });
      toast({ title: "Pack created!", description: "Your question pack is now live for everyone to play!" });
      onCreated();
    } catch {
      toast({ title: "Error", description: "Failed to create pack", variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl">
      <Card className="p-6 border-border mb-6">
        <h2 className="text-xl font-bold mb-4">Pack Details</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold mb-1 block">Title</label>
            <Input
              placeholder="e.g. Solar System Challenge"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              data-testid="input-pack-title"
            />
          </div>

          <div>
            <label className="text-sm font-bold mb-1 block">Description</label>
            <Textarea
              placeholder="What is your pack about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              data-testid="input-pack-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold mb-1 block">Game Mode</label>
              <Select value={gameMode} onValueChange={setGameMode}>
                <SelectTrigger data-testid="select-game-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAME_MODE_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-bold mb-1 block">Year Level</label>
              <Select value={String(yearLevel)} onValueChange={(v) => setYearLevel(Number(v))}>
                <SelectTrigger data-testid="select-year-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 6, 7, 8, 9].map((y) => (
                    <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <h2 className="text-xl font-bold mb-3">Questions ({questions.length}/20)</h2>

      {questions.map((q, qIdx) => (
        <Card key={qIdx} className="p-4 border-border mb-3">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="secondary" className="font-bold">Q{qIdx + 1}</Badge>
            {questions.length > 3 && (
              <Button size="sm" variant="ghost" onClick={() => removeQuestion(qIdx)} className="text-red-400 h-7 px-2" data-testid={`button-remove-q-${qIdx}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <Input
            placeholder="Enter your question..."
            value={q.question}
            onChange={(e) => updateQuestion(qIdx, "question", e.target.value)}
            className="mb-3"
            data-testid={`input-question-${qIdx}`}
          />

          <div className="grid grid-cols-2 gap-2 mb-2">
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <button
                  type="button"
                  className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    q.correctIndex === oIdx
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => updateQuestion(qIdx, "correctIndex", oIdx)}
                  data-testid={`button-correct-${qIdx}-${oIdx}`}
                >
                  {q.correctIndex === oIdx ? <CheckCircle className="w-4 h-4" /> : String.fromCharCode(65 + oIdx)}
                </button>
                <Input
                  placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                  value={opt}
                  onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                  className="flex-1"
                  data-testid={`input-option-${qIdx}-${oIdx}`}
                />
              </div>
            ))}
          </div>

          <Input
            placeholder="Explanation (optional)"
            value={q.explanation}
            onChange={(e) => updateQuestion(qIdx, "explanation", e.target.value)}
            className="text-sm"
            data-testid={`input-explanation-${qIdx}`}
          />
        </Card>
      ))}

      <div className="flex gap-3 mt-4">
        {questions.length < 20 && (
          <Button variant="outline" onClick={addQuestion} className="gap-2 font-bold" data-testid="button-add-question">
            <Plus className="w-4 h-4" /> Add Question
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={submitting} className="gap-2 font-bold" data-testid="button-publish-pack">
          <Sparkles className="w-4 h-4" /> {submitting ? "Publishing..." : "Publish Pack"}
        </Button>
      </div>
    </div>
  );
}

function PlayCommunityPack({ pack, onBack, onFinish }: { pack: PackWithQuestions; onBack: () => void; onFinish: () => void }) {
  const { toast } = useToast();
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(pack.questions.length * 12);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const correctRef = useRef(correct);
  correctRef.current = correct;
  const questionsRef = useRef(pack.questions);
  const rawMode = pack.gameMode || "speed_quiz";
  const mode = rawMode === "sorting" ? "speed_quiz" : rawMode;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); setGameOver(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (lives <= 0) setGameOver(true);
  }, [lives]);

  const addScore = (pts: number, isCorrect: boolean) => {
    if (isCorrect) {
      const comboBonus = Math.min(combo, 5) * 10;
      setScore(s => s + pts + comboBonus);
      setCorrect(c => c + 1);
      setCombo(c => c + 1);
    } else {
      setCombo(0);
      if (mode === "elimination") setLives(l => l - 1);
    }
  };

  const handleFinish = async () => {
    try {
      const totalQ = questionsRef.current.length;
      const res = await apiRequest("POST", `/api/community/packs/${pack.id}/play`, {
        score: scoreRef.current,
        correct: correctRef.current,
        totalQuestions: totalQ,
      });
      const data = await res.json().catch(() => ({}));
      const xpEarned = data.xpEarned ?? 10;
      const coinsEarned = data.coinsEarned ?? 0;
      toast({
        title: `+${xpEarned} XP!${coinsEarned > 0 ? ` +${coinsEarned} Neuros` : ""}`,
        description: "Pack complete — reward collected!",
      });
      apiRequest("POST", "/api/daily-challenge/complete", { challengeType: "community-play" }).catch(() => {});
    } catch {}
    onFinish();
  };

  if (gameOver) {
    const total = questionsRef.current.length || 1;
    const pct = Math.round((correctRef.current / total) * 100);
    const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
    const xpPreview = Math.round(10 + (pct / 100) * 40);
    const coinsPreview = Math.floor(pct / 25);
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <Card className="p-8 text-center border-border">
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3].map(s => (
                <motion.div key={s} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: s * 0.2 }}>
                  <Star className={`w-10 h-10 ${s <= stars ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-600"}`} />
                </motion.div>
              ))}
            </div>
            <h1 className="text-3xl font-black mb-2" data-testid="text-community-result">
              {stars === 3 ? "PERFECT!" : stars === 2 ? "Great Job!" : stars === 1 ? "Nice Try!" : "Keep Practicing!"}
            </h1>
            <p className="text-lg font-bold mb-1">{pack.title}</p>
            <p className="text-muted-foreground font-medium mb-4">
              {correctRef.current}/{total} correct ({pct}%)
            </p>
            <div className="flex gap-3 justify-center mb-4 flex-wrap">
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 font-bold">
                Score: {scoreRef.current}
              </Badge>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-bold">
                +{xpPreview} XP
              </Badge>
              {coinsPreview > 0 && (
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-bold">
                  +{coinsPreview} coins
                </Badge>
              )}
              {stars === 3 && (
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 font-bold">
                  <Sparkles className="w-3 h-3 mr-1" /> Perfect Star
                </Badge>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={handleFinish} className="gap-2 font-bold" data-testid="button-collect-community">
                <Sparkles className="w-4 h-4" /> Collect Reward & Back
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const topBar = (
    <div className="flex items-center justify-between mb-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 font-semibold" data-testid="button-quit-community">
        <ArrowLeft className="w-4 h-4" /> Quit
      </Button>
      <div className="flex gap-2 flex-wrap">
        {mode === "elimination" && (
          <Badge variant="destructive" className="font-bold gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart key={i} className={`w-3.5 h-3.5 ${i < lives ? "fill-white text-white" : "fill-white/30 text-white/30"}`} />
            ))}
          </Badge>
        )}
        {combo > 1 && (
          <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 font-bold animate-pulse">
            {combo}x Combo!
          </Badge>
        )}
        <Badge variant="secondary" className="font-bold">
          <Timer className="w-3 h-3 mr-1" /> {timeLeft}s
        </Badge>
        <Badge variant="outline" className="font-bold">
          Score: {score}
        </Badge>
      </div>
    </div>
  );

  const packHeader = (
    <Card className="p-3 mb-3 border-border bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-muted-foreground">{pack.title} by {pack.creatorName}</p>
        <Badge variant="secondary" className="text-xs font-bold">
          {GAME_MODE_OPTIONS.find(m => m.value === mode)?.label || "Speed Quiz"}
        </Badge>
      </div>
    </Card>
  );

  if (mode === "matching") {
    return (
      <div className="min-h-screen max-w-3xl mx-auto px-4 py-6">
        {topBar}
        {packHeader}
        <MemoryMatchMode questions={questionsRef.current} onScore={addScore} onEnd={() => setGameOver(true)} />
      </div>
    );
  }

  if (mode === "fill_blank") {
    return (
      <div className="min-h-screen max-w-3xl mx-auto px-4 py-6">
        {topBar}
        {packHeader}
        <FillBlankMode questions={questionsRef.current} onScore={addScore} onEnd={() => setGameOver(true)} />
      </div>
    );
  }

  if (mode === "elimination") {
    return (
      <div className="min-h-screen max-w-3xl mx-auto px-4 py-6">
        {topBar}
        {packHeader}
        <EliminationMode questions={questionsRef.current} onScore={addScore} onEnd={() => setGameOver(true)} lives={lives} />
      </div>
    );
  }

  if (mode === "type_answer") {
    return (
      <div className="min-h-screen max-w-3xl mx-auto px-4 py-6">
        {topBar}
        {packHeader}
        <TypeAnswerMode questions={questionsRef.current} onScore={addScore} onEnd={() => setGameOver(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-6">
      {topBar}
      {packHeader}
      <SpeedQuizMode questions={questionsRef.current} onScore={addScore} onEnd={() => setGameOver(true)} />
    </div>
  );
}

function SpeedQuizMode({ questions, onScore, onEnd }: { questions: CommunityQuestion[]; onScore: (pts: number, correct: boolean) => void; onEnd: () => void }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(8);

  useEffect(() => {
    setQuestionTimer(8);
    const t = setInterval(() => {
      setQuestionTimer(prev => {
        if (prev <= 1) { clearInterval(t); onScore(0, false); advance(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [currentQ]);

  const advance = () => {
    setTimeout(() => {
      setSelected(null);
      setShowResult(false);
      if (currentQ + 1 >= questions.length) onEnd();
      else setCurrentQ(q => q + 1);
    }, 1200);
  };

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    setShowResult(true);
    const isCorrect = idx === questions[currentQ].correctIndex;
    const timeBonus = questionTimer * 10;
    onScore(isCorrect ? 100 + timeBonus : 0, isCorrect);
    advance();
  };

  const q = questions[currentQ];
  const shuffledOptions = useMemo(
    () => q.options.map((text, origIdx) => ({ text, origIdx })).sort(() => Math.random() - 0.5),
    [currentQ] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div key={currentQ} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
        <Card className="p-6 mb-4 border-border relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-1000" style={{ width: `${(questionTimer / 8) * 100}%` }} />
          <Badge variant="secondary" className="mb-2 text-xs font-bold">
            Question {currentQ + 1}/{questions.length}
          </Badge>
          <h2 className="text-lg font-bold mt-1">{q.question}</h2>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shuffledOptions.map(({ text, origIdx }, i) => {
            let extraClass = "";
            if (showResult) {
              if (origIdx === q.correctIndex) extraClass = "border-emerald-500 bg-emerald-500/10 scale-[1.02]";
              else if (selected === origIdx) extraClass = "border-red-500 bg-red-500/10 scale-95 opacity-60";
              else extraClass = "opacity-40";
            }
            return (
              <motion.div key={i} whileHover={!showResult ? { scale: 1.02 } : {}} whileTap={!showResult ? { scale: 0.98 } : {}}>
                <Card
                  className={`p-4 cursor-pointer border-2 border-border transition-all hover-elevate ${extraClass}`}
                  onClick={() => handleAnswer(origIdx)}
                  data-testid={`button-community-answer-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm flex-shrink-0 transition-colors ${
                      showResult && origIdx === q.correctIndex ? "bg-emerald-500 text-white" :
                      showResult && selected === origIdx ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {showResult && origIdx === q.correctIndex ? <CheckCircle className="w-5 h-5" /> :
                       showResult && selected === origIdx ? <XCircle className="w-5 h-5" /> :
                       String.fromCharCode(65 + i)}
                    </div>
                    <span className="font-semibold text-sm">{text}</span>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {showResult && q.explanation && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4 mt-4 border-border bg-blue-500/5 border-blue-500/20">
              <p className="text-sm font-medium">{q.explanation}</p>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function MemoryMatchMode({ questions, onScore, onEnd }: { questions: CommunityQuestion[]; onScore: (pts: number, correct: boolean) => void; onEnd: () => void }) {
  const pairs = questions.slice(0, 6);
  const [cards, setCards] = useState<{ id: number; text: string; type: "q" | "a"; pairId: number; flipped: boolean; matched: boolean }[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [canFlip, setCanFlip] = useState(true);

  useEffect(() => {
    const cardList: typeof cards = [];
    pairs.forEach((q, i) => {
      cardList.push({ id: i * 2, text: q.question, type: "q", pairId: i, flipped: false, matched: false });
      cardList.push({ id: i * 2 + 1, text: q.options[q.correctIndex], type: "a", pairId: i, flipped: false, matched: false });
    });
    setCards(cardList.sort(() => Math.random() - 0.5));
  }, []);

  useEffect(() => {
    if (matchedCount === pairs.length && pairs.length > 0) {
      setTimeout(() => onEnd(), 800);
    }
  }, [matchedCount, pairs.length]);

  const handleFlip = (cardIdx: number) => {
    if (!canFlip || cards[cardIdx].flipped || cards[cardIdx].matched) return;

    const newCards = [...cards];
    newCards[cardIdx].flipped = true;
    setCards(newCards);
    const newFlipped = [...flippedCards, cardIdx];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setCanFlip(false);
      const [first, second] = newFlipped;
      if (cards[first].pairId === newCards[second].pairId && cards[first].type !== newCards[second].type) {
        setTimeout(() => {
          const matched = [...newCards];
          matched[first].matched = true;
          matched[second].matched = true;
          setCards(matched);
          setFlippedCards([]);
          setCanFlip(true);
          setMatchedCount(c => c + 1);
          onScore(150, true);
        }, 600);
      } else {
        setTimeout(() => {
          const reset = [...newCards];
          reset[first].flipped = false;
          reset[second].flipped = false;
          setCards(reset);
          setFlippedCards([]);
          setCanFlip(true);
          onScore(0, false);
        }, 1000);
      }
    }
  };

  return (
    <div>
      <Card className="p-4 mb-4 border-border bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <p className="text-sm font-bold text-center">Match each question with its correct answer!</p>
        <p className="text-xs text-muted-foreground text-center mt-1">Matched: {matchedCount}/{pairs.length}</p>
      </Card>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {cards.map((card, idx) => (
          <motion.div key={card.id} whileHover={{ scale: card.matched ? 1 : 1.03 }} whileTap={{ scale: 0.95 }}>
            <Card
              className={`p-3 min-h-[80px] flex items-center justify-center cursor-pointer border-2 transition-all text-center ${
                card.matched ? "border-emerald-500/50 bg-emerald-500/10 opacity-60" :
                card.flipped ? (card.type === "q" ? "border-cyan-500 bg-cyan-500/10" : "border-purple-500 bg-purple-500/10") :
                "border-border bg-muted/30 hover-elevate"
              }`}
              onClick={() => handleFlip(idx)}
              data-testid={`card-match-${idx}`}
            >
              {card.flipped || card.matched ? (
                <p className="text-xs font-semibold leading-tight">{card.text.length > 50 ? card.text.slice(0, 47) + "..." : card.text}</p>
              ) : (
                <span className="text-2xl">?</span>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FillBlankMode({ questions, onScore, onEnd }: { questions: CommunityQuestion[]; onScore: (pts: number, correct: boolean) => void; onEnd: () => void }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedLetters, setSelectedLetters] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const [scrambled, setScrambled] = useState<string[]>([]);
  const q = questions[currentQ];
  const answer = q.options[q.correctIndex].toUpperCase();

  useEffect(() => {
    const letters = answer.split("");
    const extra = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter(l => !letters.includes(l)).slice(0, Math.max(3, Math.floor(letters.length * 0.5)));
    setScrambled([...letters, ...extra].sort(() => Math.random() - 0.5));
    setSelectedLetters([]);
    setAnswered(false);
  }, [currentQ]);

  const toggleLetter = (idx: number) => {
    if (answered) return;
    setSelectedLetters(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const checkAnswer = () => {
    const attempt = selectedLetters.map(i => scrambled[i]).join("");
    const isCorrect = attempt === answer;
    setAnswered(true);
    onScore(isCorrect ? 120 : 0, isCorrect);
    setTimeout(() => {
      if (currentQ + 1 >= questions.length) onEnd();
      else setCurrentQ(q => q + 1);
    }, 1500);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div key={currentQ} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6 mb-4 border-border">
          <Badge variant="secondary" className="mb-2 text-xs font-bold">
            Question {currentQ + 1}/{questions.length}
          </Badge>
          <h2 className="text-lg font-bold">{q.question}</h2>
          <p className="text-sm text-muted-foreground mt-2">Tap the letters to spell the answer!</p>
        </Card>

        <Card className="p-4 mb-4 border-border bg-muted/30 min-h-[50px] flex items-center justify-center gap-1 flex-wrap">
          {selectedLetters.length === 0 ? (
            <p className="text-sm text-muted-foreground font-medium">Tap letters below...</p>
          ) : (
            selectedLetters.map((li, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`w-9 h-9 rounded-md flex items-center justify-center font-black text-sm ${
                  answered
                    ? (selectedLetters.map(idx => scrambled[idx]).join("") === answer ? "bg-emerald-500 text-white" : "bg-red-500 text-white")
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {scrambled[li]}
              </motion.span>
            ))
          )}
        </Card>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {scrambled.map((letter, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`w-10 h-10 rounded-md font-bold text-sm transition-all ${
                selectedLetters.includes(idx)
                  ? "bg-primary/20 text-primary/40 border-2 border-dashed border-primary/30"
                  : "bg-muted text-foreground border-2 border-border"
              }`}
              onClick={() => toggleLetter(idx)}
              disabled={answered}
              data-testid={`button-letter-${idx}`}
            >
              {letter}
            </motion.button>
          ))}
        </div>

        {!answered && selectedLetters.length > 0 && (
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setSelectedLetters([])} className="font-bold gap-1" data-testid="button-clear-letters">
              Clear
            </Button>
            <Button onClick={checkAnswer} className="font-bold gap-1" data-testid="button-check-answer">
              <CheckCircle className="w-4 h-4" /> Check Answer
            </Button>
          </div>
        )}

        {answered && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="p-3 mt-3 border-border bg-blue-500/5 border-blue-500/20 text-center">
              <p className="text-sm font-bold">Answer: {answer}</p>
              {q.explanation && <p className="text-xs text-muted-foreground mt-1">{q.explanation}</p>}
            </Card>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function EliminationMode({ questions, onScore, onEnd, lives }: { questions: CommunityQuestion[]; onScore: (pts: number, correct: boolean) => void; onEnd: () => void; lives: number }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const q = questions[currentQ];

  const handleEliminate = () => {
    if (eliminated.length >= 2) return;
    const wrongOpts = q.options.map((_, i) => i).filter(i => i !== q.correctIndex && !eliminated.includes(i));
    if (wrongOpts.length > 0) {
      setEliminated(prev => [...prev, wrongOpts[Math.floor(Math.random() * wrongOpts.length)]]);
    }
  };

  const handleAnswer = (idx: number) => {
    if (selected !== null || eliminated.includes(idx)) return;
    setSelected(idx);
    setShowResult(true);
    const isCorrect = idx === q.correctIndex;
    const eliminationPenalty = eliminated.length * 30;
    onScore(isCorrect ? Math.max(50, 150 - eliminationPenalty) : 0, isCorrect);
    setTimeout(() => {
      setSelected(null);
      setShowResult(false);
      setEliminated([]);
      if (currentQ + 1 >= questions.length) onEnd();
      else setCurrentQ(q => q + 1);
    }, 1500);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div key={currentQ} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="p-6 mb-4 border-border border-2 border-red-500/20">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary" className="text-xs font-bold">
              Round {currentQ + 1}/{questions.length}
            </Badge>
            {!showResult && eliminated.length < 2 && (
              <Button size="sm" variant="outline" onClick={handleEliminate} className="text-xs font-bold gap-1 border-orange-500/30 text-orange-500" data-testid="button-eliminate">
                <XCircle className="w-3 h-3" /> Eliminate ({2 - eliminated.length} left)
              </Button>
            )}
          </div>
          <h2 className="text-lg font-bold">{q.question}</h2>
          <p className="text-xs text-muted-foreground mt-1">Wrong answer = lose a life! Use Eliminate to remove wrong options (fewer points)</p>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {q.options.map((opt, i) => {
            if (eliminated.includes(i)) {
              return (
                <motion.div key={i} initial={{ scale: 1 }} animate={{ scale: 0.8, opacity: 0.3 }}>
                  <Card className="p-4 border-2 border-dashed border-border opacity-30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="font-semibold text-sm line-through text-muted-foreground">{opt}</span>
                    </div>
                  </Card>
                </motion.div>
              );
            }
            let extraClass = "";
            if (showResult) {
              if (i === q.correctIndex) extraClass = "border-emerald-500 bg-emerald-500/10";
              else if (i === selected) extraClass = "border-red-500 bg-red-500/10 animate-shake";
            }
            return (
              <motion.div key={i} whileHover={!showResult ? { scale: 1.02 } : {}} whileTap={!showResult ? { scale: 0.97 } : {}}>
                <Card
                  className={`p-4 cursor-pointer border-2 border-border transition-all hover-elevate ${extraClass}`}
                  onClick={() => handleAnswer(i)}
                  data-testid={`button-community-answer-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      showResult && i === q.correctIndex ? "bg-emerald-500 text-white" :
                      showResult && i === selected ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {showResult && i === q.correctIndex ? <CheckCircle className="w-5 h-5" /> :
                       showResult && i === selected ? <XCircle className="w-5 h-5" /> :
                       String.fromCharCode(65 + i)}
                    </div>
                    <span className="font-semibold text-sm">{opt}</span>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function TypeAnswerMode({ questions, onScore, onEnd }: { questions: CommunityQuestion[]; onScore: (pts: number, correct: boolean) => void; onEnd: () => void }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [typed, setTyped] = useState("");
  const [answered, setAnswered] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = questions[currentQ];
  const correctAnswer = q.options[q.correctIndex];

  useEffect(() => {
    setTyped("");
    setAnswered(false);
    setHintUsed(false);
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [currentQ]);

  const checkMatch = (input: string, answer: string): boolean => {
    const clean = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    return clean(input) === clean(answer);
  };

  const handleSubmit = () => {
    if (!typed.trim() || answered) return;
    const isCorrect = checkMatch(typed, correctAnswer);
    setAnswered(true);
    onScore(isCorrect ? (hintUsed ? 60 : 130) : 0, isCorrect);
    setTimeout(() => {
      if (currentQ + 1 >= questions.length) onEnd();
      else setCurrentQ(q => q + 1);
    }, 2000);
  };

  const getHint = () => {
    if (hintUsed) return;
    setHintUsed(true);
    const ans = correctAnswer;
    const reveal = Math.ceil(ans.length * 0.4);
    setTyped(ans.slice(0, reveal));
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div key={currentQ} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6 mb-4 border-border">
          <Badge variant="secondary" className="mb-2 text-xs font-bold">
            Question {currentQ + 1}/{questions.length}
          </Badge>
          <h2 className="text-lg font-bold">{q.question}</h2>
        </Card>

        <Card className="p-4 mb-3 border-border">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={typed}
              onChange={(e) => !answered && setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Type your answer..."
              className={`font-bold text-base ${
                answered
                  ? checkMatch(typed, correctAnswer) ? "border-emerald-500 text-emerald-600" : "border-red-500 text-red-600"
                  : ""
              }`}
              disabled={answered}
              data-testid="input-type-answer"
            />
            {!answered && (
              <Button onClick={handleSubmit} disabled={!typed.trim()} className="font-bold gap-1 shrink-0" data-testid="button-submit-answer">
                <CheckCircle className="w-4 h-4" /> Go
              </Button>
            )}
          </div>
          {!answered && !hintUsed && (
            <Button variant="ghost" size="sm" onClick={getHint} className="mt-2 text-xs text-muted-foreground font-semibold" data-testid="button-hint">
              <Sparkles className="w-3 h-3 mr-1" /> Use Hint (fewer points)
            </Button>
          )}
        </Card>

        {answered && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={`p-4 border-2 ${checkMatch(typed, correctAnswer) ? "border-emerald-500 bg-emerald-500/10" : "border-red-500 bg-red-500/10"}`}>
              <div className="flex items-center gap-2 mb-1">
                {checkMatch(typed, correctAnswer) ? (
                  <><CheckCircle className="w-5 h-5 text-emerald-500" /> <span className="font-bold text-emerald-600 dark:text-emerald-400">Correct!</span></>
                ) : (
                  <><XCircle className="w-5 h-5 text-red-500" /> <span className="font-bold text-red-600 dark:text-red-400">Answer: {correctAnswer}</span></>
                )}
              </div>
              {q.explanation && <p className="text-sm text-muted-foreground">{q.explanation}</p>}
            </Card>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
