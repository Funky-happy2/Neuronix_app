import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { STORY_CHAPTERS, isChapterUnlocked, isNodeComplete, totalStoryNodes, type StoryChapter, type StoryNode } from "@shared/story";

function nextStep(inventory: string[]): { chapter: StoryChapter; node: StoryNode } | null {
  for (const c of STORY_CHAPTERS) {
    if (!isChapterUnlocked(c, inventory)) break;
    const node = c.nodes.find((n) => !isNodeComplete(n, inventory));
    if (node) return { chapter: c, node };
  }
  return null;
}

// "Continue your story" card for the Home screen.
export function StoryBanner() {
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"] });
  if (!user) return null;
  const inventory: string[] = user.inventory || [];

  const total = totalStoryNodes();
  const done = STORY_CHAPTERS.reduce((s, c) => s + c.nodes.filter((n) => isNodeComplete(n, inventory)).length, 0);
  const step = nextStep(inventory);
  const complete = !step;
  const fresh = done === 0;

  const gradient = complete ? "from-fuchsia-600 via-purple-700 to-amber-500" : step!.chapter.gradient;
  const heading = complete ? "The Spark Saga — Complete!" : fresh ? "Begin Your Story" : step!.chapter.title;
  const sub = complete
    ? "You are a Spark Eternal. Replay any chapter anytime."
    : fresh
      ? "An original adventure — play through chapters and beat Guardians to save the world's curiosity."
      : `Up next: ${step!.node.title}`;

  return (
    <Link href="/story">
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`cursor-pointer rounded-2xl overflow-hidden bg-gradient-to-r ${gradient} text-white shadow-lg`}
        data-testid="home-story-banner"
      >
        <div className="p-4 sm:p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl shrink-0">
            {complete ? "🌟" : fresh ? <BookOpen className="w-6 h-6" /> : step!.chapter.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-black uppercase tracking-widest opacity-80 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> The Spark Saga
            </div>
            <div className="text-lg font-black leading-tight truncate">{heading}</div>
            <div className="text-sm font-semibold text-white/85 truncate">{sub}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-bold opacity-80 hidden sm:block mb-1">{done}/{total}</div>
            <div className="inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1.5 font-black text-sm">
              {complete ? "Replay" : fresh ? "Start" : "Continue"} <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="h-1.5 bg-black/20">
          <div className="h-full bg-white/70" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </motion.div>
    </Link>
  );
}
