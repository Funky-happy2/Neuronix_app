// Shared autoclicker / automation detector.
//
// IMPORTANT: many of our games are tap-to-act (Gravity Dash, clickers, reaction
// taps). A human playing those clicks the SAME spot, often at a fairly steady
// rhythm — that is NORMAL play and must never be flagged. So this detector only
// fires on signatures a human physically cannot sustain:
//
//   1. Near-perfect metronome timing — coefficient of variation (stdDev/mean)
//      under ~3% across a LONG window. Real humans always have >5-10% jitter,
//      even when deliberately tapping steadily; autoclickers sit near 0%.
//   2. Sustained superhuman speed — mean interval under ~55ms (>18 clicks/sec)
//      over a long window.
//
// We deliberately do NOT flag "same coordinate" on its own — tapping one jump
// button is exactly what these games ask for. Fixed position only counts as
// corroborating evidence alongside near-perfect timing.

export interface InputSample {
  t: number;       // timestamp (ms)
  x?: number;      // pointer X (omit for keyboard)
  y?: number;      // pointer Y
}

export interface CadenceVerdict {
  robotic: boolean;
  reason: string;
}

// Require a long run of inputs before judging — a few steady taps are not proof.
const MIN_SAMPLES = 40;

function stats(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Analyse the most recent input samples and decide whether they look automated.
 * Returns { robotic:false } until there's strong, sustained evidence.
 */
export function analyzeCadence(samples: InputSample[]): CadenceVerdict {
  if (samples.length < MIN_SAMPLES) return { robotic: false, reason: "" };

  const recent = samples.slice(-MIN_SAMPLES);
  const times = recent.map((s) => s.t);
  const intervals = times.slice(1).map((t, i) => t - times[i]);
  const { mean, stdDev } = stats(intervals);
  const cv = mean > 0 ? stdDev / mean : 1;

  // 1. Near-perfect metronome timing — the unmistakable autoclicker signature.
  //    CV under 1.5% over ~40 inputs is not humanly reproducible (even trained,
  //    deliberately-steady tapping floors out around 4-5% jitter). We also
  //    require a reasonably brisk cadence — a slow, steady human pace is fine.
  if (mean < 260 && cv < 0.015) {
    // Corroborate with pixel-lock when we have pointer data: a real autoclicker
    // is both metronome-uniform AND fixed-position. Keyboard input (no coords)
    // is judged on timing alone.
    const pointers = recent.filter((s) => typeof s.x === "number" && typeof s.y === "number");
    if (pointers.length >= MIN_SAMPLES * 0.75) {
      const sx = stats(pointers.map((p) => p.x as number));
      const sy = stats(pointers.map((p) => p.y as number));
      // If the player is moving around at all, it's a human — don't flag.
      if (sx.stdDev >= 1.5 || sy.stdDev >= 1.5) return { robotic: false, reason: "" };
    }
    return {
      robotic: true,
      reason: `Robotic cadence: mean ${Math.round(mean)}ms, CV ${(cv * 100).toFixed(1)}% over ${intervals.length} inputs`,
    };
  }

  // 2. Sustained superhuman speed (>~18 inputs/sec across the whole window).
  if (mean < 55) {
    return {
      robotic: true,
      reason: `Superhuman speed: mean ${Math.round(mean)}ms (${(1000 / mean).toFixed(1)}/sec) over ${intervals.length} inputs`,
    };
  }

  return { robotic: false, reason: "" };
}
