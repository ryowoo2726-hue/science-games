import { clamp, type Stage, type Vector } from '../types';

// A conservative, slightly compressible finite-volume cellular liquid.
// Only an open face between two orthogonally adjacent cells can transfer mass.
export const COMPRESSIBILITY = 0.002;
// Solve pressure across the wet cells before transferring water. A local
// two-cell relaxation transmits pressure too slowly through a long flooded hall.
const FLOW_RATE = 0.16;
const PRESSURE_SWEEPS = 24;
const MAX_TRANSFER = 0.3;
const DRY = 1e-10;

export function massAtPressure(pressure: number): number {
  if (pressure <= 0) return 0;
  return pressure <= 1 ? pressure : 1 + COMPRESSIBILITY * (pressure - 1);
}

export class Water {
  readonly cols: number;
  readonly rows: number;
  readonly size: number;
  readonly solid: Uint8Array;
  readonly mass: Float64Array;
  readonly previousMass: Float64Array;
  readonly horizontal: Int32Array;
  readonly vertical: Int32Array;
  readonly openCells: number;
  revision = 0;
  private tick = 0;
  private faces: Int32Array;
  private neighbors: Int32Array;
  private pressure: Float64Array;
  private source: Float64Array;
  private outgoing: Float64Array;
  private flux: Float64Array;
  private faceGravity: Float64Array;
  private active: Uint8Array;
  private degree: Uint8Array;

  constructor(readonly stage: Stage) {
    this.size = stage.cellSize;
    this.cols = stage.width / this.size;
    this.rows = stage.height / this.size;
    if (!Number.isInteger(this.cols) || !Number.isInteger(this.rows)) {
      throw new Error('미로 크기는 cellSize의 배수여야 합니다.');
    }
    this.solid = new Uint8Array(this.cols * this.rows);
    this.mass = new Float64Array(this.solid.length);
    this.previousMass = new Float64Array(this.solid.length);
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
    this.faces = Int32Array.from([...horizontal, ...vertical]);
    const faceCount = this.faces.length / 2;
    this.neighbors = new Int32Array(this.mass.length * 4).fill(-1);
    this.pressure = new Float64Array(this.mass.length);
    this.source = new Float64Array(this.mass.length);
    this.outgoing = new Float64Array(this.mass.length);
    this.degree = new Uint8Array(this.mass.length);
    this.flux = new Float64Array(faceCount);
    this.faceGravity = new Float64Array(faceCount);
    this.active = new Uint8Array(faceCount);
    const count = new Uint8Array(this.mass.length);
    for (let f = 0; f < faceCount; f++) {
      const a = this.faces[f * 2], b = this.faces[f * 2 + 1];
      this.neighbors[a * 4 + count[a]++] = f;
      this.neighbors[b * 4 + count[b]++] = f;
    }
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
    this.previousMass.set(this.mass);
    this.revision++;
  }

  step(gravity: Vector): void {
    const { mass, pressure, source, faces, active, degree, faceGravity, flux, outgoing } = this;
    this.previousMass.set(mass);
    source.set(mass);
    degree.fill(0);
    for (let i = 0; i < mass.length; i++) {
      pressure[i] = mass[i] <= 1 ? mass[i] : 1 + (mass[i] - 1) / COMPRESSIBILITY;
    }
    for (let f = 0; f < active.length; f++) {
      const a = faces[f * 2], b = faces[f * 2 + 1];
      const g = f * 2 < this.horizontal.length ? gravity.x : gravity.y;
      faceGravity[f] = g;
      const drive = pressure[a] - pressure[b] + g;
      // Air cannot supply water, nor transmit pressure across a dry corridor.
      active[f] = (mass[a] > DRY || mass[b] > DRY)
        && !(mass[a] <= DRY && drive >= 0 || mass[b] <= DRY && drive <= 0) ? 1 : 0;
      if (!active[f]) continue;
      degree[a]++; degree[b]++;
      source[a] -= FLOW_RATE * g;
      source[b] += FLOW_RATE * g;
    }
    // Implicit finite-volume pressure solve, warm-started from the current water.
    // Alternating traversals avoid a persistent left/right flow bias.
    for (let sweep = 0; sweep < PRESSURE_SWEEPS; sweep++) {
      const reverse = (this.tick + sweep) % 2 !== 0;
      for (let n = 0; n < mass.length; n++) {
        const i = reverse ? mass.length - 1 - n : n;
        if (!degree[i]) continue;
        let rhs = source[i];
        for (let d = 0; d < 4; d++) {
          const f = this.neighbors[i * 4 + d];
          if (f < 0 || !active[f]) continue;
          const a = faces[f * 2], b = faces[f * 2 + 1];
          rhs += FLOW_RATE * pressure[i === a ? b : a];
        }
        const diagonal = FLOW_RATE * degree[i];
        const target = rhs < 0 ? rhs / diagonal
          : rhs <= 1 + diagonal ? rhs / (1 + diagonal)
          : (rhs - 1 + COMPRESSIBILITY) / (diagonal + COMPRESSIBILITY);
        pressure[i] += 1.5 * (target - pressure[i]);
      }
    }
    outgoing.fill(0);
    for (let f = 0; f < active.length; f++) {
      if (!active[f]) { flux[f] = 0; continue; }
      const a = faces[f * 2], b = faces[f * 2 + 1];
      const flow = clamp(FLOW_RATE * (pressure[a] - pressure[b] + faceGravity[f]), -MAX_TRANSFER, MAX_TRANSFER);
      flux[f] = flow;
      outgoing[flow > 0 ? a : b] += Math.abs(flow);
    }
    // Limit all outgoing faces together before mutating any mass. This prevents
    // negatives and makes each transfer independent of traversal order.
    for (let f = 0; f < active.length; f++) {
      const a = faces[f * 2], b = faces[f * 2 + 1];
      const from = flux[f] > 0 ? a : b;
      if (outgoing[from] > 0 && outgoing[from] >= mass[from]) flux[f] *= mass[from] / (outgoing[from] + 1e-12);
    }
    for (let f = 0; f < active.length; f++) {
      mass[faces[f * 2]] -= flux[f];
      mass[faces[f * 2 + 1]] += flux[f];
    }
    this.tick++;
    this.revision++;
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
