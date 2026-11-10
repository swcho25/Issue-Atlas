# fix/youth-policy-revision-key — 온통청년 정책 수정본을 P2 에서 판으로

- Jira: S15P31C108-154 · PRD: FR-H1 · 묶음/단위: P1 (수집 파이프라인 S15P31C108-49)

## 완료 조건
- [x] 원본과 수정본을 함께 정제하면 둘 다 pass, 수정본만 is_latest=true 다 (engine 테스트)
- [x] 원본 수집 → 수정본 수집 → 정제 저장 뒤 normalized_ready 에 수정본 한 행만 남는다 (Postgres 통합 테스트)
- [x] 같은 내용 재수집 · 키워드 순서만 바뀐 응답은 여전히 같은 원본 · 같은 dedup_key 다
- [x] 개발 DB 의 기존 온통청년 원본 유무와 키 전환 영향을 MR 에 적는다

## 진행
- 2026-10-30: 시작. 재현 — `policy("A")` 와 `plcyExplnCn` 만 바꾼 수정본을 `to_record` → `refine_records` 하면 둘 다 held · `DEDUP_KEY_CONFLICT`. 수집기가 내용이 바뀌어도 같은 dedup_key(`youthcenter:<plcyNo>:<zipCd>`)를 만들기 때문
- 2026-10-30: 결정 — P2 규칙은 그대로 두고 수집기에서 판을 구분한다(KOSIS `LST_CHN_DE` · 빅카인즈 fetch 상태 · 에어코리아 `:provisional` 과 같은 관례). dedup_key 에 내용 지문(content_hash 의 sha256 앞 12자리)을 붙이고 locator `{plcyNo, zipCd}` 는 그대로 → obs_key 가 같아 P2 `mark_latest` 가 늦게 받은 판을 최신으로. 지문은 조회수 · 키워드 순서를 뺀 content_hash 와 같은 재료라 재수집 · 순서만 바뀐 응답은 같은 키. collector_version `youthcenter-0.2.0`
- 2026-10-30: 수정 전 코드로 되돌려 Postgres 통합 테스트를 돌리면 `{'held': 2}`, 수정 뒤 `{'pass': 2}` 확인
- 2026-10-30: 개발 DB — 수집 배포 설정(deploy · scripts · CI)에 온통청년 실행이 없고, 수집기 계획(feat-youth-policy-collector)에도 「서버 실행에 넣는 일」이 남아 있어 EC2 개발 DB 에는 온통청년 원본이 없을 것으로 본다. 이 세션에서 서버 DB 를 직접 조회하지는 못했다(확인 SQL 은 MR 본문). 장성우 로컬 DB 에는 0.1.0 키로 5,633행이 있다
- 2026-10-30: `pnpm check:all` PASS (harness · backend format · frontend lint · typecheck · test 12 · e2e 2 · backend build · engine lint · test 366). `tests_postgres` 온통청년 · 정제 저장 14건 PASS

## 다음 할 일 / 범위 밖
- 장성우(P1) 리뷰로 방향 확정. P2 쪽에서 처리하자는 결론이면 `dedup.py` · `contracts/p2/README.md` 사유 코드 표 · rule_version 을 고치는 쪽으로 바꾼다
- 0.1.0 키로 이미 저장된 원본: 장부(`c1_record`)는 다시 받아도 갱신되지 않아 옛 키가 남는다. 옛 키는 (정책, 지역)마다 하나라 새 판과 충돌하지 않고 obs_key 로 묶인다. 단 옛 키로 이미 두 판 이상 저장된 (정책, 지역)은 계속 충돌로 보류되니, 그런 행이 있으면 지우고 다시 받거나 장부 키를 고친다
