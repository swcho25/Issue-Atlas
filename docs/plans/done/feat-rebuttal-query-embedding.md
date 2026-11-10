# feat/rebuttal-query-embedding — ⑤ 반박 검색 질의 임베딩 저장 추가

- Jira: S15P31C108-326 · PRD: — · 묶음/단위: P4·P5 (⑤ 반박 근거 RAG)
- 이 브랜치는 반박 RAG 의 MR 1 이다. 승인 카드의 반박 후보마다 검색 질의 벡터를 만들어 두기만 하고, **질문 실행 · 문장화는 바꾸지 않는다**. 지역 · 기간 기사에서 반박별 후보를 고르는 일(backend 코사인 + engine R3 · 프롬프트 v6)은 MR 2 에서 한다.

## 완료 조건
- [x] Flyway V0053 적용 뒤 `card_rebuttal_profile` 이 (카드, 카드 판, 반박 ID, 질의 판)마다 질의 문장 · 해시 · 모델 · `vector(1536)` 을 갖고, (카드, 반박)마다 활성 행이 하나뿐이며 없는 카드 판은 막는다 (backend 테스트)
- [x] `embed-cards` 가 카드 프로필에 이어 승인본 `rebuttals.items` 마다 「{카드 이름}의 다른 설명: {반박 문장}」(`rebuttal-query-v1`)을 임베딩한다. 미리보기는 저장하지 않고, 같은 판 · 같은 질의는 다시 부르지 않으며, 승인본에서 빠지거나 옛 판인 활성 질의는 끈다 (engine 테스트)
- [x] `contracts/article-card-search/README.md` v0.4 · 색인 줄 · `engine/README.md` 에 새 표와 실행 순서가 적혀 있다
- [x] 로컬 DB 사본에서 `embed-cards --apply` 로 반박 질의 8행이 활성으로 생기고, 두 번째 실행은 GMS 를 부르지 않는다
- [x] engine lint · test, backend 포맷 · test 가 통과한다

## 진행
- 2026-11-10: 시작. 반박 RAG 실험(`test/rebuttal-rag-eval` 로컬 전용, RESULT.md)에서 주 설정을 B(T2 질의 · 반박별 상위 5) + R3(T2 코사인과 지역 글자 TF-IDF 평균) + 프롬프트 v6 로 정했다. 응답이 1초쯤 늘어나는 것은 사용자가 받아들였다. 미리 계산한 전역 TF-IDF 는 2023–2025 적중이 62%→46% 로 떨어져 쓰지 않는다. 그래서 질의 벡터만 미리 저장하고 TF-IDF 는 질문 때 그 지역 · 기간 기사로 만든다(MR 2).
- 2026-11-10: V0053 `card_rebuttal_profile`(card_search_profile 과 같은 모양) · `model.rebuttal_queries` · `store` 읽기/저장/끄기 · `embed-cards` 반박 반복을 넣었다.
- 2026-11-10: 박준우 님 연락 — 개발 DB 카드가 판단 ① 문장 시드(-282)로 C1 · A3 v3 가 됐고, 부호 낱말 판은 v4 가 된다. 시드는 판 번호를 박지 않고 내용이 바뀐 카드만 다음 판으로 승인하므로 코드 변경은 없다. 판이 바뀌면 `embed-cards --apply` 뒤 `score --apply` 를 함께 돌려야 한다.
- 2026-11-10: 테스트. engine `test_rebuttal_query.py`(질의 문장 · 빈 항목 제외, 미리보기는 저장 안 함, 이미 활성은 건너뛰고 꺼진 것은 다시 켬, 옛 판 · 빠진 반박 · 옛 질의 판 끄기) 5개, backend `CardRebuttalProfileMigrationTest`(시드 승인본 반박 8행, 두 번째 활성 · 없는 카드 판 · 빈 반박 ID · 잘못된 해시 거부) 2개. 끄는 쿼리는 질의 판까지 맞춰 좁혔다.
- 2026-11-10: 로컬 사본 `issue_atlas_rebuttal_check`(issue_atlas_latest 복사, backend 실행으로 V0049~V0053 적용)에서 확인. 미리보기: 카드 프로필 1 · 반박 8 임베딩, 저장 없음. `--apply`: 반박 8행 활성(1536차원). 다시 `--apply`: GMS 호출 없음(0.04초). develop 시드를 다시 돌려 C1 v4 · A3 v3 로 올린 뒤 `--apply`: 카드 프로필 2 · 반박 8 새로 임베딩, 옛 판 8행은 꺼지고 새 판 8행만 활성. 판이 올라가면 질의 문장이 같아도 다시 임베딩한다(카드 프로필과 같은 규칙, 판마다 8회).
- 2026-11-10: `pnpm check` 통과(backend 포맷 · test 139초, engine lint · test 631개). `pnpm check:all` 통과(harness · backend 포맷 · frontend lint · typecheck · test · e2e · backend build · engine lint · test).

- 2026-11-10: 마무리. 계획을 done 으로 옮기고 커밋 · MR. develop 에 V0053 이 없음을 확인했다.

## 다음 할 일 / 범위 밖
- MR 2(같은 Jira): backend 가 질문의 지역 · 기간 기사와 반박 질의의 코사인을 함께 넘기고, engine 이 지역 글자 TF-IDF 로 R3 를 계산해 반박마다 상위 5건을 골라 프롬프트 v6 로 문장화한다. AI 계약 v0.5, 고른 이유(검색 기록) 저장 칸(Flyway), 브라우저 확인
- 개발 서버: 부호 낱말 시드(v4) → 이 MR 배포 뒤 `embed-cards --apply` → `score --apply` 를 한 번에 돌린다(판을 두 번 거치면 임베딩을 두 번 한다)
- 로컬 사본 `issue_atlas_rebuttal_check` 는 MR 2 확인에 다시 쓴다(V0053 · 반박 질의 있음). 끝나면 지운다
- 범위 밖: 반박 라벨 사람 검토(관련 59 · 불일치 179), 운영(main) 반영
