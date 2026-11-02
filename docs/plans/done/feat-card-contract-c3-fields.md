# feat/card-contract-c3-fields — 카드 설계도 계약에 C3 저장 칸 맞춤

- Jira: S15P31C108-188 · PRD: FR-B2 · FR-C4 · 묶음/단위: P5-24

## 완료 조건
- [x] indicators.schema.json 이 target · shape(value · flow · ratio · grade_days) · multiplier · cut · numerator_id · denominator_id · base_id · added_by_card 를 선택 칸으로 받는다 (ratio 면 multiplier + 분자 · 분모, grade_days 면 cut + base 필수)
- [x] card.schema.json claim_items 가 1–3개만 받는다 (양식 B2)
- [x] cards = 쓰는 카드, added_by_card = 만든 카드를 README 에 적고 지표 6개에 added_by_card 를 채운다 (CardDesignContractTest 가 cards[0] 으로 읽던 값과 같게)
- [x] C1 · A3 근거의 보도자료 · 세출이 등록된 수집 명세 ID(press_release_yeosu · press_release_gwangju · lofin_expenditure_gwangju_yeosu)를 가리키고, 테스트가 그 ID 가 수집기에 있는지 본다
- [x] engine lint · test 통과

## 진행
- 2026-11-02: 시작. C3 카드 저장 · 승인(S15P31C108-174, 최동준) 리뷰 후속. 동준님 V0029 MR(fix/card-design-checks)이 #171 파일을 그대로 읽어 승인까지 돌린다(CardDesignContractTest)
- 2026-11-02: added_by_card 는 동준님 테스트가 cards[0] 으로 읽던 값 그대로(C1 · C1 · C1 · A3, 19–34 · 전체 순이동은 없음). cards 는 「쓰는 카드」로 남겼다 — #171 테스트가 카드 ↔ 지표를 이 칸으로 맞춰 본다
- 2026-11-02: shape 칸은 맞는 모양에만 쓰게 했다(ratio 아니면 분자 · 분모 · 배수 없음, grade_days 아니면 기준 · 경계 없음). V0029 저장 트리거와 같은 조건이고 계약 쪽이 조금 더 엄격하다(배수 · 경계도 막음)
- 2026-11-02: 보도자료 근거는 게시판마다 한 줄(이용허락이 달라 수집 명세가 둘). 「정하지 않은 것」의 spec_id null 줄은 빼고, 광주광역시 보도자료(시 전체 29)를 구 근거로 셀지를 넣었다
- 2026-11-02: 검사 — engine ruff check · format · pytest 457 통과(새 계약 테스트 3)
- 2026-11-02: 받는 쪽 확인 — 동준님 브랜치(fix/card-design-checks b2451a1)에 이 계약 파일을 넣고 CardStorageIntegrationTest 13 통과, CardDesignContractTest 4 중 1 실패. 실패는 C1 `evidence.documents[1]` 이 `spec_id: null` 이라고 가정한 줄(note 를 지워 「없음 사유 없음」을 만들던 것). 그 줄을 `documents` 에 `{spec_id: null}` 을 새로 넣는 것으로 바꾸면 4 모두 통과(임시 복사본에서 확인, 동준님 브랜치는 건드리지 않음)
- 2026-11-02: `pnpm check:all` 통과(harness · backend format · frontend lint · typecheck · test · e2e · backend build · engine lint · test 457)

## 다음 할 일 / 범위 밖
- **최동준: 병합 전에** CardDesignContractTest 의 「없음 사유」 줄을 계약 내용에 기대지 않게(`((ArrayNode) noReason.get("evidence").get("documents")).addObject().putNull("spec_id")`). 안 바꾸면 이 MR 뒤 그 테스트가 깨진다
- 최동준: CardDesignContractTest 가 cards[0] 대신 added_by_card 를 읽게(값은 같다)
- 카드의 보도자료 근거가 질문 응답에 나오려면 P3(보도자료 시간 · 지역) · observation(글 종류 press) 연결이 필요하다 — 이 MR 범위 밖
