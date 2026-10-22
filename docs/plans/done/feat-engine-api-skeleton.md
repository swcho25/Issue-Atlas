# feat/engine-api-skeleton — engine FastAPI 앱 뼈대

- Jira: S15P31C108-81 (에픽 S15P31C108-61) · PRD: — · 묶음/단위: —

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] `uv --directory engine add` 로 fastapi·uvicorn(실행)과 httpx2(dev, 처음 계획은 httpx — 진행 참고)가 pyproject.toml·uv.lock 에 들어간다
- [x] `engine/api/` 의 FastAPI 앱에서 `GET /health` 가 200 과 JSON 을 돌려준다 (`tests/test_api_health.py`, TestClient)
- [x] `uv --directory engine run uvicorn api.main:app` 로 띄운 서버에 실제로 요청하면 `/health` 가 200 이다
- [x] engine/README.md(실행 명령, 폴더 표 `api/` 행)와 루트 README.md(기술 스택 Engine 줄, 구조의 engine 설명)가 현재 상태와 맞다
- [x] `pnpm engine:lint` · `pnpm engine:test` 통과

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-22: 시작
- 2026-10-22: backend 가 engine 에 보내고 바로 응답을 기다리는 요청(자유 질문 해석 · 기관 자료 업로드 검증 · AI 검수 한 건 재분류 · health/metrics)은 FastAPI 로 받는다. 수집·정제·대량 LLM 분류는 HTTP 가 아니라 큐(RabbitMQ)·배치로 둔다. 재분류 결과 저장은 backend 가 맡고 engine 은 결과만 돌려준다. `api/` 는 pipeline 함수를 부르기만 하는 얇은 입구
- 2026-10-22: Jira S15P31C108-81 생성 (같은 일 이슈 없음, 에픽 [공통] 개발 환경·하네스, 스프린트 2, SP 1, `진행 중`). `/metrics` 는 이번에 넣지 않고, README 표의 `api/` 담당은 비워 둔다 (사람 결정)
- 2026-10-22: fastapi 0.159.1 · uvicorn 0.54.0 추가. 테스트용은 httpx 대신 httpx2 2.16.0 — Starlette 1.9 TestClient 가 httpx 로 돌리면 `StarletteDeprecationWarning`(httpx2 를 쓰라는 경고)을 내서 바꿈. `pytest -W error` 로 경고 없음 확인
- 2026-10-22: `api/main.py` 에 `GET /health` → `{"status": "ok"}`. 테스트를 먼저 써서 `api` 모듈이 없어 실패하는 것을 본 뒤 구현. `uvicorn api.main:app --port 8765` 로 띄워 curl: `/health` 200 `{"status":"ok"}`, 없는 경로 404. `pnpm check` PASS — engine lint 0.5s · test 4.2s (pytest 92건)
- 2026-10-22: finish — `pnpm check:all` 은 harness PASS 뒤 backend format 에서 멈춤 (개발 PC 에 Java 없음). 이 브랜치는 backend/·frontend/ 를 바꾸지 않음. 나머지는 하나씩 돌려 PASS — frontend lint 24s · typecheck 12s · test 14s(9건) · e2e 20s(1건), engine lint 1s · test 5s(92건). backend format·build 는 미실행
- 2026-10-22: push 전에 origin/develop(1a7dae8, 정제 커밋 6개) 위로 rebase (push 전이라 머지 커밋 없이). 충돌 없음. `pnpm check` PASS — engine lint 0.5s · test 4.5s (pytest 131건)

## 다음 할 일 / 범위 밖
- `/metrics`(Prometheus) — 클라이언트 라이브러리(prometheus-client · prometheus-fastapi-instrumentator) 선택부터
- `api/` 담당자 정해서 engine/README.md 표에 적기
- 엔드포인트: 자유 질문 → 지역·이슈·기간 해석, 기관 자료 업로드 검증, AI 검수 한 건 재분류
- Docker Compose 에 engine 서비스 추가 (내부망만 노출)
- backend↔engine HTTP 계약을 `contracts/` 에 OpenAPI 로 추가하고 backend 리뷰 받기
- 루트 README 「시작하기」의 필요한 것에 uv 가 없음 (engine 을 돌리려면 필요)
