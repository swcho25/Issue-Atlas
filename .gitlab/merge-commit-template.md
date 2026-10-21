# 머지 커밋 메시지 템플릿 · 병합 규칙

GitLab 은 이 파일을 읽지 않는다. 아래 1 · 2 를 **설정 → 병합 요청(Settings → Merge requests)** 에 넣는다(Maintainer).
바꾸면 이 파일도 같은 MR 에서 고친다.

## 1. 병합 방식 설정

| 항목 | 값 | 이유 |
| --- | --- | --- |
| 병합 방식(Merge method) | **Merge commit** | MR 하나가 머지 커밋 하나로 남아, MR 단위로 되돌리기(`git revert -m 1`) 쉽다 |
| 스쿼시(Squash commits when merging) | **허용 안 함** 또는 **권장하지 않음** | 커밋 하나 = 논리 변경 하나 규칙을 지키므로 개별 커밋을 그대로 남긴다 |
| 「기본적으로 소스 브랜치 삭제」 | **켬** | 기능 브랜치만 지워진다. `main` · `develop` 은 보호 브랜치라 지워지지 않는다 |
| 병합 조건 | 파이프라인 성공 시에만(CI 를 켠 뒤), 스레드 모두 해결 | 검사 · 리뷰를 건너뛴 머지를 막는다 |

## 2. 병합 커밋 메시지 템플릿

**병합 커밋 메시지 템플릿(Merge commit message template)** 칸에 그대로 붙여 넣는다.

```
Merge: %{title}

%{source_branch} → %{target_branch} · %{reference}
%{url}

커밋:
%{all_commits}

%{reviewed_by}
%{approved_by}
Merged-by: %{merged_by}
```

| 변수 | 들어가는 값 |
| --- | --- |
| `%{title}` | MR 제목. 규칙대로 쓰면 `<type>: <명사형 요약> (S15P31C108-XX)` → **머지 커밋 첫 줄에 Jira 키가 남는다** |
| `%{reference}` · `%{url}` | `!12` 같은 MR 번호와 링크 |
| `%{all_commits}` | MR 에 들어간 커밋 메시지 목록. `develop → main` 에서는 배포 변경 목록이 된다 |
| `%{reviewed_by}` · `%{approved_by}` | 리뷰어 · 승인자마다 `Reviewed-by:` · `Approved-by:` 한 줄. 없으면 빈 줄 |
| `%{merged_by}` | 머지 버튼을 누른 사람 |

- 첫 줄이 `Merge` 로 시작하므로 로컬 commit-msg 훅의 제목 검사(`Merge`·`Revert` 예외)와도 맞는다.

## 3. MR 제목

| MR | 제목 형식 | 예 |
| --- | --- | --- |
| 기능 브랜치 → `develop` | `<type>: <명사형 요약> (S15P31C108-XX)` | `feat: 근거 수요표 API 추가 (S15P31C108-80)` |
| `develop` → `main` | `chore: develop → main 반영 (YYYY-MM-DD)` — 대표 이슈가 있으면 끝에 키 | `chore: develop → main 반영 (2026-11-13)` |

- `develop → main` 은 배포 후보 · 중간 발표 · 데모 시점에만 연다. 설명에는 포함된 MR 번호 목록을 적는다.

## 예

기능 MR 이 `develop` 에 머지되면

```
Merge: infra: 프론트엔드 기술 구조 확정(TanStack Query·Zod·Vitest·Playwright) (S15P31C108-65)

infra/frontend-stack → develop · !4
https://lab.ssafy.com/s15-final/S15P31C108/-/merge_requests/4

커밋:
* infra: 프론트엔드 기술 구조 확정(TanStack Query·Zod·Vitest·Playwright)

Approved-by: 정우현 <...>
Merged-by: 정우현 <...>
```
