import test from 'node:test';
import assert from 'node:assert/strict';
import { FrictionField, FRICTION, applySurfaceForces } from '../src/physics/SurfacePhysics.js';
function forces(field, velocity, tilt, box = false) {
  const body = { mass: 1, angle: 0, position: { x: 432, y: 336 }, velocity, angularVelocity: 0 };
  const total = { x: 0, y: 0, torque: 0 };
  const Body = { applyForce(b, p, f) { total.x += f.x; total.y += f.y; total.torque += (p.x - b.position.x) * f.y - (p.y - b.position.y) * f.x; } };
  applySurfaceForces(Body, body, field, tilt, box); return total;
}
test('painting changes nearby tiles and sand restores roughness', () => {
  const field = new FrictionField(.76); for (let i = 0; i < 15; i++) field.paint(144, 240, 'hand', .08);
  assert.ok(field.at(144, 240) < .1); assert.equal(field.at(700, 240), .76);
  for (let i = 0; i < 15; i++) field.paint(144, 240, 'sand', .08);
  assert.ok(field.at(144, 240) > .8);
});
test('rough floor holds at a tilt that moves an object on a smooth floor', () => {
  assert.ok(Math.abs(forces(new FrictionField(.95), { x: 0, y: 0 }, { x: .75, y: 0 }).x) < 1e-10);
  assert.ok(forces(new FrictionField(.04), { x: 0, y: 0 }, { x: .75, y: 0 }).x > .0005);
});
test('rough ground applies stronger opposing force', () => {
  const rough = forces(new FrictionField(.8), { x: 3, y: 0 }, { x: 0, y: 0 });
  const smooth = forces(new FrictionField(.05), { x: 3, y: 0 }, { x: 0, y: 0 });
  assert.ok(rough.x < smooth.x); assert.ok(smooth.x < 0);
});
test('asymmetric friction produces torque, uniform friction does not', () => {
  const uniform = new FrictionField(.6);
  assert.ok(Math.abs(forces(uniform, { x: 0, y: -2 }, { x: 0, y: -.75 }, true).torque) < 1e-10);
  uniform.tiles = uniform.tiles.map(row => row.map((_, col) => col < 13 ? .95 : .04));
  assert.ok(Math.abs(forces(uniform, { x: 0, y: -2 }, { x: 0, y: -.75 }, true).torque) > .005);
});
test('expanded range, fine increments, and no contact force beyond the surface', () => {
  const field = new FrictionField(.76);
  for (let i = 0; i < 100; i++) field.paint(144, 240, 'hand', .08);
  assert.equal(field.at(144, 240), FRICTION.min);
  for (let i = 0; i < 100; i++) field.paint(144, 240, 'sand', .08);
  assert.equal(field.at(144, 240), FRICTION.max);
  field.reset(.76); field.paint(144, 240, 'sand', .005);
  assert.equal(field.at(144, 240), .765);
  assert.equal(field.at(-1, 240), 0); assert.equal(field.at(900, 240), 0);
});
