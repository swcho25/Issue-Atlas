# 기존 대응 후보 v0.1 — `existing_response`

카드 근거 ③ 「기존 대응」에 쓸 **후보**. 온통청년 청년정책과 지방재정365 세출에서 규칙으로 골라 원천 판과 함께 둔다(S15P31C108-136).
만드는 곳: `python -m pipeline.responses --db` (`engine/pipeline/responses/extract.py`). 테이블은 Flyway [V0019](../../backend/src/main/resources/db/migration/V0019__create_existing_response.sql).
계약 변경은 받는 쪽 최동준(P5 판정) · 질문 실행(P7, -133) 리뷰가 필요하다.

**후보일 뿐 근거 확정이 아니다.** 카드 · 지역 · 기간에 맞는지는 질문 실행이 판단한다. 키워드 · 주관기관이 맞았다고 정책 효과 · 대상 · 지역을 확정하지 않는다.

## 칸

| 칸 | 뜻 |
| --- | --- |
| `response_id` | `resp:` + sha256(카드 · 원천 · 판). 같은 판을 다시 넣어도 같은 행 |
| `card_id` | `C1` · `A3` |
| `origin` · `origin_ref` | 원천과 판이 바뀌어도 같은 식별자. 온통청년 `<plcyNo>:<zipCd>`, 세출은 `expenditure_id` |
| `raw_content_hash` · `expenditure_id` | 원천 판(FK). 온통청년은 원본 `raw_record.content_hash`, 세출은 `local_expenditure.expenditure_id`. 둘 중 하나만 |
| `place_code_raw` · `place_id` | 원천 지역 코드 그대로 · 맞춘 지역. 광주 본청(`29`)은 시도 place `kr-29`(V0018, S15P31C108-163). 지역 코드 연결에 없는 코드는 `place_id = null` |
| `name` | 사업명 |
| `department` | 담당 부서. 원천에 없으면 null |
| `fiscal_year` | 세출 회계연도. 사업 시행 기간이 아니다 |
| `period_start` · `period_end` | 원천이 준 사업 기간 `[start, end)`. 게시일 · 회계연도로 채우지 않는다. 한쪽만 있을 수 있다 |
| `target` | 지원 대상. 원천이 연령을 주면 `만 18~39세`, 아니면 null(자격 문구로 지어내지 않는다) |
| `field_sources` | 칸 → 채운 원천 칸 이름. 원천에 없어 비운 칸은 null |
| `extracted_by` | `rule`(원천 칸을 옮김) · `llm`(LLM 추출, 지금은 없음) |
| `selection_reason` | 고른 이유 (예: `세부사업명에 「미세먼지」`) |
| `rule_version` | 선정 · 옮김 규칙 판. 지금 `existing-0.1` |
| `is_current` | 같은 `origin_ref` 의 새 판이 들어오면 옛 행은 false |

## 원천별 규칙 (`existing-0.1`)

| 원천 | 카드 | 고르는 규칙 | 칸 |
| --- | --- | --- | --- |
| 온통청년(`normalized_ready` 의 youthcenter) | C1 | 주관기관(`sprvsnInstCdNm`)이 조회 지역의 시 · 구 자신 — `(전남광주통합특별시\|광주광역시\|전라남도) 여수시 …` | 이름 `plcyNm` · 부서 `sprvsnInstCdNm` · 기간 `bizPrdBgngYmd~bizPrdEndYmd` · 대상 `sprtTrgtMinAge~sprtTrgtMaxAge`(0 이면 null) · 구역 조회 `zipCd` |
| 세출(`local_expenditure`) | C1 | 세부사업명에 `청년` | 이름 세부사업명 · 회계연도 · 구역 자치단체. 부서 · 기간 · 대상은 원천에 없어 null |
| 세출 | A3 | 세부사업명에 `미세먼지` · `비산먼지` · `대기오염` · `대기환경` · `대기질` · `대기배출` · `대기측정` · `대기장비` · `대기·` · `배출가스` · `저공해` | 위와 같음 |

- 온통청년 조회 지역에는 중앙부처 · 다른 지역 정책도 섞여 온다(그 지역을 대상에 포함한 정책). 조회 지역을 주관기관 소재지로 보지 않고, 주관기관 칸으로만 고른다. 광역(통합특별시 · 광역시 본청) 정책은 v0.1 에서 고르지 않는다
- 「대기」 하나만 보면 「확대기반」 같은 사업명도 걸린다. 붙은 말로만 고른다. 부문 「대기」는 탄소중립 · 석면까지 들어 있어 쓰지 않는다
- 예산현액 · 지출액은 원천 행(`expenditure_id`)에서 읽는다. 금액은 집행 기록이지 정책 효과가 아니다

## 다시 돌릴 때

| 경우 | 결과 |
| --- | --- |
| 같은 판 | 건너뜀(`unchanged`) |
| 온통청년 정책 내용이 바뀜(새 `content_hash`) | 새 행 + 같은 `origin_ref` 옛 행 `is_current = false` (`changed`) |
| 세출 파일이 바뀜 | 바뀐 줄은 새 `expenditure_id` → 새 행. 세출은 안정 식별자가 없어(같은 자치단체 · 회계 · 사업명이 한 해 115–143번 되풀이) 옛 줄과 잇지 못한다 |

## 변경 이력

- v0.1 (2026-10-31): 초안. V0019
