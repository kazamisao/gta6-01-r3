// Gunfire: bullets are short-lived points with a direction and an owner.
// The player fires toward the mouse; mission guards fire back at the player.
// Stepping the bullets reports hits against circles (peds, cars, the player)
// so main.js can apply damage, crime and sound in one place.

export const BULLET_SPEED = 760;
export const BULLET_LIFE = 0.55;

/** An empty bullet set. */
export function createBullets() {
  return [];
}

/** Add one bullet fired from (x, y) toward `angle`. `from` is 'player' or 'guard'. */
export function spawnBullet(bullets, x, y, angle, from) {
  bullets.push({
    x,
    y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: BULLET_LIFE,
    from,
    r: 3,
  });
}

/**
 * Advance every bullet one step, removing spent ones. `targets` is a list of
 * circles {x, y, r, ref, kind}. Returns the hits as {target, bullet} pairs.
 */
export function stepBullets(bullets, dt, targets) {
  const hits = [];
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let spent = b.life <= 0;
    if (!spent) {
      for (const t of targets) {
        const dx = b.x - t.x;
        const dy = b.y - t.y;
        const rr = t.r + b.r;
        if (dx * dx + dy * dy < rr * rr) {
          hits.push({ target: t, bullet: b });
          spent = true;
          break;
        }
      }
    }
    if (spent) bullets.splice(i, 1);
  }
  return hits;
}
