# feat/p2-refine-value-checks — P2 정제 값 모양 검사 (C1 스키마 기반)

- Jira: S15P31C108-74 (에픽 S15P31C108-50) · PRD: FR-E3 · FR-E5 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] 입력 레코드를 `contracts/c1/record.schema.json` 으로 검사해, 어긋난 칸마다 held + `INVALID_VALUE`(field) 가 붙는다
- [x] 기간 종류 'X' · 저장 범위 'everything' · 숫자 자리에 글자 · 수집 시각 '어제' · 값과 결측 사유 둘 다 없음 → held 로 나온다
- [x] `contracts/c1/examples` 5개와 P1 실샘플(content_hash 채운 것)은 pass 로 나온다
- [x] 허용값을 P2 코드에 따로 적지 않는다 — 스키마의 enum 을 바꾸면 P2 결과가 코드 수정 없이 따라 바뀐다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-21: 시작
- 2026-10-21: 기준 브랜치는 `origin/develop` 이 아니라 `feat/p2-refine-skeleton`(65b24c9). develop 에 `pipeline/refine/` 이 아직 없어서. 뼈대 MR(S15P31C108-66)이 develop 에 머지되면 이 브랜치에 develop 을 받는다 (병합 방식이 Merge commit 이라 새 MR 에는 이 작업만 보임)
- 2026-10-21: 허용값을 P2 에 따로 적지 않고 장성우의 C1 스키마(S15P31C108-68, `contracts/c1/record.schema.json` — 필드 30개 · enum · 조건 규칙 4개)를 읽어 검사하기로 함. 같은 규칙이 두 곳에 생기지 않게
- 2026-10-21: **막힘** — `feat/c1-contract` 가 아직 push 전(로컬 미커밋). push 되면 구현 시작
- 2026-10-22: 막힘 풀림 — `feat/c1-contract`(6d42cc7, MR !11) push 됨. 스키마로 미리 확인(jsonschema + FormatChecker, 커밋 안 한 실험): 계약 예시 5개 C1 통과 · P2 해시 null → held, 해시 채움 → pass. 어제 놓친 불량 5종은 스키마가 전부 잡음. 못 잡는 것: 결측을 0 · PM2.5 음수(탭 10 필요) · 아무 문자열 해시(pattern 없음)
- 2026-10-22: MR !11 에 P2 리뷰 의견 초안 작성 (content_hash null 정책 · P2 출력 스키마 · dedup_key 설명 · 측정소 메타 경로). 올리는 건 박준우
- 2026-10-22: **결정(박준우)** — content_hash 는 A안: C1 동결 때 null 불가로 바꾸자고 제안, P2 는 해시 없으면 held 유지(MISSING_REQUIRED). 제안 방식은 원천 한 줄을 키 정렬 JSON 의 SHA-256 → `sha256:<64자리>`. 확인값 KOSIS 2023 행 = `sha256:14b2009a…62a79`
- 2026-10-22: `origin/feat/c1-contract` 를 merge 로 받음(b8a8285, 충돌 없음). 남이 push 한 브랜치라 rebase 하지 않음. MR !11 이 develop 에 먼저 들어가면 이 MR 에는 P2 작업만 보임
- 2026-10-22: 테스트 데이터를 노션 사본에서 `contracts/c1/examples` 5개로 교체(47630f4). 노션 사본 에어코리아 3건은 C1 v0.1 필수 키(`content_hash`·`published_at`)가 없었음
- 2026-10-22: `schema.py` — jsonschema 4.26(Draft 2020-12) + rfc3339-validator(date-time 형식 검사용). 스키마 오류를 P2 사유로 옮김: 칸 값 틀림 → `INVALID_VALUE`(최상위 칸), 키 없음 → `MISSING_REQUIRED`, C1 에 없는 칸 → `UNKNOWN_FIELD`, 여러 칸 묶음 규칙(raw_url\|file_name · value\|missing_reason) → 다 비었으면 `MISSING_REQUIRED` 아니면 `INVALID_VALUE`. 순서는 P2 규칙 먼저, 스키마 결과는 (code, field) 정렬, P2 규칙이 이미 잡은 사유는 빼서 한 번만. TDD: 새 테스트 13건이 빈 구현에서 실패하는 것 확인 뒤 구현. 변형 4가지(형식 검사 끄기 · 묶음 규칙 코드 뒤집기 · 중복 제거 빼기 · UNKNOWN_FIELD 빼기) 모두 테스트가 잡음. pytest 79건, `pnpm check` PASS
- 2026-10-22: Jira 댓글은 Atlassian MCP 재인증이 필요해 남기지 못함

## 다음 할 일 / 범위 밖
- MR !11 리뷰 반영 확인: 성우님이 `content_hash` 를 null 불가 · pattern 으로 바꾸면 이 브랜치에 다시 받고, 계약 예시에 진짜 해시가 들어오면 "해시 null → held" 테스트를 다른 방법(해시 지우기)으로 바꿔야 함
- P2 출력 스키마(정제 레코드 = C1 + `validation_status` · `issues` · `rule_version`)를 contracts 에 올리기 — MR !11 리뷰에서 약속함. P3 가 입력 검증에 씀
- engine 을 따로 배포(Docker 등)할 때 `contracts/c1/record.schema.json` 도 같이 넣어야 함 (지금은 레포 루트에서 읽음)
- 범위 밖: 지표별 값 범위(탭 10 필요), 탭 3 에 없는 source_id, daum.net 금지 여부, 측정소 메타 레코드 경로(P3 결정)
