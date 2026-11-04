# refactor/c2-path-variable-names — 경로 변수 이름을 C2 계약에 맞춤

- Jira: S15P31C108-158 후속(API 계약 테스트 자동화) · 앞 MR: !107 (`test-openapi-contract-paths` 「다음 할 일」)

## 완료 조건
- [x] 근거 상세 · 수집 이력 상세의 경로 변수를 `{evidence_id}` · `{job_run_id}` 로 바꾼다(URL · 응답은 그대로)
- [x] `OpenApiContractTest` 가 경로 변수 이름까지 계약과 같은지 비교한다

## 진행
- 2026-11-03: 두 컨트롤러를 `{run_id}` · `{place_id}` 와 같은 방식(`@PathVariable("…")`)으로 맞추고, 계약 테스트의 `{}` 정규화를 뺐다

## 다음 할 일 / 범위 밖
- Swagger UI 에 계약 파일을 그대로 띄우기: 이미지 빌드 범위(`backend/`) 밖 파일이라 빌드 · 배포 쪽과 함께 정한다
