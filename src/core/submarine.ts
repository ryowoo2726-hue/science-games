import Matter from 'matter-js';
import { clamp, type Stage, type Vector } from '../types';
import type { Water } from './water';

const { Bodies, Body, Composite, Engine } = Matter;
export const FIXED_STEP = 1 / 60;
export const BASE_MASS = 6;
export const GRAVITY_ACCELERATION = 0.00042; // px/ms², consistently used for both forces
export const TANK_RATE = 0.26; // fraction per second
export const SUB_WIDTH = 52;
export const SUB_HEIGHT = 32;

export const relativeDensity = (tank: number) => 0.65 + 0.7 * clamp(tank, 0, 1);
export function forceBalance(tank: number, submerged: number, waterDensity = 1) {
  const weight = relativeDensity(tank);
  const buoyancy = clamp(submerged, 0, 1) * waterDensity;
  return { weight, buoyancy, net: weight - buoyancy };
}

export class SubmarinePhysics {
  readonly engine: Matter.Engine;
  readonly body: Matter.Body;
  readonly walls: Matter.Body[];
  tank = 0.5;
  submerged = 1;
  waterDensity = 1;
  private samples: Vector[] = [];

  constructor(readonly stage: Stage) {
    this.engine = Engine.create({ positionIterations: 8, velocityIterations: 6, enableSleeping: false });
    this.engine.gravity.scale = 0;
    this.walls = stage.walls.map(wall => Bodies.rectangle(wall.x + wall.width / 2, wall.y + wall.height / 2, wall.width, wall.height, { isStatic: true, friction: 0.02, restitution: 0, label: 'wall' }));
    this.body = Bodies.rectangle(stage.start.x, stage.start.y, SUB_WIDTH, SUB_HEIGHT, {
      chamfer: { radius: 10 }, friction: 0.015, frictionStatic: 0.02,
      frictionAir: 0, restitution: 0.05, inertia: Infinity, label: 'submarine',
    });
    Composite.add(this.engine.world, [...this.walls, this.body]);
    // Equal-area samples inside the hull. Its fixed outside volume does not depend on tank water.
    for (let y = -14; y <= 14; y += 4) {
      for (let x = -24; x <= 24; x += 4) {
        if ((x / 26) ** 2 + (y / 16) ** 2 <= 1) this.samples.push({ x, y });
      }
    }
    this.reset();
  }

  reset(): void {
    this.tank = 0.5;
    this.submerged = 1;
    this.waterDensity = 1;
    Body.setPosition(this.body, this.stage.start);
    Body.setVelocity(this.body, { x: 0, y: 0 });
    Body.setAngle(this.body, 0);
    Body.setAngularVelocity(this.body, 0);
    Body.setMass(this.body, BASE_MASS * this.density);
    Body.setInertia(this.body, Infinity);
    this.body.force.x = 0;
    this.body.force.y = 0;
    this.body.torque = 0;
    Engine.clear(this.engine);
  }

  get density(): number { return relativeDensity(this.tank); }
  get forces() { return forceBalance(this.tank, this.submerged, this.waterDensity); }

  updateTank(direction: number, dt = FIXED_STEP): void {
    this.tank = clamp(this.tank + direction * TANK_RATE * dt, 0, 1);
    Body.setMass(this.body, BASE_MASS * this.density);
    Body.setInertia(this.body, Infinity);
  }

  step(water: Water, gravity: Vector, tankDirection: number): void {
    this.updateTank(tankDirection);
    let wet = 0, density = 0, currentX = 0, currentY = 0;
    for (const sample of this.samples) {
      const liquid = water.sample(this.body.position.x + sample.x, this.body.position.y + sample.y);
      wet += liquid.coverage; density += liquid.coverage * liquid.density;
      currentX += liquid.coverage * liquid.vx; currentY += liquid.coverage * liquid.vy;
    }
    this.submerged = wet / this.samples.length;
    this.waterDensity = wet > .001 ? density / wet : 1;
    const { net } = this.forces;
    // Fg = rho_sub * V * g; Fb = rho_water * V_submerged * g, opposite gravity.
    Body.applyForce(this.body, this.body.position, { x: BASE_MASS * GRAVITY_ACCELERATION * net * gravity.x, y: BASE_MASS * GRAVITY_ACCELERATION * net * gravity.y });
    const damping = Math.exp(-(0.14 + 2.65 * this.submerged) * FIXED_STEP);
    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.y);
    const limiter = speed > 3.2 ? 3.2 / speed : 1;
    const coupling = wet > .001 ? (1 - Math.exp(-2.65 * this.submerged * FIXED_STEP)) * FIXED_STEP / wet : 0;
    Body.setVelocity(this.body, { x: this.body.velocity.x * damping * limiter + currentX * coupling, y: this.body.velocity.y * damping * limiter + currentY * coupling });
    Engine.update(this.engine, FIXED_STEP * 1000);
  }
}
