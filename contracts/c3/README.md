# C3 카드 저장·승인 계약 v0.1 초안

작성(P5 최동준, S15P31C108-174 / -180~-184) → backend(P7 장성우) · 카드 계약(P2 박준우, -171) · 관리자 화면 담당. 받는 쪽 리뷰 전 초안이다.

구현: `V0027__create_card_storage.sql`(표) + `V0028__card_validation_and_approval.sql`(검사 · 승인 함수, MR !86) + `V0030__align_card_checks_with_card_design.sql`(#171 리뷰 반영으로 V0028의 함수 세 개를 같은 시그니처로 다시 정의). 이미 적용된 migration의 이름/내용은 바꾸지 않는다. Flyway는 운영 지표나 승인본을 seed하지 않는다.

## 저장 구조와 V0013 호환

| 표 | 키·주요 칸 | 쓰는 시점 |
| --- | --- | --- |
| `card` | 기존 6칸 유지. `status`, `current_version`, `draft_spec`, `draft_revision`, `approved_draft_revision`, `updated_by/at` 추가 | 초안 저장 및 승인 |
| `card_version` | `(card_id,version)`, `spec`, `draft_revision`, `approved_by/at`, 내부 `created_tx` | 승인 트랜잭션에서 1회 |
| `indicator` | `indicator_id`, `definition`, `rule`, `rule_version`, `numerator_id`, `denominator_id`, `base_id`, `added_by_card`, `status`, `updated_by/at` | 관리자 지표 등록·수정 |
| `indicator_rule_history` | `(indicator_id,rule_version)`, 전체 행 `snapshot`, 변경자·시각 | 최초 등록/정의·규칙·의존성 변경 시 |
| `card_claim_item` | `(card_id,version,item_order)`, 지표 ID·규칙 버전·main/related | 승인 시 spec에서 투영 |
| `card_evidence_policy` | `(card_id,version,kind)`, `required` | 승인 시 종류별 4행 |
| `card_evidence_bind` | `(card_id,version,kind,seq)`, `spec_id`, 원본 `binding` JSON | 승인 시 |
| `card_rebuttal` | `(card_id,version,rebuttal_id)`, 순서·원본 정의 JSON | 승인 시 |
| `card_revision` | revision ID, 카드 ID·from/to 버전·사유·승인자·시각 | 승인 성공 시 |

V0013의 `domain`은 `C 인구·지역소멸`처럼 이름을 포함한 문자열, `parent_question`은 문장으로 유지한다. 이번에는 별도 `parent_question` 표로 옮기지 않는다. 공통 상한선·금지어도 승인 시 spec 배열로 고정하며 별도 운영 편집 표는 추가하지 않는다.

기존 C1/A3는 `status=legacy`, `card_version=1`, `current_version=null`이다. 기존 숫자를 승인 증거로 바꾸지 않는다. 첫 실제 승인은 **v2**이며 기존 v1 질문·근거 상태는 보존한다. 신규 카드는 `status=candidate`, 버전 0, 최초 승인 v1이다. `card.card_version`은 승인 시 `current_version`과 함께 증가한다.

일반 목록/질문은 `legacy`와 `card`만 조회한다. 후보와 `on_hold`는 제외된다. `on_hold` 전환 UI/API는 후속이다. 초안 수정은 이름·영역·대표 질문 등 현재 공개 메타를 바꾸지 않는다. 승인 성공 시에만 새 spec의 메타를 공개한다.

`v_card_usable`은 승인된 최신 정의만 반환한다. 과거 판정 재현은 반드시 `(card_id, version)`으로 `card_version`을 읽는다. legacy v1의 정의 조회는 없음(404)이며 최신 정의로 대체하지 않는다.

## 지표와 규칙의 단일 원본

`definition`은 #171 `contracts/cards/indicators.json`의 한 행을 그대로 저장한다(`id`, `label`, `unit`, `period_type`, `place_level`, `roll`, `source`, `value_direction`, `cards` …). 여기에 더하는 칸은 모두 선택이다: `shape`(생략하면 value, value/flow/ratio/grade_days), ratio의 `multiplier`, grade_days의 `cut`, 설명용 `target`. #171 지표 6개가 그대로 저장되는지는 `CardDesignContractTest`가 확인한다.

- **연령은 지표 ID 끝(`_19_39`)이 유일한 원본이다**(#171 · observation view와 같음). `target`은 글이라 검사에 쓰지 않는다.
- `place_level`: sido / sigungu / emd / station(#171과 같음).
- `roll.method`: sum / mean / end_of_period. 옛 SQL의 `year_end`는 end_of_period로 변환한다. sum/mean은 min_months 1~12 필수.
- `period_type`: 원천 자료 주기 Y/M. `roll`은 판정용 연 집계 방식이며 화면 series와 별개.
- ratio: 분자·분모 FK와 `definition.multiplier` 숫자. grade_days: base FK와 `definition.cut` 숫자.
- rule: #171 카드의 `rule` 객체를 주 지표 행으로 옮긴다(시공간 명세 4절 지표 사전과 같음). rule_id/formula_version/thresholds 객체/outcomes 배열 필수. `indicator_id`가 있으면 그 지표 행 ID와 같아야 하고, outcomes 마지막 `when`은 `otherwise`다. #171의 `min_years`, `outcomes[].meaning`은 그대로 남는다. 숫자 임계의 업무적 타당성은 카드 작성·검수 책임이다. 규칙을 SQL 문자열로 실행하지 않는다.
- **제약: 지표 하나에 규칙 하나다.** 같은 주 지표를 다른 규칙으로 판정하는 카드가 생기면 지금 구조로는 막힌다. 그때는 규칙 전용 지표 행을 새로 등록하거나 규칙을 카드 쪽으로 옮기는 변경이 필요하다.
- 정의·규칙·분자·분모·base 변경 시 rule_version 증가. 과거 이력은 수정/삭제 불가. 검증 상태만 바뀌면 규칙 버전은 유지한다.
- `added_by_card`는 **그 지표를 만든 카드** 하나다. 지표를 **쓰는 카드**는 승인본의 `card_claim_item`(판단 항목)과 `card_evidence_bind.binding->>'indicator_id'`(근거)에서 구한다. #171 `cards`는 정의 JSON에 남아도 검사에 쓰지 않는다.
- unverified 지표는 그 지표를 추가한 카드가 승인될 때 의존성까지 verified가 된다. 다른 카드 소유의 미검증 지표는 승인에 사용할 수 없다. `verified`는 정의 검수이며 수집 완료를 뜻하지 않는다.

승인본 `spec.rule`은 주 지표 rule에 `indicator_id`, `rule_version`을 넣은 복사본이다. `spec.indicator_snapshots[]`는 main/related와 재귀적으로 참조한 분자·분모·base의 **전체 행**을 보존한다. claim_items에는 순서와 역할만 유지한다. FK 조인은 탐색용이며, 과거 실행에 현재 사전의 값을 대입하면 안 된다.

## spec 형식과 옛 SQL 초안 매핑

develop에 병합된 #171 계약([contracts/cards](../cards/README.md), S15P31C108-171)의 키를 따른다. 그 C1/A3 설계도를 운영 승인본으로 자동 등록하지 않는다.

| 옛 SQL 초안 | 저장 계약 |
| --- | --- |
| 첫 번째 판단 항목이 주 지표 | claim_items의 `role=main` 정확히 1개, related는 보조 |
| comparability.indicator/period/boundary/method | same_indicator/same_period_length/same_boundary/same_method |
| required_for_claim의 boolean | required / optional |
| evidence[].sp_id | spec_id. 미등록 · 없는 소스는 null + note(없음 사유). 종류마다 1개 이상(양식 「비우지 않는다」) |
| warrant 문자열 | `{status:draft 또는 approved, text}` |
| rebuttals 배열 | `{status,items:[{id,text,...}]}`. 기존 조건·확인 소스·다른 해석도 추가 키로 보존 가능 |
| ceiling.card/common | 합친 ceiling 문자열 배열 |
| applicability.min_periods | min_complete_years, population, place_level |
| 생략됐던 A7/B5/C5 | inclusion/exclusion, max_claim_level(observed_fact/calculated/associated), expected_gaps를 저장 가능 |
| 승인 기록 | #171 `approval`(대표 승인 칸 기록: approved_fields · source)은 초안 그대로 보존. 저장 승인 기록은 `card_approval` |

`draft_spec`은 미완성 객체도 저장한다. 저장 API는 author를 세션 사용자로 기록하고 card_id/card_version/status/taxonomy_version/rule/card_approval/indicator_snapshots는 요청에서 제거한다. 이 값들은 승인 시 서버와 지표 사전이 만든다. 승인본은 보증·반박 status도 approved로 고정한다.

## 검증·승인

`card_spec_check(spec)`는 check_no/ok/label 10행(0~9)을 반환한다. 잘못된 JSON 구조는 검증 실패로 반환하며 빈 체크나 null 결과로 승인하지 않는다.

| # | 검사 | 양식 칸 |
| --- | --- | --- |
| 0 | JSON 객체, 이름 · 영역 · 대표 질문 · 작성자 | A2 · A3 · A4 · F2 |
| 1 | 판단 문장에 `{판정값}` 한 개, 공통 금지어(확산 · 전파 · 원인 · 효과 · 소멸) + 카드 `forbidden_terms` 없음. 「원인은 판단하지 않음」 같은 부정문은 허용 | B1 · E3 |
| 2 | 근거 4종 각각 1개 이상(소스 없으면 spec_id null + note), 필수 정책 required/optional | C1–C4 · C6 |
| 3 | 보증 1개 + 경쟁 설명 2개 이상(id 중복 없음) | D1 · D2 |
| 4 | 비교 조건 4가지 | B3 |
| 5 | 시공간 유형(분포형 · 변화형 · 이동형 · 사건형) + 판단할 수 없는 것 | A5 · D3 |
| 6 | 사전 지표 1–3개, 주 지표 1개, 주 지표 규칙 있음 | B2 · B4 |
| 7 | 판단 문장 · `applicability.population`의 연령 숫자 = 주 지표 ID 끝 연령. 연령 없는 지표는 문장 · population에도 연령이 없어야 함 | B1 · B6 |
| 8 | 적용 조건(place_level · min_complete_years), 허용 판단 수준, 선택 문자열 배열 | B5 · B6 · A7 · F1 |
| 9 | 지도 표현 `map_mode` + 범례 문구 `legend_text`(대표 승인 칸) | E1 · E2 |

양식 B4는 규칙을 비워도 승인 가능(실행 결과 review_required)으로 적지만, 지금 검사는 주 지표 규칙을 요구한다. C1 · A3는 대표가 규칙까지 승인했으므로 당장 문제는 없고, 바꾸려면 검사 6과 CardRule의 규칙 없음 처리를 함께 정한다.

`approve_card(card_id, actor, expected_draft_revision, reason)`는 다음을 한 트랜잭션에서 처리한다.

1. 카드 행을 잠그고 초안 수정 번호·이미 승인한 초안인지 검사.
2. 지표 사전 쓰기를 잠시 막고 동일 정의로 완성 검사. 카드 ID와 domain 첫 글자, 지표 의존성 순환·외부 미검증 지표도 검사.
3. 자기 카드가 추가한 지표를 확정하고 재귀 의존성 전체를 스냅샷.
4. 승인본과 판단 항목·근거 정책/연결·경쟁 설명 저장.
5. 변경 이력 기록 후 공개 메타와 버전 갱신. 어느 단계든 실패하면 전부 롤백.

승인본·자식 행·승인 이력은 UPDATE/DELETE가 금지된다. 자식 INSERT는 같은 승인 트랜잭션에서 이력을 기록하기 전까지만 가능하다. 승인 이력 기준 봉인은 현재 버전 포인터와 독립적이다. 미완성 승인 헤더를 따로 커밋하면 지연 제약 트리거가 거절한다. 승인자·사유는 필수다.

## 관리자 API

기계 명세: [openapi.json](openapi.json). 기존 세션 인증·ADMIN·CSRF 정책을 사용한다. 승인자는 요청 필드가 아닌 Principal이며 대표 전용 역할은 이번 범위에 없다. 경로 파라미터 `{id}`는 카드 또는 지표 ID다.

| 메서드·경로 | 입력/결과 |
| --- | --- |
| POST /v1/admin/cards | card_id/name/domain/parent_question → 후보 생성(201) |
| GET /v1/admin/cards/{id}/draft | card_id/status/card_version/current_version/draft_revision/draft_spec |
| PUT /v1/admin/cards/{id}/draft | expected_revision + spec 객체 → 저장 후 초안 |
| GET /v1/admin/cards/{id}/checks | draft_revision/valid/checks[] |
| POST /v1/admin/cards/{id}/approvals | expected_revision + reason → 승인 버전(201) |
| GET /v1/admin/cards/{id}/versions/{version} | card_id/version/spec/draft_revision/approved_by/approved_at |
| GET /v1/admin/cards/{id}/revisions | revision_id/from_version/to_version/reason/approved_by/created_at 배열 |
| GET /v1/admin/indicators/{id} | 지표 정의·규칙·버전·의존성·검증 상태 |
| PUT /v1/admin/indicators/{id} | expected_rule_version(최초 0), definition, rule?, 분자/분모/base?, added_by_card?, verified → 저장한 지표 |

초안의 expected_revision은 마지막 조회 값이며 저장 때마다 증가한다. 지표는 마지막 조회 rule_version을 전달한다. 오래된 수정 번호, 같은 초안 재승인, 중복 ID는 409 HTTP_ERROR다. JSON 구조/사전 정의/승인 조건 위반은 400 INVALID_REQUEST, 없는 리소스는 404 RESOURCE_NOT_FOUND다. 기존 [공통 오류 계약](../http-errors/README.md)의 problem+json을 사용하고 SQL 내용은 노출하지 않는다. 체크 결과는 완성도 검사이며 승인 시 다시 검사한다.

## 테스트 예시와 후속 연결

[c1-draft.json](examples/c1-draft.json)은 사용자가 제공한 15–39세 C1 SQL을 변환한 **테스트 fixture**다. `ind_101_15_39`/`ind_102_15_39`/`ind_103_15_39`(연령을 ID 끝에 둠)와 direction_majority 테스트 규칙은 통합 테스트에서만 만든다. Flyway는 운영 지표나 승인본을 seed하지 않는다. #171의 19–39세/최신 규칙과 혼용하지 않는다. #171 설계도 자체(`contracts/cards/C1.json` · `A3.json` · `indicators.json`)는 `CardDesignContractTest`가 그대로 저장 · 검사 · 승인해 본다.

운영 지표 사전과 C1·A3 첫 승인본(v2)은 Flyway 밖 `backend/db/seed/cards-c1-a3.sql`을 개발·운영 DB에 한 번씩 손으로 실행해 넣는다(S15P31C108-159). 이 파일은 `node scripts/card-seed.mjs`가 위 #171 설계도로 만들고, `CardDesignContractTest`와 같은 방식(지표 행 · 규칙 그대로, 초안은 저장 API가 빼는 칸만 뺌)으로 넣은 뒤 `approve_card()`를 불러 같은 검사를 거친다. 승인자는 실행할 때 `issue_atlas.approver`로 받은 관리자 로그인 이메일이다. 실행법은 [contracts/cards README](../cards/README.md) 「운영 DB 에 넣기」, 검증은 `CardSeedIntegrationTest`.

CardRule 소비: 실행의 카드 버전으로 승인 spec을 읽고 spec.rule + indicator_snapshots의 정의/roll을 observation series에 적용한다. 인터페이스 변경과 실제 판정 구현은 P7/P5 후속이며 이번 변경은 CardRule을 수정하지 않는다. 기존 QuestionService의 근거 정책·보증 조립까지 DB 정의를 읽도록 연결하는 작업 역시 소비자 측에서 맞춰야 한다. 승인 UI, document_card_tag, argument_rebuttal은 후속이다.

검증: CardStorageIntegrationTest(실제 Flyway·JSON·불변성·롤백·권한), CardDesignContractTest(#171 C1 · A3 · 지표 사전 그대로), CardSeedIntegrationTest(운영 seed가 계약과 같은 v2를 만드는지 · 재실행 · 승인자 필수 · 사전 불일치 중단), CardStorageConcurrencyTest(별도 PostGIS의 두 연결), 기존 PlaceCardsIntegrationTest 및 QuestionApiTest. 운영 DB 접속 없이 Testcontainers에서만 실행한다.

## 변경 이력

- v0.1 (2026-11-02): 초안.
- v0.1.1 (2026-11-02, V0030): #171 리뷰(박준우) 반영. target 선택 칸, 연령은 지표 ID 기준, place_level을 #171과 통일(sigungu_pair 제외), 금지어에 카드 forbidden_terms, 검사 9 지도 표현 · 범례, 규칙 indicator_id · otherwise 검사, max_claim_level에서 insufficient_evidence 제외, none_reason 대신 null + note, 저장 승인 기록을 card_approval로 분리. 지표 1–3개 상한은 양식 B2 근거로 유지.
