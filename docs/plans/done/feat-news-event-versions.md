# feat/news-event-versions — 기사 사건 표에 프롬프트 판 · 모델 칸

- Jira: S15P31C108-218 · PRD: 7.6 · 묶음/단위: P3-7

## 완료 조건
- [x] Flyway V0038(처음 V0037 → 번호 겹침으로 V0038): `news_event` 에 `prompt_version` · `summary_version` · `model` 칸(null 허용). null = 판 기록 전 적재
- [x] `region-load` 가 추출 결과의 판 · 모델을 저장(다시 넣을 때 새 값이 없으면 있던 값 유지)
- [x] 테스트(engine 단위 · PostGIS), contracts/p3 v0.11 · database 문서
- [x] `pnpm backend:test` (V0038 을 실제 PostGIS 에 적용, Docker)

## 진행
- 2026-11-03: 시작. AGENTS 「LLM 판정 결과는 규칙 판정과 구분해 표시」 · contracts/p3 「아직 없는 것 — 만든 판 칸」. `region-extract` 결과에는 이미 `prompt_version` · `summary_version` · `model` 이 있다(!103)
- 2026-11-03: 결정 — 기존 3,478건은 마이그레이션에서 채우지 않는다(null). 운영 DB 에 다른 경로로 들어간 행이 있을 수 있어서. 개발 DB 의 기존 행이 모두 lab 적재(p9.1 · s1 · Qwen2.5-32B-Instruct-AWQ)라는 것은 계약 문서에만 적는다
- 2026-11-03: `pnpm check` 통과 — backend 포맷 · 테스트(V0037 적용 — 뒤에 번호 겹침 발견, V0038 로 바꿈), engine 518개. `tests_postgres/test_region_store.py` 6개 통과

## 다음 할 일 / 범위 밖
- 화면 · C2 응답에 판을 내보낼지(`articles[]` 에 칸 추가는 동결 뒤라 양쪽 리뷰 필요) — 지금은 DB 에만
- 2026-11-03: 병합 뒤 develop CI 실패 — 같은 시각 병합된 S15P31C108-216 의 `V0037__create_admin_reviews.sql` 과 번호가 겹쳐 Flyway 가 시작하지 못함(dev DB 에는 admin_reviews 쪽이 V0037 로 들어감). 내 것을 V0038 로 바꾼다(dev · 운영 어디에도 적용 전이라 안전). 다음부터 마이그레이션 MR 은 병합 직전에 develop 의 최신 번호를 다시 확인
