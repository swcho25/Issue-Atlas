# chore/harness-fixes — 시범 실행에서 발견한 하네스 문제 3개 수정

- Jira: S15P31C108-67 · PRD: — · 묶음/단위: 공통

## 완료 조건
- [x] `jira.md` 의 이슈 유형 JQL 이 영문 이름(`Epic`)으로 바뀌어 에픽 검색이 결과를 돌려준다
- [x] `scripts/` · `.githooks/` 변경이 `pnpm check` 의 harness 영역으로 잡혀 문법 검사 · 훅 스모크 테스트가 돈다
- [x] 다른 저장소의 같은 이름 명령이 섞이는 문제(세션 폴더 충돌)와 대처가 AGENTS.md 에 있다
- [x] `pnpm check:all` 통과

## 진행
- 2026-10-21: 시작. 원인 확인
  - 에픽 검색: JQL `issuetype = 에픽` 은 오류 없이 0건, `Epic` · `10000` 은 정상 → 영문 이름으로
  - `/review` 의 「기준 브랜치 dev」 문구: 이 저장소가 아니라 세션에 같이 열린 whyUP 저장소의 `.claude/commands/review.md` 에서 옴. whyUP 은 고치지 않고 AGENTS.md 에 대처를 적음
- 2026-10-21: `scripts/check-harness.mjs` 추가 — scripts 문법, `.githooks` 셸 문법(`sh -n`), Claude 훅 4가지 입력 스모크. 일부러 깨뜨린 파일 2개를 잡는 것 확인(1초)

- 2026-10-21: PowerShell 에서는 sh 가 PATH 에 없어 훅 검사가 건너뛰어졌는데 「통과」로 표시되던 문제 발견 → Git for Windows 의 sh 를 찾고, 건너뛰면 결과 줄에 그대로 표시. check:all 통과(harness 0.8s 포함)

- 2026-10-21: finish — check:all 통과(harness 1.0s · lint 5.6s · typecheck 2.5s · test 3.1s · e2e 10.4s · backend 2.8s). 커밋 후 MR(→ develop)

## 다음 할 일 / 범위 밖
- 이 세션처럼 다른 저장소를 함께 열지 않도록, 다음 세션은 S15P31C108 만 열고 시작
