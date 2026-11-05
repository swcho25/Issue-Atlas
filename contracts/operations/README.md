# 운영 요약·저장된 분석 비교 API v0.1 — S15P31C108-245

프론트 리뷰 대상. 모든 경로는 ADMIN 세션이 필요하다. 미로그인 401, VIEWER 403.
기존 [HTTP 오류](../http-errors/) 사용. 모두 GET이며 기존 실행 결과·업무 데이터·이력을 수정하거나 분석을 새로 실행하지 않는다.
기존 V0023·V0033·검수·승인·CSV 표만 조회하므로 새 Flyway는 없다. 공개 C2 계약과 결과 형식은 변경하지 않는다.

## 경로

| GET 경로 | 쿼리 | 응답 |
| --- | --- | --- |
| `/v1/admin/overview` | `from?`, `to?`: 오프셋 포함 ISO 8601 | Overview |
| `/v1/admin/argument-runs` | `place_id?`, `card_id?`, `period_start?`, `period_end?`, `page?`, `size?` | RunPage |
| `/v1/admin/run-comparisons` | `before_run_id`, `after_run_id` | Comparison |

모든 필드는 snake_case. 시각은 오프셋 포함 ISO 8601, 분석 기간은 `YYYY-MM-DD`다.
공백 ID·잘못된 날짜·페이지·역전된 기간은 400, 비교할 실행이 없으면 404다.

## 운영 요약

- `generated_at`: 조회 시각.
- `period: {from,to}`: **시작 포함·끝 제외**. to 생략 시 현재, from 생략 시 to의 7일 전.
- `current_queues`: 기간과 관계없는 **조회 시점 상태별 전체 요청 건수**. 완료 상태도 포함한다.
  - `reviews`: pending / on_hold / resolved / rejected / approval_pending.
  - `approvals`: pending / on_hold / approved / rejected.
  - `imports`: validation_failed / no_changes / pending / completed / failed.
- `period_activity`: 기간 내 발생한 **처리 기록 건수**. 항목 사이 합계를 자료 건수로 사용하지 않는다.
  - `review_decisions`: review_change.created_at 기준 confirm / correct / hold / reject.
  - `approval_decisions`: card_approval_decision.created_at 기준 approve / reject / hold.
  - `import_results`: csv_import_result.created_at 기준 completed / failed.
  - `jobs_started`: job_run.started_at 기준 ok / failed / aborted / running. 기간에 시작한 작업의 **현재 기록 상태**이며, 기간 내 종료 건수나 현재 실행 중인 모든 작업 건수가 아니다.
- `current_inventory`: 현재 `raw_records`, `normalized_records`, `ready_records`(normalized_ready 뷰). 서로 다른 단계이며 합산하지 않는다. ready가 모든 지역·분류·서비스 노출 처리가 완료됐다는 뜻은 아니다.
- `source_statuses`: 모든 출처의 source_id 순 목록. source_id, name, storage_scope, reliability_grade, robots_status, spec_count, never_run_spec_count, latest_job_status, last_started_at, last_successful_at.
  - 최신 작업은 started_at 내림차순, 동률이면 job_run_id 내림차순. 마지막 성공 시각은 ok 작업의 finished_at 최대값.
  - 기록 없는 출처는 latest_job_status=unknown, 시각=null. never_run_spec_count는 실행 이력이 없는 수집 명세 수.
  - running은 DB의 status=null이라는 뜻이며 워커 생존 확인이나 실시간 수집 가동 보장이 아니다.
  - 최신 한 작업의 상태를 보여주는 것으로 출처 전체 정상 여부·오류율을 판정하지 않는다.

카드 승인으로 전달된 검수는 연결된 승인 상태를 읽는다. 승인 approved→resolved, rejected→rejected, on_hold→on_hold, pending→approval_pending이다.
검수의 correct 결정은 수정 제안/승인 요청을 포함하므로 **업무 데이터에 적용 완료된 수정 건수**라고 표시하지 않는다.
CSV completed는 담당자의 처리 보고이며 업로드 API 자동 적재 건수가 아니다.
집계와 비교는 read-only REPEATABLE_READ 트랜잭션으로 같은 DB 스냅샷에서 조회한다.

## 분석 실행 목록

`{items: Run[], total, page, size}`. 기본 page=1, size=20, 최대 size=100.
지역·카드·각 기간 끝점은 **일치 필터**이며 겹치는 기간 검색이 아니다. 없는 ID 필터는 빈 목록(200)이다.
정렬은 created_at 내림차순, 동률이면 run_id 내림차순.

Run:
`run_id`, `question_id`, `place_id`, `place_name`, `card_id`, `card_name`,
`period_start`, `period_end`, `run_status`, `card_version`, `formula_version`,
`taxonomy_version`, `previous_run_id`, `filled_cells`, `edit_count`, `created_at`.

이름은 현재 지역·카드의 표시 이름이다. 카드 없는 질문의 card_id·card_name은 null이다.
목록에 질문 원문(raw_text), 저장 결과 본문, 실행 시간은 포함하지 않는다. 개별 실행 결과는 기존 `GET /v1/arguments/{run_id}`에서도 조회할 수 있다.

## 비교

같은 실행을 두 번 선택하면 400이다. 서로 다른 실행은 다음 조건을 검사한다.

- place_id 동일, null이 아닌 card_id 동일, period_start·period_end 동일.
- after.created_at ≥ before.created_at.
- 양쪽 모두 unsupported가 아님.

응답:

```json
{
  "comparable": true,
  "reasons": [],
  "warnings": [],
  "before": {"run": {}, "metrics": {}, "result": {}},
  "after": {"run": {}, "metrics": {}, "result": {}},
  "deltas": {
    "filled_cells": {"value": 50.00, "unit": "percentage_points", "unavailable_reason": null},
    "required_evidence": {"value": 50.00, "unit": "percentage_points", "unavailable_reason": null},
    "edited_cells": {"value": null, "unit": "count", "unavailable_reason": "edit_count_not_recorded"}
  },
  "linked_review_changes": {"change_ids": [], "unavailable_reason": "run_review_link_not_recorded"}
}
```

위 예시의 빈 객체는 생략 표기다. before/after.run은 Run, result는 저장된 C2 결과 자체다.
비교 불가여도 양쪽 결과는 조회할 수 있지만 모든 delta.value는 null이다. reasons:
`place_mismatch`, `card_not_selected`, `card_mismatch`, `period_mismatch`, `run_order_invalid`, `unsupported_run`.

warnings:
`card_version_changed`, `formula_version_changed`, `taxonomy_version_changed`, `card_version_not_recorded`,
`previous_run_link_not_recorded`, `non_consecutive_runs`, `required_evidence_policy_changed`.
버전이 달라도 같은 질문 조건이면 비교할 수 있으나 동일한 처리 규칙이라고 단정하지 않는다.
직전 실행 관계가 없어도 임의의 두 저장 실행을 비교할 수 있다.

## 지표

metrics:

| 필드 | 의미 |
| --- | --- |
| `filled_cells` | Rate. 저장된 filled_cells / 6 ×100. 논증 칸 채움률이며 필수 근거 확보율과 다름 |
| `required_evidence` | `{required_kinds, rate: Rate}`. 각 result.evidence_table에서 required=true인 종류 중 status=available인 수 / 필수 종류 수 ×100 |
| `edited_cells` | `{value,unavailable_reason}`. 저장된 edit_count. 검수 요청·승인·수정 제안 건수와 다름 |

Rate: `{numerator, denominator, percentage, unavailable_reason}`.
백분율과 차이는 소수 셋째 자리에서 HALF_UP 반올림하여 둘째 자리까지 표시한다. 차이는 after−before이며 반올림 전 분수로 계산한다.
비율 차이 단위는 퍼센트포인트다. 양의 수정 칸 수 차이는 수정이 더 많이 기록됐다는 뜻이며 품질 개선으로 판정하지 않는다.

- filled_cells 누락: numerator·percentage=null, denominator=6, `filled_cells_not_recorded`.
- edit_count 누락: value=null, `edit_count_not_recorded`. 현재 실행 생성 코드는 edit_count를 기록하지 않으므로 실제 데이터는 이 상태일 수 있다. null을 0으로 바꾸지 않는다.
- 근거 표가 없거나 종류/required/status 기록이 불완전하거나 종류가 중복이면 `evidence_policy_not_recorded`.
- 필수 종류가 0이면 numerator=denominator=0, percentage=null, `no_required_evidence`.
- 필수 종류 집합이 바뀌면 각 시점의 확보율·분모는 보여주지만 확보율 delta는 null과 `required_evidence_policy_changed`.
- 조건 불일치면 delta는 null과 `conditions_not_comparable`. 그 외 누락 delta는 해당 지표의 누락 사유.

원래 기록된 0은 0으로 표시한다. 예전 결과를 현재 정책·현재 검수 건수로 소급 계산하지 않는다.
정답 일치율·응답 시간은 제공하지 않는다. 실행과 검수 변경의 명시적 연결이 현재 없으므로 linked_review_changes는 빈 배열과 사유를 제공한다. 이를 「검수가 없었다」로 표시하면 안 된다.
이 비교만으로 전후 차이를 검수의 인과적 효과로 판단하지 않는다.
