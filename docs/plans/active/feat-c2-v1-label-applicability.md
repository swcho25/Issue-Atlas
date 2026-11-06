# feat/c2-v1-label-applicability — C2 v1 계약: claim.label · applicability

- Jira: S15P31C108-283 · PRD: — · 묶음/단위: P5 (「오류」 페이지 결정 2 · 7)

## 완료 조건
- [x] argument.schema.json: `claim.label`(string|null, 필수), 최상위 `applicability[]`(`{condition, label, passed, note}`, 필수, 카드 없음 [], 확인 못 한 조건 passed null)
- [x] 예시 JSON 4개 + 적용 조건 ✕ 예시 1개 · c2 README · freeze-2026-11-04.md 변경 이력 · 배포 순서(계약 → engine → backend) · 지난 실행 Flyway 채움 계획
- [x] 예시 5개가 스키마를 통과하고 깨져야 하는 변형 7개가 깨진다(engine jsonschema 로 검사 — ajv dlx 는 이 환경에서 막힘)
- [x] backend(장성우, MR 리뷰어) · 프론트(정우현, MR 코멘트) 리뷰 요청 — !191 Draft

## 진행
- 2026-11-06: 계약만(구현은 리뷰 뒤). 스키마 검사 2개를 더함: blocked · unsupported → label null, applicability 에 passed false → unsupported. 카드 없음 → applicability []
- 2026-11-06: AI 판정 입력 예시 3개와 engine 테스트 고정값에도 `claim.label` (판정 입력이 C2 claim 을 $ref). engine pytest · ruff 통과
- 2026-11-06: 이 MR 만 머지하면 backend 계약 테스트(C2Contract)가 깨진다 → Draft 로 열고, 리뷰 뒤 같은 브랜치에 backend · 프론트 구현을 더해 함께 머지
- 2026-11-06: #4 일반 로그인 엔드포인트(GET /v1/questions)는 P7 합의 전이라 넣지 않았다

## 다음 할 일 / 범위 밖
- 리뷰 뒤 구현: backend `Claim.label` · `applicability` + Flyway(지난 실행 `label: null` · `applicability: []`), 프론트 zod · 배지 · unsupported ✕ 목록
- `schema_version` 을 c2-1.0 으로 올릴지(모든 엔드포인트 공통 값) — 리뷰에서 정하기
- #4 일반 사용자 로그인: 11/4 A안(일반 사용자 로그인 없음, S15P31C108-208)을 뒤집는 것이라 P7 장성우 합의 필요
