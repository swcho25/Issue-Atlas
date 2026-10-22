# feat/p2-refine-storage-scope — P2 정제 값 모양 검사 · 저장 범위 게이트

- Jira: S15P31C108-74 (에픽 S15P31C108-50, S15P31C108-76 을 합침) · PRD: FR-E3 · FR-E5 · 7.5 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
**값 모양 검사 (C1 스키마)**
- [x] 입력 레코드를 `contracts/c1/record.schema.json` 으로 검사해, 어긋난 칸마다 held + `INVALID_VALUE`(field) 가 붙는다
- [x] 기간 종류 'X' · 저장 범위 'everything' · 숫자 자리에 글자 · 수집 시각 '어제' · 값과 결측 사유 둘 다 없음 → held 로 나온다
- [x] `contracts/c1/examples` 5개와 P1 실샘플(content_hash 채운 것)은 pass 로 나온다
- [x] 허용값을 P2 코드에 따로 적지 않는다 — 스키마의 enum 을 바꾸면 P2 결과가 코드 수정 없이 따라 바뀐다

**저장 범위 게이트**
- [x] 이용허락(license_type)별 최대 저장 범위를 표 하나(데이터 파일)에서 읽는다. 표에 없는 이용허락(TBD 포함)이면 held + `LICENSE_UNKNOWN`
- [x] P1 의 storage_scope 가 표의 최대보다 넓으면 최대로 낮추고 fixed + `SCOPE_DOWNGRADED`. 같거나 좁으면 P1 값을 그대로 둔다
- [x] 최종 저장 범위가 full 이 아닌 지표 레코드는 값을 남기지 않는다 (value → null, missing_reason → license_blocked, `VALUE_STRIPPED_BY_SCOPE`). 결과는 C1 스키마를 그대로 통과한다
- [x] held 레코드에도 저장 범위가 적용된다 (보류여도 저장되므로)
- [x] 계약 예시: KOSIS·에어코리아 측정값은 full 그대로, 측정소정보(license_type TBD)는 held + `LICENSE_UNKNOWN`

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
**값 모양 검사 (처음 브랜치 `feat/p2-refine-value-checks`, S15P31C108-74)**
- 2026-10-21: 시작. 기준 브랜치는 `feat/p2-refine-skeleton`(65b24c9) — develop 에 `pipeline/refine/` 이 아직 없어서
- 2026-10-21: 허용값을 P2 에 따로 적지 않고 장성우의 C1 스키마(S15P31C108-68, `contracts/c1/record.schema.json` — 필드 30개 · enum · 조건 규칙 4개)를 읽어 검사하기로 함. 같은 규칙이 두 곳에 생기지 않게
- 2026-10-21: **막힘** — `feat/c1-contract` 가 아직 push 전. 2026-10-22 push(6d42cc7, MR !11) 로 풀림
- 2026-10-22: 스키마로 미리 확인(jsonschema + FormatChecker, 커밋 안 한 실험): 계약 예시 5개 C1 통과 · P2 해시 null → held, 해시 채움 → pass. 어제 놓친 불량 5종은 스키마가 전부 잡음. 못 잡는 것: 결측을 0 · PM2.5 음수(탭 10 필요) · 아무 문자열 해시(pattern 없음)
- 2026-10-22: MR !11 에 P2 리뷰 의견 초안 작성 (content_hash null 정책 · P2 출력 스키마 · dedup_key 설명 · 측정소 메타 경로). **결정(박준우)** — content_hash 는 A안: C1 동결 때 null 불가로 바꾸자고 제안, P2 는 해시 없으면 held 유지. 제안 방식은 원천 한 줄을 키 정렬 JSON 의 SHA-256 → `sha256:<64자리>`. 확인값 KOSIS 2023 행 = `sha256:14b2009a…62a79`
- 2026-10-22: `origin/feat/c1-contract` 를 merge 로 받음(b8a8285). 테스트 데이터를 노션 사본에서 `contracts/c1/examples` 5개로 교체(47630f4) — 노션 사본 에어코리아 3건은 C1 v0.1 필수 키(`content_hash`·`published_at`)가 없었음
- 2026-10-22: `schema.py` — jsonschema 4.26(Draft 2020-12) + rfc3339-validator(date-time 형식 검사용). 스키마 오류를 P2 사유로 옮김: 칸 값 틀림 → `INVALID_VALUE`(최상위 칸), 키 없음 → `MISSING_REQUIRED`, C1 에 없는 칸 → `UNKNOWN_FIELD`, 여러 칸 묶음 규칙(raw_url\|file_name · value\|missing_reason) → 다 비었으면 `MISSING_REQUIRED` 아니면 `INVALID_VALUE`. 순서는 P2 규칙 먼저, 스키마 결과는 (code, field) 정렬, 같은 사유는 한 번만. TDD: 새 테스트 13건이 빈 구현에서 실패 확인 뒤 구현. 변형 4가지 모두 테스트가 잡음. pytest 79건, `pnpm check` PASS

**저장 범위 게이트 (S15P31C108-76 → -74 로 합침)**
- 2026-10-22: 이 브랜치를 `feat/p2-refine-value-checks`(944c314) 위에 만들어 시작
- 2026-10-22: 이용허락 표 초안(관측값 레코드, 박준우 확인): `KOSIS-활용약관` · `KOGL-1` · `KOGL-3` → full / `KOGL-2` · `KOGL-4` → metadata (비영리 조건, 기업 서비스라 보수적으로) / 표에 없음 · `TBD` → held. 근거는 Notion 「데이터」 4-3 (KOSIS 상업 이용 가능, 에어코리아 확정자료 공공누리 3유형 상업 가능 · 변경금지 → 원값 그대로 저장은 가능)
- 2026-10-22: 관측값은 숫자 자체가 내용이라 full 이 아니면 값을 지우고 결측 사유를 `license_blocked` 로 둔다 (C1 결측 규칙에 이미 있는 값이라 계약 변경 없음). 저장 범위만 고친 레코드는 처음으로 `fixed`, 다른 보류 사유가 있으면 `held` 가 우선
- 2026-10-22: 구현 — `license_scopes.json`(표, `observation` 축 하나) + `storage.py`(`apply_storage_scope`) + `run.py`(검증 뒤 게이트를 늘 적용, `FIX_CODES` 만 있으면 fixed). 결정: 이용허락을 모르면 레코드는 바꾸지 않고 보류만 함. license_type · storage_scope 칸이 비었거나 허용값 밖이면 게이트는 건너뜀(검증 사유로 충분). 이미 결측인 값은 사유를 덮어쓰지 않음
- 2026-10-22: 기존 테스트 변경 — 측정소정보(TBD)가 이제 held 라 "해시 채우면 pass" 테스트를 관측값 4건으로 좁히고, 좌표 범위 테스트 기대값에 `LICENSE_UNKNOWN` 추가. TDD: 새·바뀐 테스트 10건이 빈 구현에서 실패 확인 뒤 구현. 변형 5가지 모두 테스트가 잡음. pytest 91건, `pnpm check` PASS

**합치기**
- 2026-10-22: 뼈대 MR !13 이 develop 에 머지됨(f90240f, 박준우). 값 모양 검사와 저장 범위를 MR 하나 · Jira 하나(S15P31C108-74)로 합치기로 함(박준우). -76 은 "-74 로 합침" 댓글 뒤 완료 처리
- 2026-10-22: 이 브랜치에 origin/develop 을 merge(a175df9, 충돌 없음). 뼈대 MR 뒤에 만든 계획 파일 정리 커밋(484dc62)이 develop 에 못 들어가서 이 브랜치로 옮김(64834d2). 원격 `feat/p2-refine-skeleton`(그 커밋만 담겨 다시 생겼던 것) · `feat/p2-refine-value-checks`(이 브랜치에 다 들어 있음) 삭제. 계획 파일 두 개를 이 파일 하나로 합침

## 다음 할 일 / 범위 밖
- MR !11 리뷰 반영 확인: 성우님이 `content_hash` 를 null 불가 · pattern 으로 바꾸면 계약 예시에 진짜 해시가 들어오고, "해시 null → held" 테스트를 다른 방법(해시 지우기)으로 바꿔야 함
- P2 출력 스키마(정제 레코드 = C1 + `validation_status` · `issues` · `rule_version`)를 contracts 에 올리기 — MR !11 리뷰에서 약속함. P3 가 입력 검증에 씀
- `KOGL-2` · `KOGL-4` 를 기업 서비스에서 어떻게 볼지 확인 (멘토 · 대표)
- 이용허락 표를 P1 수집 전 게이트와 같이 쓰게 되면 `contracts/` 로 옮기기 (인원 분배 v2: "저장 범위·이용허락을 같은 규칙으로")
- engine 을 따로 배포(Docker 등)할 때 `contracts/c1/record.schema.json` 도 같이 넣어야 함 (지금은 레포 루트에서 읽음)
- 범위 밖: 지표별 값 범위(탭 10 필요), 탭 3 에 없는 source_id, daum.net 금지 여부, 측정소 메타 레코드 경로(P3 결정)
- 범위 밖: 문서 레코드(뉴스·보도자료)의 저장 범위 — 본문 지우기, RSS link_only. C1 에 문서 레코드가 생기면 표에 레코드 종류 축을 더한다
- 범위 밖: 에어코리아 3유형 계산값(월평균 등) 화면 노출 여부 — 대표 확인
