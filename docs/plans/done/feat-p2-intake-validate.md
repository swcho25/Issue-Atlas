# feat/p2-intake-validate — 수집기 입구 검사 함수 공개와 원문 추적 기준 명시

- Jira: S15P31C108-89 (에픽 S15P31C108-50) · PRD: FR-E3 · 7.5 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] pipeline.refine 에서 validate 를 공개하고, 필수 칸 · 금지 소스 · URL 속 키 · C1 형식만 보며 이용허락·저장 범위·중복은 보지 않는다는 것을 docstring 과 테스트로 남긴다
- [x] contracts/p2/README.md 에 run_id(마지막 확인 실행) · content_hash(원본 찾기) 기준과 수집기 입구 검사 권장을 적고 변경 이력을 남긴다
- [x] 수집기 코드(pipeline/collect/)는 바꾸지 않는다. 수집기 수정 요청은 MR 본문 「장성우 님께 요청」에 적는다
- [x] pnpm check 통과

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-23: 시작. 기준 `origin/develop`(d09b8af, KOSIS·에어코리아 수집기 머지 뒤). 수집기 리뷰에서 `collect/run.py:53`·`airkorea_cli.py:40` 이 P2 정제 결과가 pass 가 아니면(fixed 포함) 원본도 저장하지 않는 것을 발견
- 2026-10-23: **결정(박준우)** — 처음엔 수집기까지 고쳤다가(S15P31C108-89 첫 범위) 전부 되돌림. 수집기(`pipeline/collect/`, 담당 장성우)는 건드리지 않고 P2 쪽만 고치며, 수집기 수정은 MR 본문으로 요청한다. Jira -89 를 이 범위로 줄여 다시 씀
- 2026-10-23: 금지 소스 보류 레코드의 값 지우기는 목적이 달라(MR 하나에 목적 하나) 이번에 빼고, 처리 방식(값만 지울지·링크만 남길지)을 정한 뒤 따로 함
- 2026-10-23: TDD — `tests/test_refine_intake.py` 7건(입구 검사가 이용허락 모름·범위 좁아짐·dedup 충돌은 막지 않음 3건, 금지 소스·URL 키·C1 형식·해시 없음은 잡음 4건)을 먼저 씀. 지금 코드에서 7건 모두 실패 — `from pipeline.refine import validate` 가 함수가 아니라 **모듈**을 돌려줘서(`'module' object is not callable`). 수집기에서 이 이름으로 쓰려 해도 같은 오류가 났을 것
- 2026-10-23: 고침 — `pipeline/refine/__init__.py` 에 `validate` 함수 공개, docstring 에 입구 검사 용도와 보지 않는 것. P2 계약 README 에 run_id·content_hash 기준 한 줄과 「수집기 입구 검사」 절, 변경 이력 v0.1.2(문구만, 스키마·정제 동작 그대로). `pipeline/collect/` 는 바꾸지 않음
- 2026-10-23: 변형 3가지 모두 테스트가 잡음 — 공개 빼기 · 입구 검사에 저장 범위 판정 넣기 · 금지 소스 검사 빼기. `pnpm check` PASS — engine lint 0.4s · test 4.5s (pytest 220건)
- 2026-10-23: finish — `pnpm check:all` 은 harness PASS 뒤 backend format 에서 멈춤 (개발 PC 에 Java 없음). 이 브랜치는 backend/·frontend/ 를 바꾸지 않음. 나머지는 하나씩 돌려 PASS — frontend lint 52s · typecheck 16s · test 25s(9건) · e2e 27s(1건), engine lint 1s · test 5s(220건). backend format·build 는 미실행. 커밋 baaf53e

## 다음 할 일 / 범위 밖
- MR 리뷰어: 장성우(수집기 요청 대상) · 정우현(P3) · 최동준(P4) — P2 계약 문구가 바뀜
- 범위 밖: 금지 소스(FORBIDDEN_SOURCE) held 레코드에 값이 남는 문제
- 범위 밖(다음 큰 P2 작업): 정제 결과 저장 테이블 + raw_record 연결, dedup_key upsert 로 마지막 확인 유지
