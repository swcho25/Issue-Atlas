# feat/p2-allow-bigkinds — 정제 금지 소스에서 빅카인즈 제외와 이용허락 항목 추가

- Jira: S15P31C108-106 (에픽 S15P31C108-50) · PRD: 7.5 (노션 결정으로 변경) · FR-E3 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] kinds.or.kr · bigkinds.or.kr 주소 레코드가 FORBIDDEN_SOURCE 로 보류되지 않는다. 네이버 · 카카오 주소는 지금처럼 보류된다 (기존 테스트를 먼저 바꿔 실패 확인)
- [x] 이용허락 표에 "BIGKINDS-이용약관" → 최대 metadata 를 넣는다. 이 license_type 레코드는 LICENSE_UNKNOWN 없이 판정되고, full 로 들어오면 metadata 로 낮아진다
- [x] url.py 주석과 contracts/p2/README.md(FORBIDDEN_SOURCE 설명 · 변경 이력)의 근거를 노션 결정으로 고친다
- [x] pnpm check 통과

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-26: 시작. 기준 `origin/develop`(5886c2b, !26 수집기 입구 검사·장부 저장과 C2 계약 병합 뒤). 팀이 언론 기사는 빅카인즈 API 로 받기로 결정해 노션에 기록(박준우 전달). 노션 검색으로는 결정 페이지를 아직 찾지 못해 근거는 「노션 결정(2026-10-26)」으로 적는다
- 2026-10-26: 배경 — P2 금지 목록(`engine/pipeline/refine/url.py`)에 `kinds.or.kr` · `bigkinds.or.kr` 가 있고, !26 부터 수집기 입구 검사가 이 `validate` 를 써서 빅카인즈 수집기(S15P31C108-101, 장성우)가 원본을 저장하지 못한다. -101 의 「협의 필요」 항목
- 2026-10-26: 결정 — 최대 저장 범위는 metadata. -101 이 원문 본문을 저장하지 않기로 했고(link_only 또는 metadata), 4차 멘토링 기록상 빅카인즈 API 는 요약본만 준다. 이용허락 이름 `BIGKINDS-이용약관` 은 `KOSIS-활용약관` 모양을 따른 제안이고, 수집기가 넣는 값과 같아야 해서 장성우 님과 맞춘다
- 2026-10-27: TDD — `tests/test_refine_url_rules.py` 의 금지 소스 목록에서 빅카인즈 주소 2개를 빼고 「빅카인즈는 금지 아님」 테스트로 옮김, `tests/test_refine_storage.py` 에 `BIGKINDS-이용약관` 테스트 3건(full → metadata 로 낮춤, metadata · link_only 는 그대로 통과). 고치기 전 코드에서 5건 실패(FORBIDDEN_SOURCE · LICENSE_UNKNOWN) 확인 뒤 `url.py` 금지 목록에서 `kinds.or.kr` · `bigkinds.or.kr` 제거, `license_scopes.json` 에 `"BIGKINDS-이용약관": "metadata"` 추가
- 2026-10-27: **결정** — `RULE_VERSION` 을 `p2-0.1.0` → `p2-0.2.0`. 같은 입력의 결과가 바뀌는 규칙 변경이라 「같은 입력 + 같은 판 = 같은 출력」 계약을 지키려면 판을 올려야 한다. 첫 정제 커밋부터 한 번도 안 올렸지만 이제 `normalized_record` 에 결과가 저장되므로 이번부터 올린다. 다음 정제 때 저장된 행은 모두 새 판으로 갱신(refined_at 도 바뀜). 계약 문서 변경 이력 v0.2.1 에 적음
- 2026-10-27: 변형 확인 — 빅카인즈를 다시 금지(2건 실패) · 표에서 항목 빼기(3건 실패) · 최대 범위를 full 로(1건 실패). 되돌린 뒤 diff 로 원래와 같음 확인
- 2026-10-27: 검사 — `pnpm check` PASS (engine lint 0.7s · engine test 10.5s, 235 passed). `tests_postgres` 는 오늘 Docker Desktop 이 꺼져 있어 컨테이너를 못 띄움(이번 변경은 DB 코드를 건드리지 않음)
- 2026-10-27: finish — `pnpm check:all`(이번 명령에만 `JAVA_HOME` = Gradle JDK 21): harness 1.8s · backend format 17.5s · frontend lint 72.8s · typecheck 24.8s · test 35.1s(9) · e2e 36.8s(1) PASS, **backend build 는 Docker 가 꺼져 있어 FAIL 로 멈춤**(Testcontainers 필요, 이 MR 은 backend/ 를 바꾸지 않음). 그 뒤 단계는 따로 돌려 PASS — `pnpm engine:lint` · `pnpm engine:test`(235). 커밋 02b6771

## 다음 할 일 / 범위 밖
- 장성우 님께: 수집기(-101)의 `license_type` 을 `BIGKINDS-이용약관` 으로 맞춰 주기
- 범위 밖: 문서 본문·요약을 저장 범위에 맞춰 지우는 규칙(C1 v0.2, S15P31C108-100 이후) · 네이버·카카오 금지는 그대로
