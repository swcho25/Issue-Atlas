# 머지 커밋 메시지 템플릿

GitLab 은 이 파일을 읽지 않는다. 아래 내용을 **설정 → 병합 요청 → 병합 커밋 메시지 템플릿**에 붙여 넣는다(관리자 권한 필요).
바꾸면 이 파일도 같이 고친다.

```
Merge: %{title}

%{source_branch} → %{target_branch} · %{reference}
%{url}

%{approved_by}
Merged-by: %{merged_by}
```

- `%{title}` 은 MR 제목이다. MR 제목 규칙 `<type>: <명사형 요약> (S15P31C108-XX)` 을 지키면 머지 커밋에 Jira 키가 남는다.
- `%{approved_by}` 는 승인자마다 `Approved-by: 이름 <메일>` 한 줄로 바뀐다. 승인이 없으면 빈 줄이 된다.
- 첫 줄이 `Merge` 로 시작하므로 로컬 commit-msg 훅의 제목 검사도 통과한다.

예 (S15P31C108!1 에 적용했다면)

```
Merge: infra: 모노레포·하네스 초기 구성 (S15P31C108-61)

develop → main · !1
https://lab.ssafy.com/s15-final/S15P31C108/-/merge_requests/1

Merged-by: 정우현 <...>
```
