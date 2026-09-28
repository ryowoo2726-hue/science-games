import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import stage from '../src/stages/first-dive.json';
import { escapePath } from './support/path';

describe('escape mission', () => {
  it('is playable using only tilt and the two tank controls', () => {
    const game = new Game(stage);
    game.start();
    const path = escapePath(stage);
    let phase = 1;
    const log: { phase: number; seconds: number; x: number; y: number; tank: number; wet: number }[] = [];
    for (let n = 0; n < 18000 && game.status !== 'won'; n++) {
      const pos = game.submarine.body.position;
      const sub = game.submarine;
      const target = path[Math.min(phase, path.length - 1)];
      const dx = target.x - pos.x, dy = target.y - pos.y;
      if (Math.hypot(dx, dy) < 18 && phase < path.length - 1) phase++;
      game.tankDirection = 1;
      const steerX = dx * 2 - sub.body.velocity.x * 60 * .7;
      const steerY = dy * 2 - sub.body.velocity.y * 60 * .7;
      game.tilt.setManual(Math.atan2(steerX, steerY) * 180 / Math.PI);
      game.step();
      if (n % 1800 === 0 || log[log.length - 1]?.phase !== phase) {
        log.push({ phase, seconds: +game.elapsed.toFixed(1), x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), tank: +sub.tank.toFixed(2), wet: +sub.submerged.toFixed(2) });
      }
    }
    expect(game.status, JSON.stringify(log)).toBe('won');
    expect(game.completedGates).toBe(3);
    expect(game.elapsed).toBeLessThan(180);
    expect(game.water.totalMass()).toBeCloseTo(game.water.openCells * .5, 7);
  }, 120000); // Simulates a complete escape with continuous liquid and 360° steering.

  it('does not advance time or physics when paused and restarts cleanly', () => {
    const game = new Game(stage);
    game.start();
    game.tankDirection = 1;
    for (let n = 0; n < 60; n++) game.step();
    game.togglePause();
    const elapsed = game.elapsed;
    const pos = { ...game.submarine.body.position };
    const tank = game.submarine.tank;
    for (let n = 0; n < 60; n++) game.step();
    expect(game.elapsed).toBe(elapsed);
    expect(game.submarine.body.position).toEqual(pos);
    expect(game.submarine.tank).toBe(tank);
    expect(game.tankDirection).toBe(0);
    game.reset();
    expect(game.status).toBe('ready');
    expect(game.elapsed).toBe(0);
    expect(game.submarine.tank).toBe(.5);
    expect(game.water.totalMass()).toBeCloseTo(game.water.openCells * .5, 8);
  });
});
