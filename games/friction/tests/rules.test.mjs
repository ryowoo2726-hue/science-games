import test from 'node:test';
import assert from 'node:assert/strict';
import { FrictionField } from '../src/physics/SurfacePhysics.js';
import { makeRuleState, updateRules, goalReady } from '../src/systems/StageRules.js';
import { stages, stageLayout } from '../src/stages.js';
const ball = (x, y, speed = 0) => ({ position: { x, y }, velocity: { x: speed, y: 0 }, angularVelocity: 0, angle: 0, circleRadius: 20 });
test('fixed ice and rubber cannot be painted, but editable exceptions can', () => {
  const field = new FrictionField(.5); field.zones = stageLayout(stages[0], 832, 480).zones;
  for (let i = 0; i < 80; i++) { field.paint(144, 240, 'hand', .1); field.paint(650, 240, 'hand', .1); }
  assert.ok(field.at(144, 240) < .01); assert.equal(field.at(650, 240), .7);
  field.zones = stageLayout(stages[1], 832, 480).zones;
  for (let i = 0; i < 80; i++) field.paint(400, 240, 'sand', .1);
  assert.equal(field.at(400, 240), .001);
});
test('sand-only floor rejects the hand and allows the sandpaper', () => {
  const field = new FrictionField(.2); field.zones = [{ x: 0, y: 0, width: 832, height: 480, mode: 'sand' }];
  field.paint(144, 240, 'hand', .1); assert.equal(field.at(144, 240), .2);
  field.paint(144, 240, 'sand', .1); assert.ok(field.at(144, 240) > .2);
});
test('switches require stopping in order, and direct goal access stays locked', () => {
  const state = makeRuleState(), pads = [{ x: 100, y: 100, radius: 48 }, { x: 300, y: 100, radius: 48 }];
  updateRules(ball(300, 100), pads, state, 600); assert.equal(state.checkpoint, 0);
  updateRules(ball(100, 100, 1), pads, state, 600); assert.equal(state.checkpoint, 0);
  assert.equal(goalReady({ checkpoints: pads }, state, ball(0, 0)), false);
  updateRules(ball(100, 100), pads, state, 500); assert.equal(state.checkpoint, 1);
  updateRules(ball(300, 100), pads, state, 500); assert.equal(goalReady({ checkpoints: pads }, state, ball(0, 0)), true);
});
test('speed sensors reject slow travel and permanently fail excessive speed until reset', () => {
  const pads = [{ x: 100, y: 100, radius: 40, kind: 'speed', min: 3, max: 6 }];
  const state = makeRuleState(); updateRules(ball(100, 100, 2), pads, state, 16); assert.equal(state.checkpoint, 0);
  updateRules(ball(100, 100, 5), pads, state, 16); assert.equal(state.checkpoint, 1);
  const failed = makeRuleState(); updateRules(ball(100, 100, 8), pads, failed, 16); assert.equal(failed.failed, true);
  updateRules(ball(100, 100, 5), pads, failed, 16); assert.equal(goalReady({ checkpoints: pads }, failed, ball(0, 0)), false);
});
test('orientation-sensitive goals accept either vertical direction but reject horizontal', () => {
  const stage = { goalAngle: Math.PI / 2 }, state = makeRuleState(), body = ball(0, 0);
  assert.equal(goalReady(stage, state, body), false);
  body.angle = Math.PI / 2; assert.equal(goalReady(stage, state, body), true);
  body.angle = -Math.PI / 2; assert.equal(goalReady(stage, state, body), true);
});
