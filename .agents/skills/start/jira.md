# Jira 처리 (start · finish 가 필요할 때만 읽는다)

Atlassian MCP(`.mcp.json` · `.codex/config.toml`) 로 한다. 프로젝트 키 `S15P31C108`.
cloudId 는 `getAccessibleAtlassianResources` 로 얻는다(사이트 ssafy.atlassian.net).

## 검색

```
project = S15P31C108 AND statusCategory != Done AND summary ~ "<핵심 단어>" ORDER BY updated DESC
```
- 같은 일이면 재사용을 제안한다. 다른 사람이 담당이면 재사용하지 않고 알린다.
- 이미 `진행 중` 인 남의 이슈는 건드리지 않는다.

## 에픽

```
project = S15P31C108 AND issuetype = 에픽 AND statusCategory != Done
```
- 에픽 요약이 `[P1]`~`[P8]`(데이터·로직), `[S1]`~`[S4]`(화면), `[공통]` 으로 시작한다. 인원 분배 v2 의 묶음과 같다.
- 하네스·빌드·인프라 작업은 `[공통] 개발 환경·하네스`.
- 맞는 에픽이 없으면 비워 두고 확인 메시지에 「에픽 없음」이라고 쓴다.

## 생성

- 이슈 유형 `스토리`. 요약은 커밋 제목과 같은 명사형(예: `근거 수요표 API 추가`).
- 설명: 완료 조건 목록 + 브랜치 이름.
- 부모(에픽): `parent` 에 에픽 키.
- 담당자: `atlassianUserInfo` 의 account_id.
- 스프린트·Story Point 는 커스텀 필드다. `getJiraIssueTypeMetaWithFields` 로 이름이 「Sprint」「Story Point」인 필드 ID 를 찾는다.
  - 스프린트 값은 활성 스프린트 id(숫자). 같은 프로젝트의 진행 중 이슈를 `fields: ["<sprint 필드 ID>"]` 로 조회해 `state: active` 인 것을 쓴다.
  - Story Point 는 사람이 주면 넣고, 아니면 비운다.

## 전이

`getTransitionsForJiraIssue` 로 이름을 보고 고른다. ID 를 외워 쓰지 않는다.

| 언제 | 상태 |
| --- | --- |
| start 끝 | `진행 중` |
| MR 머지 뒤 (사람이 요청할 때) | `완료` |

## 코멘트 (finish)

`addCommentToJiraIssue` — 브랜치, 커밋 해시, 완료 조건 결과, (있으면) MR 링크.
