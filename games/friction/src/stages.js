const goal = '장치를 작동시킨 뒤 물체 전체를 골 안에서 1초 유지하기';
const ice = (x, y, w, h) => ({ rect: [x, y, w, h], mode: 'fixed', mu: .001, name: '고정 얼음', color: 0x568ec2 });
const rubber = (x, y, w, h, mu = 1.1) => ({ rect: [x, y, w, h], mode: 'fixed', mu, name: '고정 고무', color: 0x9f7961 });
export const stages = [
  { title: '길만 바꿀 수 있다', text: '칠해진 작업 구간만 문지를 수 있어요. 고정 고무 위의 골에 정지하세요.', hint: '작업 구간을 매끄럽게 만들되 골 앞까지 전부 지우지는 마세요.', rough: .5, spawn: [144, 240], target: [670, 240], radius: 50, zones: [rubber(0, 0, 832, 480, .9), { rect: [64, 176, 544, 128], mode: 'both', name: '작업 구간', color: 0x4fa894 }, rubber(608, 0, 224, 480, .7)] },
  { title: '멈추지 않는 얼음', text: '가운데 얼음은 손과 사포가 통하지 않아요. 얼음에 들어가기 전에 속도를 조절하세요.', hint: '얼음 뒤쪽에 긴 제동 구간을 만들고, 얼음 위에서는 반대로 기울여 보세요.', rough: .08, spawn: [144, 240], target: [690, 240], radius: 46, zones: [ice(320, 0, 224, 480)] },
  { title: '얼음 위의 골', text: '골이 고정 얼음 위에 있어요. 골을 거칠게 만들 수 없으니 반대 방향으로 기울여 멈춰야 합니다.', hint: '골 직전에 멈출 듯이 속도를 낮추고, 아주 짧게 기울여 위치를 맞추세요.', rough: .3, spawn: [144, 350], target: [690, 112], radius: 44, zones: [ice(592, 0, 240, 224)] },
  { title: '사포만 남았다', text: '손 도구가 잠겼어요. 미끄러운 바닥에 사포로 모퉁이와 제동 구간을 만들어 벽을 돌아가세요.', hint: '길을 미끄럽게 만드는 대신, 멈출 지점을 추가해 이동을 나누세요.', rough: .015, tool: 'sand', spawn: [140, 180], target: [690, 180], radius: 44, obstacles: [[416, 150, 24, 300]], zones: [ice(384, 300, 64, 180)] },
  { title: '순서가 있는 연구소', text: '①과 ② 스위치에 순서대로 정지해야 골이 켜져요. 단순히 골로 직행하면 열리지 않습니다.', hint: '먼저 아래쪽 ①, 그다음 위쪽 ②에서 멈추세요. 스위치마다 제동 구간을 준비하세요.', rough: 1.05, tool: 'hand', spawn: [130, 230], target: [720, 260], radius: 42, obstacles: [[310, 150, 22, 300], [540, 330, 22, 300]], checkpoints: [{ x: 240, y: 370, radius: 48 }, { x: 450, y: 100, radius: 46 }] },
  { title: '속도 인증 터널', text: '얼음 위의 속도 센서를 적당히 빠르게 통과해야 골이 켜져요. 너무 빠르면 이번 시도는 실패합니다.', hint: '센서 앞의 마찰로 진입 속도를 조절하고, 통과 후에는 골 앞에서 제동하세요.', rough: .08, spawn: [144, 240], target: [690, 240], radius: 36, zones: [ice(352, 0, 160, 480)], checkpoints: [{ x: 432, y: 240, radius: 44, kind: 'speed', min: 3, max: 6 }] },
  { title: '고무 늪을 돌파하라', text: '고정 고무 위에서 멈추면 다시 출발하기 어려워요. 미리 속도를 얻어 센서를 통과한 뒤 골에서 제동하세요.', hint: '고무 앞은 매끄럽게, 뒤는 거칠게 만드세요. 센서는 속도가 남아 있어야 작동해요.', rough: .04, spawn: [112, 240], target: [690, 240], radius: 38, zones: [rubber(352, 0, 80, 480, 1.15)], checkpoints: [{ x: 400, y: 240, radius: 22, kind: 'speed', min: 2, max: 20 }] },
  { title: '붙잡힌 왼쪽', text: '상자의 왼쪽 바닥은 고정 고무입니다. 오른쪽만 매끄럽게 만들어 상자를 돌리고 좁은 문을 통과하세요.', hint: '고무는 바꿀 수 없어요. 오른쪽 접촉점을 문지른 뒤 짧게 앞뒤로 기울여 회전을 살펴보세요.', rough: .55, spawn: [432, 340], target: [680, 96], radius: 78, box: true, gate: { y: 190, gap: 96 }, zones: [rubber(336, 272, 96, 176, .95)] },
  { title: '세로 주차 전용', text: '더 좁은 문을 지나 세로 방향으로 주차해야 해요. 골 안에 멈췄어도 가로 방향이면 열리지 않습니다.', hint: '골에 그려진 상자 방향과 맞추세요. 골 앞 노란 구간은 사포만 사용할 수 있어요.', rough: .18, spawn: [170, 350], target: [688, 92], radius: 76, box: true, goalAngle: Math.PI / 2, gate: { y: 190, gap: 72 }, obstacles: [[410, 370, 24, 170]], zones: [{ rect: [608, 0, 160, 160], mode: 'sand', name: '사포 전용', color: 0xc39c4b }] },
  { title: '연구소 최종 보안', text: '①과 ②에 차례대로 상자를 정지시키고, 얼음과 좁은 문을 넘어 세로 방향으로 주차하세요.', hint: '스위치 둘을 먼저 작동시키세요. 얼음 위에서는 기울기로 제동하고, 문을 지난 뒤 사포로 회전을 멈추세요.', rough: .025, spawn: [160, 350], target: [688, 90], radius: 72, box: true, goalAngle: Math.PI / 2, gate: { y: 180, gap: 60 }, obstacles: [[400, 370, 24, 180], [560, 292, 76, 24]], checkpoints: [{ x: 210, y: 340, radius: 82, box: true }, { x: 680, y: 350, radius: 78, box: true }], zones: [ice(432, 208, 192, 64), { rect: [624, 0, 128, 160], mode: 'sand', name: '사포 전용', color: 0xc39c4b }] }
].map((stage, index) => ({ ...stage, goal, note: stage.text, result: '바닥의 제한과 장치를 해결하고 물체 전체를 골 안에서 1초 유지했어요.', number: index + 1 }));

export function stageLayout(stage, width, height) {
  const sx = width / 832, sy = height / 480;
  const spawn = [stage.spawn[0] * sx, stage.spawn[1] * sy], target = [stage.target[0] * sx, stage.target[1] * sy];
  const walls = (stage.obstacles ?? []).map(([x, y, w, h]) => ({ x: x * sx, y: y * sy, width: w * sx, height: h * sy }));
  if (stage.gate) {
    const gateX = target[0], gateY = stage.gate.y * sy, gap = stage.gate.gap;
    const leftWidth = gateX - gap / 2, rightWidth = width - gateX - gap / 2;
    walls.push({ x: leftWidth / 2, y: gateY, width: leftWidth, height: 20 }, { x: gateX + gap / 2 + rightWidth / 2, y: gateY, width: rightWidth, height: 20 });
  }
  const zones = (stage.zones ?? []).map(zone => ({ ...zone, x: zone.rect[0] * sx, y: zone.rect[1] * sy, width: zone.rect[2] * sx, height: zone.rect[3] * sy }));
  const checkpoints = (stage.checkpoints ?? []).map(pad => ({ ...pad, x: pad.x * sx, y: pad.y * sy }));
  return { spawn, target, walls, zones, checkpoints };
}
