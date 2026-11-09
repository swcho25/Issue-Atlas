# feat/rebuttal-check-per-item — 반박 인용 검사 반박 단위 적용

- Jira: S15P31C108-325(관련 S15P31C108-160) · PRD: — · 묶음/단위: P5 ⑤ 반박 문장화

## 완료 조건
- [x] 반박 하나만 검사에서 떨어지면 그 반박만 needs_review(note·인용 비움)로 낮추고 나머지 반박은 그대로 낸다. 형식·판단 값·반박 목록이 바뀐 경우는 지금처럼 OUTPUT_REJECTED (engine 테스트)
- [x] AI 계약 phrasing-result: done 에도 낮춘 반박의 problems 를 담을 수 있고, 검사 이름에 sign_wording 추가. README 「출력 검사」에 반박 단위 처리 · 판 번호 · 받는 쪽 영향(backend 그대로)을 적는다
- [x] 실험에서 탈락했던 여수 대기질 실행(깨진 요약 P8)을 다시 돌려 done 이 되고 A3-R3 만 needs_review 로 나온다 (로컬 확인, GMS 1~2회)
- [x] engine lint·test 통과

## 진행
- 2026-11-10: 시작. 계기는 반박 RAG 확인 실험(로컬 `test/rebuttal-rag-eval`)에서 깨진 기사 요약(「대기오xygen 측정값 조작」) 한 줄 때문에 여수 대기질 실행의 ⑤ 반박 4개가 모두 버려진 것.
- 2026-11-10: `phrase.py` — 검사 문제의 `where` 가 반박 ID 가 아니면(모양 · 판단 값 · 경쟁 설명 목록) 전체 OUTPUT_REJECTED, 반박 ID 면 그 반박만 needs_review(문장은 카드 경쟁 설명 그대로, 인용 비움, provenance llm_judgment)로 낮추고 done, problems 는 결과에 남김. 결과 판 `ai-phrasing-result-0.4`.
- 2026-11-10: AI 계약 v0.4 — 스키마 done 에서 problems 허용, 검사 이름에 sign_wording(v0.3.1 에서 빠짐) 추가, 예시 `phrasing-result-done-review.json` 추가, rejected 예시를 judgment_changed 로. README 출력 검사 · 결과 · 처리 상태 · 변경 이력, 계약 색인. backend · DB 는 그대로(`argument_phrasing.problems` 를 상태와 상관없이 저장, DB 에 done ⇔ 사유 없음만 있음).
- 2026-11-10: 테스트 — 부호 낱말 탈락은 R1 만 낮춤, 깨진 인용은 그 반박만 낮추고 다른 반박 인용은 유지, 판단 값 · 반박 목록이 바뀌면 반박 탈락이 함께 있어도 전체 거부, 전체 실패 테스트의 탈락 사례를 판단 값 변경으로. engine ruff · pytest 631개 통과.
- 2026-11-10: 로컬 확인 — 실험 자료의 여수 대기질 실행을 develop 프롬프트 v5 · 실험 B 입력으로 다시 문장화(GMS 1번): done, problems = quote_not_in_source A3-R3 P8, A3-R3 만 needs_review, 나머지 3개 not_found 그대로. 전에는 OUTPUT_REJECTED 로 ⑤ 칸 전체가 비었다.
- 2026-11-10: `pnpm check:all` 통과(harness · backend format · frontend lint·typecheck·test·e2e · backend build · engine lint · engine test). 첫 실행에서 frontend `AskPage.test.tsx` 하나가 이슈 목록을 못 찾아 실패했지만 그 파일만 다시 돌리면 8개 모두 통과했다. 다시 돌린 전체 검사도 통과했다(이 MR 은 frontend 를 바꾸지 않음, 부하 때 시간 문제로 보임).

## 다음 할 일 / 범위 밖
- 화면은 needs_review 를 지금처럼 표시한다(C2 · 프론트 변경 없음). 낮춘 이유를 화면에 보일지는 따로 정한다
- 반박 RAG(검색 · 프롬프트 v6)는 이 MR 범위 밖(실험 결과 `test/rebuttal-rag-eval` RESULT.md)
