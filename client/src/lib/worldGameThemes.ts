export type MatchingTheme = {
  pairs: { base: string; match: string; color: string }[];
  prompt: string;
  options: string[];
};

export type SortingTheme = {
  events: { text: string; year: number }[];
  instruction: string;
};

export type RunnerTheme = {
  bgGradient: [string, string];
  groundColor: string;
  playerColor: string;
  obstacleColor: string;
  obstacleAccent: string;
  collectibleColor: string;
  collectibleAccent: string;
  label: string;
  collectibleName: string;
  obstacleName: string;
};

export type MemoryTheme = {
  emojis: string[];
  instruction: string;
  matchedColor: string;
  flippedColor: string;
};

export type WordScrambleTheme = {
  words: { word: string; cat: string }[];
};

export type ReactionTapTheme = {
  items: { num: number; sym: string; name: string; color: string }[];
  instruction: string;
  bgGradient: string;
};

export type ClickerTheme = {
  producers: { label: string; emoji: string };
  consumers: { label: string; emoji: string };
  decomposers: { label: string; emoji: string };
  bgGradient: string;
  balanceLabel: string;
  balancedMsg: string;
  unbalancedMsg: string;
};

export type CatchFallingTheme = {
  categories: { label: string; items: string[]; bad: string[] }[];
  bgGradient: string;
  catcherLabel: string;
  instruction: string;
};

export type DefenseTheme = {
  enemies: string[];
  centerEmoji: string;
  bgGradient: string;
  bgGradientDark: string;
  instruction: string;
};

export type SliderMatchTheme = {
  targets: { name: string; val1: number; val2: number; val3: number; emoji: string }[];
  sliders: [{ label: string; emoji: string; unit: string }, { label: string; emoji: string; unit: string }, { label: string; emoji: string; unit: string }];
  prompt: string;
  buttonLabel: string;
};

export const MATCHING_THEMES: Record<string, MatchingTheme> = {
  "periodic-pairs": {
    pairs: [
      { base: "O", match: "Oxygen", color: "#3b82f6" },
      { base: "Na", match: "Sodium", color: "#f59e0b" },
      { base: "Fe", match: "Iron", color: "#6b7280" },
      { base: "He", match: "Helium", color: "#ec4899" },
    ],
    prompt: "Which element has this symbol?",
    options: ["Oxygen", "Sodium", "Iron", "Helium"],
  },
  "circuit-match": {
    pairs: [
      { base: "🔋", match: "Battery", color: "#22c55e" },
      { base: "💡", match: "Bulb", color: "#eab308" },
      { base: "🔌", match: "Plug", color: "#3b82f6" },
      { base: "⚡", match: "Current", color: "#f97316" },
    ],
    prompt: "Match the circuit part to its name:",
    options: ["Battery", "Bulb", "Plug", "Current"],
  },
  "marine-pairs": {
    pairs: [
      { base: "🐙", match: "Octopus", color: "#0ea5e9" },
      { base: "🦈", match: "Shark", color: "#1e40af" },
      { base: "🐠", match: "Clownfish", color: "#f97316" },
      { base: "🪸", match: "Coral", color: "#ec4899" },
    ],
    prompt: "Match the sea creature to its name:",
    options: ["Octopus", "Shark", "Clownfish", "Coral"],
  },
  "arctic-match": {
    pairs: [
      { base: "🐻‍❄️", match: "Polar Bear", color: "#bfdbfe" },
      { base: "🦭", match: "Seal", color: "#93c5fd" },
      { base: "🐧", match: "Penguin", color: "#1e3a5f" },
      { base: "❄️", match: "Snowflake", color: "#7dd3fc" },
    ],
    prompt: "Match the arctic specimen:",
    options: ["Polar Bear", "Seal", "Penguin", "Snowflake"],
  },
  "particle-pairs": {
    pairs: [
      { base: "e⁻", match: "Electron", color: "#3b82f6" },
      { base: "p⁺", match: "Proton", color: "#ef4444" },
      { base: "n⁰", match: "Neutron", color: "#6b7280" },
      { base: "γ", match: "Photon", color: "#fbbf24" },
    ],
    prompt: "Match the subatomic particle:",
    options: ["Electron", "Proton", "Neutron", "Photon"],
  },
};

export const SORTING_THEMES: Record<string, SortingTheme> = {
  "life-timeline": {
    events: [
      { text: "🦠 First single-celled life", year: 1 },
      { text: "🐟 First fish swim the seas", year: 2 },
      { text: "🌿 Plants spread onto land", year: 3 },
      { text: "🦖 Age of the dinosaurs", year: 4 },
      { text: "🦣 Mammals rise up", year: 5 },
      { text: "🧑 First humans appear", year: 6 },
    ],
    instruction: "Order these from earliest to most recent!",
  },
  "species-sort": {
    events: [
      { text: "🐒 Spider Monkey (Mammal)", year: 1 },
      { text: "🦜 Macaw (Bird)", year: 2 },
      { text: "🐍 Tree Boa (Reptile)", year: 3 },
      { text: "🐸 Poison Frog (Amphibian)", year: 4 },
      { text: "🦋 Morpho Butterfly (Insect)", year: 5 },
      { text: "🦥 Sloth (Mammal)", year: 1 },
      { text: "🦅 Harpy Eagle (Bird)", year: 2 },
      { text: "🦎 Iguana (Reptile)", year: 3 },
      { text: "🐛 Hercules Beetle (Insect)", year: 5 },
      { text: "🐆 Jaguar (Mammal)", year: 1 },
    ],
    instruction: "Sort species by classification: Mammals → Birds → Reptiles → Amphibians → Insects!",
  },
  "mineral-sort": {
    events: [
      { text: "Talc (Hardness 1)", year: 1 },
      { text: "Gypsum (Hardness 2)", year: 2 },
      { text: "Calcite (Hardness 3)", year: 3 },
      { text: "Fluorite (Hardness 4)", year: 4 },
      { text: "Apatite (Hardness 5)", year: 5 },
      { text: "Feldspar (Hardness 6)", year: 6 },
      { text: "Quartz (Hardness 7)", year: 7 },
      { text: "Topaz (Hardness 8)", year: 8 },
      { text: "Corundum (Hardness 9)", year: 9 },
      { text: "Diamond (Hardness 10)", year: 10 },
    ],
    instruction: "Sort minerals by Mohs hardness scale (softest to hardest)!",
  },
};

export const RUNNER_THEMES: Record<string, RunnerTheme> = {
  "lava-escape": {
    bgGradient: ["#7f1d1d", "#431407"],
    groundColor: "#92400e",
    playerColor: "#fbbf24",
    obstacleColor: "#ef4444",
    obstacleAccent: "#dc2626",
    collectibleColor: "#f97316",
    collectibleAccent: "#fed7aa",
    label: "🌋 Lava Escape",
    collectibleName: "minerals",
    obstacleName: "lava flows",
  },
  "extinction-escape": {
    bgGradient: ["#451a03", "#1c1917"],
    groundColor: "#78350f",
    playerColor: "#a3e635",
    obstacleColor: "#f97316",
    obstacleAccent: "#ea580c",
    collectibleColor: "#34d399",
    collectibleAccent: "#d1fae5",
    label: "☄️ Extinction Escape",
    collectibleName: "DNA samples",
    obstacleName: "meteors",
  },
};

export const MEMORY_THEMES: Record<string, MemoryTheme> = {
  "star-memory": {
    emojis: ["⭐", "🌟", "💫", "✨", "🌙", "☀️", "🪐", "🌌"],
    instruction: "Find matching star constellation pairs!",
    matchedColor: "border-indigo-500 bg-indigo-500/20",
    flippedColor: "border-violet-500 bg-violet-500/20",
  },
  "fossil-dig": {
    emojis: ["🦴", "🦷", "🐚", "🌿", "🪨", "🦶", "🐾", "💀"],
    instruction: "Find matching fossil specimen pairs!",
    matchedColor: "border-amber-500 bg-amber-500/20",
    flippedColor: "border-orange-500 bg-orange-500/20",
  },
  "magma-memory": {
    emojis: ["🌋", "🔥", "🪨", "💎", "⚫", "🟤", "🧱", "♨️"],
    instruction: "Find matching igneous rock pairs beneath the magma!",
    matchedColor: "border-red-500 bg-red-500/20",
    flippedColor: "border-orange-500 bg-orange-500/20",
  },
};

export const WORD_SCRAMBLE_THEMES: Record<string, WordScrambleTheme> = {
  "anatomy-scramble": {
    words: [
      { word: "heart", cat: "Organ" }, { word: "lung", cat: "Organ" }, { word: "brain", cat: "Organ" },
      { word: "liver", cat: "Organ" }, { word: "kidney", cat: "Organ" }, { word: "bone", cat: "Skeleton" },
      { word: "muscle", cat: "Body" }, { word: "nerve", cat: "Nervous" }, { word: "artery", cat: "Blood" },
      { word: "skull", cat: "Skeleton" }, { word: "spine", cat: "Skeleton" }, { word: "cell", cat: "Biology" },
      { word: "blood", cat: "Body" }, { word: "stomach", cat: "Organ" }, { word: "skin", cat: "Body" },
    ],
  },
  "ice-words": {
    words: [
      { word: "ice", cat: "Arctic" }, { word: "snow", cat: "Weather" }, { word: "frost", cat: "Weather" },
      { word: "polar", cat: "Geography" }, { word: "tundra", cat: "Biome" }, { word: "glacier", cat: "Geology" },
      { word: "aurora", cat: "Atmosphere" }, { word: "blizzard", cat: "Weather" }, { word: "iceberg", cat: "Geology" },
      { word: "permafrost", cat: "Geology" }, { word: "arctic", cat: "Geography" }, { word: "floe", cat: "Geology" },
      { word: "sleet", cat: "Weather" }, { word: "hail", cat: "Weather" }, { word: "freeze", cat: "Physics" },
      { word: "thaw", cat: "Physics" }, { word: "climate", cat: "Science" }, { word: "icicle", cat: "Physics" },
    ],
  },
  "code-cracker": {
    words: [
      { word: "code", cat: "Programming" }, { word: "loop", cat: "Programming" }, { word: "byte", cat: "Data" },
      { word: "array", cat: "Data" }, { word: "pixel", cat: "Graphics" }, { word: "binary", cat: "Math" },
      { word: "virus", cat: "Security" }, { word: "server", cat: "Network" }, { word: "debug", cat: "Programming" },
      { word: "algorithm", cat: "Computer Science" }, { word: "cache", cat: "Memory" }, { word: "stack", cat: "Data" },
      { word: "logic", cat: "Programming" }, { word: "robot", cat: "AI" }, { word: "cyber", cat: "Security" },
      { word: "data", cat: "Computer Science" }, { word: "hash", cat: "Security" }, { word: "node", cat: "Network" },
    ],
  },
  "vine-scramble": {
    words: [
      { word: "fern", cat: "Plant" }, { word: "vine", cat: "Plant" }, { word: "moss", cat: "Plant" },
      { word: "orchid", cat: "Flower" }, { word: "canopy", cat: "Ecology" }, { word: "parrot", cat: "Bird" },
      { word: "toucan", cat: "Bird" }, { word: "jaguar", cat: "Mammal" }, { word: "monkey", cat: "Mammal" },
      { word: "epiphyte", cat: "Botany" }, { word: "symbiosis", cat: "Ecology" }, { word: "tropical", cat: "Climate" },
      { word: "humid", cat: "Climate" }, { word: "sloth", cat: "Mammal" }, { word: "bromeliad", cat: "Plant" },
      { word: "fungus", cat: "Biology" }, { word: "lichen", cat: "Biology" }, { word: "bamboo", cat: "Plant" },
    ],
  },
};

export const REACTION_TAP_THEMES: Record<string, ReactionTapTheme> = {
  "storm-chaser": {
    items: [
      { num: 1, sym: "☀️", name: "Clear", color: "#fbbf24" },
      { num: 2, sym: "🌤️", name: "Fair", color: "#fcd34d" },
      { num: 3, sym: "⛅", name: "Cloudy", color: "#9ca3af" },
      { num: 4, sym: "🌧️", name: "Rain", color: "#3b82f6" },
      { num: 5, sym: "⛈️", name: "Storm", color: "#6366f1" },
      { num: 6, sym: "🌩️", name: "Lightning", color: "#eab308" },
      { num: 7, sym: "🌨️", name: "Snow", color: "#bfdbfe" },
      { num: 8, sym: "🌪️", name: "Tornado", color: "#6b7280" },
      { num: 9, sym: "🌈", name: "Rainbow", color: "#ec4899" },
    ],
    instruction: "Tap the weather in order, calm to wild!",
    bgGradient: "from-sky-600 to-indigo-800",
  },
  "eruption-timing": {
    items: [
      { num: 1, sym: "🌋", name: "Shield Volcano", color: "#ef4444" },
      { num: 2, sym: "⛰️", name: "Stratovolcano", color: "#f97316" },
      { num: 3, sym: "💨", name: "Fumarole", color: "#6b7280" },
      { num: 4, sym: "♨️", name: "Hot Spring", color: "#06b6d4" },
      { num: 5, sym: "🔥", name: "Lava Flow", color: "#dc2626" },
      { num: 6, sym: "🪨", name: "Pumice", color: "#a8a29e" },
      { num: 7, sym: "💎", name: "Obsidian", color: "#1f2937" },
      { num: 8, sym: "🌊", name: "Pyroclastic", color: "#ea580c" },
      { num: 9, sym: "🏔️", name: "Caldera", color: "#854d0e" },
      { num: 10, sym: "☁️", name: "Ash Cloud", color: "#9ca3af" },
    ],
    instruction: "Tap volcanic features in order!",
    bgGradient: "from-red-950 to-orange-950",
  },
  "lightning-rod": {
    items: [
      { num: 1, sym: "⚡", name: "Lightning", color: "#facc15" },
      { num: 2, sym: "🌩️", name: "Thunder", color: "#6b7280" },
      { num: 3, sym: "🌪️", name: "Tornado", color: "#475569" },
      { num: 4, sym: "🌧️", name: "Rain", color: "#3b82f6" },
      { num: 5, sym: "☁️", name: "Cumulus", color: "#e5e7eb" },
      { num: 6, sym: "🌫️", name: "Fog", color: "#9ca3af" },
      { num: 7, sym: "💨", name: "Wind Gust", color: "#06b6d4" },
      { num: 8, sym: "❄️", name: "Hail", color: "#bfdbfe" },
      { num: 9, sym: "🌈", name: "Rainbow", color: "#a855f7" },
      { num: 10, sym: "☀️", name: "Sunshine", color: "#f59e0b" },
    ],
    instruction: "Tap weather phenomena in sequence!",
    bgGradient: "from-slate-900 to-yellow-950",
  },
  "binary-blitz": {
    items: [
      { num: 1, sym: "0️⃣", name: "Zero (0)", color: "#22c55e" },
      { num: 2, sym: "1️⃣", name: "One (1)", color: "#06b6d4" },
      { num: 3, sym: "🔟", name: "Two (10)", color: "#8b5cf6" },
      { num: 4, sym: "💻", name: "Three (11)", color: "#f59e0b" },
      { num: 5, sym: "📟", name: "Four (100)", color: "#ec4899" },
      { num: 6, sym: "🖥️", name: "Five (101)", color: "#14b8a6" },
      { num: 7, sym: "⌨️", name: "Six (110)", color: "#f97316" },
      { num: 8, sym: "🔌", name: "Seven (111)", color: "#6366f1" },
      { num: 9, sym: "💾", name: "Eight (1000)", color: "#ef4444" },
      { num: 10, sym: "🧮", name: "Nine (1001)", color: "#a855f7" },
    ],
    instruction: "Tap binary conversions in order!",
    bgGradient: "from-green-950 to-teal-950",
  },
};

export const CLICKER_THEMES: Record<string, ClickerTheme> = {
  "reactor-clicks": {
    producers: { label: "⚡ Fuel Cell", emoji: "⚡" },
    consumers: { label: "🔥 Reaction", emoji: "🔥" },
    decomposers: { label: "❄️ Coolant", emoji: "❄️" },
    bgGradient: "from-indigo-900 to-purple-950",
    balanceLabel: "Reactor",
    balancedMsg: "Reactor stable! Generating power!",
    unbalancedMsg: "Reactor unstable! Adjust fuel/coolant!",
  },
  "quantum-clicks": {
    producers: { label: "⬆️ Spin Up", emoji: "⬆️" },
    consumers: { label: "⬇️ Spin Down", emoji: "⬇️" },
    decomposers: { label: "↔️ Entangle", emoji: "↔️" },
    bgGradient: "from-violet-950 to-indigo-950",
    balanceLabel: "Quantum Field",
    balancedMsg: "Superposition stable! Earning points!",
    unbalancedMsg: "Decoherence detected! Rebalance!",
  },
};

export const CATCH_FALLING_THEMES: Record<string, CatchFallingTheme> = {
  "canopy-catch": {
    categories: [
      { label: "Catch fruits!", items: ["🍌", "🥥", "🥭", "🍈", "🍑", "🍇"], bad: ["🪨", "🐛", "🕷️", "💀"] },
      { label: "Catch seeds!", items: ["🌰", "🫘", "🌻", "🫑", "🥜", "🌿"], bad: ["🍂", "🪵", "🐍", "🦂"] },
      { label: "Catch specimens!", items: ["🦋", "🌸", "🍃", "🌺"], bad: ["🐝", "🪳", "💧", "🌧️"] },
    ],
    bgGradient: "from-green-950 to-emerald-950",
    catcherLabel: "Basket",
    instruction: "Move to catch jungle specimens! Avoid wrong items!",
  },
  "storm-runner": {
    categories: [
      { label: "Catch barometers!", items: ["🌡️", "🧭", "📡", "🔬", "📊", "🧪"], bad: ["⚡", "🌩️", "💥", "🔥"] },
      { label: "Catch anemometers!", items: ["💨", "🌬️", "🎐", "🪁", "📏", "⏱️"], bad: ["⚡", "🧊", "🌪️", "☄️"] },
      { label: "Catch rain gauges!", items: ["💧", "🪣", "🫗", "🧫", "📐", "🔭"], bad: ["⚡", "❄️", "🌊", "🪨"] },
    ],
    bgGradient: "from-slate-900 to-yellow-950",
    catcherLabel: "Collector",
    instruction: "Catch falling weather instruments! Avoid lightning and debris!",
  },
};

export const DEFENSE_THEMES: Record<string, DefenseTheme> = {
  "firewall-defense": {
    enemies: ["🐛", "👾", "💀", "🔓"],
    centerEmoji: "🖥️",
    bgGradient: "from-green-100 to-teal-100",
    bgGradientDark: "from-green-950 to-teal-950",
    instruction: "Click malware before it reaches the mainframe!",
  },
  "deep-sea-defense": {
    enemies: ["🦑", "🪼", "🐡", "🦈"],
    centerEmoji: "🛟",
    bgGradient: "from-blue-200 to-indigo-200",
    bgGradientDark: "from-blue-950 to-indigo-950",
    instruction: "Click deep-sea creatures before they reach your submarine!",
  },
  "blizzard-runner": {
    enemies: ["🧊", "❄️", "🌨️", "⛄"],
    centerEmoji: "🏠",
    bgGradient: "from-sky-100 to-blue-100",
    bgGradientDark: "from-sky-950 to-blue-950",
    instruction: "Click icy hazards before they breach your arctic base!",
  },
};

export type LauncherTheme = {
  bgGradient: [string, string];
  groundColor: string;
  projectileColor: string;
  projectileAccent: string;
  targetColor: string;
  targetAccent: string;
  label: string;
  projectileName: string;
  targetName: string;
};

export type MazeTheme = {
  wallColor: string;
  pathColor: string;
  playerEmoji: string;
  exitEmoji: string;
  collectibleEmoji: string;
  bgGradient: string;
  label: string;
  instruction: string;
};

export type GravityMazeTheme = {
  wallColor: string;
  pathColor: string;
  playerEmoji: string;
  exitEmoji: string;
  bgGradient: string;
  label: string;
  facts: string[];
};

export const LAUNCHER_THEMES: Record<string, LauncherTheme> = {};

export const MAZE_THEMES: Record<string, MazeTheme> = {
  "crystal-match": {
    wallColor: "#7c3aed",
    pathColor: "#1e1b4b",
    playerEmoji: "💎",
    exitEmoji: "🏆",
    collectibleEmoji: "✨",
    bgGradient: "from-purple-950 to-pink-950",
    label: "💎 Crystal Cavern Maze",
    instruction: "Navigate through glittering crystal tunnels!",
  },
};

export const GRAVITY_MAZE_THEMES: Record<string, GravityMazeTheme> = {
  "wave-rider": {
    wallColor: "#4c1d95",
    pathColor: "#1e1b4b",
    playerEmoji: "⚛️",
    exitEmoji: "🌀",
    bgGradient: "from-violet-950 to-indigo-950",
    label: "⚛️ Quantum Wave Maze",
    facts: [
      "Particles can exist in multiple states at once (superposition)",
      "Measuring a quantum particle changes its state",
      "Entangled particles affect each other instantly across any distance",
      "Light behaves as both a wave and a particle",
      "Electrons orbit in probability clouds, not fixed paths",
      "Quantum tunneling lets particles pass through barriers",
      "The Heisenberg principle: you can't know position and speed exactly",
      "Schrödinger's cat is both alive and dead until observed",
    ],
  },
};

export const SLIDER_MATCH_THEMES: Record<string, SliderMatchTheme> = {
  "pressure-puzzle": {
    targets: [
      { name: "Hurricane", val1: 70, val2: 95, val3: 10, emoji: "🌀" },
      { name: "Tornado", val1: 65, val2: 85, val3: 20, emoji: "🌪️" },
      { name: "Blizzard", val1: 15, val2: 80, val3: 30, emoji: "🌨️" },
      { name: "Dust Storm", val1: 90, val2: 10, val3: 25, emoji: "🏜️" },
      { name: "Thunderstorm", val1: 60, val2: 90, val3: 15, emoji: "⛈️" },
      { name: "Clear Skies", val1: 75, val2: 25, val3: 80, emoji: "☀️" },
    ],
    sliders: [
      { label: "Temperature", emoji: "🌡️", unit: "°F" },
      { label: "Humidity", emoji: "💧", unit: "%" },
      { label: "Pressure", emoji: "🎈", unit: "hPa" },
    ],
    prompt: "Recreate this storm:",
    buttonLabel: "Simulate Storm!",
  },
};
