# feat/c2-v1-label-applicability — C2 v1 계약: claim.label · applicability

- Jira: S15P31C108-283 · PRD: — · 묶음/단위: P5 (「오류」 페이지 결정 2 · 7)

## 완료 조건
- [x] argument.schema.json: `claim.label`(string|null, 필수), 최상위 `applicability[]`(`{condition, label, passed, note}`, 필수, 카드 없음 [], 확인 못 한 조건 passed null)
- [x] 예시 JSON 4개 + 적용 조건 ✕ 예시 1개 · c2 README · freeze-2026-11-04.md 변경 이력 · 배포 순서(계약 → engine → backend) · 지난 실행 Flyway 채움 계획
- [x] 예시 5개가 스키마를 통과하고 깨져야 하는 변형 7개가 깨진다(engine jsonschema 로 검사 — ajv dlx 는 이 환경에서 막힘)
- [x] backend(장성우, MR 리뷰어) · 프론트(정우현, MR 코멘트) 리뷰 요청 — !191 Draft
- [x] backend 구현: `Claim.label`(승인본 결과 이름, 판정 안 함 null) · `applicability[]`(`CardApplicability`) · 지역 단위 다르면 unsupported · V0049 지난 실행 채움 · QuestionApiTest 단언 + 테스트 2개
- [x] CI backend 테스트 통과 — 파이프라인 #275563 5개 잡 모두 성공(로컬 Docker 가 멈춰 push 훅은 사람 허락으로 건너뜀)
- [ ] 프론트 zod · 배지 · unsupported ✕ 목록 — 정우현 담당(2026-11-06 결정)

## 진행
- 2026-11-06: 계약만(구현은 리뷰 뒤). 스키마 검사 2개를 더함: blocked · unsupported → label null, applicability 에 passed false → unsupported. 카드 없음 → applicability []
- 2026-11-06: AI 판정 입력 예시 3개와 engine 테스트 고정값에도 `claim.label` (판정 입력이 C2 claim 을 $ref). engine pytest · ruff 통과
- 2026-11-06: 이 MR 만 머지하면 backend 계약 테스트(C2Contract)가 깨진다 → Draft 로 열고, 리뷰 뒤 같은 브랜치에 backend · 프론트 구현을 더해 함께 머지
- 2026-11-06: #4 일반 로그인 엔드포인트(GET /v1/questions)는 P7 합의 전이라 넣지 않았다
- 2026-11-06: 리뷰를 기다리지 않고 backend 구현을 먼저 넣음(CI 빨간불 해소). 승인본이 jsonb 라 칸 순서가 남지 않아 줄 순서는 카드 계약 순서로 고정(README · 스키마 설명 고침). 지역 단위는 근거와 상관없이 정해져 blocked 보다 먼저 본다. 측정소 수는 연평균이 있는 측정소 모두(판정의 공통 측정소와 다름)
- 2026-11-06: 로컬 Testcontainers 가 Docker ping 에서 멈춤(`docker_engine` · `dockerDesktopLinuxEngine` 두 파이프 모두, `docker ps -a` 도 응답 없음). Docker Desktop 은 재시작하지 않고 CI 로 검증. 포맷 · 컴파일 · ArchitectureTest 는 통과
- 2026-11-06: 프론트 zod 는 `z.object`(모르는 칸 버림)라 backend 가 먼저 나가도 화면은 그대로

## 다음 할 일 / 범위 밖
- 프론트 구현(정우현): `shared/api/c2/argument.ts` zod 두 칸 · 배지 `claim.label`(null 이면 run_status 문구) · unsupported ✕ 목록(`applicability` 의 `passed: false` 줄). 이 브랜치에 더할지 다음 MR 로 할지 정우현과 정하기
- 배포 순서 계약 → engine → backend (engine 이 문장화 요청을 계약 스키마로 엄격히 검사)
- `schema_version` 을 c2-1.0 으로 올릴지(모든 엔드포인트 공통 값) — 리뷰에서 정하기
- #4 일반 사용자 로그인: 11/4 A안(일반 사용자 로그인 없음, S15P31C108-208)을 뒤집는 것이라 P7 장성우 합의 필요
