# feat/admin-jobs-api — 관리자 수집 이력 조회 API

- Jira: (생성 대기) · PRD: FR-F5 · 8장 보조 API `GET /v1/jobs` · 묶음/단위: P7 · 요청: 조석원(관리자 화면 123)

## 완료 조건
- [x] 실행마다 수집 대상(소스 · 명세) · 시작 · 종료 시각 · 상태 · 처리 건수 · 실패 사유를 조회한다
- [x] 목록은 페이지네이션(page 1부터, size 최대 100)과 상태 · 수집 대상(source_id · spec_id) 필터를 둔다
- [x] 관리자 전용(조회자 403, 로그인 없이 401). 재실행은 없다
- [x] C2 계약에 응답 스키마 · 예시 · OpenAPI 경로를 더한다

## 진행
- 2026-10-29: 조석원 요청으로 시작. 팀 규칙(관리자 API 는 /v1/admin/**, 권한 판정은 필터 체인 한 곳)에 맞춰 경로를 GET /v1/admin/jobs · /{job_run_id} 로 둔다
- 2026-10-29: 새 표 없이 job_run · source_spec · source 를 읽는다. 건수(received · inserted · duplicates)와 실패 코드(error_code)는 stats 에서 꺼내고, stats 전체는 details 로 그대로 준다(수집기마다 칸이 다름). 끝나지 않은 실행은 status running
- 2026-10-29: AdminJobApiTest 5건 PASS. 실제 응답 3개를 ajv 로 C2 job-list · job 스키마 검증 → valid. redocly lint valid

## 다음 할 일 / 범위 밖
- 재실행(요청 범위 밖)
- 실패 사유는 수집기가 남긴 고정 코드뿐이다. 코드 → 한국어 설명 표가 필요하면 화면과 정한다
