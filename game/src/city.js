// Solara Bay's layout, generated deterministically from a seed: a grid of
// boulevards, six named districts, buildings set into the blocks between the
// roads, palm trees along the streets, a beach and the sea along the south
// edge, and the landmark points the story missions use. Pure data and pure
// helpers: no drawing, no DOM, so the tests can build the same city.
import { WORLD } from './config.js';
import { createRng, rngInt, rngPick, rngRange } from './rng.js';

const ROOF_KEYS = ['roofA', 'roofB', 'roofC', 'roofD'];

// The six districts, as world rectangles, west to east and north to south.
const DISTRICT_DEFS = [
  { name: 'Palm Heights', x: 0, y: 0, w: 1200, h: 1200 },
  { name: 'Solara Point', x: 1200, y: 0, w: 800, h: 800 },
  { name: 'Harbor Point', x: 2000, y: 0, w: 1200, h: 1200 },
  { name: 'Old Market', x: 1200, y: 800, w: 800, h: 800 },
  { name: 'Marina District', x: 0, y: 1200, w: 1600, h: 880 },
  { name: 'Coral Flats', x: 1600, y: 1200, w: 1600, h: 880 },
];

/** The district a world point falls in, or null out past the beach. */
export function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return null;
}

/** True when the point lies on a road surface (either direction of travel). */
export function isOnRoad(city, x, y) {
  const half = WORLD.roadWidth / 2;
  for (const vx of city.roads.verticals) if (Math.abs(x - vx) <= half) return true;
  for (const hy of city.roads.horizontals) if (Math.abs(y - hy) <= half) return true;
  return false;
}

/** The nearest point that lies on a road, for spawning and navigation. */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const vx of city.roads.verticals) {
    const d = Math.abs(x - vx);
    if (d < bestDist) {
      bestDist = d;
      best = { x: vx, y };
    }
  }
  for (const hy of city.roads.horizontals) {
    const d = Math.abs(y - hy);
    if (d < bestDist) {
      bestDist = d;
      best = { x, y: hy };
    }
  }
  return best;
}

/** True when the point is on a sidewalk band beside a road. */
export function isOnSidewalk(city, x, y) {
  const inner = WORLD.roadWidth / 2;
  const outer = inner + WORLD.sidewalk;
  for (const vx of city.roads.verticals) {
    const d = Math.abs(x - vx);
    if (d > inner && d <= outer) return true;
  }
  for (const hy of city.roads.horizontals) {
    const d = Math.abs(y - hy);
    if (d > inner && d <= outer) return true;
  }
  return false;
}

/** Build the whole city from a seed. The same seed always builds the same city. */
export function generateCity(seed) {
  const rng = createRng(seed);
  const verticals = [];
  for (let x = 200; x < WORLD.width; x += WORLD.block) verticals.push(x);
  const horizontals = [];
  for (let y = 200; y < 2000; y += WORLD.block) horizontals.push(y);
  const roads = { verticals, horizontals };

  const sandY = 2080;
  const waterY = 2240;
  const beach = { sandY, waterY };

  const districts = DISTRICT_DEFS.map((d) => ({ ...d }));

  // Buildings fill the blocks between roads, kept off the road surface and
  // off the beach. Each block gets a few blocks of flats, shops and houses.
  const buildings = [];
  const inset = WORLD.roadWidth / 2 + WORLD.sidewalk + 10;
  for (let bx = 0; bx < verticals.length - 1; bx += 1) {
    for (let by = 0; by <= horizontals.length; by += 1) {
      const x0 = verticals[bx] + inset;
      const x1 = verticals[bx + 1] - inset;
      const y0 = by === 0 ? 24 : horizontals[by - 1] + inset;
      const y1 = by < horizontals.length ? horizontals[by] - inset : sandY - 30;
      if (x1 - x0 < 120 || y1 - y0 < 100) continue;
      const count = rngInt(rng, 2, 4);
      for (let i = 0; i < count; i += 1) {
        const w = rngRange(rng, 62, 120);
        const h = rngRange(rng, 54, 110);
        const x = rngRange(rng, x0, Math.max(x0 + 1, x1 - w));
        const y = rngRange(rng, y0, Math.max(y0 + 1, y1 - h));
        buildings.push({ x, y, w, h, roof: rngPick(rng, ROOF_KEYS), floors: rngInt(rng, 1, 5) });
      }
    }
  }

  // Palms line the boulevards and the beach promenade.
  const palms = [];
  for (const vx of verticals) {
    for (let y = 90; y < sandY - 40; y += 150) {
      palms.push({ x: vx + WORLD.roadWidth / 2 + 12, y: y + rngRange(rng, -14, 14) });
    }
  }
  for (let x = 60; x < WORLD.width; x += 130) {
    palms.push({ x, y: sandY + 36 + rngRange(rng, -8, 8) });
  }

  const landmarks = {
    marina: { x: 620, y: 1740, label: "Sol's Marina Office" },
    market: { x: 1420, y: 1010, label: 'Old Market Alley' },
    harbor: { x: 2610, y: 590, label: 'Harbor Point Warehouse' },
    safehouse: { x: 590, y: 590, label: 'Palm Heights Safehouse' },
    estate: { x: 1610, y: 390, label: 'Venn Estate Pier' },
    crewCarA: { x: 2210, y: 1410, label: 'Crew car, Coral Flats' },
    crewCarB: { x: 2610, y: 1810, label: 'Crew car, Coral Flats' },
  };
  // Landmarks the player must reach on foot or by car sit beside a road.
  for (const key of Object.keys(landmarks)) {
    const lm = landmarks[key];
    const near = nearestRoadPoint({ roads }, lm.x, lm.y);
    lm.roadX = near.x;
    lm.roadY = near.y;
  }

  return {
    width: WORLD.width,
    height: WORLD.height,
    roads,
    districts,
    buildings,
    palms,
    beach,
    landmarks,
    seed,
  };
}
