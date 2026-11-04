# feat/ai-module-backend — 논증 문장화 engine API와 질문 실행 연결

- Jira: S15P31C108-231 (상위 S15P31C108-162) · PRD: — · 묶음/단위: P4 · P5

## 완료 조건

- [x] AI 계약 v0.2: 문장화 요청·결과 스키마, 사유 코드, 시간 제한을 `contracts/ai` 에 정하고 예시가 스키마 검사를 통과한다
- [x] engine `POST /v1/argument/phrase` 가 요청을 계약으로 검사해 문장화 결과를 돌려준다(어기면 `INPUT_INVALID`) — 가짜 모델 API 테스트
- [x] backend 질문 실행이 판정된 실행에서 engine 을 불러 ③·⑤ 를 채우고, 꺼짐·오류·시간 초과·검사 탈락이면 카드 문구·빈 반박으로 응답하며 사유를 `argument_phrasing` 에 남긴다 — 통합 테스트(가짜 engine)
- [x] 로컬에서 engine + backend 를 띄워 실제 GMS 로 C1·A3 질문을 실행하고 `GET /v1/arguments` 응답을 확인한다(화면에 ③·⑤ 가 아직 없어 사용자 결정으로 브라우저 대신 API 응답으로 확인)
- [x] `pnpm check:all` 통과

## 진행

- 2026-11-04: 시작. 결정: 연결은 (가) engine HTTP 서비스를 backend 가 질문 실행 때 부름, 실제 기사 요약 GMS 전송 허용, 서버 배포(engine 컨테이너 · deploy_backend.py · CI)는 다음 MR(인프라 조석원 리뷰), 시험 자료는 개발 DB 덤프를 로컬 별도 DB 로, 출처 등급은 담당 팀원 작업(오늘 중) 전까지 로컬 시험 DB 에만 임시로 넣는다(커밋 안 함).
  확인: 서버 배포에 engine 서비스 없음, 로컬 `issue_atlas` 는 V6 · `issue_atlas_p4` 는 기사 100건뿐(통계 관측 0), `source.reliability_grade` 를 넣는 마이그레이션 없음 → 등급이 없으면 통계 근거가 안 생겨 실행이 `blocked`.
- 2026-11-04: AI 계약 v0.2(문장화 요청 · 결과 스키마, 예시 2개, 출력 검사 · 시간 제한, `NOT_JUDGED`, 반박 후보 `id`, 제목 · 요약 GMS 허용)와 engine `POST /v1/argument/phrase`(계약 위반 422, 칸 이름만). engine 테스트 573개 통과. 커밋 dcbe58a.
- 2026-11-04: backend 연결 — `question/client/ArgumentEngineClient`(주소 없으면 `ENGINE_DISABLED`, 연결 2초 · 응답 40초, 422 → `INPUT_INVALID`), `ArgumentPhraser`(C2 응답 → 판정 입력, 연 값 = `CardJudge` 의 연 값 계열, 카드 반박 ID, `done` 일 때만 ③ · ⑤ 교체), `argument_phrasing`(V0044, develop 의 출처 등급 V0039 · 세출 V0040 · 경계 V0041 · V0042 · 보도자료 검수 V0043 다음). `QuestionApiTest` 에 가짜 engine(JDK HttpServer)으로 정상 · 503 · JSON 아님 · 422 · 시간 초과 · 검사 탈락 · A3 측정소 연 값 · 카드 없음 · DB 제약 — 보낸 요청은 AI 계약 스키마로 검사. 26개 통과. 커밋 0cc99bd.
- 2026-11-04: `pnpm check:all`(0cc99bd 기준) 전 항목 통과 — harness · backend format · build(전체 테스트) · frontend lint · typecheck · test · e2e · engine lint · test 573개.
- 2026-11-04: develop 반영(18ee643). develop 에 출처 등급 V0039(-232) · 세출 출처 V0040(-234)이 먼저 들어와 문장화 기록을 V0041, DB 계약 v0.1.31 로 옮김. 출처 등급은 develop 에 들어와 로컬 임시 등급은 넣지 않았다.
- 2026-11-04: 실제 자료 확인 — 개발 DB 덤프(2026-11-04 10:22 UTC, V0039)를 로컬 `issue_atlas_p5` 로 복원, backend 가 V0040 · V0041 적용. 로컬 engine(uvicorn) + backend(`ENGINE_URL`) + 실제 GMS(`gemini-2.5-flash`, `argument-phrasing-v2`), 여수 kr-12130. 시험 관리자 계정은 로컬 시험용으로 만들어 저장소 밖에만 둠.
  | 경우 | 실행 | 문장화 기록 | 응답 |
  | --- | --- | --- | --- |
  | C1 2023–2025 | partial · increasing(순유출 확대) | done 11.8초 | ③ llm_phrasing · ⑤ 4건(R3 산단 고용 supported, 나머지 not_found), 6칸 |
  | A3 2023–2025 | partial · unclear(측정소 9곳) | done 12.2초 | ③ llm_phrasing · ⑤ 4건(R3 측정소 supported, 나머지 not_found), 6칸 |
  | C1 2025 한 해 | unsupported · insufficient | skipped RUN_UNSUPPORTED | 카드 문구 · [] (4칸) |
  | engine 끔 | partial · increasing | failed ENGINE_ERROR | 카드 문구 · [] (5칸) |
  기사 C1 88건 · A3 54건 중 앞 40건이 구절. 인용 구절은 실제 news_id 원문 요약에 글자 그대로 있음(C1-R3 P28, A3-R3 P34). 비교 불가(NOT_JUDGED)는 실제 자료에 그런 경우가 없어 통합 · 단위 테스트로만 확인.
  품질 메모(검사로는 못 막는 뜻 오류): ① A3 보증이 「측정소별로 증감이 일관되지 않아 불분명」이라 썼으나 규칙의 불분명은 「공통 측정소 끝해 − 첫해가 ±3 사이」 — 프롬프트에 규칙 결과 뜻(`outcomes[].meaning`)을 넣어야 한다. ② A3-R3(측정소 이전 · 교체)을 「산단 대기 측정기 기능 부족」 보도로 supported — 경쟁 설명과 딱 맞지 않으면 needs_review 로 두게 기준을 좁혀야 한다.
- 2026-11-04: 프롬프트 v3(사용자 요청: 품질 메모 ③ 보증에 수치 · ④ A3 보증 이유). 입력에 승인본 규칙 결과 뜻(`fixed.rule_meaning` · `rule_outcomes`)과 통계 값의 위치(질문 지역 · 측정소)를 넣고, 보증 첫 문장에 연 값(첫해 · 끝해)과 판정 이유(그 뜻으로만), 부호 겹침 금지. 뜻 속 숫자(±3)는 검사 허용 숫자에 넣음. backend 는 A3 규칙이 계산한 공통 측정소 첫해 · 끝해 평균(`FirstLastDiff` facts `firstMean` · `lastMean`)을 질문 지역 연 값으로 `statistics_points` 에 더함(모델은 계산하지 않음). engine 45 · backend 질문 26 · 규칙 4 통과.
  실제 자료(issue_atlas_p5, v3): C1 보증 「…순이동은 2023년 -1537명, 2024년 -1935명, 2025년 -2262명으로, 모든 해가 음수이고 절대값이 해마다 커져 청년 순유출이 확대…」, A3 보증 「…연평균은 2023년 15.34µg/m³에서 2025년 13.61µg/m³로 변화하여, 끝해와 첫해의 차이가 −3µg/m³와 +3µg/m³ 사이이므로 불분명…」 — 둘 다 done, 검사 통과. A3-R3(측정소 이전 · 교체)은 supported → needs_review 로 바뀜.
- 2026-11-04: develop 반영 뒤 로컬 전체 backend 테스트 181개 중 `SourceGradeMigrationTest` 2개 실패 — -232 의 테스트가 `FoundationMigrationTest` 가 먼저 출처 표를 비웠을 때만 통과(V0040 이 넣은 lofin 행과 겹침). 로컬(Windows)은 순서가 반대, develop CI(bcb6b1a)는 성공. 이 작업과 무관해 고치지 않음.
- 2026-11-04: develop 반영 뒤 `pnpm check:all` — harness · backend format · frontend lint · typecheck · test · e2e 통과, backend build 는 위 `SourceGradeMigrationTest` 2개만 실패(나머지 179개 통과, 문장화 · 질문 테스트 포함). engine 은 dcbe58a 뒤 바뀌지 않았고 그때 573개 통과. (중간에 `sed` 로 고친 주석 파일의 줄바꿈이 바뀌어 포맷 검사가 한 번 걸렸고 `spotlessApply` 로 되돌림, 커밋 내용 차이 없음)

- 2026-11-04: develop 다시 반영(83c92a4). 경계 V0041 · V0042(-230) · 보도자료 검수 V0043(-237) 다음으로 문장화 기록을 V0044, DB 계약 v0.1.32. -208 로 익명 `POST /v1/questions` 가 열림(테스트 함께 둠). `pnpm check`(backend 전체 · engine 587개) 통과 — 이번 실행은 `SourceGradeMigrationTest` 순서 문제도 안 걸림.
  개발 서버 확인: 출처 등급(V0039)은 들어감. 「컨테이너」(-233)는 `engine/ai` 만 바뀌어도 **수집기** 이미지를 다시 만드는 CI 규칙이고, 수집기는 한 번 도는 배치(`pipeline.collect`, 이미지에 `engine/api` 없음)라 backend 가 부를 engine API 는 서버에 아직 없다(dev compose = postgres · backend). 그래서 이 MR 이 병합돼도 서버는 `ENGINE_DISABLED` 로 지금과 같은 응답.
- 2026-11-04: MR 전 `pnpm check:all`(83c92a4 + 계획 파일) 전 항목 통과 — harness · backend format · build · frontend lint · typecheck · test · e2e · engine lint · test 587개. 리뷰어 장성우.

## 다음 할 일 / 범위 밖

- **요청 수 제한 먼저**: -208 로 익명 질문이 열려 있어 서버에 `ENGINE_URL` 을 켜면 익명 질문 1건 = GMS 호출이다. 장성우 계획(feat-public-argument-api, !133 최동준 리뷰)대로 IP · 세션당 제한을 넣은 뒤에 아래 배포 MR 로 켠다
- 서버 배포 MR: engine Dockerfile 에 `api` 복사 · 실행 명령, `deploy/dev` compose 에 engine 서비스(GMS 키 env 파일), backend 에 `ENGINE_URL`, `deploy_backend.py` 의 구성 요소, CI 경로 규칙. 인프라 담당 리뷰. 그전까지 서버 응답은 지금과 같다(`ENGINE_DISABLED`)
- 반박 supported 기준 좁히기(경쟁 설명과 딱 맞지 않으면 needs_review) — v3 에서 A3 는 needs_review 로 바뀌었지만 규칙으로 정하지는 않았다
- 보증 수치 표기: 천 단위 쉼표(-1,537명) 여부
- 질문 실행 트랜잭션 안에서 engine 을 불러 최대 40초 DB 연결을 잡는다. 사용이 늘면 판정 저장과 문장화를 나누거나 engine 호출을 트랜잭션 밖으로
- 화면(S 레인): ③ 보증 · ⑤ 반박과 provenance(llm_phrasing · llm_judgment) 표시
- -161 나머지: 보도자료 · 정책 문서를 source 모양으로 바꾸는 함수
