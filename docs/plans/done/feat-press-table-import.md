# feat/press-table-import — 광주 보도자료를 옛 표에서 원본 장부로 옮긴다

- Jira: S15P31C108-187 · PRD: FR-E1 · 7.5 · 묶음/단위: P2

## 완료 조건
- [x] `press --site gwangju --db --from-table` 이 옛 표(`press_release`, V0010) 행을 수집과 같은 C1 문서 레코드로 `raw_record` 에 넣고, `job_run` 에 `imported_from: press_release` 를 남긴다
- [x] 수집 시각은 옛 행의 `collected_at` 그대로, 원본 지문(`content_hash`)은 같은 글을 다시 수집했을 때와 같다
- [ ] 개발 서버에서 광주 6,852건이 (머지 · 수집기 이미지 배포 뒤) `raw_record` · `normalized_ready` 에 들어간다

## 진행
- 2026-11-02: 시작. -172 재수집에서 광주 누리집이 서버 · 개인 PC 모두 400 「Request Blocked」(브라우저로는 열림, 게시판은 2026-06-30 에 멈춤). 브라우저인 척 우회하지 않고 10/30 에 받은 옛 표를 옮긴다
- 2026-11-02: `--from-table` 추가 — 옛 표 → collect_pages 와 같은 쪽 묶음 → 같은 C1 · 저장 경로, `job_run.stats.imported_from`. 옮길 행 없으면 `PRESS_NO_ROWS`. 보도자료 계약 v0.3, 서버 실행 명령. engine 454 · tests_postgres 47 통과

## 다음 할 일 / 범위 밖
- 머지 뒤 서버: `sudo issueatlas-collect press --site gwangju --db --from-table` → `refine`, raw · ready 6,852건 확인
- 두 게시판 건수 확인 뒤 `press_release` 표(V0010) 지우는 마이그레이션
- 광주 누리집 차단이 계속되면 담당자 문의
