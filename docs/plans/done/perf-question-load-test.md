# perf/question-load-test — 문장화 트랜잭션 분리 전·후 부하 시험 수치 남기기

- Jira: S15P31C108-260 · 앞 작업: S15P31C108-254 (MR !163) · 묶음/단위: P4

## 완료 조건
- [x] `backend/loadtest/` 에 k6 시나리오 · 가짜 engine(지연 조절) · 실행 방법이 있다
- [x] 고치기 전(bf718ab^)과 후를 같은 조건에서 재서 질문 처리량 · 응답 시간(p50 · p95) · 다른 API 응답 시간 · 커넥션 풀 대기 수를 표와 그래프로 `docs/` 에 남겼다
- [x] corepack pnpm check 통과

## 진행
- 2026-11-05: 시작. 캐시는 별도 이슈 S15P31C108-261 · 브랜치 perf/phrasing-cache 로 나눔
- 2026-11-05: k6(grafana/k6:1.3.0, Docker) · 가짜 engine(13초) · 시험용 PostGIS(:55432)로 544bc68 ↔ bf718ab 비교.
  처리량 44.3 → 140.0건/분, 조회 p95 29.7초 → 14ms, 조회 실패 327/506 → 0, 풀 대기 최대 163 → 21(시작 1초 한 번).
  처음엔 고친 뒤를 develop 으로 쟀으나 다른 변경(보도자료 근거 조회)이 섞여 bf718ab 로 다시 잼
- 2026-11-05: pnpm check · check:all 통과, loadtest Python 은 engine ruff 로 검사

## 다음 할 일 / 범위 밖
- 같은 질문 문장화 캐시: S15P31C108-261 (perf/phrasing-cache)
- 고친 뒤 다음 병목은 engine · 모델 API 동시 처리 한도. 실제 engine 으로 재는 것은 범위 밖
