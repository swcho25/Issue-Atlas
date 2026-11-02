# feat/question-argument-api — 질문 저장 · 실행 · 논증 카드 조회 API

- Jira: S15P31C108-133 · PRD: FR-A3 · FR-B2 · FR-C4 · 묶음/단위: P7 · 앞선 작업: -136(!72, `existing_response`)

## 완료 조건
- [x] C2 충돌 정리: 없는 카드(`card_id = null`)를 argument 스키마가 받는다(빈 문자열 · 검사 끄기 없이)
- [x] `POST /v1/questions` 가 지역 × 카드 × 기간을 저장하고 실행마다 새 `run_id` 를 준다. 없는 카드는 `card_id = null` + `unsupported`
- [x] 질문 · 실행 · 결과 · 쓴 근거(판)를 Flyway 표에 남기고, 지난 실행을 덮어쓰지 않는다
- [x] 판정 규칙은 카드별 연결 지점으로 부른다(규칙 코드를 다시 만들지 않는다). 규칙이 없으면 판단하지 않았다고 적는다
- [x] 6칸 문장은 LLM 없이 템플릿으로 만든다
- [x] -136 기존 대응 후보를 지역 · 기간 · 카드로 확인해 「기존 대응」에 잇는다
- [x] `GET /v1/arguments/{run_id}` 가 저장된 결과를 C2 형태로 준다. 없는 실행은 404
- [x] 테스트: 실행마다 다른 run_id · null/unsupported · 잘못된 지역/기간 · 없는 run_id · C1/A3 정상 · 부족을 C2 스키마로 검사

## 진행
- 2026-11-01: 판정 규칙(P5) · 카드 정의(보증 · 경쟁 설명 · 상한선) · 출처 등급(`source.reliability_grade`)이 저장소에 없다. 카드별 `CardRule` 빈 연결 지점만 두고, 규칙 없는 카드는 「판정 규칙이 아직 연결되지 않아」 unsupported 로 남긴다. 테스트의 규칙은 테스트 전용 가짜
- 2026-11-01: C2 충돌 — argument `question.card_id` · `card_name` · `card_version` · `formula_version` null 허용, card_id null 이면 unsupported 를 스키마가 검사. 예시 `argument-unsupported.json`
- 2026-11-01: 기존 대응 — 출처 등급이 있는 출처의 후보만 evidence 로 만든다. 지금 로컬은 youthcenter 등급 null · lofin 출처 행 없음 → 실데이터 실행에서는 모두 review_pending
- 2026-11-01: 로컬 DB V0019 적용. 2023–2025 질문에 이어질 후보: C1 세출 349 · 온통청년 3, A3 세출 97 (여수 C1 115 · A3 18 등)
- 2026-11-01: Flyway 번호 V0019 → V0020. !74(S15P31C108-163)가 V0018 을 써서 -136 표가 V0019 로 밀렸다(같은 번호 변경 커밋을 이 브랜치에도 가져옴). database 변경 이력은 v0.1.15
- 2026-11-01: 검사 — QuestionApiTest 7 · C2ExamplesTest 2 통과
- 2026-11-01: 다시 V0020 → V0023. 정우현 !77 · !76 · !78 이 V0019 – V0021 을 먼저 쓰고 -136 표가 V0022 로 밀렸다. database 변경 이력은 v0.1.18

## 다음 할 일 / 범위 밖
- 최동준(P5): 카드별 `CardRule` 구현(또는 engine 호출 어댑터) — formula_version · claim/level · 지표 이름 · 비교 조건 4개 · 통계/문서/분모 evidence_id, 카드 정의(보증 · 상한선 · 경쟁 설명)
- 출처 등급: `source.reliability_grade` 를 youthcenter · lofin 에 채우고, 세출 수집기가 `source` 에 `lofin` 행을 등록
- 경쟁 설명 ⑤ 는 `[]` — 카드 정의 + AI(P5) 연결 후
- 근거 수요표의 통계 · 문서 · 분모 상태는 `card_evidence_status`(P3/P4 작성기 없음)
