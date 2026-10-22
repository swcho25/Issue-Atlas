# feat/c1-contract — C1 공통 메타 필드 계약 추가

- Jira: [S15P31C108-68](https://ssafy.atlassian.net/browse/S15P31C108-68) · PRD: v4.1 §7.1·7.2·5.4 · 묶음/단위: P1 수집 파이프라인

## 완료 조건

- [x] contracts/c1/record.schema.json 이 4절의 필드·enum·조건 규칙을 담는다
- [x] contracts/c1/examples/*.json 5개가 실제 수집 값으로 채워져 있고 스키마 검증을 통과한다
- [x] 결측 레코드에서 missing_reason 을 지우면 검증이 실패한다 (조건 규칙이 실제로 동작)
- [x] contracts/c1/README.md 와 contracts/README.md C1 행이 갱신됐다

## 진행

- 2026-10-21: `/start C1 공통 메타 필드 계약`으로 시작. 지시 장성우, SP 2, 마감 10/23(C1 동결). 작업 전 git status clean 확인 후 origin/develop에서 feat/c1-contract 생성. 지시서의 완료 조건과 다음 할 일을 그대로 옮김.
- 2026-10-21: Atlassian MCP 최초 조회는 403으로 보류. 사용자 요청으로 OAuth 인증 화면을 열어 로그인 성공 후 연결 정상화. 기존 C1 이슈가 없어 S15P31C108-68 생성: 에픽 S15P31C108-49, 담당 장성우(계정 표시명 성우), SP 2, 활성 스프린트, 기한 2026-10-23. 조회한 전이의 이름을 기준으로 진행 중 적용. 필드·전이 ID는 저장하지 않음.
- 2026-10-21: 루트 c1_sample_*.json과 data_checks_20261021.md를 읽고 .git/info/exclude 적용 확인. KOSIS 2023 순이동 -747, 서강동 좌표 [127.725967, 34.741301], PM25 01시 25·02시/24시 null을 예시로 다시 작성. 설명 키는 제거하고 is_provisional=false 보완, KOSIS license_type은 소스 확인 결과의 KOSIS-활용약관 반영. 다른 TBD는 유지.
- 2026-10-21: JSON Schema 2020-12에 필드·enum·필수 키·추가 필드 금지·조건 규칙 4개 구현. 정규화 예시 5개와 raw 원천 자료 3개, C1 필드표·결측 규칙·변환 메모·검증 방법·v0.1 변경 이력 작성. contracts/README.md C1 링크와 초안 상태 갱신.
- 2026-10-21: 지시서 검증 명령 첫 실행은 종료 1: `module ajv-formats is invalid; it should export function`, `Cannot find module 'ajv-formats'`. 같은 pnpm dlx 캐시의 ajv-formats 절대 경로를 -c에 넘겨 해결. 저장소 의존성 추가 없음. 실행 명령과 Windows 재현 방법은 contracts/c1/README.md 「검증 방법」에 기록.

```sh
pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx ajv validate --spec=draft2020 -c ajv-formats -s contracts/c1/record.schema.json -d "contracts/c1/examples/*.json"
```

```text
contracts/c1/examples/airkorea-measure-hour24.json valid
contracts/c1/examples/airkorea-measure-missing.json valid
contracts/c1/examples/airkorea-measure.json valid
contracts/c1/examples/airkorea-station.json valid
contracts/c1/examples/kosis-net-migration.json valid
exit 0 (같은 dlx 캐시의 ajv-formats 절대 경로를 -c에 지정)
```

- 2026-10-21: 저장소 밖 스크래치 폴더에서 결측 예시의 missing_reason을 null로 변경한 경우와 키를 삭제한 경우를 같은 AJV 명령으로 확인. 각각 oneOf, required/oneOf 위반으로 종료 1(예상 실패). 임시 파일·빈 폴더 삭제 및 미존재 확인. 원래 예시는 수정하지 않음.

```text
missing-reason-null.json invalid
keyword: oneOf
message: must match exactly one schema in oneOf
missing_reason=null: exit 1
missing-reason-null.json invalid
keyword: required
message: must have required property missing_reason
missing_reason 키 삭제: exit 1
null exit=1; deleted exit=1
Scratch fixtures removed.
```

- 2026-10-21: 사용자 요청으로 최신 develop 반영. `git fetch origin` → `git merge --ff-only origin/develop`으로 7678da1에서 db181953e68b719baeab1d412068fcd1d4380fff까지 fast-forward. 기존 C1 변경은 모두 유지하고 충돌 없음. 최신 AGENTS.md·.agents/skills/start/jira.md·docs/plans/TEMPLATE.md 확인. Jira 본문은 담당 → 완료 조건 → 브랜치 형식, 상세 작업·검증·다음 할 일은 Jira 코멘트로 보존. 계획은 최신 템플릿의 완료 조건 / 진행 / 다음 할 일 구조로 정리.
- 2026-10-21: develop 반영 뒤 pnpm check 종료 0, git diff --check 통과. 현재 contracts 검사기는 없어 AJV 결과를 별도 기록. 최신 develop의 하네스 검사 추가는 수신한 변경이며 이번 C1 작업에서 scripts/를 수정하지 않음.

```text
[check] 변경 영역 [contracts] · 기준 origin/develop · 파일 12개
[check] contracts 변경: 검사기 없음. 받는 쪽(frontend·backend) 리뷰를 MR 에 요청하세요
[check] 검사할 코드 변경이 없습니다.
```

- 2026-10-21: 최종 범위 확인. C1 변경은 contracts/와 이 계획 파일 총 12개. 루트 샘플 4개·data_checks_20261021.md·erd_v0.md의 SHA-256은 작업 전후 동일. backend/·engine/·frontend/·scripts/·package.json·pnpm-lock.yaml은 최신 origin/develop 대비 변경 없음. 커밋·push·MR 생성 없음. Jira는 리뷰·머지 전이므로 진행 중 유지.
- 2026-10-21: 연결된 Notion에서 이 프로젝트 PRD v4.1 원문을 찾지 못함. 검색된 다른 프로젝트의 모의투자 PRD는 기준으로 쓰지 않고 지시서의 필드·enum·조건 규칙과 실제 샘플을 기준으로 구현. 원문 대조는 후속 확인 필요.

- 2026-10-22: 사용자 승인으로 커밋·push·MR 준비 진행. `git fetch origin` 후 C1 변경 12개만 임시 stash, `git merge --ff-only origin/develop`으로 db18195 → 00d011e 반영 후 stash 복원. 충돌 없음, 기존 HTTP 오류 계약 링크 유지. Jira S15P31C108-68은 진행 중으로 확인하여 상태 전이 불필요.
- 2026-10-22: AJV로 정규화 예시 5개 통과(exit 0). 저장소 밖 복제본에서 missing_reason=null, 키 삭제 모두 예상대로 실패(exit 1), 임시 파일 정리. Windows 경로 조회 파이프 조기 종료를 피하도록 README 명령에서 where 출력을 먼저 전부 수집하도록 보완.
- 2026-10-22: 원격 P2 65b24c9의 url/validate/run 모듈을 메모리에서 실행해 C1 예시 5개 대조. 원본 content_hash=null이면 전부 held + MISSING_REQUIRED(content_hash), 검사 중 해시 형식 임시 값을 채우면 전부 pass. P2 계획의 의도된 보류 조건임을 확인. P2 코드·원천 샘플은 변경하지 않고 README에 단계별 정책·수신 리뷰 쟁점 기록.
- 2026-10-22: pnpm check:all 실행: harness PASS(1.1s), backend format PASS(13.5s), frontend lint PASS(48.5s), typecheck PASS(15.9s), test PASS(23.4s, 9개), e2e PASS(29.7s, Chromium 1개·프로덕션 빌드 포함). 마지막 backend build는 Docker 엔진 연결 불가로 미실행, 전체 종료 1. 설치된 Docker Desktop 실행도 시도했으나 엔진이 올라오지 않아 MR 위험·미검증에 기록. JSON 파싱·API 키 마스킹 확인 및 git diff --check 통과.

## 다음 할 일 / 범위 밖

- C1 스키마와 예시·문서만 커밋·push하고 develop 대상 Draft MR에서 수신 측 리뷰를 받는다. 리뷰·병합 전 Jira 진행 중 유지.
- Docker 실행 가능한 환경에서 backend build(Testcontainers 포함)를 재검증한다. 이번 전체 검사에서 앞 단계들은 통과했지만 check:all 전체 통과로 보고하지 않는다.
- P2와 content_hash=null 처리 시점(P1 해시 적재 후 전달 vs P2 보류·재처리), 전체 C1 스키마 검증 연결, 측정소 메타의 처리 경로를 합의한다.
- scripts/check.mjs contracts 영역에 7절 검증 명령 연결 (같은 실수가 두 번 나오면)
- indicator_id(탭 10), 에어코리아 source_id(탭 3), 측정소정보 license_type 의 TBD 채우기
- 대표 확인 3건: 청년 기준(15–39 합산 vs 청년층 코드), 공공누리 3유형 계산값 노출, 대기질 2025 잠정값
- 여천동(여수) 측정소 이전 여부
- 박준우(P2)·정우현(P3) 리뷰 요청 — 계약 변경은 받는 쪽 리뷰 필수
- 이슈 아틀라스 PRD v4.1 원문 URL을 확보해 §7.1·7.2·5.4 대조.
