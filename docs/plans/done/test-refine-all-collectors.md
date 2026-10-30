# test/refine-all-collectors — 수집기 전체를 한 DB 에서 정제 · 원본만 다른 재수집

- Jira: S15P31C108-155 · PRD: FR-E3 · 묶음/단위: P2 (정제 S15P31C108-50)

## 완료 조건
- [x] 수집기 5종을 한 DB 에 받아 refine_raw 하면 본문 없는 기사(BODY_MISSING, 의도된 규칙)만 보류되고 나머지는 모두 pass 다
- [x] normalized_ready 에 출처마다 기대한 행 수가 있고, 에어코리아 확정 시간값은 air_monthly 에만 들어간다
- [x] 같은 원천을 다시 받으면 새 원본이 없고, 다시 정제해도 바뀌는 행이 없다
- [x] 장부 밖 칸만 바뀐 재수집(KOSIS 이름표 · 측정소 측정 항목)은 보류되지 않고 늦게 받은 사본이 normalized_ready 에 남는다

## 진행
- 2026-10-30: 시작(박준우 요청 「구현된 수집기들 정제 다 잘 되게」). P2 로 들어오는 수집기는 KOSIS · 에어코리아 측정소 · 확정 · 빅카인즈 · 온통청년. 지방재정365 · 보도자료는 전용 표라 P2 밖
- 2026-10-30: `tests_postgres/test_refine_all_collectors.py` — 다섯 수집기를 각자 테스트 가짜 응답으로 한 스키마에 받아 refine_raw. 원본 28 → pass 27 · held 1(기사 b BODY_MISSING), ready S01 3 · 측정소 2 · 기사 1 · 정책 3, air_monthly 채워짐 · 못 넣은 시간 0. 다시 받기 → 새 원본 0, 다시 정제 → 0 · 0 · 10 unchanged, 행 그대로. 처음부터 통과(코드 수정 없음)
- 2026-10-30: 원천이 바뀌는 재수집을 수집기마다 따져 봄
  - KOSIS 값 수정(LST_CHN_DE 바뀜) · 에어코리아 잠정 → 확정 · 빅카인즈 실패 → 성공: 기존 테스트대로 새 판이 최신
  - 온통청년 내용 수정: 같은 dedup_key 라 둘 다 held → MR !66(S15P31C108-154)에서 수집기 키에 내용 지문
  - **장부 밖 칸만 바뀐 재수집은 둘 다 held**(임시 테스트로 확인): KOSIS 이름표(`C1_NM` 등)만 바뀜 → `{'held': 2, 'pass': 2}`, 에어코리아 측정소 `item` 만 바뀜 → `{'held': 2}`. 장부 내용은 같고 content_hash 만 다르다
- 2026-10-30: `pnpm check:all` PASS, `tests_postgres` 39건 PASS (통합 테스트 커밋)
- 2026-10-30: 박준우 결정 — content_hash 만 다른 같은 dedup_key 는 충돌이 아니라 같은 판의 사본. 수집기는 손대지 않고 P2 규칙을 고침
  - `split_repeats`: 내용 비교에서 수집 실행 칸과 함께 원본 지문(content_hash)도 뺀다. 원본까지 같으면 지금처럼 반복(마지막 확인 하나), 원본만 다르면 사본으로 모두 남김(원본 한 행 = 정제 한 행). 장부 내용이 다르면 지금처럼 충돌
  - 측정소 메타는 obs_key 가 null 이라 사본 둘이 다 ready 에 갈 뻔했다 → obs_key 를 모든 레코드에 붙임(스키마 「obs_key null ⇔ is_latest null」 그대로 맞음). 사본 중 늦게 받은 것만 is_latest. `_revision_order` 끝에 content_hash 를 더해 입력 순서와 상관없게
  - 정제 저장의 묶음 모으기(refine_part.obs)도 모든 장부에서 같은 관측 칸을 본다(dedup.obs_key 와 같게)
  - `rule_version` `p2-0.5.0`, P2 계약 v0.7. 스키마 · DB 변경 없음
  - 통합 테스트에 KOSIS 이름표 · 측정소 item 만 바뀐 재수집 → pass 30 · held 1, ready 수 그대로, 새 사본이 ready
- 2026-10-30: `pnpm check:all` PASS(engine 374), `tests_postgres` 40건 PASS

## 다음 할 일 / 범위 밖
- 실제 원천 실호출 · 실데이터 정제는 하지 않았다(키 · DB 필요). 이 테스트는 각 수집기 테스트의 가짜 응답을 쓴다
- MR !66 이 들어가면 이 테스트에 온통청년 수정본 경우를 더할 수 있다
- 에어코리아 확정 파일은 한 행의 다른 오염물질 값만 바뀌면 그 행의 나머지 오염물질도 원본 지문이 바뀐다 — 이제 사본으로 처리돼 보류되지 않는다(바뀐 오염물질은 지금처럼 충돌)
