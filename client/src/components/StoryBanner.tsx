import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { STORIES, isChapterUnlocked, isNodeComplete, totalStoryNodes, storyNodesDone, type Story, type StoryChapter, type StoryNode } from "@shared/story";

// The next thing to play across all stories (first story with an open step).
function nextStep(inventory: string[]): { story: Story; chapter: StoryChapter; node: StoryNode } | null {
  for (const story of STORIES) {
    for (const c of story.chapters) {
      if (!isChapterUnlocked(c, inventory)) break;
      const node = c.nodes.find((n) => !isNodeComplete(n, inventory));
      if (node) return { story, chapter: c, node };
    }
  }
  return null;
}

// "Continue your story" card for the Home screen.
export function StoryBanner() {
  const [, navigate] = useLocation();
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"] });
  if (!user) return null;
  const inventory: string[] = user.inventory || [];

  const total = STORIES.reduce((s, st) => s + totalStoryNodes(st), 0);
  const done = STORIES.reduce((s, st) => s + storyNodesDone(st, inventory), 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const step = nextStep(inventory);
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
      whileHover={{ scale: 1.006 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => navigate("/story")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/story"); }}
      className={`relative cursor-pointer rounded-2xl overflow-hidden bg-gradient-to-r ${gradient} text-white shadow-lg`}
      data-testid="home-story-banner"
    >
      {/* soft watermark */}
      <div className="pointer-events-none select-none absolute -right-5 -top-7 text-[130px] leading-none opacity-10">{watermark}</div>

      <div className="relative p-4 sm:p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl shrink-0 shadow-inner">
          {fresh ? <BookOpen className="w-7 h-7" /> : watermark}
        </div>

        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-white/20 rounded-full px-2 py-0.5 mb-1">
            <Sparkles className="w-3 h-3" /> {label}
          </div>
          <div className="text-lg sm:text-xl font-black leading-tight truncate">{heading}</div>
          <div className="text-sm font-semibold text-white/90 truncate">{sub}</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 max-w-[220px] rounded-full bg-black/25 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-bold text-white/90 tabular-nums">{done}/{total}</span>
          </div>
        </div>

        <div className="shrink-0 inline-flex items-center gap-1.5 bg-white text-gray-900 rounded-full px-4 py-2 font-black text-sm shadow">
          {cta} <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
}
