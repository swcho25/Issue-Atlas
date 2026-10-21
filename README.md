# Issue Atlas

지역사회 이슈를 근거 기반으로 분석하는 Community Intelligence 플랫폼. 사용자가 지역 × 이슈 × 기간을 고르면, 공식 통계·행정 자료·정책 문서를 시간·공간 기준으로 맞춰 **논증 카드**로 보여 주고 모든 판단을 원문까지 추적하게 한다.

SSAFY 15기 자율 프로젝트 C108 · 기업 연계(스테디윈스)

## 기술 스택
| 구분 | 기술 |
| --- | --- |
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · FSD · MapLibre GL JS(예정) |
| Backend | Java 21 · Spring Boot 4.1 · Spring Data JPA · Flyway · springdoc-openapi |
| Engine | Python (예정) |
| Data | PostgreSQL 17 + PostGIS 3.5 |
| Tooling | pnpm 워크스페이스 · Gradle · Docker Compose |

## 구조
```
S15P31C108/
├── frontend/      Next.js · FSD (src/app · pages · widgets · features · entities · shared)
├── backend/       Spring Boot
├── engine/        Python 서비스 자리 (비어 있음)
├── contracts/     레인 간 계약 C1 · C2 · C3
├── docs/          계획서 · 발표 자료 · 와이어프레임
├── scripts/       개발 편의 스크립트 (gradle.mjs: OS별 gradlew 실행)
├── docker-compose.yml   로컬 PostGIS
├── package.json         루트 스크립트 (pnpm)
└── pnpm-workspace.yaml
```

## 시작하기
필요한 것: Node 20.19 이상(corepack 포함), Java 21, Docker

```bash
corepack enable          # pnpm 활성화 (버전은 package.json 의 packageManager 로 고정)
pnpm install             # 의존성 설치 + git 훅 연결
cp .env.example .env     # 로컬 값
pnpm infra:up            # PostGIS 기동
pnpm backend:dev         # http://localhost:8080 (Swagger: /swagger-ui.html)
pnpm frontend:dev        # http://localhost:3000
```

`corepack enable` 이 권한 문제로 실패하면 `corepack pnpm <명령>` 으로 써도 된다.

## 자주 쓰는 명령
| 명령 | 하는 일 |
| --- | --- |
| `pnpm infra:up` / `pnpm infra:down` | PostGIS 기동 / 중지 |
| `pnpm frontend:dev` · `frontend:build` · `frontend:lint` · `frontend:typecheck` | 프론트 개발·빌드·린트(ESLint + FSD 검사)·타입 검사 |
| `pnpm backend:dev` · `backend:test` · `backend:build` | 백엔드 실행·테스트(Testcontainers, Docker 필요)·빌드 |
| `pnpm check` | 바뀐 영역만 검사 (`git push` 전에 자동 실행) |
| `pnpm check:all` | 전체 lint · typecheck · test · build (MR 전) |

작업 규칙은 [AGENTS.md](AGENTS.md).
