# feat/c2-contract — C2 API 응답 계약 v0.1 추가

- Jira: [S15P31C108-77](https://ssafy.atlassian.net/browse/S15P31C108-77) · PRD: v4.1 8장, FR-A2·B1~B3·C1~C8·D1~D7·E1~E4 · 묶음/단위: P7-14

## 완료 조건

- [x] `contracts/c2/openapi.yaml` 에 엔드포인트 6개(places, cards, questions, arguments, evidence, observations)가 있고 lint 를 통과한다
- [x] `contracts/c2/examples/*.json` 9개가 각자의 스키마 검증을 통과한다 (정상·근거 부족·비교 불가 argument 포함)
- [x] 어떤 스키마에도 점수·순위·수치 신뢰도 필드가 없고, argument 칸이 6개뿐이다 (`additionalProperties: false`)
- [x] `contracts/c2/README.md` 와 `contracts/README.md` C2 행이 갱신됐다
- [x] 화면팀(정호성·정우현)에 MR 리뷰를 요청했다 — 필드 이름(snake_case) 확인 포함(승인 여부와 별개)

## 진행

- 2026-10-22: 시작. 지시서 `instruction_c2_contract.md`(장성우) 기준. origin/develop(121998a)에서 브랜치 생성. Atlassian 미인증이라 Jira 이슈는 아직 없음 — 인증 후 `[P7] C2 API 응답 계약 v0.1 추가`로 생성.
- 2026-10-22: `schemas/` 8개(common + 엔드포인트별 7개), `examples/` 9개, `openapi.yaml`, README 작성. 스키마끼리는 `$id`(https://issue-atlas.c108/contracts/c2/…) 기준 상대 `$ref` 로 연결하고 AJV 에 `-r common.schema.json` 으로 넘김.
- 2026-10-22: 결정 — 필드 snake_case(PRD 8장·C1과 같게, 화면팀 리뷰에서 재확인), 상태는 근거 행 `evidence_status`(5)와 실행 전체 `run_status`(4)로 나눠 PRD 1.2와 카드 양식 C6 충돌 해소, `/v1/edges`·보조 API 는 제외.
- 2026-10-22: 스키마 규칙 추가 — increasing/decreasing 이면 비교 조건 4개 모두 passed=true(FR-C4), blocked/unsupported 면 claim=insufficient, 지도 점 value null ↔ missing_reason 필수, link_only 면 display=null, candidate=true 면 unsupported.
- 2026-10-22: AJV(ajv-cli 5 · ajv-formats 3, dlx 캐시 절대 경로를 -c 에) — 예시 9개 모두 valid. 실패 확인 5건 모두 invalid: score 추가·qualifier.confidence 추가(additionalProperties), 비교 조건 false 인데 increasing·blocked 인데 increasing(const), 지도 점 null 값에 사유 없음(type). 임시 파일은 저장소 밖에서 만들고 삭제. 처음엔 확인 스크립트가 출력 끝 3줄만 봐서 invalid 를 놓쳤고, 전체 출력으로 고쳐 재확인.
- 2026-10-22: Redocly(@redocly/cli 1.34.21) lint — 처음 경고 2건(localhost 서버, /v1/places 4XX 없음) 수정 후 경고 0.
- 2026-10-22: `pnpm check` 종료 0 (contracts 검사기 없음 안내), `git diff --check` 통과. 변경 21개 파일 · 약 1,390줄 — JSON 예시·스키마가 길어 권장 300줄을 넘음. 계약 한 묶음이라 나누지 않음(MR 본문에 적기).
- 2026-10-22: `contracts/README.md` 는 C2 행만 바꿈. MR !11(C1 행)과 이웃한 줄이라 둘 중 늦게 머지되는 쪽에서 충돌을 손으로 합쳐야 할 수 있음.
- 2026-10-22: Jira S15P31C108-77 생성(에픽 S15P31C108-55 [P7] 서버 공통, SP 3, 활성 스프린트, 기한 10/30), 진행 중 전이, 작업 결과 코멘트.
- 2026-10-22: 사용자 요청으로 finish 진행. 화면팀 MR 리뷰 요청은 MR 생성 후 수행할 미완료 조건으로 유지하고, 계약 구현·검증 결과를 커밋한다. 계약 파일 수정 없이 AJV 예시 9개 valid·오류 입력 5개 invalid 재확인, Redocly 1.34.21 lint 경고 0. AJV strictTypes 경고는 별도 기록하며 검증 종료는 0.
- 2026-10-22: pnpm check:all 첫 실행은 E2E 포트 3100 사용 중(EADDRINUSE)으로 실패. 기존 E2E_PORT 설정을 실행 환경에서만 58849로 지정해 재실행하여 종료 0: harness 1.8s, backend format 1.9s, frontend lint 7.5s, typecheck 4.0s, test 3.5s(9개), e2e 14.9s(Chromium 1개·프로덕션 빌드 포함), backend build 41.5s(DB 테스트 포함). 코드·계약·검사 설정 변경 없음. 계획을 done으로 이동하고 MR 본문 초안 작성. push·MR 생성은 사람이 수행하며 Jira는 진행 중 유지.

## 다음 할 일 / 범위 밖

- 2026-10-23: 사용자 요청으로 MR !14에 origin/develop(dbcd94c) 반영. contracts/README.md 한 파일 충돌은 P2 행과 C2 링크·담당 설명을 모두 보존해 해결. C2 스키마·예시는 수정하지 않음.
- 재검증: E2E_PORT=63817 pnpm check:all 전체 PASS(harness, Java format, frontend lint/typecheck·9 tests·Chromium E2E 1건·production build, backend build, engine lint·131 tests). backend Gradle은 UP-TO-DATE 결과 재사용. jsonschema Draft202012+FormatChecker로 C2 예시 9개 모두 valid.
- Redocly 1.34.21 검증은 API 유효 판정 뒤 시스템 Node 24.18.0 종료에서 libuv 오류가 났다. 저장소·의존성 변경 없이 번들 Node 24.22.1과 기존 dlx CMD wrapper로 재실행하여 lint 종료 0·경고 0 확인.
- MR !14 리뷰 대상: 정호성(등록 리뷰어), 정우현(멘션 요청). 리뷰 요청 조건은 완료하며 승인·머지는 대기한다.

- 커밋 후 push·MR 생성은 사람이 수행한다. MR 리뷰어: 정호성·정우현 (snake_case 확인 요청 포함)
- 화면팀 리뷰 반영 후 10/30 v0.1 동결, 11/13 v1
- 보조 API 계약: `/v1/reviews`(C3), `/v1/jobs`, `/v1/sources`, `/v1/imports`
- `/v1/edges` (분포형 카드가 생기면)
- 분석 테이블 Flyway (`card`·`question`·`run`·`card_revision`·`app_user`)
- API별 Spring 구현 순서: places → cards → observations → evidence → arguments
- 근거 충실도 규칙표(상·중·하)와 `formula_version` 확정 — 논증 엔진(P5) 담당과
- `scripts/check.mjs` contracts 영역에 AJV·Redocly 검증 연결 (같은 실수가 두 번 나오면)
