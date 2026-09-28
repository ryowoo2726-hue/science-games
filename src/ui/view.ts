import type { Game } from '../game/game';
import { formatTime } from '../game/game';
import { Controls } from '../input/controls';
import type { Renderer } from '../render/renderer';

const icons: Record<string, string> = {
  reset: '<path d="M3 11a9 9 0 1 1 2.3 7M3 4v7h7"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  drop: '<path d="M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z"/>',
};
function icon(name: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
}
function text(id: string, value: string): void {
  const element = el(id);
  if (element.textContent !== value) element.textContent = value;
}

export function createView(): HTMLCanvasElement {
  el('app').innerHTML = `
    <main id="game-screen" class="game-screen" aria-label="부력 미로 게임">
      <canvas id="game-canvas" aria-label="잠수정과 물이 있는 탈출 미로"></canvas>
      <header class="hud">
        <div class="hud-readouts"><strong class="game-title">부력 탐험</strong><time id="timer">00:00</time><span class="readout">기울기 <b id="hud-angle">0°</b></span><span class="readout density-readout">밀도 <b id="hud-density">1.00</b></span></div>
        <nav class="hud-actions" aria-label="게임 설정">
          <button id="switch-mode" class="compact-button">센서 사용</button>
          <button id="calibrate" class="icon-button" aria-label="현재 자세를 0도로 보정" title="0° 보정">${icon('target')}</button>
          <button id="pause" class="icon-button" aria-label="일시 정지" title="일시 정지" disabled>${icon('pause')}</button>
          <button id="restart" class="icon-button" aria-label="재시작" title="재시작">${icon('reset')}</button>
          <button id="fullscreen" class="icon-button" aria-label="전체화면" title="전체화면">${icon('expand')}</button>
        </nav>
      </header>
      <div id="sensor-message" class="sensor-message" role="status" hidden></div>
      <section class="game-controls" aria-label="잠수정 조작">
        <button id="drain" class="tank-button drain" disabled aria-pressed="false">${icon('drop')}<span>물 빼기<small>W</small></span></button>
        <div class="center-controls">
          <div class="tank-readout"><span>탱크</span><div class="tank-gauge" aria-hidden="true"><i id="tank-level"></i></div><strong id="hud-tank">50%</strong></div>
          <div id="manual-control" class="manual-control"><span>−90°</span><input id="tilt-slider" type="range" min="-90" max="90" step="1" value="0" aria-label="기울기 각도" disabled><span>+90°</span></div>
        </div>
        <button id="fill" class="tank-button fill" disabled aria-pressed="false">${icon('drop')}<span>물 채우기<small>S</small></span></button>
      </section>
      <div id="start-overlay" class="game-overlay"><div class="overlay-card">
        <span class="sub-mark" aria-hidden="true">◉</span><h1>부력 탐험</h1><p>기울기와 잠수정 탱크를 조절해 출구로!</p>
        <button id="sensor-start" class="primary-button">태블릿 센서로 시작</button>
        <button id="manual-start" class="secondary-button">수동 조작으로 시작</button>
      </div></div>
      <div id="pause-overlay" class="game-overlay" hidden><div class="overlay-card"><h2>일시 정지</h2><button id="resume" class="primary-button">계속하기</button></div></div>
      <div id="win-overlay" class="game-overlay" hidden><div class="overlay-card"><span class="success-mark" aria-hidden="true">✓</span><h2>탈출 성공!</h2><time id="finish-time" class="finish-time">00:00</time><button id="play-again" class="primary-button">다시 도전하기</button></div></div>
    </main>
  `;
  return el<HTMLCanvasElement>('game-canvas');
}

export function bindView(game: Game, renderer: Renderer): void {
  const controls = new Controls(game);
  controls.bind(el<HTMLButtonElement>('fill'), 1);
  controls.bind(el<HTMLButtonElement>('drain'), -1);
  const slider = el<HTMLInputElement>('tilt-slider');
  const screen = el('game-screen');
  const fullscreen = el<HTMLButtonElement>('fullscreen');
  let lastUpdate = 0;
  let messageTimeout: ReturnType<typeof setTimeout> | undefined;

  // The game always fills the viewport; supported browsers can also hide chrome.
  const enterFullscreen = () => {
    if (!document.fullscreenElement && screen.requestFullscreen) {
      void screen.requestFullscreen().catch(() => {});
    }
  };
  fullscreen.hidden = !screen.requestFullscreen;
  fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else enterFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.setAttribute('aria-label', document.fullscreenElement ? '전체화면 나가기' : '전체화면');
    fullscreen.title = document.fullscreenElement ? '전체화면 나가기' : '전체화면';
  });

  const reset = () => { controls.clear(); game.reset(); renderer.reset(); };
  el('manual-start').addEventListener('click', () => { game.tilt.manual(); game.start(); enterFullscreen(); });
  el('sensor-start').addEventListener('click', () => {
    game.start();
    // Preserve sensor permission in the user gesture, before requesting fullscreen.
    void game.tilt.enable();
    enterFullscreen();
  });
  el('play-again').addEventListener('click', () => { reset(); game.start(); });
  el('restart').addEventListener('click', () => { reset(); game.start(); });
  el('resume').addEventListener('click', () => game.togglePause());
  el('pause').addEventListener('click', () => { controls.clear(); game.togglePause(); });
  el('calibrate').addEventListener('click', () => { game.tilt.calibrate(); slider.value = '0'; });
  slider.addEventListener('input', () => game.tilt.setManual(Number(slider.value)));
  el('switch-mode').addEventListener('click', () => {
    controls.clear();
    if (game.tilt.mode !== 'manual') game.tilt.manual();
    else void game.tilt.enable();
  });

  const modeChange = () => {
    const { mode, message } = game.tilt;
    const sensor = mode === 'sensor';
    el('manual-control').hidden = sensor;
    screen.classList.toggle('sensor-mode', sensor);
    text('switch-mode', sensor ? '수동 조작' : mode === 'requesting' ? '연결 중…' : '센서 사용');
    slider.disabled = mode !== 'manual' || game.status !== 'playing';
    text('sensor-message', message);
    const notice = el('sensor-message');
    notice.hidden = !message;
    clearTimeout(messageTimeout);
    if (mode !== 'requesting') messageTimeout = setTimeout(() => { notice.hidden = true; }, 5500);
  };
  game.tilt.onModeChange(modeChange);

  game.onStatusChange = () => {
    controls.clear();
    el('start-overlay').hidden = game.status !== 'ready';
    el('pause-overlay').hidden = game.status !== 'paused';
    el('win-overlay').hidden = game.status !== 'won';
    const playing = game.status === 'playing';
    el<HTMLButtonElement>('fill').disabled = !playing;
    el<HTMLButtonElement>('drain').disabled = !playing;
    const pause = el<HTMLButtonElement>('pause');
    pause.disabled = game.status === 'ready' || game.status === 'won';
    pause.innerHTML = icon(game.status === 'paused' ? 'play' : 'pause');
    pause.setAttribute('aria-label', game.status === 'paused' ? '계속하기' : '일시 정지');
    if (game.status === 'won') text('finish-time', formatTime(game.elapsed));
    lastUpdate = 0;
    modeChange();
    game.onUpdate();
  };

  game.onUpdate = () => {
    const now = performance.now();
    if (lastUpdate && now - lastUpdate < 80) return;
    lastUpdate = now;
    const { submarine, tilt } = game;
    text('timer', formatTime(game.elapsed));
    text('hud-angle', `${Math.round(tilt.angle)}°`);
    text('hud-density', submarine.density.toFixed(2));
    text('hud-tank', `${Math.round(submarine.tank * 100)}%`);
    el('tank-level').style.width = `${submarine.tank * 100}%`;
    slider.value = String(Math.round(tilt.target));
  };
  game.onStatusChange();
}
