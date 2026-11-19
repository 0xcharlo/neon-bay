// Neon Bay — the city itself: streets, blocks, buildings, beach, marina,
// park and the story landmarks. The world is one fixed layout so every
// system (traffic, police, missions, minimap) can agree on where things are.

import { makeRng, pick, rangeInt } from './rng.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 120;

// Vertical road centre lines and horizontal road centre lines.
export const V_ROADS = [400, 1000, 1600, 2200, 2800];
export const H_ROADS = [400, 1000, 1600, 2000];

// Story landmarks, by name, so missions and the minimap can find them.
export const LANDMARKS = {
  garage:  { name: 'Sunset Garage',  x: 700,  y: 1800, color: '#e8a33d' },
  marina:  { name: 'Marina',         x: 330,  y: 2150, color: '#3db8c9' },
  club:    { name: 'Club Lumen',     x: 1900, y: 1800, color: '#c94bd8' },
  bank:    { name: 'Bay Trust Bank', x: 2500, y: 700,  color: '#4d7dd1' },
  hideout: { name: 'Hideout',        x: 2500, y: 2200, color: '#7ac74f' },
  park:    { name: 'Palm Park',      x: 1300, y: 1300, color: '#58b368' },
  beach:   { name: 'Neon Beach',     x: 100,  y: 1200, color: '#e8d28a' },
  plaza:   { name: 'Bay Plaza',      x: 1900, y: 700,  color: '#d8c27a' },
};

// Palette of building face colours, sun-soaked and varied.
const BUILDING_COLORS = [
  '#f2e3c6', '#e8c9a0', '#d9a06b', '#c97e5a', '#b8c4cc',
  '#9fb8c8', '#f0d0d0', '#d8e6c8', '#e6c8d8', '#c8b8e0',
  '#f5f0e6', '#d0c8b8', '#a8c8b0', '#e0b8a0',
];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];

  // Blocks are the rectangles between the roads. Skip the blocks that hold
  // the park, the marina and the beach, and keep landmark plots clear.
  const vEdges = [0, ...V_ROADS, WORLD_W];
  const hEdges = [0, ...H_ROADS, WORLD_H];

  function roadSpan(edges, i) {
    return { a: edges[i] + ROAD_W / 2, b: edges[i + 1] - ROAD_W / 2 };
  }

  for (let bi = 0; bi < vEdges.length - 1; bi++) {
    for (let bj = 0; bj < hEdges.length - 1; bj++) {
      const spanX = roadSpan(vEdges, bi);
      const spanY = roadSpan(hEdges, bj);
      const cx = (spanX.a + spanX.b) / 2;
      const cy = (spanY.a + spanY.b) / 2;
      const w = spanX.b - spanX.a;
      const h = spanY.b - spanY.a;
      // The western strip is the beach; the south-west block is the marina.
      if (spanX.a < 200) continue;
      if (spanX.a < 520 && cy > 1900) continue; // marina basin and its quay
      if (cx > 1000 && cx < 1600 && cy > 1000 && cy < 1600) continue; // park
      // Leave a clear yard around each landmark building.
      const nearLandmark = Object.values(LANDMARKS).some(
        (lm) => Math.abs(lm.x - cx) < 260 && Math.abs(lm.y - cy) < 260 &&
          !(lm.name === 'Palm Park' || lm.name === 'Neon Beach'),
      );
      if (nearLandmark) {
        // One landmark building, placed on its plot.
        const lm = Object.values(LANDMARKS).find(
          (l) => Math.abs(l.x - cx) < 260 && Math.abs(l.y - cy) < 260,
        );
        buildings.push({
          x: lm.x - 70, y: lm.y - 55, w: 140, h: 110,
          color: lm.color, height: rangeInt(rng, 3, 6),
          roof: '#5a4a3a', landmark: lm.name,
        });
        continue;
      }
      // Ordinary block: one to four buildings with gaps between them.
      const count = rangeInt(rng, 1, 3);
      for (let k = 0; k < count; k++) {
        const bw = Math.min(w - 60, rangeInt(rng, 90, 200));
        const bh = Math.min(h - 60, rangeInt(rng, 80, 170));
        const bx = spanX.a + 30 + rng() * Math.max(1, w - 60 - bw);
        const by = spanY.a + 30 + rng() * Math.max(1, h - 60 - bh);
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: pick(rng, BUILDING_COLORS),
          height: rangeInt(rng, 1, 7),
          roof: '#6a5a48', landmark: null,
        });
      }
    }
  }

  // Park trees, as small circles the player can walk between.
  const trees = [];
  for (let i = 0; i < 46; i++) {
    trees.push({
      x: 1060 + rng() * 480, y: 1060 + rng() * 480,
      r: 12 + rng() * 10, shade: pick(rng, ['#3f9153', '#4da35e', '#35804a']),
    });
  }

  // Marina docks and moored boats (decorative, walkable docks are solid).
  const docks = [];
  for (let i = 0; i < 4; i++) {
    docks.push({ x: 230 + i * 60, y: 2050, w: 26, h: 170 });
  }

  return { buildings, trees, docks, seed };
}

// Is this point on a road (drivable, no building can be here)?
export function onRoad(x, y) {
  const onV = V_ROADS.some((rx) => Math.abs(x - rx) <= ROAD_W / 2);
  const onH = H_ROADS.some((ry) => Math.abs(y - ry) <= ROAD_W / 2);
  return onV || onH;
}

// Is this point on the beach sand or in the water?
export function onBeach(x) { return x < 200; }
export function inWater(x) { return x < 70; }

// Does a circle of radius r at (x, y) overlap a building, a dock, or the
// water? The water and the docks block movement; trees do not.
export function blockedAt(city, x, y, r) {
  if (x - r < 70 || x + r > WORLD_W - 10 || y - r < 10 || y + r > WORLD_H - 10) return true;
  if (x + r < 70) return true; // the sea
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  for (const d of city.docks) {
    if (x + r > d.x && x - r < d.x + d.w && y + r > d.y && y - r < d.y + d.h) return true;
  }
  return false;
}

// A random point on a road, for spawning traffic and parked cars.
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const rx = pick(rng, V_ROADS);
    return { x: rx + (rng() < 0.5 ? -30 : 30), y: 60 + rng() * (WORLD_H - 120) };
  }
  const ry = pick(rng, H_ROADS);
  return { x: 140 + rng() * (WORLD_W - 280), y: ry + (rng() < 0.5 ? -30 : 30) };
}

// A random sidewalk point near a road, for pedestrians.
export function randomWalkPoint(rng) {
  const p = randomRoadPoint(rng);
  return { x: p.x + (rng() < 0.5 ? -95 : 95), y: p.y + (rng() < 0.5 ? -95 : 95) };
}
