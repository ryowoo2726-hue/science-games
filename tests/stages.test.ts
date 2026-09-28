import { describe, expect, it } from 'vitest';
import { stages } from '../src/stages';
import { Game } from '../src/game/game';
import { Water } from '../src/core/water';
import { escapePath } from './support/path';

describe('eleven progressively harder stages', () => {
  it('contains the original and ten distinct increasingly difficult mazes', () => {
    expect(stages.length).toBe(11);
    expect(new Set(stages.map(s => s.id)).size).toBe(11);
    expect(new Set(stages.map(s => JSON.stringify(s.walls))).size).toBe(11);
    expect(stages.map(s => s.difficulty)).toEqual([1,2,3,4,5,6,7,8,9,10,11]);
    expect(stages[10].checkpoints.length).toBeGreaterThan(stages[0].checkpoints.length);
  });
  it.each(stages)('has a hull-sized route through $id', stage => {
    const path = escapePath(stage);
    expect(path.length).toBeGreaterThan(2);
    const water = new Water(stage);
    expect(water.isSolidAt(stage.start.x, stage.start.y)).toBe(false);
    expect(water.totalMass()).toBeCloseTo(water.openCells * stage.waterFraction, 8);
    expect(water.count).toBeGreaterThan(1000);
  });
  it('starts the next stage with fresh physics and preserves the sensor controller', () => {
    const game = new Game(stages[0], stages), tilt = game.tilt, previousWater = game.water;
    game.status = 'won'; game.elapsed = 80; game.nextStage();
    expect(game.stageIndex).toBe(1); expect(game.status).toBe('playing'); expect(game.elapsed).toBe(0);
    expect(game.water).not.toBe(previousWater); expect(game.tilt).toBe(tilt);
    expect(game.submarine.body.position).toEqual(stages[1].start);
    game.selectStage(10); expect(game.stageIndex).toBe(10); expect(game.status).toBe('ready');
    game.status = 'won'; game.nextStage(); expect(game.stageIndex).toBe(10);
  });
  it('introduces high-density liquid, then low-density liquid and greater contrasts', () => {
    expect(stages[4].densityZones?.some(z => z.density > 1)).toBe(true);
    expect(stages[5].densityZones?.some(z => z.density < 1)).toBe(true);
    expect(Math.max(...stages[10].densityZones!.map(z => z.density))).toBeGreaterThan(Math.max(...stages[4].densityZones!.map(z => z.density)));
  });
});
