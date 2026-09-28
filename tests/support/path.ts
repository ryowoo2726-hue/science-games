import type { Rect, Stage, Vector } from '../../src/types';

// Plan with the full hull and an extra corner-turn margin, not a point player.
export function escapePath(stage: Stage, walls: Rect[] = stage.walls): Vector[] {
  const size = 12, cols = stage.width / size, rows = stage.height / size;
  const point = (id: number) => ({ x: (id % cols + .5) * size, y: (Math.floor(id / cols) + .5) * size });
  const free = (id: number) => {
    const p = point(id);
    return !walls.some(w => p.x + 34 > w.x && p.x - 34 < w.x + w.width && p.y + 24 > w.y && p.y - 24 < w.y + w.height);
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

/** Plan pressure-switch visits without crossing any door before its prerequisites. */
export function puzzlePlan(stage: Stage) {
  const pressed = new Set<string>(), open = new Set<string>();
  let position = stage.start;
  const legs: { switchId?: string; path: Vector[] }[] = [];
  for (let round = 0; round < (stage.switches?.length ?? 0); round++) {
    const walls = [...stage.walls, ...(stage.spikes ?? []), ...(stage.doors ?? []).filter(d => !open.has(d.id))];
    let found = false;
    for (const button of stage.switches ?? []) {
      if (pressed.has(button.id)) continue;
      const path = escapePath({ ...stage, start: position, exit: { x: button.x - 12, y: button.y - 12, width: 24, height: 24 } }, walls);
      if (!path.length) continue;
      legs.push({ switchId: button.id, path }); position = path[path.length - 1];
      pressed.add(button.id);
      for (const d of stage.doors ?? []) if (d.switches.every(id => pressed.has(id))) open.add(d.id);
      found = true; break;
    }
    if (!found) break;
  }
  const path = escapePath({ ...stage, start: position }, [...stage.walls, ...(stage.spikes ?? []), ...(stage.doors ?? []).filter(d => !open.has(d.id))]);
  legs.push({ path });
  return { pressed, open, legs };
}
