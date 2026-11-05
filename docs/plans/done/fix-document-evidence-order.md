# fix/document-evidence-order — 논증 카드 문서 근거를 등록일 순으로 정렬

- Jira: S15P31C108-259 · PRD: FR-B · 묶음/단위: P2 — -253 후속

## 완료 조건
- [x] 논증 응답 `data.documents` 가 근거 ID 순이 아니라 판정이 고른 순서(보도자료 등록일 순)로 나온다
- [x] 근거 ID 순과 등록일 순이 다른 두 글로 통합 테스트 — `QuestionApiTest.documentsAreListedByPublishedDateNotEvidenceId`
- [ ] 개발 서버 여수 C1 응답에서 등록일 순 확인 — 병합 · 배포 뒤

## 진행
- 2026-11-05: 판정(`pressEvidence`)은 등록일 순 ID 를 주지만 `QuestionService.load` 가 저장소(`evidence()`, ID 순)에서 읽은 순서를 그대로 썼다. `load` 가 판정이 준 순서로 다시 놓는다. 통계(1건) · 분모(카드 설계도 순)도 같은 길이라 분모는 이제 설계도 순. 기존 대응은 `load` 를 거치지 않아 그대로(ID 순)

## 다음 할 일 / 범위 밖
- 없음
