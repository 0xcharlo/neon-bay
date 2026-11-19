// Neon Bay — pedestrians. They stroll the sidewalks, cross at corners,
// and run away from gunfire, speeding cars and police chases. Hitting one
// is a crime the police notice.

import { randomWalkPoint, blockedAt } from './city.js';
import { pick, range, clamp, dist2 } from './rng.js';

const SHIRTS = ['#e8e8e8', '#d94f3d', '#3d7dd9', '#e8c33d', '#7ac74f', '#c94bd8', '#e07a2e', '#4fc9c9'];

export function makePed(rng, x, y) {
  return {
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 28, 55),
    shirt: pick(rng, SHIRTS),
    skin: pick(rng, ['#e8b88a', '#c98d5a', '#8a5a3a', '#f0c8a0']),
    hp: 30,
    state: 'walk', // walk | flee
    fleeX: 0, fleeY: 0,
    wanderT: range(rng, 2, 6),
    bob: Math.random() * 6,
  };
}

export function spawnPed(rng) {
  const p = randomWalkPoint(rng);
  return makePed(rng, p.x, p.y);
}

// A pedestrian walks to a nearby target, then picks a new one. When
// frightened, it runs straight away from the scare for a few seconds.
export function updatePed(ped, dt, city, scare) {
  ped.bob += dt * 8;
  let tx, ty, speed;
  if (ped.state === 'flee') {
    tx = ped.fleeX; ty = ped.fleeY; speed = 150;
    if (dist2(ped.x, ped.y, tx, ty) < 60 * 60) {
      ped.state = 'walk';
      ped.wanderT = 0;
    }
  } else {
    if (scare && dist2(ped.x, ped.y, scare.x, scare.y) < 420 * 420) {
      ped.state = 'flee';
      const d = Math.max(1, Math.hypot(ped.x - scare.x, ped.y - scare.y));
      ped.fleeX = ped.x + ((ped.x - scare.x) / d) * 500;
      ped.fleeY = ped.y + ((ped.y - scare.y) / d) * 500;
      ped.fleeX = clamp(ped.fleeX, 90, 3190);
      ped.fleeY = clamp(ped.fleeY, 30, 2370);
      return;
    }
    ped.wanderT -= dt;
    if (ped.wanderT <= 0) {
      ped.wanderT = range(Math.random, 3, 8);
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * 260;
      ped.targetX = clamp(ped.x + Math.cos(a) * d, 90, 3110);
      ped.targetY = clamp(ped.y + Math.sin(a) * d, 30, 2370);
    }
    tx = ped.targetX ?? ped.x; ty = ped.targetY ?? ped.y;
    speed = ped.speed;
  }
  const dx = tx - ped.x, dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d > 4) {
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + (dx / d) * speed * dt;
    const ny = ped.y + (dy / d) * speed * dt;
    if (!blockedAt(city, nx, ped.y, 8)) ped.x = nx;
    if (!blockedAt(city, ped.x, ny, 8)) ped.y = ny;
  }
}
