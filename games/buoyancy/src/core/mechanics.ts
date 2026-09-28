import type { Rect, Spike, Vector } from '../types';

/** The same triangles are used by the renderer and rigid-body collisions. */
export function spikeTriangles(spike: Spike): Vector[][] {
  const vertical = spike.direction === 'up' || spike.direction === 'down';
  const length = vertical ? spike.width : spike.height;
  const count = Math.max(1, Math.round(length / 24));
  const step = length / count;
  return Array.from({ length: count }, (_, i) => {
    const a = i * step, b = (i + 1) * step, mid = (a + b) / 2;
    const { x, y, width: w, height: h } = spike;
    if (spike.direction === 'up') return [{ x: x + a, y: y + h }, { x: x + mid, y }, { x: x + b, y: y + h }];
    if (spike.direction === 'down') return [{ x: x + a, y }, { x: x + mid, y: y + h }, { x: x + b, y }];
    if (spike.direction === 'left') return [{ x: x + w, y: y + a }, { x, y: y + mid }, { x: x + w, y: y + b }];
    return [{ x, y: y + a }, { x: x + w, y: y + mid }, { x, y: y + b }];
  });
}

export function hullTouchesCircle(position: Vector, center: Vector, radius = 18): boolean {
  const dx = Math.max(Math.abs(position.x - center.x) - 24, 0);
  const dy = Math.max(Math.abs(position.y - center.y) - 14, 0);
  return dx * dx + dy * dy <= radius * radius;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
