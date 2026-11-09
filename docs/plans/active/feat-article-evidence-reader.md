# feat/article-evidence-reader — 근거 기사를 보도자료처럼 근거 상세로 연다

- Jira: S15P31C108-318 · PRD: FR-E4 · 묶음/단위: S2

## 완료 조건
- [x] 질문 실행 때 결과 기사마다 문서 근거 행(`ev_news_…`)을 만들고 C2 `articles[]` 에 `evidence_id` · `source_grade` 를 준다(예전 실행 결과는 칸 없음 허용)
- [x] `contracts/c2` 스키마 · README 에 두 칸과 규칙을 적는다
- [ ] 원문 탭 기사 줄에 등급이 보이고, 누르면 근거 상세가 열린다. 근거 ID 없는 예전 결과는 지금처럼 원문 사이트로 연다
- [ ] backend test · frontend lint · typecheck · test 통과, 개발 서버 브라우저 확인 (검사 통과 2026-11-09, 브라우저는 개발 서버 배포 뒤)

## 진행
- 2026-11-09: 시작. 빅카인즈 기사 3,483건 모두 제목 · 언론사 · 링크 · 이용 조건이 `normalized_ready` 에 있고 출처 등급은 `source` 의 C. 기사는 `data.documents` 에 섞지 않는다(C2 README 「빅카인즈 기사는 문서 근거로 세지 않고 articles[] 로만」)

- 2026-11-09: backend `createArticleEvidence` + 기사 목록에 근거 ID · 등급, C2 선택 칸 두 개(동결 문서 기록), 원문 탭 기사 줄 → ?e= 근거 상세 · 링크만 건수에서 뺌. QuestionApiTest 41 · EvidenceApiTest 4 · C2Examples · OpenApiContract 통과, frontend lint · typecheck · vitest 116 통과

## 다음 할 일 / 범위 밖
- 지난 실행 결과(근거 칸 없음)는 다시 실행해야 근거 상세로 열린다
- 근거 상세 각주의 출처가 「빅카인즈 뉴스」라 언론사 이름은 원문 위치(`locator.publisher`)에만 있다. 각주에 언론사를 넣을지는 S2 문구 결정
