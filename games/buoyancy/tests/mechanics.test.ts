import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { Water } from '../src/core/water';
import { SubmarinePhysics, FIXED_STEP, LEAK_DURATION, LEAK_RATE, forceBalance } from '../src/core/submarine';
import { Game } from '../src/game/game';
import type { Stage } from '../src/types';
import { stages } from '../src/stages';
import { puzzlePlan } from './support/path';

const room: Stage = {
  id: 'test-gate', name: '수문', width: 312, height: 192, cellSize: 12, waterFraction: .5,
  start: { x: 60, y: 144 }, exit: { x: 252, y: 120, width: 36, height: 48 }, checkpoints: [],
  walls: [
    { x: 0, y: 0, width: 312, height: 12 }, { x: 0, y: 180, width: 312, height: 12 },
    { x: 0, y: 12, width: 12, height: 168 }, { x: 300, y: 12, width: 12, height: 168 },
    { x: 144, y: 12, width: 12, height: 48 }, { x: 144, y: 132, width: 12, height: 48 },
  ],
  switches: [{ id: 'A', label: 'A', x: 60, y: 48 }],
  doors: [{ id: 'A', label: 'A', x: 144, y: 60, width: 12, height: 72, switches: ['A'] }],
  densityZones: [{ x: 12, y: 12, width: 132, height: 168, density: .85, label: '가벼운 물' }],
};

describe('spikes, leaks and repair docks', () => {
  it('loses tank water, lowers density and rises after damage, even against the pump', () => {
    const sub = new SubmarinePhysics(room);
    sub.tank = 1;
    expect(sub.hitSpike()).toBe(true);
    expect(sub.tank).toBe(.4);
    expect(sub.leakRemaining).toBe(LEAK_DURATION);
    expect(forceBalance(sub.tank, 1).net).toBeLessThan(0);
    const damaged = sub.tank;
    sub.updateTank(1, 1);
    expect(sub.tank).toBeLessThan(damaged);
    expect(sub.hitSpike()).toBe(false);
    sub.updateTank(0, LEAK_DURATION);
    expect(sub.tank).toBe(0); expect(sub.leakRemaining).toBe(0);
    sub.updateTank(1, 1); expect(sub.tank).toBeGreaterThan(0);
    expect(LEAK_RATE).toBeGreaterThan(.26);
  });

  it('detects a physical spike collision and repairs by entering the green dock', () => {
    const game = new Game({ ...room,
      spikes: [{ x: 60, y: 168, width: 72, height: 12, direction: 'up' }],
      repairs: [{ x: 24, y: 24, width: 72, height: 36 }],
    });
    game.start(); game.submarine.tank = .9;
    Matter.Body.setPosition(game.submarine.body, { x: 96, y: 164 });
    game.step();
    expect(game.submarine.touchingSpike).toBe(true);
    expect(game.submarine.leakRemaining).toBe(LEAK_DURATION);
    expect(game.submarine.tank).toBeLessThan(.5);
    expect(game.message).toContain('누수');
    game.togglePause();
    for (let i = 0; i < 60; i++) game.step();
    expect(game.submarine.leakRemaining).toBe(LEAK_DURATION);
    game.togglePause();
    Matter.Body.setPosition(game.submarine.body, { x: 60, y: 42 });
    Matter.Body.setVelocity(game.submarine.body, { x: 0, y: 0 });
    game.step();
    expect(game.submarine.leakRemaining).toBe(0);
    expect(game.message).not.toContain('누수로');
    game.submarine.updateTank(1, FIXED_STEP);
    expect(game.submarine.leakRemaining).toBe(0);
  });

  it('repair stops the leak immediately and restart restores an undamaged tank', () => {
    const sub = new SubmarinePhysics(room);
    sub.hitSpike(); sub.updateTank(0, .5);
    expect(sub.repair()).toBe(true);
    const tank = sub.tank;
    sub.updateTank(0, 1); expect(sub.tank).toBe(tank);
    expect(sub.repair()).toBe(false);
    sub.reset(); expect(sub.tank).toBe(.5); expect(sub.leakRemaining).toBe(0);
  });
});

describe('switch-controlled watertight doors', () => {
  it('blocks liquid while closed, then flows through without replacing particles or material', () => {
    const water = new Water(room);
    water.reset({ x: 24, y: 84, width: 108, height: 84 });
    const volume = water.totalMass(), material = water.totalMaterialMass(), count = water.count;
    for (let n = 0; n < 120; n++) water.step({ x: 1, y: 0 });
    expect([...water.x.slice(0, count)].some(x => x > 144)).toBe(false);
    const before = { x: water.x.slice(0, count), y: water.y.slice(0, count), vx: water.vx.slice(), material: water.material.slice() };
    water.openDoors(new Set(['A']));
    expect(water.isSolidAt(150, 96)).toBe(false);
    expect(water.x.slice(0, count)).toEqual(before.x); expect(water.y.slice(0, count)).toEqual(before.y);
    expect(water.vx).toEqual(before.vx); expect(water.material).toEqual(before.material);
    for (let n = 0; n < 240; n++) water.step({ x: 1, y: 0 });
    expect([...water.x.slice(0, count)].some(x => x > 160)).toBe(true);
    expect(water.count).toBe(count); expect(water.totalMass()).toBe(volume);
    expect(water.totalMaterialMass()).toBeCloseTo(material, 8);
    expect(water.mass.reduce((sum, value) => sum + value, 0)).toBeCloseTo(volume, 8);
  });

  it('requires both pressure switches and opens both the rigid and liquid barriers', () => {
    const game = new Game({ ...room,
      switches: [...room.switches!, { id: 'B', label: 'B', x: 108, y: 48 }],
      doors: [{ ...room.doors![0], switches: ['A', 'B'] }],
    });
    const door = game.submarine.doors.get('A')!, volume = game.water.totalMass();
    game.start();
    Matter.Body.setPosition(game.submarine.body, { x: 60, y: 48 }); game.step();
    expect(game.pressedSwitches.has('A')).toBe(true); expect(game.openedDoors.size).toBe(0);
    expect(game.water.isSolidAt(150, 96)).toBe(true);
    expect(Matter.Composite.get(game.submarine.engine.world, door.id, 'body')).toBe(door);
    Matter.Body.setPosition(game.submarine.body, { x: 108, y: 48 }); game.step();
    expect(game.pressedSwitches.size).toBe(2); expect(game.openedDoors.has('A')).toBe(true);
    expect(game.water.isSolidAt(150, 96)).toBe(false);
    expect(Matter.Composite.get(game.submarine.engine.world, door.id, 'body')).toBeNull();
    expect(game.water.totalMass()).toBe(volume);
    game.reset();
    expect(game.pressedSwitches.size).toBe(0); expect(game.openedDoors.size).toBe(0);
    expect(game.water.isSolidAt(150, 96)).toBe(true);
    expect(Matter.Composite.get(game.submarine.engine.world, door.id, 'body')).toBe(door);
  });

  it('does not finish a locked puzzle when the hull is placed at the exit', () => {
    const game = new Game(room); game.start();
    Matter.Body.setPosition(game.submarine.body, { x: 270, y: 144 }); game.step();
    expect(game.status).toBe('playing');
  });

  it.each([stages[2], stages[3], stages[10]])('escapes $name using tilt, tank controls and real liquid physics', stage => {
    const game = new Game(stage); game.start();
    const plan = puzzlePlan(stage), targets = plan.legs.flatMap(leg => leg.path.slice(1));
    let phase = 0;
    for (let n = 0; n < 18000 && game.status !== 'won'; n++) {
      const sub = game.submarine, pos = sub.body.position;
      const target = targets[Math.min(phase, targets.length - 1)];
      const dx = target.x - pos.x, dy = target.y - pos.y;
      if (Math.hypot(dx, dy) < 18 && phase < targets.length - 1) phase++;
      game.tankDirection = 1;
      // A damaged floating hull accelerates opposite gravity; compensate with tilt.
      const sign = sub.forces.net < -.03 ? -1 : 1;
      game.tilt.setManual(Math.atan2((dx * 2 - sub.body.velocity.x * 60 * .7) * sign, (dy * 2 - sub.body.velocity.y * 60 * .7) * sign) * 180 / Math.PI);
      game.step();
    }
    expect(game.status, `phase ${phase}/${targets.length}, position ${JSON.stringify(game.submarine.body.position)}`).toBe('won');
    expect(game.openedDoors.size).toBe(stage.doors?.length ?? 0);
    expect(game.elapsed).toBeLessThan(240);
    expect(game.water.totalMass()).toBeCloseTo(game.water.openCells * stage.waterFraction, 8);
  }, 120000);
});
