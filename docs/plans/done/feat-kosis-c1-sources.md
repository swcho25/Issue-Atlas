# feat/kosis-c1-sources — KOSIS 수집 범위를 카드 C1 소스(SP01·SP02·SP10)로 확장

- Jira: S15P31C108-110 · PRD: v4.0 카드 C1 · SP01·SP02·SP10 · 묶음/단위: P1
- 기준: origin/develop ba5a380, 2026-10-27

## 완료 조건
- [x] `--spec-id SP01|SP02|SP10` 으로 세 표를 받는다: SP01 DT_1B26001 월별 순이동(계·19–34·19–39), SP02 DT_1B26003_A02 월별 전출지→전입지(시도) 이동자, SP10 DT_1B04006 연별 1세별 인구(계·19–39세)
- [x] 사양(source_spec.params)에는 표 정의만, 기간·지역은 job_run.stats 에 남겨 기간을 바꿔도 `SPEC_CONTRACT_MISMATCH` 가 나지 않는다
- [x] 세 표의 C1 출력이 P2 에서 모두 pass 한다(합성 응답 테스트 + 실제 API)
- [x] 실제 API로 로컬 DB에 2023–2025 를 넣고 `refine --db` 까지 통과한다
- [x] engine lint·test, tests_postgres 통과

## 진행
- 2026-10-27: 시작. KOSIS 메타 확인 — DT_1B26001(A 지역·SBB 성별·YRE 연령, 901=19–34·905=19–39), DT_1B26003_A02(B 전출지·C 전입지·SBB 성별, 시도 코드 51·52 는 새 코드만 있음), DT_1B04006(A 지역·YRE 1세별 0401…440). `+` 로 여러 코드 한 번에 요청 가능 확인.
- 결정: 사양(source_spec.params)에서 기간·지역을 빼고 job_run.stats 로 옮김(에어코리아와 같은 방식). 기존 SP01(연·20–24세)은 정의가 달라 로컬에서 지우고 다시 받음. 99(국외)는 2023–2025 모두 0 이라 SP02 에서 제외.
- 실제 API export-only: SP01 648 · SP02 3,888 · SP10 396건, P2 전부 pass. 2023 여수 19–34세 순이동 합 −1,438명.
- 로컬 DB: 세 사양 적재(재실행 시 SP02 inserted 0 · duplicates 3,888), `refine --db` 204,538건 전부 pass(5분 42초, -111 묶음 정제).
- engine lint · pytest, tests_postgres 24건 통과.

## 다음 할 일 / 범위 밖
- 개발 서버 DB: 예전 SP01 이 있으면 지우고 세 사양을 다시 넣는다(`issueatlas-collect kosis --spec-id SP01|SP02|SP10`). 조석원 README 예시는 `--spec-id SP01` 그대로 동작
- 진행 중인 해(2026 1–8월) 월 자료: 지금은 연 단위 기간만 받는다. 필요하면 시작·끝 월 인자 추가
- P3: SP02 의 전입지(locator.C2, 시도 코드)와 SP10 연령 코드(locator.C2) 해석, 청년 비율 = SP01 ÷ SP10
