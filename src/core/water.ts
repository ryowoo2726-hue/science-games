import { clamp, type Stage, type Vector } from '../types';

// A conservative, slightly compressible finite-volume cellular liquid.
// Only an open face between two orthogonally adjacent cells can transfer mass.
export const COMPRESSIBILITY = 0.002;
const RELAXATION = 0.42;
const MAX_TRANSFER = 0.24;

export function massAtPressure(pressure: number): number {
  if (pressure <= 0) return 0;
  return pressure <= 1 ? pressure : 1 + COMPRESSIBILITY * (pressure - 1);
}

// Exact two-cell hydrostatic equilibrium: p(b) - p(a) = gravity projection.
export function lowerEquilibrium(total: number, gravity: number): number {
  const k = clamp(gravity, 0, 1);
  if (total <= k) return total;
  if (total <= 2 - k) return (total + k) / 2;
  if (total < 2 + COMPRESSIBILITY * k) {
    return total - (total - 1 + COMPRESSIBILITY * (1 - k)) / (1 + COMPRESSIBILITY);
  }
  return (total + COMPRESSIBILITY * k) / 2;
}

export class Water {
  readonly cols: number;
  readonly rows: number;
  readonly size: number;
  readonly solid: Uint8Array;
  readonly mass: Float64Array;
  readonly horizontal: Int32Array;
  readonly vertical: Int32Array;
  readonly openCells: number;
  private tick = 0;

  constructor(readonly stage: Stage) {
    this.size = stage.cellSize;
    this.cols = stage.width / this.size;
    this.rows = stage.height / this.size;
    if (!Number.isInteger(this.cols) || !Number.isInteger(this.rows)) {
      throw new Error('미로 크기는 cellSize의 배수여야 합니다.');
    }
    this.solid = new Uint8Array(this.cols * this.rows);
    this.mass = new Float64Array(this.solid.length);
    for (const wall of stage.walls) {
      if ([wall.x, wall.y, wall.width, wall.height].some(v => v % this.size !== 0)) {
        throw new Error('벽 좌표와 크기는 cellSize의 배수여야 합니다.');
      }
      for (let y = wall.y / this.size; y < (wall.y + wall.height) / this.size; y++) {
        for (let x = wall.x / this.size; x < (wall.x + wall.width) / this.size; x++) {
          if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.solid[y * this.cols + x] = 1;
        }
      }
    }
    const horizontal: number[] = [];
    const vertical: number[] = [];
    let open = 0;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const a = y * this.cols + x;
        if (this.solid[a]) continue;
        open++;
        if (x + 1 < this.cols && !this.solid[a + 1]) horizontal.push(a, a + 1);
        if (y + 1 < this.rows && !this.solid[a + this.cols]) vertical.push(a, a + this.cols);
      }
    }
    this.openCells = open;
    this.horizontal = Int32Array.from(horizontal);
    this.vertical = Int32Array.from(vertical);
    this.reset();
  }

  reset(): void {
    this.tick = 0;
    this.mass.fill(0);
    // Initialize a horizontal, already settled surface. No startup flood.
    const target = this.openCells * this.stage.waterFraction;
    let low = -this.rows - 2;
    let high = 2;
    for (let iteration = 0; iteration < 60; iteration++) {
      const level = (low + high) / 2;
      let total = 0;
      for (let i = 0; i < this.mass.length; i++) {
        if (!this.solid[i]) total += massAtPressure(level + Math.floor(i / this.cols));
      }
      if (total < target) low = level;
      else high = level;
    }
    const level = (low + high) / 2;
    for (let i = 0; i < this.mass.length; i++) {
      if (!this.solid[i]) this.mass[i] = massAtPressure(level + Math.floor(i / this.cols));
    }
  }

  step(gravity: Vector): void {
    // Alternating sweeps remove a persistent left/right traversal bias.
    // Bounded face flow takes time to propagate even after an abrupt tilt.
    for (let sweep = 0; sweep < 3; sweep++) {
      const reverse = (this.tick + sweep) % 2 !== 0;
      if ((this.tick + sweep) % 2 === 0) {
        this.exchange(this.vertical, gravity.y, reverse);
        this.exchange(this.horizontal, gravity.x, reverse);
      } else {
        this.exchange(this.horizontal, gravity.x, reverse);
        this.exchange(this.vertical, gravity.y, reverse);
      }
    }
    this.tick++;
  }

  private exchange(edges: Int32Array, projection: number, reverse: boolean): void {
    for (let n = 0; n < edges.length; n += 2) {
      const index = reverse ? edges.length - 2 - n : n;
      let a = edges[index];
      let b = edges[index + 1];
      if (projection < 0) [a, b] = [b, a];
      const total = this.mass[a] + this.mass[b];
      if (total <= 0) continue;
      const targetB = lowerEquilibrium(total, Math.abs(projection));
      const desired = (targetB - this.mass[b]) * RELAXATION;
      const transfer = clamp(desired, -Math.min(MAX_TRANSFER, this.mass[b]), Math.min(MAX_TRANSFER, this.mass[a]));
      this.mass[a] -= transfer;
      this.mass[b] += transfer;
    }
  }

  totalMass(): number {
    return this.mass.reduce((sum, value) => sum + value, 0);
  }

  fractionAt(x: number, y: number): number {
    const col = Math.floor(x / this.size);
    const row = Math.floor(y / this.size);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return 0;
    return clamp(this.mass[row * this.cols + col], 0, 1);
  }

  // Sub-cell coverage follows a plane perpendicular to gravity, also used to draw water.
  coverageAt(x: number, y: number, gravity: Vector): number {
    const fraction = this.fractionAt(x, y);
    if (fraction >= 0.999 || fraction <= 0.001) return fraction;
    const localX = ((x / this.size) % 1 + 1) % 1 - 0.5;
    const localY = ((y / this.size) % 1 + 1) % 1 - 0.5;
    const threshold = fillThreshold(fraction, gravity);
    // A one-pixel transition makes sampled buoyancy continuous at the free surface.
    return clamp(0.5 + (localX * gravity.x + localY * gravity.y - threshold) * this.size, 0, 1);
  }
}

export function fillThreshold(fraction: number, g: Vector): number {
  // Distribution of gx*x + gy*y over the unit square: convolution of two uniforms.
  const a = Math.max(Math.abs(g.x), Math.abs(g.y));
  const b = Math.min(Math.abs(g.x), Math.abs(g.y));
  const cdf = 1 - clamp(fraction, 0, 1);
  if (b < 1e-6) return a * (cdf - 0.5);
  const tail = b / (2 * a);
  if (cdf < tail) return Math.sqrt(2 * a * b * cdf) - (a + b) / 2;
  if (cdf > 1 - tail) return (a + b) / 2 - Math.sqrt(2 * a * b * (1 - cdf));
  return a * (cdf - 0.5);
}

export function filledCellPolygon(fraction: number, g: Vector): Vector[] {
  const threshold = fillThreshold(fraction, g);
  const square: Vector[] = [{ x: -.5, y: -.5 }, { x: .5, y: -.5 }, { x: .5, y: .5 }, { x: -.5, y: .5 }];
  const polygon: Vector[] = [];
  for (let i = 0; i < square.length; i++) {
    const a = square[i];
    const b = square[(i + 1) % square.length];
    const da = a.x * g.x + a.y * g.y - threshold;
    const db = b.x * g.x + b.y * g.y - threshold;
    if (da >= 0) polygon.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      polygon.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return polygon;
}
