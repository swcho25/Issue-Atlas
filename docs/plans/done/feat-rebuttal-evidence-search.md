# feat/rebuttal-evidence-search — ⑤ 반박별 근거 기사 검색 적용

- Jira: S15P31C108-326 · PRD: — · 묶음/단위: P4·P5 (⑤ 반박 근거 RAG)
- 반박 RAG 의 MR 2 다. MR 1(!231, `card_rebuttal_profile` · `embed-cards` 반박 질의, 머지됨)에서 분기했다. 질문 실행의 ⑤ 반박 문장화가 카드 꼬리표 기사 앞 40건 대신, 반박마다 그 지역 · 기간 기사에서 고른 5건을 보게 한다.

## 완료 조건
- [x] backend 가 승인 판의 활성 반박 질의가 카드 반박을 모두 덮으면, 질문 지역 · 기간의 기사(활성 벡터 있는 것 전부)와 반박별 코사인을 문장화 요청 `rebuttal_search` 로 보낸다. 덮지 못하면 보내지 않는다 (backend 테스트)
- [x] engine 이 `rebuttal_search` 가 있으면 반박마다 R3(코사인과 지역 글자 2~4조각 TF-IDF 유사도의 평균) 상위 5건을 반박 순서대로 합쳐 근거 구절로 쓰고, 없으면 지금처럼 `articles` 를 쓴다. TF-IDF 는 scikit-learn 없이 계산하고 scikit-learn 과 1e-9 안에서 같다 (engine 테스트)
- [x] 프롬프트 `argument-phrasing-v6`(v5 + 규칙 3-1: 경쟁 설명이 말하는 변화가 실제로 일어났다는 사실만 근거)
- [x] 결과 `retrieval`(방식 · 질의 판 · k · 후보 수 · 반박별 순위 · 점수)을 backend 가 `argument_phrasing.retrieval`(Flyway V0054)에 남긴다. C2 응답은 그대로
- [x] AI 계약 v0.5(요청 v0.3 · 결과 v0.5 · 예시), DB 계약, 색인 갱신
- [x] 실험 자료 12 실행에서 engine 이 고른 기사가 확인 실험 B6(R3) 와 같다
- [x] 로컬 사본에서 backend + engine 으로 질문을 실제로 돌려 `retrieval` 이 저장되고 ⑤ 가 차는 것을 확인(결과 화면은 로그인 필요 · 로컬 회원가입 없음 → 화면이 읽는 `GET /v1/arguments` 응답으로 확인. 화면 코드는 바꾸지 않는다)
- [x] `pnpm check:all` 통과

## 진행
- 2026-11-10: 시작. 설계 — 전역 TF-IDF 를 미리 저장하면 2023–2025 적중이 62%→46% 로 떨어져, 질문 때 그 지역 · 기간 기사로 TF-IDF 를 만든다. 그래서 backend 는 기사 요약 · 코사인을 넘기고 engine(상태 없음)이 고른다. 지역 · 기간 기사는 여수 545건 · 광주 구 55~180건, 요약 평균 55자라 요청이 크지 않다. 기사 링크는 넘기지 않는다(인용 원문 위치의 `url` 은 null, 원천 ID 로 찾는다).
- 2026-11-10: engine `retrieve.py`(순수 Python 글자 TF-IDF · R3 · 상위 5 · 고른 기록), `phrase(search=…)`, 프롬프트 v6, 결과 v0.5 `retrieval`. TF-IDF 는 scikit-learn 과 1e-9 안에서 같다(테스트). 새 engine 테스트 11개, 전체 647개 통과.
- 2026-11-10: 실험 재현 — 실험 자료(저장소 밖 `data.json`) 12 실행에서 engine `select` 가 고른 기사 · 반박별 순위가 확인 실험 B6 가 실제로 보낸 것과 12/12 같다.
- 2026-11-10: backend — `QuestionRepository.rebuttalQueries` · `rebuttalArticles`(observation 기사 × 활성 반박 질의, pgvector 코사인), `ArgumentPhraser.search`(질의가 반박을 모두 덮을 때만, 같은 기사는 한 번), V0054 `argument_phrasing.retrieval`. 질문 API 테스트 2개 추가(지역 · 기간 기사 · 코사인 · 기록 저장 / 질의 하나 빠지면 보내지 않음), 기존 테스트에 「질의 없으면 안 보냄」 확인. QuestionApiTest 44 · Foundation · Architecture 통과.
- 2026-11-10: 로컬 실제 실행(`issue_atlas_rebuttal_check`, V0054 적용, engine + backend, GMS 2회).
  - 여수 C1 2023–2025: `rebuttal_r3` 후보 545건 · 20개 선택, 순위까지 확인 실험 B6 와 20/20 같다(실제 pgvector 코사인 · 다시 만든 질의 벡터로). ⑤ 산단 고용 `supported`, 나머지 `not_found`. 이 사본은 카드 판을 올린 뒤 `score` 를 안 돌려 꼬리표 기사가 0건인데도 근거를 찾았다.
  - 여수 A3: `done`, 반박 4개 모두 `not_found`, 검사 문제 0(확인 실험에서 깨진 요약으로 탈락하던 실행).
  - 시간: backend 기사 쿼리 약 0.1초, engine 고르기 0.07초(545건), 요청 중 검색 재료 약 180KB. 문장화 11~13초는 대부분 모델 시간(예전 v4 실행도 11초).

- 2026-11-10: 리뷰 보완 — 검색 재료를 읽다 DB 오류가 나면 질문 전체를 깨지 않고 카드 태그 기사로 문장화(경고 로그), 반박 ID 가 겹쳐도 기사가 빠지지 않게. `pnpm check:all` 통과(harness · backend format · frontend lint · typecheck · test 270 · e2e · backend build(test 포함) · engine lint · test 647).

- 2026-11-10: 마무리. !231 이 develop 에 머지된 것(c07471ac) · develop 에 V0054 가 없는 것을 확인하고 계획을 done 으로 옮겨 커밋 · MR.

## 다음 할 일 / 범위 밖
- 배포 순서: 옛 engine(요청 v0.2)은 `rebuttal_search` 를 모르는 칸으로 보고 422 를 낸다 → backend `ENGINE_ERROR`, ⑤ 는 카드 문구(실패는 캐시하지 않아 engine 이 올라오면 바로 낫는다). 반박 질의가 있는 DB 에서만 생기므로, engine 이 backend 보다 늦게 뜨는 동안만 그렇다. 새 engine 은 옛 backend(검색 재료 없음)에도 그대로 동작한다
- 개발 서버: MR 1 배포 뒤 `embed-cards --apply` 를 돌려야 검색 재료(반박 질의)가 생긴다. 그 전에는 지금처럼 카드 꼬리표 기사로 쓴다
- 범위 밖: 반박 라벨 사람 검토(관련 59 · 불일치 179), 점수 하한값(같은 자료로 정하면 과적합), 통계 · 메타데이터로 푸는 반박(기준 개정 · 통계 개편 · 코로나 회복 · 국외 유입) 규칙 판정
