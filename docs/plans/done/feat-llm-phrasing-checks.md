# feat/llm-phrasing-checks — C1·A3 보증·반박 LLM 문장화와 출력 검사기

- Jira: S15P31C108-225 (상위 S15P31C108-160) · PRD: — · 묶음/단위: P4

## 완료 조건

- [x] 검사기(`engine/ai/argument/check.py`)가 인용 ID·원문 위치·인용 구절, 문장 속 수치, 판정 값 고정, 금지어를 검사하고 네트워크 없는 단위 테스트(유효·잘못된 수치·허위 인용·근거 부족·판정 변경)를 통과한다
- [x] 문장화가 C1·A3 판정 입력과 기사 구절로 ③ 보증(`llm_phrasing`)·⑤ 반박(`llm_judgment`)을 만들고, 건너뜀·시간 초과·호출 오류·검사 탈락이면 카드 문구·빈 반박으로 돌아가며 사유 코드를 남긴다(가짜 모델 단위 테스트)
- [x] GMS 실제 호출(C1·A3 가상 예시 각 1회)의 형식·검사 결과를 이 파일에 기록한다
- [x] `pnpm engine:lint` · `engine:test` · `pnpm check:all` 통과

## 진행

- 2026-11-03: 시작. 설계 확인: engine `ai/argument` 에 둔다, Jira 는 -160 아래 하위 작업, 실패 시 반박은 `[]`(지금과 같음).
  C2 동결(11/4)상 ① 판단·④ 한정어·⑥ 상한선은 `rule`·`card` 만 → LLM 은 ③ 보증·⑤ 반박만 쓴다. 외부 모델에는 가상 예시만 보낸다(AI 계약 「열린 문제」).
- 2026-11-03: `engine/ai/argument/` 추가 — `prompt`(판정 입력 + 기사 요약 문장 구절 P1… · 원문 위치), `check`(형식 · 판정 변경 · 인용 ID · 구절 글자 일치(8자 이상) · 수치(입력 값 또는 그 반올림, 구절 숫자는 그 구절을 인용한 칸만) · 근거 부족 · 금지어), `phrase`(건너뜀 · 실패 시 카드 보증 · `[]`), `gms`(Gemini `generateContent`, 30초, 429·5xx 2회), CLI(fixture 만). 단위 테스트 33개(가짜 모델 · 네트워크 없음) 통과.
- 2026-11-03: GMS 실제 호출(`gemini-2.5-flash`, `argument-phrasing-v1`, 가상 입력·가상 기사). C1 `judgment-ready` + 기사 4건 → 9.3초 `done`, 검사 통과: 보증에 연 값 3개 · `ev_kosis_net_yeosu` 인용, 반박 R1(진학) supported · R2 not_found · R3(산단 고용) supported, 인용 구절 모두 원문 글자 그대로. A3 개선 가상 입력 + 기사 3건 → 13.1초 `done`, 검사 통과: 반박 R1(기상) · R2(황사) supported, 규칙이 정한 R3 은 `rule` 그대로. 문장 품질 메모: C1 보증이 「순유출 -1850명」처럼 부호를 겹쳐 씀(검사는 부호를 안 봄) → 프롬프트 다음 판 후보.
- 2026-11-03: `pnpm check`(engine lint · test 551개) 통과. `pnpm check:all` 전 항목(harness · backend format · build, frontend lint · typecheck · test · e2e, engine lint · test) 통과.
- 2026-11-03: 변경 약 900줄(그중 테스트 377줄)로 권장 300줄을 넘는다. 검사기 · 되돌리기 · 호출이 한 흐름이라 나누지 않았다.

## 다음 할 일 / 범위 밖

- -162: backend 연결. 연 값(`statistics_points`)은 backend 가 이미 계산하므로 backend 가 넘긴다. 호출 방식(동기 HTTP · 배치), 인용 저장 위치, AI 계약 v0.2(출력 · 사유 코드 `NOT_JUDGED` · 시간 제한) 확정, 실제 DB 의 C1·A3 시험
- -161 나머지: 기사 밖 자료 유형(보도자료 · 정책 문서 · 비정규화 표)의 구절을 같은 입력 모양으로 넣기
- 칸별 되돌리기(지금은 한 칸이라도 떨어지면 전체를 카드 문구로)
- 프롬프트 다음 판: 음수 값을 「순유출」로 말할 때 부호를 빼게, 판단과 반대 방향 낱말(예: 개선 ↔ 악화) 검사 추가 여부
- 실제 기사 요약을 외부 모델(GMS 채팅)로 보내도 되는지 확인(임베딩은 -204 에서 보냄). 확인 전 CLI 는 fixture 만 받는다
