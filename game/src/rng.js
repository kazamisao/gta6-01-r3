// A tiny seeded random number generator (mulberry32) plus helpers. The whole
// game draws from seeded streams so a given seed always builds the same city
// and the same sound variations, and nothing depends on Math.random.

/** Create a deterministic stream of numbers in [0, 1) from an integer seed. */
export function createRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max) drawn from the stream. */
export function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max] (both ends included) drawn from the stream. */
export function rngInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of a non-empty array, drawn from the stream. */
export function rngPick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
