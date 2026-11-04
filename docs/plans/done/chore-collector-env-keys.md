# chore/collector-env-keys — 수집기 서버 키 목록 정리

- Jira: S15P31C108-209 · 앞 MR: !108 리뷰에서 맡음

## 완료 조건
- [x] `deploy/collector/.env.example` 에 수집기가 읽는 키 이름이 모두 있다(값 없이): YOUTHCENTER · BIGKINDS · P3_LLM_* 4개 · JUSO_SEARCH_KEY · SGIS_KEY · SGIS_SECRET · GMS_API_KEY
- [x] 이름은 engine 코드가 실제로 읽는 이름과 같다(`config.get(...)` · `dotenv_values(...).get(...)` 전수 확인)

## 진행
- 2026-11-03: develop 의 engine 이 읽는 키 16개와 대조해 빠진 10개를 더함(P4 임베딩 GMS_API_KEY 포함). `P3_LLM_WORKERS` 는 코드 기본값 4 를 그대로 적음

## 다음 할 일 / 범위 밖
- 서버 `/etc/issueatlas/collector.env` 에 실제 값 넣기는 서버 담당(이 MR 은 이름만)
