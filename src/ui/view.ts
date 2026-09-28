import type { Game } from '../game/game';
import { formatTime } from '../game/game';
import { Controls } from '../input/controls';
import type { Renderer } from '../render/renderer';

const icons: Record<string, string> = {
  sub: '<path d="M5 12h11a5 5 0 0 1 0 10H8a5 5 0 0 1-5-5v-3a2 2 0 0 1 2-2Z"/><path d="M10 12V6h5"/><circle cx="16" cy="17" r="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2.5M12 17h.01"/>',
  reset: '<path d="M3 11a9 9 0 1 1 2.3 7M3 4v7h7"/>',
  up: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
  phone: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M10 17h4M10 6h4"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  bulb: '<path d="M9 18h6m-5 3h4M8.5 14.5a6 6 0 1 1 7 0C14 16 14 16 14 18h-4c0-2 0-2-1.5-3.5Z"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};

function icon(name: string, className = ''): string {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
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
    <main class="shell">
      <header class="site-header">
        <a class="brand" href="./" aria-label="부력 탐험 홈"><span class="brand-icon">${icon('sub')}</span><span>부력<span class="brand-light"> 탐험</span></span><span class="brand-en">BUOY LAB</span></a>
        <div class="header-actions"><span class="subject-badge">중학교 과학 <span>·</span> 힘의 작용</span><button id="help" class="quiet-button">${icon('help')}<span>플레이 방법</span></button><button id="restart" class="quiet-button">${icon('reset')}<span>다시 시작</span></button></div>
      </header>
      <section class="intro" aria-labelledby="game-title">
        <div><div class="eyebrow"><span></span>기울기로 움직이는 과학 놀이터</div><h1 id="game-title">작은 잠수정의 <span>부력 미로</span></h1><p>물의 흐름을 바꾸고, 부력을 조절해 출구에 도착하세요.</p></div>
        <div class="stage-chip"><span class="stage-number">01</span><div><small>첫 번째 미션</small><strong>첫 번째 잠수</strong></div><span class="difficulty"><i></i><i></i><i></i></span></div>
      </section>
      <div class="workspace">
        <div class="main-column">
          <section class="game-panel" aria-label="부력 미로 게임">
            <div class="game-topbar"><span class="game-state"><i id="live-dot"></i><span id="game-state">탐험 준비</span></span><div class="game-readouts"><span><small>기울기</small><b id="hud-angle">0°</b></span><span><small>밀도</small><b id="hud-density">1.00</b></span><span><small>탱크</small><b id="hud-tank">50%</b></span></div><div class="game-meta"><span class="timer-label">탐험 시간</span><time id="timer">00:00</time><button id="pause" class="canvas-button" aria-label="일시 정지" disabled>${icon('pause')}</button></div></div>
            <div class="canvas-wrap">
              <canvas id="game-canvas" aria-label="물이 절반 채워진 미로. 노란 잠수정을 세 개의 통로를 지나 초록색 출구로 이동하세요."></canvas>
              <div id="start-overlay" class="game-overlay">
                <div class="start-card"><div class="mission-mark">${icon('sub')}<span class="orbit orbit-one"></span><span class="orbit orbit-two"></span></div><div class="card-eyebrow">READY TO DIVE</div><h2>기울이고, 잠수하고,<br>탈출해 볼까요?</h2><p>태블릿을 기울여 중력 방향을 바꾸세요.<br>탱크의 물을 조절하면 부력이 달라져요.</p><button id="manual-start" class="primary-button">탐험 시작 ${icon('arrow')}</button><button id="sensor-start" class="sensor-start">${icon('phone')} 태블릿 센서로 시작</button><div class="start-caption">PC에서는 슬라이더와 키보드로 조작할 수 있어요.</div></div>
              </div>
              <div id="pause-overlay" class="game-overlay" hidden><div class="pause-card">${icon('pause')}<h2>잠깐 쉬어 가요</h2><p>물이 흐르는 방향과 두 힘을 살펴보세요.</p><button id="resume" class="primary-button">탐험 계속하기 ${icon('play')}</button></div></div>
              <div id="win-overlay" class="game-overlay" hidden><div class="win-card"><span class="success-mark">${icon('check')}</span><div class="card-eyebrow">MISSION COMPLETE</div><h2>탈출 성공!</h2><p>기울기와 부력의 균형을 찾았어요.</p><div class="result-time"><small>나의 탐험 기록</small><strong id="finish-time">00:00</strong></div><p class="win-question">탱크의 물을 뺄 때, 잠수정은 왜 떠올랐을까요?</p><button id="play-again" class="primary-button">다시 도전하기 ${icon('reset')}</button></div></div>
            </div>
            <div class="game-legend"><div><span><i class="legend-sub"></i>잠수정</span><span><i class="legend-water"></i>물</span><span><i class="legend-exit"></i>출구</span></div><label class="force-toggle"><input id="force-toggle" type="checkbox" checked><span>힘 화살표 보기</span></label></div>
          </section>
          <section class="control-deck" aria-label="게임 조작">
            <div class="tilt-control">
              <div class="control-heading"><label for="tilt-slider">${icon('phone')}<span id="tilt-heading">기울기 조절</span></label><span id="angle-value" class="angle-value">0<span>°</span></span><button id="calibrate" class="calibrate" title="현재 자세를 기준 각도 0도로 보정">${icon('target')}<span>0° 보정</span></button></div>
              <div class="slider-wrap"><span>−90°</span><input id="tilt-slider" type="range" min="-90" max="90" step="1" value="0" aria-label="중력 기울기 각도" disabled><span>+90°</span></div>
              <div class="control-foot"><span id="mode-label"><i></i>수동 조작 <kbd>←</kbd> <kbd>→</kbd></span><button id="switch-mode">센서 사용</button></div>
            </div>
            <div class="tank-controls"><button id="drain" class="tank-button drain" disabled aria-pressed="false"><span class="tank-button-icon">${icon('up')}</span><span><strong>물 빼기</strong><small>가벼워져요 <kbd>W</kbd></small></span></button><button id="fill" class="tank-button fill" disabled aria-pressed="false"><span class="tank-button-icon">${icon('down')}</span><span><strong>물 채우기</strong><small>무거워져요 <kbd>S</kbd></small></span></button><p>버튼을 <strong>누르고 있는 동안</strong> 잠수정의 탱크가 바뀌어요.</p></div>
          </section>
          <p id="sensor-message" class="sensor-message" role="status">슬라이더 또는 ← → 키로 기울여 보세요.</p>
        </div>
        <aside class="instruments" aria-label="실시간 물리 관측">
          <section class="instrument-card density-card"><div class="instrument-heading"><h2>잠수정 관측</h2><span class="live-label">LIVE</span></div><div class="density-label">잠수정의 평균 밀도 <span>물 = 1.00</span></div><div class="density-readout"><strong id="density-value">1.00</strong><span id="buoyancy-state" class="buoyancy-state neutral" role="status">중성 부력</span></div><div class="density-scale"><div id="density-marker" class="density-marker"></div><span class="neutral-line"></span></div><div class="scale-labels"><span>0.65 · 가벼움</span><span>1.35 · 무거움</span></div><div class="tank-label"><span>탱크의 물</span><strong id="tank-value">50<span>%</span></strong></div><div class="tank-gauge"><div id="tank-level"></div><span class="tank-midpoint"></span></div><div class="tank-gauge-caption"><span>비움</span><span>절반</span><span>가득</span></div><div class="immersion"><span>물에 잠긴 비율</span><strong id="immersion-value">100%</strong></div></section>
          <section class="instrument-card force-card"><div class="instrument-heading"><h2>지금 작용하는 힘</h2><span class="relative-label">상대 크기</span></div><div class="force-row"><div><span class="force-name gravity-color">${icon('down')}중력</span><strong id="gravity-value">1.00</strong></div><div class="force-meter"><span id="gravity-meter" class="gravity-meter"></span></div></div><div class="force-row"><div><span class="force-name buoyancy-color">${icon('up')}부력</span><strong id="buoyancy-value">1.00</strong></div><div class="force-meter"><span id="buoyancy-meter" class="buoyancy-meter"></span></div></div><div id="force-relation" class="force-relation">중력 = 부력</div><p class="force-formula">부력 = 물의 밀도 × 중력 가속도<br>× 물에 잠긴 부피</p></section>
          <section class="insight-card"><span class="insight-icon">${icon('bulb')}</span><div><h2>작은 과학 발견</h2><p id="science-insight">물속에서 평균 밀도가 물과 같으면, 중력과 부력이 균형을 이뤄요.</p></div></section>
          <div class="route-progress"><div class="route-title">탈출까지 <strong id="gate-value">0 / 3</strong></div><div class="route-line"><span class="route-dot">1</span><i></i><span class="route-dot">2</span><i></i><span class="route-dot">3</span><i></i>${icon('arrow')}</div><p id="route-hint">첫 번째 벽의 아래 통로를 찾아보세요.</p></div>
        </aside>
      </div>
      <footer class="site-footer"><span>기울기 × 부력 = 나만의 탈출 경로</span><span class="landscape-tip">${icon('phone')} 태블릿은 가로 모드가 편해요</span><span>SCIENCE, IN MOTION.</span></footer>
    </main>
    <dialog id="help-dialog"><div class="help-dialog-inner"><div class="card-eyebrow">HOW TO PLAY</div><h2>세 가지를 기억하세요</h2><ol><li><span>01</span><div><strong>기울이면 중력 방향이 바뀌어요</strong><p>+ 각도는 오른쪽, − 각도는 왼쪽으로 물이 흘러요. PC는 슬라이더 또는 ← → 키를 사용하세요.</p></div></li><li><span>02</span><div><strong>탱크로 평균 밀도를 조절하세요</strong><p>물 빼기(W)는 가벼워지고, 물 채우기(S)는 무거워져요. 버튼에서 손을 떼면 바로 멈춰요. 외부 물의 총량은 바뀌지 않아요.</p></div></li><li><span>03</span><div><strong>아래 → 위 → 아래 통로를 지나 출구로!</strong><p>물에 잠긴 만큼 부력을 받아요. 물 밖에서는 부력이 사라져요. 스페이스 키로 잠시 멈추고 관찰할 수 있어요.</p></div></li></ol><div class="help-note">센서를 사용할 때는 화면을 위로 둔 기준 자세에서 시작하세요. 자세를 바꾼 뒤에는 ‘0° 보정’을 눌러 주세요.</div><form method="dialog"><button class="primary-button">알겠어요 ${icon('check')}</button></form></div></dialog>
  `;
  return el<HTMLCanvasElement>('game-canvas');
}

export function bindView(game: Game, renderer: Renderer): void {
  const controls = new Controls(game);
  controls.bind(el<HTMLButtonElement>('fill'), 1);
  controls.bind(el<HTMLButtonElement>('drain'), -1);
  const slider = el<HTMLInputElement>('tilt-slider');
  const dialog = el<HTMLDialogElement>('help-dialog');
  let pauseForHelp = false;
  let lastUpdate = 0;

  const reset = () => { controls.clear(); game.reset(); renderer.reset(); };
  el('manual-start').addEventListener('click', () => { game.tilt.manual(); game.start(); });
  el('sensor-start').addEventListener('click', () => { game.start(); void game.tilt.enable(); });
  el('play-again').addEventListener('click', () => { reset(); game.start(); });
  el('restart').addEventListener('click', reset);
  el('resume').addEventListener('click', () => game.togglePause());
  el('pause').addEventListener('click', () => { controls.clear(); game.togglePause(); });
  el('calibrate').addEventListener('click', () => { game.tilt.calibrate(); slider.value = '0'; });
  slider.addEventListener('input', () => game.tilt.setManual(Number(slider.value)));
  el('switch-mode').addEventListener('click', () => {
    if (game.tilt.mode !== 'manual') game.tilt.manual();
    else void game.tilt.enable();
  });
  el<HTMLInputElement>('force-toggle').addEventListener('change', event => { game.showForces = (event.target as HTMLInputElement).checked; });
  el('help').addEventListener('click', () => {
    controls.clear();
    pauseForHelp = game.status === 'playing';
    if (pauseForHelp) game.togglePause();
    dialog.showModal();
  });
  dialog.addEventListener('close', () => { if (pauseForHelp && game.status === 'paused') game.togglePause(); pauseForHelp = false; });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  const modeChange = () => {
    const mode = game.tilt.mode;
    text('sensor-message', game.tilt.message);
    text('tilt-heading', mode === 'sensor' ? '태블릿 기울기' : '기울기 조절');
    el('mode-label').innerHTML = mode === 'sensor' ? '<i class="connected"></i>센서 연결됨' : mode === 'requesting' ? '<i></i>센서 연결 중…' : '<i></i>수동 조작 <kbd>←</kbd> <kbd>→</kbd>';
    text('switch-mode', mode !== 'manual' ? '수동으로 전환' : '센서 사용');
    slider.disabled = mode !== 'manual' || game.status !== 'playing';
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
    pause.setAttribute('aria-label', game.status === 'paused' ? '탐험 계속하기' : '일시 정지');
    text('game-state', { ready: '탐험 준비', playing: '탐험 중', paused: '잠시 멈춤', won: '미션 완료' }[game.status]);
    el('live-dot').classList.toggle('active', playing);
    if (game.status === 'won') text('finish-time', formatTime(game.elapsed));
    lastUpdate = 0;
    modeChange();
  };

  game.onUpdate = () => {
    const now = performance.now();
    if (now - lastUpdate < 100) return;
    lastUpdate = now;
    const { submarine, tilt } = game;
    const { weight, buoyancy, net } = submarine.forces;
    text('timer', formatTime(game.elapsed));
    el('angle-value').innerHTML = `${Math.round(tilt.angle) === 0 ? '0' : `${tilt.angle > 0 ? '+' : '−'}${Math.abs(Math.round(tilt.angle))}`}<span>°</span>`;
    slider.value = String(Math.round(tilt.target));
    slider.style.setProperty('--angle-percent', `${(tilt.target + 90) / 180 * 100}%`);
    text('density-value', submarine.density.toFixed(2));
    text('hud-angle', `${Math.round(tilt.angle)}°`);
    text('hud-density', submarine.density.toFixed(2));
    text('hud-tank', `${Math.round(submarine.tank * 100)}%`);
    el('tank-value').innerHTML = `${Math.round(submarine.tank * 100)}<span>%</span>`;
    el('tank-level').style.width = `${submarine.tank * 100}%`;
    el('density-marker').style.left = `${submarine.tank * 100}%`;
    text('immersion-value', `${Math.round(submarine.submerged * 100)}%`);
    text('gravity-value', weight.toFixed(2));
    text('buoyancy-value', buoyancy.toFixed(2));
    el('gravity-meter').style.width = `${weight / 1.4 * 100}%`;
    el('buoyancy-meter').style.width = `${buoyancy / 1.4 * 100}%`;
    const state = el('buoyancy-state');
    const dry = submarine.submerged < .015;
    const balanced = Math.abs(net) < .025;
    const neutral = balanced && submarine.submerged > .97 && Math.abs(submarine.density - 1) < .025;
    const floating = balanced && !neutral;
    const rising = net < 0;
    state.textContent = dry ? '물 밖' : neutral ? '중성 부력' : floating ? '수면에 떠 있음' : rising ? '뜨는 중' : '가라앉는 중';
    state.className = `buoyancy-state ${dry ? 'dry' : neutral || floating ? 'neutral' : rising ? 'rising' : 'sinking'}`;
    state.title = '중력과 부력의 크기를 기준으로 표시합니다. 벽에 닿으면 움직임이 멈출 수 있어요.';
    text('force-relation', dry ? '물 밖에서는 부력 = 0' : balanced ? '중력 ≈ 부력' : rising ? '부력 > 중력' : '중력 > 부력');
    const insight = dry ? '물 밖에서는 부력을 받지 않아요. 태블릿을 기울이면 중력 방향으로 움직여요.'
      : submarine.submerged < .9 ? '일부만 잠기면 부력도 작아져요. 잠긴 부피가 줄면 두 힘의 균형이 달라져요.'
      : submarine.density < .975 ? '탱크의 물을 빼면 평균 밀도가 작아져요. 부력이 더 커져 위로 떠올라요.'
      : submarine.density > 1.025 ? '탱크에 물을 채우면 평균 밀도가 커져요. 중력이 더 커져 아래로 가라앉아요.'
      : '물속에서 평균 밀도가 물과 같으면, 중력과 부력이 균형을 이뤄요.';
    text('science-insight', insight);
    text('gate-value', `${game.completedGates} / 3`);
    document.querySelectorAll('.route-dot').forEach((dot, i) => dot.classList.toggle('complete', i < game.completedGates));
    text('route-hint', ['첫 번째 벽의 아래 통로를 찾아보세요.', '다음은 위쪽 통로! 물의 높이도 바꿔 보세요.', '아래로 돌아 마지막 벽을 지나가세요.', '초록색 출구를 향해 떠올라 보세요.'][game.completedGates]);
  };
  game.onStatusChange();
  game.onUpdate();
}
