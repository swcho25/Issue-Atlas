---
name: start
description: 작업 시작 — Jira 이슈 확인·생성, 브랜치, 실행 계획 파일(docs/plans/active)을 한 번에 만든다. 사람이 "/start <할 일>" 로 부를 때만 쓴다.
---

# start

사람이 준 한 줄(예: `/start 근거 수요표 API`)로 작업을 연다. 구현은 하지 않는다.

## 1. 모으기 (부작용 없음)

1. `git status` — 커밋 안 된 변경이 있으면 멈추고 사람에게 알린다.
2. Jira 에서 같은 일을 하는 이슈를 찾는다 → [jira.md](jira.md) 「검색」.
3. 연결할 에픽을 고른다 → [jira.md](jira.md) 「에픽」.
4. 정한다
   - type: `feat` `fix` `refactor` `test` `docs` `infra` `chore` `perf` `security`
   - 브랜치: `<type>/<kebab-case>` (영문, Jira 키 넣지 않음)
   - 완료 조건 2~5개: **검증 가능한 문장**. 예: `GET /v1/questions/{id}/evidence 가 근거 4종 상태를 돌려준다`
   - PRD FR 번호, 묶음/단위(예: S2-20)를 알면 적는다. 모르면 비운다.

## 2. 한 번에 확인받기

아래를 **한 메시지로** 보여 주고 한 번만 확인받는다. 사람이 고친 값으로 진행한다.

```
Jira    S15P31C108-XX 재사용 | 새 스토리 "<요약>" (에픽 S15P31C108-YY)
브랜치  <type>/<name>  (기준 origin/dev)
완료 조건
  - [ ] …
```

## 3. 실행

1. Jira: 이슈 생성 또는 재사용 → 담당자 나, 활성 스프린트, 상태 `진행 중` → [jira.md](jira.md) 「생성」「전이」.
2. 브랜치: `git fetch origin` → `git switch -c <branch> origin/dev`.
   `origin/dev` 가 없으면 만들지 말고 사람에게 묻는다.
3. 실행 계획: `docs/plans/TEMPLATE.md` 를 `docs/plans/active/<branch 의 / 를 - 로>.md` 로 복사해 채운다.
   - 제목, Jira 키, PRD, 묶음/단위, 완료 조건
   - 진행: `- YYYY-MM-DD: 시작`
4. 계획 파일은 아직 커밋하지 않는다(첫 기능 커밋에 함께 들어간다).

## 4. 보고

이슈 키·링크, 브랜치, 계획 파일 경로를 세 줄로 알리고 끝낸다.

## 하지 않는 것

- 설명·조사만 요청받았는데 이슈·브랜치를 만들지 않는다.
- 확인을 단계마다 따로 받지 않는다(2번 한 번).
- Jira 필드 ID·전이 ID 를 저장소에 적지 않는다. 매번 조회한다.
