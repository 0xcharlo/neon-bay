// Neon Bay — cars: parked, traffic, police and the player's ride. One car
// shape, drawn top-down, with a colour, a heading and a speed. Traffic
// follows the road grid; the player and the police steer freely.

import { V_ROADS, H_ROADS, WORLD_W, WORLD_H, blockedAt, randomRoadPoint } from './city.js';
import { pick, range, rangeInt, clamp, angleDiff } from './rng.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33d', '#7ac74f', '#c94bd8', '#e8e8e8', '#3a3a3a', '#e07a2e', '#4fc9c9', '#b03a5a'];
const POLICE_COLORS = ['#20242c', '#2c3e50'];

export function makeCar(opts) {
  return {
    kind: opts.kind || 'traffic', // traffic | parked | police | player
    x: opts.x, y: opts.y,
    angle: opts.angle || 0,
    speed: opts.speed || 0,
    maxSpeed: opts.maxSpeed || 120,
    color: opts.color || '#d94f3d',
    hp: opts.hp || 60,
    w: 46, h: 22,
    // Traffic state.
    axis: opts.axis || 'h',
    dir: opts.dir || 1,
    road: opts.road || 0,
    lane: opts.lane || 0,
    // Police state.
    chaseTime: 0,
    stuckTime: 0,
    sirenPhase: Math.random() * 6,
  };
}

export function spawnTrafficCar(rng) {
  const p = randomRoadPoint(rng);
  const axis = Math.abs(p.x - Math.round(p.x)) < 1 ? 'v' : 'h';
  // Decide the axis from the point: a point on a vertical road drives vertically.
  const onV = V_ROADS.some((rx) => Math.abs(p.x - rx) === 30);
  const useAxis = onV ? 'v' : 'h';
  const road = useAxis === 'v'
    ? V_ROADS.reduce((a, b) => Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a)
    : H_ROADS.reduce((a, b) => Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a);
  return makeCar({
    kind: 'traffic',
    x: p.x, y: p.y,
    angle: useAxis === 'v' ? (p.y < WORLD_H / 2 ? Math.PI / 2 : -Math.PI / 2) : (p.x < WORLD_W / 2 ? 0 : Math.PI),
    speed: range(rng, 55, 105),
    maxSpeed: range(rng, 90, 130),
    color: pick(rng, CAR_COLORS),
    axis: useAxis,
    dir: useAxis === 'v' ? (p.y < WORLD_H / 2 ? 1 : -1) : (p.x < WORLD_W / 2 ? 1 : -1),
    road,
    lane: 18, // inner lane, clear of the cars parked at the curb
  });
}

export function spawnParkedCar(rng, x, y, angle) {
  return makeCar({
    kind: 'parked', x, y, angle,
    speed: 0, maxSpeed: 0,
    color: pick(rng, CAR_COLORS),
    hp: 80,
  });
}

export function spawnPoliceCar(rng, px, py) {
  // Appear on a road at the edge of the map, away from the player.
  const edge = rangeInt(rng, 0, 3);
  let x, y;
  if (edge === 0) { x = pick(rng, V_ROADS); y = 80; }
  else if (edge === 1) { x = pick(rng, V_ROADS); y = WORLD_H - 80; }
  else if (edge === 2) { x = 140; y = pick(rng, H_ROADS); }
  else { x = WORLD_W - 140; y = pick(rng, H_ROADS); }
  if (Math.abs(x - px) < 400 && Math.abs(y - py) < 400) { x = WORLD_W - x; y = WORLD_H - y; }
  return makeCar({
    kind: 'police', x, y,
    angle: Math.atan2(py - y, px - x),
    speed: 0, maxSpeed: 330,
    color: pick(rng, POLICE_COLORS),
    hp: 120,
  });
}

// Move one car one step with simple arcade handling. `steer` is -1..1 and
// `throttle` is -1..1. Returns true if it hit something solid.
export function driveCar(car, steer, throttle, dt, city) {
  const accel = car.kind === 'police' ? 300 : 260;
  car.speed = clamp(car.speed + throttle * accel * dt, -150, car.maxSpeed);
  if (throttle === 0) car.speed *= Math.pow(0.4, dt);
  const turnRate = 2.4 * clamp(Math.abs(car.speed) / 120, 0.25, 1);
  car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  let hit = false;
  if (!blockedAt(city, nx, car.y, 20)) car.x = nx; else { car.speed *= 0.4; hit = true; }
  if (!blockedAt(city, car.x, ny, 20)) car.y = ny; else { car.speed *= 0.4; hit = true; }
  return hit;
}

// Traffic drives straight along its road and wraps at the map edge.
export function updateTraffic(car, dt) {
  if (car.axis === 'v') {
    car.y += car.dir * car.speed * dt;
    if (car.y > WORLD_H + 40) car.y = -40;
    if (car.y < -40) car.y = WORLD_H + 40;
    car.x = car.road + (car.dir === 1 ? car.lane : -car.lane);
    car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.x += car.dir * car.speed * dt;
    if (car.x > WORLD_W + 40) car.x = -40;
    if (car.x < -40) car.x = WORLD_W + 40;
    car.y = car.road + (car.dir === 1 ? car.lane : -car.lane);
    car.angle = car.dir === 1 ? 0 : Math.PI;
  }
}

// A police car chases a point: steer toward it, full throttle.
export function updatePoliceCar(car, tx, ty, dt, city) {
  const target = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, target);
  const steer = clamp(diff * 1.6, -1, 1);
  const hit = driveCar(car, steer, 1, dt, city);
  if (hit) car.stuckTime += dt; else car.stuckTime = 0;
  if (car.stuckTime > 1.2) {
    // Back out of a jam: reverse and turn away.
    driveCar(car, -steer, -1, dt, city);
    car.stuckTime = 0;
  }
  car.sirenPhase += dt * 6;
}
