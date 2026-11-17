// The living city: cars (traffic, parked, police, crew) and pedestrians, and
// the simple drivers and walkers that move them. Traffic follows the road
// grid on the right-hand side, turning at intersections; police steer at the
// player and ram; pedestrians stroll the sidewalks and flee from danger.
// Movement goes through physics.stepCar so every vehicle shares one feel.
import { WORLD } from './config.js';
import { angleDelta, clamp, separateCircles, stepCar } from './physics.js';
import { isOnRoad, nearestRoadPoint } from './city.js';
import { rngInt, rngPick, rngRange } from './rng.js';

export const CAR_PAINTS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a', '#9b5de5', '#f1fa8c', '#edf2f4', '#6c757d', '#00b4d8'];
const LANE = 19; // lane offset from a road centreline, right-hand traffic

const CAR_TYPES = {
  sedan: { maxSpeed: 252, maxReverse: 84, accel: 238, w: 36, h: 18, r: 17 },
  sport: { maxSpeed: 336, maxReverse: 96, accel: 318, w: 37, h: 18, r: 17 },
  van: { maxSpeed: 216, maxReverse: 76, accel: 205, w: 42, h: 21, r: 19 },
  police: { maxSpeed: 288, maxReverse: 92, accel: 296, w: 37, h: 18, r: 17 },
};

/** A car object. `kind` is traffic, parked, police or crew. */
export function createCar(rng, x, y, kind, typeName) {
  const type = CAR_TYPES[typeName ?? (kind === 'police' ? 'police' : rngPick(rng, ['sedan', 'sedan', 'sport', 'van']))];
  return {
    x,
    y,
    angle: 0,
    speed: 0,
    ...type,
    r: type.r,
    w: type.w,
    h: type.h,
    kind,
    typeName: typeName ?? 'sedan',
    color: kind === 'police' ? '#1d3557' : rngPick(rng, CAR_PAINTS),
    health: kind === 'crew' ? 60 : 100,
    wrecked: false,
    driver: kind === 'traffic' ? 'ai' : null,
    cruise: rngRange(rng, 104, 148),
    roadAxis: 'v',
    roadIndex: 0,
    dir: 1,
    stuckTime: 0,
    reverseTime: 0,
    tag: null,
  };
}

/** Snap a fresh traffic car onto a road with a heading along it. */
export function placeOnRoad(city, rng, car) {
  const vertical = rng() < 0.5;
  if (vertical) {
    car.roadAxis = 'v';
    car.roadIndex = rngInt(rng, 0, city.roads.verticals.length - 1);
    car.dir = rng() < 0.5 ? 1 : -1;
    car.x = city.roads.verticals[car.roadIndex];
    car.y = rngRange(rng, 60, city.height - 320);
  } else {
    car.roadAxis = 'h';
    car.roadIndex = rngInt(rng, 0, city.roads.horizontals.length - 1);
    car.dir = rng() < 0.5 ? 1 : -1;
    car.x = rngRange(rng, 60, city.width - 60);
    car.y = city.roads.horizontals[car.roadIndex];
  }
  car.angle = car.roadAxis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.dir > 0 ? 0 : Math.PI;
  applyLaneOffset(car);
  return car;
}

/** Shift a car sideways into its right-hand lane for its current heading. */
export function applyLaneOffset(car) {
  const rx = -Math.sin(car.angle);
  const ry = Math.cos(car.angle);
  car.x += rx * LANE;
  car.y += ry * LANE;
}

/** The point a road-following driver aims at: ahead on its lane. */
function laneTarget(city, car) {
  const ahead = 130;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let tx = car.x + fx * ahead;
  let ty = car.y + fy * ahead;
  // Pull the target back onto the car's road centreline plus its lane.
  if (car.roadAxis === 'v') tx = city.roads.verticals[car.roadIndex] + -Math.sin(car.angle) * LANE;
  else ty = city.roads.horizontals[car.roadIndex] + Math.cos(car.angle) * LANE;
  return { x: tx, y: ty };
}

/** At an intersection, maybe turn: returns true when the car turned. */
function maybeTurn(city, rng, car) {
  // Find the cross road the car is crossing right now, if any.
  const cross = car.roadAxis === 'v' ? city.roads.horizontals : city.roads.verticals;
  const pos = car.roadAxis === 'v' ? car.y : car.x;
  for (let i = 0; i < cross.length; i += 1) {
    if (Math.abs(pos - cross[i]) > 10) continue;
    if (rng() < 0.45) return false; // mostly, drive straight through
    const turnDir = rng() < 0.5 ? 1 : -1;
    car.roadAxis = car.roadAxis === 'v' ? 'h' : 'v';
    car.roadIndex = i;
    car.dir = turnDir;
    car.angle = car.roadAxis === 'v' ? (turnDir > 0 ? Math.PI / 2 : -Math.PI / 2) : turnDir > 0 ? 0 : Math.PI;
    // Re-centre on the new road, keeping the cross position.
    if (car.roadAxis === 'v') car.x = city.roads.verticals[car.roadIndex];
    else car.y = city.roads.horizontals[car.roadIndex];
    applyLaneOffset(car);
    return true;
  }
  return false;
}

/** Is there a car close ahead of this one? Used to brake for traffic. */
function carAhead(car, cars) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (forward > 6 && forward < 62 && side < 17) return other;
  }
  return null;
}

/** Drive one AI traffic car for a step. */
export function updateTrafficCar(city, rng, car, cars, dt) {
  if (car.wrecked || car.driver !== 'ai') return;
  maybeTurn(city, rng, car);
  const target = laneTarget(city, car);
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  const steer = clamp(angleDelta(car.angle, desired) * 2.4, -1, 1);
  let throttle = car.speed < car.cruise ? 0.75 : 0;
  if (carAhead(car, cars)) throttle = car.speed > 12 ? -0.7 : 0;
  stepCar(car, { throttle, steer }, dt);
  keepInWorld(car);
}

/** Chase driver: steer at the target, full throttle, brief reverse if stuck. */
export function updatePoliceCar(car, target, cars, dt) {
  if (car.wrecked) return;
  if (car.reverseTime > 0) {
    car.reverseTime -= dt;
    stepCar(car, { throttle: -1, steer: 0 }, dt);
    keepInWorld(car);
    return;
  }
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  const steer = clamp(angleDelta(car.angle, desired) * 2.6, -1, 1);
  let throttle = 1;
  const ahead = carAhead(car, cars);
  if (ahead && ahead.kind !== 'police') throttle = 0.4;
  stepCar(car, { throttle, steer }, dt);
  if (Math.abs(car.speed) < 6) {
    car.stuckTime += dt;
    if (car.stuckTime > 1.1) {
      car.stuckTime = 0;
      car.reverseTime = 0.55;
    }
  } else {
    car.stuckTime = 0;
  }
  keepInWorld(car);
}

/** Keep a car inside the world and off the sea. */
export function keepInWorld(car) {
  car.x = clamp(car.x, 24, WORLD.width - 24);
  car.y = clamp(car.y, 24, 2050);
  if (!isOnRoad({ roads: { verticals: [], horizontals: [] } }, car.x, car.y)) {
    // no-op: the clamp above is the real guard; roads are a soft guide only
  }
}

/** Spawn a police car on a road near (but not on top of) the player. */
export function spawnPolice(city, rng, cars, near) {
  const car = createCar(rng, 0, 0, 'police', 'police');
  for (let tries = 0; tries < 12; tries += 1) {
    const angle = rngRange(rng, 0, Math.PI * 2);
    const dist = rngRange(rng, 430, 620);
    const x = clamp(near.x + Math.cos(angle) * dist, 40, city.width - 40);
    const y = clamp(near.y + Math.sin(angle) * dist, 40, 2000);
    const road = nearestRoadPoint(city, x, y);
    car.x = road.x;
    car.y = road.y;
    if (Math.hypot(car.x - near.x, car.y - near.y) > 260) break;
  }
  car.angle = Math.atan2(near.y - car.y, near.x - car.x);
  cars.push(car);
  return car;
}

// ---------------------------------------------------------------- pedestrians

const PED_SHIRTS = ['#ff5964', '#ffe74c', '#35a7ff', '#6bf178', '#ff9f1c', '#f15bb5', '#4ecdc4', '#f7f7f7'];

/** A pedestrian: strolls a sidewalk, flees danger, can be hurt. */
export function createPed(rng, x, y) {
  return {
    x,
    y,
    angle: rngRange(rng, 0, Math.PI * 2),
    speed: 0,
    r: 9,
    health: 30,
    dead: false,
    fleeTime: 0,
    fleeFrom: null,
    wanderTime: rngRange(rng, 1, 4),
    shirt: rngPick(rng, PED_SHIRTS),
    tag: null,
    guard: false,
    shootCooldown: 0,
  };
}

/** Place a pedestrian on a sidewalk somewhere in the city. */
export function placePedOnSidewalk(city, rng, ped) {
  for (let tries = 0; tries < 20; tries += 1) {
    const x = rngRange(rng, 40, city.width - 40);
    const y = rngRange(rng, 40, 2040);
    const road = nearestRoadPoint(city, x, y);
    ped.x = road.x + (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 + 8);
    ped.y = road.y + rngRange(rng, -30, 30);
    if (Math.abs(ped.x - x) < 500) break;
  }
  return ped;
}

/**
 * Move one pedestrian. `threat` is {x, y} of something frightening nearby
 * (a gunshot, a speeding car, an aimed gun) or null. Guards (mission men)
 * instead stand their ground and shoot back: they return fire events through
 * `events` as {type:'guardShot', ped}.
 */
export function updatePed(rng, ped, dt, threat, events) {
  if (ped.dead) return;
  if (ped.shootCooldown > 0) ped.shootCooldown -= dt;
  if (threat && !ped.guard) {
    ped.fleeTime = 2.4;
    ped.fleeFrom = threat;
  }
  if (ped.fleeTime > 0 && ped.fleeFrom) {
    ped.fleeTime -= dt;
    ped.angle = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
    ped.speed = 196;
  } else if (ped.guard) {
    ped.speed = 0;
    if (threat && ped.shootCooldown <= 0) {
      ped.shootCooldown = rngRange(rng, 0.8, 1.4);
      events.push({ type: 'guardShot', ped });
    }
  } else {
    ped.wanderTime -= dt;
    if (ped.wanderTime <= 0) {
      ped.wanderTime = rngRange(rng, 1.5, 4.5);
      ped.angle += rngRange(rng, -1.2, 1.2);
    }
    ped.speed = 62;
  }
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  ped.x = clamp(ped.x, 14, WORLD.width - 14);
  ped.y = clamp(ped.y, 14, 2060);
}

/** Resolve car-vs-car and car-vs-ped overlaps for the whole set. */
export function separateVehicles(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked && b.wrecked) continue;
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      if (separateCircles(a, b)) {
        const impact = Math.abs(a.speed) + Math.abs(b.speed);
        if (before < a.r + b.r - 2 && impact > 130) {
          a.health -= 5;
          b.health -= 5;
        }
      }
    }
  }
}
