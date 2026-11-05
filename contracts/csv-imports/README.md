# 관리자 CSV 요청 v0.1 — S15P31C108-236

프론트·데이터 담당 리뷰 대상 초안. **양식 다운로드 → 파일 검증 → 담당자 대기 → 담당자가 별도 적재 → 결과 기록**.
업로드/결과 API는 `normalized_record`·`raw_record`·지역·분류·관측 뷰를 수정하지 않는다.
`completed`는 담당자의 처리 완료 보고이며, API가 업무 DB 적재·서비스 노출을 자동 보증하는 상태가 아니다.

## API

모두 ADMIN 세션 필요. 쓰기는 기존 `X-XSRF-TOKEN` 필요. 오류는 [공통 HTTP 오류](../http-errors/)를 따른다.

| 메서드 | 경로(`/v1/admin` 기준) | 응답 |
| --- | --- | --- |
| GET | `/import-templates` | 양식 메타데이터 배열 |
| GET | `/import-templates/normalized-record/file` | UTF-8 BOM CSV 헤더 다운로드 |
| POST | `/imports` | multipart 업로드, 201 Request (같은 요청 재시도도 201) |
| GET | `/imports` | `{items: Request[], total, page, size}` |
| GET | `/imports/{id}` | `{request: Request, result: Result 또는 null}` |
| GET | `/imports/{id}/file` | 업로드 원본 다운로드 |
| POST | `/imports/{id}/results` | 담당자 처리 보고, 200 Detail |

목록 필터: `status`, `assignee_id`; `page` 기본 1, `size` 기본 20(1–100).
담당자는 기존 `GET /v1/admin/users`에서 활성 ADMIN을 선택한다. 본인 지정 가능.
담당자 변경·재처리·삭제 API는 이번 범위 밖. 실패 파일은 고친 뒤 새 `request_key`로 제출한다.

업로드 multipart:

| 이름 | 값 |
| --- | --- |
| `file` | `.csv`, 비어 있지 않은 최대 2 MiB |
| `template_version` | `1` |
| `assignee_id` | 활성 ADMIN ID |
| `request_key` | 영문/숫자/밑줄/하이픈 1–128자. 네트워크 재시도에는 같은 값 |

같은 작성자·키·파일 바이트·파일명·담당자·버전은 같은 요청을 돌려준다. 같은 키의 다른 내용은 409.
CSV 내용 오류는 201 `validation_failed`로 보관한다. 잘못된 폼·확장자·담당자는 400, 크기 초과 413.
파일은 요청 테이블 `bytea`에 보관되어 컨테이너 재생성 이후에도 남는다. 원본 내용은 JSON 응답이나 로그에 출력하지 않는다.
다운로드는 `no-store`, `nosniff`, 서버 고정 다운로드 이름을 쓴다. 원본 파일명은 표시용이며 경로로 사용하지 않는다.

## CSV 양식 1

이 양식은 **담당자에게 전달할 정제 자료 양식**이다. `normalized_record` INSERT용 전체 열 덤프나 C1 JSON 대체물이 아니다.
담당자는 원본 FK·P2 메타데이터·지역/분류 후속 연결을 기존 적재 절차에 맞춰 처리한다. API는 이 제약을 임의 완화하지 않는다.
자료가 서비스 조회에 노출되는지 확인한 뒤 완료로 보고한다.

UTF-8(BOM 선택), 쉼표 구분, 아래 **고정 순서의 헤더**를 사용한다. 따옴표로 감싼 쉼표·줄바꿈을 지원한다.
최대 2,000개 데이터 행, 셀당 최대 4,000자(`dedup_key` 512자). 추가 열(이름·전화번호 등)도 거부한다.
문자열의 수식 시작 문자 `= + - @`와 제어 문자를 거부한다(숫자 `value`의 음수 허용).
이 검사는 임의 개인정보를 완전히 탐지하는 기능이 아니다. 제목·요약에도 개인정보를 넣지 않아야 한다.

| 열 | 규칙 |
| --- | --- |
| `data_kind` | 필수 `indicator` 또는 `document` |
| `source_id` | 필수, 기존 source ID |
| `spec_id` | 필수, 해당 source에 속한 기존 source_spec ID |
| `dedup_key` | 필수, 데이터 담당자의 기존 정제 중복 키. 임의 번호 대신 원래 정제 규칙의 키 사용 |
| `place_id` | 필수, 기존 place ID. 사용자 지정, 자동 지역 매핑 없음 |
| `card_ids` | 필수, 기존 카드 ID를 `;`로 구분. 예: `C1;A3`, 반복 금지 |
| `period_start` | 필수, ISO 8601 시각과 UTC/오프셋. 예: `2024-01-01T00:00:00Z` |
| `period_end` | 필수, 시작보다 뒤인 시각. 끝 제외 구간 |
| `indicator_id` | 통계는 기존 지표 ID 필수. 문서는 빈칸 |
| `value` | 통계 수치. 유효숫자 최대 38, 소수 자리/지수 범위 ±18. 문서는 빈칸 |
| `unit` | 통계 필수. 문서는 빈칸 |
| `missing_reason` | 통계 값이 없을 때 `not_published` / `not_collected` / `license_blocked` 중 하나. value와 정확히 하나만 작성. 문서는 빈칸 |
| `title` | 문서 필수. 통계 선택 |
| `summary` | 선택, 정제·비식별화된 요약. 원문 본문 사용 범위는 기존 출처 정책 준수 |
| `url` | 선택, 사용자 정보 없는 HTTP/HTTPS URL. 서버가 URL에 접속하지 않음 |

`dedup_key`는 기존 P2 중복 식별자이며 전체 정제 표에서 조회한다. 파일 내 반복도 중복이다.
중복 행도 나머지 검증을 통과해야 한다. 파일을 바꾸지 않고 중복 행 번호를 표시하여 담당자가 제외한다.
검증 후 업무 DB가 바뀔 수 있으므로 담당자는 실제 적재 직전에 중복·참조를 다시 확인한다.

## 응답과 상태

Request: `import_id`, `requested_by`, `assignee_id`, `file_name`, `file_sha256`, `template_version`,
`status`, `revision`, `validation`, `created_at`, `updated_at`.
시각은 오프셋 포함 ISO 8601. ID는 문자열, 사용자 ID·revision·건수는 정수.

`validation` 예:

```json
{
  "total_rows": 3,
  "valid_rows": 3,
  "duplicate_rows": 1,
  "eligible_rows": 2,
  "error_count": 0,
  "errors_truncated": false,
  "errors": [],
  "duplicate_row_numbers": [4]
}
```

- `errors`: `{row, column, code}`. row는 헤더=1인 CSV 논리 행 번호(셀 안 줄바꿈은 행으로 세지 않음).
- 상세 오류 최대 100개. 총 오류 수는 `error_count`, 잘림은 `errors_truncated`. 셀 값은 반환하지 않는다.
- `valid_rows`는 검증 통과 행(중복 포함), `eligible_rows = valid_rows - duplicate_rows`.
- 인코딩·헤더·CSV 문법·행 제한·빈 자료는 파일 오류이며 행 건수는 0이다.
- **오류 하나 이상이면 전체 파일 처리 불가**. 정상 행만 부분 처리하지 않는다.
- 오류 0 + eligible 0이면 `no_changes` 종료, 오류 0 + eligible > 0이면 `pending`.
- `pending → completed / failed`만 가능. 나머지 상태·이미 끝난 요청은 처리 불가(409).

담당자 처리 보고:

```json
{
  "expected_revision": 0,
  "status": "completed",
  "reason": "별도 적재 및 서비스 조회 확인 완료",
  "loaded_rows": 2,
  "skipped_rows": 0
}
```

지정된 활성 담당자만 가능(403). revision 불일치·중복 완료는 409. 사유는 공백 제외 1–2,000자.
건수는 **검증 시 eligible인 행만** 대상으로 한다. 완료 시 loaded+skipped=eligible, 실패 시 합계≤eligible.
실제 적재 시 새 중복은 skipped에 포함하고 사유에 적는다. 실패 보고는 업무 DB 작업을 되돌리는 기능이 아니다.
Result: `status`, `actor_id`, `reason`, `loaded_rows`, `skipped_rows`, `created_at`.
결과는 append-only이며 DB 행 잠금으로 동시 결과 보고 중 하나만 반영한다.

## 구현 경계

V0045는 요청·파일·검증 결과·처리 보고만 추가한다. 기존 Flyway·업무 테이블·수집기 코드는 그대로다.
화면, 실제 적재 명령, 모델 재분류, 자동 승인·자동 적재, 통합 변경 이력 연결은 이번 범위 밖이다.
CSV 처리 이력은 `/imports/{id}`의 result로 조회한다.
파서는 [Apache Commons CSV RFC4180](https://commons.apache.org/proper/commons-csv/apidocs/org/apache/commons/csv/CSVFormat.html)을 사용한다.
