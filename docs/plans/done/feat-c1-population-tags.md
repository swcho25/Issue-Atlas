# feat/c1-population-tags — C1 인구 통계 카드 태그와 청년 인구 비율 지표

- Jira: S15P31C108-196 · PRD: FR-B2 · 묶음/단위: P2 (SP10 연령 코드 → 지표 ID 의 남은 부분)

## 완료 조건
- [x] observation view: `population_movers` · `population_registered_19`–`_39` 태그 C1, `population_registered_total` 태그 C1 · A3 (지표 사전 cards 와 같게)
- [x] 지표 사전: `population_registered_19_39`(19–39세 연령 코드 합) · `population_youth_share_19_39`(청년 인구 비율 = 19–39세 ÷ 전체 × 100)
- [x] C1 카드 분모 근거에 19–39세 주민등록인구, 통계 근거에 청년 인구 비율
- [x] 계약(관측 행 · DB · 카드)과 테스트(ObservationViewTest · test_card_contract)

## 진행
- 2026-11-02: 시작. view 태그가 출처 단위라 C1 related 지표(movers) · 사전의 분모(registered_total, C1 · A3)에 태그가 없었다. C1 포함 기준 「청년 인구 비율 변화」 지표도 없었다
- 2026-11-02: V0031 이 V0025 view 를 같은 칸으로 다시 정의(tags 만 바뀜). 19–39세 합은 사전 `locator` 값을 코드 목록(합계)으로 표현 — 사전 스키마 v0.3, view 는 계산 값을 만들지 않으므로 1세별 행을 판정 · 그림에서 더한다. 청년 인구 비율은 통계 근거(판정에 안 쓰는 맥락)로만 넣고 claim_items · 규칙은 그대로

## 다음 할 일 / 범위 밖
- 대표 확인(11/4 변경 요청): C1 청년 인구 비율 근거 추가
- 그림 · 판정 코드가 19–39세 합 · 비율을 실제로 계산하는 것(SeriesService · CardRule, 장성우 · 최동준)
- C3 indicator 표에 새 지표 두 행 넣기(카드 승인 흐름, -174)
