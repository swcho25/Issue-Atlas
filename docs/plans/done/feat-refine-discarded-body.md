# feat/refine-discarded-body — 요약 뒤 본문을 지운 기사가 정제를 통과한다

- Jira: S15P31C108-189 · PRD: FR-E3 · 묶음/단위: P2

## 완료 조건
- [x] 본문을 받았다가 지운 기사(`fetch.status = ok` · 본문 null · `storage_scope = metadata`)는 정제를 통과해 `normalized_ready` 에 남는다
- [x] 본문을 못 받은 기사(`fetch.status` ≠ ok)는 지금처럼 BODY_MISSING 보류
- [x] 같은 기사의 판 중 본문을 받았던 판(지운 판 포함)이 못 받은 판보다 먼저다
- [x] 기사 계약 · P2 계약에 폐기한 기사 모양을 적는다

## 진행
- 2026-11-02: 시작. 대표 결정(11/1) 본문 폐기는 P3(정우현)가 요약이 제대로 생긴 기사만 한다. 정제는 「기사인데 본문 없으면 보류」라 지운 기사가 다음 정제 때 모두 빠진다. 본문 못 받은 기사는 쓰지 않기로 해 개발 서버 1,263건 삭제(백업 `/home/ubuntu/backup/bodyless-news-*-20261102.csv.gz`)
- 2026-11-02: `had_body`(본문 있음 또는 fetch.status ok) 로 BODY_MISSING · 판 순서를 바꿈. C1 스키마 변경 없음 — 지운 기사는 `metadata` + `fetch.status ok` + body null. `rule_version` `p2-0.7.0`. 기사 계약 v0.3 「본문 지우기」, P2 v0.9, AI 입력 v0.1.1

## 다음 할 일 / 범위 밖
- P3(정우현): 원본 장부에서 본문 지우기 실행, 다시 돌릴 때 요약 덮어쓰기 금지, 본문 첫 문장을 그대로 옮긴 요약 14건
- 다시 수집하면 본문 못 받은 기사가 장부에 다시 들어온다 — 수집기(P1, 장성우) 저장 규칙
- `press_release` 표(V0010) 지우는 마이그레이션
