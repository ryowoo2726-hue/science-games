import { describe, expect, it } from 'vitest';
import { stages } from '../src/stages';
import { Game } from '../src/game/game';
import { Water } from '../src/core/water';
import { escapePath, puzzlePlan } from './support/path';

describe('eleven progressively harder stages', () => {
  it('contains the original and ten distinct increasingly difficult mazes', () => {
    expect(stages.length).toBe(11);
    expect(new Set(stages.map(s => s.id)).size).toBe(11);
    expect(new Set(stages.map(s => JSON.stringify(s.walls))).size).toBe(11);
    expect(stages.map(s => s.difficulty)).toEqual([1,2,3,4,5,6,7,8,9,10,11]);
    expect(new Set(stages.map(s => `${s.start.x},${s.start.y}`)).size).toBeGreaterThan(6);
    expect(stages.some(s => s.start.x > s.exit.x)).toBe(true);
    expect(stages[10].doors).toHaveLength(3);
  });
  it.each(stages)('has a hull-sized route through $id', stage => {
    const plan = puzzlePlan(stage);
    expect(plan.pressed.size).toBe(stage.switches?.length ?? 0);
    expect(plan.open.size).toBe(stage.doors?.length ?? 0);
    expect(plan.legs.every(leg => leg.path.length > 0)).toBe(true);
    const water = new Water(stage);
    expect(water.isSolidAt(stage.start.x, stage.start.y)).toBe(false);
    expect(water.totalMass()).toBeCloseTo(water.openCells * stage.waterFraction, 8);
    expect(water.count).toBeGreaterThan(1000);
  });
  it('makes switches necessary and gives every damaged stage a safe repair station', () => {
    for (const stage of stages) {
      if (stage.doors?.length) expect(escapePath(stage, [...stage.walls, ...stage.doors])).toHaveLength(0);
      for (const door of stage.doors ?? []) {
        expect(door.switches.length).toBeGreaterThan(0);
        expect(door.switches.every(id => stage.switches?.some(button => button.id === id))).toBe(true);
      }
      if (stage.spikes?.length) expect(stage.repairs?.length).toBeGreaterThan(0);
      for (const pad of stage.repairs ?? []) {
        expect(stage.walls.some(w => pad.x < w.x + w.width && pad.x + pad.width > w.x && pad.y < w.y + w.height && pad.y + pad.height > w.y)).toBe(false);
      }
    }
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
