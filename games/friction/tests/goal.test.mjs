import test from 'node:test';
import assert from 'node:assert/strict';
import { STOP, insideGoal, updateGoal } from '../src/physics/Goal.js';
import { stages, stageLayout } from '../src/stages.js';
const ball = (x = 0, speed = 0) => ({ position: { x, y: 0 }, circleRadius: 20, velocity: { x: speed, y: 0 }, angularVelocity: 0 });
test('passing through the goal while moving never clears on any stage', () => {
  for (const stage of stages) {
    const body = ball(0, .2);
    body.vertices = [{ x: -54, y: -22 }, { x: 54, y: -22 }, { x: 54, y: 22 }, { x: -54, y: 22 }];
    assert.equal(updateGoal(body, [0, 0], stage.radius, stage.box, 790, 20), 0);
  }
});
test('resting entirely inside the goal accumulates the full hold time', () => {
  let elapsed = 0; for (let i = 0; i < 50; i++) elapsed = updateGoal(ball(), [0, 0], 68, false, elapsed, 16);
  assert.equal(elapsed, STOP.holdMs);
  assert.equal(updateGoal(ball(0, .1), [0, 0], 68, false, elapsed, 16), 0);
  assert.equal(updateGoal(ball(60), [0, 0], 68, false, elapsed, 16), 0);
});
test('a rotating box or partially overlapping object cannot clear', () => {
  const body = { ...ball(), vertices: [{ x: -54, y: -22 }, { x: 54, y: -22 }, { x: 54, y: 22 }, { x: -54, y: 22 }], angularVelocity: .001 };
  assert.equal(updateGoal(body, [0, 0], 92, true, 790, 20), 0);
  body.angularVelocity = 0;
  assert.equal(updateGoal(body, [0, 0], 92, true, 790, 20), 810);
  body.vertices[0].x = -100;
  assert.equal(insideGoal(body, [0, 0], 92, true), false);
});
test('ten distinct stages place goals clear of walls and inside all screen layouts', () => {
  assert.equal(stages.length, 10); assert.equal(new Set(stages.map(s => s.title)).size, 10);
  for (const [width, height] of [[832, 480], [832, 624], [832, 1109]]) for (const stage of stages) {
    const { spawn, target, walls } = stageLayout(stage, width, height);
    const clearance = stage.box ? Math.hypot(54, 22) : 20;
    assert.ok(stage.radius > clearance);
    for (const [x, y] of [spawn, target]) {
      assert.ok(x > clearance && x < width - clearance && y > clearance && y < height - clearance);
      for (const wall of walls) {
        const dx = Math.max(Math.abs(x - wall.x) - wall.width / 2, 0), dy = Math.max(Math.abs(y - wall.y) - wall.height / 2, 0);
        assert.ok(Math.hypot(dx, dy) > clearance, `${stage.title}: start/goal intersects wall`);
      }
    }
  }
  assert.ok(stages[7].gate.gap > stages[8].gate.gap && stages[8].gate.gap > stages[9].gate.gap);
});
test('every stage has an interior route, including box turns before narrow gates', () => {
  for (const [width, height] of [[832, 480], [832, 1109]]) for (const stage of stages) {
    const { spawn, target, walls } = stageLayout(stage, width, height);
    const step = 8;
    const clear = (x, y, orientation, turning = false) => {
      const hw = stage.box ? (turning ? 59 : orientation ? 22 : 54) : 20;
      const hh = stage.box ? (turning ? 59 : orientation ? 54 : 22) : 20;
      return x >= hw && x <= width - hw && y >= hh && y <= height - hh && walls.every(w => Math.abs(x - w.x) >= hw + w.width / 2 || Math.abs(y - w.y) >= hh + w.height / 2);
    };
    const queue = [[Math.round(spawn[0] / step) * step, Math.round(spawn[1] / step) * step, 0]];
    const seen = new Set(); let found = false;
    for (let index = 0; index < queue.length; index++) {
      const [x, y, a] = queue[index], key = `${x},${y},${a}`;
      if (seen.has(key) || !clear(x, y, a)) continue;
      seen.add(key);
      if (Math.hypot(x - target[0], y - target[1]) <= stage.radius - (stage.box ? 59 : 20)) { found = true; break; }
      queue.push([x + step, y, a], [x - step, y, a], [x, y + step, a], [x, y - step, a]);
      if (stage.box && clear(x, y, a, true)) queue.push([x, y, 1 - a]);
    }
    assert.ok(found, `${stage.title}: no route at ${width}×${height}`);
  }
});
