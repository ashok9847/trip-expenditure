// Pure playback maths for the trail map: when the jeep reaches each stop and
// how far along the trail it is at any moment.

/** Travel time between stops, pause at each stop, drive into camp (ms at 1x). */
export const TIMING = { travel: 1150, dwell: 1500, final: 1600 };
/** Reduced motion: no driving, just step from stop to stop. */
export const REDUCED_TIMING = { travel: 0, dwell: 1400, final: 0 };

/** The three named easings (CSS twins live in trail.css). */
export const EASINGS = {
  pop: [0.34, 1.56, 0.64, 1], // springy pop: stickers landing
  pan: [0.45, 0, 0.2, 1], // slow ease: camera and jeep
  coin: 'linear', // snappy linear: coin flights
};

/** CSS-compatible cubic-bezier easing function. */
export function cubicBezier(x1, y1, x2, y2) {
  const bx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}
export const easePan = cubicBezier(...EASINGS.pan);

/** @returns {{ n:number, arrivals:number[], total:number, timing:object }} */
export function buildSchedule(n, timing = TIMING) {
  const arrivals = [];
  let time = 0;
  for (let i = 0; i < n; i++) {
    time += timing.travel;
    arrivals.push(time);
    time += timing.dwell;
  }
  time += timing.final;
  return { n, arrivals, total: time, timing };
}

/** How many stops the jeep has reached at `time`. */
export const reachedAt = (time, s) => s.arrivals.filter((a) => a <= time).length;

/** Which leg we're on (0 = start -> stop 1, n = last stop -> camp) and how far through it. */
export function legAt(time, s) {
  const { travel, dwell, final } = s.timing;
  for (let k = 0; k <= s.n; k++) {
    const start = k === 0 ? 0 : s.arrivals[k - 1] + dwell;
    const dur = k === s.n ? final : travel;
    const end = start + dur;
    if (time < end || k === s.n) {
      return { leg: k, frac: dur === 0 ? (time >= start ? 1 : 0) : Math.min(1, Math.max(0, (time - start) / dur)) };
    }
  }
  return { leg: s.n, frac: 1 };
}

/**
 * Distance along the trail path at `time`.
 * @param {number[]} lengths [start, stop1, ..., stopN, camp] cumulative path lengths
 */
export function lengthAt(time, s, lengths, ease = easePan) {
  const { leg, frac } = legAt(time, s);
  const a = lengths[leg];
  const b = lengths[leg + 1];
  return a + (b - a) * ease(frac);
}
