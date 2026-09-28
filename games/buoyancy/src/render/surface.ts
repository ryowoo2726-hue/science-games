import { SURFACE_LEVEL, type Water } from '../core/water';

type Vertex = { x: number; y: number; value: number };
// Triangles sharing interpolated edge intersections produce a continuous contour.
// Only surface cells need polygons; the interior is merged into horizontal runs.
export function traceSurface(water: Water, fill: (points: number[]) => void, line: (x1: number, y1: number, x2: number, y2: number) => void): void {
  const { field, fieldCols: cols, fieldRows: rows, fieldSize: s } = water;
  for (let row = 0; row < rows - 1; row++) {
    let run = -1;
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const v0 = col < cols - 1 ? field[index] : 0, v1 = col < cols - 1 ? field[index + 1] : 0;
      const v2 = col < cols - 1 ? field[index + cols + 1] : 0, v3 = col < cols - 1 ? field[index + cols] : 0;
      const mask = (v0 >= SURFACE_LEVEL ? 1 : 0) | (v1 >= SURFACE_LEVEL ? 2 : 0) | (v2 >= SURFACE_LEVEL ? 4 : 0) | (v3 >= SURFACE_LEVEL ? 8 : 0);
      if (mask === 15) { if (run < 0) run = col; continue; }
      if (run >= 0) { fill([run * s, row * s, col * s, row * s, col * s, (row + 1) * s, run * s, (row + 1) * s]); run = -1; }
      if (mask === 0) continue;
      const corners: Vertex[] = [
        { x: col * s, y: row * s, value: v0 }, { x: (col + 1) * s, y: row * s, value: v1 },
        { x: (col + 1) * s, y: (row + 1) * s, value: v2 }, { x: col * s, y: (row + 1) * s, value: v3 },
      ];
      const center = { x: (col + .5) * s, y: (row + .5) * s, value: (v0 + v1 + v2 + v3) / 4 };
      for (let n = 0; n < 4; n++) {
        const triangle = [corners[n], corners[(n + 1) % 4], center];
        const polygon: number[] = [], cuts: number[] = [];
        for (let j = 0; j < 3; j++) {
          const a = triangle[j], b = triangle[(j + 1) % 3];
          const insideA = a.value >= SURFACE_LEVEL, insideB = b.value >= SURFACE_LEVEL;
          if (insideA) polygon.push(a.x, a.y);
          if (insideA !== insideB) {
            const t = (SURFACE_LEVEL - a.value) / (b.value - a.value);
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
            polygon.push(x, y); cuts.push(x, y);
          }
        }
        if (polygon.length >= 6) fill(polygon);
        if (cuts.length === 4) line(cuts[0], cuts[1], cuts[2], cuts[3]);
      }
    }
  }
}
