# engine/ — Python 서비스

수집·정제·지역·시간 매핑(pipeline)과 카드 분류·LLM 판정(ai)이 들어온다.
Python 3.13 · uv · ruff · pytest. 규칙은 `AGENTS.md`.

수집기 서버 실행·자동 버전 갱신: [EC2 수집기 배포](../deploy/collector/README.md).

```bash
uv --directory engine sync   # 처음 한 번 (.venv 생성)
pnpm engine:lint             # 루트에서
pnpm engine:test

# P2 정제: C1 레코드 JSON 배열 파일 → 정제 레코드 JSONL (키 정렬, 같은 입력이면 같은 바이트)
# 검증은 contracts/c1/record.schema.json 을 직접 읽는다
uv --directory engine run python -m pipeline.refine <C1 레코드 JSON 배열 파일>
# P2 정제 저장: DB 의 장부(raw_record.c1_record)를 정제해 normalized_record 에 저장 (루트 .env 의 DB 칸, 건수 JSON 출력)
uv --directory engine run python -m pipeline.refine --db
# PostGIS 통합 테스트 (Docker 필요, pnpm engine:test 에는 안 들어감)
uv --directory engine run pytest tests_postgres

# HTTP 입구: backend 가 바로 응답을 기다리는 요청만 받는다 (지금은 GET /health)
uv --directory engine run uvicorn api.main:app   # http://127.0.0.1:8000/health
```

새 폴더를 만들면 아래 표에 담당과 함께 적는다.

| 폴더 | 담당 | 성격 |
| --- | --- | --- |
| `pipeline/refine/` | 박준우 | P2 정제 — 검증·정규화·저장 범위 게이트·중복 |
| `pipeline/collect/` | 장성우 | P1 KOSIS·에어코리아 수집·원천 저장·C1 출력 ([KOSIS](pipeline/collect/README.md), [에어코리아](pipeline/collect/AIRKOREA.md)) |
| `api/` | (미정) | FastAPI HTTP 입구 — pipeline 함수를 부르기만 한다 |
