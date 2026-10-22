# docs/merge-threads-setting — 병합 조건 문서를 GitLab 실제 설정에 맞춤

- Jira: S15P31C108-75 · PRD: — · 묶음/단위: 공통

## 완료 조건
- [x] `.gitlab/merge-commit-template.md` 의 병합 조건이 GitLab 실제 설정과 같다 (「All threads must be resolved」 끔, 「Pipelines must succeed」는 CI 를 켠 뒤)

## 진행
- 2026-10-22: GitLab 설정 → 병합 요청(`/-/settings/merge_requests`)에 머지 커밋 템플릿 저장. 병합 방식 Merge commit · 스쿼시 Allow · 소스 브랜치 삭제 켬 · Pipelines must succeed 끔 · All threads must be resolved 끔(사람 결정). 새로고침해 값 확인
- 2026-10-22: 문서의 병합 조건 줄을 실제 설정에 맞춤. 노션 「개발 규칙」 4절 병합 조건도 같이 고침
- 2026-10-22: finish — `pnpm check:all` 7단계 모두 통과(harness · backend format · frontend lint·typecheck·test·e2e · backend build). 첫 실행은 Docker 꺼짐으로 backend build 만 실패, Docker 켠 뒤 재실행

## 다음 할 일 / 범위 밖
- CI Runner 준비 후 「Pipelines must succeed」 켜기 (`.gitlab-ci.yml` include 와 같이)
