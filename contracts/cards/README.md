# 카드 설계도 · 지표 사전 v0.3

판정 코드가 읽는 카드 정의와 지표 정의. 카드는 **이슈 하나를 어떻게 판단하는가**만 적고, 지역 · 기간을 넣어 돌린 결과는 적지 않는다.
주는 쪽: 카드 작성(P2 박준우 · 대표 승인) → 받는 쪽: 판정 규칙 `RuleType`(P5 최동준, S15P31C108-192) · 질문 실행(P7 장성우, -133) · 카드 저장 · 승인 [C3](../c3/README.md)(P5 최동준, -174) · 화면(S1 · S4).
계약 변경은 받는 쪽 최동준 · 장성우 리뷰가 필요하다. 테스트: `engine/tests/test_card_contract.py` · backend `CardDesignContractTest`(이 파일들을 그대로 C3 에 저장 · 승인).

C3 는 이 파일의 키를 그대로 저장한다. 다른 점은 하나: 카드의 `rule` 은 주 지표 행(`indicator.rule`)으로 옮겨 두고, 승인 때 승인본 `spec.rule` 로 복사한다. 그래서 지표 하나에 규칙은 하나다.

| 파일 | 내용 |
| --- | --- |
| `indicators.json` · `indicators.schema.json` | 지표 사전 — 지표 한 행 = ID · 이름 · 단위 · 주기 · roll · 원천 |
| `card.schema.json` | 카드 설계도 — 회사 노션 「이슈 카드 표준 개발 양식 v1.1」의 칸(A1–F2)을 코드 키로 |
| `C1.json` · `A3.json` | 12/1 범위 카드 두 장 |
| `backend/db/seed/cards-c1-a3.sql` | 위 파일들을 운영 DB 지표 사전 · 카드 승인본(C3)으로 넣는 seed. `node scripts/card-seed.mjs` 가 만든다. 아래 「운영 DB 에 넣기」 |

## 출처

- 칸과 초안: 회사 노션 「이슈 카드 표준 개발 양식 v1.1」(2026-10-19) 4장 카드 설계서
- 판정 값: 회사 노션 「Issue Atlas — 5차 멘토링 검토 및 2주 개발 플랜 (11/2 ~ 11/13)」 표 1 (대표 결정 2026-11-01). 각 카드 `approval.approved_fields` 가 이 결정으로 정한 칸이다
- 지표 사전의 원본은 가이드 시트 탭 10 이다(대표 결정 2026-10-19). 이 파일은 코드가 읽는 사본이며, C1 · A3 가 쓰는 지표만 담는다

## 지표 사전

| 칸 | 뜻 |
| --- | --- |
| `id` | 지표 ID. 연령 · 성별은 ID 에 넣는다(`_19_39`). 카드 비교 조건 「같은 지표」는 이 ID 가 같은지로 본다 |
| `roll` | 판정 안에서 월 → 연. `sum` 12개월 모두 있을 때 합계 · `mean` 유효한 달 `min_months` 개 이상일 때 평균 · `end_of_period` 연말 값. 못 채우면 그 해는 null. 화면 series 는 연으로 묶지 않는다 |
| `value_direction` | 값이 커지면 무슨 뜻인가. 판정 방향(`claim`)과 다를 수 있다 — C1 은 순이동 값이 **작아질수록**(더 음수) 「순유출 확대」= `increasing` |
| `source` | 원천 수집 명세(`source_spec.spec_id`) · 수집기가 C1 레코드에 넣는 `indicator_id` · 이 지표를 고르는 원천 코드(`locator`). SP01 은 `C3`(연령)로 000 전체 · 901 19–34세 · 905 19–39세 |
| `cards` | 이 지표를 **쓰는** 카드(`claim_items` · `evidence`). 테스트가 카드 쪽과 맞는지 본다. 승인본에서는 C3 `card_claim_item` · `card_evidence_bind` 가 원본 |
| `added_by_card` | 이 지표를 사전에 **넣은** 카드(C3 `indicator.added_by_card`, 선택). 검수 전 지표는 그 카드가 승인될 때 함께 검수된다. 쓰는 카드는 여럿이어도 넣은 카드는 하나 |
| `target` | 적용 대상 설명(선택, 예: 청년 19–39세). 설명용이고 연령의 원본은 `id` 다 |
| `shape` | 값 모양(선택, 없으면 `value`). `flow` 출발 → 도착 이동량 · `ratio` 다른 두 지표의 비율(`numerator_id` · `denominator_id` · `multiplier` 필수) · `grade_days` 기준 지표가 경계를 넘은 날 수(`base_id` · `cut` 필수). 그 칸들은 맞는 모양에만 쓴다 |

## 카드 칸 (양식 v1.1 → 키)

| 양식 | 키 | 판정 코드가 쓰는 법 |
| --- | --- | --- |
| A1–A7 | `card_id` · `name` · `parent_question` · `domain` · `st_type` · `status` · `card_version` · `inclusion` · `exclusion` | `card_version` 은 DB `card.card_version`(V0013)과 같다(테스트가 검사) |
| B1 | `claim_template` | 판단 ① 문장. `{판정값}` 에 `rule.outcomes[].label` |
| B2 | `claim_items` | 계산할 지표 1–3개. `main` 하나만 판정한다. `related` 는 그림만 |
| B3 | `comparability` | 비교 조건 4개의 요구사항. 실제 통과 여부는 실행 때 판정 |
| B4 | `rule` | `rule_id` 규칙 모듈 · `formula_version`(C2 `argument.formula_version` 에 그대로) · `outcomes` 위에서부터 처음 맞는 것 |
| B5 | `max_claim_level` | C2 `claim.level` 최대 |
| B6 | `applicability` | 못 채우면 실행하지 않는다(`unsupported`) |
| C1–C6 | `evidence` · `expected_gaps` · `required_for_claim` | 근거 4종의 원천. `required` 가 없으면 `blocked` |
| D1–D3 | `warrant` · `rebuttals` · `ceiling` | 보증 ③ · 반박 ⑤ · 상한선 ⑥. `status: draft` 는 대표 초안(승인 전) |
| E1–E3 | `map_mode` · `legend_text` · `forbidden_terms` | 그림 · 고정 문구 · 금지어 |
| F1–F2 | `keywords` · `approval` | 기사 후보 키워드 · 승인 |

## 판정 규칙 (2026-11-01 대표 결정 · 2026-11-02 세부 해석, S15P31C108-159)

| 카드 | 연 값 | 규칙 (`outcomes` 순서) |
| --- | --- | --- |
| C1 `c1-net-migration-0.1` | 청년(19–39세) 순이동 월 → 12개월 모두 있는 해만 합계. 연 값이 없는 해는 건너뛴다 | 연 값 3개 미만 → 근거 부족 · 모두 음수 + 절대값 해마다 증가 → 청년 순유출 확대(`increasing`) · 모두 음수 + 해마다 감소 → 축소(`decreasing`) · 앞선 해에 음수가 있고 마지막 해 양수 → 순유입 전환(`decreasing`) · 그 외(같은 값, 오르내림, 모두 양수) → 불분명. 변화 폭 임계 없음 |
| A3 `a3-pm25-diff-0.2` | PM2.5 측정소 월평균(유효 시간 75% 이상인 달) → 유효한 달 9개 이상이면 연평균 → 시군구 = 공통 측정소(기간 안 모든 해에 연평균이 있는 측정소)별 연평균의 평균 | 연 값 있는 해 3개 미만 → 근거 부족 · 공통 측정소 없음 → 비교 불가(`not_comparable`) · 끝해 − 첫해 ≥ +3µg/m³ → 악화(`increasing`) · ≤ −3 → 개선(`decreasing`) · 그 사이 → 불분명 |

양식 v1.1 초안과 달라진 값: 청년 15–39세 → **19–39세**(수집 범위 SP01 905), C1 「3년 중 2년 같은 방향」 → 위 규칙, A3 ±2 → **±3**(강수 · 풍향만으로 연평균이 1~2µg/m³ 움직인다), 「확산」 그림 → **「관측 순서」**, 상한선은 대표 결정 문구.

세부 해석(2026-11-02 최동준, -159):

- 청년 19–39세는 법령 기준(청년기본법 19–34세)이 아니라 통계 공표 · 수집 범위(SP01 905)다. 화면은 「청년」만 쓰지 않고 「청년(19–39세)」로 범위를 같이 보여 준다
- 기간이 3년보다 길면 「해마다」를 기간 안 모든 해로 본다. 0 은 음수도 양수도 아니다
- C1 「순유입 전환」은 C2 `claim` 에 맞는 값이 없어 `decreasing` 으로 두고 화면 문구만 다르게 한다. 모두 양수는 전환이 아니라서 불분명이다. 0.1 로 나온 판정 결과가 아직 없어 `formula_version` 은 0.1 을 그대로 쓴다
- A3 는 측정소를 고정한다. 측정소가 새로 생기거나 한 해 고장 나면 「측정소별 연평균의 평균」이 공기와 상관없이 움직이기 때문이다. 결과가 0.1 과 달라져 0.2 로 올렸다
- A3 판정은 월평균 → 연평균만 쓴다. 대기환경기준(연평균 15µg/m³) 같은 기준선은 판정이 아니라 화면 맥락 표시용이다

## 운영 DB 에 넣기

`backend/db/seed/cards-c1-a3.sql` 이 지표 사전 6개와 C1 · A3 초안을 넣고 `approve_card()` 로 승인한다. 기존 legacy v1 다음인 **v2** 가 첫 승인본이다. Flyway 밖이라 개발 · 운영 DB 에 한 번씩 손으로 실행한다.

```bash
psql "<DB 접속 문자열>" -v ON_ERROR_STOP=1 -c "SET issue_atlas.approver = '<관리자 로그인 이메일>'" -f backend/db/seed/cards-c1-a3.sql
```

- 승인자(`card_approval.approved_by`)는 관리자 계정의 로그인 이메일이다. 관리자 API 로 승인할 때 남는 값과 같다. 이메일은 저장소에 적지 않고 실행할 때 넣는다. 카드의 `approval`(대표 결정 기록)은 그대로 남는다
- 전체가 DO 블록 하나라 중간에 실패하면 아무것도 남지 않는다. 다시 실행하면 이미 승인된 카드는 건너뛴다. DB 의 지표가 seed 와 다르면 멈춘다
- 이 파일들을 바꾸면 `node scripts/card-seed.mjs` 로 seed 를 다시 만든다. 안 그러면 `CardSeedIntegrationTest` 가 실패한다
- Flyway 에 넣지 않는 이유: C3 계약상 Flyway 는 운영 승인본을 seed 하지 않는다 · 테스트 DB 의 C1 은 legacy 여야 한다 · 관리자 계정은 Flyway 뒤 앱이 켜질 때 만들어진다

## 정하지 않은 것 (리뷰 때 확인)

- A3 보증 초안은 나쁨 일수를 말하지만 MVP 판정은 PM2.5 연평균만 쓴다(나쁨 일수는 MVP 뒤)
- C1-R1 「19–24세가 지배하는가」는 수집 밴드에 19–24 가 없어 지금은 확인할 수 없다
- 보증 · 반박은 대표 초안 그대로(`draft`). 승인되면 `approved` 로 바꾸고 `card_version` 을 올린다
- 광주광역시 보도자료는 시 전체(29) 발행이라 구의 근거로 셀지 정해지지 않았다(대표 피드백 2026-11-01 #6, [P3](../p3/README.md) 「아직 없는 것」)

## 변경 이력

- v0.3 (2026-11-02): C1 순유입 전환 조건을 「앞선 해에 음수」로 좁힘(`turned_positive`) · A3 공통 측정소와 `not_comparable` 추가(`a3-pm25-diff-0.2`) · `outcomes[].claim` 에 `not_comparable` 허용 · 운영 seed (S15P31C108-159)
- v0.2 (2026-11-02): C3 저장 칸 맞춤 — 지표에 `added_by_card` · `target` · `shape` · `numerator_id` · `denominator_id` · `multiplier` · `base_id` · `cut`(모두 선택), `claim_items` 1–3개, 보도자료 · 세출 근거를 등록된 수집 명세(`press_release_yeosu` · `press_release_gwangju` · `lofin_expenditure_gwangju_yeosu`)로 (S15P31C108-188)
- v0.1 (2026-11-02): C1 · A3 카드와 지표 6개. 대표 결정 2026-11-01 반영(S15P31C108-171)
