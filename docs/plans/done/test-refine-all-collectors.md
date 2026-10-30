# test/refine-all-collectors — 수집기 전체를 한 DB 에서 정제

- Jira: S15P31C108-155 · PRD: FR-E3 · 묶음/단위: P2 (정제 S15P31C108-50)

## 완료 조건
- [x] 수집기 5종을 한 DB 에 받아 refine_raw 하면 본문 없는 기사(BODY_MISSING, 의도된 규칙)만 보류되고 나머지는 모두 pass 다
- [x] normalized_ready 에 출처마다 기대한 행 수가 있고, 에어코리아 확정 시간값은 air_monthly 에만 들어간다
- [x] 같은 원천을 다시 받으면 새 원본이 없고, 다시 정제해도 바뀌는 행이 없다

## 진행
- 2026-10-30: 시작(박준우 요청 「구현된 수집기들 정제 다 잘 되게」). P2 로 들어오는 수집기는 KOSIS · 에어코리아 측정소 · 확정 · 빅카인즈 · 온통청년. 지방재정365 · 보도자료는 전용 표라 P2 밖
- 2026-10-30: `tests_postgres/test_refine_all_collectors.py` — 다섯 수집기를 각자 테스트 가짜 응답으로 한 스키마에 받아 refine_raw. 원본 28 → pass 27 · held 1(기사 b BODY_MISSING), ready S01 3 · 측정소 2 · 기사 1 · 정책 3, air_monthly 채워짐 · 못 넣은 시간 0. 다시 받기 → 새 원본 0, 다시 정제 → 0 · 0 · 10 unchanged, 행 그대로. 처음부터 통과(코드 수정 없음)
- 2026-10-30: 원천이 바뀌는 재수집을 수집기마다 따져 봄
  - KOSIS 값 수정(LST_CHN_DE 바뀜) · 에어코리아 잠정 → 확정 · 빅카인즈 실패 → 성공: 기존 테스트대로 새 판이 최신
  - 온통청년 내용 수정: 같은 dedup_key 라 둘 다 held → MR !66(S15P31C108-154)에서 수집기 키에 내용 지문
  - **장부 밖 칸만 바뀐 재수집은 둘 다 held**(임시 테스트로 확인): KOSIS 이름표(`C1_NM` 등)만 바뀜 → `{'held': 2, 'pass': 2}`, 에어코리아 측정소 `item` 만 바뀜 → `{'held': 2}`. 장부 내용은 같고 content_hash 만 다르다. P2 규칙(`test_recollected_with_other_field_changed_is_still_conflict` 의 content_hash 경우)이 일부러 충돌로 보는 것이라 고치지 않고 결정을 받는다
- 2026-10-30: `pnpm check:all` PASS, `tests_postgres` 39건 PASS

## 다음 할 일 / 범위 밖
- (결정 필요 · 박준우) content_hash 만 다른 같은 dedup_key 를 충돌로 둘지. 바꾸면 P2 규칙 · `rule_version` · P2 계약을 고치고, 측정소 메타처럼 obs_key 가 null 인 레코드는 「obs_key null ⇔ is_latest null」 스키마 때문에 최신 고르기 방법도 정해야 한다(P3 · P4 리뷰)
- 실제 원천 실호출 · 실데이터 정제는 하지 않았다(키 · DB 필요). 이 테스트는 각 수집기 테스트의 가짜 응답을 쓴다
- MR !66 이 들어가면 이 테스트에 온통청년 수정본 경우를 더할 수 있다
