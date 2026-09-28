/* eslint-disable no-console */
'use strict';

// 게임과 같은 물리값으로 각 스테이지의 목표/스위치에 도달하는 샘플 샷을
// 탐색하는 개발용 검사기다. 실행: node verify-stages.js
const { STAGES, MATERIALS, PHYSICS } = require('./game.js');

const BALL_RADIUS = 16;
const MATERIAL_LIST = [MATERIALS.titanium, MATERIALS.steel, MATERIALS.rubber];
const PULLS = [140, 120, 95, 70, 45];
const STATIC_WAITS = [0];
const MOVING_WAITS = [0, 30, 60, 90, 120, 180];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function circleOverlapsRect(circle, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  return Math.hypot(circle.x - nearestX, circle.y - nearestY) < radius;
}

function validateStructure(stage) {
  const errors = [];
  const switches = stage.switches || (stage.switchTarget ? [stage.switchTarget] : []);
  const fixedWalls = stage.walls;
  if (stage.balls < switches.length + 1) errors.push('필수 목표 수보다 공이 적음');
  if (fixedWalls.some((wall) => circleOverlapsRect(stage.launcher, BALL_RADIUS, wall))) {
    errors.push('발사대가 고정 벽과 겹침');
  }
  if (fixedWalls.some((wall) => circleOverlapsRect(stage.goal, stage.goal.r, wall))) {
    errors.push('골대가 고정 벽과 겹침');
  }
  switches.forEach((switchTarget, index) => {
    if (fixedWalls.some((wall) => circleOverlapsRect(switchTarget, switchTarget.r, wall))) {
      errors.push(`스위치 ${index + 1}이 고정 벽과 겹침`);
    }
  });
  return errors;
}

function updateMoving(stage) {
  const movingWalls = [];
  if (stage.movingWall) movingWalls.push(stage.movingWall);
  if (stage.movingWalls) movingWalls.push(...stage.movingWalls);

  for (const wall of movingWalls) {
    if (wall.dirY) {
      wall.y += wall.speed * wall.dirY;
      if (wall.y <= wall.minY) { wall.y = wall.minY; wall.dirY = 1; }
      else if (wall.y >= wall.maxY) { wall.y = wall.maxY; wall.dirY = -1; }
    } else if (wall.dir) {
      wall.y += wall.speed * wall.dir;
      if (wall.y <= wall.minY) { wall.y = wall.minY; wall.dir = 1; }
      else if (wall.y >= wall.maxY) { wall.y = wall.maxY; wall.dir = -1; }
    }

    if (wall.dirX) {
      wall.x += wall.speed * wall.dirX;
      if (wall.x <= wall.minX) { wall.x = wall.minX; wall.dirX = 1; }
      else if (wall.x >= wall.maxX) { wall.x = wall.maxX; wall.dirX = -1; }
    }
  }

  const goal = stage.goal;
  if (!goal.moving) return;
  const movement = goal.moving;
  if (movement.dirY) {
    goal.y += movement.speed * movement.dirY;
    if (goal.y <= movement.minY) { goal.y = movement.minY; movement.dirY = 1; }
    else if (goal.y >= movement.maxY) { goal.y = movement.maxY; movement.dirY = -1; }
  }
  if (movement.dirX) {
    goal.x += movement.speed * movement.dirX;
    if (goal.x <= movement.minX) { goal.x = movement.minX; movement.dirX = 1; }
    else if (goal.x >= movement.maxX) { goal.x = movement.maxX; movement.dirX = -1; }
  }
}

function getWalls(stage) {
  const walls = [...stage.walls];
  if (stage.movingWall) walls.push(stage.movingWall);
  if (stage.movingWalls) walls.push(...stage.movingWalls);
  if (stage.gateWall && !stage.gateWall.opened) walls.push(stage.gateWall);
  if (stage.gateWalls) walls.push(...stage.gateWalls.filter((wall) => !wall.opened));
  return walls;
}

function collide(ball, wall) {
  const nearestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.w));
  const nearestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.h));
  let nx = ball.x - nearestX;
  let ny = ball.y - nearestY;
  const distance = Math.hypot(nx, ny);
  if (distance >= BALL_RADIUS) return;

  let overlap = BALL_RADIUS - distance;
  if (distance === 0) {
    const sides = [
      { depth: ball.x - wall.x, nx: -1, ny: 0 },
      { depth: wall.x + wall.w - ball.x, nx: 1, ny: 0 },
      { depth: ball.y - wall.y, nx: 0, ny: -1 },
      { depth: wall.y + wall.h - ball.y, nx: 0, ny: 1 }
    ];
    const side = sides.reduce((best, item) => item.depth < best.depth ? item : best);
    nx = side.nx;
    ny = side.ny;
    overlap = BALL_RADIUS + Math.max(0, side.depth);
  } else {
    nx /= distance;
    ny /= distance;
  }

  ball.x += nx * overlap;
  ball.y += ny * overlap;
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot >= 0) return;

  ball.bounces++;
  let restitution = PHYSICS.normalRestitution;
  let retention = PHYSICS.normalRetention;
  if (wall.type === 'super') {
    restitution = PHYSICS.superRestitution;
    retention = 1;
  } else if (wall.type === 'damping') {
    restitution = PHYSICS.dampingRestitution;
    retention = PHYSICS.dampingRetention;
  }

  ball.vx = (ball.vx - (1 + restitution) * dot * nx) * retention;
  ball.vy = (ball.vy - (1 + restitution) * dot * ny) * retention;
  if (ball.bounces >= PHYSICS.lateBounceStart && wall.type !== 'super') {
    ball.vx *= PHYSICS.lateBounceRetention;
    ball.vy *= PHYSICS.lateBounceRetention;
  }
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > PHYSICS.maxSpeed) {
    ball.vx = ball.vx / speed * PHYSICS.maxSpeed;
    ball.vy = ball.vy / speed * PHYSICS.maxSpeed;
  }
}

function prepareTarget(stage, target) {
  if (target.type !== 'goal') return;
  if (stage.gateWall) stage.gateWall.opened = true;
  if (stage.gateWalls) stage.gateWalls.forEach((wall) => { wall.opened = true; });
}

function simulate(stageData, shot, target) {
  const stage = clone(stageData);
  prepareTarget(stage, target);
  for (let frame = 0; frame < shot.wait; frame++) updateMoving(stage);

  const direction = shot.angle * Math.PI / 180;
  const rawSpeed = shot.pull * PHYSICS.launchPower * shot.material.k;
  const speed = Math.min(PHYSICS.maxSpeed, rawSpeed);
  const ball = {
    x: stage.launcher.x,
    y: stage.launcher.y,
    vx: Math.cos(direction) * speed,
    vy: Math.sin(direction) * speed,
    bounces: 0
  };

  for (let frame = 0; frame < PHYSICS.maxFlightFrames; frame++) {
    updateMoving(stage);
    const friction = stage.frictionFactor || PHYSICS.defaultFriction;
    ball.vx *= friction;
    ball.vy *= friction;
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (target.type === 'goal') {
      if (Math.hypot(ball.x - stage.goal.x, ball.y - stage.goal.y) < stage.goal.r + BALL_RADIUS * 0.5) {
        return { frame, bounces: ball.bounces };
      }
    } else {
      const switches = stage.switches || [stage.switchTarget];
      const switchTarget = switches[target.index];
      if (Math.hypot(ball.x - switchTarget.x, ball.y - switchTarget.y) < switchTarget.r + BALL_RADIUS) {
        return { frame, bounces: ball.bounces };
      }
    }

    for (const wall of getWalls(stage)) collide(ball, wall);
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    if (currentSpeed < PHYSICS.stopSpeed || ball.x < -30 || ball.x > 1310 || ball.y < -30 || ball.y > 750) break;
  }
  return null;
}

function movingStage(stage) {
  return Boolean(stage.movingWall || stage.movingWalls || stage.goal.moving);
}

function findShot(stage, target) {
  const waits = movingStage(stage) ? MOVING_WAITS : STATIC_WAITS;
  const scan = (startAngle, endAngle, angleStep, currentBest = null) => {
    let best = currentBest;
    for (const wait of waits) {
      for (const material of MATERIAL_LIST) {
        for (const pull of PULLS) {
          for (let angle = startAngle; angle < endAngle; angle += angleStep) {
            const normalizedAngle = (angle + 360) % 360;
            const shot = { angle: normalizedAngle, pull, material, wait };
            const result = simulate(stage, shot, target);
            if (result && (!best || result.frame < best.frame)) best = { ...shot, ...result };
          }
        }
      }
    }
    return best;
  };

  // 2도 전수 검사 후 가장 빠른 후보 주변을 0.1도로 다듬는다.
  let best = scan(0, 360, 2);
  if (best) return scan(best.angle - 2, best.angle + 2.001, 0.1, best);

  // 좁은 통로 때문에 2도 격자에서 놓친 경우에만 전체 정밀 검사를 한다.
  best = scan(0, 360, 0.25);
  if (best) {
    return scan(best.angle - 0.25, best.angle + 0.251, 0.025, best);
  }
  return null;
}

function formatShot(shot) {
  if (!shot) return '도달 경로 없음';
  return `${shot.material.id}, ${shot.pull}px, ${shot.angle.toFixed(2)}°, 대기 ${shot.wait}f, ${shot.frame}f, 반사 ${shot.bounces}회`;
}

const requestedStages = new Set(process.argv.slice(2).map(Number).filter(Number.isInteger));
const stagesToVerify = requestedStages.size
  ? STAGES.filter((stage) => requestedStages.has(stage.stageNum))
  : STAGES;

let failed = false;
for (const stage of stagesToVerify) {
  const structureErrors = validateStructure(stage);
  if (structureErrors.length) {
    failed = true;
    console.log(`${String(stage.stageNum).padStart(2, '0')} ${stage.title} | 구조 오류: ${structureErrors.join(', ')}`);
    continue;
  }
  const switches = stage.switches || (stage.switchTarget ? [stage.switchTarget] : []);
  const results = [];
  switches.forEach((unused, index) => {
    const shot = findShot(stage, { type: 'switch', index });
    results.push(`S${index + 1}: ${formatShot(shot)}`);
    if (!shot) failed = true;
  });
  const goalShot = findShot(stage, { type: 'goal' });
  results.push(`G: ${formatShot(goalShot)}`);
  if (!goalShot) failed = true;
  console.log(`${String(stage.stageNum).padStart(2, '0')} ${stage.title} | ${results.join(' | ')}`);
}

if (failed) {
  console.error('\n검증 실패: 위 목표 중 탐색된 도달 경로가 없는 항목이 있습니다.');
  process.exitCode = 1;
} else {
  console.log(`\n검증 완료: ${stagesToVerify.length}개 스테이지의 모든 필수 목표에 도달 가능한 샘플 경로를 찾았습니다.`);
}
