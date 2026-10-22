# engine/ — Python 서비스

수집·정제·지역·시간 매핑(pipeline)과 카드 분류·LLM 판정(ai)이 들어온다.
Python 3.13 · uv · ruff · pytest. 규칙은 `AGENTS.md`.

```bash
uv --directory engine sync   # 처음 한 번 (.venv 생성)
pnpm engine:lint             # 루트에서
pnpm engine:test

# P2 정제: C1 레코드 JSON 배열 파일 → 정제 레코드 JSONL (키 정렬, 같은 입력이면 같은 바이트)
# 검증은 contracts/c1/record.schema.json 을 직접 읽는다
uv --directory engine run python -m pipeline.refine <C1 레코드 JSON 배열 파일>
```

새 폴더를 만들면 아래 표에 담당과 함께 적는다.

| 폴더 | 담당 | 성격 |
| --- | --- | --- |
| `pipeline/refine/` | 박준우 | P2 정제 — 검증·정규화·저장 범위 게이트·중복 |
