// Neon Bay — the player: Mara Voss, a driver new to the city. On foot she
// walks and shoots; in a car she drives it. She carries cash, health and
// ammo, and the wanted level follows her everywhere.

import { blockedAt, LANDMARKS } from './city.js';
import { clamp, dist2 } from './rng.js';

export function createPlayer() {
  return {
    // Mara starts on the sidewalk just south of Bay Plaza, not inside it.
    x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y + 130,
    angle: -Math.PI / 2, // facing up the street
    speed: 0,
    health: 100,
    cash: 0,
    ammo: 24,
    ammoMax: 24,
    reloading: 0,
    inCar: null, // the car entity she is driving, or null on foot
    aimAngle: 0,
    walkBob: 0,
    invuln: 0, // brief grace after being hit
    bustedT: 0, // time a cop has held her while wanted
  };
}

// Move on foot. Returns true if she bumped into something solid.
export function moveOnFoot(player, ax, ay, dt, city, running) {
  const speed = running ? 260 : 165;
  const len = Math.hypot(ax, ay);
  if (len > 0.01) {
    const nx = ax / len, ny = ay / len;
    player.angle = Math.atan2(ny, nx);
    const stepX = nx * speed * dt;
    const stepY = ny * speed * dt;
    if (!blockedAt(city, player.x + stepX, player.y, 12)) player.x += stepX;
    if (!blockedAt(city, player.x, player.y + stepY, 12)) player.y += stepY;
    player.walkBob += dt * 11;
    player.speed = speed;
  } else {
    player.speed = 0;
  }
}

// Find the nearest car she can steal: parked, or a slow traffic car.
export function nearestStealableCar(player, cars, maxDist) {
  let best = null, bestD = maxDist * maxDist;
  for (const car of cars) {
    if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
    if (car.kind === 'traffic' && Math.abs(car.speed) > 20) continue;
    const d = dist2(player.x, player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(player, car) {
  car.kind = 'player';
  car.speed = 0;
  player.inCar = car;
  player.x = car.x; player.y = car.y;
}

export function exitCar(player, city) {
  const car = player.inCar;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  player.inCar = null;
  // Step out to the driver's side; fall back to the other side if blocked.
  const side = car.angle + Math.PI / 2;
  const ox = Math.cos(side) * 34, oy = Math.sin(side) * 34;
  if (!blockedAt(city, car.x + ox, car.y + oy, 12)) {
    player.x = car.x + ox; player.y = car.y + oy;
  } else {
    player.x = car.x - ox; player.y = car.y - oy;
  }
  player.angle = car.angle;
}

export function hurtPlayer(player, amount) {
  if (player.invuln > 0) return;
  player.health = clamp(player.health - amount, 0, 100);
  player.invuln = 0.5;
}
