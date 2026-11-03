# test/openapi-contract-paths — C2 엔드포인트가 Swagger 문서에 다 있는지 검사

- Jira: S15P31C108-158 후속(API 계약 테스트 자동화) · 기준: 5차 멘토링 회의록 표 2 장성우 「API 5종 Swagger + 계약 테스트」(11/13) · PRD FR-J1

## 완료 조건
- [x] `contracts/c2/openapi.yaml` 의 (메서드, 경로) 9개가 `/v3/api-docs` 에 모두 있는지 테스트한다. 경로 변수 이름은 빼고 비교
- [x] 응답 모양은 기존 API 테스트의 `C2Contract.matches` 가 본다(9개 스키마 모두 검사 중 — 이번에 확인)

## 진행
- 2026-11-03: 시작. 응답 스키마 9종은 이미 각 API 테스트가 검사하고 있었고, 빠진 것은 「계약 엔드포인트 ↔ 실제 라우트」 검사였다

## 다음 할 일 / 범위 밖
- 컨트롤러 경로 변수 이름이 계약과 다르다(`{evidenceId}` · `{jobRunId}` vs `{evidence_id}` · `{job_run_id}`). URL 은 같아 동작 차이는 없고, Swagger 화면 이름만 다르다
- Swagger UI 에 계약 파일을 그대로 띄우기: 이미지 빌드 범위(`backend/`) 밖 파일이라 빌드 · 배포 쪽과 함께 정한다
