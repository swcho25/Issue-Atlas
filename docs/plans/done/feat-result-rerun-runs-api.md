# feat/result-rerun-runs-api — 결과 04 「다시 실행」을 회차 다시 실행 API 로

- Jira: S15P31C108-305 · PRD: — · 묶음/단위: 04 지도 부품(유리 아이콘 후속)

## 완료 조건
- [x] 결과 04 「다시 실행」이 `POST /v1/questions/{question_id}/runs` 로 같은 질문의 새 회차를 만들고 새 결과로 간다
- [x] 남이 물은 질문(404)이면 지금처럼 `POST /v1/questions` 로 새 질문을 만들어 실행한다
- [x] 내 질문 화면과 같은 함수를 쓴다(두 화면이 쓰므로 `features/rerun-question`)
- [x] 401 → 랜딩, 429 · 실패 → 알림은 그대로

## 진행
- 2026-11-08: 시작. 계약 c2 README: `POST /v1/questions/{question_id}/runs`(로그인 필요) — 같은 지역 · 카드 · 기간으로 같은 질문의 새 실행, 응답은 `question-create-response`(같은 question_id · 새 run_id), 없는 질문 · 남이 물은 질문은 404.
  내 질문 화면(-295)이 `pages/my-questions/api/queries.ts` 의 `rerunQuestion` 으로 이미 쓴다. 목 서버는 예시 질문(q_0001 = C1 여수)의 새 회차를 dev 없이 만든다
- 2026-11-08: `features/rerun-question`(내 질문 · 결과 함께), 결과 `api/rerun.ts` 의 `rerunResult` = 회차 API, 404 면 `POST /v1/questions`. 401 · 429 · 실패는 새 질문으로 돌리지 않음. 내 질문 화면은 import 한 줄만(steiger 가 re-export 를 참조로 안 셈).
  브라우저(로그인 뒤, 목 서버): C1 여수 결과 다시 실행 → 목 서버 `POST /v1/questions/q_0001/runs` → `/results/run_mock_…` 로 이동(dev 로 가는 `POST /v1/questions` 없음), 내 질문 화면에 같은 질문 「3회 · 11-08」 · 「2회차 → 3회차」 비교.
  `pnpm check` 통과(다시 실행 테스트 5개)
- 2026-11-08: 마무리. Jira S15P31C108-305. `pnpm check:all` 9개 통과(처음엔 Docker 가 꺼져 backend build 만 실패 → 켜고 다시)

## 다음 할 일 / 범위 밖
- 404 로 새 질문이 되는 경로는 MSW 테스트로만(목 서버 · dev 에서 남의 질문을 만들 수 없음)
