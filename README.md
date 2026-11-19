# Neon Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xcharlo/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xcharlo/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01)

**Neon Bay** is an original open-world crime game for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01): a sun-soaked coastal city you explore on foot and by car, with traffic, pedestrians, a wanted level and police who respond, three story missions, combat, and a HUD with a minimap — all in plain static files that run in desktop Chrome with no network requests.

## The story

Mara Voss rolls into Neon Bay with empty pockets and a fast mouth. Rico, Lena and the Crew have work for her — if she can stay out of jail.

1. **Hot Wheels** — steal a car and bring it to Sunset Garage.
2. **The Marina Drop** — collect a package at the Marina and run it to Club Lumen, quietly.
3. **The Bay Bank Job** — crack the vault at Bay Trust Bank, then lose the whole police force at the Hideout.

After the story, courier gigs keep the cash coming. Progress and cash save on your computer.

## How to play

Serve `game/` with any static server (for example `node serve.ts`, then open http://localhost:8080) and play with keyboard and mouse:

- **WASD / arrows** — move on foot, drive when in a car
- **E** — steal / enter a car, step out again
- **Click / Space** — shoot (aim with the mouse)
- **R** — reload, **Shift** — run, **P** — pause, **M** — courier gig, **N** — mute

Crimes raise your wanted level (up to 5 stars). Police cars chase a driver; officers on foot chase a pedestrian. Stay quiet and out of sight and the heat cools down. Getting caught means BUSTED; losing all health means WASTED.

## What is in the game

- A hand-built city: streets, beach, marina, park, plaza, bank, club, garage and hideout
- Traffic that drives the road grid, pedestrians who flee gunfire and speeding cars
- Wanted system with police cars and foot officers, busted/wasted endings
- Shooting with ammo, reload, muzzle flashes and impacts
- Synthesized sound (engine, sirens, gunshots, mission stings) — no audio files
- HUD with wanted stars, health, cash, ammo, speed and a live minimap
- Save via localStorage; screenshots staged with `?shot=cover|street|mission|title`

## Layout

- `game/` — the game itself: `index.html` plus `src/` modules, one job each
  - `city.js` — the map, `vehicles.js` — cars and traffic, `peds.js` — pedestrians
  - `player.js` — Mara on foot and behind the wheel, `police.js` — wanted level
  - `combat.js` — bullets and particles, `missions.js` — the story jobs
  - `render.js` — camera, world, HUD and minimap, `audio.js` — synthesized sound
  - `input.js` — keyboard and mouse, `save.js` — localStorage, `shots.js` — screenshot staging
- `screenshots/` — real renders of the game running in a browser
- `main.ts` — copies `game/` and `screenshots/` to the output and writes the dossier
- `serve.ts` — a tiny static server for local playtesting

Everything in `game/` is original work written for this entry. No assets, names, characters or music are taken from any commercial game.
