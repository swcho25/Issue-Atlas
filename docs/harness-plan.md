# 하네스 구성 계획 (초안)

- 작성: 2026-10-21 · 대상: S15P31C108 Issue Atlas 모노레포
- 근거: Claude Code 공식 문서(memory · skills · hooks), Anthropic「Effective harnesses for long-running agents」, OpenAI Codex best practices, OpenAI「Harness engineering」(원문은 접근이 막혀 InfoQ 보도로 확인), whyUP(S15P21C102) 저장소 실물

## 1. whyUP 회고 — 왜 원하는 방향으로 안 흘렀나

저장소에 남은 흔적으로 추정한 원인이다. 실제로 겪은 문제와 맞는지 확인이 필요하다(§7).

| 증상 (whyUP 실물) | 원인 추정 | 공식 문서의 기준 |
| --- | --- | --- |
| 모든 Bash·Edit 앞에서 `guard.mjs`·`work-start.mjs`가 돌고, 정규식 오탐이 backlog에 쌓임(저장소 밖 임시 폴더 삭제 차단, 문서 본문 속 명령 문자열 차단, 사용자가 승인한 `git checkout -- <path>`도 막음) | **판단이 필요한 일을 정규식 훅으로 막으려 함.** 가드를 피하는 습관이 생김(backlog 원문: "가드가 실제 위험을 막는 대신 가드를 피하는 습관을 만든다") | 훅은 "결정적(deterministic) 규칙"용. 판단이 필요하면 프롬프트·에이전트 훅이나 권한 설정을 쓴다 |
| 매 응답이 끝날 때 `related-check.mjs`가 최대 180초 | **느린 센서를 매 턴에 붙임.** 짧은 질문에도 대기 | 센서는 빠르고 정확해야 하고, 무거운 검사는 명시적 단계(`/check`)로 |
| `start` 스킬 182줄(Jira MCP · JQL · 메타데이터 · 브랜치 · Work Log) | **절차가 스킬 하나에 몰림.** 실제 구현 전 의식(ceremony)이 길어짐 | SKILL.md는 짧게, 한 가지 일만. 부작용 있는 워크플로는 사람이 부를 때만 |
| Work Log JSONL 275개, backlog 59개 | **기록은 쌓이는데 정리(GC)가 없음.** 에이전트가 읽기엔 너무 많고 사람은 안 봄 | 진행 기록은 다음 세션이 바로 읽을 수 있는 작은 파일 하나 + git 기록 |
| Jira · Notion · JSONL · MR 네 곳에 같은 작업 기록 | **단일 원본이 없음.** 동기화가 일이 됨 | 원본은 저장소 안 문서. 나머지는 사람이 필요할 때 |
| `CLAUDE.md` 한 줄("AGENTS.md 를 따른다"), 규칙은 `AGENTS.md`에 | Claude Code는 **CLAUDE.md가 있으면 AGENTS.md를 읽지 않는다.** 한 줄 안내만으로는 규칙이 로드됐다는 보장이 없음 | `CLAUDE.md`에 `@AGENTS.md`로 import 하거나 CLAUDE.md를 두지 않는다 |
| `.harness`·`scripts/harness` 3,400줄 + Jenkinsfile 963줄 | 하네스 자체가 제품만큼 유지보수 대상이 됨 | 실제로 반복된 실수가 생겼을 때만 규칙을 추가한다 |

> 지금 S15P31C108의 `CLAUDE.md`도 같은 한 줄이라 같은 문제가 있다. 1단계에서 바로 고친다.

## 2. 원칙

1. **AGENTS.md는 백과사전이 아니라 지도다.** 루트 100줄 안팎, 세부는 링크로. (OpenAI: 큰 매뉴얼을 짧은 목차로 교체 / Claude: 파일당 200줄 이하, 길수록 준수율 하락)
2. **규칙은 실수가 두 번 나왔을 때 추가한다.** 추측으로 미리 쓰지 않는다. (Codex: "base changes on real friction")
3. **막는 건 권한·린터로, 안내는 문서로.** 훅은 빠르고 오탐 없는 결정적 검사만. 판단이 필요한 건 훅에 넣지 않는다.
4. **센서의 에러 메시지에 고치는 방법을 적는다.** 에이전트가 메시지만 보고 스스로 고치게. (OpenAI)
5. **작업 기억은 파일 하나.** 작업마다 실행 계획 파일 하나에 목표·완료 조건·진행·다음 할 일. 끝나면 보관. (Anthropic progress file · OpenAI execution plans)
6. **완료의 정의를 명시하고, 사람처럼 확인한다.** 단위 테스트만으로 완료 처리하지 않는다. 화면은 브라우저로 확인. (Anthropic)
7. **한 번에 기능 하나.** 한 작업(브랜치)은 PRD FR 하나 또는 개발 단위 하나. (Anthropic)
8. **도구 두 개(Claude Code · Codex)가 같은 원본을 읽는다.** 원본은 `AGENTS.md`와 `.agents/skills/`, Claude 쪽은 얇은 연결만.

## 3. 구성

### 3.1 가이드 (행동 전에 방향을 주는 것)

| 파일 | 내용 | 크기 |
| --- | --- | --- |
| `AGENTS.md` (루트) | 프로젝트 한 줄, 폴더 지도, 명령, 브랜치·커밋 규칙, 완료의 정의, 금지 사항, 세부 문서 링크 | ≤ 100줄 |
| `CLAUDE.md` (루트) | `@AGENTS.md` 한 줄 (Claude가 AGENTS.md를 반드시 로드하게) | 1줄 |
| `frontend/AGENTS.md` · `frontend/CLAUDE.md` | FSD 규칙, 서버·클라이언트 경계, Tailwind 토큰. Next가 넣은 블록 유지 | ≤ 80줄 |
| `backend/AGENTS.md` · `backend/CLAUDE.md` | 패키지 구조, Flyway 규칙, 테스트(Testcontainers) | ≤ 80줄 |
| `docs/agents/architecture.md` | 레인·묶음과 폴더 매핑, 데이터 흐름, 계약 위치 | 필요 시 |
| `contracts/` | C1 · C2 · C3 — 레인 간 계약의 단일 원본 | — |
| `docs/plans/active/<branch>.md` | 작업별 실행 계획(템플릿 아래). 머지되면 `docs/plans/done/`으로 | 작업당 1개 |

하위 폴더 지침은 Claude가 그 폴더 파일을 다룰 때 자동으로 읽고, Codex는 가까운 파일을 우선한다. 같은 내용을 `.claude/rules/`에 또 쓰지 않는다(이중 원본 방지).

**실행 계획 템플릿** (`docs/plans/active/<branch>.md`)

```markdown
# <type>/<name> — <한 줄 목표>
- Jira: S15P31C108-XX · PRD: FR-XX · 묶음/단위: P5-23
## 완료 조건
- [ ] (검증 가능한 문장. 예: GET /v1/places/{id}/cards 가 근거 4종 상태를 돌려준다)
## 진행
- 2026-10-22: …
## 다음 할 일 / 막힌 것
```

### 3.2 스킬 (반복 절차)

원본은 `.agents/skills/<name>/SKILL.md`(Codex가 읽음). Claude는 `.claude/skills/<name>/SKILL.md`에 "원본을 읽어라" 한 줄짜리 연결 파일만 둔다. 각 SKILL.md는 80줄 이하.

| 스킬 | 하는 일 | 호출 |
| --- | --- | --- |
| `start` | Jira 이슈 확인·생성(중복 검색 → 생성 → 담당자·스프린트·상태 `진행 중`) → develop 최신화 → 브랜치 → 실행 계획 파일 생성(완료 조건부터). 확인은 **한 번에 묶어서 한 번만** 받는다 | 사람만 (`disable-model-invocation`) |
| `check` | 바뀐 영역만 lint · typecheck · test. 실패하면 원인 수정 | 사람·에이전트 |
| `finish` | 전체 게이트 → 실행 계획 갱신·보관 → 커밋 → MR 본문 초안 → Jira에 MR 링크 코멘트. push는 사람. `완료` 전이는 머지 뒤 | 사람만 |
| `review` | 현재 브랜치 diff를 리뷰어 관점으로 | 사람·에이전트 |
| `handoff` | 실행 계획의 '다음 할 일'을 채우고 세션 종료 | 사람·에이전트 |

**Jira는 에이전트가 맡되, whyUP처럼 SKILL.md에 절차를 다 넣지 않는다.** Jira 필드 처리(에픽·스프린트·Story Point·전이)는 `start/jira.md` 참고 파일로 빼서 필요할 때만 읽게 한다(Claude skills의 progressive disclosure). 필드 ID·전이 ID는 저장소에 고정하지 않고 매번 조회한다. Atlassian MCP는 `.mcp.json`(Claude)과 `.codex/config.toml`(Codex)에 같은 URL로 선언한다.

whyUP의 작업 유형 스킬(db-migration, api-contract-sync 등)은 같은 실수가 두 번 나올 때 하나씩 옮긴다.

### 3.3 센서 (행동 뒤에 확인하는 것)

| 센서 | 언제 | 내용 | 상태 |
| --- | --- | --- | --- |
| `pnpm check` | 에이전트·사람이 수시로 | 변경 파일로 영역 판별 → frontend(eslint + steiger + tsc) / backend(gradle test) / contracts | 있음 |
| `pnpm check:all` | MR 전 | 전체 lint · typecheck · test · build | 있음 |
| steiger (FSD) | check에 포함 | 레이어 방향 · public API 위반 | 있음 |
| ArchUnit (backend) | backend test에 포함 | 패키지 의존 방향 | 있음 (기본 규칙 4개, 계층 규칙은 구조 정해지면) |
| commit-msg 훅 | 커밋 | 제목 형식, 실패 시 예시 출력 | 있음 |
| pre-commit 훅 | 커밋 | 비밀 파일 차단 | 있음 |
| pre-push 훅 | push | `pnpm check` | 있음 |
| GitLab CI | MR | `pnpm check:all` | 설정만 있음 (`.gitlab/ci/check.gitlab-ci.yml`, Runner 준비 후 include) |

모든 센서의 실패 메시지는 **무엇이 틀렸는지 + 고치는 명령**을 함께 출력한다.

### 3.4 권한과 훅 (`.claude/settings.json` · `.codex/`)

| 항목 | 방식 | 이유 |
| --- | --- | --- |
| `.env` · 키 파일 읽기·수정 금지 | `permissions.deny` | 정규식 가드 대신 권한으로. 오탐 없음 |
| `git push --force`, `main` 직접 push | `permissions.deny` + GitLab 보호 브랜치 | 서버에서도 막힘 |
| 편집 후 포맷 | `PostToolUse`(Edit\|Write) → 바뀐 파일 하나만 포맷, 수 초 안 | 빠르고 결정적 · 적용 (frontend 파일만, Prettier) |
| 압축(compaction) 후 맥락 복구 | `SessionStart`(compact) → 현재 브랜치의 실행 계획 파일 경로 출력 | 긴 세션에서 목표를 잃지 않게 · 적용 |
| 매 턴 검사(Stop 훅) | **두지 않는다** | whyUP의 180초 대기 재발 방지. `/check`로 명시 실행 |
| 작업 기록 없는 편집 차단 | **두지 않는다** | 실행 계획은 `start`가 만들고, 없으면 `finish`가 경고만 |

## 4. 도입 순서

| 단계 | 시기 | 할 일 | 완료 조건 |
| --- | --- | --- | --- |
| 1 | W1 (이번 주) · 적용 | `CLAUDE.md` → `@AGENTS.md`, 루트 AGENTS.md를 지도형으로 재작성, frontend/backend AGENTS.md, 실행 계획 템플릿, `.claude/settings.json` 권한 | Claude·Codex 새 세션에서 규칙 질문에 맞게 답함 |
| 2 | W1~W2 · 적용 | `pnpm check`(변경 영역 판별) · `check:all` · pre-push 훅, 에러 메시지에 해결 명령 | 프론트만 바꾸면 백엔드 테스트가 안 돎, 60초 안 |
| 3 | W2 · 적용(시범 실행 전) | 스킬 5개(start · check · finish · review · handoff), Claude 연결 파일 | 한 기능을 start → finish까지 실제로 한 번 돌려 봄 |
| 4 | W3~ · 적용(CI 는 Runner 대기) | 포맷 훅, compaction 훅, ArchUnit, CI | 팀원 1명 이상이 실사용 |
| 계속 | 매주 금요일 15분 | **하네스 회고**: 이번 주 에이전트가 두 번 틀린 것 → AGENTS.md 한 줄 또는 센서 하나로. 안 쓰인 규칙·스킬은 삭제 | AGENTS.md 줄 수가 늘기만 하지 않음 |

## 5. 하네스가 잘 도는지 보는 지표

| 지표 | 목표 |
| --- | --- |
| 루트 AGENTS.md 줄 수 | ≤ 100 |
| 훅 오탐(정상 작업이 막힌 횟수) | 0 — 한 번이라도 나오면 그 훅을 좁히거나 뺀다 |
| `pnpm check` 시간(한 영역) | ≤ 60초 |
| 같은 실수 반복 | 두 번째부터 규칙·센서로 막힘 |
| 실행 계획 없이 머지된 MR | 0 (finish 경고 + MR 템플릿 체크박스) |

## 6. 하지 않는 것

- 매 턴 도는 Stop 훅, 정규식 명령 가드
- Notion Work Log 자동 기록 (Jira 이슈와 MR이 작업 기록의 원본)
- 작업마다 JSONL 로그, backlog 파일 자동 생성
- 같은 규칙을 AGENTS.md · CLAUDE.md · `.claude/rules` · 스킬에 중복으로 쓰는 것

## 7. 확인할 것

- [ ] whyUP에서 실제로 불편했던 점이 §1 추정과 맞는지 (특히 가드 오탐, Stop 훅 대기, Jira·Notion 기록 부담)
- [x] 도구: Claude Code와 Codex 둘 다 쓴다 (2026-10-21 확정)
- [x] Jira: 이슈 생성·전이는 에이전트가 `start`·`finish`에서 맡는다 (2026-10-21 확정)
- [ ] CI 서버(Jenkins / GitLab Runner) 준비 시기

## 참고

- Claude Code — [Memory(CLAUDE.md · AGENTS.md · rules)](https://code.claude.com/docs/en/memory) · [Skills](https://code.claude.com/docs/en/skills) · [Hooks guide](https://code.claude.com/docs/en/hooks-guide)
- [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI Codex — Best practices](https://learn.chatgpt.com/guides/best-practices)
- [OpenAI — Harness engineering](https://openai.com/index/harness-engineering/) · [InfoQ 보도](https://www.infoq.com/news/2026/02/openai-harness-engineering-codex)
