import type { Game } from '../game/game';
import { traceSurface } from './surface';
import { gravityAt, type Vector } from '../types';
import { spikeTriangles } from '../core/mechanics';
import { canvasPixelRatio, FrameQuality } from './performance';

const TAU = Math.PI * 2;
const font = '"Segoe UI", "Malgun Gothic", sans-serif';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private waterCanvas = document.createElement('canvas');
  private waterContext: CanvasRenderingContext2D;
  private materialCanvas = document.createElement('canvas');
  private materialContext: CanvasRenderingContext2D;
  private backgroundCanvas = document.createElement('canvas');
  private sceneryCanvas = document.createElement('canvas');
  private quality = new FrameQuality(window.matchMedia('(pointer: coarse)').matches);
  private openArea = new Path2D();
  private materialImage!: ImageData;
  private waterStamp = -1;
  private lastBlend = -1;
  private geometryStamp = -1;
  private lastWaterPaint = -Infinity;
  private width = 0;
  private height = 0;
  private pixelRatio = 1;
  private trail: Vector[] = [];
  private observer: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, private game: Game) {
    const ctx = canvas.getContext('2d', { alpha: false });
    const waterContext = this.waterCanvas.getContext('2d');
    const materialContext = this.materialCanvas.getContext('2d');
    if (!ctx || !waterContext || !materialContext) throw new Error('Canvas를 지원하는 브라우저가 필요합니다.');
    this.ctx = ctx;
    this.waterContext = waterContext;
    this.materialContext = materialContext;
    this.reset();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.pixelRatio = canvasPixelRatio(this.width, this.height, window.devicePixelRatio, this.quality.lowDetail);
    const width = Math.round(this.width * this.pixelRatio), height = Math.round(this.height * this.pixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.draw();
  }

  recordFrameCost(milliseconds: number): void {
    if (!this.quality.record(milliseconds)) return;
    this.reset();
    this.resize();
  }

  reset(): void {
    this.trail = []; this.waterStamp = -1; this.lastBlend = -1;
    const { water, stage } = this.game;
    water.setSurfaceResolution(this.quality.lowDetail ? 12 : 8);
    this.game.renderInterval = 1000 / (this.quality.lowDetail ? 30 : 60);
    this.lastWaterPaint = -Infinity;
    this.waterCanvas.width = stage.width; this.waterCanvas.height = stage.height;
    this.materialCanvas.width = water.fieldCols; this.materialCanvas.height = water.fieldRows;
    this.materialImage = this.materialContext.createImageData(water.fieldCols, water.fieldRows);
    this.rebuildOpenArea();
    this.backgroundCanvas.width = this.sceneryCanvas.width = stage.width;
    this.backgroundCanvas.height = this.sceneryCanvas.height = stage.height;
    const background = this.backgroundCanvas.getContext('2d')!;
    const gradient = background.createLinearGradient(0, 0, stage.width, stage.height);
    gradient.addColorStop(0, '#102a3d'); gradient.addColorStop(1, '#153e52');
    background.fillStyle = gradient; background.fillRect(0, 0, stage.width, stage.height);
    this.drawExit(background);
    const scenery = this.sceneryCanvas.getContext('2d')!;
    this.drawWalls(scenery);
    this.drawFixtures(scenery);
  }

  private rebuildOpenArea(): void {
    const { water } = this.game;
    this.geometryStamp = water.geometryRevision;
    this.openArea = new Path2D();
    for (let row = 0; row < water.rows; row++) {
      let start = -1;
      for (let col = 0; col <= water.cols; col++) {
        const open = col < water.cols && !water.solid[row * water.cols + col];
        if (open && start < 0) start = col;
        if (!open && start >= 0) { this.openArea.rect(start * water.size, row * water.size, (col - start) * water.size, water.size); start = -1; }
      }
    }
  }

  draw(): void {
    if (!this.width || !this.height) return;
    const { ctx, game } = this;
    const { stage } = game;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.fillStyle = '#102e42';
    ctx.fillRect(0, 0, this.width, this.height);
    const scale = Math.min(this.width / stage.width, this.height / stage.height);
    ctx.translate((this.width - stage.width * scale) / 2, (this.height - stage.height * scale) / 2);
    ctx.scale(scale, scale);
    ctx.drawImage(this.backgroundCanvas, 0, 0);
    const geometryChanged = this.geometryStamp !== game.water.geometryRevision;
    if (geometryChanged) this.rebuildOpenArea();
    const stamp = game.water.revision;
    const blend = game.renderBlend;
    const now = performance.now();
    const waterInterval = 1000 / (this.quality.lowDetail ? 20 : 30);
    if (geometryChanged || (this.waterStamp !== stamp || Math.abs(this.lastBlend - blend) > .001) &&
      (game.status !== 'playing' || now - this.lastWaterPaint >= waterInterval - 1)) {
      this.paintWater(blend);
      this.waterStamp = stamp;
      this.lastBlend = blend;
      this.lastWaterPaint = now;
    }
    ctx.drawImage(this.waterCanvas, 0, 0);
    ctx.drawImage(this.sceneryCanvas, 0, 0);
    this.drawMechanics();
    this.drawWaypoints();
    this.drawSubmarine();
  }

  private paintWater(blend: number): void {
    const { water, stage } = this.game;
    water.buildSurface(blend);
    const liquid = new Path2D(), surface = new Path2D();
    traceSurface(water, points => {
      liquid.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) liquid.lineTo(points[i], points[i + 1]);
      liquid.closePath();
    }, (x1, y1, x2, y2) => { surface.moveTo(x1, y1); surface.lineTo(x2, y2); });
    const ctx = this.waterContext;
    ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.save(); ctx.clip(this.openArea);
    const gradient = ctx.createLinearGradient(0, 0, 0, stage.height);
    gradient.addColorStop(0, 'rgba(68,199,226,.56)');
    gradient.addColorStop(1, 'rgba(23,142,193,.64)');
    ctx.fillStyle = gradient; ctx.fill(liquid);
    if (stage.densityZones?.length) {
      const pixels = this.materialImage.data;
      for (let i = 0; i < water.field.length; i++) {
        const density = water.field[i] > .01 ? water.materialField[i] / water.field[i] : 1;
        const high = density >= 1;
        pixels[i * 4] = high ? 170 : 247;
        pixels[i * 4 + 1] = high ? 126 : 203;
        pixels[i * 4 + 2] = high ? 245 : 108;
        pixels[i * 4 + 3] = Math.min(Math.abs(density - 1) / .3, 1) * 130;
      }
      this.materialContext.putImageData(this.materialImage, 0, 0);
      ctx.save(); ctx.clip(liquid); ctx.globalCompositeOperation = 'source-atop';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.materialCanvas, -water.fieldSize / 2, -water.fieldSize / 2, water.fieldCols * water.fieldSize, water.fieldRows * water.fieldSize);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(163,235,247,.4)'; ctx.lineWidth = 1.25;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(surface);
    ctx.restore();
  }

  private drawWalls(ctx: CanvasRenderingContext2D): void {
    for (const wall of this.game.stage.walls) {
      ctx.fillStyle = '#355165';
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      ctx.strokeStyle = this.game.stage.accent ?? '#526d7d';
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x + 1, wall.y + 1, wall.width - 2, wall.height - 2);
      const inner = wall.x > 24 && wall.y > 24 || (wall.x > 24 && wall.height > 48);
      if (inner) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(wall.x + 3, wall.y + 3, wall.width - 6, wall.height - 6);
        ctx.clip();
        ctx.strokeStyle = 'rgba(164,193,200,.13)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let d = -wall.height; d < wall.width; d += 16) {
          ctx.moveTo(wall.x + d, wall.y + wall.height);
          ctx.lineTo(wall.x + d + wall.height, wall.y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawFixtures(ctx: CanvasRenderingContext2D): void {
    const { game } = this;
    ctx.textAlign = 'center';
    for (const pad of game.stage.repairs ?? []) {
      ctx.fillStyle = 'rgba(99,223,165,.12)';
      ctx.strokeStyle = '#77e6b0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(pad.x, pad.y, pad.width, pad.height, 12); ctx.fill(); ctx.stroke();
      ctx.font = `700 23px ${font}`; ctx.fillStyle = '#a3f5cd';
      ctx.fillText('＋', pad.x + pad.width / 2, pad.y + 24);
      ctx.font = `600 10px ${font}`; ctx.fillText('정비소', pad.x + pad.width / 2, pad.y + pad.height - 8);
    }
    for (const spike of game.stage.spikes ?? []) {
      ctx.fillStyle = '#dc6d7d'; ctx.strokeStyle = '#ffc0ba'; ctx.lineWidth = 1.3;
      for (const points of spikeTriangles(spike)) {
        ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
        for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }

  private drawMechanics(): void {
    const { ctx, game } = this;
    ctx.textAlign = 'center';
    for (const door of game.stage.doors ?? []) {
      const open = game.openedDoors.has(door.id);
      const progress = open ? Math.min(1, (game.elapsed - (game.doorOpenedAt.get(door.id) ?? 0)) / .45) : 0;
      ctx.save();
      ctx.strokeStyle = open ? '#97edba' : '#76d8f0'; ctx.lineWidth = 2;
      ctx.globalAlpha = open ? 1 - progress * .85 : 1;
      if (!open || progress < 1) {
        ctx.fillStyle = open ? '#337965' : '#296580';
        const vertical = door.height > door.width;
        ctx.fillRect(door.x, door.y, vertical ? door.width : door.width * (1 - progress), vertical ? door.height * (1 - progress) : door.height);
        ctx.beginPath();
        for (let t = 8; t < (vertical ? door.height : door.width); t += 18) {
          if (vertical) { ctx.moveTo(door.x + 3, door.y + t); ctx.lineTo(door.x + door.width - 3, door.y + t); }
          else { ctx.moveTo(door.x + t, door.y + 3); ctx.lineTo(door.x + t, door.y + door.height - 3); }
        }
        ctx.stroke();
      }
      ctx.setLineDash(open ? [4, 5] : []); ctx.strokeRect(door.x, door.y, door.width, door.height); ctx.setLineDash([]);
      const cx = door.x + door.width / 2, cy = door.y + door.height / 2;
      const label = open ? '열림' : door.switches.join('+');
      ctx.font = `700 13px ${font}`;
      const labelWidth = Math.max(32, ctx.measureText(label).width + 12);
      ctx.fillStyle = '#123a4e'; ctx.beginPath(); ctx.roundRect(cx - labelWidth / 2, cy - 12, labelWidth, 24, 6); ctx.fill();
      ctx.fillStyle = open ? '#c3f7d5' : '#ceeff9'; ctx.fillText(label, cx, cy + 5);
      ctx.restore();
    }
    for (const button of game.stage.switches ?? []) {
      const pressed = game.pressedSwitches.has(button.id);
      ctx.strokeStyle = pressed ? '#9cf1bc' : '#80dbed'; ctx.lineWidth = 2;
      ctx.fillStyle = pressed ? '#276b58' : '#235674';
      ctx.beginPath(); ctx.arc(button.x, button.y, 23, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pressed ? '#b5f8ce' : '#a7edff';
      ctx.font = `700 17px ${font}`; ctx.fillText(button.label, button.x, button.y + 6);
      ctx.font = `600 10px ${font}`; ctx.fillStyle = '#badce5';
      ctx.fillText(pressed ? `${button.label} 작동` : '스위치', button.x, button.y + 39);
    }
  }

  private drawExit(ctx: CanvasRenderingContext2D): void {
    const exit = this.game.stage.exit;
    ctx.fillStyle = 'rgba(74,217,174,.12)';
    ctx.beginPath(); ctx.roundRect(exit.x, exit.y, exit.width, exit.height, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(110,236,189,.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#9df5d0';
    ctx.font = `600 16px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('출구', exit.x + exit.width / 2, exit.y - 16);
    ctx.font = `700 30px ${font}`;
    const dx = exit.x + exit.width / 2 - this.game.stage.start.x;
    const dy = exit.y + exit.height / 2 - this.game.stage.start.y;
    ctx.fillText(Math.abs(dx) > Math.abs(dy) ? dx < 0 ? '←' : '→' : dy < 0 ? '↑' : '↓', exit.x + exit.width / 2, exit.y + exit.height / 2 + 8);
    ctx.font = `600 10px ${font}`;
    ctx.fillText('EXIT', exit.x + exit.width / 2, exit.y + exit.height - 16);
  }

  private drawWaypoints(): void {
    const ctx = this.ctx;
    const { stage, completedGates } = this.game;
    ctx.textAlign = 'center';
    stage.checkpoints.forEach((p, i) => {
      const done = i < completedGates;
      ctx.fillStyle = done ? 'rgba(109,220,173,.12)' : 'rgba(206,231,239,.05)';
      ctx.strokeStyle = done ? 'rgba(122,231,178,.7)' : 'rgba(196,224,233,.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = done ? '#9cefc4' : '#accbd6';
      ctx.font = `600 15px ${font}`;
      ctx.fillText(done ? '✓' : p.label, p.x, p.y + 5);
    });
    ctx.fillStyle = 'rgba(199,227,235,.55)';
    ctx.font = `600 10px ${font}`;
    ctx.fillText('START', stage.start.x, stage.start.y + 49);
  }

  private drawSubmarine(): void {
    const ctx = this.ctx;
    const { submarine, elapsed, status } = this.game;
    const pos = submarine.body.position;
    if (status === 'playing' && (this.trail.length === 0 || Math.hypot(pos.x - this.trail[this.trail.length - 1].x, pos.y - this.trail[this.trail.length - 1].y) > 5)) {
      this.trail.push({ ...pos });
      if (this.trail.length > 35) this.trail.shift();
    }
    if (this.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255,208,104,.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 6]); ctx.beginPath();
      this.trail.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.shadowColor = 'rgba(255,212,101,.35)';
    ctx.shadowBlur = this.quality.lowDetail ? 0 : 12;
    ctx.fillStyle = '#ffd06d';
    ctx.beginPath(); ctx.roundRect(-26, -16, 52, 32, 14); ctx.fill();
    ctx.shadowBlur = 0;
    // All decoration stays within the physical hull.
    ctx.fillStyle = '#e8a842';
    ctx.beginPath(); ctx.roundRect(-23, 5, 45, 8, 4); ctx.fill();
    ctx.strokeStyle = '#ffe8a9';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-25, -15, 50, 30, 13); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(-19, -7, 17, 16, 3); ctx.clip();
    ctx.fillStyle = '#9e7136'; ctx.fillRect(-19, -7, 17, 16);
    ctx.fillStyle = '#62c8e7'; ctx.fillRect(-19, 9 - 16 * submarine.tank, 17, 16 * submarine.tank);
    ctx.restore();
    ctx.strokeStyle = '#f9e0a5'; ctx.lineWidth = 1; ctx.strokeRect(-18.5, -6.5, 16, 15);
    ctx.fillStyle = '#244a5d';
    ctx.beginPath(); ctx.arc(11, -1, 9.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff0bc'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#95dce8';
    ctx.beginPath(); ctx.arc(9, -3, 4.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d3f3f6'; ctx.beginPath(); ctx.arc(8, -5, 1.7, 0, TAU); ctx.fill();
    ctx.restore();
    if (submarine.leakRemaining > 0) {
      const g = gravityAt(this.game.tilt.angle);
      ctx.strokeStyle = '#ff8f9b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pos.x - 19, pos.y - 12); ctx.lineTo(pos.x - 13, pos.y - 6); ctx.lineTo(pos.x - 19, pos.y); ctx.stroke();
      ctx.fillStyle = '#87dcea';
      for (let i = 0; i < 4; i++) {
        const life = (elapsed * 2.2 + i / 4) % 1;
        ctx.globalAlpha = 1 - life;
        ctx.beginPath(); ctx.arc(pos.x - 20 - life * (g.x * 30 + 8), pos.y - 8 - life * g.y * 30, 2 + life * 3, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (status === 'ready') {
      ctx.strokeStyle = `rgba(255,215,115,${.25 + .12 * Math.sin(elapsed)})`;
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pos.x, pos.y, 40, 0, TAU); ctx.stroke();
    }
  }

}
