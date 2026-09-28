import { describe, expect, it } from 'vitest';
import { Water } from '../src/core/water';
import { gravityAt, type Stage } from '../src/types';
import maze from '../src/stages/first-dive.json';

export function tank(walls: Stage['walls'] = []): Stage {
  return { ...maze, id: 'tank', width: 240, height: 144, walls: [
    { x: 0, y: 0, width: 240, height: 12 }, { x: 0, y: 132, width: 240, height: 12 },
    { x: 0, y: 12, width: 12, height: 120 }, { x: 228, y: 12, width: 12, height: 120 }, ...walls,
  ], checkpoints: [] };
}
function center(w: Water) {
  return { x: w.x.slice(0, w.count).reduce((sum, x) => sum + x, 0) / w.count, y: w.y.slice(0, w.count).reduce((sum, y) => sum + y, 0) / w.count };
}

describe('continuous particle liquid', () => {
  it('starts with half the open volume and conserves each fluid particle', () => {
    const w = new Water(maze), count = w.count, volume = w.totalMass();
    expect(volume).toBeCloseTo(w.openCells * .5, 9);
    for (let n = 0; n < 360; n++) w.step(gravityAt([90, -90, 180, 270, 0][Math.floor(n / 24) % 5]));
    expect(w.count).toBe(count); expect(w.totalMass()).toBe(volume);
    expect(w.mass.reduce((s, m) => s + m, 0)).toBeCloseTo(volume, 7);
    for (let i = 0; i < count; i++) {
      expect(Number.isFinite(w.x[i] + w.y[i] + w.vx[i] + w.vy[i])).toBe(true);
      expect(w.isSolidAt(w.x[i], w.y[i])).toBe(false);
    }
    w.mass.forEach((m, i) => { expect(m).toBeGreaterThanOrEqual(0); if (w.solid[i]) expect(m).toBe(0); });
  }, 30000);

  it.each([-90, 0, 90, 180, 270])('settles toward gravity at %s degrees', angle => {
    const w = new Water(tank());
    for (let n = 0; n < 600; n++) w.step(gravityAt(angle));
    const p = center(w);
    if (angle === 90) expect(p.x).toBeGreaterThan(156);
    if (angle === -90 || angle === 270) expect(p.x).toBeLessThan(84);
    if (angle === 0) expect(p.y).toBeGreaterThan(90);
    if (angle === 180) expect(p.y).toBeLessThan(54);
  });

  it('responds promptly, retains inertia and does not jump between states', () => {
    const w = new Water(tank()); const before = center(w).x;
    const x = w.x.slice(); w.step(gravityAt(90));
    expect(w.previousX).toEqual(x);
    expect(center(w).x - before).toBeLessThan(3);
    for (let n = 1; n < 90; n++) w.step(gravityAt(90));
    expect(center(w).x).toBeGreaterThan(before + 36);
    const oldVx = w.vx[20]; w.step(gravityAt(-90));
    expect(Math.abs(w.vx[20] - oldVx)).toBeLessThan(150);
  });

  it('keeps a settled liquid interior continuous instead of creating isolated dry cells', () => {
    const w = new Water(tank());
    for (let n = 0; n < 240; n++) w.step(gravityAt(0));
    for (let y = 104; y <= 116; y += 3) for (let x = 42; x <= 198; x += 3) expect(w.fractionAt(x, y)).toBeGreaterThan(.99);
    // Surface coverage is a continuous function even across old 12px cell edges.
    for (let y = 72; y < 110; y++) {
      expect(Math.abs(w.fractionAt(119.9, y) - w.fractionAt(120.1, y))).toBeLessThan(.04);
    }
  });

  it('never transfers particles or their visible liquid through a sealed wall', () => {
    const w = new Water(tank([{ x: 120, y: 12, width: 12, height: 120 }]));
    w.reset({ x: 12, y: 72, width: 108, height: 60 });
    const volume = w.totalMass();
    for (let n = 0; n < 360; n++) w.step(gravityAt(n < 180 ? 90 : 180));
    expect(Math.max(...w.x.slice(0, w.count))).toBeLessThan(120);
    expect(w.totalMass()).toBe(volume);
    for (let y = 18; y < 132; y += 6) expect(w.fractionAt(138, y)).toBe(0);
    w.buildSurface();
    for (let row = 3; row < 22; row++) expect(w.field[row * w.fieldCols + 23]).toBe(0);
  });

  it('flows through an open passage while preserving volume', () => {
    const w = new Water(tank([{ x: 120, y: 12, width: 12, height: 84 }]));
    w.reset({ x: 12, y: 72, width: 108, height: 60 });
    const count = w.count;
    for (let n = 0; n < 360; n++) w.step(gravityAt(70));
    expect(w.x.slice(0, w.count).filter(x => x > 132).length).toBeGreaterThan(count * .3);
  });

  it('advects density with the liquid and conserves material mass when the liquids mix', () => {
    const w = new Water({ ...tank(), waterFraction: 1, densityZones: [{ x: 12, y: 12, width: 108, height: 120, density: 1.2, label: 'dense' }] });
    const mass = w.totalMaterialMass(), original = w.material.slice();
    expect(w.sample(48, 72).density).toBeCloseTo(1.2, 6);
    expect(w.sample(192, 72).density).toBeCloseTo(1, 6);
    for (let n = 0; n < 180; n++) w.step(gravityAt(n < 90 ? 90 : 180));
    expect(w.material).toEqual(original);
    expect(w.totalMaterialMass()).toBeCloseTo(mass, 8);
    const mixed = w.sample(120, 72).density;
    expect(mixed).toBeGreaterThanOrEqual(1); expect(mixed).toBeLessThanOrEqual(1.2 + 1e-10);
  });
});
