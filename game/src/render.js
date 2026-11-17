// Drawing Solara Bay: a top-down sun-soaked coastal city. Warm grass, pale
// sidewalks, dark boulevards with yellow dashes, coral and pastel rooftops
// with soft shadows, palm trees, a sandy beach and animated turquoise water
// along the south edge. Everything is culled to the camera view. Cars are
// rounded bodies with glass and headlights; police cars flash a light bar.
import { PALETTE, WORLD } from './config.js';

/** A fresh particle list (sparks, dust, smoke, muzzle smoke). */
export function createParticles() {
  return [];
}

/** Burst particles at a point. `kind` picks the colour family. */
export function spawnParticles(particles, rng, x, y, kind, count = 8) {
  const colors = {
    spark: ['#ffd166', '#ff9f1c', '#fff3b0'],
    smoke: ['#9aa0a6', '#6c757d', '#495057'],
    dust: ['#e6d3a3', '#d9c08a', '#cbb37e'],
    blood: ['#c1121f', '#780000'],
    splash: ['#90e0ef', '#caf0f8', '#ffffff'],
  }[kind] ?? ['#ffffff'];
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const speed = 30 + rng() * 130;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + rng() * 0.5,
      maxLife: 0.85,
      size: 1.5 + rng() * 3,
      color: colors[Math.floor(rng() * colors.length)],
    });
  }
}

/** Advance and fade particles. */
export function stepParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function inView(x, y, view, pad = 90) {
  return x > view.camX - pad && x < view.camX + view.w + pad && y > view.camY - pad && y < view.camY + view.h + pad;
}

function drawGround(ctx, city, view) {
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, view.w, view.h);
  // District tints, very subtle, so neighbourhoods read as places.
  const tints = ['rgba(255,255,255,0.05)', 'rgba(255,214,165,0.10)', 'rgba(255,255,255,0.02)', 'rgba(255,183,197,0.07)', 'rgba(255,255,255,0.04)', 'rgba(255,214,165,0.05)'];
  city.districts.forEach((d, i) => {
    ctx.fillStyle = tints[i % tints.length];
    ctx.fillRect(d.x - view.camX, d.y - view.camY, d.w, d.h);
  });
  // Beach sand and the sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, city.beach.sandY - view.camY, view.w, city.beach.waterY - city.beach.sandY);
  const waterTop = city.beach.waterY - view.camY;
  const grad = ctx.createLinearGradient(0, waterTop, 0, view.h);
  grad.addColorStop(0, PALETTE.water);
  grad.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, waterTop, view.w, view.h - waterTop);
  // Animated wave sparkle.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -40; x < view.w + 40; x += 46) {
    const wx = x + ((view.time * 26) % 46);
    const wy = waterTop + 14 + Math.sin((x + view.time * 60) * 0.05) * 4;
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + 22, wy);
  }
  ctx.stroke();
  // Foam line where the sea meets the sand.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  for (let x = 0; x <= view.w; x += 24) {
    const wy = waterTop + Math.sin(x * 0.04 + view.time * 2.2) * 3;
    if (x === 0) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.stroke();
}

function drawRoads(ctx, city, view) {
  const half = WORLD.roadWidth / 2;
  const walk = WORLD.sidewalk;
  ctx.fillStyle = PALETTE.sidewalk;
  for (const vx of city.roads.verticals) {
    ctx.fillRect(vx - half - walk - view.camX, -view.camY, WORLD.roadWidth + walk * 2, city.beach.sandY);
  }
  for (const hy of city.roads.horizontals) {
    ctx.fillRect(-view.camX, hy - half - walk - view.camY, view.w + view.camX + WORLD.width, WORLD.roadWidth + walk * 2);
  }
  ctx.fillStyle = PALETTE.road;
  for (const vx of city.roads.verticals) {
    ctx.fillRect(vx - half - view.camX, -view.camY, WORLD.roadWidth, city.beach.sandY);
  }
  for (const hy of city.roads.horizontals) {
    ctx.fillRect(-view.camX, hy - half - view.camY, view.w + view.camX + WORLD.width, WORLD.roadWidth);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const vx of city.roads.verticals) {
    for (let y = 12; y < city.beach.sandY; y += 44) {
      ctx.fillRect(vx - 2 - view.camX, y - view.camY, 4, 24);
    }
  }
  for (const hy of city.roads.horizontals) {
    for (let x = 12; x < WORLD.width; x += 44) {
      ctx.fillRect(x - view.camX, hy - 2 - view.camY, 24, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const vx of city.roads.verticals) {
    for (const hy of city.roads.horizontals) {
      if (!inView(vx, hy, view, 70)) continue;
      for (let s = -half + 6; s < half - 6; s += 12) {
        ctx.fillRect(vx + s - view.camX, hy - half - view.camY, 6, 10);
        ctx.fillRect(vx + s - view.camX, hy + half - 10 - view.camY, 6, 10);
      }
    }
  }
}

function drawBuildings(ctx, city, view) {
  for (const b of city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, view, 200)) continue;
    const x = b.x - view.camX;
    const y = b.y - view.camY;
    // Soft shadow to the south-east: the sun is high and to the north-west.
    ctx.fillStyle = 'rgba(60,40,20,0.22)';
    ctx.fillRect(x + 9, y + 11, b.w, b.h);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(x - 3, y - 3, b.w + 6, b.h + 6);
    ctx.fillStyle = PALETTE[b.roof];
    ctx.fillRect(x, y, b.w, b.h);
    // Windows: a light grid that hints at the floors.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 24));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        ctx.fillRect(x + 8 + cx * ((b.w - 14) / cols), y + 8 + cy * ((b.h - 14) / rows), 7, 5);
      }
    }
  }
}

function drawPalms(ctx, city, view) {
  for (const p of city.palms) {
    if (!inView(p.x, p.y, view, 40)) continue;
    const x = p.x - view.camX;
    const y = p.y - view.camY;
    ctx.fillStyle = 'rgba(60,40,20,0.18)';
    ctx.beginPath();
    ctx.ellipse(x + 5, y + 6, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.quadraticCurveTo(x + 2, y - 4, x + 5, y - 12);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.palmLeaf;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 12);
      ctx.quadraticCurveTo(x + 5 + Math.cos(a) * 10, y - 12 + Math.sin(a) * 6 - 3, x + 5 + Math.cos(a) * 16, y - 12 + Math.sin(a) * 10 + 3);
      ctx.stroke();
    }
  }
}

function drawCar(ctx, car, view) {
  const x = car.x - view.camX;
  const y = car.y - view.camY;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(40,30,20,0.28)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  // Body.
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  ctx.beginPath();
  ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 5);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(-car.w / 4, -car.h / 2, car.w / 2, car.h);
    // Light bar: red and blue halves flashing with time.
    const flash = Math.floor(view.time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2b2b' : '#7a0d0d';
    ctx.fillRect(-7, -car.h / 2 + 2, 6, car.h - 4);
    ctx.fillStyle = flash ? '#123a8f' : '#2b6bff';
    ctx.fillRect(1, -car.h / 2 + 2, 6, car.h - 4);
  }
  // Cabin glass.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  ctx.beginPath();
  ctx.roundRect(-car.w / 6, -car.h / 2 + 3, car.w / 3, car.h - 6, 3);
  ctx.fill();
  // Headlights and tail lights.
  ctx.fillStyle = '#fff7ae';
  ctx.fillRect(car.w / 2 - 3, -car.h / 2 + 2, 3, 4);
  ctx.fillRect(car.w / 2 - 3, car.h / 2 - 6, 3, 4);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(-car.w / 2, -car.h / 2 + 2, 3, 4);
  ctx.fillRect(-car.w / 2, car.h / 2 - 6, 3, 4);
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(20,20,20,0.5)';
    ctx.beginPath();
    ctx.arc(car.w / 4, 0, car.h / 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped, view, isPlayer = false) {
  const x = ped.x - view.camX;
  const y = ped.y - view.camY;
  ctx.fillStyle = 'rgba(40,30,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.dead ? '#5a4a42' : isPlayer ? '#ffcf3f' : ped.shirt;
  ctx.beginPath();
  ctx.arc(x, y, ped.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c29b';
  ctx.beginPath();
  ctx.arc(x, y, ped.r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#22252a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ped.angle) * 20, y + Math.sin(ped.angle) * 20);
    ctx.stroke();
  }
}

function drawMarker(ctx, marker, view) {
  if (!marker) return;
  const x = marker.x - view.camX;
  const y = marker.y - view.camY;
  const bob = Math.sin(view.time * 3) * 5;
  // A pillar of light on the objective so it reads from across the map.
  const grad = ctx.createLinearGradient(0, y - 130, 0, y);
  grad.addColorStop(0, 'rgba(255,209,102,0)');
  grad.addColorStop(1, 'rgba(255,209,102,0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 13, y - 130, 26, 130);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(x, y, 15 + Math.sin(view.time * 3) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a4d00';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', x, y + 5 + bob * 0.2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(marker.label ?? '', x, y - 26 + bob);
}

/** Draw the whole world for one frame. */
export function drawWorld(ctx, state) {
  const view = state.view;
  ctx.save();
  ctx.translate(-0, -0);
  drawGround(ctx, state.city, view);
  drawRoads(ctx, state.city, view);
  // Skid marks under everything that moves.
  ctx.fillStyle = 'rgba(30,30,30,0.35)';
  for (const s of state.skids) {
    if (!inView(s.x, s.y, view, 20)) continue;
    ctx.fillRect(s.x - view.camX - 2, s.y - view.camY - 2, 4, 4);
  }
  drawBuildings(ctx, state.city, view);
  drawPalms(ctx, state.city, view);
  drawMarker(ctx, state.marker, view);
  // The evidence case on the pier in the finale.
  if (state.caseItem && !state.caseItem.taken) {
    const x = state.caseItem.x - view.camX;
    const y = state.caseItem.y - view.camY;
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(x - 9, y - 7, 18, 14);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - 9, y - 2, 18, 3);
  }
  for (const car of state.cars) {
    if (inView(car.x, car.y, view, 80)) drawCar(ctx, car, view);
  }
  for (const ped of state.peds) {
    if (inView(ped.x, ped.y, view, 40)) drawPed(ctx, ped, view);
  }
  if (state.player && !state.player.inCar) {
    drawPed(ctx, state.player, view, true);
  }
  // Bullets as bright tracers.
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 2;
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - view.camX, b.y - view.camY);
    ctx.lineTo(b.x - b.vx * 0.02 - view.camX, b.y - b.vy * 0.02 - view.camY);
    ctx.stroke();
  }
  // Particles on top.
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - view.camX - p.size / 2, p.y - view.camY - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
