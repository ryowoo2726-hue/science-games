/**
 * 탄성 퀘스트 (Elastic Bounce Quest)
 * 중학교 1학년 과학 5단원 '탄성력' 탐구용 인터랙티브 물리 게임 엔진
 * (중력 제거 - 2D 직선 탄성 반사 & 속도 밸런스 튜닝 버전)
 */

// ============================================================================
// 1. Web Audio API 신디사이저 (오프라인 무설치 사운드 엔진)
// ============================================================================
class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTension(pitchRatio) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      
      const baseFreq = 160 + pitchRatio * 300;
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq + 15, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  playRelease(powerRatio) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';

      const startFreq = 300 + powerRatio * 320;
      osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) {}
  }

  playBounce(type = 'normal', speed = 6) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const intensity = Math.min(1, Math.max(0.2, speed / 14));

      if (type === 'super') {
        // 슈퍼 탄성 범퍼
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(680, this.ctx.currentTime + 0.08);
        osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.22);

        gain.gain.setValueAtTime(0.28 * intensity, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
      } else if (type === 'damping') {
        // 스펀지 벽
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.18 * intensity, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      } else {
        // 일반 탄성 벽 (톡! 경쾌한 소리)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250 + intensity * 120, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.22 * intensity, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      }

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {}
  }

  playSwitch() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587, this.ctx.currentTime);
      osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) {}
  }

  playGoal() {
    if (!this.enabled || !this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const startTime = this.ctx.currentTime + idx * 0.09;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch (e) {}
  }

  playFail() {
    if (!this.enabled || !this.ctx) return;
    try {
      const notes = [310, 270, 240, 180];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const startTime = this.ctx.currentTime + idx * 0.12;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.16, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch (e) {}
  }
}

// ============================================================================
// 2. 파티클 시스템
// ============================================================================
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, count, color, speedRange = [1.5, 4.5], sizeRange = [3, 5], life = 28) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
        alpha: 1,
        life,
        maxLife: life
      });
    }
  }

  emitGoalConfetti(cx, cy) {
    const colors = ['#2ecc71', '#38bdf8', '#fbbf24', '#f43f5e', '#a855f7', '#ffffff'];
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 8;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 5,
        alpha: 1,
        life: 60 + Math.floor(Math.random() * 30),
        maxLife: 90
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life--;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ============================================================================
// 3. 재료 정의 (용수철 특성 및 훅의 법칙)
// ============================================================================
const MATERIALS = {
  rubber: {
    id: 'rubber',
    name: '부드러운 고무',
    k: 1.0,
    color: '#ff9f1c',
    glow: 'rgba(255, 159, 28, 0.6)',
    springWidth: 5,
    springCoils: 7,
    tag: '약한 힘 / 정밀 조절'
  },
  steel: {
    id: 'steel',
    name: '표준 강철',
    k: 1.8,
    color: '#2ec4b6',
    glow: 'rgba(46, 196, 182, 0.6)',
    springWidth: 7,
    springCoils: 9,
    tag: '균형 잡힌 표준'
  },
  titanium: {
    id: 'titanium',
    name: '슈퍼 티타늄 합금',
    k: 2.8,
    color: '#e71d36',
    glow: 'rgba(231, 29, 54, 0.7)',
    springWidth: 9,
    springCoils: 11,
    tag: '강력한 추진력'
  }
};

// 모든 기기에서 같은 결과가 나오도록 60 Hz 고정 물리값을 사용한다.
const PHYSICS = Object.freeze({
  fixedStepMs: 1000 / 60,
  defaultFriction: 0.998,
  launchPower: 0.105,
  maxSpeed: 18,
  stopSpeed: 0.60,
  maxFlightFrames: 900,
  normalRestitution: 0.92,
  normalRetention: 0.985,
  superRestitution: 1.12,
  dampingRestitution: 0.22,
  dampingRetention: 0.72,
  lateBounceRetention: 0.92,
  lateBounceStart: 12
});

// ============================================================================
// 4. 20개 스테이지 맵 데이터 (직선 통과 불가! 탄성 반사 필수 미로 맵)
// ============================================================================
const STAGES = [
  // STAGE 1: 탄성 반사의 기초 (직선 차단! 천장 1회 반사 L자 코스)
  {
    stageNum: 1,
    title: '탄성 반사의 기초',
    conceptTip: '정면이 벽으로 꽉 막혀 있습니다! 위쪽 천장 벽을 비스듬히 맞춰 튕겨 넘겨보세요(입사각 = 반사각).',
    balls: 3,
    launcher: { x: 180, y: 520 },
    goal: { x: 1080, y: 520, r: 38 },
    walls: [
      // 외곽 테두리
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 정면 완전 차단 벽 (직선 슛 불가!)
      { x: 600, y: 300, w: 40, h: 370, type: 'normal' },
      // 반사 유도 가이드 천장 블록
      { x: 500, y: 40, w: 240, h: 25, type: 'normal' }
    ]
  },

  // STAGE 2: U자 미로 챔버 (2회 벽 반사 필수)
  {
    stageNum: 2,
    title: 'U자 반사 미로',
    conceptTip: '골대가 발사대 바로 아래 방에 있습니다. 오른쪽 끝 벽을 튕겨 돌아서 들어오는 2회 연속 반사를 노려보세요!',
    balls: 4,
    launcher: { x: 180, y: 220 },
    goal: { x: 180, y: 520, r: 38 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 상하를 완전히 가르는 긴 중앙 칸막이 (직선 불가!)
      { x: 40, y: 360, w: 960, h: 30, type: 'normal' },
      // 오른쪽 입구 좁히는 유도 벽
      { x: 960, y: 160, w: 30, h: 210, type: 'normal' },
      { x: 960, y: 380, w: 30, h: 180, type: 'normal' }
    ]
  },

  // STAGE 3: 지그재그 S자 미로 (다중 반사 & 재료 k값)
  {
    stageNum: 3,
    title: '지그재그 S자 미로',
    conceptTip: '교차하는 벽들을 지그재그로 튕겨나가야 합니다. 먼 거리 통과를 위해 강철이나 티타늄 용수철을 사용해보세요!',
    balls: 4,
    launcher: { x: 160, y: 160 },
    goal: { x: 1120, y: 560, r: 38 },
    frictionFactor: 0.9985, // 여러 번 튕기므로 추진력(k값)이 중요!
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 위에서 내려오는 칸막이 (직선 차단 1)
      { x: 420, y: 40, w: 35, h: 460, type: 'normal' },
      // 아래에서 올라오는 칸막이 (직선 차단 2)
      { x: 800, y: 220, w: 35, h: 450, type: 'normal' }
    ]
  },

  // STAGE 4: 사각 회랑 4단 쿠션 미로
  {
    stageNum: 4,
    title: '사각 회랑 퍼즐',
    conceptTip: '중앙 거대 블록을 피해 벽 3면(우측, 상단, 좌측)을 차례로 튕기는 당구 쿠션 원리를 활용해 보세요.',
    balls: 4,
    launcher: { x: 200, y: 560 },
    goal: { x: 200, y: 160, r: 38 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 중앙을 거대하게 가로막는 사각 벽
      { x: 380, y: 180, w: 560, h: 360, type: 'normal' },
      // 발사대와 골대 사이 칸막이
      { x: 40, y: 360, w: 345, h: 26, type: 'normal' }
    ]
  },

  // STAGE 5: 슈퍼 범퍼 리바운드 미로
  {
    stageNum: 5,
    title: '슈퍼 범퍼 리바운드',
    conceptTip: '골대가 밀폐된 요새 안에 숨어 있습니다! 슈퍼 탄성 범퍼(핑크)를 맞추어 반대편 작은 입구로 튕겨 넣으세요.',
    balls: 4,
    launcher: { x: 160, y: 550 },
    goal: { x: 640, y: 360, r: 36 }, // 중앙 챔버 안
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 중앙 골대 챔버 (입구는 오직 오른쪽만 열림)
      { x: 500, y: 240, w: 25, h: 240, type: 'normal' }, // 왼쪽 차단
      { x: 500, y: 240, w: 280, h: 25, type: 'normal' }, // 위쪽 차단
      { x: 500, y: 455, w: 280, h: 25, type: 'normal' }, // 아래쪽 차단
      // 오른쪽 입구 유도 기둥
      { x: 780, y: 240, w: 25, h: 60, type: 'normal' },
      { x: 780, y: 420, w: 25, h: 60, type: 'normal' },
      // 상하 슈퍼 탄성 범퍼 (가속 리바운드)
      { x: 1000, y: 60, w: 25, h: 180, type: 'super' },
      { x: 1000, y: 480, w: 25, h: 180, type: 'super' }
    ]
  },

  // STAGE 6: 스펀지 함정 미로 (정밀 조준 필수)
  {
    stageNum: 6,
    title: '스펀지 함정 미로',
    conceptTip: '벽 곳곳에 탄성을 흡수하는 스펀지(노란색)가 설치되어 있습니다. 스펀지를 피해 파란 탄성 벽만 튕겨야 합니다!',
    balls: 4,
    launcher: { x: 160, y: 200 },
    goal: { x: 1100, y: 520, r: 38 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 1구역 차단벽 & 스펀지 함정
      { x: 380, y: 40, w: 30, h: 320, type: 'damping' },
      { x: 380, y: 460, w: 30, h: 210, type: 'normal' },
      // 2구역 차단벽 & 스펀지 함정
      { x: 750, y: 40, w: 30, h: 210, type: 'normal' },
      { x: 750, y: 350, w: 30, h: 320, type: 'damping' },
      // 중앙 유도 스펀지 패치
      { x: 500, y: 640, w: 180, h: 20, type: 'damping' },
      { x: 500, y: 60, w: 180, h: 20, type: 'damping' }
    ]
  },

  // STAGE 7: 더블 크랭크 미로 (W자형 정밀 코너링)
  {
    stageNum: 7,
    title: '더블 크랭크 미로',
    conceptTip: '지그재그로 꺾인 좁은 통로를 정확한 입사각=반사각으로 통과해야 합니다. 부드러운 고무 용수철로 정밀 조절해보세요.',
    balls: 5,
    launcher: { x: 140, y: 560 },
    goal: { x: 1140, y: 160, r: 36 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 3중 크랭크 칸막이들
      { x: 320, y: 160, w: 30, h: 510, type: 'normal' },
      { x: 600, y: 40, w: 30, h: 510, type: 'normal' },
      { x: 880, y: 160, w: 30, h: 510, type: 'normal' },
      // 통로 입구 모서리 가이드
      { x: 320, y: 40, w: 140, h: 20, type: 'normal' },
      { x: 880, y: 40, w: 140, h: 20, type: 'normal' }
    ]
  },

  // STAGE 8: 움직이는 탄성 게이트 미로
  {
    stageNum: 8,
    title: '움직이는 탄성 게이트',
    conceptTip: '중앙 통로를 위아래로 움직이는 탄성 벽이 가로막고 있습니다. 타이밍을 맞춰 열린 틈을 노리거나 벽을 튕기세요!',
    balls: 4,
    launcher: { x: 150, y: 220 },
    goal: { x: 1120, y: 520, r: 38 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 상하 고정 칸막이
      { x: 440, y: 40, w: 30, h: 260, type: 'normal' },
      { x: 440, y: 420, w: 30, h: 250, type: 'normal' },
      { x: 840, y: 40, w: 30, h: 260, type: 'normal' },
      { x: 840, y: 420, w: 30, h: 250, type: 'normal' }
    ],
    // 가운데 좁은 틈 사이를 왕복하는 움직이는 탄성 패들
    movingWall: {
      x: 640, y: 180, w: 35, h: 180, type: 'super',
      minY: 80, maxY: 460, speed: 3.2, dir: 1
    }
  },

  // STAGE 9: 스위치 연쇄 미로
  {
    stageNum: 9,
    title: '스위치 연쇄 미로',
    conceptTip: '골대가 닫힌 문 뒤에 격리되어 있습니다. 먼저 하단 벽을 튕겨 위쪽 스위치를 맞추어야 문이 열립니다!',
    balls: 4,
    launcher: { x: 150, y: 560 },
    goal: { x: 1120, y: 200, r: 38 },
    hasSwitch: true,
    switchTarget: { x: 560, y: 110, r: 26, active: false },
    gateWall: { x: 880, y: 60, w: 30, h: 320, type: 'normal', opened: false },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 스위치 보호 칸막이 (직선 타격 불가)
      { x: 380, y: 40, w: 30, h: 380, type: 'normal' },
      { x: 380, y: 540, w: 30, h: 130, type: 'normal' },
      // 골대 하단 차단벽
      { x: 880, y: 460, w: 30, h: 210, type: 'normal' },
      // 스위치 유도용 슈퍼 탄성 리바운더
      { x: 500, y: 640, w: 160, h: 20, type: 'super' }
    ]
  },

  // STAGE 10: 탄성 마스터 최종 미로 (종합 퍼즐)
  {
    stageNum: 10,
    title: '탄성 마스터 미로',
    conceptTip: '축하합니다! 4개 구역의 복합 미로입니다. 스위치 타격 + 슈퍼 범퍼 가속 + 3단 연속 반사로 문을 열고 최종 골인하세요!',
    balls: 5,
    launcher: { x: 140, y: 580 },
    goal: { x: 1120, y: 150, r: 40 },
    hasSwitch: true,
    switchTarget: { x: 480, y: 105, r: 25, active: false },
    gateWall: { x: 960, y: 60, w: 30, h: 360, type: 'normal', opened: false },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 340, y: 300, w: 30, h: 370, type: 'normal' },
      { x: 200, y: 640, w: 140, h: 20, type: 'damping' },
      { x: 500, y: 640, w: 180, h: 20, type: 'super' },
      { x: 740, y: 60, w: 160, h: 20, type: 'super' },
      { x: 680, y: 240, w: 30, h: 430, type: 'normal' },
      { x: 480, y: 160, w: 200, h: 25, type: 'normal' }
    ]
  },

  // STAGE 11: 바늘구멍 3중 쿠션 (Pinpoint Reflex)
  {
    stageNum: 11,
    title: '바늘구멍 3중 쿠션',
    conceptTip: '미세한 각도 오차도 허용되지 않는 초정밀 3단 쿠션 코스입니다. 고무 용수철로 힘과 각도를 극도로 섬세하게 맞춰보세요!',
    balls: 5,
    launcher: { x: 140, y: 550 },
    goal: { x: 1120, y: 180, r: 35 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 3개의 얇은 칸막이와 좁은 바늘구멍들
      { x: 340, y: 180, w: 25, h: 490, type: 'normal' }, // 위쪽 구멍(40~180)
      { x: 640, y: 40, w: 25, h: 480, type: 'normal' },  // 아래쪽 구멍(520~660)
      { x: 920, y: 220, w: 25, h: 450, type: 'normal' }, // 위쪽 구멍(40~220)
      // 골대 정면 차단 가이드
      { x: 1040, y: 40, w: 25, h: 320, type: 'normal' }
    ]
  },

  // STAGE 12: 더블 패들 크로스 (Twin Moving Paddles)
  {
    stageNum: 12,
    title: '더블 패들 크로스',
    conceptTip: '서로 다른 속도로 교차 왕복하는 2개의 탄성 패들이 있습니다. 두 패들이 열리는 찰나의 순간을 포착해 발사하세요!',
    balls: 5,
    launcher: { x: 140, y: 360 },
    goal: { x: 1120, y: 360, r: 38 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 중앙 상하 고정벽들
      { x: 420, y: 40, w: 30, h: 240, type: 'normal' },
      { x: 420, y: 440, w: 30, h: 230, type: 'normal' },
      { x: 840, y: 40, w: 30, h: 240, type: 'normal' },
      { x: 840, y: 440, w: 30, h: 230, type: 'normal' }
    ],
    // 2개의 엇갈려 움직이는 탄성 벽
    movingWalls: [
      { x: 580, y: 160, w: 30, h: 160, type: 'super', minY: 80, maxY: 480, speed: 3.4, dirY: 1 },
      { x: 720, y: 400, w: 30, h: 160, type: 'super', minY: 80, maxY: 480, speed: 2.8, dirY: -1 }
    ]
  },

  // STAGE 13: 2중 보안 매트릭스 (Dual Switch Matrix)
  {
    stageNum: 13,
    title: '2중 보안 매트릭스',
    conceptTip: '스위치 A와 스위치 B를 모두 켜야 골대 문이 열립니다! 벽면 탄성 튕김으로 두 방의 스위치를 차례로 공략하세요.',
    balls: 5,
    launcher: { x: 140, y: 360 },
    goal: { x: 1120, y: 360, r: 38 },
    switches: [
      { x: 500, y: 120, r: 24, active: false, label: 'A' },
      { x: 500, y: 600, r: 24, active: false, label: 'B' }
    ],
    gateWall: { x: 920, y: 220, w: 30, h: 280, type: 'normal', opened: false },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 스위치 A/B 격리 벽
      { x: 360, y: 180, w: 300, h: 25, type: 'normal' },
      { x: 360, y: 515, w: 300, h: 25, type: 'normal' },
      // 기존에는 세로벽이 위·아래 외곽벽을 모두 연결해 골대 쪽으로
      // 넘어갈 방법이 없었다. 중앙 통로를 열어 두 스위치 이후 진입 가능하게 한다.
      { x: 660, y: 40, w: 25, h: 245, type: 'normal' },
      { x: 660, y: 435, w: 25, h: 235, type: 'normal' },
      // 골대 상하 차단벽
      { x: 920, y: 40, w: 30, h: 180, type: 'normal' },
      { x: 920, y: 500, w: 30, h: 170, type: 'normal' }
    ]
  },

  // STAGE 14: 슈퍼 리바운더 트라이앵글 (Super Bumper Relay)
  {
    stageNum: 14,
    title: '슈퍼 리바운더 릴레이',
    conceptTip: '3개의 슈퍼 탄성 범퍼(핑크)가 삼각형으로 배치되어 있습니다. 첫 범퍼를 정확히 맞추어 2연속 가속 릴레이를 타야 합니다!',
    balls: 4,
    launcher: { x: 150, y: 560 },
    goal: { x: 640, y: 150, r: 38 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 골대 하단 거대 차단벽
      { x: 440, y: 240, w: 400, h: 30, type: 'normal' },
      // 3개 슈퍼 탄성 범퍼
      { x: 460, y: 640, w: 180, h: 20, type: 'super' }, // 1번 범퍼
      { x: 1195, y: 300, w: 25, h: 200, type: 'super' }, // 2번 범퍼
      { x: 780, y: 60, w: 180, h: 20, type: 'super' }    // 3번 범퍼
    ]
  },

  // STAGE 15: 스펀지 지뢰밭 미로 (Spongy Minefield)
  {
    stageNum: 15,
    title: '스펀지 지뢰밭 미로',
    conceptTip: '통로 곳곳에 노란 스펀지 벽들이 촘촘히 널려 있습니다. 빗나가면 속도를 완전히 잃으니, 파란 벽 모서리만 정밀 타격하세요!',
    balls: 5,
    launcher: { x: 140, y: 200 },
    goal: { x: 1120, y: 560, r: 36 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 스펀지 지뢰들 (노란색 - 속도 흡수)
      { x: 360, y: 40, w: 50, h: 240, type: 'damping' },
      { x: 360, y: 440, w: 50, h: 230, type: 'damping' },
      { x: 620, y: 220, w: 50, h: 280, type: 'damping' },
      { x: 880, y: 40, w: 50, h: 240, type: 'damping' },
      { x: 880, y: 440, w: 50, h: 230, type: 'damping' },
      // 안전한 파란 일반 반사벽 모서리들
      { x: 360, y: 280, w: 50, h: 30, type: 'normal' },
      { x: 620, y: 40, w: 50, h: 30, type: 'normal' },
      { x: 620, y: 640, w: 50, h: 30, type: 'normal' },
      { x: 880, y: 280, w: 50, h: 30, type: 'normal' }
    ]
  },

  // STAGE 16: 움직이는 골대 타깃 (Moving Target Chase)
  {
    stageNum: 16,
    title: '움직이는 골대 타깃',
    conceptTip: '오른쪽 수직 복도에서 골대 자체가 위아래로 움직입니다! 벽을 2회 튕겨 날아가는 시간과 골대의 위치를 동시에 계산하세요.',
    balls: 5,
    launcher: { x: 140, y: 560 },
    // 움직이는 골대!
    goal: {
      x: 1120, y: 360, r: 38,
      moving: { minY: 140, maxY: 580, speed: 2.8, dirY: 1 }
    },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 골대 수직 복도 격리벽
      { x: 960, y: 180, w: 30, h: 360, type: 'normal' },
      // 1구역 차단벽
      { x: 480, y: 220, w: 30, h: 450, type: 'normal' },
      // 천장 반사 유도 슈퍼 범퍼
      { x: 380, y: 40, w: 200, h: 22, type: 'super' }
    ]
  },

  // STAGE 17: 티타늄 나선형 회랑 (Titanium Spiral Core)
  {
    stageNum: 17,
    title: '티타늄 나선형 회랑',
    conceptTip: '중심 핵까지 파고드는 4단 나선형 미로입니다. 긴 거리를 유지하기 위해 탄성계수 k=2.8인 티타늄 합금을 최대로 당기세요!',
    balls: 4,
    launcher: { x: 140, y: 140 },
    goal: { x: 640, y: 425, r: 34 }, // 중심 핵
    frictionFactor: 0.999, // 긴 나선 통로에서 티타늄의 힘이 유지되도록 조정
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 나선 1단계
      { x: 40, y: 240, w: 1040, h: 25, type: 'normal' },
      // 나선 2단계
      { x: 220, y: 240, w: 25, h: 320, type: 'normal' },
      { x: 220, y: 560, w: 860, h: 25, type: 'normal' },
      // 나선 3단계
      { x: 1055, y: 360, w: 25, h: 225, type: 'normal' },
      { x: 420, y: 360, w: 660, h: 25, type: 'normal' },
      // 나선 4단계 (핵 격리)
      { x: 420, y: 360, w: 25, h: 145, type: 'normal' },
      { x: 420, y: 480, w: 340, h: 25, type: 'normal' }
    ]
  },

  // STAGE 18: 크로스 게이트 듀얼 스위치 (Dual Switch Labyrinth)
  {
    stageNum: 18,
    title: '크로스 게이트 듀얼 스위치',
    conceptTip: '서로 다른 코너에 있는 스위치 1번과 2번을 모두 켜야만 중앙에 봉인된 골대 게이트가 활성화됩니다!',
    balls: 5,
    launcher: { x: 150, y: 550 },
    goal: { x: 640, y: 365, r: 38 },
    switches: [
      { x: 180, y: 140, r: 24, active: false, label: '1' },
      { x: 1100, y: 600, r: 24, active: false, label: '2' }
    ],
    gateWalls: [
      { x: 540, y: 300, w: 25, h: 120, type: 'normal', opened: false },
      { x: 715, y: 300, w: 25, h: 120, type: 'normal', opened: false }
    ],
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 중앙 골대 상하 봉인벽
      { x: 540, y: 300, w: 200, h: 25, type: 'normal' },
      { x: 540, y: 420, w: 200, h: 25, type: 'normal' },
      // 대각선 격리벽들
      { x: 380, y: 40, w: 30, h: 360, type: 'normal' },
      { x: 860, y: 320, w: 30, h: 350, type: 'normal' },
      // 스위치 1 유도 범퍼
      { x: 380, y: 640, w: 160, h: 20, type: 'super' }
    ]
  },

  // STAGE 19: 트리플 패들 핀볼 (Triple Paddle Fortress)
  {
    stageNum: 19,
    title: '트리플 패들 핀볼',
    conceptTip: '3개의 탄성 패들이 서로 다른 리듬으로 움직입니다. 패들의 반발력을 가속 발판 삼아 최종 골대를 향해 쏘아 올리세요!',
    balls: 5,
    launcher: { x: 140, y: 560 },
    goal: { x: 1120, y: 160, r: 38 },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 통로 고정 칸막이들
      { x: 360, y: 40, w: 25, h: 240, type: 'normal' },
      { x: 620, y: 440, w: 25, h: 230, type: 'normal' },
      { x: 880, y: 40, w: 25, h: 240, type: 'normal' }
    ],
    movingWalls: [
      { x: 360, y: 340, w: 28, h: 140, type: 'super', minY: 200, maxY: 560, speed: 3.2, dirY: 1 },
      { x: 620, y: 180, w: 28, h: 140, type: 'super', minY: 80, maxY: 420, speed: 2.6, dirY: -1 },
      { x: 880, y: 340, w: 28, h: 140, type: 'super', minY: 200, maxY: 560, speed: 3.6, dirY: 1 }
    ]
  },

  // STAGE 20: 궁극의 탄성 그랜드마스터 (The Grandmaster Challenge)
  {
    stageNum: 20,
    title: '궁극의 탄성 그랜드마스터',
    conceptTip: '최종 관문! 2개 스위치 타격 + 움직이는 슈퍼 패들 통과 + 스펀지 함정 회피 + 4단 연속 리바운드를 모두 성공시켜 진정한 탄성 마스터가 되세요!',
    balls: 6,
    launcher: { x: 130, y: 580 },
    goal: { x: 1140, y: 140, r: 40 },
    switches: [
      { x: 380, y: 110, r: 24, active: false, label: 'α' },
      { x: 820, y: 610, r: 24, active: false, label: 'β' }
    ],
    gateWall: { x: 980, y: 40, w: 30, h: 320, type: 'normal', opened: false },
    walls: [
      { x: 40, y: 40, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 660, w: 1200, h: 20, type: 'normal' },
      { x: 40, y: 40, w: 20, h: 640, type: 'normal' },
      { x: 1220, y: 40, w: 20, h: 640, type: 'normal' },
      // 1구역 차단벽
      { x: 280, y: 260, w: 30, h: 410, type: 'normal' },
      // 스펀지 함정
      { x: 160, y: 640, w: 120, h: 20, type: 'damping' },
      { x: 620, y: 260, w: 30, h: 410, type: 'damping' },
      // 슈퍼 탄성 플레이트들
      { x: 440, y: 640, w: 160, h: 20, type: 'super' },
      { x: 680, y: 60, w: 160, h: 20, type: 'super' },
      // 골대 하단 방어벽
      { x: 980, y: 360, w: 30, h: 310, type: 'normal' }
    ],
    movingWalls: [
      { x: 500, y: 220, w: 30, h: 160, type: 'super', minY: 100, maxY: 500, speed: 3.5, dirY: 1 }
    ]
  }
];

// ============================================================================
// 5. 메인 게임 루프 및 상호작용 매니저
// ============================================================================
class ElasticGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.sound = new SoundController();
    this.particles = new ParticleSystem();

    // 스테이지 상태
    this.currentStageIndex = 0;
    this.currentMaterial = MATERIALS.rubber;
    this.ballsLeft = 3;
    this.shotsUsedInStage = 0;
    this.maxForceRecorded = 0;

    // 공(발사체) 물리 상태 (중력 없음, 2D 직선 운동)
    this.ball = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 16,
      scaleX: 1,
      scaleY: 1,
      trail: [],
      flightFrames: 0,
      state: 'READY' // READY, AIMING, FLYING, CLEARED, STOPPED
    };

    // 용수철 발사대
    this.launcher = {
      anchorX: 180,
      anchorY: 360,
      dragX: 180,
      dragY: 360,
      maxPull: 140,
      isDragging: false,
      pullDist: 0,
      pullAngle: 0,
      calculatedForce: 0
    };

    this.currentStage = null;
    this.completedStages = this.loadCompletedStages();
    this.screenShake = 0;
    this.modalTimer = null;
    this.accumulator = 0;

    this.cacheDOMElements();
    this.bindEvents();
    this.loadStage(0);

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loadCompletedStages() {
    try {
      const saved = JSON.parse(localStorage.getItem('elasticQuest.completedStages') || '[]');
      return new Set(saved.filter((stageNum) => Number.isInteger(stageNum) && stageNum >= 1 && stageNum <= STAGES.length));
    } catch (error) {
      return new Set();
    }
  }

  saveCompletedStages() {
    try {
      localStorage.setItem(
        'elasticQuest.completedStages',
        JSON.stringify([...this.completedStages].sort((a, b) => a - b))
      );
    } catch (error) {
      // 저장 공간이 막힌 환경에서도 게임 자체는 계속 진행한다.
    }
  }

  cacheDOMElements() {
    this.domStageBadge = document.getElementById('current-stage-badge');
    this.domStageTitle = document.getElementById('current-stage-title');
    this.domBallsLeft = document.getElementById('balls-left-count');
    this.domMeterK = document.getElementById('meter-k-val');
    this.domMeterX = document.getElementById('meter-x-val');
    this.domMeterForce = document.getElementById('meter-force-total');
    this.domGaugeFill = document.getElementById('gauge-fill');
    this.domHint = document.getElementById('drag-guide-hint');

    this.clearModal = document.getElementById('clear-modal');
    this.failModal = document.getElementById('fail-modal');
    this.stageSelectModal = document.getElementById('stage-select-modal');
    this.stagesGridContainer = document.getElementById('stages-grid-container');

    this.modalClearTitle = document.getElementById('modal-clear-title');
    this.modalScienceTip = document.getElementById('modal-science-tip');
    this.modalShotsUsed = document.getElementById('modal-shots-used');
    this.modalMaxForce = document.getElementById('modal-max-force');

    this.btnRestart = document.getElementById('btn-restart');
    this.btnStageSelect = document.getElementById('btn-stage-select');
    this.btnCloseStageSelect = document.getElementById('btn-close-stage-select');
    this.btnSound = document.getElementById('btn-sound');
    this.soundIcon = document.getElementById('sound-icon');
    this.btnModalNext = document.getElementById('btn-modal-next');
    this.btnModalRetry = document.getElementById('btn-modal-retry');
    this.btnModalFailRetry = document.getElementById('btn-modal-fail-retry');

    this.materialButtons = {
      rubber: document.getElementById('mat-rubber'),
      steel: document.getElementById('mat-steel'),
      titanium: document.getElementById('mat-titanium')
    };
  }

  bindEvents() {
    // 재료 선택 탭 (click은 터치·마우스·키보드를 모두 지원한다.)
    Object.keys(this.materialButtons).forEach((key) => {
      this.materialButtons[key].addEventListener('click', (e) => {
        e.preventDefault();
        this.selectMaterial(MATERIALS[key]);
      });
    });

    // 상단 네비게이션 버튼
    this.btnRestart.addEventListener('click', (e) => {
      e.preventDefault();
      this.restartCurrentStage();
    });

    this.btnStageSelect.addEventListener('click', (e) => {
      e.preventDefault();
      this.openStageSelectModal();
    });

    this.btnCloseStageSelect.addEventListener('click', (e) => {
      e.preventDefault();
      this.stageSelectModal.classList.add('hidden');
      this.btnStageSelect.focus({ preventScroll: true });
    });

    this.btnSound.addEventListener('click', (e) => {
      e.preventDefault();
      this.sound.enabled = !this.sound.enabled;
      this.soundIcon.textContent = this.sound.enabled ? '🔊' : '🔇';
      this.btnSound.setAttribute('aria-pressed', String(this.sound.enabled));
      if (this.sound.enabled) this.sound.init();
    });

    // 모달 액션
    this.btnModalNext.addEventListener('click', (e) => {
      e.preventDefault();
      this.clearModal.classList.add('hidden');
      if (this.currentStageIndex < STAGES.length - 1) {
        this.loadStage(this.currentStageIndex + 1);
      } else {
        this.loadStage(0);
      }
    });

    this.btnModalRetry.addEventListener('click', (e) => {
      e.preventDefault();
      this.clearModal.classList.add('hidden');
      this.restartCurrentStage();
    });

    this.btnModalFailRetry.addEventListener('click', (e) => {
      e.preventDefault();
      this.failModal.classList.add('hidden');
      this.restartCurrentStage();
    });

    // 터치 & 마우스 드래그 조작 (Pointer Events)
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.stageSelectModal.classList.add('hidden');
        this.btnStageSelect.focus({ preventScroll: true });
      } else if (e.key.toLowerCase() === 'r' && !e.repeat) {
        this.restartCurrentStage();
      }
    });

    this.stageSelectModal.addEventListener('click', (e) => {
      if (e.target === this.stageSelectModal) {
        this.stageSelectModal.classList.add('hidden');
        this.btnStageSelect.focus({ preventScroll: true });
      }
    });

    document.addEventListener('visibilitychange', () => {
      this.lastTime = performance.now();
      this.accumulator = 0;
    });
  }

  // 화면 좌표 -> 캔버스 가상 좌표(1280x720) 변환
  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  selectMaterial(material) {
    if (this.ball.state === 'FLYING' || this.ball.state === 'CLEARED') return;
    this.currentMaterial = material;
    Object.keys(this.materialButtons).forEach((key) => {
      this.materialButtons[key].classList.toggle('active', key === material.id);
      this.materialButtons[key].setAttribute('aria-pressed', String(key === material.id));
    });
    this.updateHUDMeter(this.launcher.pullDist);
    this.sound.playTension(0.4);
  }

  loadStage(index) {
    if (!Number.isInteger(index) || index < 0 || index >= STAGES.length) return;
    if (this.modalTimer) {
      clearTimeout(this.modalTimer);
      this.modalTimer = null;
    }
    this.currentStageIndex = index;
    const rawData = STAGES[index];
    this.currentStage = JSON.parse(JSON.stringify(rawData));
    this.ballsLeft = this.currentStage.balls;
    this.shotsUsedInStage = 0;
    this.maxForceRecorded = 0;

    // 발사대 위치
    this.launcher.anchorX = this.currentStage.launcher.x;
    this.launcher.anchorY = this.currentStage.launcher.y;
    this.launcher.dragX = this.launcher.anchorX;
    this.launcher.dragY = this.launcher.anchorY;
    this.launcher.pullDist = 0;
    this.launcher.isDragging = false;

    this.resetBallToLauncher();

    // UI 반영
    this.domStageBadge.textContent = `STAGE ${this.currentStage.stageNum}`;
    this.domStageTitle.textContent = this.currentStage.title;
    this.domBallsLeft.textContent = this.ballsLeft;
    this.updateHUDMeter(0);

    if (index === 0) {
      this.domHint.style.opacity = '1';
    } else {
      this.domHint.style.opacity = '0';
    }

    this.clearModal.classList.add('hidden');
    this.failModal.classList.add('hidden');
    this.stageSelectModal.classList.add('hidden');
    this.canvas.focus({ preventScroll: true });
  }

  restartCurrentStage() {
    this.loadStage(this.currentStageIndex);
  }

  resetBallToLauncher() {
    this.ball.x = this.launcher.anchorX;
    this.ball.y = this.launcher.anchorY;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.scaleX = 1;
    this.ball.scaleY = 1;
    this.ball.trail = [];
    this.ball.flightFrames = 0;
    this.ball.state = 'READY';
    this.launcher.dragX = this.launcher.anchorX;
    this.launcher.dragY = this.launcher.anchorY;
    this.launcher.pullDist = 0;
    Object.values(this.materialButtons).forEach((button) => { button.disabled = false; });
    this.updateHUDMeter(0);
  }

  onPointerDown(e) {
    this.sound.init();
    if (this.ball.state !== 'READY') return;

    const coords = this.getCanvasCoords(e);
    const distToBall = Math.hypot(coords.x - this.ball.x, coords.y - this.ball.y);

    // 태블릿 터치를 고려해 주변 75px까지 넉넉하게 터치 감지
    if (distToBall <= 75) {
      this.launcher.isDragging = true;
      this.ball.state = 'AIMING';
      this.domHint.style.opacity = '0';
      this.onPointerMove(e);
    }
  }

  onPointerMove(e) {
    if (!this.launcher.isDragging || this.ball.state !== 'AIMING') return;

    const coords = this.getCanvasCoords(e);
    let dx = coords.x - this.launcher.anchorX;
    let dy = coords.y - this.launcher.anchorY;
    let dist = Math.hypot(dx, dy);

    if (dist > this.launcher.maxPull) {
      dx = (dx / dist) * this.launcher.maxPull;
      dy = (dy / dist) * this.launcher.maxPull;
      dist = this.launcher.maxPull;
    }

    this.launcher.dragX = this.launcher.anchorX + dx;
    this.launcher.dragY = this.launcher.anchorY + dy;
    this.launcher.pullDist = dist;
    this.launcher.pullAngle = Math.atan2(dy, dx);

    this.ball.x = this.launcher.dragX;
    this.ball.y = this.launcher.dragY;

    this.updateHUDMeter(dist);

    if (Math.random() < 0.2) {
      this.sound.playTension(dist / this.launcher.maxPull);
    }
  }

  onPointerUp(e) {
    if (!this.launcher.isDragging) return;
    this.launcher.isDragging = false;

    // 16px 이상 당겼을 때 발사
    if (this.launcher.pullDist > 16) {
      this.fireBall();
    } else {
      this.resetBallToLauncher();
    }
  }

  updateHUDMeter(pullPx) {
    const xCm = (pullPx / 10).toFixed(1);
    const kVal = this.currentMaterial.k;
    const forceN = (kVal * xCm).toFixed(1);
    this.launcher.calculatedForce = parseFloat(forceN);

    if (this.launcher.calculatedForce > this.maxForceRecorded) {
      this.maxForceRecorded = this.launcher.calculatedForce;
    }

    this.domMeterK.textContent = `k(${kVal.toFixed(1)})`;
    this.domMeterX.textContent = `x(${xCm}cm)`;
    this.domMeterForce.textContent = forceN;

    const ratio = Math.min(100, (parseFloat(forceN) / 40) * 100);
    this.domGaugeFill.style.width = `${ratio}%`;
  }

  fireBall() {
    this.ball.state = 'FLYING';
    this.ball.bounceCount = 0;
    this.ball.flightFrames = 0;
    this.shotsUsedInStage++;
    this.ballsLeft--;
    this.domBallsLeft.textContent = this.ballsLeft;
    Object.values(this.materialButtons).forEach((button) => { button.disabled = true; });

    const pullX = this.launcher.dragX - this.launcher.anchorX;
    const pullY = this.launcher.dragY - this.launcher.anchorY;

    // 물체는 용수철이 원래 길이로 돌아온 평형점에서 출발한다.
    // 당긴 좌표에서 그대로 출발시키면 왼쪽 외곽벽 뒤에 끼는 문제가 생긴다.
    this.ball.x = this.launcher.anchorX;
    this.ball.y = this.launcher.anchorY;

    const launchPower = PHYSICS.launchPower * this.currentMaterial.k;
    this.ball.vx = -pullX * launchPower;
    this.ball.vy = -pullY * launchPower;

    // 최대 발사 속도 제한 (과속 방지)
    const curSpeed = Math.hypot(this.ball.vx, this.ball.vy);
    const maxSpeed = PHYSICS.maxSpeed;
    if (curSpeed > maxSpeed) {
      this.ball.vx = (this.ball.vx / curSpeed) * maxSpeed;
      this.ball.vy = (this.ball.vy / curSpeed) * maxSpeed;
    }

    this.sound.playRelease(this.launcher.pullDist / this.launcher.maxPull);
    this.particles.emit(
      this.launcher.anchorX,
      this.launcher.anchorY,
      14,
      this.currentMaterial.color,
      [1.5, 4.5],
      [2.5, 4.5],
      22
    );

    this.screenShake = 3;
  }

  // ============================================================================
  // 물리 충돌 계산 및 갱신 (중력 없음, 2D 직선 탄성 반사)
  // ============================================================================
  updatePhysics(dt) {
    this.particles.update();

    if (this.screenShake > 0) {
      this.screenShake *= 0.88;
      if (this.screenShake < 0.2) this.screenShake = 0;
    }

    // 1. 움직이는 장애물들 업데이트 (단일 및 다중 지원)
    if (this.currentStage) {
      // 단일 movingWall
      if (this.currentStage.movingWall) {
        const mw = this.currentStage.movingWall;
        mw.y += mw.speed * mw.dir;
        if (mw.y <= mw.minY) { mw.y = mw.minY; mw.dir = 1; }
        else if (mw.y >= mw.maxY) { mw.y = mw.maxY; mw.dir = -1; }
      }
      // 다중 movingWalls
      if (this.currentStage.movingWalls) {
        for (const mw of this.currentStage.movingWalls) {
          if (mw.dirY) {
            mw.y += mw.speed * mw.dirY;
            if (mw.y <= mw.minY) { mw.y = mw.minY; mw.dirY = 1; }
            else if (mw.y >= mw.maxY) { mw.y = mw.maxY; mw.dirY = -1; }
          }
          if (mw.dirX) {
            mw.x += mw.speed * mw.dirX;
            if (mw.x <= mw.minX) { mw.x = mw.minX; mw.dirX = 1; }
            else if (mw.x >= mw.maxX) { mw.x = mw.maxX; mw.dirX = -1; }
          }
        }
      }
      // 움직이는 골대 (movingGoal)
      if (this.currentStage.goal && this.currentStage.goal.moving) {
        const mg = this.currentStage.goal;
        const mov = mg.moving;
        if (mov.dirY) {
          mg.y += mov.speed * mov.dirY;
          if (mg.y <= mov.minY) { mg.y = mov.minY; mov.dirY = 1; }
          else if (mg.y >= mov.maxY) { mg.y = mov.maxY; mov.dirY = -1; }
        }
        if (mov.dirX) {
          mg.x += mov.speed * mov.dirX;
          if (mg.x <= mov.minX) { mg.x = mov.minX; mov.dirX = 1; }
          else if (mg.x >= mov.maxX) { mg.x = mov.maxX; mov.dirX = -1; }
        }
      }
    }

    if (this.ball.state === 'FLYING') {
      this.ball.flightFrames++;
      const friction = this.currentStage.frictionFactor || PHYSICS.defaultFriction;
      this.ball.vx *= friction;
      this.ball.vy *= friction;

      this.ball.x += this.ball.vx;
      this.ball.y += this.ball.vy;

      this.ball.trail.push({ x: this.ball.x, y: this.ball.y, alpha: 0.8 });
      if (this.ball.trail.length > 24) {
        this.ball.trail.shift();
      }
      for (const pt of this.ball.trail) {
        pt.alpha *= 0.95;
      }

      this.ball.scaleX += (1 - this.ball.scaleX) * 0.15;
      this.ball.scaleY += (1 - this.ball.scaleY) * 0.15;

      this.checkGoalCollision();

      // 스위치 충돌 판정 (단일 switchTarget 및 다중 switches 지원)
      this.checkSwitchCollision();

      this.checkWallCollisions();

      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      const isOutOfScreen = (
        this.ball.x < -30 ||
        this.ball.x > this.canvas.width + 30 ||
        this.ball.y < -30 ||
        this.ball.y > this.canvas.height + 30
      );

      if (isOutOfScreen || speed < PHYSICS.stopSpeed || this.ball.flightFrames >= PHYSICS.maxFlightFrames) {
        this.onBallStop();
      }
    }
  }

  checkGoalCollision() {
    const goal = this.currentStage.goal;
    const dist = Math.hypot(this.ball.x - goal.x, this.ball.y - goal.y);

    if (dist < goal.r + this.ball.radius * 0.5) {
      this.ball.state = 'CLEARED';
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.sound.playGoal();
      this.particles.emitGoalConfetti(goal.x, goal.y);
      this.screenShake = 6;

      this.completedStages.add(this.currentStage.stageNum);
      this.saveCompletedStages();

      this.modalTimer = setTimeout(() => {
        this.modalTimer = null;
        this.showClearModal();
      }, 600);
    }
  }

  checkSwitchCollision() {
    // 1. 단일 스위치
    if (this.currentStage.hasSwitch && this.currentStage.switchTarget && !this.currentStage.switchTarget.active) {
      const sw = this.currentStage.switchTarget;
      const dist = Math.hypot(this.ball.x - sw.x, this.ball.y - sw.y);
      if (dist < sw.r + this.ball.radius) {
        sw.active = true;
        this.sound.playSwitch();
        this.particles.emit(sw.x, sw.y, 20, '#fbbf24', [2, 7], [3, 6], 30);
        if (this.currentStage.gateWall) {
          this.currentStage.gateWall.opened = true;
        }
      }
    }

    // 2. 다중 스위치 (switches 배열)
    if (this.currentStage.switches) {
      for (const sw of this.currentStage.switches) {
        if (!sw.active) {
          const dist = Math.hypot(this.ball.x - sw.x, this.ball.y - sw.y);
          if (dist < sw.r + this.ball.radius) {
            sw.active = true;
            this.sound.playSwitch();
            this.particles.emit(sw.x, sw.y, 20, '#fbbf24', [2, 7], [3, 6], 30);
          }
        }
      }
      // 모든 스위치가 활성화되었는지 확인
      const allActive = this.currentStage.switches.every((s) => s.active);
      if (allActive) {
        if (this.currentStage.gateWall) {
          this.currentStage.gateWall.opened = true;
        }
        if (this.currentStage.gateWalls) {
          for (const gw of this.currentStage.gateWalls) {
            gw.opened = true;
          }
        }
      }
    }
  }

  checkWallCollisions() {
    const walls = [...this.currentStage.walls];

    // 움직이는 벽들 취합
    if (this.currentStage.movingWall) {
      walls.push(this.currentStage.movingWall);
    }
    if (this.currentStage.movingWalls) {
      walls.push(...this.currentStage.movingWalls);
    }

    // 닫혀있는 게이트 벽들 취합
    if (this.currentStage.gateWall && !this.currentStage.gateWall.opened) {
      walls.push(this.currentStage.gateWall);
    }
    if (this.currentStage.gateWalls) {
      for (const gw of this.currentStage.gateWalls) {
        if (!gw.opened) walls.push(gw);
      }
    }

    for (const w of walls) {
      const nearestX = Math.max(w.x, Math.min(this.ball.x, w.x + w.w));
      const nearestY = Math.max(w.y, Math.min(this.ball.y, w.y + w.h));

      const distX = this.ball.x - nearestX;
      const distY = this.ball.y - nearestY;
      const distance = Math.hypot(distX, distY);

      if (distance < this.ball.radius) {
        let nx = distX;
        let ny = distY;

        let overlap = this.ball.radius - distance;

        if (distance === 0) {
          const sides = [
            { depth: this.ball.x - w.x, nx: -1, ny: 0 },
            { depth: w.x + w.w - this.ball.x, nx: 1, ny: 0 },
            { depth: this.ball.y - w.y, nx: 0, ny: -1 },
            { depth: w.y + w.h - this.ball.y, nx: 0, ny: 1 }
          ];
          const nearestSide = sides.reduce((best, side) => side.depth < best.depth ? side : best);
          nx = nearestSide.nx;
          ny = nearestSide.ny;
          overlap = this.ball.radius + Math.max(0, nearestSide.depth);
        } else {
          nx /= distance;
          ny /= distance;
        }

        this.ball.x += nx * overlap;
        this.ball.y += ny * overlap;

        const dot = this.ball.vx * nx + this.ball.vy * ny;

        if (dot < 0) {
          // 벽 충돌 횟수 누적
          this.ball.bounceCount = (this.ball.bounceCount || 0) + 1;

          // 벽 종류별 탄성 반발 계수(e). 여러 번 반사하는 스테이지에서도
          // 공이 도중에 멈추지 않도록 일반 벽의 에너지 보존율을 높였다.
          let restitution = PHYSICS.normalRestitution;
          let retention = PHYSICS.normalRetention;
          let wallColor = '#38bdf8';

          if (w.type === 'super') {
            restitution = PHYSICS.superRestitution;
            retention = 1;
            wallColor = '#ff007f';
            this.screenShake = 4;
          } else if (w.type === 'damping') {
            restitution = PHYSICS.dampingRestitution;
            retention = PHYSICS.dampingRetention;
            wallColor = '#fbbf24';
          }

          // 탄성 반사: v' = v - (1 + e) * (v · n) * n
          this.ball.vx -= (1 + restitution) * dot * nx;
          this.ball.vy -= (1 + restitution) * dot * ny;

          this.ball.vx *= retention;
          this.ball.vy *= retention;

          // 아주 긴 무한 핀볼만 천천히 정리하고, 의도한 다중 반사는 보존한다.
          if (this.ball.bounceCount >= PHYSICS.lateBounceStart && w.type !== 'super') {
            this.ball.vx *= PHYSICS.lateBounceRetention;
            this.ball.vy *= PHYSICS.lateBounceRetention;
          }

          // 과속 방지 클램프
          const spd = Math.hypot(this.ball.vx, this.ball.vy);
          if (spd > PHYSICS.maxSpeed) {
            this.ball.vx = (this.ball.vx / spd) * PHYSICS.maxSpeed;
            this.ball.vy = (this.ball.vy / spd) * PHYSICS.maxSpeed;
          }

          this.sound.playBounce(w.type, spd);
          this.particles.emit(nearestX, nearestY, 7, wallColor, [1.5, 4], [2, 3.5], 18);

          this.ball.scaleX = 0.8;
          this.ball.scaleY = 1.25;
        }
      }
    }
  }

  onBallStop() {
    if (this.ball.state === 'CLEARED') return;

    if (this.ballsLeft > 0) {
      this.resetBallToLauncher();
    } else {
      this.ball.state = 'STOPPED';
      this.sound.playFail();
      this.modalTimer = setTimeout(() => {
        this.modalTimer = null;
        this.failModal.classList.remove('hidden');
        this.btnModalFailRetry.focus({ preventScroll: true });
      }, 400);
    }
  }

  showClearModal() {
    this.modalClearTitle.textContent = `STAGE ${this.currentStage.stageNum} 클리어!`;
    this.modalScienceTip.textContent = this.currentStage.conceptTip;
    this.modalShotsUsed.textContent = `${this.shotsUsedInStage}개`;
    this.modalMaxForce.textContent = `${this.maxForceRecorded.toFixed(1)} N`;
    this.btnModalNext.textContent = this.currentStageIndex === STAGES.length - 1
      ? '처음부터 다시 ➔'
      : '다음 단계로 ➔';
    this.clearModal.classList.remove('hidden');
    this.btnModalNext.focus({ preventScroll: true });
  }

  openStageSelectModal() {
    this.stagesGridContainer.innerHTML = '';
    STAGES.forEach((stg, i) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'stage-tile';
      if (i === this.currentStageIndex) tile.classList.add('current');
      if (this.completedStages.has(stg.stageNum)) tile.classList.add('cleared');
      tile.setAttribute('aria-label', `${stg.stageNum}단계 ${stg.title}${this.completedStages.has(stg.stageNum) ? ', 완료' : ''}`);

      tile.innerHTML = `
        <div class="stage-tile-num">${stg.stageNum}</div>
        <div class="stage-tile-name">${stg.title}</div>
        <div class="stage-tile-stars">${this.completedStages.has(stg.stageNum) ? '★ 완료' : '도전'}</div>
      `;

      tile.addEventListener('click', () => {
        this.loadStage(i);
      });

      this.stagesGridContainer.appendChild(tile);
    });

    this.stageSelectModal.classList.remove('hidden');
    const currentTile = this.stagesGridContainer.querySelector('.stage-tile.current');
    if (currentTile) currentTile.focus({ preventScroll: true });
  }

  // ============================================================================
  // 6. 렌더링 시스템
  // ============================================================================
  render() {
    this.ctx.save();

    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake * 2;
      const sy = (Math.random() - 0.5) * this.screenShake * 2;
      this.ctx.translate(sx, sy);
    }

    // 배경 클리어
    this.ctx.fillStyle = '#0a0e17';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawGrid();
    this.drawWalls();
    this.drawGoal();

    if (this.currentStage.hasSwitch || this.currentStage.switches) {
      this.drawSwitch();
    }

    this.particles.draw(this.ctx);
    this.drawBallTrail();
    this.drawSpringLauncher();
    this.drawBall();

    this.ctx.restore();
  }

  drawGrid() {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    this.ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < this.canvas.width; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  drawWalls() {
    const walls = [...this.currentStage.walls];
    if (this.currentStage.movingWall) walls.push(this.currentStage.movingWall);
    if (this.currentStage.movingWalls) walls.push(...this.currentStage.movingWalls);
    if (this.currentStage.gateWall && !this.currentStage.gateWall.opened) {
      walls.push(this.currentStage.gateWall);
    }
    if (this.currentStage.gateWalls) {
      for (const gw of this.currentStage.gateWalls) {
        if (!gw.opened) walls.push(gw);
      }
    }

    for (const w of walls) {
      this.ctx.save();
      if (w.type === 'super') {
        this.ctx.fillStyle = '#ff007f';
        this.ctx.shadowColor = 'rgba(255, 0, 127, 0.7)';
        this.ctx.shadowBlur = 14;
        this.ctx.fillRect(w.x, w.y, w.w, w.h);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeRect(w.x + 2, w.y + 2, w.w - 4, w.h - 4);
      } else if (w.type === 'damping') {
        this.ctx.fillStyle = '#d97706';
        this.ctx.fillRect(w.x, w.y, w.w, w.h);
        this.ctx.strokeStyle = '#fbbf24';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(w.x, w.y, w.w, w.h);
      } else {
        this.ctx.fillStyle = '#1e293b';
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 2.5;
        this.ctx.shadowColor = 'rgba(56, 189, 248, 0.25)';
        this.ctx.shadowBlur = 8;
        this.ctx.fillRect(w.x, w.y, w.w, w.h);
        this.ctx.strokeRect(w.x, w.y, w.w, w.h);
      }
      this.ctx.restore();
    }
  }

  drawGoal() {
    const goal = this.currentStage.goal;
    const time = performance.now() * 0.003;

    this.ctx.save();
    this.ctx.translate(goal.x, goal.y);

    this.ctx.shadowColor = '#10b981';
    this.ctx.shadowBlur = 18;

    this.ctx.strokeStyle = '#34d399';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, goal.r, time, time + Math.PI * 1.6);
    this.ctx.stroke();

    this.ctx.strokeStyle = '#6ee7b7';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, goal.r * 0.7, -time * 1.5, -time * 1.5 + Math.PI * 1.4);
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, goal.r * 0.45, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 13px Outfit, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('GOAL', 0, 0);

    this.ctx.restore();
  }

  drawSwitch() {
    const swList = [];
    if (this.currentStage.switchTarget) swList.push(this.currentStage.switchTarget);
    if (this.currentStage.switches) swList.push(...this.currentStage.switches);

    for (const sw of swList) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);

      const label = sw.label || '스위치';

      if (sw.active) {
        this.ctx.fillStyle = '#10b981';
        this.ctx.shadowColor = '#10b981';
        this.ctx.shadowBlur = 14;
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 11px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label + ' ON', sw.x, sw.y);
      } else {
        this.ctx.fillStyle = '#e11d48';
        this.ctx.shadowColor = '#e11d48';
        this.ctx.shadowBlur = 12;
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 11px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, sw.x, sw.y);
      }
      this.ctx.restore();
    }
  }

  drawBallTrail() {
    if (this.ball.trail.length < 2) return;
    this.ctx.save();
    for (let i = 0; i < this.ball.trail.length; i++) {
      const pt = this.ball.trail[i];
      this.ctx.fillStyle = this.currentMaterial.color;
      this.ctx.globalAlpha = pt.alpha * 0.4;
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, (this.ball.radius * (i + 1)) / this.ball.trail.length, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawSpringLauncher() {
    const anchorX = this.launcher.anchorX;
    const anchorY = this.launcher.anchorY;

    this.ctx.save();
    this.ctx.fillStyle = '#334155';
    this.ctx.strokeStyle = '#64748b';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(anchorX, anchorY, 13, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    if (this.ball.state === 'READY' || this.ball.state === 'AIMING') {
      const targetX = this.ball.x;
      const targetY = this.ball.y;

      const dx = targetX - anchorX;
      const dy = targetY - anchorY;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      const coils = this.currentMaterial.springCoils;
      const coilWidth = 13;

      this.ctx.save();
      this.ctx.translate(anchorX, anchorY);
      this.ctx.rotate(angle);

      this.ctx.strokeStyle = this.currentMaterial.color;
      this.ctx.lineWidth = this.currentMaterial.springWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowColor = this.currentMaterial.glow;
      this.ctx.shadowBlur = 10;

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);

      const step = dist / (coils * 2);
      for (let i = 1; i <= coils * 2; i++) {
        const cx = i * step;
        const cy = i % 2 === 1 ? coilWidth : -coilWidth;
        this.ctx.lineTo(cx, cy);
      }
      this.ctx.lineTo(dist, 0);
      this.ctx.stroke();
      this.ctx.restore();

      // 조준 중일 때: 완전한 일직선 탄도 궤적 및 탄성력 벡터
      if (this.ball.state === 'AIMING' && this.launcher.pullDist > 14) {
        this.drawAimGuide(anchorX, anchorY, dx, dy);
      }
    }
    this.ctx.restore();
  }

  drawAimGuide(anchorX, anchorY, dx, dy) {
    this.ctx.save();
    const revAngle = Math.atan2(-dy, -dx);
    const arrowLen = Math.min(170, this.launcher.pullDist * 1.2);
    const arrowEndX = anchorX + Math.cos(revAngle) * arrowLen;
    const arrowEndY = anchorY + Math.sin(revAngle) * arrowLen;

    // 1. 탄성 복원력 벡터 화살표
    this.ctx.strokeStyle = '#ef4444';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(anchorX, anchorY);
    this.ctx.lineTo(arrowEndX, arrowEndY);
    this.ctx.stroke();

    const headLen = 13;
    this.ctx.fillStyle = '#ef4444';
    this.ctx.beginPath();
    this.ctx.moveTo(arrowEndX, arrowEndY);
    this.ctx.lineTo(
      arrowEndX - headLen * Math.cos(revAngle - Math.PI / 6),
      arrowEndY - headLen * Math.sin(revAngle - Math.PI / 6)
    );
    this.ctx.lineTo(
      arrowEndX - headLen * Math.cos(revAngle + Math.PI / 6),
      arrowEndY - headLen * Math.sin(revAngle + Math.PI / 6)
    );
    this.ctx.fill();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 14px Outfit, sans-serif';
    this.ctx.fillText(
      `F: ${this.launcher.calculatedForce}N`,
      arrowEndX + 10,
      arrowEndY - 8
    );

    // 2. 완전한 일직선 조준 점선 가이드 (중력 없음!)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.setLineDash([8, 8]);
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.moveTo(anchorX, anchorY);
    const guideLen = 420;
    this.ctx.lineTo(
      anchorX + Math.cos(revAngle) * guideLen,
      anchorY + Math.sin(revAngle) * guideLen
    );
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  drawBall() {
    this.ctx.save();
    this.ctx.translate(this.ball.x, this.ball.y);
    this.ctx.scale(this.ball.scaleX, this.ball.scaleY);

    const grad = this.ctx.createRadialGradient(-4, -5, 2, 0, 0, this.ball.radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, this.currentMaterial.color);
    grad.addColorStop(1, '#0f172a');

    this.ctx.fillStyle = grad;
    this.ctx.shadowColor = this.currentMaterial.glow;
    this.ctx.shadowBlur = 14;

    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  loop(timestamp) {
    const dt = Math.min(100, Math.max(0, timestamp - this.lastTime));
    this.lastTime = timestamp;

    this.accumulator += dt;
    while (this.accumulator >= PHYSICS.fixedStepMs) {
      this.updatePhysics(PHYSICS.fixedStepMs);
      this.accumulator -= PHYSICS.fixedStepMs;
    }
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.elasticGame = new ElasticGame();
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAGES, MATERIALS, PHYSICS };
}
