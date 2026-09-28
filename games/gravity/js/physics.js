// 물리 시뮬레이션 및 중력 연산 모듈
class PhysicsEngine {
    constructor() {
        // 화면 픽셀 좌표 스케일(1100x650)에 맞춘 중력 상수
        this.G = 220000;
        // 0으로 나누기 방지 및 행성 내부 근접 발산 방지 소프트닝
        this.softeningSq = 450;
    }

    // 특정 위치에서의 총 중력 가속도 벡터 [ax, ay] 및 개별 힘 목록 계산
    calculateGravity(pos, planets) {
        let ax = 0;
        let ay = 0;
        const forces = [];

        for (const p of planets) {
            const dx = p.x - pos.x;
            const dy = p.y - pos.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            if (dist < 0.001) continue;

            // F = G * M / (r^2 + softening)
            // 가속도 a = F / m (공의 질량을 1로 가정)
            const effectiveDistSq = distSq + this.softeningSq;
            const aMagnitude = (this.G * p.mass) / effectiveDistSq;

            // 단위 벡터에 가속도 크기 곱하기
            const fax = (dx / dist) * aMagnitude;
            const fay = (dy / dist) * aMagnitude;

            ax += fax;
            ay += fay;

            forces.push({
                planet: p,
                fx: fax,
                fy: fay,
                magnitude: aMagnitude,
                distance: dist
            });
        }

        return { ax, ay, forces };
    }

    // 한 스텝(dt) 동안 공의 물리 상태 업데이트 (Verlet / Euler-Cromer)
    step(ball, planets, obstacles, target, dt = 0.016) {
        if (!ball.active) return { state: 'inactive' };

        // 1. 현재 위치에서 중력 가속도 계산
        const { ax, ay, forces } = this.calculateGravity(ball, planets);

        // 2. 속도 업데이트
        ball.vx += ax * dt;
        ball.vy += ay * dt;

        // 3. 미세한 우주 저항 (옵션: 거의 0에 가까움, 안정성 유지)
        ball.vx *= 0.9998;
        ball.vy *= 0.9998;

        // 4. 위치 업데이트
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // 5. 공의 현재 속력
        const speed = Math.hypot(ball.vx, ball.vy);

        // 6. 행성 충돌 검사
        for (const p of planets) {
            const dist = Math.hypot(p.x - ball.x, p.y - ball.y);
            if (dist <= p.radius + ball.radius) {
                return {
                    state: 'crashed',
                    planet: p,
                    forces,
                    speed
                };
            }
        }

        // 7. 장애물(소행성/벽) 충돌 검사
        if (obstacles && obstacles.length > 0) {
            for (const obs of obstacles) {
                if (obs.type === 'circle') {
                    const dist = Math.hypot(obs.x - ball.x, obs.y - ball.y);
                    if (dist <= obs.radius + ball.radius) {
                        return { state: 'crashed', obstacle: obs, forces, speed };
                    }
                } else if (obs.type === 'rect') {
                    if (ball.x + ball.radius >= obs.x &&
                        ball.x - ball.radius <= obs.x + obs.w &&
                        ball.y + ball.radius >= obs.y &&
                        ball.y - ball.radius <= obs.y + obs.h) {
                        return { state: 'crashed', obstacle: obs, forces, speed };
                    }
                }
            }
        }

        // 8. 목표 지점(홀/우주정거장) 통과 검사 (단순 통과 시 바로 골인!)
        if (target) {
            const distToTarget = Math.hypot(target.x - ball.x, target.y - ball.y);
            if (distToTarget <= target.radius) {
                return {
                    state: 'goal',
                    speed,
                    forces
                };
            }
        }

        // 9. 화면 밖 너무 멀리 이탈 검사
        const margin = 350;
        if (ball.x < -margin || ball.x > 1200 + margin || ball.y < -margin || ball.y > 800 + margin) {
            return { state: 'out_of_bounds', forces, speed };
        }

        return {
            state: 'flying',
            forces,
            speed
        };
    }

    // 발사 전 궤적 예측선 계산 (Forward Simulation)
    predictTrajectory(startPos, initialVel, planets, obstacles, target, maxSteps = 220, dt = 0.016) {
        const points = [];
        const simBall = {
            x: startPos.x,
            y: startPos.y,
            vx: initialVel.vx,
            vy: initialVel.vy,
            radius: 5,
            active: true
        };

        // 공전 행성들의 위치를 예측하기 위한 가상 복제
        const simPlanets = planets.map(p => ({
            ...p,
            angle: p.angle || 0
        }));

        let endReason = 'max_steps';

        for (let step = 0; step < maxSteps; step++) {
            points.push({ x: simBall.x, y: simBall.y });

            // 공전 행성 위치 전진
            for (const sp of simPlanets) {
                if (sp.orbitRadius && sp.orbitSpeed) {
                    sp.angle += sp.orbitSpeed * dt;
                    sp.x = sp.orbitCenterX + Math.cos(sp.angle) * sp.orbitRadius;
                    sp.y = sp.orbitCenterY + Math.sin(sp.angle) * sp.orbitRadius;
                }
            }

            const { ax, ay } = this.calculateGravity(simBall, simPlanets);
            simBall.vx += ax * dt;
            simBall.vy += ay * dt;
            simBall.x += simBall.vx * dt;
            simBall.y += simBall.vy * dt;

            // 충돌 체크
            let collided = false;
            for (const sp of simPlanets) {
                const dist = Math.hypot(sp.x - simBall.x, sp.y - simBall.y);
                if (dist <= sp.radius + simBall.radius) {
                    endReason = 'crash';
                    collided = true;
                    break;
                }
            }
            if (collided) break;

            // 장애물 체크
            if (obstacles) {
                for (const obs of obstacles) {
                    if (obs.type === 'circle') {
                        if (Math.hypot(obs.x - simBall.x, obs.y - simBall.y) <= obs.radius + simBall.radius) {
                            endReason = 'crash';
                            collided = true;
                            break;
                        }
                    } else if (obs.type === 'rect') {
                        if (simBall.x >= obs.x && simBall.x <= obs.x + obs.w &&
                            simBall.y >= obs.y && simBall.y <= obs.y + obs.h) {
                            endReason = 'crash';
                            collided = true;
                            break;
                        }
                    }
                }
            }
            if (collided) break;

            // 타겟 체크 (단순 통과 시 골인)
            if (target) {
                const distToTarget = Math.hypot(target.x - simBall.x, target.y - simBall.y);
                if (distToTarget <= target.radius) {
                    endReason = 'goal';
                    break;
                }
            }

            // 너무 멀어짐
            if (simBall.x < -200 || simBall.x > 1400 || simBall.y < -200 || simBall.y > 1000) {
                endReason = 'out';
                break;
            }
        }

        return { points, endReason };
    }
}

window.PhysicsEngine = PhysicsEngine;
