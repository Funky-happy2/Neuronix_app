// The Spark Saga — Neuronix's PLAYABLE story campaign. Shared by client (rendering
// + playing the levels) and server (validating progress + granting rewards).
//
// Unlike a checklist, the story is something you PLAY THROUGH (Mario-style):
//   • "dialogue" nodes are story beats (read → Continue), and
//   • "level" nodes are playable encounters you beat INSIDE Story Mode — either a
//     "traverse" (cross a region, clearing question-hazards with a health bar) or a
//     "boss" (a Guardian duel). They get harder chapter by chapter.
//
// Persistence with NO schema change (mirrors how dimensions store stones):
//   • dialogue read  → inventory flag  "story-ack-<nodeId>"
//   • level cleared  → inventory flag  "story-clear-<nodeId>"
// Rewards are granted server-side the first time a node is completed.

export interface StoryReward {
  xp?: number;
  coins?: number;
  gems?: number;
  badgeId?: string;
  item?: string;
  items?: string[]; // multiple inventory grants (e.g. avatar + title)
}

// A playable level's rules. yearTier (4/6/8) picks the question difficulty.
export type StoryLevelSpec =
  | { type: "traverse"; steps: number; hp: number; yearTier: number; timeSec: number; hazard: string }
  | { type: "boss"; bossName: string; bossEmoji: string; bossHp: number; hp: number; yearTier: number; timeSec: number; phaseLine?: string }
  | { type: "swarm"; enemies: number; hp: number; yearTier: number; timeSec: number; enemyName: string; enemyEmoji: string }
  | { type: "lock"; tumblers: number; hp: number; yearTier: number; timeSec: number; lockName: string };

// A line of dialogue can change based on earlier branching choices.
// `needs` is one choice flag, or several that must ALL be present (compounding).
export interface StoryTextVariant { needs: string | string[]; text: string }

interface BaseNode { id: string; title: string; text: string; speaker?: string; reward?: StoryReward; }
export interface DialogueNode extends BaseNode { kind: "dialogue"; variants?: StoryTextVariant[] }
export interface LevelNode extends BaseNode { kind: "level"; level: StoryLevelSpec }
export interface StoryChoiceOption { id: string; label: string; response: string; reward?: StoryReward }
export interface ChoiceNode extends BaseNode { kind: "choice"; options: StoryChoiceOption[] }
export type StoryNode = DialogueNode | LevelNode | ChoiceNode;

export interface StoryChapter {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
  nodes: StoryNode[];
}

// ─── Authoring helpers ──────────────────────────────────────────────────────────
const talk = (id: string, speaker: string, title: string, text: string, reward?: StoryReward): DialogueNode =>
  ({ kind: "dialogue", id, speaker, title, text, reward });
const talkV = (id: string, speaker: string, title: string, text: string, variants: StoryTextVariant[], reward?: StoryReward): DialogueNode =>
  ({ kind: "dialogue", id, speaker, title, text, variants, reward });
const choose = (id: string, speaker: string, title: string, prompt: string, options: StoryChoiceOption[]): ChoiceNode =>
  ({ kind: "choice", id, speaker, title, text: prompt, options });
const traverse = (id: string, title: string, text: string, level: Omit<Extract<StoryLevelSpec, { type: "traverse" }>, "type">, reward?: StoryReward): LevelNode =>
  ({ kind: "level", id, title, text, level: { type: "traverse", ...level }, reward });
const boss = (id: string, title: string, text: string, level: Omit<Extract<StoryLevelSpec, { type: "boss" }>, "type">, reward?: StoryReward): LevelNode =>
  ({ kind: "level", id, title, text, level: { type: "boss", ...level }, reward });
const swarm = (id: string, title: string, text: string, level: Omit<Extract<StoryLevelSpec, { type: "swarm" }>, "type">, reward?: StoryReward): LevelNode =>
  ({ kind: "level", id, title, text, level: { type: "swarm", ...level }, reward });
const lock = (id: string, title: string, text: string, level: Omit<Extract<StoryLevelSpec, { type: "lock" }>, "type">, reward?: StoryReward): LevelNode =>
  ({ kind: "level", id, title, text, level: { type: "lock", ...level }, reward });

// ─── The campaign (7 chapters, escalating) ──────────────────────────────────────
export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: "ch1", index: 1, title: "The Spark Awakens", subtitle: "Neuronix Academy",
    emoji: "✨", gradient: "from-sky-500 to-indigo-600",
    nodes: [
      talk("c1-intro", "Professor Lumen", "Welcome, Neuronaut",
        "The world runs on curiosity — we call it the Spark. But a creeping silence, The Static, is dimming Sparks everywhere. You felt the call, so your Spark is strong. Let's see if you can use it."),
      talk("c1-bit", "Bit (your A.I. buddy)", "Meet Bit",
        "Beep! I'm Bit, your sidekick. Out there, The Static takes shape as hazards and Guardians. Answer with your Spark to push through them. Let's take your first steps across the Academy courtyard!"),
      traverse("c1-steps", "First Steps", "Cross the Academy courtyard. Each Static wisp blocks your path — answer to step past it. Reach the far gate!",
        { steps: 5, hp: 4, yearTier: 4, timeSec: 16, hazard: "Static Wisp" }, { xp: 150, coins: 100 }),
      talk("c1-warn", "Bit", "Something's Wrong",
        "Whoa — a Guardian construct just powered up at the gate! These were built to protect us, but The Static twisted this one. Beat it to pass!"),
      boss("c1-boss", "The Gate Golem", "A training Golem, corrupted by Static, guards the courtyard gate. Answer to strike it — but don't be too slow, or it strikes back!",
        { bossName: "The Gate Golem", bossEmoji: "🗿", bossHp: 4, hp: 4, yearTier: 4, timeSec: 15 }, { xp: 250, coins: 150 }),
      talk("c1-outro", "Professor Lumen", "A True Spark",
        "Incredible — you fought it off! But scouts report the Storm Frontier has already gone silent. The skies there have forgotten their own rules. Go. We're counting on you.", { xp: 100, coins: 100 }),
    ],
  },
  {
    id: "ch2", index: 2, title: "The Storm Frontier", subtitle: "Where the skies forgot the rules",
    emoji: "⛈️", gradient: "from-cyan-600 to-blue-800",
    nodes: [
      talk("c2-intro", "Bit", "Static in the Sky",
        "Lightning with no thunder, rain falling upward — chaos! We have to cross the open plain to reach the storm's Guardian. Watch for lightning hazards!"),
      traverse("c2-plain", "The Howling Plain", "Race across the storm-torn plain. Each lightning bolt is a hazard — answer to dash beneath it!",
        { steps: 7, hp: 4, yearTier: 4, timeSec: 14, hazard: "Lightning Bolt" }, { xp: 250, coins: 150 }),
      boss("c2-boss", "The Tempest Guardian", "The storm itself has a heart — the Tempest Guardian. Strike it with every right answer and calm the Frontier!",
        { bossName: "The Tempest Guardian", bossEmoji: "🌩️", bossHp: 6, hp: 4, yearTier: 6, timeSec: 13, phaseLine: "The Guardian roars and the winds scream faster!" }, { xp: 450, coins: 250 }),
      talk("c2-outro", "Professor Lumen", "Skies Restored",
        "The clouds remember themselves again — that was you! But the Living Labs have stopped growing. Life itself is forgetting how to build itself. Hurry.", { xp: 150, coins: 150 }),
    ],
  },
  {
    id: "ch3", index: 3, title: "The Living Labs", subtitle: "Where life forgot to grow",
    emoji: "🧬", gradient: "from-emerald-600 to-green-800",
    nodes: [
      talk("c3-intro", "Bit", "Tangled Code",
        "The Labs are overgrown with scrambled, half-formed creatures. We'll need to push through the tangle, then face whatever's hoarding the broken code at its center."),
      traverse("c3-vines", "The Overgrowth", "Cut through a maze of mutant vines. Each tangle is a hazard — answer to slip past!",
        { steps: 8, hp: 4, yearTier: 6, timeSec: 13, hazard: "Mutant Vine" }, { xp: 300, coins: 200 }),
      traverse("c3-swarm", "Spore Swarm", "A swarm of spores blocks the lab doors. Keep moving — answer fast to break through!",
        { steps: 8, hp: 3, yearTier: 6, timeSec: 11, hazard: "Spore Cloud" }, { xp: 300, coins: 200 }),
      boss("c3-boss", "The Hydra of Genes", "A many-headed beast of broken genetics blocks the core. Every right answer lops off a head!",
        { bossName: "The Hydra of Genes", bossEmoji: "🐍", bossHp: 7, hp: 4, yearTier: 6, timeSec: 12, phaseLine: "Two heads grow back — the Hydra lunges faster!" }, { xp: 550, coins: 300 }),
      talk("c3-outro", "Professor Lumen", "Life Renewed",
        "Green returns to the Labs! Three regions safe. But The Static has climbed into the Cosmic Reaches — the stars are going dark, one by one.", { xp: 150, coins: 150 }),
    ],
  },
  {
    id: "ch4", index: 4, title: "The Cosmic Reaches", subtitle: "Where the stars went dark",
    emoji: "🌌", gradient: "from-violet-600 to-purple-900",
    nodes: [
      talk("c4-intro", "Bit", "Falling Stars",
        "Gravity is unsure of itself up here — whole platforms drift away. Leap between them carefully, then face the tyrant pulling the stars down."),
      traverse("c4-leap", "The Drifting Stars", "Hop across crumbling star-platforms. Miss a beat and you'll drift into the void — answer to land each jump!",
        { steps: 9, hp: 4, yearTier: 6, timeSec: 12, hazard: "Collapsing Star" }, { xp: 400, coins: 250 }),
      boss("c4-boss", "The Gravity Tyrant", "A black-hole Guardian crushing the constellations. Out-think its pull to set the stars free!",
        { bossName: "The Gravity Tyrant", bossEmoji: "🕳️", bossHp: 8, hp: 4, yearTier: 8, timeSec: 12, phaseLine: "The Tyrant collapses inward — its pull doubles!" }, { xp: 650, coins: 350 }),
      talk("c4-outro", "Professor Lumen", "Stars Relit",
        "The constellations blaze back to life! Only the worst region remains — the Deep Code, where The Static itself was born.", { xp: 200, coins: 200 }),
    ],
  },
  {
    id: "ch5", index: 5, title: "The Deep Code", subtitle: "The Static's birthplace",
    emoji: "⚡", gradient: "from-amber-600 to-rose-800",
    nodes: [
      talk("c5-intro", "Bit", "Into the Dark",
        "This is the core of everything — and it's swarming with corrupted code. We'll have to fight through two gauntlets just to reach the Guardian of the gate."),
      traverse("c5-gauntlet", "The Corrupted Halls", "Sprint through collapsing halls of broken code. Hazards everywhere — keep your answers sharp!",
        { steps: 10, hp: 4, yearTier: 8, timeSec: 11, hazard: "Code Glitch" }, { xp: 450, coins: 300 }),
      boss("c5-boss", "The Plague Construct", "A towering machine of pure Static guards the Deep Code's heart. Break it apart, answer by answer!",
        { bossName: "The Plague Construct", bossEmoji: "🦠", bossHp: 9, hp: 4, yearTier: 8, timeSec: 11, phaseLine: "Its shell cracks — and it attacks twice as hard!" }, { xp: 750, coins: 450 }),
      talk("c5-outro", "Professor Lumen", "The Door Opens",
        "The Deep Code lies open. But the cold has crept in behind us — the Frozen Archive, where all the world's lost knowledge is kept, is freezing solid. Save it before it's gone forever.", { xp: 250, coins: 250 }),
    ],
  },
  {
    id: "ch6", index: 6, title: "The Frozen Archive", subtitle: "Where memory turns to ice",
    emoji: "❄️", gradient: "from-sky-400 to-cyan-800",
    nodes: [
      talk("c6-intro", "Bit", "A Frozen Library",
        "The Archive holds everything the world has ever learned — and The Static is freezing it into silence. Cross the cracking ice and thaw the Sentinel that's hoarding the warmth."),
      traverse("c6-ice", "The Cracking Ice", "Step lightly across frozen halls — the ice shatters if you hesitate. Answer to keep your footing!",
        { steps: 10, hp: 4, yearTier: 8, timeSec: 10, hazard: "Cracking Ice" }, { xp: 500, coins: 300 }),
      boss("c6-boss", "The Frost Sentinel", "A guardian of living ice has sealed the Archive's heart. Melt its defenses with the warmth of curiosity!",
        { bossName: "The Frost Sentinel", bossEmoji: "🧊", bossHp: 10, hp: 4, yearTier: 8, timeSec: 10, phaseLine: "The Sentinel freezes the air — every second counts now!" }, { xp: 800, coins: 500, gems: 15 }),
      talk("c6-outro", "Professor Lumen", "Warmth Returns",
        "The Archive thaws, its knowledge safe. Every region is free now — except the source. It's time, Neuronaut. The Static's Heart awaits, and it knows you're coming.", { xp: 300, coins: 300 }),
    ],
  },
  {
    id: "ch7", index: 7, title: "The Static's Heart", subtitle: "The final stand",
    emoji: "🌟", gradient: "from-fuchsia-600 via-purple-700 to-amber-500",
    nodes: [
      talk("c7-intro", "Professor Lumen", "One Last Spark",
        "Everything you've learned has led here. The Static feeds on doubt and forgetting; you feed on curiosity. Cross the last bridge of silence — and end this."),
      traverse("c7-bridge", "The Bridge of Silence", "A final gauntlet across the void to The Static's core. It throws everything at you — answer fast, answer true!",
        { steps: 12, hp: 5, yearTier: 8, timeSec: 9, hazard: "Wall of Silence" }, { xp: 700, coins: 400 }),
      boss("c7-boss", "The Static", "This is it — The Static itself, a storm of every forgotten thing. Strike with all you've learned and light the world back up!",
        { bossName: "The Static", bossEmoji: "🌀", bossHp: 14, hp: 5, yearTier: 8, timeSec: 9, phaseLine: "The Static SCREAMS and the world dims — push through!" }, { xp: 1500, coins: 1000, gems: 30 }),
      talk("c7-finale", "Professor Lumen", "The Static Falls",
        "The silence breaks and Sparks flare back to life across every region. We did it… But wait — where The Static stood, there's now a perfect, cold NOTHING. Bit's sensors are screaming. The Static was only a shadow of something deeper: The Null, the absence of curiosity itself. And it's awake.",
        { xp: 1500, coins: 1000, gems: 25 }),
    ],
  },

  // ─── ACT 2 ───
  {
    id: "ch8", index: 8, title: "The Hollow Wastes", subtitle: "Where nothing remains",
    emoji: "🕯️", gradient: "from-slate-600 to-zinc-900",
    nodes: [
      talk("c8-intro", "Bit", "Beyond the Static",
        "This place is… empty. Not dark — empty. The Null has eaten whole ideas out of the world. Hollow husks of forgotten creatures wander here. We have to choose how we move forward, Neuronaut."),
      choose("c8-fork", "Bit", "Which Path?", "Two ways lead deeper into the Wastes. How do we press on?", [
        { id: "bold", label: "🔥 Charge straight through", response: "Bold! We blaze a trail head-on — no hesitation, no fear. The Null hates courage.", reward: { xp: 250, coins: 150 } },
        { id: "clever", label: "🧠 Slip through the cracks", response: "Clever! We take the quiet path, reading the Null's patterns. Knowledge is its own kind of bravery.", reward: { xp: 250, gems: 5 } },
      ]),
      swarm("c8-husks", "The Forgotten Horde", "Hollow husks swarm out of the emptiness! Defeat each one with what you know before they reach you.",
        { enemies: 8, hp: 4, yearTier: 8, timeSec: 10, enemyName: "Hollow Husk", enemyEmoji: "👻" }, { xp: 500, coins: 300 }),
      talk("c8-outro", "Professor Lumen", "A Way In",
        "You carved a path through the Horde. Ahead lies the Null's first true defense: the Mirror Mind, a labyrinth that turns your own thoughts against you.", { xp: 250, coins: 200 }),
    ],
  },
  {
    id: "ch9", index: 9, title: "The Mirror Mind", subtitle: "A maze of your own thoughts",
    emoji: "🪞", gradient: "from-indigo-600 to-fuchsia-900",
    nodes: [
      talk("c9-intro", "Bit", "Reflections",
        "Careful — everything here is a reflection. The Mirror Mind locks its doors with riddles, and only a clean run of right answers will open them. Steady now."),
      lock("c9-gate", "The Riddle Gate", "A sealed gate of pure thought. Answer correctly to set each tumbler — slip up and a tumbler falls back. Set them all to pass!",
        { tumblers: 6, hp: 4, yearTier: 8, timeSec: 11, lockName: "The Riddle Gate" }, { xp: 550, coins: 350 }),
      choose("c9-fork", "Bit", "How Will You Fight?", "Your Reflection is forming — armed with your every doubt. How do you face yourself?", [
        { id: "fury", label: "🔥 With fury — overwhelm it", response: "Yes! Pour everything into the attack — your Reflection flinches before your fire.", reward: { xp: 300, coins: 200 } },
        { id: "calm", label: "🧘 With calm — outsmart it", response: "Wise. A clear, quiet mind sees through every trick the mirror plays.", reward: { xp: 300, gems: 8 } },
      ]),
      boss("c9-boss", "Your Reflection", "The mirror forms a copy of YOU, armed with every doubt you've ever had. Out-think yourself to shatter it!",
        { bossName: "Your Reflection", bossEmoji: "🪞", bossHp: 11, hp: 4, yearTier: 8, timeSec: 10, phaseLine: "The Reflection grins — it knows your every move!" }, { xp: 800, coins: 500, gems: 15 }),
      talk("c9-outro", "Professor Lumen", "Past the Mirror",
        "You faced yourself and won — the hardest fight of all. The Null's core lies just beyond. This is the end of the road, Neuronaut. Everything has led here.", { xp: 300, coins: 300 }),
    ],
  },
  {
    id: "ch10", index: 10, title: "The Null Core", subtitle: "The true finale",
    emoji: "🌑", gradient: "from-fuchsia-700 via-indigo-800 to-amber-500",
    nodes: [
      talkV("c10-intro", "The Null", "I Am Emptiness", "So. The little Spark reached my core. I am what remains when curiosity dies — the quiet at the end of every question. You cannot defeat nothing.",
        [
          { needs: "story-choice-c8-fork-bold", text: "So. The reckless little Spark charged all the way to my core. I remember your bravery in the Wastes — how loud, how warm. It will make snuffing you out all the sweeter. You cannot defeat nothing." },
          { needs: "story-choice-c8-fork-clever", text: "So. The clever little Spark slipped all the way to my core. I watched you read my patterns in the Wastes. Cunning. But cleverness is just another light for me to swallow. You cannot defeat nothing." },
        ]),
      lock("c10-seals", "The Three Seals", "The Null guards its heart with three layers of sealed thought. Open every seal with a flawless run of answers!",
        { tumblers: 8, hp: 4, yearTier: 8, timeSec: 10, lockName: "The Null Seals" }, { xp: 700, coins: 450 }),
      boss("c10-boss", "The Null", "The end of all questions, made flesh. Pour everything you've ever learned into one last stand and prove that curiosity never dies!",
        { bossName: "The Null", bossEmoji: "🌑", bossHp: 16, hp: 5, yearTier: 8, timeSec: 9, phaseLine: "The Null unmakes the very ground — answer or be forgotten!" }, { xp: 2000, coins: 1200, gems: 40 }),
      talkV("c10-finale", "Professor Lumen", "The Spark Eternal",
        "The Null collapses into a single, bright spark — and then into nothing at all, the good kind: a clean page, ready for new questions. You did it, Neuronaut. You proved curiosity is the strongest force there is. You are a Spark Eternal now — wear the title and the avatar with pride. Your saga will be told for as long as anyone wonders 'why?'. Thank you for playing The Spark Saga. 🌟",
        [
          { needs: ["story-choice-c8-fork-bold", "story-choice-c9-fork-fury"],
            text: "The Null shatters under your relentless charge — you never once hesitated, from the Wastes to this final blow. Bards will sing of the Spark who fought like a storm and feared nothing. You are a Spark Eternal now, the Warrior of Wonder. Wear the title and avatar with pride. Thank you for playing The Spark Saga. 🌟" },
          { needs: ["story-choice-c8-fork-clever", "story-choice-c9-fork-calm"],
            text: "The Null unravels as you calmly read its final pattern — you slipped through the Wastes and outwitted your own reflection without ever losing your cool. Scholars will study the Spark who won with a quiet, brilliant mind. You are a Spark Eternal now, the Sage of Wonder. Wear the title and avatar with pride. Thank you for playing The Spark Saga. 🌟" },
        ],
        { xp: 3000, coins: 2000, gems: 60, badgeId: "saga-hero", items: ["title-spark-eternal", "avatar-spark-eternal"] }),
    ],
  },
];

// ─── Progress (pure, inventory-flag based) ──────────────────────────────────────
const ackFlag = (id: string) => `story-ack-${id}`;
const clearFlag = (id: string) => `story-clear-${id}`;
const choicePrefix = (id: string) => `story-choice-${id}-`;
const choiceFlag = (id: string, optionId: string) => `story-choice-${id}-${optionId}`;
export const STORY_FLAGS = { ackFlag, clearFlag, choiceFlag, choicePrefix };

export function isNodeComplete(node: StoryNode, inventory: string[]): boolean {
  const inv = inventory || [];
  if (node.kind === "dialogue") return inv.includes(ackFlag(node.id));
  if (node.kind === "choice") return inv.some((x) => x.startsWith(choicePrefix(node.id)));
  return inv.includes(clearFlag(node.id));
}

// Which option did the player pick for a choice node (if any)?
export function getChosenOptionId(nodeId: string, inventory: string[]): string | undefined {
  const f = (inventory || []).find((x) => x.startsWith(choicePrefix(nodeId)));
  return f ? f.slice(choicePrefix(nodeId).length) : undefined;
}

// Resolve a dialogue node's text, honoring branch-based variants (most specific
// matching variant wins — author longer `needs` combos first).
export function resolveDialogueText(node: StoryNode, inventory: string[]): string {
  if (node.kind !== "dialogue" || !node.variants) return node.text;
  const inv = inventory || [];
  for (const v of node.variants) {
    const need = Array.isArray(v.needs) ? v.needs : [v.needs];
    if (need.every((n) => inv.includes(n))) return v.text;
  }
  return node.text;
}

export function isChapterUnlocked(chapter: StoryChapter, inventory: string[]): boolean {
  if (chapter.index <= 1) return true;
  const prev = STORY_CHAPTERS.find((c) => c.index === chapter.index - 1);
  if (!prev) return true;
  return prev.nodes.every((n) => isNodeComplete(n, inventory));
}

export function getNode(nodeId: string): { chapter: StoryChapter; node: StoryNode } | undefined {
  for (const chapter of STORY_CHAPTERS) {
    const node = chapter.nodes.find((n) => n.id === nodeId);
    if (node) return { chapter, node };
  }
  return undefined;
}

// All predecessors complete (earlier nodes in this chapter + the whole previous chapter)?
export function isNodeReachable(nodeId: string, inventory: string[]): boolean {
  const found = getNode(nodeId);
  if (!found) return false;
  const { chapter, node } = found;
  if (!isChapterUnlocked(chapter, inventory)) return false;
  const i = chapter.nodes.findIndex((n) => n.id === node.id);
  return chapter.nodes.slice(0, i).every((n) => isNodeComplete(n, inventory));
}

export function totalStoryNodes(): number {
  return STORY_CHAPTERS.reduce((s, c) => s + c.nodes.length, 0);
}
