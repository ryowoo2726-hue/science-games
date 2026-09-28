import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import stage from '../src/stages/first-dive.json';

describe('escape mission', () => {
  it('is playable using only tilt and the two tank controls', () => {
    const game = new Game(stage);
    game.start();
    let phase = 0;
    const log: { phase: number; seconds: number; x: number; y: number; tank: number; wet: number }[] = [];
    for (let n = 0; n < 18000 && game.status !== 'won'; n++) {
      const pos = game.submarine.body.position;
      const sub = game.submarine;
      if (phase === 0) {
        game.tilt.target = 38;
        game.tankDirection = 1;
        if (pos.x > 430) phase++;
      } else if (phase === 1) {
        game.tilt.target = 0;
        game.tankDirection = -1;
        if (pos.y < 326 && sub.tank === 0) phase++;
      } else if (phase === 2) {
        game.tilt.target = 90;
        game.tankDirection = 1;
        if (pos.x > 702) phase++;
      } else if (phase === 3) {
        game.tilt.target = 38;
        game.tankDirection = 1;
        if (pos.x > 1042) phase++;
      } else {
        game.tilt.target = 0;
        game.tankDirection = -1;
      }
      game.step();
      if (n % 1800 === 0 || log[log.length - 1]?.phase !== phase) {
        log.push({ phase, seconds: +game.elapsed.toFixed(1), x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), tank: +sub.tank.toFixed(2), wet: +sub.submerged.toFixed(2) });
      }
    }
    expect(game.status, JSON.stringify(log)).toBe('won');
    expect(game.completedGates).toBe(3);
    expect(game.elapsed).toBeLessThan(180);
    expect(game.water.totalMass()).toBeCloseTo(game.water.openCells * .5, 7);
  }, 30000); // Simulates a complete escape, rather than just a few frames.

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
