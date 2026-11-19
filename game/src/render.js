// Neon Bay — everything the player sees: the camera, the city, the cars
// and people in it, and the HUD with its wanted stars, cash, health and
// minimap. All drawing is plain canvas 2D.

import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_W, LANDMARKS, onRoad } from './city.js';
import { clamp, lerp } from './rng.js';
import { currentTarget, currentObjectiveText } from './missions.js';

export function createCamera() {
  return { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 1 };
}

export function updateCamera(cam, tx, ty, dt, vw, vh) {
  const k = 1 - Math.pow(0.001, dt);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);
  cam.x = clamp(cam.x, vw / 2 / cam.zoom, WORLD_W - vw / 2 / cam.zoom);
  cam.y = clamp(cam.y, vh / 2 / cam.zoom, WORLD_H - vh / 2 / cam.zoom);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, x, y, angle, color, opts) {
  const o = opts || {};
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -22 + 3, -10 + 4, 46, 22, 7);
  ctx.fill();
  // Body.
  ctx.fillStyle = color;
  roundRect(ctx, -23, -11, 46, 22, 7);
  ctx.fill();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, -8, -9, 18, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  roundRect(ctx, 12, -8, 6, 16, 2);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(21, -8, 3, 4);
  ctx.fillRect(21, 5, 3, 4);
  if (o.police) {
    // Flashing light bar.
    const phase = Math.floor(o.time * 4) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
    roundRect(ctx, -4, -11, 8, 6, 2);
    ctx.fill();
    ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
    roundRect(ctx, -4, 5, 8, 6, 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPedShape(ctx, x, y, angle, shirt, skin, bob) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(2, 3, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(7 + Math.sin(bob) * 1.5, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, g, time) {
  const { city, cars, peds, player, police, combat, missions, cam } = g;
  const vw = ctx.canvas.width, vh = ctx.canvas.height;
  ctx.save();
  ctx.clearRect(0, 0, vw, vh);
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  // Ground.
  ctx.fillStyle = '#cfc4a8';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Beach sand and sea on the west edge.
  ctx.fillStyle = '#3fa8c9';
  ctx.fillRect(0, 0, 70, WORLD_H);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(70, 0, 130, WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const wy = i * 200 + ((time * 30) % 200);
    ctx.beginPath();
    ctx.moveTo(8, wy);
    ctx.quadraticCurveTo(30, wy + 12, 62, wy);
    ctx.stroke();
  }

  // Marina water basin.
  ctx.fillStyle = '#3fa8c9';
  ctx.fillRect(200, 2000, 300, 400);
  ctx.fillStyle = '#8a6a48';
  for (const d of city.docks) ctx.fillRect(d.x, d.y, d.w, d.h);
  // Moored boats.
  ctx.fillStyle = '#f0f0f0';
  for (let i = 0; i < 4; i++) {
    const bx = 270 + i * 60;
    ctx.save();
    ctx.translate(bx, 2080 + (i % 2) * 90);
    ctx.rotate(Math.PI / 2);
    roundRect(ctx, -14, -30, 28, 60, 10);
    ctx.fill();
    ctx.restore();
  }

  // Park.
  ctx.fillStyle = '#7ac74f';
  ctx.fillRect(1060, 1060, 480, 480);
  ctx.strokeStyle = '#e8e0cc';
  ctx.lineWidth = 10;
  ctx.strokeRect(1060, 1060, 480, 480);
  for (const t of city.trees) {
    ctx.fillStyle = t.shade;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(t.x - 4, t.y - 4, t.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  // Roads: asphalt, edge lines, centre dashes.
  ctx.fillStyle = '#444a55';
  for (const rx of V_ROADS) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of H_ROADS) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const rx of V_ROADS) {
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); ctx.stroke();
  }
  for (const ry of H_ROADS) {
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Sidewalk tint on blocks.
  ctx.fillStyle = '#e8e0cc';
  for (let i = 0; i < V_ROADS.length - 1; i++) {
    for (let j = 0; j < H_ROADS.length - 1; j++) {
      const x0 = V_ROADS[i] + ROAD_W / 2, x1 = V_ROADS[i + 1] - ROAD_W / 2;
      const y0 = H_ROADS[j] + ROAD_W / 2, y1 = H_ROADS[j + 1] - ROAD_W / 2;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // Buildings, with a soft drop shadow for height.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(b.x + 6, b.y + 6 + b.height * 2, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.roof;
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 6);
    if (b.landmark) {
      ctx.fillStyle = '#20242c';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.landmark, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }

  // Mission marker: a pulsing diamond above the target.
  const target = currentTarget(missions, g.rng);
  if (target) {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.save();
    ctx.translate(target.x, target.y - 40);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd23d';
    ctx.strokeStyle = '#20242c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(14, 0); ctx.lineTo(0, 18); ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, 5);
    ctx.restore();
  }

  // Parked and traffic cars, then the player's car.
  for (const car of cars) {
    if (car.kind === 'player') continue;
    drawCarShape(ctx, car.x, car.y, car.angle, car.color, {});
  }
  for (const car of police.cars) {
    drawCarShape(ctx, car.x, car.y, car.angle, car.color, { police: true, time });
  }
  if (player.inCar) {
    drawCarShape(ctx, player.inCar.x, player.inCar.y, player.inCar.angle, player.inCar.color, {});
  }

  // Pedestrians and officers.
  for (const ped of peds) {
    drawPedShape(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.bob);
  }
  for (const off of police.foot) {
    drawPedShape(ctx, off.x, off.y, off.angle, '#20242c', '#e8b88a', time * 8);
    ctx.fillStyle = '#2e6bff';
    ctx.beginPath(); ctx.arc(off.x, off.y - 2, 4, 0, Math.PI * 2); ctx.fill();
  }

  // The player on foot.
  if (!player.inCar) {
    const blink = player.invuln > 0 && Math.floor(time * 12) % 2 === 0;
    if (!blink) {
      drawPedShape(ctx, player.x, player.y, player.angle, '#ffd23d', '#e8b88a', player.walkBob);
      // Aim line and pistol.
      ctx.strokeStyle = 'rgba(32,36,44,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(player.aimAngle) * 12, player.y + Math.sin(player.aimAngle) * 12);
      ctx.lineTo(player.x + Math.cos(player.aimAngle) * 26, player.y + Math.sin(player.aimAngle) * 26);
      ctx.stroke();
    }
  }

  // Bullets, flashes and particles.
  ctx.fillStyle = '#ffd23d';
  for (const b of combat.bullets) {
    ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
  }
  for (const f of combat.flashes) {
    ctx.fillStyle = 'rgba(255,210,61,0.8)';
    ctx.beginPath(); ctx.arc(f.x, f.y, 10, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of combat.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawStars(ctx, x, y, wanted) {
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd23d' : 'rgba(255,255,255,0.35)';
    ctx.strokeStyle = '#20242c';
    ctx.lineWidth = 2;
    const sx = x + i * 32;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
      const r = k === 0 ? 13 : 13;
      const px = sx + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      const a2 = a + Math.PI / 5;
      ctx.lineTo(sx + Math.cos(a2) * 5.5, y + Math.sin(a2) * 5.5);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
}

export function drawMinimap(ctx, g, x, y, w, h) {
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10,14,24,0.78)';
  roundRect(ctx, 0, 0, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  // Water and beach.
  ctx.fillStyle = '#3fa8c9';
  ctx.fillRect(0, 0, 70 * sx, h);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(70 * sx, 0, 130 * sx, h);
  // Roads.
  ctx.fillStyle = '#8a8f9a';
  for (const rx of V_ROADS) ctx.fillRect(rx * sx - 2, 0, 4, h);
  for (const ry of H_ROADS) ctx.fillRect(0, ry * sy - 2, w, 4);
  // Landmarks.
  ctx.fillStyle = '#ffffff';
  for (const lm of Object.values(LANDMARKS)) {
    ctx.fillRect(lm.x * sx - 2, lm.y * sy - 2, 4, 4);
  }
  // Mission target.
  const target = currentTarget(g.missions, g.rng);
  if (target) {
    const pulse = 3 + Math.sin(g.time * 4) * 1.5;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(target.x * sx, target.y * sy, pulse + 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#ff2e2e';
  for (const car of g.police.cars) {
    ctx.beginPath(); ctx.arc(car.x * sx, car.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const off of g.police.foot) {
    ctx.beginPath(); ctx.arc(off.x * sx, off.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const px = g.player.x * sx, py = g.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(g.player.angle);
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawHUD(ctx, g) {
  const vw = ctx.canvas.width, vh = ctx.canvas.height;
  const { player, police, missions } = g;

  // Wanted stars + health, top left.
  drawStars(ctx, 20, 34, police.wanted);
  ctx.fillStyle = 'rgba(10,14,24,0.6)';
  roundRect(ctx, 18, 52, 170, 14, 7);
  ctx.fill();
  ctx.fillStyle = player.health > 30 ? '#7ac74f' : '#ff2e2e';
  roundRect(ctx, 20, 54, 166 * (player.health / 100), 10, 5);
  ctx.fill();

  // Cash and ammo, top right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 4;
  ctx.strokeText(`$${player.cash.toLocaleString('en-US')}`, vw - 20, 36);
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, vw - 20, 36);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = player.ammo === 0 ? '#ff6b6b' : '#e8e8e8';
  const ammoText = player.reloading > 0 ? 'RELOADING…' : `AMMO ${player.ammo} / ${player.ammoMax}`;
  ctx.strokeText(ammoText, vw - 20, 60);
  ctx.fillText(ammoText, vw - 20, 60);

  // Minimap, bottom left.
  drawMinimap(ctx, g, 16, vh - 176, 220, 160);

  // Objective, bottom centre.
  const obj = currentObjectiveText(missions);
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(obj).width + 28;
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  roundRect(ctx, vw / 2 - tw / 2, vh - 52, tw, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.fillText(obj, vw / 2, vh - 29);

  // Toast above the objective.
  if (missions.toastT > 0 && missions.toast) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const t2 = ctx.measureText(missions.toast).width + 24;
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    roundRect(ctx, vw / 2 - t2 / 2, vh - 96, t2, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(missions.toast, vw / 2, vh - 75);
  }

  // Speed, bottom right, while driving.
  if (player.inCar) {
    const kmh = Math.round(Math.abs(player.inCar.speed) * 0.9);
    ctx.textAlign = 'right';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.strokeText(`${kmh}`, vw - 20, vh - 66);
    ctx.fillText(`${kmh}`, vw - 20, vh - 66);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText('km/h — E to step out', vw - 20, vh - 44);
  }

  // Vault-cracking progress.
  const step = missions.index < 3 ? (missions.step ?? 0) : -1;
  if (missions.crackT > 0) {
    const bw = 260;
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    roundRect(ctx, vw / 2 - bw / 2, vh / 2 - 60, bw, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23d';
    roundRect(ctx, vw / 2 - bw / 2 + 3, vh / 2 - 57, (bw - 6) * (missions.crackT / 4), 20, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRACKING THE VAULT…', vw / 2, vh / 2 - 70);
  }
  void step;
}

export function drawTitle(ctx, g, save) {
  const vw = ctx.canvas.width, vh = ctx.canvas.height;
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.55, '#e85d75');
  grad.addColorStop(1, '#3d2b63');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  // Sun.
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(vw * 0.78, vh * 0.26, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,233,168,0.35)';
  ctx.beginPath(); ctx.arc(vw * 0.78, vh * 0.26, 110, 0, Math.PI * 2); ctx.fill();
  // City silhouette.
  ctx.fillStyle = '#1d2340';
  const base = vh * 0.82;
  for (let i = 0; i < 26; i++) {
    const bw = vw / 26;
    const bh = 40 + ((i * 53) % 130);
    ctx.fillRect(i * bw, base - bh, bw - 3, bh + vh);
  }
  ctx.fillStyle = '#ffd23d';
  for (let i = 0; i < 40; i++) {
    const wx = ((i * 97) % vw) + 10;
    const wy = base - 20 - ((i * 61) % 110);
    ctx.fillRect(wx, wy, 5, 7);
  }
  // Title.
  ctx.textAlign = 'center';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 8;
  ctx.strokeText('NEON BAY', vw / 2, vh * 0.34);
  ctx.fillText('NEON BAY', vw / 2, vh * 0.34);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('An open-world crime story — steal, drive, run jobs, outrun the law.', vw / 2, vh * 0.42);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Mara Voss just rolled into Neon Bay with empty pockets and a fast mouth.', vw / 2, vh * 0.47);
  ctx.fillText('Rico, Lena and the Crew have work for her — if she can stay out of jail.', vw / 2, vh * 0.505);
  // Buttons.
  const bx = vw / 2 - 130, by = vh * 0.58, bw = 260, bh = 54;
  ctx.fillStyle = '#ffd23d';
  roundRect(ctx, bx, by, bw, bh, 10);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(save ? 'CONTINUE' : 'START', vw / 2, by + 36);
  if (save) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`Saved: $${save.cash.toLocaleString('en-US')} · job ${save.missionIndex + 1} of 3`, vw / 2, by + 84);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move & drive · E — steal / enter car · Click / Space — shoot · R — reload', vw / 2, vh * 0.76);
  ctx.fillText('Shift — run · P — pause · M — courier gig (after the story) · Mute: N', vw / 2, vh * 0.795);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Click START or press Enter. Your progress saves on this computer.', vw / 2, vh * 0.85);
  void g;
}

export function drawPaused(ctx) {
  const vw = ctx.canvas.width, vh = ctx.canvas.height;
  ctx.fillStyle = 'rgba(10,14,24,0.65)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 10);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Press P to keep playing', vw / 2, vh / 2 + 30);
}

export function drawEnd(ctx, kind, stats) {
  const vw = ctx.canvas.width, vh = ctx.canvas.height;
  ctx.fillStyle = kind === 'busted' ? 'rgba(30,60,140,0.72)' : 'rgba(120,20,20,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', vw / 2, vh / 2 - 20);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(
    kind === 'busted'
      ? 'The Neon Bay police finally caught up with Mara.'
      : 'Mara went down in a hail of gunfire.',
    vw / 2, vh / 2 + 20,
  );
  ctx.fillText(`Cash kept: $${stats.cash.toLocaleString('en-US')} · Jobs done: ${stats.jobs}`, vw / 2, vh / 2 + 52);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23d';
  ctx.fillText('Press Enter to try again', vw / 2, vh / 2 + 100);
}
