import { BOSS_QUESTIONS_BY_YEAR, type BossQ } from "@/lib/bossQuestions";

// Each boss's question bank is already on its own science theme. To keep themed
// content (story regions, elemental dimensions, bosses) ON-TOPIC, we draw the
// question pool from bosses whose subject matches the theme — instead of mixing
// every bank together (which produced unrelated questions).
export const TOPIC_BOSSES: Record<string, string[]> = {
  // Weather / air
  weather:     ["chaos-storm", "thunder-king"],
  storm:       ["chaos-storm", "thunder-king"],
  air:         ["chaos-storm", "thunder-king"],
  wind:        ["chaos-storm", "thunder-king"],
  // Electricity / energy
  electricity: ["dr-blackout", "thunder-king"],
  energy:      ["dr-blackout", "thunder-king", "professor-meltdown"],
  // Fire / heat
  fire:        ["magma-titan", "inferno-colossus", "professor-meltdown"],
  heat:        ["magma-titan", "inferno-colossus", "professor-meltdown"],
  // Water
  water:       ["the-kraken", "tidal-leviathan"],
  tide:        ["the-kraken", "tidal-leviathan"],
  ocean:       ["the-kraken", "tidal-leviathan"],
  // Ice / cold
  ice:         ["frost-wyrm", "cryo-sovereign"],
  cold:        ["frost-wyrm", "cryo-sovereign"],
  // Earth / geology
  earth:       ["tecton-the-shaker", "gaia-behemoth", "magma-titan"],
  geology:     ["tecton-the-shaker", "gaia-behemoth"],
  // Space / cosmic
  space:       ["nebula-queen", "cosmic-entity", "astro-devourer", "the-void", "dark-matter"],
  cosmic:      ["nebula-queen", "cosmic-entity", "astro-devourer", "the-void", "dark-matter"],
  // Biology / life
  biology:     ["mutation-master", "plague-lord", "virus-prime", "jungle-hydra", "nano-swarm", "rex-overlord", "gaia-behemoth"],
  life:        ["mutation-master", "jungle-hydra", "nano-swarm", "gaia-behemoth"],
  genetics:    ["mutation-master", "nano-swarm"],
  disease:     ["plague-lord", "virus-prime"],
  // Chemistry / elements
  chemistry:   ["professor-meltdown", "king-element", "crystal-golem"],
  elements:    ["king-element", "professor-meltdown", "crystal-golem"],
  // Physics
  physics:     ["gravity-king", "professor-paradox", "quantum-computer", "quantum-phantom", "dark-matter"],
  gravity:     ["gravity-king", "dark-matter"],
  time:        ["professor-paradox"],
  quantum:     ["quantum-computer", "quantum-phantom"],
  // Mind / tech (approximate)
  mind:        ["nano-swarm", "quantum-computer", "quantum-phantom"],
  tech:        ["the-architect", "quantum-computer", "nano-swarm"],
};

export function yearToTier(year: number): number {
  if (year <= 4) return 4;
  if (year <= 6) return 6;
  return 8;
}

// Build a question pool. With a known `topic`, draws only from matching bosses;
// otherwise (no/unknown topic) falls back to a full mix.
export function buildTopicPool(tier: number, topic?: string): BossQ[] {
  const ids = topic && TOPIC_BOSSES[topic] ? TOPIC_BOSSES[topic] : Object.keys(BOSS_QUESTIONS_BY_YEAR);
  const collect = (bossIds: string[]): BossQ[] => {
    const out: BossQ[] = [];
    for (const id of bossIds) {
      const banks = BOSS_QUESTIONS_BY_YEAR[id];
      if (!banks) continue;
      const qs = banks[tier] || banks[6] || banks[4] || banks[8];
      if (qs) out.push(...qs);
    }
    return out;
  };
  let pool = collect(ids);
  if (pool.length === 0) pool = collect(Object.keys(BOSS_QUESTIONS_BY_YEAR)); // safety net
  return pool.sort(() => Math.random() - 0.5);
}
