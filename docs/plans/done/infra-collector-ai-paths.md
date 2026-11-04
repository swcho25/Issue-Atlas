# infra/collector-ai-paths — engine/ai 변경도 수집기 이미지를 다시 만들고 배포한다

- Jira: S15P31C108-233 · PRD: — · 묶음/단위: 공통

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] `collector-paths` 에 `engine/ai/**/*.{py,json,yaml,yml,toml,sql,txt,csv}` 가 있다
- [x] develop/main 에 `engine/ai/...py` 만 병합하면 `collector-image`·`collector-deploy` 가 선택된다 (`deploy/tests/test_ci_selection.py`)
- [x] `engine/ai/...md` 만 바꾸면 수집기 이미지·배포는 선택되지 않고 engine 검사는 그대로 돈다
- [x] `pnpm check` 와 deploy 테스트가 통과한다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-11-04: 시작. 2eecc70(S15P31C108-225)이 `engine/ai` 6개 파일만 바꿔 수집기 이미지가 만들어지지 않은 것을 확인
- 2026-11-04: `collector-paths` 에 pipeline 과 같은 확장자로 `engine/ai` 추가. `.engine-scope` 의 `engine/ai/**/*` 는 MD 등 실행 입력이 아닌 변경에도 engine 검사를 돌리려고 유지. 선택 시나리오 3건(py·json → 수집기, md → engine 검사만) 추가, deploy 테스트 45건 통과. `deploy/ci/README.md` 변경 영역 표 갱신

## 다음 할 일 / 범위 밖
- 이 MR 은 `.gitlab/ci/**` 를 바꾸므로 병합 시 FE·BE·수집기가 모두 다시 배포된다. 이때 서버 수집기 이미지에 `ai/argument` 가 처음 실린다 — 병합 후 `/opt/issueatlas-dev/.deploy/collector/current.json` 의 revision 확인
- `ai.argument` 는 기본으로 `contracts/cards/*.json` 을 읽는다. `issueatlas-collect` 에 argument 명령을 추가하면 `contracts/cards/**/*.json` 도 `collector-paths` 에 넣는다
- 상주 engine API 서비스·backend 연동·-162(문장화 ↔ backend)는 범위 밖
