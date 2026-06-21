import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STORIES, isChapterUnlocked, isNodeComplete, totalStoryNodes, storyNodesDone, storyUnlockState, type Story, type StoryChapter, type StoryNode } from "@shared/story";

// The next thing to play across all UNLOCKED stories (first with an open step).
function nextStep(level: number, inventory: string[]): { story: Story; chapter: StoryChapter; node: StoryNode } | null {
  for (const story of STORIES) {
    if (!storyUnlockState(story, { level, inventory }).unlocked) continue;
    for (const c of story.chapters) {
      if (!isChapterUnlocked(c, inventory)) break;
      const node = c.nodes.find((n) => !isNodeComplete(n, inventory));
      if (node) return { story, chapter: c, node };
    }
  }
  return null;
}

// "Continue your story" card for the Home screen — styled like the game cards.
export function StoryBanner() {
  const [, navigate] = useLocation();
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"] });
  if (!user) return null;
  const inventory: string[] = user.inventory || [];

  const total = STORIES.reduce((s, st) => s + totalStoryNodes(st), 0);
  const done = STORIES.reduce((s, st) => s + storyNodesDone(st, inventory), 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const step = nextStep((user as any).level || 0, inventory);
  const complete = !step;
  const fresh = done === 0;

  const gradient = complete ? "from-fuchsia-600 via-purple-700 to-amber-500" : step!.chapter.gradient;
  const heading = complete ? "All Stories Complete!" : fresh ? "Begin Your Story" : step!.chapter.title;
  const label = complete ? "Story Mode" : step ? step.story.title : "Story Mode";
  const watermark = complete ? "🌟" : fresh ? "📖" : step!.chapter.emoji;
  const sub = complete
    ? "You've finished every adventure — jump back in anytime."
    : fresh
      ? "Original adventures — play through chapters and beat Guardians!"
      : `Up next: ${step!.node.title}`;
  const cta = complete ? "Replay" : fresh ? "Start" : "Continue";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
    >
      <Card
        className={`p-6 border-border bg-gradient-to-br ${gradient} text-white relative group overflow-hidden cursor-pointer`}
        onClick={() => navigate("/story")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/story"); }}
        data-testid="home-story-banner"
      >
        <div className="absolute inset-0 bg-black/10 rounded-md" />
        <div className="pointer-events-none select-none absolute -right-3 -top-6 text-[110px] leading-none opacity-15">{watermark}</div>
        <div className="relative">
          <Badge variant="secondary" className="mb-3 text-xs font-bold bg-white/20 text-white border-white/20">
            <BookOpen className="w-3 h-3 mr-1" /> Story Mode · {label}
          </Badge>
          <h2 className="text-2xl font-black mb-1">{heading}</h2>
          <p className="text-sm text-white/85 mb-4 leading-relaxed">{sub}</p>

          <div className="flex items-center gap-2 mb-4 max-w-xs">
            <div className="h-2 flex-1 rounded-full bg-black/25 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-white/90 tabular-nums">{done}/{total}</span>
          </div>

          <Button variant="secondary" className="gap-2 font-bold bg-white/20 text-white border-white/20" data-testid="button-story-banner">
            {cta} <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
