export interface Vector { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface DensityZone extends Rect { density: number; label: string }
export interface Spike extends Rect { direction: 'up' | 'down' | 'left' | 'right' }
export interface Switch extends Vector { id: string; label: string }
export interface Door extends Rect { id: string; label: string; switches: string[] }
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
  densityZones?: DensityZone[];
  difficulty?: number;
  mission?: string;
  accent?: string;
  spikes?: Spike[];
  switches?: Switch[];
  doors?: Door[];
  repairs?: Rect[];
}
export const wrapAngle = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180;
export const unwrapAngle = (angle: number, reference: number) => reference + wrapAngle(angle - reference);
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const gravityAt = (angle: number): Vector => {
  const radians = angle * Math.PI / 180;
  return { x: Math.sin(radians), y: Math.cos(radians) };
};
