export interface Vector { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface Stage {
  id: string;
  name: string;
  width: number;
  height: number;
  cellSize: number;
  waterFraction: number;
  start: Vector;
  exit: Rect;
  walls: Rect[];
  checkpoints: { x: number; y: number; label: string; hint: string }[];
}
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const gravityAt = (angle: number): Vector => {
  const radians = angle * Math.PI / 180;
  return { x: Math.sin(radians), y: Math.cos(radians) };
};
