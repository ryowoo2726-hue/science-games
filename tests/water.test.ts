import { describe, expect, it } from 'vitest';
import { Water, filledCellPolygon, fillThreshold } from '../src/core/water';
import { gravityAt, type Stage } from '../src/types';
import stageData from '../src/stages/first-dive.json';

function tank(walls: Stage['walls'] = []): Stage {
  return {
    id: 'test', name: 'test', width: 240, height: 144, cellSize: 12, waterFraction: .5,
    start: { x: 48, y: 96 }, exit: { x: 192, y: 24, width: 24, height: 24 },
    walls: [
      { x: 0, y: 0, width: 240, height: 12 },
      { x: 0, y: 132, width: 240, height: 12 },
      { x: 0, y: 12, width: 12, height: 120 },
      { x: 228, y: 12, width: 12, height: 120 },
      ...walls,
    ], checkpoints: [],
  };
}

function centre(water: Water) {
  let x = 0, y = 0;
  water.mass.forEach((m, i) => { x += m * (i % water.cols); y += m * Math.floor(i / water.cols); });
  const mass = water.totalMass();
  return { x: x / mass, y: y / mass };
}

describe('conservative connected water', () => {
  it('starts with exactly half the void volume and a horizontal settled surface', () => {
    const water = new Water(stageData);
    const original = water.mass.slice();
    expect(water.totalMass()).toBeCloseTo(water.openCells * .5, 9);
    for (let n = 0; n < 100; n++) water.step(gravityAt(0));
    expect(Math.max(...water.mass.map((m, i) => Math.abs(m - original[i])))).toBeLessThan(1e-10);
  });

  it.each([-90, 0, 90])('settles toward gravity at %s degrees', angle => {
    const water = new Water(tank());
    for (let n = 0; n < 1800; n++) water.step(gravityAt(angle));
    const cm = centre(water);
    if (angle < 0) expect(cm.x).toBeLessThan(6);
    if (angle > 0) expect(cm.x).toBeGreaterThan(13);
    if (angle === 0) expect(cm.y).toBeGreaterThan(7);
    expect(water.totalMass()).toBeCloseTo(water.openCells * .5, 8);
  });

  it('conserves total mass and keeps solid cells dry during abrupt tilts', () => {
    const water = new Water(stageData);
    const original = water.totalMass();
    for (let n = 0; n < 800; n++) water.step(gravityAt([90, -90, 0, 63, -47][Math.floor(n / 31) % 5]));
    expect(water.totalMass()).toBeCloseTo(original, 7);
    water.mass.forEach((m, i) => {
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBeGreaterThanOrEqual(0);
      if (water.solid[i]) expect(m).toBe(0);
    });
  });

  it('never exchanges water across a sealed dividing wall', () => {
    const water = new Water(tank([{ x: 120, y: 12, width: 12, height: 120 }]));
    water.mass.fill(0);
    water.mass.forEach((_, i) => { if (!water.solid[i] && i % water.cols < 10) water.mass[i] = .55; });
    const original = water.totalMass();
    for (let n = 0; n < 1000; n++) water.step(gravityAt(n % 2 ? 90 : -90));
    expect(water.totalMass()).toBeCloseTo(original, 8);
    water.mass.forEach((m, i) => { if (i % water.cols > 10) expect(m).toBe(0); });
  });

  it('travels through an open passage around a wall', () => {
    const water = new Water(tank([{ x: 120, y: 12, width: 12, height: 84 }]));
    water.mass.fill(0);
    water.mass.forEach((_, i) => { if (!water.solid[i] && i % water.cols < 10) water.mass[i] = .55; });
    for (let n = 0; n < 900; n++) water.step(gravityAt(65));
    const rightMass = water.mass.reduce((sum, m, i) => sum + (i % water.cols > 10 ? m : 0), 0);
    expect(rightMass).toBeGreaterThan(15);
  });

  it('has a free surface perpendicular to diagonal gravity', () => {
    const water = new Water(tank());
    const g = gravityAt(35);
    for (let n = 0; n < 20000; n++) water.step(g);
    const heads: number[] = [];
    water.mass.forEach((m, i) => {
      if (!water.solid[i] && m > .1 && m < .9) {
        heads.push(m - ((i % water.cols) * g.x + Math.floor(i / water.cols) * g.y));
      }
    });
    expect(heads.length).toBeGreaterThan(8);
    expect(Math.max(...heads) - Math.min(...heads)).toBeLessThan(.08);
  });

  it.each([0, 30, 45, 90, -90])('renders the same fractional cell area at %s degrees', angle => {
    const g = gravityAt(angle);
    for (const fraction of [.1, .35, .5, .8]) {
      const p = filledCellPolygon(fraction, g);
      const area = Math.abs(p.reduce((sum, a, i) => {
        const b = p[(i + 1) % p.length];
        return sum + a.x * b.y - b.x * a.y;
      }, 0)) / 2;
      expect(area).toBeCloseTo(fraction, 8);
      expect(Number.isFinite(fillThreshold(fraction, g))).toBe(true);
    }
  });
});
