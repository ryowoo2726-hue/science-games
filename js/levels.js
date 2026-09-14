// 10단계 스테이지 데이터 및 과학 교육 콘텐츠
const GAME_LEVELS = [
    {
        id: 1,
        title: "Stage 1: 중력과의 첫 만남",
        subtitle: "만유인력과 궤도의 휨 (곡선 운동)",
        concept: "중력(인력)에 의한 운동 방향 변화",
        description: "행성이 물체를 끌어당기는 중력 때문에 직선으로 날아가던 공이 아래쪽으로 휘어집니다. 아래쪽 행성의 인력을 계산하여 목표 기지(알파 기지)를 향해 각도를 살짝 위로 올려 조준해보세요!",
        tip: "💡 행성의 중력이 공을 아래로 끌어당깁니다! 발사 각도를 위쪽(-15° ~ -20°)으로 올려서 쏴보세요.",
        par: 1,
        startPos: { x: 150, y: 250 },
        target: { x: 950, y: 250, radius: 25, name: "알파 기지" },
        planets: [
            {
                x: 550,
                y: 390,
                mass: 36,
                radius: 48,
                name: "테라 (지구형 행성)",
                color: "#3b82f6",
                glowColor: "rgba(59, 130, 246, 0.45)",
                atmosphere: "rgba(96, 165, 250, 0.25)"
            }
        ],
        obstacles: []
    },
    {
        id: 2,
        title: "Stage 2: 질량과 중력의 크기",
        subtitle: "질량이 클수록 중력도 크다!",
        concept: "질량 비례 법칙 (F ∝ M)",
        description: "질량이 55인 거대 목성형 행성과 질량이 15인 소형 위성이 있습니다. 무거운 행성이 훨씬 강하게 끌어당기므로 궤도 휨의 차이를 비교하며 통과해보세요!",
        tip: "💡 목성(노란색)의 거대한 인력에 빨려 들어가지 않도록 아래쪽 위성 쪽을 노려보세요.",
        par: 1,
        startPos: { x: 150, y: 325 },
        target: { x: 960, y: 325, radius: 25, name: "베타 기지" },
        planets: [
            {
                x: 520,
                y: 170,
                mass: 55,
                radius: 56,
                name: "거대 목성 (질량 55)",
                color: "#f59e0b",
                glowColor: "rgba(245, 158, 11, 0.45)",
                atmosphere: "rgba(251, 191, 36, 0.25)"
            },
            {
                x: 520,
                y: 480,
                mass: 15,
                radius: 28,
                name: "소형 위성 (질량 15)",
                color: "#06b6d4",
                glowColor: "rgba(6, 182, 212, 0.4)",
                atmosphere: "rgba(103, 232, 249, 0.2)"
            }
        ],
        obstacles: []
    },
    {
        id: 3,
        title: "Stage 3: 중력 슬링샷 (스윙바이)",
        subtitle: "행성의 중력으로 180도 U턴 기동",
        concept: "중력 도움 (Gravity Assist / Swing-by)",
        description: "시작 지점과 비밀 연구소 사이가 차단 방어벽으로 막혀 있습니다. 오른쪽 거대 행성의 강력한 중력을 이용해 스윙바이(슬링샷) 궤도를 그리며 행성 근처 연구소를 통과하세요!",
        tip: "💡 오른쪽 거대 행성의 주변을 스쳐 지나가도록 쏘면 중력에 의해 휘어지며 행성 뒤편 연구소로 자연스럽게 진입합니다.",
        par: 1,
        startPos: { x: 160, y: 500 },
        target: { x: 550, y: 200, radius: 26, name: "비밀 연구소" },
        planets: [
            {
                x: 690,
                y: 330,
                mass: 90,
                radius: 54,
                name: "거대 슬링샷 행성",
                color: "#ec4899",
                glowColor: "rgba(236, 72, 153, 0.5)",
                atmosphere: "rgba(244, 114, 182, 0.3)"
            }
        ],
        obstacles: [
            {
                type: "rect",
                x: 0,
                y: 300,
                w: 420,
                h: 28,
                color: "#475569",
                name: "차단 방어벽"
            }
        ]
    },
    {
        id: 4,
        title: "Stage 4: 라그랑주 중력 균형",
        subtitle: "두 중력이 팽팽히 맞서는 지점",
        concept: "두 힘의 평형과 합력 = 0",
        description: "동일한 질량을 가진 두 쌍둥이 행성이 위아래로 마주보고 있습니다. 두 행성의 정가운데는 양쪽의 인력이 서로 상쇄되어 직선처럼 안전하게 통과할 수 있습니다.",
        tip: "💡 두 행성의 정중앙 틈새(각도 0°)를 정확히 노려 관통해보세요!",
        par: 1,
        startPos: { x: 150, y: 325 },
        target: { x: 950, y: 325, radius: 25, name: "감마 기지" },
        planets: [
            {
                x: 550,
                y: 160,
                mass: 38,
                radius: 42,
                name: "쌍둥이 알파 (질량 38)",
                color: "#8b5cf6",
                glowColor: "rgba(139, 92, 246, 0.4)",
                atmosphere: "rgba(167, 139, 250, 0.2)"
            },
            {
                x: 550,
                y: 490,
                mass: 38,
                radius: 42,
                name: "쌍둥이 베타 (질량 38)",
                color: "#8b5cf6",
                glowColor: "rgba(139, 92, 246, 0.4)",
                atmosphere: "rgba(167, 139, 250, 0.2)"
            }
        ],
        obstacles: []
    },
    {
        id: 5,
        title: "Stage 5: 삼체(Three-Body) 중력장",
        subtitle: "복합 중력장 속 정밀 제어",
        concept: "여러 힘의 합성 (다체 문제)",
        description: "3개의 행성이 복잡한 중력 그물을 형성하고 있습니다. 공의 위치에 따라 세 행성의 인력 벡터가 실시간으로 합쳐지며 예측하기 어려운 궤도를 만들어냅니다.",
        tip: "💡 '중력 벡터 표시' 옵션을 켜서 세 행성의 힘이 어떻게 합쳐지는지 관찰하세요!",
        par: 2,
        startPos: { x: 130, y: 325 },
        target: { x: 970, y: 325, radius: 25, name: "델타 기지" },
        planets: [
            {
                x: 440,
                y: 200,
                mass: 30,
                radius: 38,
                name: "삼체 행성 A",
                color: "#e11d48",
                glowColor: "rgba(225, 29, 72, 0.4)",
                atmosphere: "rgba(251, 113, 133, 0.2)"
            },
            {
                x: 440,
                y: 450,
                mass: 30,
                radius: 38,
                name: "삼체 행성 B",
                color: "#14b8a6",
                glowColor: "rgba(20, 184, 166, 0.4)",
                atmosphere: "rgba(45, 212, 191, 0.2)"
            },
            {
                x: 740,
                y: 325,
                mass: 34,
                radius: 40,
                name: "삼체 행성 C",
                color: "#f59e0b",
                glowColor: "rgba(245, 158, 11, 0.4)",
                atmosphere: "rgba(251, 191, 36, 0.2)"
            }
        ],
        obstacles: []
    },
    {
        id: 6,
        title: "Stage 6: 공전하는 행성",
        subtitle: "타이밍이 생명인 동적 중력장",
        concept: "움직이는 천체의 중력과 상대 운동",
        description: "가운데 지점을 중심으로 위성 행성이 일정하게 궤도를 돌고(공전) 있습니다. 행성의 위치가 시간에 따라 변하므로 발사하는 타이밍이 매우 중요합니다.",
        tip: "💡 공전 행성이 아래로 내려가는 순간 발사하면 중력으로 위로 끌어올려줍니다!",
        par: 2,
        startPos: { x: 150, y: 325 },
        target: { x: 950, y: 325, radius: 25, name: "궤도 관측소" },
        planets: [
            {
                x: 550,
                y: 325,
                mass: 42,
                radius: 40,
                name: "공전 위성 오르비타",
                color: "#0284c7",
                glowColor: "rgba(2, 132, 199, 0.45)",
                atmosphere: "rgba(56, 189, 248, 0.25)",
                orbitCenterX: 550,
                orbitCenterY: 325,
                orbitRadius: 135,
                orbitSpeed: 0.9,
                angle: 0
            }
        ],
        obstacles: [
            {
                type: "circle",
                x: 550,
                y: 325,
                radius: 18,
                color: "#64748b",
                name: "중심 축 허브"
            }
        ]
    },
    {
        id: 7,
        title: "Stage 7: 반중력 펄서 (척력)",
        subtitle: "밀어내는 힘과 당기는 힘",
        concept: "인력과 척력의 상호작용",
        description: "초록색 펄서는 중력과 반대로 물체를 강하게 밀어내는 미지의 '척력장'을 내뿜습니다. 당기는 보라색 행성과 밀어내는 초록색 펄서를 지혜롭게 이용하세요!",
        tip: "💡 펄서에 가까워지면 튕겨져 나가므로 반발력을 추진력처럼 활용할 수 있습니다.",
        par: 2,
        startPos: { x: 140, y: 220 },
        target: { x: 960, y: 480, radius: 25, name: "양자 연구소" },
        planets: [
            {
                x: 480,
                y: 325,
                mass: -38, // 반중력 (음의 질량)
                radius: 36,
                name: "반중력 펄서 (척력 발생)",
                color: "#10b981",
                glowColor: "rgba(16, 185, 129, 0.5)",
                atmosphere: "rgba(52, 211, 153, 0.3)",
                isRepulsor: true
            },
            {
                x: 740,
                y: 200,
                mass: 35,
                radius: 42,
                name: "인력 행성 시리우스",
                color: "#8b5cf6",
                glowColor: "rgba(139, 92, 246, 0.4)",
                atmosphere: "rgba(167, 139, 250, 0.2)"
            }
        ],
        obstacles: []
    },
    {
        id: 8,
        title: "Stage 8: 소행성대와 중력 터널",
        subtitle: "장애물을 우회하는 중력 곡선",
        concept: "중력을 이용한 장애물 회피 궤도",
        description: "직선 경로가 두터운 소행성 방어벽으로 완전히 가로막혀 있습니다. 상단과 하단의 행성 중력을 이용해 S자 곡선으로 틈새를 통과해보세요.",
        tip: "💡 위쪽 행성을 스쳐 아래로 꺾은 뒤, 아래쪽 행성의 인력으로 다시 위로 유도하세요.",
        par: 2,
        startPos: { x: 130, y: 520 },
        target: { x: 960, y: 160, radius: 25, name: "카이퍼 기지" },
        planets: [
            {
                x: 440,
                y: 150,
                mass: 36,
                radius: 40,
                name: "터널 유도 행성 A",
                color: "#d97706",
                glowColor: "rgba(217, 119, 6, 0.4)",
                atmosphere: "rgba(251, 191, 36, 0.2)"
            },
            {
                x: 680,
                y: 490,
                mass: 38,
                radius: 42,
                name: "터널 유도 행성 B",
                color: "#4f46e5",
                glowColor: "rgba(79, 70, 229, 0.4)",
                atmosphere: "rgba(129, 140, 248, 0.2)"
            }
        ],
        obstacles: [
            {
                type: "rect",
                x: 540,
                y: 190,
                w: 30,
                h: 270,
                color: "#475569",
                name: "소행성 장벽"
            }
        ]
    },
    {
        id: 9,
        title: "Stage 9: 2연속 중력 스윙바이",
        subtitle: "연속 궤도 수정 (Double Slingshot)",
        concept: "다중 중력 도움 효과",
        description: "첫 번째 행성을 스쳐 지나가며 각도를 바꾼 뒤, 두 번째 행성의 중력으로 가속하여 가로막힌 장애벽을 우회해 안착하세요!",
        tip: "💡 1차 행성과 2차 행성의 중력 휨을 차례대로 연결해보세요.",
        par: 2,
        startPos: { x: 130, y: 460 },
        target: { x: 970, y: 460, radius: 25, name: "안드로메다 전초기지" },
        planets: [
            {
                x: 420,
                y: 260,
                mass: 36,
                radius: 40,
                name: "1차 궤도 전환 행성",
                color: "#06b6d4",
                glowColor: "rgba(6, 182, 212, 0.45)",
                atmosphere: "rgba(103, 232, 249, 0.2)"
            },
            {
                x: 700,
                y: 260,
                mass: 38,
                radius: 42,
                name: "2차 궤도 전환 행성",
                color: "#8b5cf6",
                glowColor: "rgba(139, 92, 246, 0.45)",
                atmosphere: "rgba(167, 139, 250, 0.2)"
            }
        ],
        obstacles: [
            {
                type: "rect",
                x: 550,
                y: 350,
                w: 24,
                h: 280,
                color: "#475569",
                name: "중앙 암석벽"
            }
        ]
    },
    {
        id: 10,
        title: "Stage 10: 은하계 마스터 슬링샷",
        subtitle: "연쇄 스윙바이 대항해 (보이저 미션)",
        concept: "다중 천체 중력 도움 (Voyager Project)",
        description: "보이저 2호가 목성, 토성, 천왕성, 해왕성을 차례로 연속 슬링샷하며 태양계를 벗어났듯이, 3개의 천체를 연속으로 이용하여 아득히 먼 기지에 골인하세요!",
        tip: "💡 첫 번째 행성을 돌아 속도를 올리고, 두 번째와 세 번째 행성의 궤적을 연결하세요!",
        par: 3,
        startPos: { x: 120, y: 150 },
        target: { x: 980, y: 530, radius: 25, name: "성간 우주 포털" },
        planets: [
            {
                x: 360,
                y: 330,
                mass: 36,
                radius: 40,
                name: "1차 슬링샷 행성",
                color: "#ec4899",
                glowColor: "rgba(236, 72, 153, 0.4)",
                atmosphere: "rgba(244, 114, 182, 0.2)"
            },
            {
                x: 580,
                y: 160,
                mass: 32,
                radius: 38,
                name: "2차 궤도 전환 행성",
                color: "#06b6d4",
                glowColor: "rgba(6, 182, 212, 0.4)",
                atmosphere: "rgba(103, 232, 249, 0.2)"
            },
            {
                x: 770,
                y: 390,
                mass: 42,
                radius: 44,
                name: "3차 감속 유도 행성",
                color: "#8b5cf6",
                glowColor: "rgba(139, 92, 246, 0.4)",
                atmosphere: "rgba(167, 139, 250, 0.2)"
            }
        ],
        obstacles: [
            {
                type: "rect",
                x: 480,
                y: 420,
                w: 22,
                h: 220,
                color: "#475569",
                name: "성간 암석벽"
            }
        ]
    }
];

window.GAME_LEVELS = GAME_LEVELS;
