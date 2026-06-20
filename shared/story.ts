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
// `topic` (optional) keeps questions on-theme (see questionTopics.ts).
export type StoryLevelSpec =
  | { type: "traverse"; steps: number; hp: number; yearTier: number; timeSec: number; hazard: string; topic?: string }
  | { type: "boss"; bossName: string; bossEmoji: string; bossHp: number; hp: number; yearTier: number; timeSec: number; phaseLine?: string; topic?: string }
  | { type: "swarm"; enemies: number; hp: number; yearTier: number; timeSec: number; enemyName: string; enemyEmoji: string; topic?: string }
  | { type: "lock"; tumblers: number; hp: number; yearTier: number; timeSec: number; lockName: string; topic?: string };

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
  topic?: string;   // default question theme for this chapter's levels
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

// ─── Story 1: The Spark Saga (10 chapters, escalating) ──────────────────────────
const SPARK_SAGA: StoryChapter[] = [
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
    id: "ch2", index: 2, topic: "weather", title: "The Storm Frontier", subtitle: "Where the skies forgot the rules",
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
    id: "ch3", index: 3, topic: "biology", title: "The Living Labs", subtitle: "Where life forgot to grow",
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
    id: "ch4", index: 4, topic: "space", title: "The Cosmic Reaches", subtitle: "Where the stars went dark",
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
    id: "ch5", index: 5, topic: "tech", title: "The Deep Code", subtitle: "The Static's birthplace",
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
    id: "ch6", index: 6, topic: "ice", title: "The Frozen Archive", subtitle: "Where memory turns to ice",
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
    id: "ch9", index: 9, topic: "physics", title: "The Mirror Mind", subtitle: "A maze of your own thoughts",
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

// ─── Story 2: The Chrono Caper (a shorter time-travel mystery) ──────────────────
const CHRONO_CAPER: StoryChapter[] = [
  {
    id: "cc1", index: 1, title: "The Stolen Blueprint", subtitle: "Neuronix Time Lab",
    emoji: "⏳", gradient: "from-amber-500 to-yellow-700",
    nodes: [
      talk("cc1-intro", "Professor Lumen", "A Theft Across Time",
        "Neuronaut! Someone's stolen the Academy's greatest treasure — the master blueprint of curiosity itself — and fled into the past using our experimental Time Gate. A masked figure who calls themselves The Curator. Step through the Gate and chase them down!"),
      talk("cc1-bit", "Bit", "Mind the Paradoxes",
        "Time travel is tricky! If you answer wrong, history pushes back. Keep your facts straight and we'll catch The Curator. The Gate is charging — first stop, a wild thunderstorm era!"),
      traverse("cc1-gate", "Through the Gate", "The Time Gate flings you into a storm-lashed past. Steady your footing across the centuries — answer to leap each time-rift!",
        { steps: 6, hp: 4, yearTier: 6, timeSec: 14, hazard: "Time Rift", topic: "weather" }, { xp: 250, coins: 150 }),
    ],
  },
  {
    id: "cc2", index: 2, topic: "ice", title: "The Frozen Past", subtitle: "The last Ice Age",
    emoji: "🧊", gradient: "from-cyan-500 to-blue-800",
    nodes: [
      talk("cc2-intro", "Bit", "Cold Trail",
        "The Curator's tracks lead into the Ice Age! It's freezing — and they've left frost-guardians to slow us down. Bundle up your brain and push through!"),
      swarm("cc2-frost", "Frost Guardians", "The Curator's icy minions surround you. Melt each one with a correct answer before the cold sets in!",
        { enemies: 7, hp: 4, yearTier: 6, timeSec: 12, enemyName: "Frost Guardian", enemyEmoji: "❄️" }, { xp: 350, coins: 200 }),
      choose("cc2-fork", "Bit", "Which Trail?", "The Curator's tracks split at a glacier. Which way?", [
        { id: "cave", label: "🕳️ Into the ice cave", response: "Brrr — the cave route! Dark and cold, but it cuts off their escape.", reward: { xp: 200, coins: 150 } },
        { id: "ridge", label: "⛰️ Over the frozen ridge", response: "The high road! Risky footing, but you'll spot The Curator from above.", reward: { xp: 200, gems: 5 } },
      ]),
    ],
  },
  {
    id: "cc3", index: 3, topic: "space", title: "The Star Vault", subtitle: "A future among the stars",
    emoji: "🛰️", gradient: "from-indigo-600 to-violet-900",
    nodes: [
      talk("cc3-intro", "Bit", "Too Far Forward",
        "The Curator overshot — we're in the FUTURE now, a space station orbiting Earth! They've locked the blueprint in a star-vault. Crack the cosmic lock to reach it!"),
      lock("cc3-vault", "The Star Vault", "A vault sealed with riddles of the cosmos. Answer correctly to align each star-lock — a wrong answer spins one back!",
        { tumblers: 7, hp: 4, yearTier: 8, timeSec: 11, lockName: "The Star Vault" }, { xp: 450, coins: 300 }),
      talk("cc3-outro", "Professor Lumen", "Cornered",
        "The vault's open — but The Curator is right there, blueprint in hand, with nowhere left to run. Whatever happens next, Neuronaut… end this."),
    ],
  },
  {
    id: "cc4", index: 4, title: "The Curator Unmasked", subtitle: "The final confrontation",
    emoji: "🎭", gradient: "from-fuchsia-600 via-amber-500 to-rose-600",
    nodes: [
      talkV("cc4-intro", "The Curator", "Behind the Mask", "You're persistent, I'll give you that. The mask comes off — and underneath? A future version of a student who gave up on curiosity. I took the blueprint to keep it SAFE, locked away where no one could lose it. Let me show you why questions are dangerous!",
        [
          { needs: "story-choice-cc2-fork-cave", text: "You took the cave — clever, cutting me off in the dark. The mask comes off: underneath is a future student who gave up on curiosity. I hid the blueprint to keep it SAFE. Let me show you why questions are dangerous!" },
          { needs: "story-choice-cc2-fork-ridge", text: "You took the ridge and saw me coming — bold. The mask comes off: underneath is a future student who gave up on curiosity. I hid the blueprint to keep it SAFE. Let me show you why questions are dangerous!" },
        ]),
      boss("cc4-boss", "The Curator", "The Curator fights with stolen knowledge from every era. Prove that curiosity shared is stronger than curiosity hoarded — and win the blueprint back!",
        { bossName: "The Curator", bossEmoji: "🎭", bossHp: 12, hp: 4, yearTier: 8, timeSec: 10, phaseLine: "The Curator rewinds time — answer faster!", topic: "physics" }, { xp: 1200, coins: 800, gems: 25 }),
      talk("cc4-finale", "Professor Lumen", "Curiosity Restored",
        "The blueprint is back where it belongs — open, shared, and free for everyone. You showed The Curator that a question kept secret helps no one; a question shared lights up the world. The timeline is safe, thanks to you. What a caper! 🕵️",
        { xp: 1500, coins: 1000, gems: 30, badgeId: "chrono-caper", item: "title-time-detective" }),
    ],
  },
];

// ─── Story 3: Body Brigade (a microscopic medical adventure) ────────────────────
const BODY_BRIGADE: StoryChapter[] = [
  {
    id: "md1", index: 1, topic: "biology", title: "Shrink Down!", subtitle: "Neuronix Medical Wing",
    emoji: "🔬", gradient: "from-rose-500 to-pink-700",
    nodes: [
      talk("md1-intro", "Doctor Mara", "A Tiny Mission",
        "Neuronaut! A patient is very sick, and the medicine can't reach the problem. So we're sending YOU — shrunk to the size of a cell — inside their body to fix it from within. It's never been done. Ready to make history?"),
      talk("md1-bit", "Bit", "Cell-Sized Sidekick",
        "I've shrunk down too! Inside the body, your science smarts are your tools. Answer right and we move; answer wrong and the body's defenses push us back. Let's dive into the bloodstream!"),
      traverse("md1-dive", "Into the Bloodstream", "You're injected into a vein! Ride the bloodstream and dodge the body's own defenses — answer to navigate each current.",
        { steps: 6, hp: 4, yearTier: 4, timeSec: 15, hazard: "White Blood Cell" }, { xp: 200, coins: 150 }),
    ],
  },
  {
    id: "md2", index: 2, topic: "biology", title: "The Bloodstream Rapids", subtitle: "A river of cells",
    emoji: "🩸", gradient: "from-red-500 to-rose-800",
    nodes: [
      talk("md2-intro", "Bit", "Germs Ahead!",
        "The infection's getting closer — and a horde of germs just spotted us! We have to clear a path. Use everything you know about the human body!"),
      swarm("md2-germs", "Germ Swarm", "Invading germs swarm the bloodstream. Zap each one with a correct answer before they overwhelm you!",
        { enemies: 8, hp: 4, yearTier: 6, timeSec: 12, enemyName: "Germ", enemyEmoji: "🦠" }, { xp: 350, coins: 200 }),
      choose("md2-fork", "Bit", "Which Route?", "Two paths to the infected organ. How do we get there fastest?", [
        { id: "heart", label: "❤️ Through the heart", response: "Hold on tight — the heart's a wild ride, but it's the fast lane!", reward: { xp: 200, coins: 150 } },
        { id: "lungs", label: "🫁 Through the lungs", response: "Smart — we'll grab fresh oxygen on the way and arrive stronger.", reward: { xp: 200, gems: 5 } },
      ]),
    ],
  },
  {
    id: "md3", index: 3, topic: "disease", title: "Infection Outbreak", subtitle: "Ground zero",
    emoji: "🦠", gradient: "from-fuchsia-600 to-purple-900",
    nodes: [
      talk("md3-intro", "Doctor Mara", "The Source",
        "You've reached the infection! At its center is a mutated super-germ commanding the whole outbreak. Defeat it and the rest will scatter. Be careful — it adapts fast!"),
      lock("md3-defenses", "Break the Biofilm", "The super-germ hides behind a slimy biofilm shield. Answer correctly to dissolve each layer — a wrong answer lets it reform!",
        { tumblers: 6, hp: 4, yearTier: 6, timeSec: 12, lockName: "The Biofilm" }, { xp: 450, coins: 300 }),
      boss("md3-boss", "The Super-Germ", "The mutated super-germ rears up, dividing and adapting. Out-science it to break the infection apart!",
        { bossName: "The Super-Germ", bossEmoji: "🦠", bossHp: 11, hp: 4, yearTier: 8, timeSec: 11, phaseLine: "The Super-Germ mutates — it fights back harder!", topic: "disease" }, { xp: 800, coins: 500, gems: 15 }),
    ],
  },
  {
    id: "md4", index: 4, topic: "biology", title: "The Cure", subtitle: "Saving the patient",
    emoji: "💊", gradient: "from-emerald-500 via-teal-500 to-sky-500",
    nodes: [
      talkV("md4-intro", "Doctor Mara", "Almost There", "Brilliant work! The infection is collapsing. Now guide the medicine to every last germ and finish the cure. The patient is counting on you!",
        [
          { needs: "story-choice-md2-fork-heart", text: "Brilliant! That heart shortcut bought us precious time. The infection's collapsing — now guide the medicine to every last germ and finish the cure!" },
          { needs: "story-choice-md2-fork-lungs", text: "Brilliant! All that fresh oxygen kept us strong. The infection's collapsing — now guide the medicine to every last germ and finish the cure!" },
        ]),
      traverse("md4-cure", "Deliver the Cure", "Carry the medicine through the healing body to every infected corner. One last push — answer to deliver each dose!",
        { steps: 10, hp: 4, yearTier: 8, timeSec: 11, hazard: "Stray Germ" }, { xp: 700, coins: 450 }),
      talk("md4-finale", "Doctor Mara", "A Life Saved",
        "Their fever's breaking… the patient is going to be okay — because of YOU. You went where no medicine could and proved that a curious mind is the most powerful medicine of all. Welcome to the Body Brigade, Neuronaut. 🩺",
        { xp: 1500, coins: 1000, gems: 30, badgeId: "body-brigade", item: "title-micro-medic" }),
    ],
  },
];

// ─── The collection of stories ──────────────────────────────────────────────────
export interface Story {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
  blurb: string;
  chapters: StoryChapter[];
}

export const STORIES: Story[] = [
  {
    id: "spark-saga", title: "The Spark Saga", subtitle: "Save the world's curiosity",
    emoji: "🌟", gradient: "from-sky-500 via-fuchsia-500 to-amber-400",
    blurb: "A creeping silence is erasing the world's curiosity. Journey through 10 chapters, free corrupted Guardians, and face The Static — and beyond.",
    chapters: SPARK_SAGA,
  },
  {
    id: "chrono-caper", title: "The Chrono Caper", subtitle: "A time-travel mystery",
    emoji: "⏳", gradient: "from-amber-500 via-orange-500 to-rose-600",
    blurb: "A masked thief stole the Academy's master blueprint and fled into the past. Chase The Curator through time across 4 chapters to set history right.",
    chapters: CHRONO_CAPER,
  },
  {
    id: "body-brigade", title: "Body Brigade", subtitle: "A microscopic medical mission",
    emoji: "🔬", gradient: "from-rose-500 via-fuchsia-500 to-emerald-500",
    blurb: "Shrink to the size of a cell and journey inside a sick patient — through the bloodstream, past germ swarms, to defeat a super-germ and deliver the cure across 4 chapters.",
    chapters: BODY_BRIGADE,
  },
];

// Flat list of every chapter across all stories.
export const STORY_CHAPTERS: StoryChapter[] = STORIES.flatMap((s) => s.chapters);

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

// Find the story that contains a given chapter.
export function getStoryOfChapter(chapterId: string): Story | undefined {
  return STORIES.find((s) => s.chapters.some((c) => c.id === chapterId));
}

// A chapter is unlocked once every node of the PREVIOUS chapter in the SAME story
// is complete (the first chapter of each story is always open).
export function isChapterUnlocked(chapter: StoryChapter, inventory: string[]): boolean {
  const story = getStoryOfChapter(chapter.id);
  if (!story) return true;
  const i = story.chapters.findIndex((c) => c.id === chapter.id);
  if (i <= 0) return true;
  return story.chapters[i - 1].nodes.every((n) => isNodeComplete(n, inventory));
}

export function getNode(nodeId: string): { story: Story; chapter: StoryChapter; node: StoryNode } | undefined {
  for (const story of STORIES) {
    for (const chapter of story.chapters) {
      const node = chapter.nodes.find((n) => n.id === nodeId);
      if (node) return { story, chapter, node };
    }
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

// Node count for one story, or for everything when no story is given.
export function totalStoryNodes(story?: Story): number {
  const chapters = story ? story.chapters : STORY_CHAPTERS;
  return chapters.reduce((s, c) => s + c.nodes.length, 0);
}

export function storyNodesDone(story: Story, inventory: string[]): number {
  return story.chapters.reduce((s, c) => s + c.nodes.filter((n) => isNodeComplete(n, inventory)).length, 0);
}
