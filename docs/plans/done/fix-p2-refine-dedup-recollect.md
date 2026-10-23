# fix/p2-refine-dedup-recollect — P2 정제 재수집 레코드 중복 판정 수정

- Jira: S15P31C108-88 (에픽 S15P31C108-50) · PRD: FR-E2 · 7.1 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] 같은 dedup_key 에서 수집 실행 칸(collected_at · run_id · collector_version)만 다른 레코드는 반복으로 보고 하나만 내보낸다. 마지막으로 확인한 것(collected_at 이 가장 늦은 것, 같으면 run_id 가 큰 것)을 남기고, 입력 순서를 바꿔도 결과가 같다
- [x] 그 밖의 칸(value · missing_reason · content_hash 등)이 다르면 지금처럼 둘 다 held + DEDUP_KEY_CONFLICT
- [x] 뺄 칸 목록은 한 곳에만 두고, contracts/p2/README.md 의 DEDUP_KEY_CONFLICT 설명도 맞춘다
- [x] 재수집 · 값 다름 · 입력 순서 바꿈 세 경우의 테스트를 먼저 써서 지금 코드에서 실패하는 것을 확인한 뒤 고친다
- [x] pnpm check 통과

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-23: 시작. 기준 `origin/develop`(dbcd94c). Notion 「데이터」 대조에서 발견 — `split_repeats` 가 dict 전체를 비교해, 같은 값을 다른 실행에서 다시 받은 레코드가 한 묶음에 오면 둘 다 held + `DEDUP_KEY_CONFLICT`, is_latest 도 없음. Notion 의 dedup_key 설명("재수집해도 한 번만 반영")과 어긋남
- 2026-10-23: **결정(박준우)** — 남기는 것은 마지막으로 확인한 레코드. 값이 안 바뀐 재수집이면 "언제까지 수정이 없었는지"가 근거의 신빙성이라서. 원천 공표 시각(published_at)과 우리가 확인한 시각(collected_at)은 화면에서 나눠 보여 줘야 함
- 2026-10-23: Jira S15P31C108-88 생성 (같은 일 이슈 없음, 에픽 -50, 스프린트 2, SP 1, `진행 중`). 브랜치를 만드는 첫 `git fetch` 가 GitLab 응답 대기로 2분 넘게 멈춰 중단하고 다시 받음(dbcd94c 그대로). 브랜치가 origin/develop 을 upstream 으로 잡아서 풀어 둠(push 때 자기 이름으로)
- 2026-10-23: TDD — `test_refine_batch.py` 에 재수집 · 입력 순서 · 수집 시각 같으면 run_id · 다른 칸 바뀜(value · content_hash · missing_reason) 테스트를 먼저 씀. 재수집 3건은 지금 코드에서 실패(둘 다 held), 다른 칸 바뀜 3건은 지금도 통과 — 이미 맞는 동작을 지키는 테스트라서
- 2026-10-23: `dedup.py` — 수집 실행 칸 목록 `RUN_FIELDS` 를 한 곳에 두고, 그 칸을 뺀 dict 로 비교(== 그대로라 -747 과 -747.0 은 전처럼 같은 내용). 같은 내용끼리는 (collected_at, run_id, collector_version) 가 가장 큰 것 하나, 출력 위치는 그 레코드의 입력 자리. 결정: 검증 전에 고르므로 collected_at 을 못 읽거나 시간대가 없으면 읽을 수 있는 쪽이 이김(멈추지 않게, 테스트 3건 추가). 같은 객체가 두 번 와도 한 번만(전 코드와 같음, 테스트 1건 추가). `contracts/p2/README.md` DEDUP_KEY_CONFLICT 설명 · 변경 이력 v0.1.1(스키마 그대로)
- 2026-10-23: 변형 7가지 모두 테스트가 잡음 — 칸 목록에 value 넣기 · 가장 이른 것 남기기 · run_id 로 안 가르기 · 먼저 온 것 남기기 · 같은 객체 두 번 · 시간대 검사 빼기 · 예외 처리 빼기. `pnpm check` PASS — engine lint 0.6s · test 5.4s (pytest 141건)
- 2026-10-23: finish — `pnpm check:all` 은 harness PASS 뒤 backend format 에서 멈춤 (개발 PC 에 Java 없음). 이 브랜치는 backend/·frontend/ 를 바꾸지 않음. 나머지는 하나씩 돌려 PASS — frontend lint 71s · typecheck 23s · test 32s(9건) · e2e 36s(1건), engine lint 1s · test 6s(141건). backend format·build 는 미실행. 커밋 27ae5ed

## 다음 할 일 / 범위 밖
- MR 에 받는 쪽 정우현(P3) · 최동준(P4) 리뷰 요청 — P2 계약(`contracts/p2/`) 동작이 바뀜(스키마는 그대로)
- 범위 밖: 묶음을 넘는 중복 — 정제 결과 저장 테이블의 dedup_key 고유 제약 / upsert (raw_record 연결 때). 값이 같으면 collected_at · run_id · collector_version 을 새 값으로 바꿔 이번 결정(마지막 확인)을 묶음 밖에서도 유지
- 범위 밖: 에어코리아 dedup_key 에 판 구분이 없어 값이 고쳐지면 충돌이 되는 문제 (P1 과 키 규칙 합의)
- 범위 밖: 금지 소스(FORBIDDEN_SOURCE) held 레코드에 값이 남는 문제
