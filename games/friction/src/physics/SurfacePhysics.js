// A top-down sliding model: contact forces distributed across the footprint.
// Matter handles rigid-body integration, torque, walls, and collision response.
export const TILE = 32;
export const FRICTION = { min: .001, max: 3, step: .005 };
export class FrictionField {
  constructor(roughness = .76, width = 832, height = 480) { this.resize(width, height, roughness); }
  reset(value) { this.initial = value; this.tiles = Array.from({ length: this.rows }, () => Array(this.cols).fill(value)); this.dirty = new Set(); }
  resize(width, height, value = this.initial ?? .76) {
    const previous = this.tiles;
    this.width = width; this.height = height; this.cols = Math.ceil(width / TILE); this.rows = Math.ceil(height / TILE); this.initial = value;
    this.tiles = Array.from({ length: this.rows }, (_, row) => Array.from({ length: this.cols }, (_, col) => previous?.[row]?.[col] ?? value));
    this.dirty = new Set();
  }
  at(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    const zone = this.zoneAt(x, y);
    if (zone?.mode === 'fixed') return zone.mu;
    return this.tiles[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] ?? 0;
  }
  zoneAt(x, y) {
    for (let i = (this.zones?.length ?? 0) - 1; i >= 0; i--) {
      const zone = this.zones[i];
      if (x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height) return zone;
    }
  }
  paint(x, y, mode, amount) {
    const firstRow = Math.max(0, Math.ceil((y - 42 - 16) / TILE)), lastRow = Math.min(this.rows - 1, Math.floor((y + 42 - 16) / TILE));
    const firstCol = Math.max(0, Math.ceil((x - 42 - 16) / TILE)), lastCol = Math.min(this.cols - 1, Math.floor((x + 42 - 16) / TILE));
    for (let row = firstRow; row <= lastRow; row++) for (let col = firstCol; col <= lastCol; col++) {
      const distance = Math.hypot(col * TILE + 16 - x, row * TILE + 16 - y);
      if (distance > 42) continue;
      const zone = this.zoneAt(col * TILE + 16, row * TILE + 16);
      if (zone?.mode === 'fixed' || (zone?.mode === 'sand' && mode !== 'sand') || (zone?.mode === 'hand' && mode !== 'hand')) continue;
      const next = this.tiles[row][col] + (mode === 'hand' ? -1 : 1) * amount * (1 - distance / 55);
      const value = Math.max(FRICTION.min, Math.min(FRICTION.max, Math.round(next / FRICTION.step) * FRICTION.step));
      if (value !== this.tiles[row][col]) { this.tiles[row][col] = value; this.dirty.add(row * this.cols + col); }
    }
  }
}
const BOX_CONTACTS = [-42, -14, 14, 42].flatMap(x => [-14, 14].map(y => ({ x, y })));
const BALL_CONTACTS = [{ x: 0, y: 0 }];
export function contactPoints(body, box) {
  const local = box ? BOX_CONTACTS : BALL_CONTACTS;
  const c = Math.cos(body.angle), s = Math.sin(body.angle);
  return local.map(p => ({ x: body.position.x + p.x * c - p.y * s, y: body.position.y + p.x * s + p.y * c }));
}
export function applySurfaceForces(Body, body, field, tilt, box) {
  const drive = { x: tilt.x * .0009, y: tilt.y * .0009 };
  const points = contactPoints(body, box);
  const mass = body.mass / points.length;
  Body.applyForce(body, body.position, { x: drive.x * body.mass, y: drive.y * body.mass });
  const forces = [];
  for (const p of points) {
    const rx = p.x - body.position.x, ry = p.y - body.position.y;
    const vx = body.velocity.x - body.angularVelocity * ry, vy = body.velocity.y + body.angularVelocity * rx;
    const speed = Math.hypot(vx, vy), mu = field.at(p.x, p.y), limit = mu * .0008;
    let fx, fy;
    if (speed < 1e-8) {
      const driveLength = Math.hypot(drive.x, drive.y);
      const factor = driveLength > 0 ? Math.min(1, limit * 1.12 / driveLength) : 0;
      fx = -drive.x * mass * factor; fy = -drive.y * mass * factor;
    } else {
      // Limit impulse so friction cannot reverse the contact's motion in one tick.
      const magnitude = Math.min(limit, speed / (1000 / 60) ** 2) * mass;
      fx = -vx / speed * magnitude; fy = -vy / speed * magnitude;
    }
    Body.applyForce(body, p, { x: fx, y: fy });
    forces.push({ point: p, x: fx, y: fy, mu });
  }
  return forces;
}
