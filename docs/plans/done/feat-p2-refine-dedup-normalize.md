# feat/p2-refine-dedup-normalize — P2 정제 최신본 · 소수점 정리 · 출력 스키마

- Jira: S15P31C108-79 (에픽 S15P31C108-50) · PRD: FR-E2 · 7.1 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] 관측값 레코드에 `obs_key` 가 붙는다. 원천 위치(source_id · spec_id · locator)가 같으면 수정일이 달라도 같은 값
- [x] 같은 `obs_key` 중 보류가 아니고 published_at(없으면 collected_at)이 가장 늦은 레코드 하나만 `is_latest = true`. 이전 판은 지우지 않는다
- [x] 같은 dedup_key · 같은 내용이 다시 들어오면 한 번만 내보내고, 내용이 다르면 둘 다 held + `DEDUP_KEY_CONFLICT`
- [x] 소수점 표현 오차(예: 0.0033000000000000004)를 유효숫자 15자리로 정리한다. 정수 · 보통 값은 그대로
- [x] P2 출력 스키마(`contracts/p2/refined-record.schema.json`)가 있고, 계약 예시를 정제한 결과가 모두 통과한다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-22: 시작. 기준 `origin/develop`(3b55cc7). MR !15 보다 늦게 push 돼 빠졌던 `c0fc917`(값 모양 검사·저장 범위 계획 done 처리)을 첫 커밋으로 옮김(283b3ff)
- 2026-10-22: 박준우 지시 "가능한 것만" — 숫자(관측값) 쪽만. 문서(뉴스·보도자료)·전재 묶기는 C1 에 문서 칸이 없어 범위 밖
- 2026-10-22: `obs_key` 는 dedup_key 문자열을 쪼개지 않고 (source_id, spec_id, locator) 로 만든다. C1 v0.1 예시의 locator 에는 수정일이 없어서, 같은 원천 칸이면 판이 바뀌어도 같은 키가 된다
- 2026-10-22: 소수점 정리(`normalize.py`) — 처음 정한 "유효숫자 12자리"는 13자리 이상인 진짜 값(예: 1234567890123.5)을 깎아서 15자리(double 이 보장하는 자리)로 바꿈. 정수는 건드리지 않음(25 → 25.0 이면 JSON 바이트가 바뀜), value 칸이 없으면 만들지 않음. 표현 오차만 지우는 것이라 사유·fixed 를 붙이지 않음. 변형 3가지(17자리 · 4자리 · 정수도 float) 모두 테스트가 잡음
- 2026-10-22: 중복(`dedup.py`) + `refine_records`(묶음 단위, CLI 도 이걸 씀). obs_key = `obs:` + sha256(source_id·spec_id·locator 정렬 JSON). 최신본은 보류가 아닌 판 중 (published_at 없으면 collected_at, collected_at, dedup_key) 가 가장 큰 것 — 입력 순서와 상관없음. 측정소 메타(indicator_id 없음)는 obs_key · is_latest 둘 다 null. 같은 dedup_key·같은 내용은 처음 것만 내보내고, 내용이 다르면 남기되 둘 다 held + `DEDUP_KEY_CONFLICT`(최신본 후보에서도 빠짐). 결정: is_latest 는 다른 레코드를 봐야 알 수 있어 `refine_record`(1건) 는 붙이지 않고 `refine_records` 만 붙임. TDD: 새 테스트 9건이 빈 구현에서 실패 확인 뒤 구현. 변형 5가지 모두 테스트가 잡음
- 2026-10-22: P2 출력 스키마 `contracts/p2/` (MR !11 리뷰에서 약속). 스키마는 P2 칸 5개만 보고 C1 칸은 C1 스키마로 따로 검사 — C1 이 `additionalProperties: false` 라 한 스키마로 묶을 수 없어서. 상태 규칙(pass ⇒ 사유 없음, fixed ⇒ fix 사유만, held ⇒ fix 아닌 사유 하나 이상, obs_key 와 is_latest 는 함께 null)도 스키마에 넣음. 테스트: 계약 예시 정제 결과 · 사유 코드 9개마다 한 건 · 상태가 어긋난 레코드 거부 · pass/fixed 의 C1 칸이 C1 통과. 변형 3가지(코드 하나 빼기 · pass 규칙 빼기 · obs_key 형식 느슨하게) — 마지막 것을 처음엔 못 잡아서 `obs:1234` 사례를 더함
- 2026-10-22: finish — `pnpm check` PASS (engine lint · test, pytest 130건). 이 브랜치는 engine/ · contracts/ · docs/ 만 바꿈. `check:all` 의 backend format·build(Java 없음 · Docker 꺼짐) · frontend e2e(Playwright chromium 미설치)는 개발 PC 환경 때문에 못 돎. 커밋 메시지에서 Co-Authored-By 줄을 빼기로 함(박준우) — push 전 커밋도 정리

## 다음 할 일 / 범위 밖
- P2 출력 계약(`contracts/p2/`) 받는 쪽 리뷰: 정우현(P3) · 최동준(P4)
- C1 에 문서 칸(제목 · 본문 · 첨부 · 통신사 크레딧 등)을 넣자고 장성우에게 제안 — 문서 처리 · 전재 묶기가 이것에 막혀 있음
- 범위 밖: 문서 레코드(뉴스 제목·링크·발행 시각만, 보도자료 본문 공공누리 1유형만) · 전재 묶기 — C1 에 문서 칸이 생기면
- 범위 밖: 지표별 값 범위(탭 10) · KOGL-2·4 해석 · daum.net 금지 여부
