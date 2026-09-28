import Matter from 'matter-js';
import { clamp, type Stage, type Vector } from '../types';
import type { Water } from './water';
import { spikeTriangles } from './mechanics';

const { Bodies, Body, Composite, Engine } = Matter;
export const FIXED_STEP = 1 / 60;
export const BASE_MASS = 6;
export const GRAVITY_ACCELERATION = 0.00042; // px/ms², consistently used for both forces
export const TANK_RATE = 0.26; // fraction per second
export const LEAK_RATE = 0.32;
export const LEAK_DURATION = 7;
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
  readonly doors = new Map<string, Matter.Body>();
  readonly spikes: Matter.Body[];
  tank = 0.5;
  submerged = 1;
  waterDensity = 1;
  leakRemaining = 0;
  private damageCooldown = 0;
  private samples: Vector[] = [];

  constructor(readonly stage: Stage) {
    this.engine = Engine.create({ positionIterations: 8, velocityIterations: 6, enableSleeping: false });
    this.engine.gravity.scale = 0;
    this.walls = stage.walls.map(wall => Bodies.rectangle(wall.x + wall.width / 2, wall.y + wall.height / 2, wall.width, wall.height, { isStatic: true, friction: 0.02, restitution: 0, label: 'wall' }));
    for (const door of stage.doors ?? []) this.doors.set(door.id, Bodies.rectangle(door.x + door.width / 2, door.y + door.height / 2, door.width, door.height, { isStatic: true, label: `door:${door.id}`, friction: .02 }));
    this.spikes = (stage.spikes ?? []).flatMap(spike => spikeTriangles(spike).map(vertices => {
      const x = vertices.reduce((sum, p) => sum + p.x, 0) / 3;
      const y = vertices.reduce((sum, p) => sum + p.y, 0) / 3;
      return Bodies.fromVertices(x, y, [vertices], { isStatic: true, label: 'spike', friction: .01, restitution: .1 });
    }));
    this.body = Bodies.rectangle(stage.start.x, stage.start.y, SUB_WIDTH, SUB_HEIGHT, {
      chamfer: { radius: 10 }, friction: 0.015, frictionStatic: 0.02,
      frictionAir: 0, restitution: 0.05, inertia: Infinity, label: 'submarine',
    });
    Composite.add(this.engine.world, [...this.walls, ...this.doors.values(), ...this.spikes, this.body]);
    // Equal-area samples inside the hull. Its fixed outside volume does not depend on tank water.
    for (let y = -14; y <= 14; y += 4) {
      for (let x = -24; x <= 24; x += 4) {
        if ((x / 26) ** 2 + (y / 16) ** 2 <= 1) this.samples.push({ x, y });
      }
    }
    this.reset();
  }

  reset(): void {
    this.leakRemaining = 0;
    this.damageCooldown = 0;
    for (const door of this.doors.values()) if (!Composite.get(this.engine.world, door.id, 'body')) Composite.add(this.engine.world, door);
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
  get touchingSpike(): boolean {
    return this.engine.pairs.list.some((pair: Matter.Pair) => pair.isActive && (pair.bodyA === this.body || pair.bodyB === this.body) && (pair.bodyA.label === 'spike' || pair.bodyB.label === 'spike'));
  }

  openDoor(id: string): void {
    const door = this.doors.get(id);
    if (door) Composite.remove(this.engine.world, door);
  }

  hitSpike(): boolean {
    if (this.damageCooldown > 0) return false;
    this.damageCooldown = 1.2;
    this.leakRemaining = LEAK_DURATION;
    this.tank = Math.min(this.tank, .4);
    this.updateMass();
    return true;
  }

  repair(): boolean {
    if (!this.leakRemaining) return false;
    this.leakRemaining = 0;
    this.damageCooldown = .6;
    return true;
  }

  private updateMass(): void {
    Body.setMass(this.body, BASE_MASS * this.density);
    Body.setInertia(this.body, Infinity);
  }

  updateTank(direction: number, dt = FIXED_STEP): void {
    const leakingTime = Math.min(dt, this.leakRemaining);
    this.tank = clamp(this.tank + direction * TANK_RATE * dt - LEAK_RATE * leakingTime, 0, 1);
    this.leakRemaining = Math.max(0, this.leakRemaining - dt);
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    this.updateMass();
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
