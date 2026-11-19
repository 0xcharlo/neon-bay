// Neon Bay — combat: bullets, muzzle flashes, impacts and the little
// bursts of debris that sell a hit. Shooting is a crime the police notice.

import { blockedAt } from './city.js';
import { clamp, dist2 } from './rng.js';

export function createCombat() {
  return {
    bullets: [], // {x, y, vx, vy, life, fromPlayer}
    particles: [], // {x, y, vx, vy, life, maxLife, color, size}
    flashes: [], // {x, y, life}
  };
}

export function fireBullet(combat, x, y, angle, fromPlayer) {
  const speed = 720;
  combat.bullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.7,
    fromPlayer,
  });
  combat.flashes.push({ x, y, life: 0.06 });
}

export function burst(combat, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    combat.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.4, maxLife: 0.75,
      color, size: 2 + Math.random() * 3,
    });
  }
}

// Move bullets; report hits against cars, peds and officers so the caller
// can apply damage and wanted stars. `targets` is a list of
// {x, y, r, hp, kind, ref}.
export function updateBullets(combat, dt, city, targets) {
  const hits = [];
  for (const b of combat.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // A building stops the bullet.
    if (blockedAt(city, b.x, b.y, 2)) {
      burst(combat, b.x, b.y, '#c8c8c8', 4, 90);
      b.life = 0;
      continue;
    }
    for (const t of targets) {
      if (t.hp <= 0) continue;
      const rr = (t.r + 4) * (t.r + 4);
      if (dist2(b.x, b.y, t.x, t.y) < rr) {
        b.life = 0;
        hits.push({ target: t, x: b.x, y: b.y });
        break;
      }
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);
  return hits;
}

export function updateParticles(combat, dt) {
  for (const p of combat.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.2, dt);
    p.vy *= Math.pow(0.2, dt);
    p.life -= dt;
  }
  combat.particles = combat.particles.filter((p) => p.life > 0);
  for (const f of combat.flashes) f.life -= dt;
  combat.flashes = combat.flashes.filter((f) => f.life > 0);
}

export function bulletCount(combat) {
  return combat.bullets.length;
}
