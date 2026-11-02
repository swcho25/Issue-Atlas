# feat/press-release-refine — 보도자료를 원본 장부와 정제로 연결

- Jira: S15P31C108-172 · PRD: FR-E1 · 7.5 · 묶음/단위: P2-3

## 완료 조건
- [x] 보도자료 수집기가 C1 문서 레코드(kind press_release)를 raw_record · job_run 에 남긴다 (`test_press_store`)
- [x] P2 정제가 보도자료를 통과시키고 이용허락별 저장 범위를 적용한다 (KOGL-4 → metadata)
- [x] 같은 글을 다시 받으면 판이 쌓이고 정제가 최신본만 남긴다

## 진행
- 2026-11-02: 시작. C1 문서 `kind` 에 `press_release` 가 이미 있고 정제는 문서를 일반 처리 — 수집기를 공용 `PostgresStore`(source · source_spec · job_run · raw_record)에 붙이는 일
- 2026-11-02: 게시판마다 출처 · 수집 명세(`press_yeosu` / `press_release_yeosu`, `press_gwangju` / `press_release_gwangju`) — 이용허락이 달라서. `raw_url` 은 쪽 번호 없는 게시판 주소(쪽이 밀려도 같은 원본)
- 2026-11-02: 이용허락 표에 `KOGL-미표시` → `metadata` 추가(광주광역시, 담당자 협의 전). `rule_version` `p2-0.6.0`, P2 계약 v0.8
- 2026-11-02: `press_release` 표(V0010)는 채우지 않는다. 지우는 마이그레이션은 서버 재수집 확인 뒤 — 지금 지우면 서버의 기존 목록이 사라진다
- 2026-11-02: 검사 — `pnpm check` engine lint · test 440, tests_postgres 43 전부 통과(`test_press_store` · `test_refine_all_collectors` 포함). DB · backend 변경 없음

## 다음 할 일 / 범위 밖
- 개발 서버: `sudo issueatlas-collect press --site yeosu --db` · `--site gwangju --db` → `refine --db` 로 다시 받고, 확인 뒤 `press_release` 를 지우는 마이그레이션
- AI 입력 계약(contracts/ai): 보도자료의 `content_hash` · `refine_rule_version` · `source_id` 가 null 이라는 설명과 `doc-press-metadata` 예시를 새 경로에 맞게(최동준 · 정우현 리뷰)
- 공공누리 1유형 보도자료 본문 저장(2026-11-01 결정에서 허용)은 범위 밖 — 두 게시판 모두 1유형이 아니다
