# 관리자 검수 API v0.1 초안 — S15P31C108-216

관리자 API 작성 → 프론트 · 데이터 담당자 리뷰 필요. 기계 명세는 [openapi.json](openapi.json).

## 이번 구현 범위

기존 자료 테이블·observation 뷰·수집/정제/분류 코드는 바꾸지 않는다. `review_request`, `review_change` 두 표만 추가한다. 데이터 담당자가 작업 중이므로 **자료·소스 수정 제안은 보관만 하며 실제 자료에 적용하지 않는다**. 기존 데이터를 과거 검수 요청으로 자동 변환하지 않는다.

| 대상 `target_type` | `target_id` | 현재 값 조회 | 처리 |
| --- | --- | --- | --- |
| news_event | news_id | 요약·사건 시각·지역·좌표 (본문 없음) | 현재 값 확정 / 보류 / 반려 |
| normalized_record | id(양의 정수 문자열) | 출처·명세·지표·지역 코드·값·정제 상태 (record/payload 본문 없음) | 동일 |
| press_release | press_id | 제목·부서·분류·지역 코드·발행일·링크·이용 조건 | 동일 |
| source | source_id | 출처명·기관·이용 조건·등급·robots 상태 | 동일. `scope=source`는 출처 **메타데이터 자체**이며 소스 전체 자료 일괄 수정이 아님 |
| card | card_id | 현재 초안·수정 번호·공개 버전 | 위 처리 + 초안 수정·지정 승인자 요청 연결 |

`global` 및 기사에서 `scope=source/card`로 바꾸는 일괄 처리는 지원하지 않는다(400). 자료·소스의 `correct`는 409이고 요청 상태·원본·이력 모두 바뀌지 않는다. 프론트는 상세의 `supported_actions`, `editable_fields`를 기준으로 버튼을 비활성화한다. 제안 가능한 필드는 `proposable_fields`로 별도 표시한다. 보류는 자동 재실행되지 않는다.

## 경로

| 경로 | 권한 · 동작 |
| --- | --- |
| POST /v1/review-requests | 로그인 사용자 신고. origin=user, submitted_by는 세션에서 결정. 201 {review_id,status}만 반환 |
| POST /v1/admin/reviews | 활성 ADMIN이 검수 등록. origin=admin. 201 Review |
| GET /v1/admin/reviews | ADMIN. status/origin/target_type/issue_type/card_id/q/page/size 필터 |
| GET /v1/admin/reviews/{id} | ADMIN. 요청 당시 값·현재 값·수정 제안·가능한 행위·이력·연결 승인 상태 |
| POST /v1/admin/reviews/{id}/decisions | 활성 ADMIN. 필수 사유·수정 번호를 검증하고 상태와 이력을 한 트랜잭션에서 저장 |
| GET /v1/admin/changes | ADMIN. 검수 처리 + 기존 카드 최종 승인 이력 통합 조회 |
| GET /v1/admin/changes/{id} | ADMIN. 처리자·사유·변경 전후 상세 |

모든 쓰기는 기존 세션·CSRF 규칙을 따른다. 비로그인 401, 역할/비활성 처리자 403, 입력 오류 400, 없는 대상 404, 종료 상태·오래된 수정 번호·다른 관리자의 수정·미지원 자료 반영 409. 오류 형식은 기존 [공통 오류](../http-errors/)의 problem+json이다. page 기본 1, size 기본 20·최대 100. 목록은 생성 시각 내림차순, 같은 시각이면 ID순이다.

## 요청 및 처리 흐름

신고/등록:
```json
{"target_type":"news_event","target_id":"기사 ID","issue_type":"location","card_id":"C1","reason":"실제 사건 지역과 다름","proposed_value":{"place_id":"kr-12130"}}
```

issue_type: location/classification/duplicate/value/wording/metadata/other. 이는 문제 분류이며 직접 실행할 SQL이나 수정 권한을 지정하지 않는다. origin의 local_import/model 값은 향후 데이터 담당자의 명시적 요청 등록용이며 이번 API는 해당 출처를 자동 생성하지 않는다. proposed_value는 선택 객체(최대 64KiB)이고 허용된 필드명만 받는다. **저장된 제안이 검증·적용됐다는 뜻은 아니다.**

일반 처리:
```json
{"expected_revision":0,"action":"hold","scope":"record","reason":"담당자 확인 필요"}
```

action=confirm/correct/reject/hold. pending → resolved/rejected/on_hold, on_hold → resolved/rejected. 같은 보류 반복은 409. 반려 이후 재요청은 새 검수 ID로 등록한다. confirm은 **현재 값이 맞다는 확인**이며 proposed_value를 적용하는 동작이 아니다. confirm/correct에는 상세에서 받은 `current_value` 전체를 `expected_value`로 보내야 한다. 값이 이미 바뀌었으면 409이므로 다시 조회한다. hold/reject는 expected_value가 필요 없고 기존 자료를 바꾸지 않는다. 모든 처리에 reason 필수(공백 제외, 최대 2,000자).

카드 수정:
```json
{"expected_revision":0,"action":"correct","scope":"card","reason":"카드 정의 검수","expected_value":{"draft_revision":1,"draft_spec":{},"current_version":null},"after":{"draft_spec":{}},"approver_id":2}
```
위 빈 객체는 구조 예시다. 실제로는 조회한 현재 값과 완성도 검사를 통과하는 전체 카드 초안을 보낸다. `after.draft_spec`을 기존 초안 저장 API와 동일하게 검증·저장하고, 205번 승인 요청을 생성한다. 본인 지정도 허용한다. 공개 버전은 이 시점에 바뀌지 않는다. 실패하면 초안·요청 상태·승인 요청·검수 이력을 전부 롤백한다.

생성된 `approval_request_id`는 [C3 승인 API](../c3/)에서 지정 승인자가 처리한다. 이후 검수 API로 중복 처리할 수 없다. 검수 목록/상세의 status는 실제 승인 상태를 반영한다: 승인 대기→approval_pending, 보류→on_hold, 승인→resolved, 반려→rejected. 상세 approval_status와 ID로 화면을 연결하며, 이 단계의 `supported_actions`는 빈 배열이다. 검수 revision은 검수 결정 횟수이며 카드 승인 쪽 revision과 다르다.

## 이력과 자료 보존

- review_change는 확정·보류·반려 및 카드 초안 수정마다 처리자 ID/이메일·사유·전후 값·시각을 조회한다. 확정/보류/반려는 전후 값이 같다. DB에서 이력 UPDATE/DELETE를 차단한다.
- 통합 이력의 `action=correct`는 **카드 초안 저장·승인 요청**이고, `action=approve`는 기존 card_revision의 **최종 버전 승인**이다. 같은 동작을 두 번 기록한 것이 아니다.
- 변경 ID는 `review_change:<UUID>` 또는 `card_revision:<숫자>`. 최종 승인 이력은 과거 계정과 연결할 수 없으면 actor_id=null이고 기존 approved_by 이메일을 actor_email로 유지한다.
- GET /changes 필터: target_type/target_id/scope/action/actor_id/from/to/page/size. 기간은 [from,to), 오프셋 포함 ISO 8601. 역전 기간 400. 이력은 읽기 전용이며 과거 카드 승인 이력도 새 테이블로 복제하지 않는다.
- 저장된 질문 결과를 재실행하거나 소급 변경하지 않는다. 자료 수정·소스/전체 규칙 일괄 반영은 담당자와 원천·미래 적재·오버라이드 우선순위를 정한 다음 별도 구현한다.
- migration은 V0037이다. 기사 카드 꼬리표 작업의 V0036과 최신 develop을 반영한 뒤 병합한다. 다른 진행 중 MR의 번호도 병합 전에 확인한다.
