# fix/collector-intake-airkorea — 입구 검사·에어코리아 고정 명세·결측 처리

- Jira: S15P31C108-102 · PRD: C1·DB·P2 계약 · 묶음/단위: P1
- 관련: S15P31C108-89 (MR !23), S15P31C108-85, S15P31C108-86

## 완료 조건
- [x] 수집기 저장 전 검사를 pipeline.refine.validate로 바꾸고 이용허락·저장 범위·중복은 저장 뒤 P2가 판단한다.
- [x] spec_id를 고정하고 파일명·기간을 job_run.stats에 기록한다. 하루→월 수집에 DEDUP_KEY_CONFLICT가 없다.
- [x] -999 결측·행 순서 독립 locator·원천 잠정 상태를 반영한다.
- [x] C1·DB 문서의 content_hash 원본 추적 기준을 P2와 맞추고 검증 결과를 기록한다.
- [x] 원본 저장 때 C1 레코드를 raw_record.c1_record(V0005)에 함께 저장하고, P2 refine_raw 가 그 장부를 정제한다(PostGIS 검증).

## 진행
- 2026-10-26: 최신 origin/develop에서 독립 수정 브랜치 시작. MR !23의 P2 수집기 요청을 기준으로 작업한다. C1 문서/빅카인즈 브랜치와 분리했다.

- 2026-10-26: pnpm check 통과(engine lint, pytest 224건). 하루→월·파일명 변경·행 순서 변경의 식별 안정성, -999, 잠정/확정 원천 상태, 저장 전 허용범위, 금지 URL/키 차단을 회귀 검사. PostgreSQL 하루→월 통합 테스트 추가, Docker 데몬 미실행으로 DB 검증 미완료. git diff --check 통과.

- 2026-10-26: origin/develop(28fded1, !23·!25 병합)으로 rebase. 박준우 요청으로 원본 저장 때 장부(c1_record)를 함께 저장. 재수집 때는 비어 있던 장부만 채우고 처음 장부는 덮지 않음(결정: 같은 원본을 다시 받을 때마다 장부가 바뀌면 정제 행 refined_at 이 매번 바뀌어 「같은 입력이면 그대로」가 깨짐).
- 2026-10-26: fix/collector-intake-spec 에서 KOSIS license_type 을 Query 값으로 통일한 수정만 가져옴(그 브랜치는 보관). tests_postgres/test_refine_store.py(박준우)의 「장부 없는 원본」 테스트는 수집기가 장부를 채우게 되어 전제가 바뀌므로, 수집 뒤 장부를 비워 같은 상황을 흉내 내도록 최소 수정. store 테스트 fixture 에 V0005 적용. engine lint PASS, pytest 232건, tests_postgres 20건 PASS(Docker).

## 다음 할 일 / 범위 밖
- P2·P3·P7 계약 리뷰. test_refine_store.py 수정은 박준우 확인 필요.
- 과거 동적 spec_id로 이미 적재한 레코드는 자동 이관·삭제하지 않는다. 과거/신규 C1을 함께 정제하려면 P2와 키 전환 절차 협의가 필요하다.
