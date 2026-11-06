# feat/net-migration-axis-labels — 순이동 그림 기준선 뜻을 카드 → API 로 표시

- Jira: S15P31C108-286 · PRD: — · 묶음/단위: S2 결과 화면(변화형 그림) · C2 · backend

## 완료 조건
- [x] C2 argument `series[]` 에 선택 칸 `baseline {value, above, below}`(그래프 기준선과 위 · 아래 뜻) — 계약 스키마 · README · 예시(`argument-c1-ready.json`) · 동결 문서 기록
- [x] backend 가 실행이 쓴 카드 승인본 `claim_items[].sign_words` 로 그 지표의 통계 줄에 `baseline {0, positive, negative}` 를 싣고, 낱말 없는 지표 · 카드에는 칸을 내보내지 않는다
- [x] 화면은 응답의 `baseline` 이 있는 줄만 「기준선 0 · 위 순유입 · 아래 순유출」 한 줄을 보인다(지표 ID 를 보지 않는다). 막대 · 값 · API 값의 부호는 그대로
- [x] 브라우저에서 여수 C1 새 실행(낱말 있음)과 지난 실행(낱말 없음)으로 직접 확인했다

## 진행
- 2026-11-06: 시작. 결정: 그래프는 KOSIS 부호 그대로(0 선 아래 = 음수) 두고 0 선 위아래 뜻만 적는다(사용자 결정, Notion 「오류」 페이지 순이동 부호 표시). 순유출을 위로 뒤집거나 숫자를 낱말로 바꾸는 안은 하지 않는다
- 2026-11-06: 첫 판은 프론트가 지표 ID(`population_net_migration_*`)로 낱말을 정했다(커밋 1299faf). 사용자 결정으로 확장성을 위해 낱말을 카드 → API → 화면으로 받게 바꿨다 — 낱말은 카드 한 곳(카드 계약 v0.5 `sign_words`, MR !196)에서 정하고 문장(engine) · 그림이 같이 쓴다
- 2026-11-06: !196 을 merge 커밋으로 가져옴(force push 없이). C2 `series[].sign_words`(선택) · backend `StatSeries.signWords`(`@JsonInclude(NON_NULL)`) · `QuestionService.signWords(spec)` · 프론트 zod `sign_words.optional()` · `signAxis(series)`. 0 선 끝에 붙이면 막대 3개일 때 마지막 막대와 겹쳐 그림 위 한 줄로 했다
- 2026-11-06: 테스트 — backend `QuestionApiTest` 36개(C1 주 지표 줄에 낱말, 이동 줄 · A3 에는 칸 없음), 카드 계약 · seed 13개, 프론트 `views.test.ts` · `argument.test.ts` 27개(낱말은 응답에서 · 없으면 줄 없음 · 낱말 하나 빠지면 스키마 실패). ajv 로 argument 예시 4개 통과
- 2026-11-06: 로컬 확인(issue_atlas_latest, C1 v3 · 로컬 테스트 계정): 새 실행 여수 · 광주 동구 응답 `series[0].sign_words = {순유출, 순유입}`, 이동 줄에는 없음. 화면 — 새 실행은 「0 선 위 + 순유입 · 아래 − 순유출」, 변경 전 저장된 실행은 그림만(뜻 줄 없음)
- 2026-11-06: 사용자 결정 — API 표현을 「그래프 기준을 보내 준다」로. API 칸만 `sign_words` → `baseline {value, above, below}`, 카드는 `sign_words` 그대로(engine 문장은 음수 · 양수 낱말이 맞다). backend `QuestionService.baselines(spec)` 이 `{0, positive, negative}` 로 바꿔 싣는다. 화면 문구 「기준선 0 · 위 순유입 · 아래 순유출」, 0 이 아닌 기준선은 막대가 그 선을 그리지 않아 아직 적지 않는다(테스트). 로컬 새 실행 응답 `baseline {0, 순유입, 순유출}` · 화면 확인

## 다음 할 일 / 범위 밖
- 개발 · 운영은 관리자가 C1 새 판(sign_words)을 승인한 뒤의 실행부터 기준선 문구가 보인다. 그 전 실행 · 다른 카드는 그림만
- 0 이 아닌 기준선(예: PM2.5 나쁨 기준)은 같은 `baseline` 칸으로 보낼 수 있다 — 막대에 그 선을 그리는 일이 먼저
- 랜딩 「여수시 청년 순유출 · 명 −1,537」(`pages/landing/ui/Sections.tsx`)도 부호와 낱말이 겹친다 — Figma 랜딩 문구라 디자인과 함께 정한다
