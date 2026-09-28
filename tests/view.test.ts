// @vitest-environment happy-dom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/game/game';
import { bindView, createView } from '../src/ui/view';
import type { Renderer } from '../src/render/renderer';
import stage from '../src/stages/first-dive.json';
import { stages } from '../src/stages';

const game = new Game(stage, stages);
const resetRenderer = vi.fn();
const requestFullscreen = vi.fn<() => Promise<void>>();
class OrientationEvent extends Event {
  static requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>();
  constructor(readonly beta: number, readonly gamma: number) { super('deviceorientation'); }
}
const el = <T extends HTMLElement = HTMLButtonElement>(id: string) => document.getElementById(id) as T;
const pointer = (target: EventTarget, type: string) => target.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true }));

beforeAll(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="app"></div>';
  createView();
  el('game-screen').requestFullscreen = requestFullscreen;
  Object.defineProperty(el('fill'), 'setPointerCapture', { value: vi.fn() });
  Object.defineProperty(el('drain'), 'setPointerCapture', { value: vi.fn() });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  vi.stubGlobal('DeviceOrientationEvent', OrientationEvent);
  vi.stubGlobal('screen', { orientation: { angle: 0 } });
  bindView(game, { reset: resetRenderer } as unknown as Renderer);
});
beforeEach(() => {
  game.tilt.manual();
  game.selectStage(0);
  resetRenderer.mockClear();
  requestFullscreen.mockReset().mockResolvedValue();
  OrientationEvent.requestPermission.mockReset().mockResolvedValue('granted');
});
afterAll(() => { game.tilt.manual(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('in-game controls and fullscreen fallback', () => {
  it('remains playable when native fullscreen is rejected', async () => {
    requestFullscreen.mockRejectedValue(new Error('Fullscreen is unavailable'));
    el('manual-start').click();
    await Promise.resolve();
    expect(game.status).toBe('playing');
    expect(el('start-overlay').hidden).toBe(true);
    expect(el('fill').disabled).toBe(false);
    pointer(el('fill'), 'pointerdown');
    game.step();
    expect(game.submarine.tank).toBeGreaterThan(.5);
    pointer(window, 'pointerup');
    expect(game.tankDirection).toBe(0);
  });

  it('restart clears a held tank button and starts a fresh round', () => {
    el('manual-start').click();
    pointer(el('fill'), 'pointerdown');
    game.step();
    el('restart').click();
    expect(game.status).toBe('playing');
    expect(game.elapsed).toBe(0);
    expect(game.submarine.tank).toBe(.5);
    expect(game.tankDirection).toBe(0);
    expect(el('fill').getAttribute('aria-pressed')).toBe('false');
    expect(resetRenderer).toHaveBeenCalledOnce();
  });

  it('pause releases inputs and disables the buttons until resumed', () => {
    el('manual-start').click();
    pointer(el('drain'), 'pointerdown');
    el('pause').click();
    expect(game.status).toBe('paused');
    expect(game.tankDirection).toBe(0);
    expect(el('drain').disabled).toBe(true);
    expect(el('pause-overlay').hidden).toBe(false);
    el('resume').click();
    expect(game.status).toBe('playing');
    expect(el('drain').disabled).toBe(false);
  });

  it('keeps the manual slider usable when sensor permission is refused', async () => {
    OrientationEvent.requestPermission.mockResolvedValue('denied');
    el('sensor-start').click();
    await Promise.resolve();
    expect(game.tilt.mode).toBe('manual');
    expect(game.status).toBe('playing');
    expect(el('manual-control').hidden).toBe(false);
    const slider = el<HTMLInputElement>('tilt-slider');
    expect(slider.disabled).toBe(false);
    slider.value = '45';
    slider.dispatchEvent(new Event('input'));
    expect(game.tilt.target).toBe(45);
  });

  it('hides the slider for a connected sensor and restores it on manual switch', async () => {
    el('sensor-start').click();
    expect(OrientationEvent.requestPermission).toHaveBeenCalledOnce();
    await Promise.resolve();
    window.dispatchEvent(new OrientationEvent(0, 10));
    expect(game.tilt.mode).toBe('sensor');
    expect(el('manual-control').hidden).toBe(true);
    el('switch-mode').click();
    expect(game.tilt.mode).toBe('manual');
    expect(el('manual-control').hidden).toBe(false);
    expect(el<HTMLInputElement>('tilt-slider').disabled).toBe(false);
  });

  it('lets students choose a stage and continue after completing it', () => {
    const selector = el<HTMLSelectElement>('stage-select');
    expect(selector.options.length).toBe(11);
    selector.value = '4'; selector.dispatchEvent(new Event('change'));
    expect(game.stageIndex).toBe(4); expect(game.status).toBe('ready');
    expect(el('stage-name').textContent).toContain('5 / 11');
    game.status = 'won'; game.onStatusChange(); el('next-stage').click();
    expect(game.stageIndex).toBe(5); expect(game.status).toBe('playing');
    expect(el('win-overlay').hidden).toBe(true);
  });

  it('offers a full campaign restart at the final exit', () => {
    game.selectStage(10); game.status = 'won'; game.onStatusChange();
    expect(el('win-title').textContent).toBe('모든 단계 완료!');
    el('next-stage').click(); expect(game.stageIndex).toBe(0); expect(game.status).toBe('playing');
  });
});
