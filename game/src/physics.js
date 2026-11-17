// Small pure movement and collision helpers shared by the player, traffic,
// police and the tests: car stepping (acceleration, braking, a reverse gear
// that engages cleanly from a stop), circle overlap and separation so two
// vehicles can never stick together overlapped.

/** Advance a car one step. Mutates and returns the car. */
export function stepCar(car, input, dt) {
  const throttle = Math.max(-1, Math.min(1, input.throttle));
  const steer = Math.max(-1, Math.min(1, input.steer));
  if (throttle > 0) {
    car.speed += car.accel * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 4) {
      // Still rolling forward: the pedal is a brake, never an instant reverse.
      car.speed -= car.accel * 1.6 * dt;
      if (car.speed < 0) car.speed = 0;
    } else {
      // Stopped (or already reversing): the reverse gear engages.
      car.speed += car.accel * 0.62 * throttle * dt;
    }
  }
  // Rolling drag and the caps.
  car.speed -= car.speed * 0.55 * dt;
  if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
  if (car.speed < -car.maxReverse) car.speed = -car.maxReverse;
  // Steering bites in proportion to speed, and flips in reverse like a real car.
  const speedRatio = Math.max(-1, Math.min(1, car.speed / 120));
  car.angle += steer * speedRatio * 2.35 * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return car;
}

/** True when two circles touch or overlap. */
export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

/**
 * Push two overlapping circles apart along the line between their centres,
 * half the overlap each, so neither ends the step inside the other. Mutates
 * both. Returns true when they were overlapping.
 */
export function separateCircles(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (dist >= min) return false;
  if (dist < 0.001) {
    a.x -= min / 2;
    b.x += min / 2;
    return true;
  }
  const push = (min - dist) / 2;
  const ux = dx / dist;
  const uy = dy / dist;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  return true;
}

/** True when a point lies inside an axis-aligned rectangle. */
export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** Does a circle at (x, y) with radius r touch any rectangle in the list? */
export function circleHitsRects(x, y, r, rects) {
  for (const rect of rects) {
    const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/** The shortest signed turn from one angle to another, in (-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Clamp a value into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
