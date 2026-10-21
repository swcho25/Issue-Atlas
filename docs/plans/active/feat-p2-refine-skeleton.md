# feat/p2-refine-skeleton — P2 정제 파이프라인 뼈대

- Jira: S15P31C108-66 (에픽 S15P31C108-50) · PRD: FR-E3 · FR-E5 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] engine/AGENTS.md 의 (미정) 칸을 채운다 (Python 3.13 · uv · ruff · pytest). `pnpm engine:lint`·`pnpm engine:test` 가 돌고, `pnpm check` 가 engine 변경 시 둘을 돌린다
- [x] P1 「데이터」 실데이터 샘플(KOSIS 순이동 3건 · 에어코리아 확정자료 3건)을 넣으면 레코드마다 `validation_status`(pass/fixed/held)와 `issues` 가 붙어 나온다
- [ ] 필수 필드 누락 · 금지 소스 · URL 속 API 키 실제 값이 있으면 held 와 사유 코드가 붙는다 (지금 KOSIS 샘플은 `content_hash` 가 null 이라 held 가 나와야 한다)
- [ ] P1 이 채운 시간·좌표 칸(`observed_*`, `published_at`, `geometry`)은 값이 바뀌지 않고 그대로 나온다
- [ ] 같은 입력을 두 번 돌리면 출력이 바이트 단위로 같다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-21: 시작
- 2026-10-21: 입력은 P1 C1 초안(장성우, Notion 「데이터」)의 평평한 레코드로 본다. 로컬 P2 초안의 "P2 출력 시점에는 P3 칸 null" 가정은 버린다 (P1 이 시간·측정소 좌표·숫자 변환을 이미 채움)
- 2026-10-21: engine 첫 MR 이라 도구를 이 MR 에서 정한다. Python 3.13 · uv 는 개발 PC 에 이미 있어서, ruff · pytest 는 기본 조합이라 골랐다. MR 설명에 따로 적는다
- 2026-10-21: Jira S15P31C108-66 생성 (같은 일 이슈 없음, 스프린트 2, SP 1, `진행 중`)
- 2026-10-21: engine 도구 설정 (uv 프로젝트, pytest 9.1 · ruff 0.17, `pnpm engine:lint`·`engine:test`, check.mjs engine 영역·`--all` 연결). `pnpm check` PASS — frontend lint 25.6s · typecheck 10.7s · engine lint 0.8s · test 2.6s. 일부러 넣은 린트·테스트 실패가 exit 1 로 잡히는 것도 확인
- 2026-10-21: P1 샘플 6건을 `engine/tests/fixtures/p1/` 로 옮김 (원문이 "같은 모양"·"다른 칸만"인 4건은 기준 레코드에 덮어써 만듦, 출처는 같은 폴더 README). 검증 단계 `validate.py` + `refine_record` 추가: 필수 12칸(P1 초안 ✓) 누락·빈 문자열 → held + `MISSING_REQUIRED`. 실샘플 6건은 모두 `content_hash` 가 없어 held, 해시를 채우면 pass. pytest 25건, `pnpm check` PASS
- 2026-10-21: `issues` 는 코드 문자열 목록이 아니라 `{"code", "field"}` 객체 목록으로 함 (어느 칸이 문제인지 남기려고). 로컬 P2 초안은 코드 목록이었음 → C1 정리 때 맞춤

## 다음 할 일 / 범위 밖
- 완료 조건 3 나머지: 금지 소스 · URL 속 API 키 실제 값 (`<KEY>` 자리표시는 통과) · raw_url/file_name 둘 다 없음
- `fixed` 상태는 아직 만들 규칙이 없음 (정규화 단계에서 소수점 오차 반올림 등이 첫 후보)
- 장성우에게 물을 것: `dedup_key` 이름이 P1(수정일 포함 멱등 키)과 P2(중복 판정 키)에서 뜻이 다름 · KOSIS 샘플 `content_hash` null · C1 레코드에 원본 payload 연결(`raw_record_id`) 없음
- 범위 밖: 전재 묶기, 뉴스·보도자료 문서 처리, 지표 사전(탭 10) 매핑, 측정소정보 레코드(P3 매핑 표 쪽)
- C1 이 `contracts/` 에 JSON Schema 로 들어오면 필드 이름을 그쪽에 맞춘다
- CI(`.gitlab/ci/check.gitlab-ci.yml`)에 engine 잡 추가 — CI 가 아직 꺼져 있고, uv 이미지 태그+digest 를 확인해야 해서 이번에는 뺌
