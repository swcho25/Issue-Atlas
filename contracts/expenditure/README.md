# 지방 세출(세부사업) v0.1 — `local_expenditure`

지방재정365 「연도별 세부사업별 세출현황」에서 **광주광역시 본청 · 5구와 여수시**의 세부사업 한 줄을 한 행으로 둔다. 카드 근거 ③ 「기존 대응」(세출, 카드 양식 SP09 · SP24)의 원천이다.
만드는 곳: `python -m pipeline.collect.lofin --xlsx <파일> --db` (`engine/pipeline/collect/lofin.py`). 테이블은 Flyway [V0015](../../backend/src/main/resources/db/migration/V0015__create_local_expenditure.sql).
계약 변경은 받는 쪽 박준우(P2) · 정우현(P3) · 최동준(P4) 리뷰가 필요하다.

## 원천

| 항목 | 값 |
| --- | --- |
| 제공 | 행정안전부 지방재정365 [통합자료실](https://www.lofin365.go.kr/portal/LF8310000.do?ntcaClsDvCd=FSL446) 「N 회계연도 세부사업별 세출 현황」 첨부 XLSX |
| 이용 조건 | 공공데이터포털 [「이용허락범위 제한 없음」](https://www.data.go.kr/data/15138684/fileData.do) → `license_type = 공공데이터-이용허락범위제한없음`, `storage_scope = full` |
| 기준일 | 그해 12월 31일 집행 기준. 파일 하나가 한 해, 시트 하나(이름 = 연도)에 전국 약 48만 행 |
| 2023–2025 대상 행 | 2023 13,279 · 2024 12,820 · 2025 12,750 (원천 안의 완전 중복 각 19 · 17 · 15 줄은 한 행) |

원천 열: 지역 · 자치단체 · 회계 · 세부사업명 · 예산현액(계 · 국비 · 시도비 · 시군구비 · 기타) · 지출액 · 집행잔액 · 분야 · 부문. **담당 부서 열은 없다.**

## 저장 — `local_expenditure`

| 칸 | 뜻 |
| --- | --- |
| `expenditure_id` | `sha256:` + (회계연도 + 원천 13칸)의 해시. 같은 파일을 다시 넣어도 같은 행(PK) |
| `fiscal_year` | 회계연도(시트 이름) |
| `region` · `government` | 원천의 지역(시도) · 자치단체 글자 그대로. 광주 `본청` · `동구` …, 전남 `여수시` |
| `place_code_raw` | KOSIS 옛 지역 코드. 광주 본청 `29`(시 전체, 보도자료와 같음), 동구 `29110` · 서구 `29140` · 남구 `29155` · 북구 `29170` · 광산구 `29200`, 여수시 `46130` |
| `account` · `project_name` | 회계(일반회계 · 특별회계 · 기금) · 세부사업명 |
| `budget_total` · `budget_national` · `budget_province` · `budget_local` · `budget_other` | 예산현액 계 · 국비 · 시도비 · 시군구비 · 기타(원) |
| `expenditure` · `balance` | 지출액 · 집행잔액(원) |
| `field` · `sector` | 기능별 분야 · 부문 |
| `file_name` · `license_type` · `storage_scope` · `collected_at` · `collector` | 출처 추적. `storage_scope` 는 `full` 만(CHECK) |

## 실패 코드

| 코드 | 뜻 |
| --- | --- |
| `LOFIN_UNREADABLE_FILE` | XLSX 를 열지 못함 |
| `LOFIN_UNEXPECTED_SHEETS` | 시트가 하나가 아니거나 이름이 연도가 아님 |
| `LOFIN_HEADER_CHANGED` | 2 · 3행 머리글이 다름 — 원천 양식이 바뀌었을 수 있다 |
| `LOFIN_NO_ROWS` | 대상 자치단체 행이 없음 |
| `LOFIN_INVALID_ROW` | 회계 · 사업명이 비었거나 금액이 원 단위 정수가 아님 |

## 쓰는 쪽 메모

- 「기존 대응」으로 쓸 때 사업명 키워드(청년 · 미세먼지 · 대기 등)와 분야 · 부문으로 고른다. 2023–2025 사업명에 「청년」 150–182건, 「미세먼지」 · 「대기」 39–43건
- 금액은 실제 집행 기록이며 정책 효과를 뜻하지 않는다(PRD 1.1)

## 변경 이력

- v0.1 (2026-10-29): 초안. V0015, 2023–2025 실제 파일로 확인
