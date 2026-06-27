// Shared in-fight boss "stage" system. As a boss loses health it crosses stage
// thresholds and MUTATES — getting a little harder each stage (faster timers,
// hits harder) before you finish it off. Used by the normal Bosses page, World
// bosses, dimension Colosseum and Story bosses so every boss fight feels the same.

export const BOSS_STAGES = 3;

// Stage index 0..(stages-1) from remaining HP fraction (1 = full, 0 = dead).
// With 3 stages: >66% = 0, 34–66% = 1, ≤33% = 2.
export function bossStage(hpFraction: number, stages = BOSS_STAGES): number {
  const frac = Math.max(0, Math.min(1, hpFraction));
  return Math.min(stages - 1, Math.floor((1 - frac) * stages));
}

// Short, kid-friendly label shown when the boss enters a new stage.
const STAGE_NAMES = ["", "Mutating!", "Frenzied!", "Final Fury!", "Unhinged!"];
export function stageName(stage: number): string {
  return STAGE_NAMES[Math.min(STAGE_NAMES.length - 1, stage)] || "Mutating!";
}

// A tint that gets angrier each stage — for the boss sprite / health bar.
const STAGE_TINTS = ["", "drop-shadow-[0_0_8px_rgba(250,204,21,0.7)]", "drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]", "drop-shadow-[0_0_12px_rgba(239,68,68,0.9)]"];
export function stageTint(stage: number): string {
  return STAGE_TINTS[Math.min(STAGE_TINTS.length - 1, stage)] || "";
}

export const STAGE_EMOJI = ["", "⚡", "🔥", "💢", "☠️"];
