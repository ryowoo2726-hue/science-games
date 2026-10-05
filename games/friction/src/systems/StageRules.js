import { updateGoal } from '../physics/Goal.js';

export function makeRuleState() { return { checkpoint: 0, hold: 0, failed: false }; }
export function updateRules(body, checkpoints, state, delta) {
  if (state.failed) return;
  const pad = checkpoints[state.checkpoint];
  if (!pad) return;
  if (pad.kind === 'speed') {
    const near = Math.hypot(body.position.x - pad.x, body.position.y - pad.y) <= pad.radius;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (near && speed >= pad.min && speed <= pad.max) state.checkpoint++;
    else if (near && speed > pad.max) state.failed = true;
  } else {
    state.hold = updateGoal(body, [pad.x, pad.y], pad.radius, Boolean(pad.box), state.hold, delta);
    if (state.hold >= 500) { state.checkpoint++; state.hold = 0; }
  }
}
export function goalReady(stage, state, body) {
  if (state.failed || state.checkpoint < (stage.checkpoints?.length ?? 0)) return false;
  if (stage.goalAngle != null) {
    const difference = Math.atan2(Math.sin(2 * (body.angle - stage.goalAngle)), Math.cos(2 * (body.angle - stage.goalAngle))) / 2;
    if (Math.abs(difference) > .12) return false;
  }
  return true;
}
