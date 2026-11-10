# perf/api-gzip — API JSON 응답 gzip

- Jira: S15P31C108-238 후속(!138 리뷰 제안) · 경계 GeoJSON 여수 약 175KB

## 완료 조건
- [x] 2KB 넘는 JSON 응답을 Accept-Encoding: gzip 일 때 압축한다(`server.compression`)
- [x] 병합 뒤 개발 서버에서 `curl -H 'Accept-Encoding: gzip'` 로 `Content-Encoding: gzip` · 크기 확인 — 2026-11-05: 경계 184,531 → 47,893 바이트, 지역 목록 1,651 → 315

## 진행
- 2026-11-04: Spring Boot 설정 두 줄. 압축은 Tomcat 이 해 MockMvc 테스트로는 안 보인다 → 개발 서버에서 확인

## 다음 할 일 / 범위 밖
- 경계 응답 캐시 헤더(경계는 마이그레이션으로만 바뀐다)
