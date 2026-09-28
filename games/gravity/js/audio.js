// Web Audio API 기반 절차적 사운드 효과 시스템 (외부 오디오 파일 없이 순수 웹 브라우저 합성)
class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.gravityOsc = null;
        this.gravityGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.initialized = true;
        } catch (e) {
            console.warn("AudioContext init failed", e);
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted && this.gravityGain) {
            this.gravityGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        return this.muted;
    }

    // 발사 사운드 (우주선/공 슛)
    playLaunch(powerRatio) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const baseFreq = 200 + powerRatio * 400;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
    }

    // 중력장 근접 험(Hum) 사운드 업데이트
    updateGravityHum(intensity) {
        if (this.muted || !this.initialized || !this.ctx) return;
        if (intensity <= 0.05) {
            if (this.gravityGain) {
                this.gravityGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            }
            return;
        }

        const now = this.ctx.currentTime;
        if (!this.gravityOsc) {
            this.gravityOsc = this.ctx.createOscillator();
            this.gravityGain = this.ctx.createGain();
            this.gravityOsc.type = 'sine';
            this.gravityOsc.frequency.setValueAtTime(80, now);
            this.gravityGain.gain.setValueAtTime(0, now);
            this.gravityOsc.connect(this.gravityGain);
            this.gravityGain.connect(this.ctx.destination);
            this.gravityOsc.start();
        }

        const freq = 60 + Math.min(intensity * 120, 200);
        const gainVal = Math.min(intensity * 0.15, 0.15);
        this.gravityOsc.frequency.setTargetAtTime(freq, now, 0.08);
        this.gravityGain.gain.setTargetAtTime(gainVal, now, 0.08);
    }

    // 행성 충돌 사운드
    playCrash() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + 0.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + 0.4);
    }

    // 홀인 / 목표 도달 팡파레
    playGoal() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const now = this.ctx.currentTime;

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = now + idx * 0.1;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.6);
        });
    }

    // UI 클릭음
    playClick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.06);
    }
}

window.soundManager = new SoundManager();
