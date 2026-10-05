import { FrictionField, applySurfaceForces } from './physics/SurfacePhysics.js';
import { TiltController } from './input/TiltController.js';
import { stages, stageLayout } from './stages.js';
import { GOAL, updateGoal } from './physics/Goal.js';
import { makeRuleState, updateRules, goalReady } from './systems/StageRules.js';
import { SurfaceRenderer } from './render/SurfaceRenderer.js';
const $ = id => document.getElementById(id);
let stageIndex = 0, mode = 'hand', scene, complete = false;
let toastTimer;
function notify(message) { $('board-message').textContent = message; $('board-message').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('board-message').hidden = true, 3500); }
let tilt = new TiltController(message => { $('tilt-status').textContent = message; notify(message); });
const Body = Phaser.Physics.Matter.Matter.Body;
class Lab extends Phaser.Scene {
  constructor() { super('Lab'); }
  create() {
    scene = this;
    this.art = this.add.graphics(); this.labels = []; this.trail = []; this.forcesUntil = 0;
    this.floor = new SurfaceRenderer(this);
    this.layout();
    this.scale.on('resize', () => { this.layout(); this.loadStage(false); });
    this.input.on('pointerdown', pointer => { if (!complete) this.stroke = this.cameras.main.getWorldPoint(pointer.x, pointer.y); });
    this.input.on('pointermove', pointer => {
      if (!pointer.isDown || !this.stroke || complete || this.rules.failed) return;
      const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const dx = point.x - this.stroke.x, dy = point.y - this.stroke.y, distance = Math.hypot(dx, dy);
      if (distance < 2) return;
      const steps = Math.ceil(distance / 7);
      for (let i = 1; i <= steps; i++) this.field.paint(this.stroke.x + dx * i / steps, this.stroke.y + dy * i / steps, mode, Math.min(.09, distance / steps * .009));
      this.stroke = point;
    });
    this.input.on('pointerup', () => this.stroke = null);
    this.input.on('gameout', () => this.stroke = null);
    this.matter.world.on('beforeupdate', () => {
      if (!this.body || complete || document.hidden || $('help-dialog').open) return;
      const gravity = tilt.update();
      this.contactForces = applySurfaceForces(Body, this.body, this.field, gravity, stages[stageIndex].box);
    });
    this.loadStage(true);
  }
  layout() {
    this.zoom = Math.min(this.scale.width / 832, this.scale.height / 480);
    this.worldWidth = this.scale.width / this.zoom; this.worldHeight = this.scale.height / this.zoom;
    this.cameras.main.setZoom(this.zoom).setScroll((this.worldWidth - this.scale.width) / 2, (this.worldHeight - this.scale.height) / 2);
    this.field?.resize(this.worldWidth, this.worldHeight);
  }
  loadStage(resetField) {
    const stage = stages[stageIndex]; complete = false; $('result').hidden = true; this.dwell = 0; this.elapsed = 0; this.trail = []; this.forcesUntil = 0;
    this.stroke = null; this.contactForces = []; tilt.calibrate(); this.outside = false;
    const layout = stageLayout(stage, this.worldWidth, this.worldHeight);
    this.spawn = layout.spawn; this.target = layout.target;
    if (resetField || !this.field) this.field = new FrictionField(stage.rough, this.worldWidth, this.worldHeight);
    this.field.zones = layout.zones; this.checkpoints = layout.checkpoints; this.rules = makeRuleState(); this.failNotified = false;
    this.floor.reset(this.field);
    Object.values(this.dynamicLabels ?? {}).forEach(label => label.destroy()); this.dynamicLabels = {};
    if (this.body) this.matter.world.remove(this.body);
    for (const wall of this.walls ?? []) this.matter.world.remove(wall);
    this.walls = layout.walls.map(wall => this.matter.add.rectangle(wall.x, wall.y, wall.width, wall.height, { isStatic: true }));
    this.body = stage.box ? this.matter.add.rectangle(...this.spawn, 108, 44, { frictionAir: .006, restitution: .2, friction: .1 }) : this.matter.add.circle(...this.spawn, 20, { frictionAir: .002, restitution: .48, friction: .1 });
    this.labels.forEach(label => label.destroy()); this.labels = [];
    for (const zone of layout.zones) this.label(zone.x + 8, zone.y + 8, zone.mode === 'fixed' ? `${zone.name} · 수정 불가` : zone.name, 10, '#d0ddd6');
    this.label(this.worldWidth / 2, 18, `${stage.number} / 10 · ${stage.title}`, 12, '#eef6ea', true);
    if (stage.gate) this.label(this.target[0], stage.gate.y / 480 * this.worldHeight - 25, '좁은 통로', 11, '#dfba71', true);
    $('lab-number').textContent = `${String(stageIndex + 1).padStart(2, '0')} / ${stages.length}`;
    $('result-title').textContent = stageIndex === stages.length - 1 ? '10단계 완료! 연구소 탈출 성공!' : '철컥! 문이 열렸어요.';
    $('mission-title').textContent = stage.title; $('mission-text').textContent = stage.text; $('goal-text').textContent = stage.goal; $('hint-text').textContent = stage.note;
    $('board-message').hidden = true;
    $('hand').disabled = stage.tool === 'sand'; $('sand').disabled = stage.tool === 'hand'; setMode(stage.tool ?? mode);
    document.querySelectorAll('[data-stage]').forEach((button, i) => { button.classList.toggle('selected', i === stageIndex); button.setAttribute('aria-pressed', i === stageIndex); });
  }
  label(x, y, text, size, color, center = false) { const label = this.add.text(x, y, text, { fontFamily: 'Noto Sans KR, sans-serif', fontSize: size, color, letterSpacing: 2 }); if (center) label.setOrigin(.5); this.labels.push(label); return label; }
  dynamicText(key, x, y, text, style, centered = false) {
    let label = this.dynamicLabels[key];
    if (!label) { label = this.add.text(x, y, text, style); if (centered) label.setOrigin(.5); this.dynamicLabels[key] = label; }
    if (label.text !== text) label.setText(text);
    return label.setPosition(x, y).setVisible(true);
  }
  arrow(x, y, dx, dy, color, name) {
    const g = this.art, length = Math.hypot(dx, dy); if (length < 3) return;
    g.lineStyle(2, color, .9); g.lineBetween(x, y, x + dx, y + dy);
    const a = Math.atan2(dy, dx); g.lineBetween(x + dx, y + dy, x + dx - Math.cos(a - .5) * 9, y + dy - Math.sin(a - .5) * 9); g.lineBetween(x + dx, y + dy, x + dx - Math.cos(a + .5) * 9, y + dy - Math.sin(a + .5) * 9);
    if (name) this.dynamicText(name, x + dx + 5, y + dy - 8, name, { fontFamily: 'sans-serif', fontSize: 11, color: color === 0xefa963 ? '#efa963' : '#7accc1' });
  }
  update(time, delta) {
    if (!this.body) return;
    delta = Math.min(delta, 50);
    if (!complete && !$('help-dialog').open && !document.hidden) this.elapsed += delta;
    const stage = stages[stageIndex], b = this.body, g = this.art;
    Object.values(this.dynamicLabels).forEach(label => label.setVisible(false));
    this.floor.update(this.field, time); g.clear();
    // Ghost start mark and target switch.
    g.lineStyle(1, 0x73929a, .5); g.strokeCircle(...this.spawn, 28);
    const [tx, ty] = this.target;
    const radius = stage.radius;
    const ready = goalReady(stage, this.rules, b), goalColor = this.rules.failed ? 0xd77665 : ready ? 0x64b993 : 0x9a9190;
    g.fillStyle(ready ? 0x245346 : 0x403b43, .65); g.fillCircle(tx, ty, radius); g.lineStyle(2, goalColor, .85); g.strokeCircle(tx, ty, radius); g.lineStyle(1, goalColor, .35); g.strokeCircle(tx, ty, radius - 6);
    if (stage.goalAngle != null) { const points = [[-54,-22],[54,-22],[54,22],[-54,22]].map(([px,py]) => ({ x: tx + px * Math.cos(stage.goalAngle) - py * Math.sin(stage.goalAngle), y: ty + px * Math.sin(stage.goalAngle) + py * Math.cos(stage.goalAngle) })); g.lineStyle(2, 0xd9c58e, .65); g.strokePoints(points, true); }
    if (this.dwell > 0) { g.lineStyle(4, 0xb3f5c3); g.beginPath(); g.arc(tx, ty, radius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.dwell / GOAL.holdMs)); g.strokePath(); }
    g.fillStyle(0x89d0a2); g.fillRoundedRect(tx - 8, ty - 8, 16, 16, 4);
    for (const wall of this.walls) { g.fillStyle(0x677779); g.fillRect(wall.bounds.min.x, wall.bounds.min.y, wall.bounds.max.x - wall.bounds.min.x, wall.bounds.max.y - wall.bounds.min.y); g.lineStyle(2, 0xa1b2a9); g.lineBetween(wall.bounds.min.x, wall.bounds.min.y, wall.bounds.max.x, wall.bounds.min.y); }
    this.checkpoints.forEach((pad, index) => { const done = index < this.rules.checkpoint, active = index === this.rules.checkpoint; g.fillStyle(done ? 0x327e63 : 0x3b4058, .8); g.fillCircle(pad.x, pad.y, pad.radius); g.lineStyle(2, done ? 0x9debb6 : active ? 0xead27c : 0x747b91); g.strokeCircle(pad.x, pad.y, pad.radius); this.dynamicText(`pad-${index}`, pad.x, pad.y, pad.kind === 'speed' ? (done ? '✓' : `속도 ${pad.min}–${pad.max}`) : done ? '✓' : `${index + 1}`, { fontSize: pad.kind === 'speed' ? '12px' : '20px', fontFamily: 'sans-serif', color: '#f1e6af' }, true); if (active && this.rules.hold) { g.lineStyle(3, 0xf1dd80); g.beginPath(); g.arc(pad.x, pad.y, pad.radius + 4, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.min(1, this.rules.hold / 500)); g.strokePath(); } });
    const { x, y } = b.position;
    if (!complete && time - (this.trailTime ?? 0) > 100) { this.trail.push({ x, y }); if (this.trail.length > 22) this.trail.shift(); this.trailTime = time; }
    this.trail.forEach((p, i) => { g.fillStyle(0xa8d5c7, i / this.trail.length * .2); g.fillCircle(p.x, p.y, 2); });
    if (stage.box) {
      const transform = (lx, ly) => ({ x: x + lx * Math.cos(b.angle) - ly * Math.sin(b.angle), y: y + lx * Math.sin(b.angle) + ly * Math.cos(b.angle) });
      g.fillStyle(0x000000, .23); g.fillPoints(b.vertices.map(v => ({ x: v.x + 4, y: v.y + 5 })), true);
      g.fillStyle(0xd7c7a2); g.fillPoints(b.vertices, true); g.lineStyle(2, 0xf8e8bf); g.strokePoints(b.vertices, true);
      g.lineStyle(2, 0x9b895f); for (const ly of [-13, 13]) { const a = transform(-43, ly), z = transform(43, ly); g.lineBetween(a.x, a.y, z.x, z.y); }
      for (const lx of [-40, 40]) for (const ly of [-12, 12]) { const p = transform(lx, ly); g.fillStyle(0x83775a); g.fillCircle(p.x, p.y, 2.5); }
      const center = transform(-10, -5); this.dynamicText('box', center.x, center.y, 'BOX', { fontSize: '10px', color: '#736647', fontFamily: 'sans-serif' }).setRotation(b.angle);
    } else {
      g.fillStyle(0x000000, .25); g.fillCircle(x + 4, y + 5, 21); g.fillStyle(0xb8d7ce); g.fillCircle(x, y, 20); g.lineStyle(2, 0xf1f5df); g.strokeCircle(x, y, 20); g.fillStyle(0xf6f5dd, .8); g.fillCircle(x - 6, y - 7, 6); g.fillStyle(0x6e9691); g.fillCircle(x + 7, y + 8, 4);
    }
    if (time < this.forcesUntil) {
      this.arrow(x, y, tilt.value.x * 95, tilt.value.y * 95, 0x7accc1, '중력 성분');
      if (stage.box) { for (const f of this.contactForces ?? []) this.arrow(f.point.x, f.point.y, f.x / b.mass * 180000, f.y / b.mass * 180000, 0xefa963); }
      else { const f = this.contactForces?.[0]; if (f) this.arrow(x, y + 4, f.x / b.mass * 110000, f.y / b.mass * 110000, 0xefa963, '마찰력'); }
    }
    if (this.stroke) { g.lineStyle(2, mode === 'hand' ? 0x99e1c3 : 0xe4c27e, .7); g.strokeCircle(this.stroke.x, this.stroke.y, 28); }
    if (!complete && !$('help-dialog').open && !document.hidden) {
      const previousCheckpoint = this.rules.checkpoint;
      updateRules(b, this.checkpoints, this.rules, delta);
      if (this.rules.checkpoint > previousCheckpoint) notify(this.rules.checkpoint === this.checkpoints.length ? '장치 작동 완료! 골 안에서 1초 유지하세요.' : '첫 번째 스위치 완료! 다음 스위치로 이동하세요.');
      if (this.rules.failed && !this.failNotified) { this.failNotified = true; notify('너무 빠르게 통과했어요. ↺로 다시 시도하세요.'); }
      this.dwell = goalReady(stage, this.rules, b) ? updateGoal(b, this.target, stage.radius, stage.box, this.dwell, delta) : 0;
      if (this.dwell >= GOAL.holdMs) this.finish();
      if (!this.outside && (x < -60 || x > this.worldWidth + 60 || y < -60 || y > this.worldHeight + 60)) { this.outside = true; notify('물체가 화면 밖으로 나갔어요. ↺를 누르면 다시 돌아옵니다.'); }
    }
  }
  finish() {
    complete = true; const stage = stages[stageIndex];
    const mu = this.field.at(this.body.position.x, this.body.position.y);
    $('result-text').textContent = `${stage.result} 도착 지점의 표면: ${mu < .25 ? '매끄러운 편' : mu < .6 ? '중간 정도' : '거친 편'}. 실험 시간: ${Math.round(this.elapsed / 1000)}초.`;
    $('next').textContent = stageIndex === stages.length - 1 ? '1단계부터 다시 도전 →' : '다음 단계로 →'; $('result').hidden = false;
    Body.setVelocity(this.body, { x: 0, y: 0 }); Body.setAngularVelocity(this.body, 0);
  }
}
new Phaser.Game({ type: Phaser.AUTO, parent: 'game', backgroundColor: '#14232e', render: { antialias: false, powerPreference: 'low-power' }, fps: { target: 60, limit: 60 }, physics: { default: 'matter', matter: { gravity: { x: 0, y: 0 }, enableSleeping: false } }, scene: Lab, scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' } });
function setMode(value) { value = stages[stageIndex].tool ?? value; mode = value; $('hand').classList.toggle('active', value === 'hand'); $('sand').classList.toggle('active', value === 'sand'); $('hand').setAttribute('aria-pressed', value === 'hand'); $('sand').setAttribute('aria-pressed', value === 'sand'); }
$('hand').onclick = () => setMode('hand'); $('sand').onclick = () => setMode('sand'); setMode('hand');
window.addEventListener('keydown', e => { if ($('help-dialog').open) return; if (e.key === '1') setMode('hand'); if (e.key === '2') setMode('sand'); });
const stageMenu = $('stage-menu');
stages.forEach((stage, index) => { const button = document.createElement('button'); button.dataset.stage = index; button.textContent = `${index + 1}. ${stage.title}`; button.onclick = () => { if (scene) { stageIndex = index; scene.loadStage(true); $('help-dialog').close(); } }; stageMenu.append(button); });
$('forces').onclick = () => { if (scene) { scene.forcesUntil = scene.time.now + 3000; $('help-dialog').close(); notify('청록: 중력 성분 · 주황: 마찰력'); } };
$('hint').onclick = () => $('hint-text').textContent = stages[stageIndex].hint;
$('reset-object').onclick = () => scene?.loadStage(false); $('reset-all').onclick = () => scene?.loadStage(true); $('again').onclick = () => scene?.loadStage(false);
$('next').onclick = () => { stageIndex = (stageIndex + 1) % stages.length; scene.loadStage(true); };
$('level').onclick = () => { tilt.calibrate(); $('tilt-status').textContent = '수평을 맞췄어요.'; };
$('sensor').onclick = async () => { if (tilt.listener) { tilt.sensor = false; window.removeEventListener('deviceorientation', tilt.listener); tilt.listener = null; tilt.raw = null; tilt.baseline = null; clearTimeout(tilt.timeout); tilt.calibrate(); document.body.classList.remove('sensor-active'); $('sensor').innerHTML = '◇ <span>센서</span>'; $('sensor').title = '태블릿 센서 연결'; $('calibrate').hidden = true; $('tilt-status').textContent = '방향키 또는 화살표를 누르세요'; return; } if (await tilt.connect()) { $('sensor').title = '센서 연결 중 · 누르면 해제'; $('calibrate').hidden = false; } };
$('calibrate').onclick = () => { tilt.calibrate(); $('tilt-status').textContent = '현재 자세를 수평으로 맞췄어요.'; };
setInterval(() => { if (tilt.sensor && !document.body.classList.contains('sensor-active')) { document.body.classList.add('sensor-active'); $('sensor').innerHTML = '◆ <span>센서</span>'; $('sensor').title = '센서 사용 중 · 누르면 해제'; $('tilt-status').textContent = '태블릿을 살짝 기울여 보세요'; } }, 1000);
$('help').onclick = () => { tilt.keys.clear(); scene?.matter.world.pause(); $('help-dialog').showModal(); };
$('help-dialog').addEventListener('close', () => scene?.matter.world.resume());
document.addEventListener('visibilitychange', () => { if (document.hidden) scene?.matter.world.pause(); else if (!$('help-dialog').open) scene?.matter.world.resume(); });
$('close-help').onclick = $('start').onclick = () => $('help-dialog').close();
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else notify('이 브라우저에서는 현재 화면 크기로 플레이하세요.'); } catch { notify('현재 화면 크기로 플레이할 수 있어요.'); } };
// Read-only inspection hook for deterministic checks of the physical model.
window.labState = () => scene?.body ? { stage: stageIndex, totalStages: stages.length, renderStats: { floorUploads: scene.floor.redraws, textObjects: Object.keys(scene.dynamicLabels).length }, complete, dwell: scene.dwell, mode, rules: { ...scene.rules }, zones: scene.field.zones, checkpoints: scene.checkpoints, radius: stages[stageIndex].radius, x: scene.body.position.x, y: scene.body.position.y, angle: scene.body.angle, speed: scene.body.speed, angularSpeed: scene.body.angularVelocity, zoom: scene.zoom, width: scene.worldWidth, height: scene.worldHeight, target: scene.target, spawn: scene.spawn, obstacleCount: scene.walls.length, boundaryWalls: Object.keys(scene.matter.world.walls ?? {}).filter(key => scene.matter.world.walls[key]).length, tiles: scene.field.tiles.map(row => [...row]), surface: scene.field.tiles.map((row, r) => row.map((_, c) => scene.field.at(c * 32 + 16, r * 32 + 16))) } : null;
