import type { Stage } from '../types';
import { gravityAt } from '../types';
import { Water } from '../core/water';
import { FIXED_STEP, SubmarinePhysics } from '../core/submarine';
import { TiltController } from '../input/orientation';

export type GameStatus = 'ready' | 'playing' | 'paused' | 'won';

export class Game {
  water: Water;
  submarine: SubmarinePhysics;
  readonly tilt = new TiltController();
  status: GameStatus = 'ready';
  elapsed = 0;
  completedGates = 0;
  stageIndex = 0;
  tankDirection = 0;
  keyboardTilt = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private raf = 0;
  onStatusChange: () => void = () => {};
  onUpdate: () => void = () => {};
  onStageChange: () => void = () => {};
  render: () => void = () => {};

  constructor(public stage: Stage, readonly stages: Stage[] = [stage]) {
    this.water = new Water(stage);
    this.submarine = new SubmarinePhysics(stage);
    this.stageIndex = Math.max(0, stages.findIndex(s => s.id === stage.id));
  }

  selectStage(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.stages.length) return;
    this.stageIndex = index;
    this.stage = this.stages[index];
    this.water = new Water(this.stage);
    this.submarine = new SubmarinePhysics(this.stage);
    this.reset();
    this.onStageChange();
  }

  nextStage(): void {
    if (this.status !== 'won' || this.stageIndex + 1 >= this.stages.length) return;
    this.selectStage(this.stageIndex + 1);
    this.start();
  }

  start(): void {
    this.status = 'playing';
    this.accumulator = 0;
    this.lastFrame = 0;
    this.onStatusChange();
  }

  reset(): void {
    this.water.reset();
    this.submarine.reset();
    this.tilt.calibrate();
    this.elapsed = 0;
    this.completedGates = 0;
    this.accumulator = 0;
    this.tankDirection = 0;
    this.keyboardTilt = 0;
    this.status = 'ready';
    this.onStatusChange();
    this.onUpdate();
  }

  togglePause(): void {
    if (this.status !== 'playing' && this.status !== 'paused') return;
    this.status = this.status === 'playing' ? 'paused' : 'playing';
    this.tankDirection = 0;
    this.keyboardTilt = 0;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.onStatusChange();
  }

  step(): void {
    if (this.status !== 'playing') return;
    if (this.tilt.mode === 'manual' && this.keyboardTilt) this.tilt.setManual(this.tilt.target + this.keyboardTilt * 65 * FIXED_STEP);
    this.tilt.update(FIXED_STEP);
    const gravity = gravityAt(this.tilt.angle);
    // Both fluid and rigid bodies run at 60 Hz in fixed world coordinates.
    this.water.step(gravity);
    this.submarine.step(this.water, gravity, this.tankDirection);
    this.elapsed += FIXED_STEP;
    const pos = this.submarine.body.position;
    while (this.completedGates < this.stage.checkpoints.length && pos.x > this.stage.checkpoints[this.completedGates].x + 42) this.completedGates++;
    const exit = this.stage.exit;
    const bounds = this.submarine.body.bounds;
    if (bounds.max.x >= exit.x && bounds.min.x <= exit.x + exit.width && bounds.max.y >= exit.y && bounds.min.y <= exit.y + exit.height) {
      this.status = 'won';
      this.tankDirection = 0;
      this.keyboardTilt = 0;
      this.onStatusChange();
    }
  }

  get renderBlend(): number {
    return this.status === 'playing' ? Math.min(this.accumulator / FIXED_STEP, 1) : 1;
  }

  run(): void {
    const frame = (time: number) => {
      const delta = this.lastFrame ? Math.min((time - this.lastFrame) / 1000, .1) : 0;
      this.lastFrame = time;
      if (this.status === 'playing') {
        this.accumulator += delta;
        let steps = 0;
        while (this.accumulator >= FIXED_STEP && steps < 6) {
          this.step();
          this.accumulator -= FIXED_STEP;
          steps++;
        }
      } else this.accumulator = 0;
      this.render();
      this.onUpdate();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => {
      this.lastFrame = 0;
      this.accumulator = 0;
      if (document.hidden && this.status === 'playing') this.togglePause();
    });
  }

  dispose(): void { cancelAnimationFrame(this.raf); }
}

export function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
