import type { Stage } from '../types';
import { gravityAt } from '../types';
import { Water } from '../core/water';
import { FIXED_STEP, SubmarinePhysics } from '../core/submarine';
import { TiltController } from '../input/orientation';
import { hullTouchesCircle, overlaps } from '../core/mechanics';

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
  readonly pressedSwitches = new Set<string>();
  readonly openedDoors = new Set<string>();
  readonly doorOpenedAt = new Map<string, number>();
  message = '';
  messageUntil = 0;
  renderInterval = 1000 / 60;
  private accumulator = 0;
  private lastFrame: number | null = null;
  private lastRender = -Infinity;
  private renderPending = true;
  private lastDrawnStatus: GameStatus | null = null;
  private raf = 0;
  private running = false;
  onStatusChange: () => void = () => {};
  onUpdate: () => void = () => {};
  onStageChange: () => void = () => {};
  render: () => void = () => {};
  onFrameCost: (milliseconds: number) => void = () => {};

  private readonly visibilityChanged = () => {
    this.lastFrame = null;
    this.accumulator = 0;
    if (document.hidden && this.status === 'playing') this.togglePause();
  };

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
    this.lastFrame = null;
    this.renderPending = true;
    if (!this.elapsed) this.notify(this.stage.mission ?? '탱크의 물을 조절하고 기울여 출구로 이동하세요.', 7);
    this.onStatusChange();
  }

  reset(): void {
    this.water.reset();
    this.submarine.reset();
    this.tilt.calibrate();
    this.elapsed = 0;
    this.completedGates = 0;
    this.accumulator = 0;
    this.lastFrame = null;
    this.renderPending = true;
    this.tankDirection = 0;
    this.keyboardTilt = 0;
    this.pressedSwitches.clear();
    this.openedDoors.clear();
    this.doorOpenedAt.clear();
    this.message = '';
    this.messageUntil = 0;
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
    this.lastFrame = null;
    this.renderPending = true;
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
    this.updateMechanics();
    const pos = this.submarine.body.position;
    while (this.completedGates < this.stage.checkpoints.length && pos.x > this.stage.checkpoints[this.completedGates].x + 42) this.completedGates++;
    const exit = this.stage.exit;
    const bounds = this.submarine.body.bounds;
    if (this.openedDoors.size === (this.stage.doors?.length ?? 0) && bounds.max.x >= exit.x && bounds.min.x <= exit.x + exit.width && bounds.max.y >= exit.y && bounds.min.y <= exit.y + exit.height) {
      this.status = 'won';
      this.tankDirection = 0;
      this.keyboardTilt = 0;
      this.onStatusChange();
    }
  }

  notify(message: string, seconds = 4): void {
    this.message = message;
    this.messageUntil = this.elapsed + seconds;
  }

  private updateMechanics(): void {
    const sub = this.submarine, position = sub.body.position;
    if (sub.touchingSpike && sub.hitSpike()) this.notify('가시 접촉! 탱크 누수로 가벼워집니다. ＋ 정비소에서 수리하세요.');
    const hull = { x: sub.body.bounds.min.x, y: sub.body.bounds.min.y, width: sub.body.bounds.max.x - sub.body.bounds.min.x, height: sub.body.bounds.max.y - sub.body.bounds.min.y };
    if (this.stage.repairs?.some(pad => overlaps(hull, pad)) && sub.repair()) this.notify('수리 완료! 탱크를 다시 조절할 수 있습니다.');
    for (const button of this.stage.switches ?? []) {
      if (this.pressedSwitches.has(button.id) || !hullTouchesCircle(position, button)) continue;
      this.pressedSwitches.add(button.id);
      this.notify(`${button.label} 스위치 작동! 연결된 문을 확인하세요.`);
    }
    let changed = false;
    for (const door of this.stage.doors ?? []) {
      if (this.openedDoors.has(door.id) || !door.switches.every(id => this.pressedSwitches.has(id))) continue;
      this.openedDoors.add(door.id);
      this.doorOpenedAt.set(door.id, this.elapsed);
      sub.openDoor(door.id);
      changed = true;
      this.notify(`${door.label} 문이 열렸습니다! 물길도 이어집니다.`);
    }
    if (changed) this.water.openDoors(this.openedDoors);
  }

  get renderBlend(): number {
    return this.status === 'playing' ? Math.min(this.accumulator / FIXED_STEP, 1) : 1;
  }

  run(): void {
    if (this.running) return;
    this.running = true;
    const frame = (time: number) => {
      if (!this.running) return;
      const started = performance.now();
      const delta = this.lastFrame === null ? 0 : Math.max(0, Math.min((time - this.lastFrame) / 1000, .1));
      this.lastFrame = time;
      if (this.status === 'playing') {
        this.accumulator += delta;
        let steps = 0;
        // Never turn one slow frame into a burst of six expensive fluid steps.
        // Keep the 60 Hz physics rule and discard time we cannot catch up with.
        while (this.accumulator >= FIXED_STEP && steps < 2 && this.status === 'playing') {
          this.step();
          this.accumulator -= FIXED_STEP;
          steps++;
        }
        if (this.accumulator >= FIXED_STEP) this.accumulator %= FIXED_STEP;
      } else this.accumulator = 0;
      const changed = this.renderPending || this.lastDrawnStatus !== this.status;
      if (changed || this.status === 'playing' && time - this.lastRender >= this.renderInterval - 1) {
        this.renderPending = false;
        this.lastDrawnStatus = this.status;
        this.lastRender = time;
        this.render();
        this.onUpdate();
        if (this.status === 'playing') this.onFrameCost(performance.now() - started);
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
  }
}

export function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
