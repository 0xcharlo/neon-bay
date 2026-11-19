// Neon Bay — boot, the game loop and the wiring between every system.
// This is the entry point the page loads; it owns the game state machine
// (title, playing, paused, busted, wasted) and nothing else's internals.

import { buildCity, LANDMARKS, V_ROADS, H_ROADS, WORLD_W, WORLD_H } from './city.js';
import { makeRng, clamp, dist2, pick } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import {
  makeCar, spawnTrafficCar, spawnParkedCar, updateTraffic,
  updatePoliceCar, driveCar,
} from './vehicles.js';
import { spawnPed, updatePed } from './peds.js';
import { createPlayer, moveOnFoot, nearestStealableCar, enterCar, exitCar, hurtPlayer } from './player.js';
import { createPolice, addWanted, updatePolice, updateOfficer } from './police.js';
import { createCombat, fireBullet, burst, updateBullets, updateParticles } from './combat.js';
import { createMissions, updateMissions, completeMission } from './missions.js';
import { createCamera, updateCamera, drawWorld, drawHUD, drawTitle, drawPaused, drawEnd } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

window.__neonErrors = [];
window.addEventListener('error', (e) => window.__neonErrors.push(String(e.message || e.error)));

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '20261119', 10) || 20261119;
const shot = params.get('shot') || '';

const rng = makeRng(seed);
const city = buildCity(seed);
const input = createInput(canvas);
const audio = createAudio();
const player = createPlayer();
const police = createPolice();
const combat = createCombat();
const missions = createMissions();
const cam = createCamera();
const save = loadSave();

const cars = [];
const peds = [];

for (let i = 0; i < 14; i++) cars.push(spawnTrafficCar(rng));
// Parked cars along the roads, two of them right by Bay Plaza so the
// first job can start at once.
for (let i = 0; i < 10; i++) {
  const vertical = rng() < 0.5;
  let x, y, angle;
  if (vertical) {
    const road = pick(rng, V_ROADS);
    x = road + (rng() < 0.5 ? -45 : 45); // the curb lane, clear of buildings
    y = 200 + rng() * (WORLD_H - 400);
    angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const road = pick(rng, H_ROADS);
    x = 300 + rng() * (WORLD_W - 600);
    y = road + (rng() < 0.5 ? -45 : 45); // the curb lane, clear of buildings
    angle = rng() < 0.5 ? 0 : Math.PI;
  }
  cars.push(spawnParkedCar(rng, x, y, angle));
}
cars.push(spawnParkedCar(rng, 1555, 700, Math.PI / 2));
cars.push(spawnParkedCar(rng, 2245, 700, -Math.PI / 2));

for (let i = 0; i < 24; i++) peds.push(spawnPed(rng));

const game = {
  city, cars, peds, player, police, combat, missions, cam, rng,
  time: 0, state: 'title',
};
window.__neonBay = game;

let shootCooldown = 0;
let crimeCooldown = 0;
let saveTimer = 0;
let colliding = new Set();
let stats = { cash: 0, jobs: 0 };

function applySave(s) {
  if (!s) return;
  player.cash = s.cash;
  missions.index = s.missionIndex;
  stats.cash = s.cash;
  stats.jobs = s.missionIndex;
}

function persist() {
  writeSave({
    cash: player.cash,
    missionIndex: missions.index,
    earned: stats.cash,
    bestWanted: Math.max(police.wanted, save ? save.bestWanted : 0),
    gigsDone: stats.jobs,
  });
}

function crime(amount) {
  if (crimeCooldown > 0) return;
  crimeCooldown = 1.5;
  addWanted(police, amount);
}

function witnessesNear(x, y, r) {
  const rr = r * r;
  for (const p of peds) if (dist2(x, y, p.x, p.y) < rr) return true;
  for (const c of police.cars) if (dist2(x, y, c.x, c.y) < rr) return true;
  for (const o of police.foot) if (dist2(x, y, o.x, o.y) < rr) return true;
  return false;
}

function startRun() {
  audio.unlock();
  if (save) applySave(save);
  game.state = 'playing';
}

function restartRun() {
  player.x = LANDMARKS.plaza.x;
  player.y = LANDMARKS.plaza.y + 130;
  player.health = 100;
  player.ammo = player.ammoMax;
  player.reloading = 0;
  player.bustedT = 0;
  if (player.inCar) exitCar(player, city);
  police.wanted = 0;
  police.cars = [];
  police.foot = [];
  combat.bullets = [];
  game.state = 'playing';
}

function bustPlayer() {
  if (game.state !== 'playing') return;
  game.state = 'busted';
  audio.busted();
  persist();
}

function wastePlayer() {
  if (game.state !== 'playing') return;
  game.state = 'wasted';
  audio.busted();
  persist();
}

function explodeCar(car) {
  burst(combat, car.x, car.y, '#ff7a2e', 26, 260);
  burst(combat, car.x, car.y, '#3a3a3a', 16, 160);
  audio.crash();
  const idx = cars.indexOf(car);
  if (idx !== -1) cars.splice(idx, 1);
  if (player.inCar === car) {
    exitCar(player, city);
    hurtPlayer(player, 25);
  }
}

function update(dt) {
  game.time += dt;
  shootCooldown = Math.max(0, shootCooldown - dt);
  crimeCooldown = Math.max(0, crimeCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) player.ammo = player.ammoMax;
  }

  const ax = input.axis();
  const running = input.down('ShiftLeft') || input.down('ShiftRight');

  // Mute toggle.
  if (input.wasPressed('KeyN')) audio.toggleMute();

  // Pause.
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    game.state = 'paused';
    input.endFrame(); // clear the press, or the pause screen resumes at once
    return;
  }

  // Aim follows the mouse.
  const mx = cam.x + (input.mouse.x - canvas.width / 2) / cam.zoom;
  const my = cam.y + (input.mouse.y - canvas.height / 2) / cam.zoom;
  player.aimAngle = Math.atan2(my - player.y, mx - player.x);

  // Enter / exit a car.
  if (input.wasPressed('KeyE')) {
    if (player.inCar) {
      exitCar(player, city);
    } else {
      const car = nearestStealableCar(player, cars, 75);
      if (car) {
        enterCar(player, car);
        if (witnessesNear(player.x, player.y, 380)) {
          crime(1);
          missions.toast = 'Someone saw you steal that car!';
          missions.toastT = 3;
        }
        audio.pickup();
      }
    }
  }

  if (player.inCar) {
    const car = player.inCar;
    let steer = ax.x, throttle = -ax.y;
    if (game.autoDrive) { steer = 0; throttle = 1; } // staged chase shots keep driving
    const hit = driveCar(car, steer, throttle, dt, city);
    if (hit && Math.abs(car.speed) > 120) audio.crash();
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    // Running over a pedestrian is a crime.
    for (let i = peds.length - 1; i >= 0; i--) {
      const ped = peds[i];
      if (Math.abs(car.speed) > 60 && dist2(car.x, car.y, ped.x, ped.y) < 30 * 30) {
        burst(combat, ped.x, ped.y, '#c0392b', 14, 160);
        peds.splice(i, 1);
        crime(1);
        missions.toast = 'You ran someone over!';
        missions.toastT = 3;
        audio.crash();
      }
    }
  } else {
    moveOnFoot(player, ax.x, ax.y, dt, city, running);
    // Shooting.
    const wantShoot = input.mouse.clicked || input.down('Space');
    if (wantShoot && shootCooldown <= 0 && player.reloading <= 0) {
      if (player.ammo > 0) {
        shootCooldown = 0.18;
        player.ammo -= 1;
        const gx = player.x + Math.cos(player.aimAngle) * 20;
        const gy = player.y + Math.sin(player.aimAngle) * 20;
        fireBullet(combat, gx, gy, player.aimAngle, true);
        audio.gunshot();
        // Scare nearby pedestrians.
        for (const ped of peds) {
          if (dist2(player.x, player.y, ped.x, ped.y) < 420 * 420) {
            ped.state = 'flee';
            const d = Math.max(1, Math.hypot(ped.x - player.x, ped.y - player.y));
            ped.fleeX = clamp(ped.x + ((ped.x - player.x) / d) * 500, 90, 3110);
            ped.fleeY = clamp(ped.y + ((ped.y - player.y) / d) * 500, 30, 2370);
          }
        }
        if (witnessesNear(player.x, player.y, 450)) crime(1);
      } else {
        audio.denied();
        player.reloading = 1.0;
      }
    }
    if (input.wasPressed('KeyR') && player.ammo < player.ammoMax && player.reloading <= 0) {
      player.reloading = 1.0;
    }
  }

  // Traffic and pedestrians keep moving.
  for (const car of cars) {
    if (car.kind === 'traffic') updateTraffic(car, dt);
  }
  const scare = combat.bullets.length > 0
    ? { x: player.x, y: player.y }
    : null;
  for (const ped of peds) updatePed(ped, dt, city, scare);

  // Police.
  updatePolice(police, dt, rng, player, city, bustPlayer);
  for (const pc of police.cars) {
    updatePoliceCar(pc, player.x, player.y, dt, city);
    // A police car that touches the player on foot grabs her.
    if (!player.inCar && dist2(pc.x, pc.y, player.x, player.y) < 34 * 34) {
      player.bustedT += dt;
      if (player.bustedT > 1.0) bustPlayer();
    }
  }
  for (const off of police.foot) {
    updateOfficer(off, dt, player, city, bustPlayer);
  }

  // Car-to-car collisions with the player's car.
  if (player.inCar) {
    const pc = player.inCar;
    const nowColliding = new Set();
    for (const other of [...cars, ...police.cars]) {
      if (other === pc) continue;
      const d2 = dist2(pc.x, pc.y, other.x, other.y);
      if (d2 < 42 * 42) {
        nowColliding.add(other);
        const d = Math.max(1, Math.sqrt(d2));
        const push = (42 - d) / 2;
        const nx = (pc.x - other.x) / d, ny = (pc.y - other.y) / d;
        pc.x += nx * push; pc.y += ny * push;
        if (!colliding.has(other)) {
          const impact = Math.abs(pc.speed) + Math.abs(other.speed || 0);
          if (impact > 120) {
            audio.crash();
            burst(combat, (pc.x + other.x) / 2, (pc.y + other.y) / 2, '#c8c8c8', 8, 120);
            pc.hp -= 10;
            other.hp -= 14;
            pc.speed *= 0.5;
          }
        }
      }
    }
    colliding = nowColliding;
    if (pc.hp <= 0) explodeCar(pc);
  }
  // Wrecked traffic cars burn out and vanish.
  for (let i = cars.length - 1; i >= 0; i--) {
    if (cars[i].hp <= 0) {
      burst(combat, cars[i].x, cars[i].y, '#ff7a2e', 18, 200);
      cars.splice(i, 1);
    }
  }
  for (let i = police.cars.length - 1; i >= 0; i--) {
    if (police.cars[i].hp <= 0) {
      burst(combat, police.cars[i].x, police.cars[i].y, '#ff7a2e', 22, 220);
      police.cars.splice(i, 1);
      crime(1);
    }
  }

  // Bullets.
  const targets = [];
  for (const car of cars) targets.push({ x: car.x, y: car.y, r: 22, hp: car.hp, kind: car.kind, ref: car });
  for (const car of police.cars) targets.push({ x: car.x, y: car.y, r: 22, hp: car.hp, kind: 'police', ref: car });
  for (const ped of peds) targets.push({ x: ped.x, y: ped.y, r: 10, hp: ped.hp, kind: 'ped', ref: ped });
  for (const off of police.foot) targets.push({ x: off.x, y: off.y, r: 10, hp: off.hp, kind: 'officer', ref: off });
  const hits = updateBullets(combat, dt, city, targets);
  for (const hit of hits) {
    const t = hit.target;
    t.hp -= 34;
    t.ref.hp = t.hp;
    burst(combat, hit.x, hit.y, '#ffd23d', 6, 120);
    if (t.hp <= 0) {
      if (t.kind === 'ped') {
        burst(combat, t.x, t.y, '#c0392b', 14, 160);
        const i = peds.indexOf(t.ref);
        if (i !== -1) peds.splice(i, 1);
        crime(1);
      } else if (t.kind === 'officer') {
        burst(combat, t.x, t.y, '#2e6bff', 12, 150);
        const i = police.foot.indexOf(t.ref);
        if (i !== -1) police.foot.splice(i, 1);
        crime(1);
      } else if (t.kind === 'police') {
        crime(1);
      }
    }
  }
  updateParticles(combat, dt);

  // Missions.
  const events = updateMissions(missions, { player, input, dt, rng });
  for (const ev of events) {
    if (ev === 'mission-complete') {
      const reward = completeMission(missions);
      player.cash += reward;
      stats.cash = player.cash;
      stats.jobs = missions.index;
      audio.missionDone();
      persist();
    } else if (ev === 'pickup') {
      crime(1);
    } else if (ev === 'crack-done') {
      police.wanted = 4;
      police.quietT = 0;
      police.decayT = 0;
    } else if (ev === 'gig-complete') {
      player.cash += 300;
      stats.cash = player.cash;
      audio.missionDone();
      missions.toast = 'Courier gig done — $300.';
      missions.toastT = 3;
      persist();
    }
  }

  // Slow recovery while the heat is off.
  if (police.wanted === 0 && player.health < 100) {
    player.health = Math.min(100, player.health + 2 * dt);
  }
  if (player.health <= 0) wastePlayer();

  // Sound that follows the game.
  audio.engine(player.inCar ? Math.abs(player.inCar.speed) / 430 : 0, !!player.inCar);
  audio.siren(dt, police.wanted);

  // Camera follows the player.
  updateCamera(cam, player.x, player.y, dt, canvas.width, canvas.height);

  // Autosave while playing.
  saveTimer += dt;
  if (saveTimer > 15) { saveTimer = 0; persist(); }

  input.endFrame();
}

let last = performance.now();
let firstFrame = true;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (game.state === 'title') {
    if (input.wasPressed('Enter') || input.mouse.clicked) {
      const bx = canvas.width / 2 - 130, by = canvas.height * 0.58;
      const inButton = input.mouse.x >= bx && input.mouse.x <= bx + 260 &&
        input.mouse.y >= by && input.mouse.y <= by + 54;
      if (input.wasPressed('Enter') || inButton) startRun();
    }
    input.endFrame();
    drawTitle(ctx, game, save);
  } else if (game.state === 'playing') {
    update(dt);
    drawWorld(ctx, game, game.time);
    drawHUD(ctx, game);
  } else if (game.state === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.wasPressed('Enter')) {
      game.state = 'playing';
    }
    input.endFrame();
    drawWorld(ctx, game, game.time);
    drawHUD(ctx, game);
    drawPaused(ctx);
  } else {
    // busted or wasted.
    if (input.wasPressed('Enter')) restartRun();
    input.endFrame();
    drawWorld(ctx, game, game.time);
    drawHUD(ctx, game);
    drawEnd(ctx, game.state, { cash: player.cash, jobs: missions.index });
  }

  if (firstFrame) {
    firstFrame = false;
    window.__neonReady = true;
  }
  requestAnimationFrame(frame);
}

// Stage a screenshot scene before the first frame, if asked.
if (shot) stageShot(game, shot);
requestAnimationFrame(frame);
