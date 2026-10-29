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
# P2 정제 저장: DB 의 장부(raw_record.c1_record)를 관측 일 묶음으로 나눠 정제해 normalized_record 에 저장
# (루트 .env 의 DB 칸, 건수 JSON 출력. 묶음마다 커밋. 에어코리아 확정 시간값은 정제 행 대신 월별 표 air_monthly 에만 씀)
uv --directory engine run python -m pipeline.refine --db
# 기사 본문 수집: 빅카인즈 뉴스 검색 응답(fields 에 provider_link_page · content) → 기사마다 결과 JSONL
# robots.txt 를 지키고 같은 사이트 요청 사이에 1초를 둔다. 출력에 기사 본문이 들어가므로 저장소 밖에 저장한다
uv --directory engine run python -m pipeline.article <빅카인즈 응답 JSON 파일> > <저장소 밖 경로>.jsonl
# DB 저장은 빅카인즈 수집기(pipeline.collect.bigkinds)가 raw_record 에 한다 (pipeline/collect/README.md 「빅카인즈 뉴스」)
# PostGIS 통합 테스트 (Docker 필요, pnpm engine:test 에는 안 들어감)
uv --directory engine run pytest tests_postgres

# HTTP 입구: backend 가 바로 응답을 기다리는 요청만 받는다 (지금은 GET /health)
uv --directory engine run uvicorn api.main:app   # http://127.0.0.1:8000/health
```

새 폴더를 만들면 아래 표에 담당과 함께 적는다.

| 폴더 | 담당 | 성격 |
| --- | --- | --- |
| `pipeline/refine/` | 박준우 | P2 정제 — 검증·정규화·저장 범위 게이트·중복 |
| `pipeline/article/` | 박준우 | 기사 본문 수집 — 빅카인즈 원문 링크 → 본문(같은 기사 확인). 요약은 P3. 빅카인즈 수집기가 불러 `raw_record` 에 저장 ([계약](../contracts/article/)) |
| `pipeline/collect/` | 장성우 | P1 KOSIS·에어코리아 수집·원천 저장·C1 출력 ([KOSIS](pipeline/collect/README.md), [에어코리아](pipeline/collect/AIRKOREA.md)) |
| `api/` | (미정) | FastAPI HTTP 입구 — pipeline 함수를 부르기만 한다 |
