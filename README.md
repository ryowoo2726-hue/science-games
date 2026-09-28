# 과학 게임 아케이드

중학교 1학년 과학 5단원 「여러 가지 힘」을 탐구하는 통합 웹사이트입니다.

**[통합 홈페이지 열기](https://ryowoo2726-hue.github.io/science-games/)**

| 게임 | 소스 폴더 | 사이트 경로 |
| --- | --- | --- |
| 중력 골프 | `games/gravity` | `games/gravity/` |
| 탄성력 조준 게임 | `games/elasticity` | `games/elasticity/` |
| 부력 미로 탐험 | `games/buoyancy` | `games/buoyancy/` |

메인 디자인은 기존 `index.html`을 사용합니다. 모든 게임의 상단에 메인으로 돌아가는 링크가 있습니다. 준비 중인 마찰력·자기력 카드는 기존 디자인대로 유지합니다.

## 로컬 실행

Node.js 22.12 이상이 필요합니다. Windows에서는 **`개발실행.cmd`**를 실행하고 표시되는 주소를 브라우저에서 여세요. Google Drive의 원본을 유지하면서 로컬 실행 폴더에서 의존성을 설치하고 빌드합니다. 원본을 편집한 뒤 다시 실행하면 반영됩니다.

이미 빌드했다면 **`미리보기.cmd`**로 통합 사이트를 열 수 있습니다.

일반 로컬 디스크나 CI에서는 다음 명령을 사용합니다.

```sh
npm ci --prefix games/buoyancy
npm test
npm run build
npm run preview
```

미리보기 주소는 `http://localhost:4173/science-games/`입니다. 사용 중인 포트는 자동으로 피합니다. `dist`는 통합 배포 결과이며 Git에 올리지 않습니다.

## 수정과 배포

- 메인 페이지의 디자인·소개·게임 카드는 `index.html`에서 수정합니다.
- 게임은 위 표의 해당 폴더에서 수정합니다.
- `main`에 푸시하면 GitHub Actions가 부력 테스트와 전체 빌드·내부 링크 검사를 수행한 뒤 GitHub Pages에 배포합니다.
- 새 게임은 `games/`에 소스를 추가하고 `scripts/build.mjs`의 복사 목록과 메인 페이지의 카드를 추가합니다.

## 이전 프로젝트 보존

세 게임의 기존 Git 수정 이력을 이 저장소에 함께 가져왔습니다. 기존 GitHub 저장소는 유지하며, 이전 로컬 폴더는 `_legacy/`에 보관합니다. 이 보관 폴더는 통합 저장소에 업로드되지 않습니다. 앞으로는 루트 저장소와 `games/`의 소스를 기준으로 작업합니다.
