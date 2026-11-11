# feat/rebuttal-citations — ⑤ 반박 인용 기사 응답 추가

- Jira: S15P31C108-343 · PRD: — · 묶음/단위: P5 (논증 엔진)
- 「근거 있음」 반박의 인용(기사 · 날짜 · 인용문)은 지금 `argument_phrasing.citations` 에만 있고 화면 응답(C2)에 없다. 이 브랜치는 MR A(계약 + backend)다. 결과 화면 표시는 MR B(디자인 합의 뒤).

## 완료 조건
- [x] C2 argument `rebuttals[]` 에 선택 칸 `citations [{article_id, date, quote, evidence_id}]` — 동결 문서 「추가」와 C2 README 이력
- [x] backend 가 문장화 done 일 때 「근거 있음」 반박에만 엔진 인용을 반박 순서대로 붙인다. 근거 없음 · 검토 필요 · 실패는 칸 없음 (backend 테스트)
- [x] 인용된 기사의 문서 근거 행(`ev_news_`)을 만들어 `evidence_id` 로 근거 상세 API 가 열린다 (backend 테스트)
- [x] 로컬 사본에서 여수 C1 질문 응답에 인용이 붙는다
- [x] `pnpm check:all` 통과

## 진행
- 2026-11-11: 시작
- 2026-11-11: C2 스키마 `rebuttals[].citations`(선택, minItems 1) · C2 README 표 · 변경 이력 · 동결 문서 「추가」. engine 요청(판정 입력)은 `rebuttals` 를 보내지 않아 engine 은 그대로.
- 2026-11-11: backend — `Rebuttal.citations`(`@JsonInclude(NON_NULL)`, `baseline` 과 같은 방식) · `Citation`. `ArgumentPhraser.cite`: done 결과에서 `supported` 반박에만, 엔진 반박 ID(요청 `rebuttal_candidates` 순서, ID 없으면 R1 …)로 인용을 찾아 기사 인용만 붙이고 같은 기사 같은 인용문은 한 번. 반박 수가 경쟁 설명 수와 다르면 붙이지 않는다. `QuestionService.withCitationEvidence`: 저장 트랜잭션에서 인용 기사 문서 근거 행(`ev_news_`, 기사 근거와 같은 SQL 을 `ARTICLE_ROWS` · `INSERT_ARTICLE_EVIDENCE` 로 나눠 함께 씀)을 만들고 `evidence_id` 를 채운다.
- 2026-11-11: 테스트 — 질문 API 2개(근거 있음에만 인용 · 같은 인용 한 번 · 원본 없는 기사 evidence null · 근거 상세 열림 · 다시 물어도 근거 한 행 / 반박 수가 다르면 인용 없음). QuestionApiTest 46 · C2Examples · OpenApiContract · Architecture 통과.
- 2026-11-11: 로컬 사본(`issue_atlas_rebuttal_check`) 여수 C1 실제 실행(GMS 1회): 「산단 고용 변동」 supported 에 인용 2건(2024-05-22 여수산단 직원 이주 · 2024-12-19 석유화학 불황 채용 위축), 둘 다 `evidence_id` 가 있고 근거 상세가 실제 제목 · 원문 링크(동아일보)로 열린다. 다른 반박 3개는 칸 없음.
- 2026-11-11: `pnpm check:all` 통과(harness · backend format · frontend lint · typecheck · test · e2e · backend build(test 포함) · engine lint · test).
- 2026-11-11: 마무리. 계획을 done 으로 옮겨 커밋 · MR.

## 다음 할 일 / 범위 밖
- MR B: 결과 화면 논증 탭 ⑤ 아래 인용 표시(같은 인용문 전재 기사 묶기), Figma 합의
