// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Controls } from '../src/input/controls';
import { Game } from '../src/game/game';
import stage from '../src/stages/first-dive.json';

const game = new Game(stage);
let controls: Controls;
let fill: HTMLButtonElement;
let drain: HTMLButtonElement;
const key = (type: string, value: string, target: EventTarget = document.body) => target.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true }));
const pointer = (target: EventTarget, type: string, id: number) => target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', bubbles: true }));

beforeAll(() => {
  document.body.innerHTML = '<button id="fill">물 채우기</button><button id="drain">물 빼기</button>';
  fill = document.getElementById('fill') as HTMLButtonElement;
  drain = document.getElementById('drain') as HTMLButtonElement;
  Object.defineProperty(fill, 'setPointerCapture', { value: vi.fn() });
  Object.defineProperty(drain, 'setPointerCapture', { value: vi.fn() });
  controls = new Controls(game);
  controls.bind(fill, 1);
  controls.bind(drain, -1);
});
beforeEach(() => { game.reset(); game.start(); controls.clear(); });

describe('hold controls stop immediately', () => {
  it('stops on pointerup outside the button', () => {
    pointer(fill, 'pointerdown', 1);
    expect(game.tankDirection).toBe(1);
    game.step();
    const tank = game.submarine.tank;
    pointer(window, 'pointerup', 1);
    expect(game.tankDirection).toBe(0);
    game.step();
    expect(game.submarine.tank).toBe(tank);
    expect(fill.getAttribute('aria-pressed')).toBe('false');
  });

  it('cancels opposing multitouch inputs independently', () => {
    pointer(fill, 'pointerdown', 1);
    pointer(drain, 'pointerdown', 2);
    expect(game.tankDirection).toBe(0);
    pointer(window, 'pointerup', 1);
    expect(game.tankDirection).toBe(-1);
    pointer(window, 'pointercancel', 2);
    expect(game.tankDirection).toBe(0);
  });

  it('clears all held controls when focus leaves the browser', () => {
    pointer(fill, 'pointerdown', 1);
    key('keydown', 'ArrowRight');
    expect(game.tankDirection).toBe(1);
    expect(game.keyboardTilt).toBe(1);
    window.dispatchEvent(new Event('blur'));
    expect(game.tankDirection).toBe(0);
    expect(game.keyboardTilt).toBe(0);
  });

  it('stops a keyboard hold on keyup', () => {
    key('keydown', 'w');
    expect(game.tankDirection).toBe(-1);
    key('keyup', 'w');
    expect(game.tankDirection).toBe(0);
    key('keydown', 's');
    expect(game.tankDirection).toBe(1);
    key('keyup', 's');
    expect(game.tankDirection).toBe(0);
  });

  it('stops Enter even if focus has moved to another control', () => {
    key('keydown', 'Enter', fill);
    expect(game.tankDirection).toBe(1);
    key('keyup', 'Enter', drain);
    expect(game.tankDirection).toBe(0);
  });

  it('ignores tank input while paused and clears on space', () => {
    key('keydown', 's');
    key('keydown', ' ');
    expect(game.status).toBe('paused');
    expect(game.tankDirection).toBe(0);
    pointer(fill, 'pointerdown', 1);
    expect(game.tankDirection).toBe(0);
    key('keyup', 's');
  });
});
