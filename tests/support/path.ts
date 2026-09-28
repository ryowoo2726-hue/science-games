import type { Stage, Vector } from '../../src/types';

// Plan with the full hull and an extra corner-turn margin, not a point player.
export function escapePath(stage: Stage): Vector[] {
  const size = 12, cols = stage.width / size, rows = stage.height / size;
  const point = (id: number) => ({ x: (id % cols + .5) * size, y: (Math.floor(id / cols) + .5) * size });
  const free = (id: number) => {
    const p = point(id);
    return !stage.walls.some(w => p.x + 34 > w.x && p.x - 34 < w.x + w.width && p.y + 24 > w.y && p.y - 24 < w.y + w.height);
  };
  const start = Math.floor(stage.start.y / size) * cols + Math.floor(stage.start.x / size);
  const queue = [start], previous = new Int32Array(cols * rows).fill(-1);
  previous[start] = start;
  let goal = -1;
  for (let n = 0; n < queue.length; n++) {
    const id = queue[n], p = point(id), e = stage.exit;
    if (p.x >= e.x && p.x <= e.x + e.width && p.y >= e.y && p.y <= e.y + e.height) { goal = id; break; }
    for (const next of [id + 1, id - 1, id + cols, id - cols]) {
      if (next < 0 || next >= previous.length || Math.abs(next % cols - id % cols) > 1 || previous[next] >= 0 || !free(next)) continue;
      previous[next] = id; queue.push(next);
    }
  }
  if (goal < 0) return [];
  const full: Vector[] = [];
  for (let id = goal; ; id = previous[id]) { full.push(point(id)); if (id === start) break; }
  full.reverse();
  return full.filter((p, i) => i === 0 || i === full.length - 1 || (p.x - full[i - 1].x) !== (full[i + 1].x - p.x) || (p.y - full[i - 1].y) !== (full[i + 1].y - p.y));
}
