import { clamp, type Rect, type Stage, type Vector } from '../types';

// Position-based liquid: inertia belongs to moving particles, not to independently
// filled squares. The grid below is only a search structure and observation field.
const SPACING = 12;
const SUPPORT = 26;
const RADIUS = 3;
const DT = 1 / 60;
const ITERATIONS = 4;
const GRAVITY = 420;
const H2 = SUPPORT * SUPPORT;
export const SURFACE_LEVEL = .48;

export class Water {
  readonly size: number;
  readonly cols: number;
  readonly rows: number;
  readonly solid: Uint8Array;
  readonly openCells: number;
  readonly mass: Float64Array;
  readonly previousMass: Float64Array;
  readonly fieldSize = 6;
  readonly fieldCols: number;
  readonly fieldRows: number;
  readonly field: Float32Array;
  readonly materialField: Float32Array;
  x = new Float64Array(0);
  y = new Float64Array(0);
  previousX = new Float64Array(0);
  previousY = new Float64Array(0);
  vx = new Float64Array(0);
  vy = new Float64Array(0);
  material = new Float64Array(0);
  count = 0;
  revision = 0;
  geometryRevision = 0;
  activeWalls: Rect[];
  private allCount = 0;
  private volume = 0;
  private unitVolume = 0;
  private hashCols: number;
  private hashRows: number;
  private heads: Int32Array;
  private next = new Int32Array(0);
  private pairA = new Int32Array(0);
  private pairB = new Int32Array(0);
  private pairCount = 0;
  private density = new Float64Array(0);
  private lambda = new Float64Array(0);
  private gradientX = new Float64Array(0);
  private gradientY = new Float64Array(0);
  private gradientSq = new Float64Array(0);
  private deltaX = new Float64Array(0);
  private deltaY = new Float64Array(0);
  private nearWall = new Uint8Array(0);
  private restDensity = 0;
  private fieldBlend = -1;
  private fieldRevision = -1;

  constructor(readonly stage: Stage) {
    this.size = stage.cellSize;
    this.cols = stage.width / this.size;
    this.rows = stage.height / this.size;
    if (!Number.isInteger(this.cols) || !Number.isInteger(this.rows)) throw new Error('미로 크기는 cellSize의 배수여야 합니다.');
    this.solid = new Uint8Array(this.cols * this.rows);
    this.activeWalls = [...stage.walls, ...(stage.doors ?? [])];
    this.rasterizeWalls();
    this.openCells = this.solid.reduce((n, s) => n + (s ? 0 : 1), 0);
    this.mass = new Float64Array(this.solid.length);
    this.previousMass = new Float64Array(this.solid.length);
    this.fieldCols = Math.ceil(stage.width / this.fieldSize) + 1;
    this.fieldRows = Math.ceil(stage.height / this.fieldSize) + 1;
    this.field = new Float32Array(this.fieldCols * this.fieldRows);
    this.materialField = new Float32Array(this.field.length);
    this.hashCols = Math.ceil(stage.width / SUPPORT) + 2;
    this.hashRows = Math.ceil(stage.height / SUPPORT) + 2;
    this.heads = new Int32Array(this.hashCols * this.hashRows);
    // Normalize the compact smoothing kernel to the seeded hexagonal lattice.
    const rowHeight = SPACING * Math.sqrt(3) / 2;
    for (let row = -4; row <= 4; row++) for (let col = -4; col <= 4; col++) {
      const dx = (col + (row & 1) * .5) * SPACING, dy = row * rowHeight;
      const q = 1 - (dx * dx + dy * dy) / H2;
      if (q > 0) this.restDensity += q * q * q;
    }
    this.reset();
  }

  private rasterizeWalls(): void {
    this.solid.fill(0);
    for (const wall of this.activeWalls) {
      if ([wall.x, wall.y, wall.width, wall.height].some(v => v % this.size)) throw new Error('벽 좌표와 크기는 cellSize의 배수여야 합니다.');
      for (let row = wall.y / this.size; row < (wall.y + wall.height) / this.size; row++) {
        for (let col = wall.x / this.size; col < (wall.x + wall.width) / this.size; col++) this.solid[row * this.cols + col] = 1;
      }
    }
    this.geometryRevision++;
  }

  /** Doors latch open. Rebuild only boundaries, preserving every liquid particle. */
  openDoors(open: ReadonlySet<string>): void {
    const walls = [...this.stage.walls, ...(this.stage.doors ?? []).filter(d => !open.has(d.id))];
    if (walls.length === this.activeWalls.length) return;
    this.activeWalls = walls;
    this.rasterizeWalls();
    const boundary: Vector[] = [];
    const rowHeight = SPACING * Math.sqrt(3) / 2;
    for (let row = 0, y = SPACING / 2; y < this.stage.height; row++, y += rowHeight) {
      for (let x = SPACING / 2 + (row & 1) * SPACING / 2; x < this.stage.width; x += SPACING) {
        if (this.isSolidAt(x, y)) boundary.push({ x, y });
      }
    }
    const length = this.count + boundary.length;
    for (const key of ['x', 'y', 'previousX', 'previousY'] as const) {
      const next = new Float64Array(length);
      next.set(this[key].subarray(0, this.count));
      boundary.forEach((p, i) => { next[this.count + i] = key.endsWith('X') || key === 'x' ? p.x : p.y; });
      this[key] = next;
    }
    this.allCount = length;
    this.next = new Int32Array(length);
    this.rebuildHash(); this.updateObservation(); this.previousMass.set(this.mass);
    this.revision++;
  }

  isSolidAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.stage.width || y >= this.stage.height) return true;
    return !!this.solid[Math.floor(y / this.size) * this.cols + Math.floor(x / this.size)];
  }

  reset(region?: Rect): void {
    this.activeWalls = [...this.stage.walls, ...(this.stage.doors ?? [])];
    this.rasterizeWalls();
    const wetArea = (level: number) => {
      let area = 0;
      for (let i = 0; i < this.solid.length; i++) {
        if (this.solid[i]) continue;
        const x = i % this.cols * this.size, y = Math.floor(i / this.cols) * this.size;
        if (region) area += Math.max(0, Math.min(x + this.size, region.x + region.width) - Math.max(x, region.x)) * Math.max(0, Math.min(y + this.size, region.y + region.height) - Math.max(y, region.y));
        else area += this.size * clamp(y + this.size - level, 0, this.size);
      }
      return area;
    };
    this.volume = region ? wetArea(0) : this.openCells * this.size ** 2 * this.stage.waterFraction;
    let low = 0, high = this.stage.height;
    for (let n = 0; n < 40; n++) { const mid = (low + high) / 2; if (wetArea(mid) > this.volume) low = mid; else high = mid; }
    const level = (low + high) / 2;
    const fluid: Vector[] = [], boundary: Vector[] = [];
    const rowHeight = SPACING * Math.sqrt(3) / 2;
    for (let row = 0, py = SPACING / 2; py < this.stage.height; row++, py += rowHeight) {
      for (let px = SPACING / 2 + (row & 1) * SPACING / 2; px < this.stage.width; px += SPACING) {
        if (this.isSolidAt(px, py)) { boundary.push({ x: px, y: py }); continue; }
        const wet = region ? px >= region.x && px < region.x + region.width && py >= region.y && py < region.y + region.height : py >= level;
        if (!wet || this.activeWalls.some(w => px > w.x - RADIUS && px < w.x + w.width + RADIUS && py > w.y - RADIUS && py < w.y + w.height + RADIUS)) continue;
        fluid.push({ x: px, y: py });
      }
    }
    this.count = fluid.length;
    this.allCount = this.count + boundary.length;
    this.unitVolume = this.count ? this.volume / this.count : 0;
    this.x = new Float64Array(this.allCount); this.y = new Float64Array(this.allCount);
    [...fluid, ...boundary].forEach((p, i) => { this.x[i] = p.x; this.y[i] = p.y; });
    this.previousX = this.x.slice(); this.previousY = this.y.slice();
    this.vx = new Float64Array(this.count); this.vy = new Float64Array(this.count);
    this.material = new Float64Array(this.count).fill(1);
    fluid.forEach((p, i) => {
      const zone = this.stage.densityZones?.find(z => p.x >= z.x && p.x < z.x + z.width && p.y >= z.y && p.y < z.y + z.height);
      this.material[i] = zone?.density ?? 1;
    });
    this.next = new Int32Array(this.allCount);
    this.pairA = new Int32Array(Math.max(this.count * 80, 1)); this.pairB = new Int32Array(this.pairA.length);
    this.density = new Float64Array(this.count); this.lambda = new Float64Array(this.count);
    this.gradientX = new Float64Array(this.count); this.gradientY = new Float64Array(this.count); this.gradientSq = new Float64Array(this.count);
    this.deltaX = new Float64Array(this.count); this.deltaY = new Float64Array(this.count);
    this.nearWall = new Uint8Array(this.count);
    this.rebuildHash(); this.updateObservation();
    this.previousMass.set(this.mass);
    this.revision++;
  }

  private rebuildHash(): void {
    this.heads.fill(-1);
    for (let i = 0; i < this.allCount; i++) {
      const cell = clamp(Math.floor(this.y[i] / SUPPORT), 0, this.hashRows - 1) * this.hashCols + clamp(Math.floor(this.x[i] / SUPPORT), 0, this.hashCols - 1);
      this.next[i] = this.heads[cell]; this.heads[cell] = i;
    }
  }

  private buildPairs(): void {
    this.rebuildHash(); this.pairCount = 0;
    for (let i = 0; i < this.count; i++) {
      const col = Math.floor(this.x[i] / SUPPORT), row = Math.floor(this.y[i] / SUPPORT);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (col + dx < 0 || row + dy < 0 || col + dx >= this.hashCols || row + dy >= this.hashRows) continue;
        for (let j = this.heads[(row + dy) * this.hashCols + col + dx]; j >= 0; j = this.next[j]) {
          if (j <= i) continue;
          const x = this.x[i] - this.x[j], y = this.y[i] - this.y[j];
          if (x * x + y * y > (SUPPORT + 3) ** 2) continue;
          if (this.pairCount === this.pairA.length) {
            const a = new Int32Array(this.pairA.length * 2), b = new Int32Array(a.length);
            a.set(this.pairA); b.set(this.pairB); this.pairA = a; this.pairB = b;
          }
          this.pairA[this.pairCount] = i; this.pairB[this.pairCount++] = j;
        }
      }
    }
  }

  private constrainWalls(i: number, oldX: number, oldY: number): void {
    let x = this.x[i], y = this.y[i];
    for (const w of this.activeWalls) {
      const left = w.x - RADIUS, right = w.x + w.width + RADIUS, top = w.y - RADIUS, bottom = w.y + w.height + RADIUS;
      if (x <= left || x >= right || y <= top || y >= bottom) continue;
      if (oldX <= left) x = left;
      else if (oldX >= right) x = right;
      else if (oldY <= top) y = top;
      else if (oldY >= bottom) y = bottom;
      else {
        const distances = [x - left, right - x, y - top, bottom - y];
        const face = distances.indexOf(Math.min(...distances));
        if (face === 0) x = left; else if (face === 1) x = right; else if (face === 2) y = top; else y = bottom;
      }
    }
    this.x[i] = clamp(x, RADIUS, this.stage.width - RADIUS);
    this.y[i] = clamp(y, RADIUS, this.stage.height - RADIUS);
  }

  step(g: Vector): void {
    this.previousX.set(this.x); this.previousY.set(this.y); this.previousMass.set(this.mass);
    for (let i = 0; i < this.count; i++) {
      this.vx[i] = clamp(this.vx[i] * .999 + g.x * GRAVITY * DT, -300, 300);
      this.vy[i] = clamp(this.vy[i] * .999 + g.y * GRAVITY * DT, -300, 300);
      this.x[i] += this.vx[i] * DT; this.y[i] += this.vy[i] * DT;
      this.constrainWalls(i, this.previousX[i], this.previousY[i]);
    }
    this.buildPairs();
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      this.density.fill(1); this.gradientX.fill(0); this.gradientY.fill(0); this.gradientSq.fill(0);
      for (let p = 0; p < this.pairCount; p++) {
        const a = this.pairA[p], b = this.pairB[p];
        const dx = this.x[a] - this.x[b], dy = this.y[a] - this.y[b];
        const q = 1 - (dx * dx + dy * dy) / H2;
        if (q <= 0) continue;
        const weight = q * q * q;
        const factor = -6 / H2 * q * q / this.restDensity;
        const gx = factor * dx, gy = factor * dy, sq = gx * gx + gy * gy;
        this.density[a] += weight; this.gradientX[a] += gx; this.gradientY[a] += gy; this.gradientSq[a] += sq;
        if (b < this.count) { this.density[b] += weight; this.gradientX[b] -= gx; this.gradientY[b] -= gy; this.gradientSq[b] += sq; }
      }
      for (let i = 0; i < this.count; i++) {
        const constraint = Math.max(this.density[i] / this.restDensity - 1, 0);
        this.lambda[i] = -constraint / (this.gradientSq[i] + this.gradientX[i] ** 2 + this.gradientY[i] ** 2 + .00003);
      }
      this.deltaX.fill(0); this.deltaY.fill(0);
      for (let p = 0; p < this.pairCount; p++) {
        const a = this.pairA[p], b = this.pairB[p];
        const dx = this.x[a] - this.x[b], dy = this.y[a] - this.y[b], r2 = dx * dx + dy * dy;
        const q = 1 - r2 / H2;
        if (q <= 0) continue;
        let factor = (this.lambda[a] + (b < this.count ? this.lambda[b] : 0)) * -6 / H2 * q * q / this.restDensity;
        // Gentle cohesion keeps a moving body of water together; short-range
        // repulsion prevents particles from clustering into visible blobs.
        if (b < this.count && r2 > .01) {
          const r = Math.sqrt(r2);
          factor -= .002 * q * Math.max(r - SPACING, 0) / r;
          if (r < SPACING * .65) factor += .04 * (SPACING * .65 - r) / r;
        }
        const scaleA = b < this.count ? 2 * this.material[b] / (this.material[a] + this.material[b]) : 1;
        const scaleB = b < this.count ? 2 * this.material[a] / (this.material[a] + this.material[b]) : 0;
        this.deltaX[a] += factor * dx * scaleA; this.deltaY[a] += factor * dy * scaleA;
        if (b < this.count) { this.deltaX[b] -= factor * dx * scaleB; this.deltaY[b] -= factor * dy * scaleB; }
      }
      for (let i = 0; i < this.count; i++) {
        const oldX = this.x[i], oldY = this.y[i];
        const length = Math.hypot(this.deltaX[i], this.deltaY[i]);
        const limit = length > 2 ? 2 / length : 1;
        this.x[i] += this.deltaX[i] * limit; this.y[i] += this.deltaY[i] * limit;
        this.constrainWalls(i, oldX, oldY);
      }
    }
    for (let i = 0; i < this.count; i++) { this.vx[i] = (this.x[i] - this.previousX[i]) / DT; this.vy[i] = (this.y[i] - this.previousY[i]) / DT; }
    for (let p = 0; p < this.pairCount; p++) {
      const a = this.pairA[p], b = this.pairB[p];
      if (b >= this.count) continue;
      const q = 1 - ((this.x[a] - this.x[b]) ** 2 + (this.y[a] - this.y[b]) ** 2) / H2;
      if (q <= 0) continue;
      const blend = .018 * q * q * q;
      const dx = (this.vx[b] - this.vx[a]) * blend, dy = (this.vy[b] - this.vy[a]) * blend;
      const scaleA = 2 * this.material[b] / (this.material[a] + this.material[b]);
      const scaleB = 2 * this.material[a] / (this.material[a] + this.material[b]);
      this.vx[a] += dx * scaleA; this.vy[a] += dy * scaleA; this.vx[b] -= dx * scaleB; this.vy[b] -= dy * scaleB;
    }
    this.rebuildHash(); this.updateObservation(); this.revision++;
  }

  private updateObservation(): void {
    this.mass.fill(0);
    for (let i = 0; i < this.count; i++) {
      const x = this.x[i] / this.size - .5, y = this.y[i] / this.size - .5;
      const col = Math.floor(x), row = Math.floor(y), fx = x - col, fy = y - row;
      let sum = 0;
      for (let n = 0; n < 4; n++) {
        const c = col + n % 2, r = row + Math.floor(n / 2), id = r * this.cols + c;
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows && !this.solid[id]) sum += (n % 2 ? fx : 1 - fx) * (n >= 2 ? fy : 1 - fy);
      }
      for (let n = 0; n < 4; n++) {
        const c = col + n % 2, r = row + Math.floor(n / 2), id = r * this.cols + c;
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows && !this.solid[id] && sum > 0) this.mass[id] += (n % 2 ? fx : 1 - fx) * (n >= 2 ? fy : 1 - fy) / sum * this.unitVolume / this.size ** 2;
      }
      this.nearWall[i] = 0;
      for (const w of this.activeWalls) {
        if (this.x[i] > w.x - SUPPORT && this.x[i] < w.x + w.width + SUPPORT && this.y[i] > w.y - SUPPORT && this.y[i] < w.y + w.height + SUPPORT) { this.nearWall[i] = 1; break; }
      }
    }
  }

  private occluded(ax: number, ay: number, bx: number, by: number): boolean {
    for (const w of this.activeWalls) {
      if (Math.max(ax, bx) <= w.x || Math.min(ax, bx) >= w.x + w.width || Math.max(ay, by) <= w.y || Math.min(ay, by) >= w.y + w.height) continue;
      const dx = bx - ax, dy = by - ay;
      const tx1 = Math.abs(dx) < 1e-8 ? -Infinity : (w.x - ax) / dx;
      const tx2 = Math.abs(dx) < 1e-8 ? Infinity : (w.x + w.width - ax) / dx;
      const ty1 = Math.abs(dy) < 1e-8 ? -Infinity : (w.y - ay) / dy;
      const ty2 = Math.abs(dy) < 1e-8 ? Infinity : (w.y + w.height - ay) / dy;
      if (Math.max(0, Math.min(tx1, tx2), Math.min(ty1, ty2)) < Math.min(1, Math.max(tx1, tx2), Math.max(ty1, ty2))) return true;
    }
    return false;
  }

  sample(x: number, y: number): { coverage: number; density: number; vx: number; vy: number } {
    if (this.isSolidAt(x, y)) return { coverage: 0, density: 1, vx: 0, vy: 0 };
    let weight = 0, material = 0, vx = 0, vy = 0;
    const col = Math.floor(x / SUPPORT), row = Math.floor(y / SUPPORT);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (col + dx < 0 || row + dy < 0 || col + dx >= this.hashCols || row + dy >= this.hashRows) continue;
      for (let i = this.heads[(row + dy) * this.hashCols + col + dx]; i >= 0; i = this.next[i]) {
        if (i >= this.count) continue;
        const q = 1 - ((x - this.x[i]) ** 2 + (y - this.y[i]) ** 2) / H2;
        if (q <= 0 || this.nearWall[i] && this.occluded(this.x[i], this.y[i], x, y)) continue;
        const w = q * q * q;
        weight += w; material += w * this.material[i]; vx += w * this.vx[i]; vy += w * this.vy[i];
      }
    }
    const field = weight / this.restDensity;
    return { coverage: clamp((field - SURFACE_LEVEL + .08) / .16, 0, 1), density: weight > .001 ? material / weight : 1, vx: weight > .001 ? vx / weight : 0, vy: weight > .001 ? vy / weight : 0 };
  }
  fractionAt(x: number, y: number): number { return this.sample(x, y).coverage; }
  coverageAt(x: number, y: number, _gravity: Vector): number { return this.fractionAt(x, y); }
  totalMass(): number { return this.volume / this.size ** 2; }
  totalMaterialMass(): number { return this.material.reduce((sum, m) => sum + m * this.unitVolume, 0); }

  buildSurface(blend = 1): void {
    if (this.fieldRevision === this.revision && Math.abs(this.fieldBlend - blend) < .001) return;
    this.field.fill(0); this.materialField.fill(0);
    const s = this.fieldSize;
    for (let i = 0; i < this.count; i++) {
      const px = this.previousX[i] + (this.x[i] - this.previousX[i]) * blend;
      const py = this.previousY[i] + (this.y[i] - this.previousY[i]) * blend;
      const minCol = Math.max(0, Math.ceil((px - SUPPORT) / s)), maxCol = Math.min(this.fieldCols - 1, Math.floor((px + SUPPORT) / s));
      const minRow = Math.max(0, Math.ceil((py - SUPPORT) / s)), maxRow = Math.min(this.fieldRows - 1, Math.floor((py + SUPPORT) / s));
      for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
        const x = col * s, y = row * s, q = 1 - ((px - x) ** 2 + (py - y) ** 2) / H2;
        if (q <= 0 || this.nearWall[i] && !this.isSolidAt(x, y) && this.occluded(px, py, x, y)) continue;
        const index = row * this.fieldCols + col, weight = q * q * q / this.restDensity;
        this.field[index] += weight; this.materialField[index] += weight * this.material[i];
      }
    }
    this.fieldRevision = this.revision; this.fieldBlend = blend;
  }
}
