// Neon Bay — the story: three jobs for Mara Voss, then repeatable courier
// gigs once the story is done. A mission is a list of steps; each step has
// a target on the map and a way to finish it. The module only reads the
// game state it is handed and reports events back.

import { LANDMARKS, WORLD_W, WORLD_H } from './city.js';
import { pick } from './rng.js';

export const STORY = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    giver: 'Rico',
    brief: 'Rico needs wheels. Steal any car and bring it to Sunset Garage.',
    reward: 500,
    steps: [
      { text: 'Steal a car — walk up to a parked car and press E', kind: 'steal' },
      { text: 'Drive the car to Sunset Garage', kind: 'goto', target: 'garage' },
    ],
  },
  {
    id: 'marina-drop',
    title: 'The Marina Drop',
    giver: 'Lena',
    brief: 'Lena left a package at the Marina. Collect it and run it to Club Lumen. Quietly.',
    reward: 1200,
    steps: [
      { text: 'Collect the package at the Marina', kind: 'pickup', target: 'marina' },
      { text: 'Deliver the package to Club Lumen', kind: 'goto', target: 'club' },
    ],
  },
  {
    id: 'bank-job',
    title: 'The Bay Bank Job',
    giver: 'The Crew',
    brief: 'Bay Trust Bank, broad daylight. Crack the vault, then lose the whole force at the Hideout.',
    reward: 3000,
    steps: [
      { text: 'Get to Bay Trust Bank', kind: 'goto', target: 'bank' },
      { text: 'Hold E at the bank door to crack the vault', kind: 'crack', target: 'bank' },
      { text: 'Escape to the Hideout — lose the police!', kind: 'goto', target: 'hideout' },
    ],
  },
];

export function createMissions() {
  return {
    index: 0, // 0..2 story, 3 = free-roam gigs
    step: 0,
    crackT: 0, // vault-cracking progress, seconds held
    gig: null, // {from:{x,y}, to:{x,y}, pickedUp:false}
    done: false,
    toast: '',
    toastT: 0,
  };
}

export function currentMission(missions) {
  if (missions.index < STORY.length) return STORY[missions.index];
  return null;
}

export function currentStep(missions) {
  const m = currentMission(missions);
  if (!m) return null;
  return m.steps[missions.step];
}

// Where the player should go right now, for the marker and the minimap.
export function currentTarget(missions, rng) {
  const m = currentMission(missions);
  if (m) {
    const step = m.steps[missions.step];
    if (step.kind === 'steal') return null; // any parked car counts
    return LANDMARKS[step.target];
  }
  if (missions.gig) {
    const g = missions.gig;
    return g.pickedUp ? g.to : g.from;
  }
  return null;
}

export function currentObjectiveText(missions) {
  const m = currentMission(missions);
  if (m) return `${m.title} — ${m.steps[missions.step].text}`;
  if (missions.gig) {
    return missions.gig.pickedUp
      ? 'Courier gig — deliver the package'
      : 'Courier gig — collect the package';
  }
  return 'Free roam — press M for a courier gig';
}

function startGig(missions, rng) {
  const spots = [
    { x: 700, y: 700, name: 'North Market' },
    { x: 1900, y: 700, name: 'Bay Plaza' },
    { x: 2500, y: 1300, name: 'East Docks' },
    { x: 700, y: 1300, name: 'Old Town' },
    { x: 1900, y: 2200, name: 'South Beach' },
    { x: 1300, y: 2200, name: 'Palm Row' },
  ];
  const from = pick(rng, spots);
  let to = pick(rng, spots);
  while (to === from) to = pick(rng, spots);
  missions.gig = { from, to, pickedUp: false, reward: 300 };
  missions.toast = `Courier gig: pick up at ${from.name}, deliver to ${to.name} — $300`;
  missions.toastT = 4;
}

// Advance the story. `ctx` carries {player, input, dt, rng, police,
// addWanted, onEvent}. Returns events: 'mission-complete' | 'pickup' |
// 'crack-done' | 'gig-complete'.
export function updateMissions(missions, ctx) {
  const events = [];
  const { player, input, dt } = ctx;
  missions.toastT = Math.max(0, missions.toastT - dt);

  const m = currentMission(missions);
  if (m) {
    const step = m.steps[missions.step];
    const target = step.target ? LANDMARKS[step.target] : null;
    const near = (r) => target && Math.hypot(player.x - target.x, player.y - target.y) < r;

    if (step.kind === 'steal') {
      if (player.inCar) {
        missions.step += 1;
        missions.toast = 'Nice wheels. Now get to the garage.';
        missions.toastT = 3;
      }
    } else if (step.kind === 'goto') {
      if (near(100)) {
        missions.step += 1;
        if (missions.step >= m.steps.length) {
          events.push('mission-complete');
        }
      }
    } else if (step.kind === 'pickup') {
      if (near(80)) {
        missions.step += 1;
        events.push('pickup');
        missions.toast = 'Package grabbed — the harbour patrol saw you!';
        missions.toastT = 3;
      }
    } else if (step.kind === 'crack') {
      if (near(90) && !player.inCar && input.down('KeyE')) {
        missions.crackT += dt;
        if (missions.crackT >= 4) {
          missions.crackT = 0;
          missions.step += 1;
          events.push('crack-done');
          missions.toast = 'Vault open! Every cop in Neon Bay is coming — run!';
          missions.toastT = 4;
        }
      } else {
        missions.crackT = Math.max(0, missions.crackT - dt * 2);
      }
    }
  } else if (missions.gig) {
    const g = missions.gig;
    const dest = g.pickedUp ? g.to : g.from;
    if (Math.hypot(player.x - dest.x, player.y - dest.y) < 90) {
      if (!g.pickedUp) {
        g.pickedUp = true;
        missions.toast = `Package collected — deliver it to ${g.to.name}.`;
        missions.toastT = 3;
      } else {
        missions.gig = null;
        events.push('gig-complete');
      }
    }
  } else if (input.wasPressed('KeyM')) {
    startGig(missions, ctx.rng);
  }

  return events;
}

// Called by the game when a mission completes: pay out and advance.
export function completeMission(missions) {
  const m = currentMission(missions);
  if (!m) return 0;
  missions.index += 1;
  missions.step = 0;
  missions.crackT = 0;
  missions.done = missions.index >= STORY.length;
  missions.toast = missions.done
    ? `Story complete! ${m.title} done — free roam now. Press M for courier gigs.`
    : `${m.title} complete — $${m.reward}. Next: ${STORY[missions.index].title}.`;
  missions.toastT = 5;
  return m.reward;
}
