# feat/p2-refine-storage-scope — P2 정제 저장 범위 게이트

- Jira: S15P31C108-76 (에픽 S15P31C108-50) · PRD: FR-E3 · 7.5 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] 이용허락(license_type)별 최대 저장 범위를 표 하나(데이터 파일)에서 읽는다. 표에 없는 이용허락(TBD 포함)이면 held + `LICENSE_UNKNOWN`
- [x] P1 의 storage_scope 가 표의 최대보다 넓으면 최대로 낮추고 fixed + `SCOPE_DOWNGRADED`. 같거나 좁으면 P1 값을 그대로 둔다
- [x] 최종 저장 범위가 full 이 아닌 지표 레코드는 값을 남기지 않는다 (value → null, missing_reason → license_blocked, `VALUE_STRIPPED_BY_SCOPE`). 결과는 C1 스키마를 그대로 통과한다
- [x] held 레코드에도 저장 범위가 적용된다 (보류여도 저장되므로)
- [x] 계약 예시: KOSIS·에어코리아 측정값은 full 그대로, 측정소정보(license_type TBD)는 held + `LICENSE_UNKNOWN`

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-22: 시작
- 2026-10-22: 기준 브랜치는 `feat/p2-refine-value-checks`(944c314). C1 스키마 검사와 정제 코드가 develop 에 아직 없어서. 브랜치가 뼈대(S15P31C108-66) → 값 모양 검사(-74) → 이 작업 순서로 쌓임. 앞 MR 이 develop 에 들어가면 develop 을 받는다
- 2026-10-22: 이용허락 표 초안(관측값 레코드, 박준우 확인): `KOSIS-활용약관` · `KOGL-1` · `KOGL-3` → full / `KOGL-2` · `KOGL-4` → metadata (비영리 조건, 기업 서비스라 보수적으로) / 표에 없음 · `TBD` → held. 근거는 Notion 「데이터」 4-3 (KOSIS 상업 이용 가능, 에어코리아 확정자료 공공누리 3유형 상업 가능 · 변경금지 → 원값 그대로 저장은 가능)
- 2026-10-22: 관측값은 숫자 자체가 내용이라 full 이 아니면 값을 지우고 결측 사유를 `license_blocked` 로 둔다 (C1 결측 규칙에 이미 있는 값이라 계약 변경 없음). 저장 범위만 고친 레코드는 처음으로 `fixed`, 다른 보류 사유가 있으면 `held` 가 우선
- 2026-10-22: 구현 — `license_scopes.json`(표, `observation` 축 하나) + `storage.py`(`apply_storage_scope`) + `run.py`(검증 뒤 게이트를 늘 적용, `FIX_CODES` 만 있으면 fixed). 결정: 이용허락을 모르면(표에 없음) 레코드는 바꾸지 않고 보류만 함 — 범위를 정할 근거가 없어서. license_type · storage_scope 칸이 비었거나 허용값 밖이면 검증 단계 사유로 충분하니 게이트는 건너뜀. 이미 결측인 값은 사유를 덮어쓰지 않음(not_published 유지)
- 2026-10-22: 기존 테스트 변경 — 측정소정보(TBD)가 이제 held 라 "해시 채우면 pass" 테스트를 관측값 4건으로 좁히고, 좌표 범위 테스트 기대값에 `LICENSE_UNKNOWN` 추가. TDD: 새·바뀐 테스트 10건이 빈 구현에서 실패하는 것 확인 뒤 구현. 변형 5가지(범위 비교 뒤집기 · 값 지우기 빼기 · 결측 사유 덮어쓰기 · 보류 레코드 건너뛰기 · fixed 없애기) 모두 테스트가 잡음. pytest 91건, `pnpm check` PASS

## 다음 할 일 / 범위 밖
- `KOGL-2` · `KOGL-4` 를 기업 서비스에서 어떻게 볼지 확인 (멘토 · 대표)
- 이용허락 표를 P1 수집 전 게이트와 같이 쓰게 되면 `contracts/` 로 옮기기 (인원 분배 v2: "저장 범위·이용허락을 같은 규칙으로")
- 범위 밖: 문서 레코드(뉴스·보도자료)의 저장 범위 — 본문 지우기, RSS link_only. C1 에 문서 레코드가 생기면 표에 레코드 종류 축을 더한다
- 범위 밖: 에어코리아 3유형 계산값(월평균 등) 화면 노출 여부 — 대표 확인
