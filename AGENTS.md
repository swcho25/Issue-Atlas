# S15P31C108 Issue Atlas

지역 × 이슈 × 기간을 고르면 공식 통계·행정 자료·정책 문서를 맞춰 **논증 카드**로 보여 주는 플랫폼.
SSAFY 15기 자율 프로젝트 C108 · 기업 연계(스테디윈스). 기준 문서: Notion PRD v4.1, 인원 분배 v2.

이 파일은 지도다. 세부 규칙은 아래 링크와 각 폴더의 `AGENTS.md`에 있다.

## 폴더
| 폴더 | 내용 | 세부 규칙 |
| --- | --- | --- |
| `frontend/` | Next.js 16 · TypeScript · Tailwind 4 · FSD | `frontend/AGENTS.md` |
| `backend/` | Spring Boot 4.1 · Java 21 · Gradle · Flyway · PostGIS | `backend/AGENTS.md` |
| `engine/` | Python 서비스 자리 (빈 틀) | `engine/AGENTS.md` |
| `contracts/` | 레인 간 계약 C1 · C2 · C3 (바꾸면 받는 쪽 리뷰 필수) | `contracts/README.md` |
| `.agents/skills/` | 스킬 원본 start · check · finish · review · handoff (`.claude/skills/` 는 연결 파일) | 각 `SKILL.md` |
| `docs/plans/` | 작업별 실행 계획 (`active/` 진행 중, `done/` 끝남) | `docs/plans/TEMPLATE.md` |
| `docs/harness-plan.md` | 이 하네스의 설계와 도입 순서 | — |

## 명령 (루트에서, pnpm 만 사용)
| 명령 | 하는 일 |
| --- | --- |
| `pnpm install` | 의존성 + git 훅 연결 |
| `pnpm infra:up` / `infra:down` | 로컬 PostGIS |
| `pnpm frontend:dev` · `frontend:lint` · `frontend:typecheck` · `frontend:build` | 프론트 |
| `pnpm backend:dev` · `backend:test` · `backend:build` | 백엔드 (`test` 는 Docker 필요) |
| `pnpm check` | 바뀐 영역만 검사 (frontend: lint·typecheck / backend: test). push 전 훅도 이것을 돌린다 |
| `pnpm check:all` | 전체 lint · typecheck · test · build (MR 전) |

## 작업 흐름
1. `/start`(Claude) 또는 `$start`(Codex)로 시작한다. Jira 이슈 확인·생성, 브랜치, 실행 계획 파일을 만든다.
2. 실행 계획(`docs/plans/active/<branch>.md`)의 **완료 조건**만큼만 구현한다. 범위 밖 발견은 계획 파일의 「다음 할 일」에 적는다.
3. `/check`로 바뀐 영역을 검사하고, `/finish`로 커밋·MR 초안까지 간다. push 는 사람이 한다.
4. 세션을 끊을 때는 `/handoff`로 계획 파일의 「다음 할 일」을 채운다.

설명·조사만 요청받으면 이슈·브랜치·계획 파일을 만들지 않는다.

## 완료의 정의
- 계획 파일의 완료 조건이 모두 체크됐다
- 바뀐 영역의 lint · typecheck · test · build 가 통과했다
- 화면 변경은 브라우저에서 직접 확인했다 (단위 테스트만으로 완료 처리하지 않는다)
- API·DB 를 바꿨으면 `contracts/`·Flyway 마이그레이션도 같은 MR 에서 바꿨다

## 브랜치 · 커밋 · MR · Jira
- 기본 브랜치 `develop`, 배포 기준 `main`(MR 로만 병합). force push 금지
- 브랜치 `<type>/<kebab-case>` — Jira 키는 넣지 않는다
- type: `feat` `fix` `refactor` `test` `docs` `infra` `chore` `perf` `security`
- 커밋 `<type>: <명사형 요약>` (예: `feat: 근거 수요표 API 추가`) — `.githooks/commit-msg` 가 검사
- MR 제목 `<type>: <명사형 요약> (S15P31C108-XX)`. 목적 하나, 300줄 이하 권장
- Jira 프로젝트 `S15P31C108`. 이슈 생성·전이는 `start`·`finish` 스킬이 Atlassian MCP 로 한다. 이슈 요약은 `[에픽 접두어] 명사형 요약`(예: `[S2] 근거 상세 패널 추가`), 필드 ID·전이 ID 는 매번 조회한다

## 하지 않는 것
- `.env`·키 파일을 읽거나 커밋하지 않는다. 공유할 값은 `.env.example` 에 이름과 설명만
- npm · yarn 으로 설치하지 않는다 (pnpm, corepack 버전 고정)
- DB 스키마를 Flyway 밖에서 바꾸지 않는다
- Docker 이미지 태그만 바꾸지 않는다 (digest 함께)

## 이 파일을 고치는 기준
에이전트가 **같은 실수를 두 번** 하면 한 줄을 더하거나 센서(린트·테스트)로 막는다. 추측으로 규칙을 미리 쓰지 않는다. 100줄을 넘기지 않는다.
