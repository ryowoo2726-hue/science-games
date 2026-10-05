export class TiltController {
  constructor(onStatus) {
    this.onStatus = onStatus; this.keys = new Set(); this.value = { x: 0, y: 0 }; this.raw = null; this.baseline = null; this.sensor = false;
    window.addEventListener('keydown', e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
      if (e.key.startsWith('Arrow')) { e.preventDefault(); this.keys.add(e.key.slice(5).toLowerCase()); }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.slice(5).toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('visibilitychange', () => this.keys.clear());
    screen.orientation?.addEventListener('change', () => { this.baseline = null; this.keys.clear(); });
    for (const button of document.querySelectorAll('[data-dir]')) {
      button.addEventListener('pointerdown', e => { button.setPointerCapture(e.pointerId); this.keys.add(button.dataset.dir); button.classList.add('pressed'); });
      const release = () => { this.keys.delete(button.dataset.dir); button.classList.remove('pressed'); };
      button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    }
  }
  calibrate() { this.baseline = this.raw ? { ...this.raw } : null; this.keys.clear(); this.value = { x: 0, y: 0 }; }
  async connect() {
    if (!window.isSecureContext) { this.onStatus('센서는 HTTPS 주소에서 연결할 수 있어요. 화면 화살표를 사용하세요.'); return false; }
    if (!window.DeviceOrientationEvent) { this.onStatus('이 기기는 기울기 센서가 없어요. 화면 화살표를 사용하세요.'); return false; }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission() !== 'granted') {
        this.onStatus('센서 권한이 허용되지 않았어요. 화면 화살표를 사용하세요.'); return false;
      }
      if (!this.listener) {
        this.listener = event => {
          if (event.gamma == null || event.beta == null) return;
          const angle = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
          this.raw = { x: event.gamma * Math.cos(angle) + event.beta * Math.sin(angle), y: event.beta * Math.cos(angle) - event.gamma * Math.sin(angle) };
          if (!this.baseline) this.calibrate();
          this.sensor = true;
        };
        window.addEventListener('deviceorientation', this.listener);
      }
      this.onStatus('센서 신호를 기다리는 중… 기기를 살짝 기울여 보세요.');
      clearTimeout(this.timeout);
      this.timeout = setTimeout(() => { if (!this.sensor) this.onStatus('센서 신호가 없어요. 화면 화살표로 계속 실험할 수 있어요.'); }, 3500);
      return true;
    } catch { this.onStatus('센서를 연결하지 못했어요. 화면 화살표를 사용하세요.'); return false; }
  }
  update() {
    let x = 0, y = 0;
    if (this.sensor && this.raw && this.baseline) { x = (this.raw.x - this.baseline.x) / 35; y = (this.raw.y - this.baseline.y) / 35; }
    if (this.keys.size) { x = (this.keys.has('right') ? .75 : 0) - (this.keys.has('left') ? .75 : 0); y = (this.keys.has('down') ? .75 : 0) - (this.keys.has('up') ? .75 : 0); }
    const length = Math.max(1, Math.hypot(x, y));
    this.value.x += (x / length - this.value.x) * .18; this.value.y += (y / length - this.value.y) * .18;
    return this.value;
  }
}
