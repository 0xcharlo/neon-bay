// Neon Bay — staging for screenshots. Opening the game with ?shot=<name>
// arranges a live scene that shows the game at its best: a police chase,
// the city on foot, a mission escape, or the title screen. The scene keeps
// playing after staging, so a screenshot taken a second later is a genuine
// render of the running game.

import { LANDMARKS } from './city.js';
import { spawnPoliceCar, makeCar } from './vehicles.js';
import { addWanted } from './police.js';
import { enterCar } from './player.js';

export function stageShot(g, name) {
  const { player, police, missions, cars, rng, peds } = g;

  // Clear pedestrians from the road the staged car will drive down, so
  // the chase shot is not interrupted by a run-over during the settle.
  function clearRoadPeds(x0, x1, y0, y1) {
    for (let i = peds.length - 1; i >= 0; i--) {
      const p = peds[i];
      if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) peds.splice(i, 1);
    }
  }

  if (name === 'title') {
    g.state = 'title';
    return;
  }

  g.state = 'playing';

  if (name === 'cover') {
    // Driving down the main avenue with three stars and two police cars
    // closing in — the chase, the HUD and the minimap all in one frame.
    // autoDrive keeps the car moving down the road while the shot settles.
    const car = makeCar({
      kind: 'player', x: 1600, y: 1000, angle: 0,
      speed: 300, maxSpeed: 430, color: '#d94f3d', hp: 100,
    });
    cars.push(car);
    enterCar(player, car);
    g.autoDrive = true;
    clearRoadPeds(1600, 2800, 920, 1080);
    player.cash = 2450;
    player.ammo = 24;
    missions.index = 1;
    missions.step = 0;
    addWanted(police, 3);
    for (let i = 0; i < 2; i++) {
      const pc = spawnPoliceCar(rng, player.x, player.y);
      pc.x = player.x - 260 - i * 130;
      pc.y = 1000 + (i === 0 ? -30 : 30);
      pc.angle = 0;
      pc.speed = 280;
      police.cars.push(pc);
    }
    return;
  }

  if (name === 'street') {
    // On foot at Bay Plaza: pedestrians, traffic and the marina marker on
    // the minimap, with the second job waiting.
    player.x = LANDMARKS.plaza.x;
    player.y = LANDMARKS.plaza.y + 130;
    player.cash = 500;
    missions.index = 1;
    missions.step = 0;
    missions.toast = 'Lena: the package is waiting at the Marina.';
    missions.toastT = 6;
    return;
  }

  if (name === 'mission') {
    // The bank job escape: vault cracked, four stars, the whole force
    // coming, racing south past Bay Trust Bank for the Hideout.
    const car = makeCar({
      kind: 'player', x: 2200, y: 500, angle: Math.PI / 2,
      speed: 320, maxSpeed: 430, color: '#3d7dd9', hp: 100,
    });
    cars.push(car);
    enterCar(player, car);
    g.autoDrive = true;
    clearRoadPeds(2120, 2280, 400, 1500);
    player.cash = 5450;
    missions.index = 2;
    missions.step = 2;
    addWanted(police, 4);
    for (let i = 0; i < 3; i++) {
      const pc = spawnPoliceCar(rng, player.x, player.y);
      pc.x = 2200;
      pc.y = 340 - i * 120;
      pc.angle = Math.PI / 2;
      pc.speed = 300;
      police.cars.push(pc);
    }
    missions.toast = 'Vault open! Lose the police at the Hideout!';
    missions.toastT = 6;
    return;
  }

  // Unknown shot name: just play from the title.
  g.state = 'title';
}
