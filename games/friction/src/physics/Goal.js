export const GOAL = { holdMs: 1000 };
const STOP = { speed: .001, angularSpeed: .00001 };

export function insideGoal(body, target, radius, box) {
  const [x, y] = target;
  // Every part must fit inside the goal, not just the centre.
  if (box) return body.vertices.every(p => Math.hypot(p.x - x, p.y - y) <= radius);
  return Math.hypot(body.position.x - x, body.position.y - y) + (body.circleRadius ?? 20) <= radius;
}

export function updateGoal(body, target, radius, box, elapsed, delta) {
  return insideGoal(body, target, radius, box) ? elapsed + delta : 0;
}

// Numbered switches still require stopping; the final goal only requires staying inside.
export function updateStoppedPad(body, target, radius, box, elapsed, delta) {
  const stopped = Math.hypot(body.velocity.x, body.velocity.y) <= STOP.speed && Math.abs(body.angularVelocity) <= STOP.angularSpeed;
  return insideGoal(body, target, radius, box) && stopped ? elapsed + delta : 0;
}
