# docs/merge-commit-template — 머지 커밋 메시지 템플릿 · 병합 규칙 정리

- Jira: S15P31C108-71 · PRD: — · 묶음/단위: 공통

## 완료 조건
- [x] `.gitlab/merge-commit-template.md` 에 GitLab 에 붙여 넣을 템플릿(제목 · 브랜치 · MR 링크 · 커밋 목록 · 리뷰 · 승인 · 머지한 사람)과 병합 방식 설정이 있다
- [x] `develop → main` MR 제목 규칙과 예시가 있다
- [x] AGENTS.md 에 병합 방식 · 커밋 단위 · 깃모지 · Jira 브랜치 버튼 규칙이 더해졌다 (100줄 이하)
- [x] MR 템플릿 검증 칸이 현재 명령(`pnpm check:all`)과 맞다

## 진행
- 2026-10-21: whyUP 브랜치·커밋 컨벤션에서 이 저장소에 없던 것만 가져옴 — Merge commit 병합, 커밋 하나 = 논리 변경 하나 · WIP 정리, 깃모지 · Jira 키 제목 금지, Jira 「브랜치 만들기」 버튼 금지. 콜론 앞뒤 공백 규칙(`feat : …`)과 `dev` 이름은 가져오지 않음(이 저장소는 `feat: …`, `develop`)
- 2026-10-21: 「소스 브랜치 삭제」는 켬으로 정리 — 보호 브랜치는 지워지지 않음

- 2026-10-21: finish — check:all 통과(문서 변경이라 코드 결과는 그대로, 이번엔 PC 부하로 lint 58s 등 느렸음). 커밋 후 MR(→ develop)

## 다음 할 일 / 범위 밖
- GitLab 설정 → 병합 요청에 템플릿 붙여 넣기 · 병합 방식 Merge commit 확인 (Maintainer, 사람)
