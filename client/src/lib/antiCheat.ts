// Shared autoclicker / automation detector.
//
// The old detector only fired when input was BOTH faster than ~95ms AND almost
// perfectly uniform, so any autoclicker set to a human-ish speed (120-300ms)
// sailed right through. Real humans — even kids mashing a button — have lots of
// timing jitter, so the strongest signal isn't raw speed, it's *consistency*.
//
// We flag on any of three independent signals:
//   1. Metronome timing  — coefficient of variation (stdDev/mean) is tiny across
//      a wide speed range. No human holds <8% variation for 16+ taps.
//   2. Superhuman speed   — sustained mean interval below ~70ms (>14 clicks/sec).
//   3. Pixel-locked taps  — many pointer events landing on the (near) exact same
//      coordinate, which is what a fixed-position autoclicker produces.

export interface InputSample {
  t: number;       // timestamp (ms)
  x?: number;      // pointer X (omit for keyboard)
  y?: number;      // pointer Y
}

export interface CadenceVerdict {
  robotic: boolean;
  reason: string;
}

const MIN_SAMPLES = 16;

function stats(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Analyse the most recent input samples and decide whether they look automated.
 * Returns { robotic:false } until there's enough evidence.
 */
export function analyzeCadence(samples: InputSample[]): CadenceVerdict {
  if (samples.length < MIN_SAMPLES) return { robotic: false, reason: "" };

  const recent = samples.slice(-MIN_SAMPLES);
  const times = recent.map((s) => s.t);
  const intervals = times.slice(1).map((t, i) => t - times[i]);
  const { mean, stdDev } = stats(intervals);
  const cv = mean > 0 ? stdDev / mean : 1;

  // 1. Metronome-uniform timing (the giveaway for most autoclickers).
  if (mean < 320 && cv < 0.08) {
    return {
      robotic: true,
      reason: `Robotic cadence: mean ${Math.round(mean)}ms, CV ${(cv * 100).toFixed(1)}% over ${intervals.length} inputs`,
    };
  }

  // 2. Sustained superhuman speed (>~14 inputs/sec).
  if (mean < 70) {
    return {
      robotic: true,
      reason: `Superhuman speed: mean ${Math.round(mean)}ms (${(1000 / mean).toFixed(1)}/sec) over ${intervals.length} inputs`,
    };
  }

  // 3. Pixel-locked pointer events (fixed-position autoclicker).
  const pointers = recent.filter((s) => typeof s.x === "number" && typeof s.y === "number");
  if (pointers.length >= MIN_SAMPLES) {
    const sx = stats(pointers.map((p) => p.x as number));
    const sy = stats(pointers.map((p) => p.y as number));
    if (sx.stdDev < 2.5 && sy.stdDev < 2.5) {
      return {
        robotic: true,
        reason: `Pixel-locked clicks: spread ${sx.stdDev.toFixed(1)}x${sy.stdDev.toFixed(1)}px over ${pointers.length} clicks`,
      };
    }
  }

  return { robotic: false, reason: "" };
}
