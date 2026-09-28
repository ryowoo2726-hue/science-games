// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TiltController } from '../src/input/orientation';

class OrientationEvent extends Event {
  static requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>();
  constructor(readonly beta: number, readonly gamma: number) { super('deviceorientation'); }
}
const controllers: TiltController[] = [];
function controller() { const tilt = new TiltController(); controllers.push(tilt); return tilt; }
function send(beta: number, gamma: number) { window.dispatchEvent(new OrientationEvent(beta, gamma)); }

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  vi.stubGlobal('screen', { orientation: { angle: 0 } });
  vi.stubGlobal('DeviceOrientationEvent', OrientationEvent);
  OrientationEvent.requestPermission.mockReset().mockResolvedValue('granted');
});
afterEach(() => {
  controllers.splice(0).forEach(tilt => tilt.manual());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sensor failures, calibration and filtering', () => {
  it('falls back to manual controls when permission is denied', async () => {
    OrientationEvent.requestPermission.mockResolvedValue('denied');
    const tilt = controller();
    await tilt.enable();
    expect(OrientationEvent.requestPermission).toHaveBeenCalledOnce();
    expect(tilt.mode).toBe('manual');
    expect(tilt.message).toContain('권한');
    tilt.setManual(90);
    tilt.update(1);
    expect(tilt.angle).toBeCloseTo(90, 0);
  });

  it('falls back if an allowed device never delivers sensor data', async () => {
    const tilt = controller();
    await tilt.enable();
    expect(tilt.mode).toBe('requesting');
    vi.advanceTimersByTime(3001);
    expect(tilt.mode).toBe('manual');
    expect(tilt.message).toContain('받지 못');
  });

  it('handles insecure origins without attempting permission', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    const tilt = controller();
    await tilt.enable();
    expect(tilt.mode).toBe('manual');
    expect(tilt.message).toContain('HTTPS');
    expect(OrientationEvent.requestPermission).not.toHaveBeenCalled();
  });

  it('calibrates on first data, filters jitter, clamps and recalibrates', async () => {
    const tilt = controller();
    await tilt.enable();
    send(0, 12);
    expect(tilt.mode).toBe('sensor');
    expect(tilt.target).toBeCloseTo(0);
    send(0, 12.7);
    expect(tilt.target).toBe(0);
    send(0, 42);
    expect(tilt.target).toBeCloseTo(30);
    tilt.update(.1);
    expect(tilt.angle).toBeGreaterThan(0);
    expect(tilt.angle).toBeLessThan(30);
    tilt.calibrate();
    expect(tilt.angle).toBe(0);
    send(0, 47);
    expect(tilt.target).toBeCloseTo(5);
    send(0, -90);
    expect(tilt.target).toBe(-90);
  });

  it('automatically recalibrates after rotating the screen', async () => {
    const tilt = controller();
    await tilt.enable();
    send(0, 0);
    Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 90 });
    send(30, 0);
    expect(tilt.target).toBe(0);
    send(40, 0);
    expect(tilt.target).toBeCloseTo(10);
  });

  it('ignores permission results after the user switches back to manual', async () => {
    let resolve!: (value: 'granted' | 'denied') => void;
    OrientationEvent.requestPermission.mockReturnValue(new Promise(r => { resolve = r; }));
    const tilt = controller();
    const permission = tilt.enable();
    tilt.manual();
    resolve('granted');
    await permission;
    send(0, 45);
    expect(tilt.mode).toBe('manual');
    expect(tilt.target).toBe(0);
  });

  it('falls back when a connected sensor stops sending data', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(100);
    const tilt = controller();
    await tilt.enable();
    send(0, 0);
    now.mockReturnValue(5000);
    tilt.update(.016);
    expect(tilt.mode).toBe('manual');
    expect(tilt.message).toContain('끊겼');
  });
});
