import { unwrapAngle, wrapAngle } from '../types';

export type ControlMode = 'manual' | 'requesting' | 'sensor';
type OrientationConstructor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
const radians = (angle: number) => angle * Math.PI / 180;

// Rotation-matrix projection, so landscape left/right use the correct device axis.
export function screenTilt(beta: number, gamma: number, screenAngle: number): number {
  const b = radians(beta);
  const c = radians(gamma);
  const a = radians(screenAngle);
  const gx = Math.cos(b) * Math.sin(c);
  const gy = Math.sin(b);
  const screenX = gx * Math.cos(a) + gy * Math.sin(a);
  const screenY = gy * Math.cos(a) - gx * Math.sin(a);
  // Full roll around the screen normal, including upside-down. A flat device
  // has no measurable in-plane gravity, so retain the last valid pose instead.
  if (Math.hypot(screenX, screenY) < .12) return NaN;
  return Math.atan2(screenX, screenY) * 180 / Math.PI;
}

export class TiltController {
  angle = 0;
  target = 0;
  mode: ControlMode = 'manual';
  message = '슬라이더 또는 ← → 키로 기울여 보세요.';
  private baseline = 0;
  private raw: number | null = null;
  private screenAngle = 0;
  private lastEvent = 0;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private requestId = 0;
  private onChange: () => void = () => {};

  onModeChange(callback: () => void) { this.onChange = callback; }

  private orientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    const angle = screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;
    this.lastEvent = performance.now();
    const projected = screenTilt(event.beta, event.gamma, angle);
    if (!Number.isFinite(projected)) return;
    if (this.raw !== null && angle !== this.screenAngle && this.mode === 'sensor') {
      const change = wrapAngle(angle - this.screenAngle);
      this.raw += change;
      this.baseline += change;
    }
    this.raw = this.raw === null ? projected : unwrapAngle(projected, this.raw);
    if (this.mode === 'requesting') {
      this.baseline = this.raw;
      this.target = 0;
      this.screenAngle = angle;
      this.mode = 'sensor';
      this.message = '360° 센서 연결됨 · 화면을 정면으로 보고 핸들처럼 돌리세요.';
      clearTimeout(this.timeout);
      this.onChange();
    }
    this.screenAngle = angle;
    const relative = this.raw - this.baseline;
    this.target = Math.abs(relative) < 1.2 ? 0 : relative;
  };

  async enable(): Promise<void> {
    const id = ++this.requestId;
    this.stopListener();
    this.raw = null;
    if (!window.isSecureContext) return this.manual('센서는 HTTPS 연결이 필요해요. 슬라이더로 조작할 수 있어요.');
    if (!('DeviceOrientationEvent' in window)) return this.manual('기울기 센서가 없는 기기예요. 슬라이더로 조작하세요.');
    this.mode = 'requesting';
    this.message = '센서를 연결하고 있어요. 태블릿을 기준 자세로 잡아 주세요.';
    this.onChange();
    try {
      const Orientation = DeviceOrientationEvent as OrientationConstructor;
      // Called synchronously from the button handler, before the first await (iOS user gesture).
      const permission = Orientation.requestPermission ? await Orientation.requestPermission() : 'granted';
      if (id !== this.requestId) return;
      if (permission !== 'granted') return this.manual('센서 권한이 허용되지 않았어요. 수동 조작으로 전환했어요.');
      window.addEventListener('deviceorientation', this.orientation);
      this.timeout = setTimeout(() => {
        if (this.mode === 'requesting') this.manual('센서값을 받지 못했어요. 슬라이더로 조작하세요.');
      }, 3000);
    } catch {
      if (id === this.requestId) this.manual('센서에 연결하지 못했어요. 슬라이더로 조작하세요.');
    }
  }

  manual(message = '슬라이더 또는 ← → 키로 기울여 보세요.'): void {
    this.requestId++;
    this.stopListener();
    this.mode = 'manual';
    this.message = message;
    this.onChange();
  }

  calibrate(): void {
    if (this.mode === 'sensor' && this.raw !== null) this.baseline = this.raw;
    this.target = 0;
    this.angle = 0;
  }

  setManual(angle: number): void {
    if (this.mode !== 'manual') this.manual();
    this.target = unwrapAngle(angle, this.target);
  }

  update(dt: number): void {
    if (this.mode === 'sensor' && document.visibilityState === 'visible' && performance.now() - this.lastEvent > 4000) {
      this.manual('센서 연결이 끊겼어요. 수동 조작으로 전환했어요.');
    }
    this.angle += (this.target - this.angle) * (1 - Math.exp(-dt * 8));
    if (Math.abs(this.target - this.angle) < 0.015) this.angle = this.target;
  }

  private stopListener(): void {
    window.removeEventListener('deviceorientation', this.orientation);
    clearTimeout(this.timeout);
  }
}
