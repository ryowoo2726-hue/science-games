import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';
import { SubmarinePhysics, forceBalance, relativeDensity } from '../src/core/submarine';
import { Water } from '../src/core/water';
import { gravityAt, type Stage } from '../src/types';
import { screenTilt } from '../src/input/orientation';
import stageData from '../src/stages/first-dive.json';

describe('fixed-volume buoyancy', () => {
  it('uses the specified density values and partial immersion', () => {
    expect(relativeDensity(0)).toBeCloseTo(.65);
    expect(relativeDensity(.5)).toBeCloseTo(1);
    expect(relativeDensity(1)).toBeCloseTo(1.35);
    expect(forceBalance(0, 1).net).toBeLessThan(0);
    expect(forceBalance(.5, 1).net).toBe(0);
    expect(forceBalance(1, 1).net).toBeGreaterThan(0);
    expect(forceBalance(0, .65).net).toBeCloseTo(0);
    expect(forceBalance(.5, .5).buoyancy).toBe(.5);
    expect(forceBalance(0, 0).buoyancy).toBe(0);
  });

  it.each([[0, -1], [.5, 0], [1, 1]])('moves with the correct force for tank %s', (tank, direction) => {
    const stage: Stage = { ...stageData, waterFraction: 1, start: { x: 432, y: 420 } };
    const water = new Water(stage);
    const physics = new SubmarinePhysics(stage);
    physics.tank = tank;
    const startY = physics.body.position.y;
    for (let n = 0; n < 30; n++) physics.step(water, gravityAt(0), 0);
    const dy = physics.body.position.y - startY;
    if (direction === 0) expect(Math.abs(dy)).toBeLessThan(.01);
    else expect(dy * direction).toBeGreaterThan(5);
  });

  it('changes only the internal tank and clamps endpoints', () => {
    const water = new Water(stageData);
    const physics = new SubmarinePhysics(stageData);
    const volume = physics.body.area;
    const externalWater = water.totalMass();
    physics.updateTank(1, 10);
    expect(physics.tank).toBe(1);
    expect(physics.body.mass).toBeCloseTo(6 * 1.35);
    physics.updateTank(-1, 10);
    expect(physics.tank).toBe(0);
    expect(physics.body.area).toBe(volume);
    expect(water.totalMass()).toBe(externalWater);
  });

  it('does not tunnel through a wall at maximum gravity', () => {
    const water = new Water(stageData);
    const physics = new SubmarinePhysics(stageData);
    Matter.Body.setPosition(physics.body, { x: 220, y: 120 });
    physics.tank = 1;
    for (let n = 0; n < 360; n++) physics.step(water, gravityAt(90), 0);
    expect(physics.body.bounds.max.x).toBeLessThan(289);
    expect(physics.body.position.x).toBeLessThan(288);
  });

  it('resets velocity, density and position', () => {
    const physics = new SubmarinePhysics(stageData);
    physics.updateTank(1, 2);
    Matter.Body.setVelocity(physics.body, { x: 2, y: 1 });
    physics.reset();
    expect(physics.tank).toBe(.5);
    expect(physics.body.position).toEqual(stageData.start);
    expect(physics.body.velocity).toEqual({ x: 0, y: 0 });
  });
});

describe('orientation projection', () => {
  it('maps portrait and both landscape directions correctly', () => {
    expect(screenTilt(0, 30, 0)).toBeCloseTo(30);
    expect(screenTilt(30, 0, 90)).toBeCloseTo(30);
    expect(screenTilt(30, 0, 270)).toBeCloseTo(-30);
    expect(screenTilt(0, 30, 180)).toBeCloseTo(-30);
    expect(screenTilt(90, 0, 90)).toBeCloseTo(90);
    expect(screenTilt(-90, 0, 90)).toBeCloseTo(-90);
  });
});
