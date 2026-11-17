// Solara Bay: boot, the game loop and every system wired together. Rio
// Calloway explores a coastal city on foot and by car, takes Sol Vega's
// missions, and tries to stay ahead of the Solara Bay police. Screens: title,
// play, paused, busted, wasted. The simulation advances in fixed steps; the
// renderer and HUD only read state. ?scene=drive|foot|chase stages a frame
// for the entry's screenshots instead of running the loop.
import { CITY_SEED, PALETTE, PLAYER, SAVE_KEY, STEP, WORLD } from './config.js';
import { createRng } from './rng.js';
import { districtAt, generateCity } from './city.js';
import { angleDelta, circleHitsRects, clamp, stepCar } from './physics.js';
import { addCrime, createWanted, policeTarget, starsFor, updateWanted } from './wanted.js';
import { MISSIONS, createMissionState, currentMission, currentObjective, notifyMission } from './missions.js';
import { parseSave, serializeSave } from './save.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, createInput } from './input.js';
import {
  createCar,
  createPed,
  placeOnRoad,
  placePedOnSidewalk,
  spawnPolice,
  updatePed,
  updatePoliceCar,
  updateTrafficCar,
} from './entities.js';
import { createBullets, spawnBullet, stepBullets } from './combat.js';
import { drawWorld, spawnParticles, stepParticles } from './render.js';
import { drawHud, drawMinimap, drawOverlay, drawTitle, titleButtons } from './hud.js';

const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const mmCtx = minimap.getContext('2d');
const status = document.getElementById('status');

const audio = createAudio(createRng(777));
const city = generateCity(CITY_SEED);
const rng = createRng(CITY_SEED * 7 + 13);

const state = {
  screen: 'title',
  time: 0,
  cash: 50,
  player: null,
  cars: [],
  peds: [],
  bullets: createBullets(),
  particles: [],
  skids: [],
  wanted: createWanted(),
  missions: createMissionState(),
  cam: { x: 0, y: 0 },
  shake: 0,
  message: null,
  fireCooldown: 0,
  bustMeter: 0,
  guardsForStep: '',
  crewSpawned: false,
  caseItem: null,
  crimeCooldown: 0,
  saveTimer: 0,
  hasSave: false,
};

function say(text, sub = '', seconds = 3.2, color = '#ffffff') {
  state.message = { text, sub, until: state.time + seconds, color };
}

function playerPos() {
  return state.player.inCar ?? state.player;
}

// ------------------------------------------------------------ world building

function spawnTraffic() {
  while (state.cars.filter((c) => c.kind === 'traffic').length < 14) {
    const car = createCar(rng, 0, 0, 'traffic');
    placeOnRoad(city, rng, car);
    if (Math.hypot(car.x - state.player.x, car.y - state.player.y) < 240) continue;
    state.cars.push(car);
  }
  while (state.cars.filter((c) => c.kind === 'parked').length < 9) {
    const car = createCar(rng, 0, 0, 'parked');
    placeOnRoad(city, rng, car);
    car.speed = 0;
    car.driver = null;
    state.cars.push(car);
  }
}

function spawnPeds() {
  while (state.peds.filter((p) => !p.guard).length < 24) {
    const ped = createPed(rng, 0, 0);
    placePedOnSidewalk(city, rng, ped);
    state.peds.push(ped);
  }
}

function spawnCrewCars() {
  if (state.crewSpawned) return;
  state.crewSpawned = true;
  for (const key of ['crewCarA', 'crewCarB']) {
    const lm = city.landmarks[key];
    const car = createCar(rng, lm.roadX, lm.roadY, 'crew', 'sport');
    car.tag = key;
    car.color = '#e63946';
    car.angle = Math.PI / 2;
    state.cars.push(car);
  }
}

function spawnGuards(tag, landmarkKey, count) {
  const lm = city.landmarks[landmarkKey];
  for (let i = 0; i < count; i += 1) {
    const ped = createPed(rng, lm.x + (i - 1) * 34, lm.y + 26);
    ped.guard = true;
    ped.tag = tag;
    ped.shirt = '#22252a';
    ped.health = 34;
    state.peds.push(ped);
  }
}

function resetWorld() {
  state.cars = [];
  state.peds = [];
  state.bullets = createBullets();
  state.particles = [];
  state.skids = [];
  state.wanted = createWanted();
  state.bustMeter = 0;
  state.crewSpawned = false;
  state.guardsForStep = '';
  state.caseItem = null;
  state.player = {
    x: city.landmarks.marina.x - 30,
    y: city.landmarks.marina.y + 44,
    angle: -Math.PI / 2,
    r: PLAYER.radius,
    health: PLAYER.maxHealth,
    inCar: null,
    speedNow: 0,
  };
  spawnTraffic();
  spawnPeds();
}

function newGame() {
  state.cash = 50;
  state.missions = createMissionState();
  resetWorld();
  state.screen = 'play';
  say('SOLARA BAY', 'Meet Sol at the marina office — follow the gold marker.', 4.5, '#ffd166');
  saveGame();
}

function loadSave() {
  try {
    return parseSave(window.localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

function saveGame() {
  const p = state.player;
  if (!p) return;
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      serializeSave({
        cash: state.cash,
        missionIndex: state.missions.index,
        missionStep: state.missions.step,
        x: p.x,
        y: p.y,
        inCar: false,
      }),
    );
    state.hasSave = true;
  } catch {
    // Storage unavailable: the run simply lasts this visit.
  }
}

function continueGame() {
  const save = loadSave();
  resetWorld();
  if (save) {
    state.cash = save.cash;
    state.missions = { index: Math.min(save.missionIndex, MISSIONS.length), step: save.missionStep, count: 0, done: save.missionIndex >= MISSIONS.length };
    state.player.x = clamp(save.x, 30, WORLD.width - 30);
    state.player.y = clamp(save.y, 30, 2000);
  }
  state.screen = 'play';
  say('WELCOME BACK', 'Your progress in Solara Bay is loaded.', 3, '#ffd166');
}

// ------------------------------------------------------------ missions

function missionEvent(event) {
  const res = notifyMission(state.missions, event);
  if (res.missionComplete) {
    state.cash += res.reward;
    audio.play('jingle');
    const done = MISSIONS[state.missions.index - 1];
    if (res.chainComplete) {
      say('STORY COMPLETE', `Rio is out of debt. Final cash $${state.cash.toLocaleString('en-US')} — free roam is yours.`, 6, '#7be382');
    } else {
      say('MISSION COMPLETE', `${done.title} — +$${res.reward}`, 4, '#7be382');
    }
    saveGame();
  }
  return res;
}

function currentMarker() {
  const step = currentObjective(state.missions);
  if (!step) return null;
  if (step.at) {
    const lm = city.landmarks[step.at];
    return { x: lm.x, y: lm.y, label: lm.label };
  }
  if (step.event === 'destroy') {
    const car = state.cars.find((c) => c.tag === step.tag);
    if (car) return { x: car.x, y: car.y, label: 'Crew car' };
  }
  if (step.event === 'defeat') {
    const guard = state.peds.find((p) => p.guard && p.tag === step.tag && !p.dead);
    if (guard) return { x: guard.x, y: guard.y, label: 'Coral Kings' };
  }
  if (step.event === 'collect' && state.caseItem) {
    return { x: state.caseItem.x, y: state.caseItem.y, label: 'Evidence case' };
  }
  if (step.event === 'steal') {
    let best = null;
    let bestD = Infinity;
    for (const car of state.cars) {
      if (car.wrecked || car.kind === 'police') continue;
      const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) return { x: best.x, y: best.y, label: 'Any car' };
  }
  return null;
}

/** Spawn the actors a step needs (guards, crew cars, the evidence case). */
function prepareStep() {
  const step = currentObjective(state.missions);
  const mission = currentMission(state.missions);
  if (!mission || !step) return;
  const key = `${mission.id}:${state.missions.step}`;
  if (step.event === 'defeat' && state.guardsForStep !== key) {
    state.guardsForStep = key;
    const where = step.tag === 'marketGuard' ? 'market' : 'estate';
    spawnGuards(step.tag, where, step.count ?? 2);
  }
  if (mission.id === 'heat-wave') spawnCrewCars();
  if (step.event === 'collect' && !state.caseItem) {
    const lm = city.landmarks.estate;
    state.caseItem = { x: lm.x + 18, y: lm.y - 14, taken: false };
  }
}

// ------------------------------------------------------------ crime + combat

function witnessNear(x, y, range) {
  for (const ped of state.peds) {
    if (!ped.dead && Math.hypot(ped.x - x, ped.y - y) < range) return true;
  }
  for (const car of state.cars) {
    if (car.kind === 'police' && Math.hypot(car.x - x, car.y - y) < range + 80) return true;
  }
  return false;
}

function commitCrime(kind, x, y) {
  if (state.crimeCooldown > 0 && (kind === 'hitCar' || kind === 'shot')) return;
  addCrime(state.wanted, kind);
  if (kind === 'hitCar' || kind === 'shot') state.crimeCooldown = 0.8;
}

function fireBulletFrom(shooter, angle, from) {
  spawnBullet(state.bullets, shooter.x + Math.cos(angle) * 16, shooter.y + Math.sin(angle) * 16, angle, from);
}

function playerShoot(angle) {
  if (state.fireCooldown > 0) return;
  state.fireCooldown = 0.24;
  fireBulletFrom(state.player, angle, 'player');
  audio.play('gunshot');
  spawnParticles(state.particles, rng, state.player.x + Math.cos(angle) * 20, state.player.y + Math.sin(angle) * 20, 'spark', 3);
  if (witnessNear(state.player.x, state.player.y, 280)) commitCrime('shot', state.player.x, state.player.y);
  // Nearby civilians panic.
  for (const ped of state.peds) {
    if (!ped.dead && Math.hypot(ped.x - state.player.x, ped.y - state.player.y) < 190) {
      ped.fleeTime = 2.2;
      ped.fleeFrom = { x: state.player.x, y: state.player.y };
    }
  }
}

function hurtPed(ped, damage, byPlayer) {
  if (ped.dead) return;
  ped.health -= damage;
  spawnParticles(state.particles, rng, ped.x, ped.y, 'blood', 5);
  audio.play('hit');
  if (ped.health <= 0) {
    ped.dead = true;
    ped.health = 0;
    if (byPlayer) {
      commitCrime('killPed', ped.x, ped.y);
      if (ped.guard && ped.tag) missionEvent({ type: 'defeat', tag: ped.tag });
    }
  }
}

function hurtPlayer(damage) {
  const p = state.player;
  if (p.inCar) {
    p.inCar.health -= damage * 1.4;
    if (p.inCar.health <= 0 && !p.inCar.wrecked) {
      p.inCar.wrecked = true;
      p.inCar.maxSpeed = 0;
      say('CAR WRECKED', 'Get out and find another ride. (E)', 3, '#e63946');
      spawnParticles(state.particles, rng, p.inCar.x, p.inCar.y, 'smoke', 16);
    }
    return;
  }
  p.health -= damage;
  if (p.health <= 0) {
    p.health = 0;
    state.screen = 'wasted';
    audio.play('busted');
  }
}

// ------------------------------------------------------------ interaction

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function toggleCar() {
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    car.driver = car.kind === 'traffic' ? null : car.driver;
    if (car.kind === 'traffic') car.kind = 'parked';
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
    audio.play('door');
    audio.setEngine(false);
    return;
  }
  const car = nearestCar(46);
  if (!car || car.wrecked) return;
  p.inCar = car;
  car.driver = 'player';
  audio.play('door');
  if (!car.hotwired) {
    car.hotwired = true;
    if (car.kind !== 'police') {
      commitCrime('theft', car.x, car.y);
      missionEvent({ type: 'steal' });
      say('CAR STOLEN', 'The owner will not be pleased.', 2.2, '#ffd166');
    }
  }
}

// ------------------------------------------------------------ simulation

function stepPlay(dt, input) {
  const p = state.player;
  state.time += dt;
  if (state.crimeCooldown > 0) state.crimeCooldown -= dt;
  if (state.fireCooldown > 0) state.fireCooldown -= dt;
  prepareStep();

  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    state.screen = 'paused';
    saveGame();
    return;
  }

  // --- the player, on foot or driving
  const prevX = p.x;
  const prevY = p.y;
  if (p.inCar) {
    const car = p.inCar;
    const drive = input.drive();
    const before = { x: car.x, y: car.y, speed: car.speed };
    // stepCar is in physics via entities' import chain; call through a local wrapper.
    stepPlayerCar(car, drive, dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speedNow = Math.abs(car.speed);
    if (Math.abs(car.speed) > 170 && Math.abs(drive.steer) > 0) {
      state.skids.push({ x: car.x - Math.cos(car.angle) * 12, y: car.y - Math.sin(car.angle) * 12 });
      if (state.skids.length > 420) state.skids.splice(0, state.skids.length - 420);
    }
    if (circleHitsRects(car.x, car.y, car.r - 2, city.buildings)) {
      car.x = before.x;
      car.y = before.y;
      if (Math.abs(car.speed) > 90) {
        audio.play('crash');
        state.shake = Math.min(9, Math.abs(car.speed) / 40);
        car.health -= 7;
        spawnParticles(state.particles, rng, car.x, car.y, 'spark', 8);
      }
      car.speed = 0;
    }
    audio.setEngine(true, clamp(Math.abs(car.speed) / car.maxSpeed, 0, 1));
  } else {
    const axis = input.axis();
    const speed = input.sprinting() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(axis.x, axis.y) || 1;
    p.x += (axis.x / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
    p.y += (axis.y / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
    p.speedNow = axis.x || axis.y ? speed : 0;
    // Aim with the mouse; face movement when the mouse is idle centre.
    const wx = input.mouse.x + state.cam.x;
    const wy = input.mouse.y + state.cam.y;
    if (input.firing() || Math.hypot(wx - p.x, wy - p.y) > 26) {
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    } else if (axis.x || axis.y) {
      p.angle = Math.atan2(axis.y, axis.x);
    }
    p.x = clamp(p.x, 14, WORLD.width - 14);
    p.y = clamp(p.y, 14, city.beach.waterY - 12);
    if (circleHitsRects(p.x, p.y, p.r, city.buildings)) {
      p.x = prevX;
      p.y = prevY;
    }
    audio.setEngine(false);
  }

  if (actions & ACTION_INTERACT) toggleCar();

  // --- shooting
  if (!p.inCar && input.firing()) playerShoot(p.angle);

  // --- traffic, parked life, police
  for (const car of state.cars) {
    if (car.kind === 'traffic' && car.driver === 'ai') updateTrafficCar(city, rng, car, state.cars, dt);
    else if (car.kind === 'police' && car.driver !== 'player') updatePoliceCar(car, playerPos(), state.cars, dt);
  }
  resolveCarCollisions(dt);
  spawnTraffic();

  // Police numbers follow the stars; extra units peel off when it cools.
  const stars = starsFor(state.wanted);
  const target = policeTarget(state.wanted);
  const police = state.cars.filter((c) => c.kind === 'police');
  if (police.length < target) spawnPolice(city, rng, state.cars, playerPos());
  else if (police.length > target) {
    const extra = police.sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y))[0];
    if (extra && Math.hypot(extra.x - p.x, extra.y - p.y) > 560) {
      state.cars.splice(state.cars.indexOf(extra), 1);
    }
  }
  audio.setSiren(stars > 0 && police.length > 0);

  // Wanted decay needs line of sight: any police within 330 with a clear run.
  const seen = police.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 330);
  const heatBefore = state.wanted.heat;
  updateWanted(state.wanted, dt, seen);
  const step = currentObjective(state.missions);
  if (step && step.event === 'heatZero' && heatBefore > 0 && starsFor(state.wanted) === 0) {
    missionEvent({ type: 'heatZero' });
  }

  // --- pedestrians
  const pedEvents = [];
  for (const ped of state.peds) {
    let threat = null;
    if (ped.guard) {
      if (!ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 300) threat = { x: p.x, y: p.y };
    } else if (!p.inCar && input.firing()) {
      threat = { x: p.x, y: p.y };
    }
    updatePed(rng, ped, dt, threat, pedEvents);
  }
  for (const ev of pedEvents) {
    if (ev.type === 'guardShot' && !state.player.inCar) {
      const a = Math.atan2(p.y - ev.ped.y, p.x - ev.ped.x) + (rng() - 0.5) * 0.16;
      fireBulletFrom(ev.ped, a, 'guard');
      audio.play('gunshot');
    } else if (ev.type === 'guardShot') {
      const car = state.player.inCar;
      const a = Math.atan2(car.y - ev.ped.y, car.x - ev.ped.x) + (rng() - 0.5) * 0.16;
      fireBulletFrom(ev.ped, a, 'guard');
      audio.play('gunshot');
    }
  }
  spawnPeds();

  // Cars running pedestrians down.
  for (const car of state.cars) {
    if (Math.abs(car.speed) < 55) continue;
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < car.r + ped.r) {
        const byPlayer = car === state.player.inCar;
        hurtPed(ped, Math.abs(car.speed) > 150 ? 40 : 18, byPlayer);
        if (byPlayer) commitCrime('hitPed', ped.x, ped.y);
        if (car.kind === 'traffic') car.speed *= 0.4;
      }
    }
    // A car ploughing into the player on foot.
    if (!p.inCar && car !== p.inCar && Math.abs(car.speed) > 60 && Math.hypot(p.x - car.x, p.y - car.y) < car.r + p.r) {
      hurtPlayer(Math.abs(car.speed) / 14);
      state.shake = 6;
    }
  }

  // --- bullets
  const targets = [];
  for (const ped of state.peds) if (!ped.dead) targets.push({ x: ped.x, y: ped.y, r: ped.r + 2, ref: ped, kind: 'ped' });
  for (const car of state.cars) targets.push({ x: car.x, y: car.y, r: car.r, ref: car, kind: 'car' });
  if (!p.inCar) targets.push({ x: p.x, y: p.y, r: p.r + 2, ref: p, kind: 'player' });
  const hits = stepBullets(state.bullets, dt, targets);
  for (const hit of hits) {
    const t = hit.target;
    if (hit.bullet.from === 'player') {
      if (t.kind === 'ped') hurtPed(t.ref, 17, true);
      else if (t.kind === 'car') {
        t.ref.health -= 11;
        spawnParticles(state.particles, rng, t.ref.x, t.ref.y, 'spark', 4);
        if (t.ref.kind === 'crew' && t.ref.health <= 0 && !t.ref.wrecked) wreckCrewCar(t.ref);
      }
    } else if (hit.bullet.from === 'guard') {
      if (t.kind === 'player') hurtPlayer(6);
      else if (t.kind === 'car' && t.ref === p.inCar) hurtPlayer(3);
    }
  }

  // --- mission arrivals and pickups
  const obj = currentObjective(state.missions);
  if (obj && obj.at) {
    const lm = city.landmarks[obj.at];
    if (Math.hypot(p.x - lm.x, p.y - lm.y) < 82) missionEvent({ type: 'arrive', at: obj.at });
  }
  if (obj && obj.event === 'collect' && state.caseItem && !state.caseItem.taken) {
    if (Math.hypot(p.x - state.caseItem.x, p.y - state.caseItem.y) < 30) {
      state.caseItem.taken = true;
      audio.play('pickup');
      missionEvent({ type: 'collect', tag: 'evidence' });
    }
  }

  // --- busted meter
  const nearPolice = police.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < (p.inCar ? 44 : 40));
  const slowOrStill = p.inCar ? Math.abs(p.inCar.speed) < 14 : p.speedNow < 20;
  if (stars > 0 && nearPolice && slowOrStill) state.bustMeter += dt;
  else state.bustMeter = Math.max(0, state.bustMeter - dt * 1.6);
  if (state.bustMeter > 1.6) {
    state.screen = 'busted';
    audio.play('busted');
    audio.setSiren(false);
    audio.setEngine(false);
  }

  stepParticles(state.particles, dt);

  // --- camera follows with a little look-ahead and impact shake
  const focus = playerPos();
  const lookX = focus.x + (focus === p.inCar ? Math.cos(focus.angle) * focus.speed * 0.34 : 0);
  const lookY = focus.y + (focus === p.inCar ? Math.sin(focus.angle) * focus.speed * 0.34 : 0);
  state.cam.x = clamp(lookX - canvas.width / 2, 0, Math.max(0, WORLD.width - canvas.width));
  state.cam.y = clamp(lookY - canvas.height / 2, 0, Math.max(0, WORLD.height - canvas.height));
  state.shake = Math.max(0, state.shake - dt * 16);

  // Periodic save.
  state.saveTimer += dt;
  if (state.saveTimer > 10) {
    state.saveTimer = 0;
    saveGame();
  }
}

function wreckCrewCar(car) {
  car.wrecked = true;
  car.health = 0;
  car.maxSpeed = 0;
  spawnParticles(state.particles, rng, car.x, car.y, 'smoke', 18);
  audio.play('crash');
  commitCrime('sabotage', car.x, car.y);
  missionEvent({ type: 'destroy', tag: car.tag });
}

/** Car-car contact: separation plus damage, crash sound and crime for the player. */
function resolveCarCollisions() {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      if (dx * dx + dy * dy >= min * min) continue;
      const impact = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
      // Separate along the centre line.
      const dist = Math.hypot(dx, dy) || 1;
      const push = (min - dist) / 2;
      const ux = dx / dist;
      const uy = dy / dist;
      if (a.driver !== 'player') {
        a.x -= ux * push;
        a.y -= uy * push;
      }
      if (b.driver !== 'player') {
        b.x += ux * push;
        b.y += uy * push;
      }
      if (a.driver === 'player' || b.driver === 'player') {
        const other = a.driver === 'player' ? b : a;
        const mine = a.driver === 'player' ? a : b;
        if (impact > 60) {
          audio.play('crash');
          state.shake = Math.min(8, impact / 45);
          mine.health -= impact / 26;
          other.health -= impact / 30;
          spawnParticles(state.particles, rng, (a.x + b.x) / 2, (a.y + b.y) / 2, 'spark', 7);
          commitCrime('hitCar', other.x, other.y);
          if (other.kind === 'crew' && other.health <= 0 && !other.wrecked) wreckCrewCar(other);
          a.speed *= 0.55;
          b.speed *= 0.55;
        }
      } else if (impact > 200) {
        a.health -= 3;
        b.health -= 3;
      }
      if (a.health <= 0 && !a.wrecked && a.kind !== 'crew') {
        a.wrecked = true;
        a.maxSpeed = 0;
      }
      if (b.health <= 0 && !b.wrecked && b.kind !== 'crew') {
        b.wrecked = true;
        b.maxSpeed = 0;
      }
    }
  }
}

// Physics for the player's own car, with the world-edge clamp applied.
function stepPlayerCar(car, drive, dt) {
  stepCar(car, drive, dt);
  car.x = clamp(car.x, 24, WORLD.width - 24);
  car.y = clamp(car.y, 24, 2050);
}

// ------------------------------------------------------------ screens + loop

function respawnAfterEnd() {
  const wasBusted = state.screen === 'busted';
  state.wanted = createWanted();
  state.bustMeter = 0;
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  const fine = wasBusted ? Math.min(120, state.cash) : Math.min(80, state.cash);
  state.cash -= fine;
  state.player.health = PLAYER.maxHealth;
  state.player.inCar = null;
  const lm = city.landmarks.marina;
  state.player.x = lm.x - 30;
  state.player.y = lm.y + 44;
  state.screen = 'play';
  say(wasBusted ? 'RELEASED' : 'PATCHED UP', `Fine and fees: $${fine}. Stay out of trouble.`, 3.5, '#ffd166');
  saveGame();
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  const shakeX = state.shake ? (rng() - 0.5) * state.shake : 0;
  const shakeY = state.shake ? (rng() - 0.5) * state.shake : 0;
  const view = { camX: state.cam.x + shakeX, camY: state.cam.y + shakeY, w, h, time: state.time };
  const marker = state.screen === 'play' || state.screen === 'paused' ? currentMarker() : null;
  drawWorld(ctx, {
    city,
    view,
    cars: state.cars,
    peds: state.peds,
    player: state.player,
    bullets: state.bullets,
    particles: state.particles,
    skids: state.skids,
    marker,
    caseItem: state.caseItem,
  });
  if (state.screen === 'title') {
    drawTitle(ctx, state, w, h);
    return;
  }
  const obj = currentObjective(state.missions);
  const mission = currentMission(state.missions);
  drawHud(
    ctx,
    {
      player: state.player,
      cash: state.cash,
      stars: starsFor(state.wanted),
      objective: obj ? obj.text : state.missions.done ? 'Free roam — the bay is yours.' : '',
      missionTitle: mission ? mission.title : '',
      district: districtAt(city, state.player.x, state.player.y)?.name ?? '',
      message: state.message,
      time: state.time,
      weapon: {
        name: state.player.inCar ? '— DRIVING —' : 'PISTOL',
        ready: state.fireCooldown <= 0,
        hint: state.player.inCar ? 'E — exit car' : 'E — enter car · Click/F — fire',
      },
    },
    w,
    h,
  );
  drawMinimap(mmCtx, { city, cars: state.cars, player: state.player, marker });
  if (state.bustMeter > 0.15 && state.screen === 'play') {
    ctx.fillStyle = 'rgba(230,57,70,0.85)';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE POLICE ARE GRABBING YOU — MOVE!', w / 2, h * 0.2);
  }
  if (state.screen === 'paused') drawOverlay(ctx, w, h, 'PAUSED', 'P or Esc to keep playing. Progress is saved.', '#ffd166');
  if (state.screen === 'busted') drawOverlay(ctx, w, h, 'BUSTED', 'Press Enter — pay the fine and walk from the marina.', '#e63946');
  if (state.screen === 'wasted') drawOverlay(ctx, w, h, 'WASTED', 'Press Enter — wake up at the marina, lighter in the wallet.', '#e63946');
}

let input = null;
let last = 0;
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now;
  accumulator += Math.min((now - last) / 1000, 0.25);
  last = now;
  if (state.screen === 'play') {
    while (accumulator >= STEP) {
      stepPlay(STEP, input);
      accumulator -= STEP;
      if (state.screen !== 'play') {
        accumulator = 0;
        break;
      }
    }
  } else {
    accumulator = 0;
    const actions = input.takeActions();
    if (state.screen === 'title') {
      state.time += 1 / 60;
      // The city idles behind the title.
      for (const car of state.cars) {
        if (car.kind === 'traffic' && car.driver === 'ai') updateTrafficCar(city, rng, car, state.cars, STEP);
      }
      state.cam.x = clamp(city.landmarks.market.x - canvas.width / 2 + Math.sin(state.time * 0.07) * 260, 0, WORLD.width - canvas.width);
      state.cam.y = clamp(city.landmarks.market.y - canvas.height / 2, 0, WORLD.height - canvas.height);
    } else if ((state.screen === 'busted' || state.screen === 'wasted') && actions & ACTION_CONFIRM) {
      respawnAfterEnd();
    } else if (state.screen === 'paused' && actions & ACTION_PAUSE) {
      state.screen = 'play';
    }
  }
  draw();
}

function handleClick(ev) {
  audio.resume();
  if (state.screen !== 'title') return;
  const rect = canvas.getBoundingClientRect();
  const mx = ((ev.clientX - rect.left) / rect.width) * canvas.width;
  const my = ((ev.clientY - rect.top) / rect.height) * canvas.height;
  for (const b of titleButtons(canvas.width, canvas.height, state.hasSave)) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      audio.play('click');
      if (b.id === 'new') newGame();
      else continueGame();
    }
  }
}

// ------------------------------------------------------------ shot staging

function stageScene(name) {
  resetWorld();
  state.missions = createMissionState();
  const p = state.player;
  if (name === 'drive') {
    const car = createCar(rng, city.landmarks.market.x, city.roads.horizontals[2], 'traffic', 'sport');
    car.angle = 0;
    car.driver = 'player';
    car.hotwired = true;
    state.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    // Stage nearby traffic on the same boulevard so the frame is alive.
    const traffic = state.cars.filter((c) => c.kind === 'traffic' && c.driver === 'ai');
    if (traffic[0]) {
      traffic[0].x = car.x + 250;
      traffic[0].y = city.roads.horizontals[2] - 19;
      traffic[0].angle = Math.PI;
      traffic[0].roadAxis = 'h';
      traffic[0].roadIndex = 2;
      traffic[0].dir = -1;
    }
    if (traffic[1]) {
      traffic[1].x = car.x - 290;
      traffic[1].y = city.roads.horizontals[2] + 19;
      traffic[1].angle = 0;
      traffic[1].roadAxis = 'h';
      traffic[1].roadIndex = 2;
      traffic[1].dir = 1;
    }
    for (let i = 0; i < 150; i += 1) {
      stepCar(car, { throttle: 0.9, steer: i > 110 ? 0.12 : 0 }, STEP);
      for (const c of state.cars) if (c.kind === 'traffic' && c.driver === 'ai') updateTrafficCar(city, rng, c, state.cars, STEP);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
    }
    state.time = 4;
  } else if (name === 'foot') {
    state.missions = { index: 1, step: 0, count: 0, done: false };
    p.x = city.landmarks.market.x - 60;
    p.y = city.landmarks.market.y + 30;
    p.angle = 0.4;
    prepareStep();
    state.time = 4;
  } else if (name === 'chase') {
    const car = createCar(rng, city.landmarks.marina.roadX, city.landmarks.marina.roadY, 'traffic', 'sport');
    car.angle = 0;
    car.driver = 'player';
    car.hotwired = true;
    state.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    addCrime(state.wanted, 'killPed');
    addCrime(state.wanted, 'hitPed');
    for (let i = 0; i < 3; i += 1) spawnPolice(city, rng, state.cars, p);
    // Pull the patrol cars in close behind the player so the chase reads.
    const patrol = state.cars.filter((c) => c.kind === 'police');
    patrol.forEach((cop, i) => {
      cop.x = car.x - 170 - i * 90;
      cop.y = car.y + (i - 1) * 44;
      cop.angle = 0;
    });
    for (let i = 0; i < 130; i += 1) {
      stepCar(car, { throttle: 1, steer: Math.sin(i / 22) * 0.24 }, STEP);
      for (const c of state.cars) {
        if (c.kind === 'police') updatePoliceCar(c, p, state.cars, STEP);
        else if (c.kind === 'traffic' && c.driver === 'ai') updateTrafficCar(city, rng, c, state.cars, STEP);
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
    }
    say('THE POLICE ARE ON YOU', 'Lose them: break line of sight.', 99, '#e63946');
    state.time = 4;
  }
  state.cam.x = clamp(p.x - canvas.width / 2, 0, Math.max(0, WORLD.width - canvas.width));
  state.cam.y = clamp(p.y - canvas.height / 2, 0, Math.max(0, WORLD.height - canvas.height));
  state.screen = 'play';
  let painted = 0;
  const paint = () => {
    draw();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
}

// ------------------------------------------------------------ boot

state.hasSave = Boolean(loadSave());
resetWorld();
if (scene) {
  stageScene(scene);
} else {
  input = createInput(canvas);
  canvas.addEventListener('mousedown', handleClick);
  window.addEventListener('keydown', () => audio.resume(), { once: true });
  status.textContent = 'Solara Bay. Choose New Game or Continue.';
  requestAnimationFrame(frame);
}
