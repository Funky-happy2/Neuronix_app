import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  BookOpen, Lock, CheckCircle2, ChevronRight, ChevronLeft, MessageCircle, Swords, Trophy,
  Zap, Coins, Gem, Loader2, Flag, Play, Footprints, GitBranch, Users, KeyRound,
} from "lucide-react";
import { StoryLevel } from "@/components/StoryLevel";
import {
  STORIES, isNodeComplete, isChapterUnlocked, totalStoryNodes, storyNodesDone,
  resolveDialogueText, getChosenOptionId, storyUnlockState,
  type Story, type StoryChapter, type StoryNode, type StoryReward,
} from "@shared/story";

export default function StoryPage() {
  const { toast } = useToast();
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/user"] });
  const inventory: string[] = user?.inventory || [];
  const level: number = (user as any)?.level || 0;

  // Active playable level (rendered full-screen).
  const [playing, setPlaying] = useState<{ node: StoryNode; chapter: StoryChapter } | null>(null);
  // Which story is open (null = the story-selection hub).
  const [storyId, setStoryId] = useState<string | null>(null);

  const rewardToast = (reward?: StoryReward | null) => {
    if (!reward) return;
    const parts = [reward.xp && `+${reward.xp} XP`, reward.coins && `+${reward.coins} Neuros`, reward.gems && `+${reward.gems} gems`, reward.badgeId && "a badge!"].filter(Boolean);
    if (parts.length) toast({ title: "Reward!", description: parts.join(" · ") });
  };

  const ack = useMutation({
    mutationFn: async (node: StoryNode) => (await apiRequest("POST", "/api/story/ack", { nodeId: node.id })).json(),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["/api/user"] }); rewardToast(data?.reward); },
    onError: (e: any) => toast({ title: "Hmm", description: e.message, variant: "destructive" }),
  });

  const clear = useMutation({
    mutationFn: async (node: StoryNode) => (await apiRequest("POST", "/api/story/clear", { nodeId: node.id })).json(),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["/api/user"] }); rewardToast(data?.reward); },
    onError: (e: any) => toast({ title: "Hmm", description: e.message, variant: "destructive" }),
  });

  const choose = useMutation({
    mutationFn: async ({ node, optionId }: { node: StoryNode; optionId: string }) =>
      (await apiRequest("POST", "/api/story/choose", { nodeId: node.id, optionId })).json(),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["/api/user"] }); rewardToast(data?.reward); },
    onError: (e: any) => toast({ title: "Hmm", description: e.message, variant: "destructive" }),
  });

  // ── Full-screen playable level ──────────────────────────────────────────────
  if (playing && playing.node.kind === "level") {
    const node = playing.node;
    // Default the level's question theme to its chapter's topic.
    const lvl = { ...node.level, topic: node.level.topic ?? playing.chapter.topic };
    return (
      <StoryLevel
        level={lvl}
        title={node.title}
        gradient={playing.chapter.gradient}
        onExit={() => setPlaying(null)}
        onWin={() => { clear.mutate(node); setPlaying(null); }}
      />
    );
  }

  if (isLoading) {
    return <div className="min-h-screen flex justify-center pt-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const story = STORIES.find((s) => s.id === storyId);

  // ── Story-selection hub ─────────────────────────────────────────────────────
  if (!story) {
    return (
      <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-sky-400 via-fuchsia-500 to-amber-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <BookOpen className="w-9 h-9 text-fuchsia-500" /> Story Mode
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Pick an adventure and play through it — region by region, boss by boss. More stories to come!</p>
        </div>
        <div className="space-y-4">
          {STORIES.map((s) => {
            const total = totalStoryNodes(s);
            const done = storyNodesDone(s, inventory);
            const complete = done >= total;
            const pct = Math.round((done / total) * 100);
            const unlock = storyUnlockState(s, { level, inventory });
            const lockText = unlock.needsStory
              ? `Finish "${unlock.needsStory.title}" first`
              : unlock.needsLevel ? `Reach Level ${unlock.needsLevel}` : "";
            return (
              <motion.button
                key={s.id}
                whileHover={unlock.unlocked ? { scale: 1.01 } : {}} whileTap={unlock.unlocked ? { scale: 0.99 } : {}}
                onClick={() => unlock.unlocked && setStoryId(s.id)}
                disabled={!unlock.unlocked}
                data-testid={`story-pick-${s.id}`}
                className={`w-full text-left rounded-2xl overflow-hidden border-2 border-border transition-all ${unlock.unlocked ? "hover:border-transparent hover:shadow-2xl cursor-pointer" : "opacity-80 cursor-not-allowed"}`}
              >
                <div className={`bg-gradient-to-r ${s.gradient} p-5 text-white flex items-center gap-4 ${unlock.unlocked ? "" : "grayscale"}`}>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl shrink-0">{s.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-black leading-tight">{s.title}</div>
                    <div className="text-sm font-semibold text-white/85">{s.subtitle}</div>
                  </div>
                  {unlock.unlocked ? (
                    <div className="inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1.5 font-black text-sm shrink-0">
                      {complete ? "Replay" : done === 0 ? "Start" : "Continue"} <ChevronRight className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 bg-black/30 rounded-full px-3 py-1.5 font-black text-xs shrink-0"><Lock className="w-3.5 h-3.5" /> Locked</div>
                  )}
                </div>
                <div className="p-4 bg-card">
                  <p className="text-sm text-muted-foreground font-medium mb-3">{s.blurb}</p>
                  {unlock.unlocked ? (
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className="text-xs font-bold text-muted-foreground shrink-0">{done}/{total}{complete ? " ✓" : ""}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                      <Lock className="w-4 h-4 shrink-0" /> {lockText} to unlock
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── A single story ──────────────────────────────────────────────────────────
  const totalNodes = totalStoryNodes(story);
  const doneCount = storyNodesDone(story, inventory);
  const storyComplete = doneCount >= totalNodes;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => setStoryId(null)} className="flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground mb-3" data-testid="story-back">
        <ChevronLeft className="w-4 h-4" /> All Stories
      </button>
      <div className="text-center mb-5">
        <h1 className={`text-4xl md:text-5xl font-black bg-gradient-to-r ${story.gradient} bg-clip-text text-transparent flex items-center justify-center gap-2`}>
          <span>{story.emoji}</span> {story.title}
        </h1>
        <p className="text-muted-foreground font-medium mt-1">{story.subtitle}</p>
      </div>

      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-black flex items-center gap-2"><Flag className="w-4 h-4 text-fuchsia-500" /> Journey Progress</span>
          <span className="font-bold text-sm text-muted-foreground">{doneCount}/{totalNodes} steps</span>
        </div>
        <Progress value={(doneCount / totalNodes) * 100} className="h-3" />
        {storyComplete && (
          <p className="mt-3 text-center font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-amber-500 flex items-center justify-center gap-1">
            <Trophy className="w-5 h-5 text-amber-500" /> Story complete — amazing work! 🌟
          </p>
        )}
      </Card>

      <div className="space-y-5">
        {story.chapters.map((chapter) => (
          <ChapterSection
            key={chapter.id}
            chapter={chapter}
            inventory={inventory}
            busy={ack.isPending || clear.isPending || choose.isPending}
            onContinue={(n) => ack.mutate(n)}
            onPlay={(n) => setPlaying({ node: n, chapter })}
            onChoose={(n, optionId) => choose.mutate({ node: n, optionId })}
          />
        ))}
      </div>
    </div>
  );
}

function ChapterSection({ chapter, inventory, busy, onContinue, onPlay, onChoose }: {
  chapter: StoryChapter;
  inventory: string[];
  busy: boolean;
  onContinue: (n: StoryNode) => void;
  onPlay: (n: StoryNode) => void;
  onChoose: (n: StoryNode, optionId: string) => void;
}) {
  const unlocked = isChapterUnlocked(chapter, inventory);
  const allDone = chapter.nodes.every((n) => isNodeComplete(n, inventory));
  const firstIncomplete = chapter.nodes.findIndex((n) => !isNodeComplete(n, inventory));

  if (!unlocked) {
    return (
      <Card className="p-5 border-dashed opacity-80" data-testid={`chapter-${chapter.id}`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl grayscale">{chapter.emoji}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm"><Lock className="w-3.5 h-3.5" /> Chapter {chapter.index} — Locked</div>
            <h2 className="text-lg font-black text-muted-foreground">???</h2>
            <p className="text-xs text-muted-foreground">Finish the previous chapter to unlock this part of your story.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden" data-testid={`chapter-${chapter.id}`}>
        <div className={`bg-gradient-to-r ${chapter.gradient} p-4 text-white flex items-center gap-3`}>
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">{chapter.emoji}</div>
          <div className="flex-1">
            <div className="text-[11px] font-black uppercase tracking-widest opacity-80">Chapter {chapter.index}{allDone && " · Complete"}</div>
            <h2 className="text-xl font-black leading-tight">{chapter.title}</h2>
            <p className="text-sm font-semibold text-white/85 italic">{chapter.subtitle}</p>
          </div>
          {allDone && <CheckCircle2 className="w-6 h-6 text-white" />}
        </div>

        <div className="p-4 space-y-2.5">
          {chapter.nodes.map((node, i) => {
            const complete = isNodeComplete(node, inventory);
            const isActive = i === firstIncomplete;
            const isUpcoming = firstIncomplete !== -1 && i > firstIncomplete;
            return (
              <NodeRow key={node.id} node={node} inventory={inventory} complete={complete} isActive={isActive} isUpcoming={isUpcoming}
                busy={busy} onContinue={onContinue} onPlay={onPlay} onChoose={onChoose} />
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}

function NodeRow({ node, inventory, complete, isActive, isUpcoming, busy, onContinue, onPlay, onChoose }: {
  node: StoryNode; inventory: string[];
  complete: boolean; isActive: boolean; isUpcoming: boolean; busy: boolean;
  onContinue: (n: StoryNode) => void; onPlay: (n: StoryNode) => void; onChoose: (n: StoryNode, optionId: string) => void;
}) {
  const isDialogue = node.kind === "dialogue";
  const isChoice = node.kind === "choice";
  const isBoss = node.kind === "level" && node.level.type === "boss";
  const levelKind = node.kind === "level" ? node.level.type : null;

  if (isUpcoming) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 text-muted-foreground/70" data-testid={`node-${node.id}`}>
        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
        <span className="text-sm font-semibold">{isDialogue ? "Story beat" : isChoice ? "A choice awaits" : isBoss ? "Guardian battle" : "Next challenge"}</span>
      </div>
    );
  }

  if (complete) {
    const chosen = isChoice ? getChosenOptionId(node.id, inventory) : undefined;
    const chosenLabel = chosen && node.kind === "choice" ? node.options.find((o) => o.id === chosen)?.label : undefined;
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10" data-testid={`node-${node.id}`}>
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
        <span className="text-sm font-bold text-green-700 dark:text-green-300">{node.title}{chosenLabel ? ` — ${chosenLabel}` : ""}</span>
      </div>
    );
  }

  // Active node — the thing to do next.
  const reward = node.reward;
  const Icon = isDialogue ? MessageCircle : isChoice ? GitBranch : isBoss ? Swords : levelKind === "swarm" ? Users : levelKind === "lock" ? KeyRound : Footprints;
  const iconCls = isDialogue ? "bg-sky-500/15 text-sky-500" : isChoice ? "bg-fuchsia-500/15 text-fuchsia-500" : isBoss ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-500";
  const text = node.kind === "dialogue" ? resolveDialogueText(node, inventory) : node.text;
  const levelLabel = levelKind === "boss" ? "BOSS" : levelKind === "swarm" ? "SWARM" : levelKind === "lock" ? "PUZZLE" : "LEVEL";

  return (
    <div className={`rounded-xl border-2 p-3.5 ${isActive ? "border-fuchsia-500/50 bg-fuchsia-500/5" : "border-border"}`} data-testid={`node-${node.id}`}>
      <div className="flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          {node.speaker && <div className="text-[11px] font-black text-fuchsia-500 mb-0.5">{node.speaker}</div>}
          <div className="font-black text-sm flex items-center gap-2">
            {node.title}
            {node.kind === "level" && <Badge variant="outline" className="text-[9px] font-bold border-border">{levelLabel}</Badge>}
            {isChoice && <Badge variant="outline" className="text-[9px] font-bold border-fuchsia-400/50 text-fuchsia-500">CHOICE</Badge>}
          </div>
          <p className="text-sm text-foreground/80 mt-0.5 leading-snug">{text}</p>

          {reward && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {reward.xp ? <Badge variant="outline" className="gap-1 text-[10px] font-bold border-blue-400/40 text-blue-600 dark:text-blue-400"><Zap className="w-3 h-3" /> {reward.xp} XP</Badge> : null}
              {reward.coins ? <Badge variant="outline" className="gap-1 text-[10px] font-bold border-amber-400/40 text-amber-600 dark:text-amber-400"><Coins className="w-3 h-3" /> {reward.coins}</Badge> : null}
              {reward.gems ? <Badge variant="outline" className="gap-1 text-[10px] font-bold border-fuchsia-400/40 text-fuchsia-600 dark:text-fuchsia-400"><Gem className="w-3 h-3" /> {reward.gems}</Badge> : null}
              {reward.badgeId ? <Badge variant="outline" className="gap-1 text-[10px] font-bold border-purple-400/40 text-purple-600 dark:text-purple-400"><Trophy className="w-3 h-3" /> Badge</Badge> : null}
            </div>
          )}

          {isChoice && node.kind === "choice" ? (
            <div className="mt-3 grid gap-2">
              {node.options.map((opt) => (
                <button key={opt.id} disabled={busy} onClick={() => onChoose(node, opt.id)} data-testid={`choose-${node.id}-${opt.id}`}
                  className="text-left px-3 py-2.5 rounded-xl border-2 border-border hover:border-fuchsia-500 hover:bg-fuchsia-500/5 transition-all font-bold text-sm disabled:opacity-50">
                  {opt.label}
                  {opt.reward && (
                    <span className="ml-2 text-[10px] font-semibold text-muted-foreground">
                      {[opt.reward.xp && `+${opt.reward.xp} XP`, opt.reward.coins && `+${opt.reward.coins}`, opt.reward.gems && `+${opt.reward.gems}💎`].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3">
              {isDialogue ? (
                <Button size="sm" className="gap-1.5 font-bold" disabled={busy} onClick={() => onContinue(node)} data-testid={`continue-${node.id}`}>
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button size="sm" className={`gap-1.5 font-bold ${isBoss ? "bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800" : ""}`} onClick={() => onPlay(node)} data-testid={`play-${node.id}`}>
                  <Play className="w-4 h-4" /> {isBoss ? "Fight the Guardian" : levelKind === "swarm" ? "Face the Swarm" : levelKind === "lock" ? "Solve the Puzzle" : "Play Level"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
