---
name: finish
description: 작업 마무리 — 전체 검사, 실행 계획 정리, 커밋, MR 본문 초안, Jira 코멘트. 사람이 "/finish" 로 부를 때만 쓴다. push 는 하지 않는다.
---

# finish

## 1. 확인 (하나라도 걸리면 멈추고 보고)

- 현재 브랜치가 `main`·`dev` 가 아니다.
- 실행 계획 `docs/plans/active/<branch 의 / 를 - 로>.md` 가 있다. 없으면 경고하고 계속할지 묻는다.
- 완료 조건이 모두 체크됐다. 안 된 항목은 이유와 함께 보여 주고 묻는다.
- 화면을 바꿨으면 브라우저에서 직접 확인했다(안 했으면 지금 확인한다).

## 2. 검사

`pnpm check:all` (없으면 `corepack pnpm check:all`). 실패하면 `check` 스킬 규칙대로 고치거나 보고한다.

## 3. 실행 계획 정리

1. 「진행」에 오늘 날짜로 한 일 · 결정을 한두 줄.
2. 「다음 할 일 / 범위 밖」에 남은 것.
3. `git mv docs/plans/active/<file> docs/plans/done/<file>`

## 4. 커밋

- 바뀐 파일을 보고 이 작업 범위만 스테이지한다(`git add -A` 금지). 범위 밖 변경은 남기고 알린다.
- 제목 `<type>: <명사형 요약>` — commit-msg 훅이 검사한다. 본문에 Jira 키.
- 훅이 막으면 `--no-verify` 로 피하지 않고 원인을 고친다.

## 5. MR 본문 초안

`.gitlab/merge_request_templates/Default.md` 를 채워 채팅에 보여 준다.
- 제목 `<type>: <명사형 요약> (S15P31C108-XX)`, 대상 브랜치 `dev`
- 검증 칸에는 2번 결과를 그대로, 못 한 검증은 「위험 · 미검증」에

## 6. Jira

[start/jira.md](../start/jira.md) 「코멘트」대로 남긴다. `완료` 전이는 하지 않는다(머지 뒤).

## 7. 보고

커밋 해시, 사람이 할 일(`git push -u origin <branch>` → MR 생성 → MR 링크를 주면 Jira 코멘트에 추가)을 알린다.
