# P1 KOSIS 인구 수집기

Jira: [S15P31C108-85](https://ssafy.atlassian.net/browse/S15P31C108-85), [S15P31C108-110](https://ssafy.atlassian.net/browse/S15P31C108-110).
카드 C1 의 세 사양을 받는다. 기본 기간은 2023–2025.

| `--spec-id` | 표 | 받는 칸 | 주기 | 지표 ID |
| --- | --- | --- | --- | --- |
| SP01 | `DT_1B26001` 순이동(T25) | 성별 계 · 연령 계(000)·19–34세(901)·19–39세(905) | 월 | `population_net_migration` |
| SP02 | `DT_1B26003_A02` 이동자수(T70) | 전출지 = 대상 지역, 전입지 = 시도 18개(00 전국 포함) · 성별 계 | 월 | `population_movers` |
| SP10 | `DT_1B04006` 총인구(T2) | 연령 계(000)·19–39세 1세별 | 연(12월 말) | `population_registered` |

여수 `46130`, 광주 동구 `29110`·서구 `29140`·남구 `29155`·북구 `29170`·광산구 `29200`의 원천(옛) 코드를 보존한다.
지역마다 한 번 요청한다(여러 코드는 `+`로 묶는다). 표 정의는 `kosis.py`의 `TABLES`에 있다.
공통 지역 매핑·자동 일정·진행 중인 해의 일부 달은 범위 밖이다(기간은 연 단위, 월 표는 1–12월 전부를 요구한다).

## 실행

저장소 루트에서 실행한다. 상대 경로는 uv의 engine 작업 디렉터리 기준이다.
실제 API 실행에는 루트 `.env`의 `KOSIS_API_KEY`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`,
`POSTGRES_HOST`(기본 localhost), `POSTGRES_PORT`(기본 5432)를 런타임에 읽는다.
키는 CLI 인자·OS 환경 변수에서 받지 않고 `.env` 값을 보간하지 않는다.
백엔드 Flyway V0001·V0002가 적용된 **로컬 개발 DB**가 먼저 필요하다. 수집기가 DDL을 실행하지 않는다.

```powershell
# 지표 ID 기본값은 표마다 정해져 있다 (C1 indicators.json)
uv --directory engine run python -m pipeline.collect --spec-id SP01
uv --directory engine run python -m pipeline.collect --spec-id SP02
uv --directory engine run python -m pipeline.collect --spec-id SP10

# 기본 출력: outputs/collect/kosis-c1.json (gitignore)
uv --directory engine run python -m pipeline.refine ../outputs/collect/kosis-c1.json
```

`--start-year`, `--end-year`, `--regions`(옛 코드), `--source-id`, `--spec-id`, `--output`으로 범위를 지정한다.
`source_spec.params`에는 표 정의(표·항목·주기·받는 코드)와 지표 ID만 둔다. 기간·지역은 실행마다 달라도 되며
`job_run.stats`(`start`·`end`·`regions`)에 남는다. 등록된 사양의 표 정의가 다르면 `SPEC_CONTRACT_MISMATCH`로 거절하고 덮어쓰지 않는다.
2026-10-27 전 SP01(연·20–24세, 기간이 params에 들어간 형식)이 있는 DB는 그 SP01 행(normalized_record → raw_record → job_run → source_spec)을 지우고 다시 받는다.
정의·차원은 C1 [indicators.json](../../../contracts/c1/indicators.json)에 기록한다. TBD는 거절한다.

`--fixture`에 고른 사양의 원천 응답 배열(JSON)을 주면 네트워크 없이 C1/P2에 연결해 볼 수 있다.
저장소의 `contracts/c1/examples/raw/kosis-net-migration.json`은 초기 범위(연·20–24세) 예시라 지금 사양과 맞지 않는다(테스트의 `EXAMPLE_TABLE`이 이 범위다).

fixture와 함께 쓰는 export-only는 `.env`를 읽지 않으며 DB 쓰기를 하지 않았다고 명시한다.
`--export-only`만 주면 `.env`의 키로 실제 API를 호출해 C1을 출력하되 DB에는 쓰지 않는다.
`--fixture`만 주면 원천 파일을 사용하되 실제 DB에 저장한다. 이 경우에도 키 누락 검사는 유지한다.

## 저장·실패 규칙

- 지역별 요청마다 HTTP timeout 30초, 응답 최대 10MiB. 리다이렉트는 거절한다. 오류 JSON·빈 배열·잘못된 행·요청하지 않은 코드·기간이나 코드 조합 누락은 실패다. 재시도는 수동 실행하며 실패를 성공으로 감추지 않는다.
- `source`·`source_spec`은 없을 때 등록하고 기존 이용 조건·저장 범위·사양이 다르면 실행 전에 거절한다. 인증키는 등록 사양에 들어가지 않는다.
- API 호출 전 `job_run`(status/finished_at=null)을 커밋한다. 모든 지역·연도를 검증하고 C1/P2 pass를 확인한 후 raw 배치 전체를 한 트랜잭션으로 저장한다. 중간 DB 오류는 raw 전체를 롤백하고 별도 트랜잭션으로 failed를 기록한다.
- 원천 JSON **행**의 키를 정렬한 UTF-8 canonical JSON SHA-256을 content_hash로 쓴다. 실행 시각·run_id·API 키는 해시에 넣지 않는다. payload에는 해당 원천 행을 저장한다. 응답 전체 바이트의 해시를 뜻하지 않는다.
- 원본과 같은 행의 `c1_record`(V0005)에 그 원본으로 만든 C1 레코드(장부)를 함께 저장한다. P2 정제는 이 칸만 읽는다.
- 전역 UNIQUE(content_hash)로 재수집을 처리한다. 이미 있는 원본은 그대로 두고, 장부가 비어 있는(V0005 전에 저장된) 행만 장부를 채운다. 처음 저장한 장부는 덮지 않는다. 원천 값/갱신일이 바뀌면 새 raw 행을 저장한다. C1 출력은 해당 실행에서 받은 모든 행이며 중복 raw의 원래 job_run 소유권을 바꾸지 않는다. 실행별 received/inserted/duplicates 통계를 남긴다.
- C1은 기존 계약을 바꾸지 않는다. 값은 정수(쉼표 구분 허용), 빈 문자열만 null + not_published다. `-`, `...`, 비공개 부호 등 의미가 불명확한 문자열은 실패시켜 0이나 결측으로 추측하지 않는다. 연 기간은 한국 시각 `[1/1, 다음해 1/1)`, 월 기간은 `[1일, 다음 달 1일)`, 수집 시각은 UTC다. locator는 표·`C1`…`Cn`·항목·`PRD_DE`, dedup_key는 `kosis:<표>:<C1…Cn>:<항목>:<주기>:<PRD_DE>:<LST_CHN_DE>`다.
- LST_CHN_DE가 있으면 계약 예시처럼 해당 날짜 KST 00시를 published_at으로 쓴다. 실제 게시 시각 정밀도를 뜻하지 않는다. 없으면 null이다.
- raw URL은 인증키 대신 `<KEY>`를 저장한다. API 예외/DB 예외/응답 msg를 출력하지 않고 고정 error_code를 남긴다. 응답이 실제 키를 포함하면 저장 전에 거절한다.
- DB 저장 후 파일을 같은 디렉터리의 임시 파일에서 원자 교체한다. 출력 실패는 raw를 보존하고 `C1_EXPORT_FAILED`·inserted 수를 남긴다. 재실행은 raw 중복 없이 파일을 재생성한다. 실패 exit code는 1이며 기존 출력이 있을 수 있으므로 성공 exit code 0일 때만 후속 P2를 실행한다.
- DB 접속·source/spec 검증 실패는 job_run 생성 전이라 DB 실패 이력이 없다. DB 자체 장애로 종료 상태 기록이 실패하거나 프로세스가 강제 종료되면 status=null이 남을 수 있다. 자동 복구는 별도 범위다.

## 검증

```powershell
pnpm check
# 외부 API 키/기존 개발 DB 없이 임시 PostGIS를 띄워 실제 저장·중복·롤백 검증
uv --directory engine run pytest tests_postgres
```

DB 통합 테스트는 명시 실행한다. 기본 `engine:test`는 Docker가 필요 없는 테스트를 돌린다.
통합 테스트가 만드는 컨테이너만 중지/제거하며, 기존 DB·볼륨에는 연결하지 않는다.
이 테스트는 저장소 DB 이미지의 기반 PostGIS digest를 사용한다. Flyway·pgvector 설치 검증은 backend Testcontainers에서 한다.

원천 계약 근거: [KOSIS 공식 개발가이드](https://kosis.kr/openapi/devGuide/devGuide_0201List.do),
저장소 [C1](../../../contracts/c1/README.md), [DB V0002](../../../contracts/database/README.md).
README에서 계약을 가리키는 상대 경로는 저장소 루트의 실제 파일을 참조한다.
