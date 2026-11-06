# feat/card-sign-words — 카드 표시 낱말로 순이동 부호 문장화

- Jira: S15P31C108-286 · PRD: — · 묶음/단위: P4 (engine 문장화)

## 완료 조건
- [x] 카드 계약 `card.schema.json` 이 `claim_items` 의 `sign_words` 를 허용하고 `C1.json` 주 지표에 순유출 · 순유입이 들어 있다(seed SQL 다시 생성, backend 카드 테스트 통과)
- [x] engine 문장화 입력에서 `sign_words` 가 있는 지표 값마다 「순유출 1,537명」 표시 글자가 붙고, 프롬프트 v4 가 그 글자를 그대로 쓰게 한다
- [x] engine 출력 검사가 그 지표 값을 − 부호로 쓴 문장을 거절하고(카드 문구로 대체), `sign_words` 없는 카드(A3)는 지금과 같다
- [x] 로컬에서 C1 새 판으로 여수 2023–2025 질문 시 ③ 보증에 「순유출 N명」이 나오고 − 부호가 없다

## 진행
- 2026-11-06: 시작. 결정 근거는 Notion 「오류」 페이지(순이동 부호 표시). 값(API · DB)은 부호 그대로 두고, 카드가 부호를 읽는 낱말을 정한다. backend 는 카드 승인본 전체를 engine 에 이미 보내므로(`request.set("card", approved.spec())`) 코드 변경 없음
- 2026-11-06: 카드 계약 v0.5(`claim_items[].sign_words`) · C1 · seed SQL 재생성. 승인 함수(`approve_card`)는 초안 JSON 을 그대로 승인본으로 만들어(`draft_spec || …`) 새 칸이 보존된다. ajv 로 C1 · A3 통과, 낱말 하나가 빠진 `sign_words` 는 거절. backend 카드 테스트 27개(설계도 계약 7 · seed 6 · 저장 14) 통과
- 2026-11-06: engine 프롬프트 v4 — `prompt.py` 가 카드 `sign_words` 로 통계 값마다 `value_text`(「순유출 1,537명」, 0 은 「0명」)를 붙이고 쓰인 낱말을 `sign_words` 로 함께 보낸다(낱말 없는 카드는 v3 와 같은 입력). `check.py` `sign_wording`: 그 값의 숫자 앞에 `-` · `−` 가 있거나, 앞에서 가장 가까운 부호 낱말이 없거나 부호와 다르면 거절(「…년」 숫자 · 기간의 – 는 제외). engine 테스트 613개 통과
- 2026-11-06: 로컬 확인(issue_atlas_latest 에 C1 v3 를 `approve_card` 로 승인, engine v4 · backend develop). 여수 「2023년 순유출 1,537명, 2024년 순유출 1,935명, 2025년 순유출 2,262명」, 광주 동구 「2023년 순유입 916명, 2024년 순유출 101명 …」, 북구 「… 2024년 순유입 248명 …」. 세 실행 모두 `done` · `argument-phrasing-v4` · 검사 문제 없음
- 2026-11-06: `pnpm check` 통과(backend 포맷 · 테스트 전체, engine lint · 테스트 613개). 카드 계약 받는 쪽 리뷰(backend seed · 문장화 결과를 읽는 backend) 요청

## 다음 할 일 / 범위 밖
- 개발 · 운영 DB 의 C1 새 판 승인(관리자 작업 — 초안 저장 → 승인 요청 → 승인). seed SQL 은 「첫 승인」만 하므로 이미 승인된 DB 에는 관리자 API 로 올린다
- ① 판단 문장에 숫자 넣기(「오류」 페이지 결정 3번) 때 backend 가 같은 `sign_words` 로 문장 틀을 채운다
- 프론트 그래프 · 랜딩 숫자(「순유출 −2,262명」)는 C2 v1 때 응답 칸으로 넘기거나 프론트가 같은 규칙으로 표시
- LLM 이 판정 이유를 카드 `outcomes[].meaning` 그대로 옮겨 「모든 해가 음수이고 절대값이 …」, 동구 「같은 값, 오르내림, 모두 양수 중 어느 것도 아니므로 불분명」처럼 어색하게 쓴다. C1 `meaning` 문구를 낱말(순유출)로 고치거나 프롬프트에서 다듬을지 따로 정한다
