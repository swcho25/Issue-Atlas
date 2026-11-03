# engine 규칙

Python 서비스. 수집·정제·지역·시간 매핑(pipeline)과 카드 분류·LLM 판정(ai)이 들어온다.
`(미정)` 칸은 그 코드가 처음 들어오는 MR 에서 채운다. 추측으로 채우지 않는다.

## 폴더
- 하위 폴더와 담당은 `README.md` 표에 적는다
- 파이프라인 단계는 `pipeline/<단계>/` 패키지 하나씩 (예: `pipeline/refine/` = P2 정제). 테스트는 `tests/`

## 도구
- Python 3.13 (`.python-version`)
- 패키지 관리: uv. `uv.lock` 를 커밋한다. 추가는 루트에서 `uv --directory engine add <패키지>` (개발용은 `--dev`)
- 린트·포맷: ruff · 테스트: pytest (설정은 `pyproject.toml`)

## 계약
- 수집 결과의 메타 필드는 계약 C1(`contracts/`, PRD 7.1)을 따른다. 필드를 바꾸려면 C1 을 먼저 고치고 받는 쪽 리뷰를 받는다
- backend 가 읽는 테이블·스키마를 바꾸면 backend 의 Flyway 마이그레이션과 같은 MR 에서 바꾼다

## 데이터 · LLM
- API 키는 `.env` 에서 읽는다. 코드·로그·커밋에 남기지 않는다. 새 키는 `.env.example` 에 이름과 설명만
- 수집 원본은 출처·수집 시각(UTC)·원문 위치를 함께 저장한다
- LLM 판정 결과는 규칙 판정과 구분해 표시한다(논증 카드의 provenance)
- 모델·프롬프트는 쓰는 모듈 안에 판 이름과 함께 둔다(예: `ai/argument/prompt.py` `PROMPT_VERSION`, `ai/argument/gms.py` `MODEL`). 결과에 판·모델을 남긴다
- 비용 한도: 논증 문장화는 실행 한 건에 한 번 부른다. 429·5xx 만 두 번까지 다시 부르고, 검사 탈락은 다시 부르지 않는다

## 검사 (루트에서)
- `pnpm engine:lint` (ruff check + format --check) · `pnpm engine:test` (pytest). uv 가 있어야 한다
- `pnpm check` 가 engine 변경 시 둘을 돌린다. 포맷 자동 수정은 `uv --directory engine run ruff format .`
