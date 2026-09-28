// 게임 캔버스 렌더러, 물리 루프, 조작 및 상태 관리 모듈
class GravityGolfGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.physics = new window.PhysicsEngine();
        this.currentLevelIndex = 0;
        this.currentLevel = window.GAME_LEVELS[0];

        // 게임 상태: 'aiming', 'flying', 'goal', 'crashed'
        this.state = 'aiming';
        this.strokes = 0;

        // 공 상태
        this.ball = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: 8,
            active: false
        };

        // 조준 상태
        this.aimAngle = 0; // 라디안
        this.aimPower = 60; // 10 ~ 100
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragCurrent = { x: 0, y: 0 };

        // 공의 과거 이동 경로 (스타 트레일 및 이전 시도 잔상)
        this.trail = [];
        this.lastTrail = [];
        this.maxTrail = 200;

        // 시각 효과 파티클
        this.particles = [];

        // 옵션 설정
        this.options = {
            showPrediction: true,
            showVectors: true,
            showGravityField: true,
            slowMotion: false
        };
        // 일정한 스케일 유지 및 왜곡 방지용 논리 게임 좌표계 규격 (1100 x 650)
        this.WORLD_WIDTH = 1100;
        this.WORLD_HEIGHT = 650;
        this.renderScale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.dpr = window.devicePixelRatio || 1;

        // 배경 별들 생성
        this.stars = [];

        // 캔버스 크기 및 스케일 초기화 (HiDPI 및 윈도우 리사이즈 대응)
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resizeCanvas(), 80));

        // 스테이지 완료 별점 저장 (로컬스토리지)
        this.savedStars = JSON.parse(localStorage.getItem('gravity_golf_stars') || '{}');

        // 초기화
        this.initEventListeners();
        this.loadLevel(0);
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    // 캔버스 리사이즈 및 가로세로 비율(Aspect Ratio) 100% 일정 유지
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.dpr = dpr;

        const targetW = Math.floor(rect.width * dpr);
        const targetH = Math.floor(rect.height * dpr);

        if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
            this.canvas.width = targetW;
            this.canvas.height = targetH;
            this.generateStars(160);
        }

        // 가로/세로 비율 중 작은 쪽에 맞춰 왜곡 없이 1:1 정비율 스케일 계산
        const scale = Math.min(rect.width / this.WORLD_WIDTH, rect.height / this.WORLD_HEIGHT);
        this.renderScale = scale;
        // 캔버스 중앙 정렬 오프셋
        this.offsetX = (rect.width - this.WORLD_WIDTH * scale) / 2;
        this.offsetY = (rect.height - this.WORLD_HEIGHT * scale) / 2;
    }

    // 배경 별들 생성
    generateStars(count) {
        this.stars = [];
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: Math.random() * 1.6 + 0.5,
                alpha: Math.random() * 0.8 + 0.2,
                twinkleSpeed: Math.random() * 0.03 + 0.01,
                color: ['#ffffff', '#bae6fd', '#fef08a', '#e9d5ff'][Math.floor(Math.random() * 4)]
            });
        }
    }

    // 레벨 로드
    loadLevel(index) {
        if (index < 0 || index >= window.GAME_LEVELS.length) return;
        this.currentLevelIndex = index;
        this.currentLevel = JSON.parse(JSON.stringify(window.GAME_LEVELS[index])); // 딥카피

        this.resetBall();
        this.strokes = 0;
        this.particles = [];
        this.updateUI();
    }

    // 공 초기 위치로 리셋
    resetBall() {
        this.state = 'aiming';
        this.ball.x = this.currentLevel.startPos.x;
        this.ball.y = this.currentLevel.startPos.y;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.active = false;
        if (this.trail.length > 5) {
            this.lastTrail = this.trail.slice();
        }
        this.trail = [];

        // 목표 지점을 향한 기본 각도 계산
        const dx = this.currentLevel.target.x - this.ball.x;
        const dy = this.currentLevel.target.y - this.ball.y;
        this.aimAngle = Math.atan2(dy, dx);
        this.syncControlsFromAim();

        window.soundManager.updateGravityHum(0);
    }

    // 발사 실행
    launchBall() {
        if (this.state !== 'aiming') return;

        // 각도와 세기를 기반으로 초기 속도 산출 (파워 10~100 -> 속도 150~650 px/s)
        const speed = 120 + (this.aimPower / 100) * 480;
        this.ball.vx = Math.cos(this.aimAngle) * speed;
        this.ball.vy = Math.sin(this.aimAngle) * speed;
        this.ball.active = true;
        this.state = 'flying';
        this.strokes++;

        this.updateUI();
        window.soundManager.playLaunch(this.aimPower / 100);
    }

    // 이벤트 리스너 등록
    initEventListeners() {
        // 드래그 조준 (캔버스 마우스/터치 지원 - 왜곡 없는 정밀 좌표 역변환)
        const getCanvasPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const t = (e.touches && e.touches.length > 0) ? e.touches[0] : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0] : e);
            const clientX = t.clientX - rect.left;
            const clientY = t.clientY - rect.top;
            return {
                x: (clientX - this.offsetX) / this.renderScale,
                y: (clientY - this.offsetY) / this.renderScale
            };
        };

        const handleStart = (e) => {
            if (this.state !== 'aiming') return;
            if (e.cancelable) e.preventDefault();
            window.soundManager.init(); // iOS/태블릿 오디오 컨텍스트 언락

            const pos = getCanvasPos(e);
            this.isDragging = true;
            this.dragStart = pos;
            this.dragCurrent = pos;
        };

        const handleMove = (e) => {
            if (!this.isDragging || this.state !== 'aiming') return;
            if (e.cancelable) e.preventDefault();
            this.dragCurrent = getCanvasPos(e);

            // 슬링샷 방식: 드래그 시작점에서 현재 위치까지의 반대 벡터로 조준
            const dx = this.dragStart.x - this.dragCurrent.x;
            const dy = this.dragStart.y - this.dragCurrent.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 6) {
                this.aimAngle = Math.atan2(dy, dx);
                // 태블릿 터치 민감도 최적화: 가벼운 당김으로도 충분한 파워 조절 가능
                this.aimPower = Math.min(100, Math.max(15, Math.round(dist * 0.7)));
                this.syncControlsFromAim();
            }
        };

        const handleEnd = (e) => {
            if (!this.isDragging) return;
            if (e.cancelable) e.preventDefault();
            this.isDragging = false;

            if (e.changedTouches && e.changedTouches.length > 0) {
                this.dragCurrent = getCanvasPos(e);
            }

            const dist = Math.hypot(this.dragStart.x - this.dragCurrent.x, this.dragStart.y - this.dragCurrent.y);
            // 터치 실수 방지용 최소 드래그 거리(20px) 확인 후 발사
            if (dist > 20 && this.state === 'aiming') {
                this.launchBall();
            }
        };

        this.canvas.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);

        this.canvas.addEventListener('touchstart', handleStart, { passive: false });
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd, { passive: false });
        window.addEventListener('touchcancel', handleEnd, { passive: false });

        // 슬라이더 및 입력창 연동
        const angleSlider = document.getElementById('angleSlider');
        const angleNum = document.getElementById('angleNum');
        const powerSlider = document.getElementById('powerSlider');
        const powerNum = document.getElementById('powerNum');

        if (angleSlider) {
            angleSlider.addEventListener('input', (e) => {
                const deg = parseFloat(e.target.value);
                this.aimAngle = (deg * Math.PI) / 180;
                if (angleNum) angleNum.textContent = deg.toFixed(1) + '°';
            });
        }

        if (powerSlider) {
            powerSlider.addEventListener('input', (e) => {
                this.aimPower = parseInt(e.target.value);
                if (powerNum) powerNum.textContent = this.aimPower + '%';
            });
        }

        // 각도 미세조정 버튼
        const stepAngle = (delta) => {
            let deg = (this.aimAngle * 180) / Math.PI + delta;
            if (deg > 180) deg -= 360;
            if (deg < -180) deg += 360;
            this.aimAngle = (deg * Math.PI) / 180;
            this.syncControlsFromAim();
        };

        document.getElementById('btnAngleMinus')?.addEventListener('click', () => stepAngle(-1));
        document.getElementById('btnAnglePlus')?.addEventListener('click', () => stepAngle(1));
        document.getElementById('btnAngleMinus5')?.addEventListener('click', () => stepAngle(-5));
        document.getElementById('btnAnglePlus5')?.addEventListener('click', () => stepAngle(5));

        // 발사 버튼
        document.getElementById('btnFire')?.addEventListener('click', () => {
            if (this.state === 'aiming') this.launchBall();
        });

        // 재시도 버튼
        document.getElementById('btnReset')?.addEventListener('click', () => {
            window.soundManager.playClick();
            this.resetBall();
        });

        // 키보드 조작 (스페이스바: 발사, R: 리셋, 좌우 방향키: 각도 조절)
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.state === 'aiming') this.launchBall();
            } else if (e.code === 'KeyR') {
                e.preventDefault();
                this.resetBall();
            } else if (e.code === 'ArrowLeft') {
                stepAngle(-1);
            } else if (e.code === 'ArrowRight') {
                stepAngle(1);
            } else if (e.code === 'ArrowUp') {
                this.aimPower = Math.min(100, this.aimPower + 2);
                this.syncControlsFromAim();
            } else if (e.code === 'ArrowDown') {
                this.aimPower = Math.max(15, this.aimPower - 2);
                this.syncControlsFromAim();
            }
        });

        // 토글 옵션들
        document.getElementById('togglePrediction')?.addEventListener('change', (e) => {
            this.options.showPrediction = e.target.checked;
        });
        document.getElementById('toggleVectors')?.addEventListener('change', (e) => {
            this.options.showVectors = e.target.checked;
        });
        document.getElementById('toggleField')?.addEventListener('change', (e) => {
            this.options.showGravityField = e.target.checked;
        });
        document.getElementById('toggleSlow')?.addEventListener('change', (e) => {
            this.options.slowMotion = e.target.checked;
        });

        // 사운드 토글
        const btnMute = document.getElementById('btnMute');
        btnMute?.addEventListener('click', () => {
            const isMuted = window.soundManager.toggleMute();
            btnMute.textContent = isMuted ? '🔇 음소거' : '🔊 사운드';
            btnMute.classList.toggle('active', !isMuted);
        });

        // 스테이지 선택 모달
        document.getElementById('btnStageSelect')?.addEventListener('click', () => {
            window.soundManager.playClick();
            this.openStageModal();
        });
        document.getElementById('btnCloseStageModal')?.addEventListener('click', () => {
            document.getElementById('stageModal').classList.add('hidden');
        });

        // 다음 단계 버튼
        document.getElementById('btnNextStage')?.addEventListener('click', () => {
            document.getElementById('clearModal').classList.add('hidden');
            if (this.currentLevelIndex + 1 < window.GAME_LEVELS.length) {
                this.loadLevel(this.currentLevelIndex + 1);
            } else {
                this.openStageModal();
            }
        });

        // 클리어 모달 다시하기 버튼
        document.getElementById('btnRetryStage')?.addEventListener('click', () => {
            document.getElementById('clearModal').classList.add('hidden');
            this.resetBall();
            this.strokes = 0;
            this.updateUI();
        });
    }

    // 조준 각도/파워를 슬라이더 UI에 반영
    syncControlsFromAim() {
        let deg = Math.round((this.aimAngle * 180) / Math.PI);
        const angleSlider = document.getElementById('angleSlider');
        const angleNum = document.getElementById('angleNum');
        const powerSlider = document.getElementById('powerSlider');
        const powerNum = document.getElementById('powerNum');

        if (angleSlider) angleSlider.value = deg;
        if (angleNum) angleNum.textContent = deg + '°';
        if (powerSlider) powerSlider.value = this.aimPower;
        if (powerNum) powerNum.textContent = this.aimPower + '%';
    }

    // 상단 및 안내 UI 갱신
    updateUI() {
        const lvl = this.currentLevel;
        document.getElementById('currentStageText').textContent = lvl.title;
        document.getElementById('stageSubtitle').textContent = lvl.subtitle;
        document.getElementById('scienceConcept').textContent = lvl.concept;
        document.getElementById('stageDescription').textContent = lvl.description;
        document.getElementById('stageTip').textContent = lvl.tip;
        document.getElementById('parCount').textContent = lvl.par;
        document.getElementById('strokeCount').textContent = this.strokes;

        // 이전 최고 기록 별점 표시
        const saved = this.savedStars[lvl.id] || 0;
        let starsStr = '';
        for (let i = 1; i <= 3; i++) {
            starsStr += i <= saved ? '★' : '☆';
        }
        document.getElementById('bestStars').textContent = starsStr;

        // 발사 상태에 따른 버튼 텍스트/스타일
        const btnFire = document.getElementById('btnFire');
        if (btnFire) {
            btnFire.disabled = (this.state !== 'aiming');
            btnFire.textContent = this.state === 'aiming' ? '🚀 발사 (SPACE)' : '비행 중...';
        }
    }

    // 메인 게임 루프
    gameLoop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // 프레임 드롭 시 비정상 점프 방지 (최대 0.05초로 캡)
        if (dt > 0.05) dt = 0.05;
        if (this.options.slowMotion) dt *= 0.35;

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    // 물리 및 상태 업데이트
    update(dt) {
        const lvl = this.currentLevel;

        // 1. 공전 행성 위치 업데이트
        for (const p of lvl.planets) {
            if (p.orbitRadius && p.orbitSpeed) {
                p.angle = (p.angle || 0) + p.orbitSpeed * dt;
                p.x = p.orbitCenterX + Math.cos(p.angle) * p.orbitRadius;
                p.y = p.orbitCenterY + Math.sin(p.angle) * p.orbitRadius;
            }
        }

        // 2. 공의 물리 시뮬레이션
        if (this.state === 'flying' && this.ball.active) {
            // 물리 서브스텝핑으로 고속 터널링 방지
            const subSteps = 4;
            const subDt = dt / subSteps;
            let result = null;

            for (let s = 0; s < subSteps; s++) {
                result = this.physics.step(this.ball, lvl.planets, lvl.obstacles, lvl.target, subDt);

                if (result.state !== 'flying') break;
            }

            // 트레일 기록 (일정 간격마다)
            this.trail.push({ x: this.ball.x, y: this.ball.y, alpha: 1.0 });
            if (this.trail.length > this.maxTrail) {
                this.trail.shift();
            }

            // 중력 험 사운드 업데이트
            if (result.forces && result.forces.length > 0) {
                let maxMag = 0;
                for (const f of result.forces) {
                    if (f.magnitude > maxMag) maxMag = f.magnitude;
                }
                window.soundManager.updateGravityHum(Math.min(maxMag / 600, 1));
            }

            // 결과 상태 처리
            if (result.state === 'crashed') {
                this.onCrash(this.ball.x, this.ball.y);
            } else if (result.state === 'out_of_bounds') {
                this.onOutOfBounds();
            } else if (result.state === 'goal') {
                this.onGoal();
            } else if (result.state === 'too_fast') {
                // 속도가 너무 빨라 스쳐 지나감 (알림 파티클)
                this.spawnParticles(this.ball.x, this.ball.y, '#f59e0b', 5);
            }
        }

        // 3. 파티클 업데이트
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha -= p.decay * dt;
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // 충돌 처리
    onCrash(x, y) {
        this.state = 'crashed';
        this.ball.active = false;
        window.soundManager.playCrash();
        window.soundManager.updateGravityHum(0);

        this.spawnParticles(x, y, '#ef4444', 35);
        this.spawnParticles(x, y, '#f97316', 25);

        // 1초 후 재시도 가능하게 리셋
        setTimeout(() => {
            if (this.state === 'crashed') {
                this.resetBall();
                this.updateUI();
            }
        }, 1100);
    }

    // 우주 이탈 처리
    onOutOfBounds() {
        this.state = 'crashed';
        this.ball.active = false;
        window.soundManager.updateGravityHum(0);

        // 즉시 리셋
        setTimeout(() => {
            this.resetBall();
            this.updateUI();
        }, 600);
    }

    // 홀인 / 목표 도달 처리
    onGoal() {
        this.state = 'goal';
        this.ball.active = false;
        window.soundManager.playGoal();
        window.soundManager.updateGravityHum(0);

        // 골인 축하 폭죽 파티클
        const target = this.currentLevel.target;
        for (let i = 0; i < 70; i++) {
            this.spawnParticles(target.x, target.y, ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24'][Math.floor(Math.random() * 5)], 1);
        }

        // 별점 계산 (타수 vs PAR)
        const par = this.currentLevel.par;
        let stars = 1;
        if (this.strokes <= par) {
            stars = 3; // 홀인원 또는 파 이하
        } else if (this.strokes <= par + 1) {
            stars = 2;
        }

        // 최고 기록 갱신
        const oldStars = this.savedStars[this.currentLevel.id] || 0;
        if (stars > oldStars) {
            this.savedStars[this.currentLevel.id] = stars;
            localStorage.setItem('gravity_golf_stars', JSON.stringify(this.savedStars));
        }

        // 0.8초 후 클리어 모달 표시
        setTimeout(() => {
            this.openClearModal(stars);
        }, 800);
    }

    // 클리어 모달 표시
    openClearModal(stars) {
        const modal = document.getElementById('clearModal');
        document.getElementById('clearStageName').textContent = this.currentLevel.title;
        document.getElementById('clearStrokes').textContent = `${this.strokes}타 (기준 PAR: ${this.currentLevel.par})`;

        let starsText = '';
        for (let i = 1; i <= 3; i++) {
            starsText += i <= stars ? '★' : '☆';
        }
        document.getElementById('clearStars').textContent = starsText;

        const conceptReview = document.getElementById('clearConceptReview');
        conceptReview.textContent = `핵심 과학 원리: ${this.currentLevel.concept} - ${this.currentLevel.subtitle}`;

        modal.classList.remove('hidden');
    }

    // 스테이지 선택 모달
    openStageModal() {
        const grid = document.getElementById('stageListGrid');
        grid.innerHTML = '';

        window.GAME_LEVELS.forEach((lvl, idx) => {
            const card = document.createElement('div');
            card.className = 'stage-card' + (idx === this.currentLevelIndex ? ' active' : '');

            const stars = this.savedStars[lvl.id] || 0;
            let starsStr = '';
            for (let i = 1; i <= 3; i++) {
                starsStr += i <= stars ? '★' : '☆';
            }

            card.innerHTML = `
                <div class="card-num">STAGE ${lvl.id}</div>
                <div class="card-title">${lvl.title.replace(`Stage ${lvl.id}: `, '')}</div>
                <div class="card-concept">${lvl.concept}</div>
                <div class="card-stars">${starsStr}</div>
            `;

            card.addEventListener('click', () => {
                window.soundManager.playClick();
                document.getElementById('stageModal').classList.add('hidden');
                this.loadLevel(idx);
            });

            grid.appendChild(card);
        });

        document.getElementById('stageModal').classList.remove('hidden');
    }

    // 파티클 생성 함수
    spawnParticles(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 180 + 40;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                radius: Math.random() * 3 + 1.5,
                alpha: 1.0,
                decay: Math.random() * 1.5 + 0.8
            });
        }
    }

    // 전체 렌더링 (가로세로 비율 100% 일정 유지 및 HiDPI 선명도 보장)
    render() {
        const ctx = this.ctx;
        const dpr = this.dpr;
        const scale = this.renderScale;
        const offX = this.offsetX;
        const offY = this.offsetY;
        const lvl = this.currentLevel;

        // 1. 전체 디스플레이 픽셀 단위로 깊은 우주 배경 그리기
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#060913';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 은하수 그라데이션 (화면 전체)
        const nebGrad = ctx.createRadialGradient(
            this.canvas.width * 0.5, this.canvas.height * 0.5, 40 * dpr,
            this.canvas.width * 0.5, this.canvas.height * 0.5, 550 * dpr
        );
        nebGrad.addColorStop(0, 'rgba(30, 27, 75, 0.45)');
        nebGrad.addColorStop(0.6, 'rgba(15, 23, 42, 0.3)');
        nebGrad.addColorStop(1, 'rgba(6, 9, 19, 0)');
        ctx.fillStyle = nebGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 반짝이는 별들 (전체 화면)
        for (const s of this.stars) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius * dpr, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.globalAlpha = s.alpha + Math.sin(performance.now() * 0.003 * s.twinkleSpeed) * 0.2;
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.restore();

        // 2. 가로세로 비율이 100% 일정한 1100x650 논리 게임 공간 변환
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(offX, offY);
        ctx.scale(scale, scale);

        // 2. 공전 궤도 가이드선 (공전 행성이 있는 경우)
        for (const p of lvl.planets) {
            if (p.orbitRadius) {
                ctx.beginPath();
                ctx.arc(p.orbitCenterX, p.orbitCenterY, p.orbitRadius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
                ctx.setLineDash([4, 6]);
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // 3. 중력장 시각화 (등고선 링)
        if (this.options.showGravityField) {
            this.renderGravityField();
        }

        // 4. 장애물 (소행성/벽) 렌더링
        if (lvl.obstacles) {
            for (const obs of lvl.obstacles) {
                ctx.save();
                if (obs.type === 'rect') {
                    // 메탈릭 해저드 스트라이프 벽
                    ctx.fillStyle = obs.color || '#475569';
                    ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

                    // 빗금 장식
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
                    ctx.lineWidth = 3;
                    for (let ly = obs.y; ly < obs.y + obs.h; ly += 24) {
                        ctx.beginPath();
                        ctx.moveTo(obs.x, ly);
                        ctx.lineTo(obs.x + obs.w, ly + 14);
                        ctx.stroke();
                    }
                } else if (obs.type === 'circle') {
                    ctx.beginPath();
                    ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
                    ctx.fillStyle = obs.color || '#64748b';
                    ctx.fill();
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                ctx.restore();
            }
        }

        // 5. 목표 지점 (골프 홀 / 우주 기지) 렌더링
        this.renderTarget(lvl.target);

        // 6. 행성 렌더링
        for (const p of lvl.planets) {
            this.renderPlanet(p);
        }

        // 7. 발사 전 궤적 예측선 렌더링
        if (this.state === 'aiming' && this.options.showPrediction) {
            this.renderTrajectoryPreview();
        }

        // 8. 이전 시도 잔상 궤적 (과학 비교용)
        if (this.state === 'aiming' && this.lastTrail.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.lastTrail[0].x, this.lastTrail[0].y);
            for (let i = 1; i < this.lastTrail.length; i++) {
                ctx.lineTo(this.lastTrail[i].x, this.lastTrail[i].y);
            }
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([3, 5]);
            ctx.stroke();
            ctx.restore();
        }

        // 공의 실시간 비행 궤적 (스타 트레일)
        if (this.trail.length > 1) {
            for (let i = 0; i < this.trail.length - 1; i++) {
                const p1 = this.trail[i];
                const p2 = this.trail[i + 1];
                const ratio = i / this.trail.length;

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0.2, ratio * 0.85)})`;
                ctx.lineWidth = 1.5 + ratio * 4;
                ctx.stroke();
            }
        }

        // 9. 골프공 (우주 캡슐) 렌더링
        if (this.state !== 'goal') {
            this.renderBall();
        }

        // 10. 중력 벡터 화살표 렌더링 (옵션)
        if (this.options.showVectors && (this.state === 'flying' || this.state === 'aiming')) {
            this.renderGravityVectors();
        }

        // 11. 드래그 슬링샷 조준선 렌더링
        if (this.isDragging && this.state === 'aiming') {
            this.renderSlingshotAim();
        }

        // 12. 파티클 렌더링
        for (const p of this.particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // 월드 변환 복원
        ctx.restore();
    }

    // 중력장 등고선 링 렌더링
    renderGravityField() {
        const ctx = this.ctx;
        const planets = this.currentLevel.planets;

        for (const p of planets) {
            const isRepulsor = p.mass < 0;
            const rings = 4;
            const baseColor = isRepulsor ? '16, 185, 129' : '59, 130, 246';

            for (let r = 1; r <= rings; r++) {
                const ringRadius = p.radius + r * 38;
                ctx.beginPath();
                ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${baseColor}, ${0.12 - r * 0.025})`;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    // 행성 렌더링
    renderPlanet(p) {
        const ctx = this.ctx;
        const isRepulsor = p.mass < 0;

        ctx.save();

        // 1. 대기 글로우 (Atmosphere Glow)
        const glowRadius = p.radius * 1.8;
        const glowGrad = ctx.createRadialGradient(p.x, p.y, p.radius * 0.8, p.x, p.y, glowRadius);
        glowGrad.addColorStop(0, p.atmosphere || 'rgba(59, 130, 246, 0.3)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. 행성 구체 3D 셰이딩
        const lightX = p.x - p.radius * 0.35;
        const lightY = p.y - p.radius * 0.35;
        const sphereGrad = ctx.createRadialGradient(lightX, lightY, p.radius * 0.1, p.x, p.y, p.radius);
        sphereGrad.addColorStop(0, '#ffffff');
        sphereGrad.addColorStop(0.3, p.color);
        sphereGrad.addColorStop(1, '#020617');

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.fill();

        // 행성 외곽선 테두리
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 반중력 펄서의 경우 펄스 링 애니메이션
        if (isRepulsor) {
            const pulse = (performance.now() * 0.002) % 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + pulse * 28, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(16, 185, 129, ${1 - pulse})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // 행성 텍스트 라벨 (질량 및 이름)
        ctx.font = 'bold 12px "Pretendard", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(p.name, p.x, p.y + p.radius + 18);

        ctx.font = '11px monospace';
        ctx.fillStyle = isRepulsor ? '#34d399' : '#93c5fd';
        const massText = isRepulsor ? `척력: ${Math.abs(p.mass)}` : `질량 M: ${p.mass}`;
        ctx.fillText(massText, p.x, p.y + p.radius + 32);

        ctx.restore();
    }

    // 목표 지점 (우주 기지 / 홀) 렌더링
    renderTarget(target) {
        const ctx = this.ctx;
        const time = performance.now() * 0.002;

        ctx.save();
        // 회전하는 도킹 포털 링
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.fill();

        // 외부 글로우 링
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius + Math.sin(time * 3) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 중앙 안착 코어
        ctx.beginPath();
        ctx.arc(target.x, target.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();

        // 깃발 / 라벨
        ctx.font = 'bold 12px "Pretendard", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`🚩 ${target.name}`, target.x, target.y - target.radius - 10);

        ctx.font = '10px "Pretendard", sans-serif';
        ctx.fillStyle = '#bae6fd';
        ctx.fillText(`🎯 통과 목표`, target.x, target.y + target.radius + 15);

        ctx.restore();
    }

    // 발사 조준 가이드선 렌더링 (전체 정답 경로가 아닌 초기 일정 거리만 살짝 표시)
    renderTrajectoryPreview() {
        const speed = 120 + (this.aimPower / 100) * 480;
        const vel = {
            vx: Math.cos(this.aimAngle) * speed,
            vy: Math.sin(this.aimAngle) * speed
        };

        // 전체가 아닌 초반 25스텝(약 100~120px 거리)만 계산하여 초기 휨 방향만 안내
        const { points } = this.physics.predictTrajectory(
            this.ball,
            vel,
            this.currentLevel.planets,
            this.currentLevel.obstacles,
            this.currentLevel.target,
            25,
            0.016
        );

        if (points.length < 2) return;

        const ctx = this.ctx;
        ctx.save();

        // 끝으로 갈수록 은은하게 사라지는 페이드아웃 빔 효과
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const fade = 1 - (i / points.length);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${fade * 0.85})`;
            ctx.lineWidth = 1.4 + fade * 2.2;
            ctx.stroke();
        }

        ctx.restore();
    }

    // 중력 벡터 화살표 렌더링 (과학 교육용 힘의 합성 시각화)
    renderGravityVectors() {
        const ctx = this.ctx;
        const { ax, ay, forces } = this.physics.calculateGravity(this.ball, this.currentLevel.planets);

        if (!forces || forces.length === 0) return;

        ctx.save();
        const vectorScale = 0.075; // 시각화 화살표 길이 스케일

        // 1. 각 행성이 작용하는 개별 중력 벡터 (노란/보라 점선 화살표)
        for (const f of forces) {
            const p = f.planet;
            const endX = this.ball.x + f.fx * vectorScale;
            const endY = this.ball.y + f.fy * vectorScale;

            ctx.beginPath();
            ctx.moveTo(this.ball.x, this.ball.y);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = p.mass < 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(251, 191, 36, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 화살표 머리
            this.drawArrowHead(ctx, this.ball.x, this.ball.y, endX, endY, p.mass < 0 ? '#34d399' : '#fbbf24', 6);
        }

        // 2. 합력 (알짜힘) 벡터: 합성된 총 중력 가속도 방향 (굵은 밝은 하늘색 화살표)
        const netMagnitude = Math.hypot(ax, ay);
        if (netMagnitude > 8) {
            const netEndX = this.ball.x + ax * vectorScale;
            const netEndY = this.ball.y + ay * vectorScale;

            ctx.beginPath();
            ctx.moveTo(this.ball.x, this.ball.y);
            ctx.lineTo(netEndX, netEndY);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.8;
            ctx.stroke();

            this.drawArrowHead(ctx, this.ball.x, this.ball.y, netEndX, netEndY, '#38bdf8', 8);

            // 알짜힘 텍스트 표시
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(`알짜 중력: ${Math.round(netMagnitude)}`, netEndX + 8, netEndY);
        }

        ctx.restore();
    }

    // 화살표 머리 그리기 보조 함수
    drawArrowHead(ctx, fromX, fromY, toX, toY, color, size = 6) {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    // 드래그 조준 슬링샷 가이드 렌더링
    renderSlingshotAim() {
        const ctx = this.ctx;
        ctx.save();

        // 당긴 반대 방향으로 발사 화살표 표시
        const arrowLen = (this.aimPower / 100) * 85 + 20;
        const targetX = this.ball.x + Math.cos(this.aimAngle) * arrowLen;
        const targetY = this.ball.y + Math.sin(this.aimAngle) * arrowLen;

        // 파워에 따른 색상 그라데이션 (초록 -> 노랑 -> 빨강)
        let arrowColor = '#34d399';
        if (this.aimPower > 70) arrowColor = '#f43f5e';
        else if (this.aimPower > 40) arrowColor = '#fbbf24';

        ctx.beginPath();
        ctx.moveTo(this.ball.x, this.ball.y);
        ctx.lineTo(targetX, targetY);
        ctx.strokeStyle = arrowColor;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        this.drawArrowHead(ctx, this.ball.x, this.ball.y, targetX, targetY, arrowColor, 10);

        // 당긴 줄 (고무줄 효과)
        ctx.beginPath();
        ctx.moveTo(this.ball.x, this.ball.y);
        ctx.lineTo(this.dragCurrent.x, this.dragCurrent.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
    }

    // 골프공 (우주 캡슐) 렌더링
    renderBall() {
        const ctx = this.ctx;
        ctx.save();

        // 외곽 발광
        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, this.ball.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.fill();

        // 캡슐 본체
        const ballGrad = ctx.createRadialGradient(
            this.ball.x - 2, this.ball.y - 2, 1,
            this.ball.x, this.ball.y, this.ball.radius
        );
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.6, '#38bdf8');
        ballGrad.addColorStop(1, '#0284c7');

        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ballGrad;
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new GravityGolfGame();
});
