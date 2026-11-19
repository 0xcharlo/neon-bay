// Neon Bay — the wanted level and the police who answer it. Crimes raise
// the stars; staying quiet and out of sight lowers them. Police cars chase
// a driver, officers on foot chase a pedestrian, and being caught means
// BUSTED.

import { spawnPoliceCar } from './vehicles.js';
import { blockedAt } from './city.js';
import { clamp, dist2 } from './rng.js';

export function createPolice() {
  return {
    wanted: 0,
    quietT: 0, // seconds since the last crime
    decayT: 0,
    cars: [], // police car entities
    foot: [], // police officers on foot
    spawnT: 0,
  };
}

export function addWanted(police, amount) {
  police.wanted = clamp(police.wanted + amount, 0, 5);
  police.quietT = 0;
  police.decayT = 0;
}

// How many police units the current wanted level calls for.
export function wantedUnitCount(wanted) {
  return wanted;
}

// Spawn and steer police units toward the player. `rng` is the game's
// seeded generator; `onBusted` fires when an officer holds the player.
export function updatePolice(police, dt, rng, player, city, onBusted) {
  const w = police.wanted;
  if (w === 0) {
    // Everyone stands down and drives away.
    police.cars = [];
    police.foot = [];
    return;
  }

  police.quietT += dt;
  if (police.quietT > 25) {
    police.decayT += dt;
    if (police.decayT > 8) {
      police.decayT = 0;
      police.wanted = Math.max(0, police.wanted - 1);
      police.quietT = 0;
    }
  }

  const wantCars = player.inCar ? w : Math.ceil(w / 2);
  const wantFoot = player.inCar ? 0 : Math.ceil(w / 2);

  police.spawnT -= dt;
  if (police.spawnT <= 0) {
    police.spawnT = 1.2;
    if (police.cars.length < wantCars) {
      police.cars.push(spawnPoliceCar(rng, player.x, player.y));
    } else if (police.foot.length < wantFoot) {
      const a = rng() * Math.PI * 2;
      police.foot.push({
        x: clamp(player.x + Math.cos(a) * 420, 90, 3110),
        y: clamp(player.y + Math.sin(a) * 420, 30, 2370),
        angle: 0, speed: 190, hp: 100, kind: 'officer',
      });
    }
  }

  // Trim extras if the wanted level dropped.
  while (police.cars.length > wantCars) police.cars.pop();
  while (police.foot.length > wantFoot) police.foot.pop();

  return { wantCars, wantFoot };
}

// An officer on foot runs at the player and grabs her if he stays close.
export function updateOfficer(off, dt, player, city, onBusted) {
  const d = Math.hypot(player.x - off.x, player.y - off.y);
  const dx = (player.x - off.x) / Math.max(1, d);
  const dy = (player.y - off.y) / Math.max(1, d);
  off.angle = Math.atan2(dy, dx);
  const nx = off.x + dx * off.speed * dt;
  const ny = off.y + dy * off.speed * dt;
  if (!blockedAt(city, nx, off.y, 10)) off.x = nx;
  if (!blockedAt(city, off.x, ny, 10)) off.y = ny;
  if (d < 30) {
    player.bustedT += dt;
    if (player.bustedT > 1.2) onBusted();
  } else {
    player.bustedT = Math.max(0, player.bustedT - dt * 2);
  }
}
