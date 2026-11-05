# feat/argument-schema — 논증 응답 스키마(C2 GET /v1/arguments/{run_id})

- Jira: S15P31C108-255 · PRD: FR-B2 · FR-C4 · FR-C5 · 묶음/단위: 결과 화면 05 준비

## 완료 조건
- [x] `shared/api/c2` 에 argument 응답 Zod 스키마 · 타입(`contracts/c2/schemas/argument.schema.json` c2-0.1 과 같은 칸)
- [x] 계약의 교차 규칙(card_id null → unsupported, blocked · unsupported → insufficient, 증가 · 감소 → 비교 조건 모두 통과, series 길이 같음, 근거 충실도 등급)을 검사
- [x] 계약 예시 4개(ready · insufficient · not-comparable · unsupported)가 통과하고, 규칙을 어긴 응답은 실패하는 단위 테스트
- [x] 하네스: C2 계약 응답 스키마 위치를 `frontend/AGENTS.md` 에 한 줄

## 진행
- 2026-11-05: 시작. 처음엔 `entities/argument` 로 하려 했으나 쓰는 화면이 아직 없어 steiger `insignificant-slice` 오류를 직접 확인 → C2 계약 응답은 여러 화면(04 · 05 · 지도)이 함께 쓰는 공통 약속이라 `shared/api/c2` 에 두기로(사용자 결정)
- 2026-11-05: `shared/api/c2/common.ts` · `argument.ts`(c2-0.1 칸 그대로, 모르는 칸은 버리고 통과) · 교차 규칙 5개를 `superRefine` 으로(card_id null → unsupported, blocked · unsupported → insufficient, 증가 · 감소 → 비교 조건 모두 통과, series 길이, 근거 충실도 등급). 그림 모양 도우미 `seriesShape`(이동 · 기사 건수 · 지도 점 · 막대). 계약 예시 4개 통과 + 규칙 어긴 응답 7개 실패 = 테스트 13개. `frontend/AGENTS.md` 「데이터」에 C2 계약 응답 위치 한 줄. `pnpm check` 통과(테스트 35)
- 2026-11-05: 마무리. Jira S15P31C108-255. `pnpm check:all` 9개 통과(첫 회 Docker 꺼짐으로 backend build 실패 → 켠 뒤 통과)

## 다음 할 일 / 범위 밖
- U10 05 화면 틀(결과 화면 주소를 호성과 맞춘 뒤)
