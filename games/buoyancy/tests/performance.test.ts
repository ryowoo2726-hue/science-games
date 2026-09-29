// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/game/game';
import { Water } from '../src/core/water';
import { canvasPixelRatio, FrameQuality } from '../src/render/performance';
import { gravityAt } from '../src/types';
import stage from '../src/stages/first-dive.json';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function animationLoop() {
  let next: FrameRequestCallback;
  const request = vi.fn((callback: FrameRequestCallback) => { next = callback; return request.mock.calls.length; });
  const cancel = vi.fn();
  vi.stubGlobal('requestAnimationFrame', request);
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const game = new Game(stage);
  const step = vi.spyOn(game, 'step').mockImplementation(() => { game.elapsed += 1 / 60; });
  const render = vi.fn();
  game.render = render;
  game.run();
  return { game, step, render, request, cancel, frame: (time: number) => next(time) };
}

describe('tablet frame scheduling', () => {
  it('limits catch-up work and discards a growing backlog after slow frames', () => {
    const loop = animationLoop();
    loop.game.start(); loop.frame(0);
    loop.frame(100); expect(loop.step).toHaveBeenCalledTimes(2);
    loop.frame(200); expect(loop.step).toHaveBeenCalledTimes(4);
    loop.frame(217); expect(loop.step.mock.calls.length).toBeLessThanOrEqual(6);
    loop.game.dispose();
  });

  it('runs fixed physics while drawing less often and stops redrawing during pause', () => {
    const loop = animationLoop();
    loop.game.renderInterval = 1000 / 30;
    loop.game.start(); loop.frame(0);
    for (let n = 1; n <= 60; n++) loop.frame(n * 1000 / 60);
    expect(loop.step.mock.calls.length).toBeGreaterThanOrEqual(59);
    expect(loop.step.mock.calls.length).toBeLessThanOrEqual(60);
    expect(loop.render.mock.calls.length).toBe(31);
    loop.game.togglePause(); loop.frame(1017);
    const draws = loop.render.mock.calls.length;
    loop.frame(1034); loop.frame(1100);
    expect(loop.render).toHaveBeenCalledTimes(draws);
    loop.game.togglePause(); loop.frame(1117);
    expect(loop.render).toHaveBeenCalledTimes(draws + 1);
    loop.game.dispose();
  });

  it('does not start duplicate loops and removes its visibility listener on disposal', () => {
    const loop = animationLoop();
    loop.game.run(); expect(loop.request).toHaveBeenCalledOnce();
    loop.game.start(); loop.frame(0);
    loop.game.dispose();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(loop.game.status).toBe('playing');
    expect(loop.cancel).toHaveBeenCalledOnce();
    loop.frame(100); expect(loop.step).not.toHaveBeenCalled();
  });
});

describe('drawing quality independent of learning physics', () => {
  it('caps canvas memory and pixel work on high-resolution screens', () => {
    const ratio = canvasPixelRatio(2560, 1600, 2, true);
    expect(2560 * 1600 * ratio ** 2).toBeLessThanOrEqual(1_500_001);
    expect(canvasPixelRatio(1280, 800, 2, true)).toBe(1);
    expect(canvasPixelRatio(1280, 800, 2, false)).toBeLessThan(1.5);
  });

  it('reduces detail after sustained load, while ignoring isolated slow frames', () => {
    const quality = new FrameQuality();
    for (let n = 0; n < 100; n++) { quality.record(24); quality.record(8); }
    expect(quality.lowDetail).toBe(false);
    for (let n = 0; n < 29; n++) expect(quality.record(24)).toBe(false);
    expect(quality.record(24)).toBe(true);
    expect(quality.lowDetail).toBe(true);
    expect(quality.record(24)).toBe(false);
  });

  it('keeps particle motion, liquid mass and buoyancy samples identical at lower drawing resolution', () => {
    const detailed = new Water(stage), light = new Water(stage);
    light.setSurfaceResolution(12);
    for (let n = 0; n < 60; n++) {
      const gravity = gravityAt(n * 7);
      detailed.step(gravity); light.step(gravity);
      light.buildSurface(.5);
    }
    expect(light.x).toEqual(detailed.x); expect(light.y).toEqual(detailed.y);
    expect(light.totalMass()).toBe(detailed.totalMass());
    expect(light.totalMaterialMass()).toBe(detailed.totalMaterialMass());
    expect(light.sample(stage.start.x, stage.start.y)).toEqual(detailed.sample(stage.start.x, stage.start.y));
    expect(light.field.length).toBeLessThan(detailed.field.length / 3);
    light.setSurfaceResolution(8); light.buildSurface();
    expect(light.field.some(value => value > .5)).toBe(true);
  });
});
