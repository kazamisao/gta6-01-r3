// The heads-up display and the minimap. The HUD paints health, cash, wanted
// stars, weapon state, the current district and the mission objective onto
// the main canvas; the minimap is its own small canvas in the corner showing
// the road grid, the beach, the player, traffic, police and the mission
// marker. The title, pause and end screens live here too, with the button
// rectangles main.js hit-tests for mouse clicks.

const FONT = 'system-ui, sans-serif';

/** Draw the in-game HUD. `state` carries everything the HUD reads. */
export function drawHud(ctx, state, w, h) {
  const { player, cash, stars, objective, missionTitle, district, message, weapon } = state;
  // Health bar, bottom left.
  const barW = 210;
  const barH = 15;
  const x = 18;
  const y = h - 34;
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.fillRect(x - 4, y - 4, barW + 8, barH + 8);
  ctx.fillStyle = '#5c1a1a';
  ctx.fillRect(x, y, barW, barH);
  const frac = Math.max(0, player.health / 100);
  ctx.fillStyle = frac > 0.35 ? '#57cc5e' : '#e63946';
  ctx.fillRect(x, y, barW * frac, barH);
  ctx.fillStyle = '#fff';
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', x, y - 8);

  // Cash, top right under the stars.
  ctx.textAlign = 'right';
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = '#7be382';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  const cashText = `$${cash.toLocaleString('en-US')}`;
  ctx.strokeText(cashText, w - 20, 66);
  ctx.fillText(cashText, w - 20, 66);

  // Wanted stars, top right.
  ctx.font = `26px ${FONT}`;
  for (let i = 0; i < 5; i += 1) {
    const sx = w - 20 - (5 - i) * 30;
    ctx.fillStyle = i < stars ? '#ffd166' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', sx, 34);
  }

  // Weapon state, bottom right.
  ctx.textAlign = 'right';
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = weapon.ready ? '#f1fa8c' : '#adb5bd';
  ctx.fillText(weapon.name, w - 20, h - 40);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = '#dee2e6';
  ctx.fillText(weapon.hint, w - 20, h - 20);

  // District name, above the health bar with clear air around it.
  if (district) {
    ctx.textAlign = 'left';
    ctx.font = `italic 13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(district, x, h - 60);
  }

  // Objective banner, top centre.
  if (objective) {
    ctx.textAlign = 'center';
    ctx.font = `bold 13px ${FONT}`;
    const title = missionTitle ? `${missionTitle} — ` : '';
    const text = `${title}${objective}`;
    const tw = ctx.measureText(text).width + 28;
    ctx.fillStyle = 'rgba(10,14,20,0.62)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2, 14, tw, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(text, w / 2, 34);
  }

  // Centre message (mission complete, busted warnings, pickups).
  if (message && message.until > state.time) {
    ctx.textAlign = 'center';
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillStyle = message.color ?? '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 4;
    ctx.strokeText(message.text, w / 2, h * 0.3);
    ctx.fillText(message.text, w / 2, h * 0.3);
    if (message.sub) {
      ctx.font = `15px ${FONT}`;
      ctx.strokeText(message.sub, w / 2, h * 0.3 + 26);
      ctx.fillText(message.sub, w / 2, h * 0.3 + 26);
    }
  }
}

/** Draw the minimap: streets, water, player, cars, police, mission marker. */
export function drawMinimap(mm, state) {
  const { city } = state;
  const w = mm.canvas.width;
  const h = mm.canvas.height;
  const sx = w / city.width;
  const sy = h / city.height;
  mm.fillStyle = '#79a86b';
  mm.fillRect(0, 0, w, h);
  mm.fillStyle = '#f4dc9a';
  mm.fillRect(0, city.beach.sandY * sy, w, (city.beach.waterY - city.beach.sandY) * sy);
  mm.fillStyle = '#1fb6c9';
  mm.fillRect(0, city.beach.waterY * sy, w, h - city.beach.waterY * sy);
  mm.strokeStyle = '#4a4a52';
  mm.lineWidth = 2;
  for (const vx of city.roads.verticals) {
    mm.beginPath();
    mm.moveTo(vx * sx, 0);
    mm.lineTo(vx * sx, city.beach.sandY * sy);
    mm.stroke();
  }
  for (const hy of city.roads.horizontals) {
    mm.beginPath();
    mm.moveTo(0, hy * sy);
    mm.lineTo(w, hy * sy);
    mm.stroke();
  }
  // Traffic as pale dots, police as blue, the player's car as white.
  for (const car of state.cars) {
    mm.fillStyle = car.kind === 'police' ? '#2b6bff' : car.kind === 'crew' ? '#e63946' : 'rgba(255,255,255,0.65)';
    mm.fillRect(car.x * sx - 1.5, car.y * sy - 1.5, 3, 3);
  }
  // Mission marker: a gold diamond.
  if (state.marker) {
    mm.save();
    mm.translate(state.marker.x * sx, state.marker.y * sy);
    mm.rotate(Math.PI / 4);
    mm.fillStyle = '#ffd166';
    mm.fillRect(-4, -4, 8, 8);
    mm.restore();
  }
  // Player arrow.
  const p = state.player;
  mm.save();
  mm.translate(p.x * sx, p.y * sy);
  mm.rotate(p.angle);
  mm.fillStyle = '#ffffff';
  mm.strokeStyle = '#111';
  mm.beginPath();
  mm.moveTo(6, 0);
  mm.lineTo(-4, -4);
  mm.lineTo(-4, 4);
  mm.closePath();
  mm.fill();
  mm.stroke();
  mm.restore();
  // Frame.
  mm.strokeStyle = 'rgba(10,14,20,0.8)';
  mm.lineWidth = 4;
  mm.strokeRect(0, 0, w, h);
}

/** The title screen's buttons, for drawing and hit-testing alike. */
export function titleButtons(w, h, hasSave) {
  const buttons = [{ id: 'new', label: 'NEW GAME', x: w / 2 - 110, y: h * 0.58, w: 220, h: 46 }];
  if (hasSave) buttons.push({ id: 'continue', label: 'CONTINUE', x: w / 2 - 110, y: h * 0.58 + 58, w: 220, h: 46 });
  return buttons;
}

/** Draw the title screen over a dimmed view of the city. */
export function drawTitle(ctx, state, w, h) {
  ctx.fillStyle = 'rgba(24,16,8,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.font = `bold 74px ${FONT}`;
  ctx.fillStyle = '#ffd166';
  ctx.strokeStyle = '#7a2d0d';
  ctx.lineWidth = 8;
  ctx.strokeText('SOLARA BAY', w / 2, h * 0.3);
  ctx.fillText('SOLARA BAY', w / 2, h * 0.3);
  ctx.font = `italic 19px ${FONT}`;
  ctx.fillStyle = '#fff3d6';
  ctx.fillText('Sun, sea, and other people’s cars.', w / 2, h * 0.3 + 36);
  for (const b of titleButtons(w, h, state.hasSave)) {
    ctx.fillStyle = 'rgba(12,18,26,0.85)';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 9);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 30);
  }
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const lines = [
    'WASD / arrows — move and drive      Shift — sprint      E — enter / exit car, talk',
    'Mouse — aim      Click or F — fire pistol      P / Esc — pause',
    'Rio Calloway owes the Coral Kings. Sol Vega has work. Try not to get caught.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.58 + (state.hasSave ? 128 : 70) + i * 22));
}

/** Draw a translucent pause or end overlay with a headline and a hint. */
export function drawOverlay(ctx, w, h, headline, sub, color = '#ffffff') {
  ctx.fillStyle = 'rgba(8,10,16,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText(headline, w / 2, h * 0.42);
  ctx.font = `17px ${FONT}`;
  ctx.fillStyle = '#f1f3f5';
  ctx.fillText(sub, w / 2, h * 0.42 + 38);
}
