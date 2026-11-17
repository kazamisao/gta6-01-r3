// Solara Bay headless tests: pure logic modules only (city, physics, wanted,
// missions, save, audio dispatch table). Run with: node tests/run.mjs
import { createRng, rngRange } from '../game/src/rng.js';
import { generateCity, isOnRoad, nearestRoadPoint } from '../game/src/city.js';
import { stepCar, separateCircles, circlesOverlap } from '../game/src/physics.js';
import { createWanted, addCrime, starsFor, updateWanted, policeTarget } from '../game/src/wanted.js';
import { MISSIONS, createMissionState, currentObjective, notifyMission } from '../game/src/missions.js';
import { serializeSave, parseSave } from '../game/src/save.js';
import { SOUND_EVENTS, soundForEvent } from '../game/src/audio.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`FAIL ${name}: ${err.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: ${a} !== ${b}`);
}

// --- rng -------------------------------------------------------------------
test('rng is deterministic for a seed', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 8; i += 1) eq(a(), b(), 'same seed, same stream');
});
test('rng range stays inside bounds', () => {
  const r = createRng(7);
  for (let i = 0; i < 200; i += 1) {
    const v = rngRange(r, 3, 9);
    assert(v >= 3 && v < 9, 'range bound');
  }
});

// --- city ------------------------------------------------------------------
test('city generation is deterministic', () => {
  const a = generateCity(1234);
  const b = generateCity(1234);
  eq(JSON.stringify(a.buildings), JSON.stringify(b.buildings), 'buildings match');
  eq(a.roads.verticals.join(','), b.roads.verticals.join(','), 'roads match');
});
test('city has named districts and a beach', () => {
  const city = generateCity(5);
  assert(city.districts.length >= 5, 'at least five districts');
  const names = city.districts.map((d) => d.name);
  assert(names.includes('Marina District'), 'marina district exists');
  assert(city.beach.sandY < city.beach.waterY, 'sand sits above water');
});
test('city buildings never sit on roads', () => {
  const city = generateCity(99);
  for (const b of city.buildings) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    assert(!isOnRoad(city, cx, cy), `building centre off road at ${cx},${cy}`);
  }
});
test('nearest road point lands on a road', () => {
  const city = generateCity(3);
  const p = nearestRoadPoint(city, 10, 10);
  assert(isOnRoad(city, p.x, p.y), 'snapped point is on a road');
});
test('city exposes every mission landmark', () => {
  const city = generateCity(1);
  for (const key of ['marina', 'market', 'harbor', 'safehouse', 'estate', 'crewCarA', 'crewCarB']) {
    assert(city.landmarks[key], `landmark ${key} exists`);
  }
});

// --- physics ---------------------------------------------------------------
test('car accelerates forward from rest', () => {
  const car = { x: 0, y: 0, angle: 0, speed: 0, maxSpeed: 300, maxReverse: 90, accel: 260 };
  const out = stepCar(car, { throttle: 1, steer: 0 }, 0.5);
  assert(out.speed > 50, 'speed grows under throttle');
  assert(out.x > 0, 'car moves along its heading');
});
test('reverse engages from a stop when reverse is held', () => {
  const car = { x: 0, y: 0, angle: 0, speed: 0, maxSpeed: 300, maxReverse: 90, accel: 260 };
  let c = car;
  for (let i = 0; i < 60; i += 1) c = stepCar(c, { throttle: -1, steer: 0 }, 1 / 60);
  assert(c.speed < -40, `reverse speed reached (${c.speed})`);
  assert(c.speed >= -90.001, 'reverse capped at maxReverse');
  assert(c.x < 0, 'car travelled backwards');
});
test('reverse input brakes a moving car before reversing', () => {
  const car = { x: 0, y: 0, angle: 0, speed: 120, maxSpeed: 300, maxReverse: 90, accel: 260 };
  const out = stepCar(car, { throttle: -1, steer: 0 }, 0.1);
  assert(out.speed < 120, 'braking slows the car');
  assert(out.speed > 0, 'no instant flip into reverse');
});
test('separation pushes overlapping cars apart', () => {
  const a = { x: 100, y: 100, r: 16 };
  const b = { x: 112, y: 100, r: 16 };
  separateCircles(a, b);
  assert(!circlesOverlap(a, b), 'no overlap after separation');
});

// --- wanted ----------------------------------------------------------------
test('crimes raise the wanted stars', () => {
  const w = createWanted();
  eq(starsFor(w), 0, 'clean at start');
  addCrime(w, 'theft');
  assert(starsFor(w) >= 1, 'theft earns a star');
  addCrime(w, 'hitPed');
  addCrime(w, 'hitPed');
  assert(starsFor(w) >= 2, 'pedestrian hits escalate');
});
test('wanted heat decays only while unseen', () => {
  const w = createWanted();
  addCrime(w, 'theft');
  const before = w.heat;
  updateWanted(w, 1, true);
  eq(w.heat, before, 'no decay while police see you');
  updateWanted(w, 1, false);
  assert(w.heat < before, 'heat decays out of sight');
});
test('police target count follows the stars', () => {
  const w = createWanted();
  eq(policeTarget(w), 0, 'no police when clean');
  addCrime(w, 'killPed');
  addCrime(w, 'killPed');
  assert(policeTarget(w) >= 2, 'police respond at high heat');
});

// --- missions --------------------------------------------------------------
test('mission chain has at least three story missions with rewards', () => {
  assert(MISSIONS.length >= 3, 'three or more missions');
  for (const m of MISSIONS) {
    assert(m.reward > 0, `${m.id} pays a reward`);
    assert(m.steps.length >= 2, `${m.id} has multiple steps`);
    assert(m.title.length > 0, `${m.id} has a title`);
  }
});
test('first mission is completable from a fresh state', () => {
  const s = createMissionState();
  let guard = 0;
  let totalReward = 0;
  while (!s.done && guard < 40) {
    guard += 1;
    const step = currentObjective(s);
    assert(step, 'an objective exists while the chain runs');
    const event = { type: step.event, at: step.at, tag: step.tag };
    const res = notifyMission(s, event);
    if (res.missionComplete) totalReward += res.reward;
  }
  assert(s.done, 'the whole chain completes by following its own objectives');
  assert(totalReward > 0, 'rewards were paid along the way');
});
test('wrong events do not advance a mission step', () => {
  const s = createMissionState();
  const stepBefore = currentObjective(s);
  notifyMission(s, { type: 'unrelated-noise' });
  eq(currentObjective(s), stepBefore, 'objective unchanged by noise');
});

// --- save ------------------------------------------------------------------
test('save round-trips through serialize and parse', () => {
  const data = { cash: 640, missionIndex: 2, missionStep: 1, x: 512.5, y: 300.25, inCar: false };
  const back = parseSave(serializeSave(data));
  eq(back.cash, 640, 'cash survives');
  eq(back.missionIndex, 2, 'mission progress survives');
  eq(back.x, 512.5, 'position survives');
});
test('parse rejects corrupt or foreign saves', () => {
  eq(parseSave('not json at all'), null, 'garbage rejected');
  eq(parseSave('{"version":99,"cash":5}'), null, 'wrong version rejected');
  eq(parseSave(null), null, 'missing save rejected');
});

// --- audio dispatch ----------------------------------------------------------
test('every gameplay event maps to a sound name the player knows', () => {
  for (const ev of ['engine', 'crash', 'siren', 'gunshot', 'pickup', 'jingle', 'door', 'click', 'busted']) {
    const name = soundForEvent(ev);
    assert(typeof name === 'string' && name.length > 0, `event ${ev} maps to a sound`);
    assert(SOUND_EVENTS.includes(name), `sound ${name} is in the dispatch table`);
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
