# C1 공통 메타 필드 계약 v0.2 초안

수집(P1) → 정제·지역·시간·분류(P2~P4)

레코드 단위: **값 1개 = 레코드 1개**. 측정소 정보처럼 값이 없는 메타 레코드는 `indicator_id`, `value`, `unit`, `missing_reason`을 null로 둔다.

v0.2는 **문서 1건 = 레코드 1개**도 지원한다. 선택 키 `document`가 있으면 문서이고, 없으면 기존 관측값·측정소 메타다. 기존 예시 5개는 수정하지 않는다. 이 변경은 P2(박준우)·P3(정우현)·P4(최동준) 리뷰 전 초안이다.

## 문서 레코드

공통 `published_at`에 발행 시각(오프셋 포함), `raw_url`에 문서를 받아 온 곳(빅카인즈는 검색 API 주소, 보도자료는 게시판 주소)을 넣는다. 둘 다 필수이며 발행 시각을 모르면 수집 시각으로 대체하지 않는다. 언론사 원문 주소는 `document.link`다. `indicator_id`·`value`·`unit`·`missing_reason`은 모두 null이다. 기사 발행 시각을 사건 발생 시각으로 단정하지 않고, 사건 시각이 없으면 `observed_at=null`, 기간은 `none`으로 둔다.

| document 내부 필드 | 타입 | 의미 |
| --- | --- | --- |
| kind | news / press_release / policy | 뉴스 / 보도자료 / 정책(온통청년 청년정책 등, 근거 ③ 기존 대응) |
| title | 비어 있지 않은 string | 제목 |
| publisher | string 또는 null | 언론사·발행 기관. 미제공이면 null |
| categories | string 배열 | 원천 분류. 미제공이면 빈 배열 |
| keywords | string 배열 | 원천 키워드. 미제공이면 빈 배열 |
| entities | object | locations·persons·organizations 각각 string 배열. 미제공이면 빈 배열 |
| excerpt | string 또는 null | 이용 조건이 명시적으로 허락한 보도자료 앞부분만. 뉴스는 항상 null |
| link | http(s) 주소 또는 null | 원문 페이지 주소(빅카인즈 `provider_link_page`, `http://` 가 빠졌으면 붙인 값). 쓸 수 없으면 null |
| fetch | object 또는 null | 원문 본문 수집 결과. 본문 수집을 시도하지 않은 문서는 null |
| fetch.status | enum | `ok` / `NO_LINK` / `NO_REFERENCE` / `ROBOTS_DISALLOWED` / `NETWORK_ERROR` / `HTTP_ERROR` / `NO_BODY` / `CONTENT_MISMATCH` — 뜻은 [기사 계약](../article/README.md) |
| fetch.http_status · fetch.fetched_at · fetch.fetcher | int·null · UTC 시각·null · string | 원문 페이지 응답 코드 · 요청 시각(요청 전에 멈췄으면 둘 다 null) · 본문 수집기 판(`article-0.1.0`) |
| body | string 또는 null | 원문 페이지에서 뽑은 본문. `fetch.status=ok` 이고 `storage_scope=full` 일 때만 있다 |

내부 키는 모두 필수이며 추가 키는 허용하지 않는다. 분류·키워드·개체명은 원천이 제공한 것만 보존하며 수집기가 임의 추론하지 않는다. 배열 중복은 허용하지 않는다. 하이라이트·이미지·첨부는 이 계약에 넣지 않는다.

문서의 `storage_scope`는 본문이 있으면 `full`, 없으면 `metadata`(링크만이면 `link_only`)다. `full` ⇔ `body` 있음 ⇔ `fetch.status=ok` 를 스키마가 검사한다. `link_only`의 excerpt도 항상 null이다. **기사 본문은 저장한다**(팀 결정 2026-10-28). 본문은 내부 분석(요약·분류)에만 쓰고 화면·API 로 내보내지 않는다. 스키마 통과가 계약·저장 허락을 뜻하지는 않는다. 허용 메타데이터 항목·보관 기간·AI 투입 여부는 기업 계약과 P2 문서 저장 범위 규칙으로 별도 확인해야 한다. P2 정제는 [P2 계약](../p2/README.md) v0.5 를 따른다(빅카인즈 최대 `full`, full 이 아니면 본문을 지움, 본문 없는 기사는 보류, 같은 기사는 1건만 다음 단계로).

문서 원천의 지명이 코드가 아니면 `place_code_system=source_text`, `place_code_raw`에 원문 지명을 남기고(원천이 지명을 주지 않으면 수집 검색어. 빅카인즈는 `여수 OR 광주`. 빈 문자열은 P2 입구에서 필수 칸 누락이다) `place_map_status=unmapped`, `place_id=null`로 둔다. 수집 검색어를 실제 기사 지명·행정 코드로 만들지 않는다. `source_text`는 문서에서만 허용한다. 지역·시각 확정은 P3의 역할이다.

`locator`에는 원천 기사 ID(빅카인즈 `news_id`)를, `dedup_key`에는 출처와 기사 ID로 만든 안정적인 키(`bigkinds:<news_id>`)를 둔다. 실제 원문 링크를 제공하지 않은 응답에는 링크를 추측해 넣지 않는다.

[bigkinds-news.json](examples/bigkinds-news.json)은 API 실호출 없이 만든 **합성 계약 예시**다(본문 수집 `ok` · `full`). 가상 기사 ID·제목·언론사·본문·링크를 사용하며 실제 뉴스·유효한 기사 링크가 아니다. 계약 미확정 license_type 때문에 운영 적재에 사용하지 않는다. C1 스키마만 검증하며 빅카인즈 금지 출처 해제를 뜻하지 않는다.

기준: PRD v4.1 §7.1·7.2·5.4 및 2026-10-21 C1 작업 지시서. [record.schema.json](record.schema.json)은 JSON Schema 2020-12를 사용한다. 최상위 필드는 `additionalProperties: false`로 제한하며, 원문 위치를 담는 `locator`의 키-값은 자유 형식이다. 계약 변경은 받는 쪽 박준우(P2)·정우현(P3)의 리뷰가 필요하다. 10/23 동결 전까지 v0.1 초안이다.

## 필드

`✓`는 필수 키·null 불가, `✓(키)`는 필수 키·null 허용, `△`는 선택 키다. `raw_url`·`file_name`은 적어도 하나가 존재하고 null이 아니어야 한다. 날짜·시각은 오프셋을 포함한 ISO 8601(`date-time`, 예: `2024-01-01T01:00:00+09:00`, UTC는 `Z`)이다.

| 필드 | 타입 | 필수 | 허용값·설명 | 채우는 곳 |
| --- | --- | --- | --- | --- |
| source_id | string | ✓ | 소스 목록(탭 3)의 ID | P1 커넥터 |
| spec_id | string | ✓ | 수집 사양 ID | P1 커넥터 |
| raw_url | string 또는 null | △ | 원문 URL. 예시의 API 키는 `<KEY>` | P1 커넥터 |
| file_name | string 또는 null | △ | 원천 파일명. raw_url과 적어도 하나는 null 아님 | P1 커넥터 |
| content_hash | string 또는 null | ✓(키) | 원문 내용 해시. 수집기가 채우기 전까지 null | P1 원본 적재 |
| collected_at | string(date-time) | ✓ | 수집 시각 | P1 실행기 |
| published_at | string(date-time) 또는 null | ✓(키) | 원천 게시·갱신 시각. 알 수 없으면 null | P1 커넥터 |
| observed_at | string(date-time) 또는 null | ✓(키) | 사건·관측 시각. 연 통계·측정소 메타는 null 가능 | P1 추출, P3 보완 |
| observed_at_source | enum 또는 null | ✓(키) | source / parsed / posted_at / null: 원천 제공 / 파싱 / 게시 시각 대체 / 없음 | P1 추출, P3 보완 |
| observed_period_type | enum | ✓ | H / D / M / Q / Y / instant / none | P1 변환, P3 확인 |
| observed_period_start | string(date-time) 또는 null | ✓(키) | 기간 시작(포함). type이 none이 아니면 null 불가 | P1 변환, P3 확인 |
| observed_period_end | string(date-time) 또는 null | ✓(키) | 기간 끝(미포함), `[start, end)`. type이 none이 아니면 null 불가 | P1 변환, P3 확인 |
| place_code_raw | string | ✓ | 원천 지역·측정소 코드 또는 이름. 숫자여도 문자열 | P1 커넥터 |
| place_code_system | enum | ✓ | kosis / airkorea_station / airkorea_station_name / bjd / sgis | P1 커넥터 |
| place_id | string 또는 null | ✓(키) | 공통 지역 ID. 매핑 전 null | P3 지역 매핑 |
| place_map_status | enum | ✓ | mapped / ambiguous / unmapped | P1 초기 unmapped, P3 갱신 |
| geometry | GeoJSON Point 또는 null | ✓(키) | type=Point, coordinates=[경도, 위도] 두 숫자. 경도 124~132, 위도 33~39(양 끝 포함). 추가 키 금지 | P1 원천 좌표, P3 보완 |
| location_precision | enum | ✓ | exact / address / admin_centroid / none. geometry=null이면 none | P1 추출, P3 보완 |
| geometry_role | enum 또는 null | ✓(키) | event / affected_area / office / station / null | P1 추출, P3 보완 |
| indicator_id | string 또는 null | ✓(키) | 지표 목록(탭 10)의 ID. 값 없는 메타는 null | P1 커넥터, 지표 목록 확정 후 보완 |
| value | number 또는 null | ✓(키) | 지표 값. 결측을 0으로 대체하지 않음 | P1 변환 |
| unit | string 또는 null | ✓(키) | 명, µg/m³ 등 원천 단위 | P1 커넥터 |
| missing_reason | enum 또는 null | ✓(키) | not_published / not_collected / license_blocked / null | P1 수집 결과 |
| is_provisional | boolean | ✓ | 잠정 자료 여부. 이 예시들은 false, 2025 대기질 잠정 자료는 true | P1 커넥터 |
| locator | object | ✓ | 원문 행·열·시트·분류 코드 등 자유 형식 키-값 | P1 커넥터 |
| dedup_key | string | ✓ | 원문에서 같은 관측값을 식별하는 중복 키 | P1 커넥터 |
| license_type | string | ✓ | 소스 이용 조건. KOSIS-활용약관 / KOGL-3 등 | P1 소스 설정 |
| storage_scope | enum | ✓ | full / metadata / link_only | P1 소스 설정 |
| run_id | string | ✓ | 수집 실행 ID | P1 실행기 |
| collector_version | string | ✓ | 수집기 버전 | P1 실행기 |

## 결측 규칙

`indicator_id`가 null이 아니면 `value`와 `missing_reason` 중 **정확히 하나만 null이 아니어야** 한다. 필수 키 삭제도 실패한다.

| 상황 | value | missing_reason |
| --- | --- | --- |
| 정상 관측값(실제 0 포함) | 원천 숫자 | null |
| 원천에 값이 발표되지 않음·확정 파일 빈 칸 | null | not_published |
| 미수집·robots 차단 | null | not_collected |
| 이용 조건으로 수집·저장 불가 | null | license_blocked |
| 측정소 메타(indicator_id=null) | null | null |

값과 사유가 둘 다 null이거나 둘 다 있으면 지표 레코드는 실패한다. geometry가 null이면 location_precision은 none이어야 한다. observed_period_type이 none 이외인 경우(instant 포함) 기간 시작·끝이 모두 필요하다. 기간 순서·기간 길이·실제 지역 매핑의 타당성은 변환 단계와 P3 리뷰에서 확인한다.

## P2 연동 확인 (2026-10-22)

### 수집기 입구 검사·원본 추적 (2026-10-26, S15P31C108-102)

수집기는 원본 저장 전에 `pipeline.refine.validate.validate`로 필수 칸·금지 출처·URL 키·C1 형식만 검사한다.
이용허락·저장 범위·중복과 최신본 판정은 원본 저장 후 P2가 수행한다. 수집기 성공을 P2 pass로 간주하지 않는다.

**원본은 content_hash로 찾는다.** `run_id`는 마지막으로 확인한 수집 실행이며,
동일 hash를 다시 받으면 기존 raw_record가 최초 실행에 연결된 채 남을 수 있다.
run_id만으로 원본이 없다고 판단하거나 기존 행의 실행 FK를 덮어쓰지 않는다.

에어코리아 XLSX의 신규 spec_id는 `airkorea_final_yeosu_gwangju`로 고정한다.
파일명·조회 날짜·확정/잠정 상태는 job_run.stats에, C1에는 공식 자료 목록 raw_url을 남긴다.
파일명을 바꾸거나 기간을 하루에서 한 달로 늘려도 C1 file_name은 null이고 같은 관측 칸의 식별자는 같다.
원천 파일의 실제 이름은 해당 실행 stats.file_name으로 추적한다. 이 URL은 파일 자체의 다운로드 주소가 아니라 공식 자료 목록이다.
locator는 측정소·원천 시각·열이며 시트 이름·행 번호는 포함하지 않는다(파일 형식이 달라도 같은 관측 칸). `-999`는 null + not_published로 바꾸고 원천 payload에는 -999를 보존한다.

2025년 이후 파일은 원천에서 확인한 `--data-status confirmed|provisional`을 명시해야 한다.
파일명·연도만 보고 잠정 여부를 자동 판정하지 않는다. 과거 최종확정 2024 자료의 기본값은 confirmed다.
잠정 레코드는 is_provisional=true, dedup_key에 :provisional을 붙여 확정본과 별도의 판으로 남긴다.
obs_key의 관측 칸은 같으므로 P2가 최신본을 판정한다. 과거 동적 spec_id·행 번호 locator 레코드와의 키 전환은 P2와 별도 협의한다.

`feat/p2-refine-skeleton`의 `65b24c9` 기준으로 이 계약의 예시 5개를 실제 `refine_record`에 전달했다. 모두 `content_hash=null`일 때 `held`와 `MISSING_REQUIRED(content_hash)`가 나오고, 검사 목적으로 해시 형식의 임시 값을 채우면 `pass`가 나온다. 임시 값은 호환성 확인용이며 실제 원문 해시를 대체하지 않는다.

C1은 수집기가 해시를 채우기 전까지 null을 허용한다. P2 계획은 해시가 없는 레코드를 의도적으로 보류한다. 따라서 같은 레코드가 **C1 스키마 유효 / P2 보류**일 수 있다. P1에서 해시를 채운 뒤 P2로 넘길지, P2에서 보류 후 재처리할지 박준우(P2) 리뷰로 확정해야 한다. 이 MR에서는 수신 단계의 정책을 바꾸거나 예시의 null을 가짜 해시로 채우지 않는다.

P2의 현재 필수값 검사만으로 C1 전체 스키마 검증을 대신할 수는 없다. P2 계획에도 C1 스키마 도입 뒤 맞추는 작업이 남아 있다. 필수 키·null 허용·enum·조건 규칙을 연동하는 범위와 측정소 메타 레코드의 처리 경로도 수신 측 리뷰 대상이다.

## 원천별 변환 메모

2026-10-21 실제 수집 응답·확정 파일 행과 소스 확인 결과를 기준으로 새 예시를 만들었다. 루트 로컬 샘플 파일은 읽기만 하고 이동·커밋하지 않는다.

- **KOSIS:** 응답 `PRD_SE: "A"` → `Y`, `DT` 문자열 → 숫자. 여수 20–24세(성별 계) 2023 순이동은 `-747`명, 기간은 `[2023-01-01, 2024-01-01)`(한국 시각)이다. 2023–2025는 옛 지역 코드 `46130` 등으로만 조회되고 새 코드 `12130`에는 없다. 옛 코드를 보존하고 P3에서 유효 기간별 공통 place_id에 연결한다. `LST_CHN_DE`는 날짜만 제공하므로 예시의 published_at은 해당 날짜 한국 시각 00시로 둔 초안이며 실제 게시 시각의 정밀도를 뜻하지 않는다. license_type은 소스 확인 결과의 `KOSIS-활용약관`을 적용했다.
- **측정소정보 API:** `dmX`=위도, `dmY`=경도 → GeoJSON `[dmY, dmX]`. 서강동은 `[127.725967, 34.741301]`. API에 측정소코드가 없어 `airkorea_station_name`과 `서강동`을 보존하고, 확정 파일의 측정소명으로 코드 `336121`과 연결한다. 공통 place_id는 아직 unmapped이다. 기간은 none, 시작·끝·지표·값은 null이다.
- **확정 파일:** 측정일시는 01~24시 표기. `2024010124` → `2024-01-02T00:00:00+09:00`, 기간은 `[시각-1h, 시각)`. 01시 PM25는 25 µg/m³, 02시와 24시는 빈 칸이므로 null + not_published다. 원천 측정일시를 locator에 그대로 남긴다. 아래 예시의 locator `sheet`(`2024년 1월 `)는 초기 확인 기록이며 2026-10-27부터 수집기 출력에는 넣지 않는다(2023·2025 월별 파일은 시트 이름이 `Data`라 형식마다 칸이 갈라지기 때문). 시간 구간 의미는 이 계약의 변환 규칙으로 적용하되 원천 공식 설명 대조는 P3 리뷰에서 확인한다.
- **잠정값:** 확정 2024와 기간 없는 측정소 메타, KOSIS 예시의 is_provisional은 false로 보완했다. 소스 확인 결과의 2025년* 대기질 자료는 수집 시 true로 구분하고 사용 범위는 대표 확인 대상으로 남긴다.
- **지표 ID:** KOSIS 순이동은 사용자 위임(2026-10-23)으로 `population_net_migration`을 지정했다. 정의·단위·원천 항목·차원은 [indicators.json](indicators.json)에 기록하며 P2·P3 수신 측 리뷰 대상이다. PM2.5 indicator_id, 에어코리아 source_id, 측정소정보 license_type의 `TBD...`는 남아 있다.

## 예시

에어코리아 수집기(#86)는 [airkorea-sources.json](airkorea-sources.json)의 두 source_id와
[indicators.json](indicators.json)의 `air_pm10`·`air_pm25`·`air_o3`·`air_no2`·`air_co`·`air_so2`를 사용한다.
기존 아래 예시의 TBD는 초기 원천 확인 기록으로 보존하며 신규 수집 출력에는 사용하지 않는다.
현재 측정소 좌표는 과거 측정 시점의 좌표를 보장하지 않으므로 최종확정 자료에 자동 연결하지 않는다.

`examples/*.json` 하나가 레코드 하나이며 `_note`·`_case` 같은 설명 필드는 없다.

| 파일 | 내용 |
| --- | --- |
| [kosis-net-migration.json](examples/kosis-net-migration.json) | 여수 20–24세 2023 순이동 -747 |
| [airkorea-station.json](examples/airkorea-station.json) | 서강동 좌표, 기간 없음 |
| [airkorea-measure.json](examples/airkorea-measure.json) | 서강동 PM2.5 2024-01-01 01시, 25 |
| [airkorea-measure-missing.json](examples/airkorea-measure-missing.json) | 02시 빈 칸 → null + not_published |
| [airkorea-measure-hour24.json](examples/airkorea-measure-hour24.json) | 24시 → 다음 날 00시, 원천 값은 결측 |

`examples/raw/`의 3개 파일은 샘플에 담긴 KOSIS 응답 배열·여수 측정소 items·확정 파일 행 배열을 원래 값과 순서로 다시 저장한 원천 자료다. `kosis-sp01-monthly.json`(2026-10-28 추가)은 지금 SP01 범위(월별 · 성별 계 · 연령 계·19–34·19–39)의 실제 응답 행으로, 여수 2023년 36행이다. 수집기 이미지 CI 점검이 이 파일을 쓴다. 응답 전체를 추정해 보충하지 않았다. 확정 파일의 열 순서는 지역, 망, 측정소코드, 측정소명, 측정일시, SO2, CO, O3, NO2, PM10, PM25, 주소다. raw 파일은 C1 스키마 검증 대상이 아니다. API 호출 URL의 키는 `<KEY>`로 가린다.

## 검증 방법

저장소 루트에서 실행한다. 저장소 의존성을 추가하지 않고 pnpm dlx의 임시 환경만 사용한다.

```sh
pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx ajv validate --spec=draft2020 -c ajv-formats -s contracts/c1/record.schema.json -d "contracts/c1/examples/*.json"
```

Windows 따옴표 문제라면 `-d`에 예시를 하나씩 넘긴다. 이 환경에서는 pnpm 임시 패키지 모듈 탐색 때문에 `Cannot find module 'ajv-formats'`가 발생했다. 이 경우 같은 dlx 캐시에 설치된 모듈의 절대 경로를 사용한다(PowerShell).

```powershell
$ajvPaths = @(pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx -c "where ajv")
if ($LASTEXITCODE -ne 0 -or $ajvPaths.Count -eq 0) { throw 'ajv 경로 조회 실패' }
$ajvBin = $ajvPaths[0].Trim()
$formats = Join-Path (Split-Path (Split-Path $ajvBin)) 'ajv-formats'
pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx ajv validate --spec=draft2020 -c $formats -s contracts/c1/record.schema.json -d "contracts/c1/examples/*.json"
```

실패 검증은 저장소 밖 스크래치 폴더에서 복제한 결측 예시로 실행한다. 원래 예시는 바꾸지 않는다. missing_reason을 null로 바꾸면 oneOf, 키를 삭제하면 required 위반으로 실패(종료 코드 1)해야 한다. 임시 파일은 검증 후 삭제한다.

```powershell
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('c1-contract-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $scratch | Out-Null
try {
  $record = Get-Content -Raw contracts/c1/examples/airkorea-measure-missing.json | ConvertFrom-Json
  $record.missing_reason = $null
  $invalid = Join-Path $scratch 'missing-reason-null.json'
  $record | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $invalid -Encoding utf8
  pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx ajv validate --spec=draft2020 -c $formats -s contracts/c1/record.schema.json -d $invalid
  if ($LASTEXITCODE -ne 1) { throw 'Expected validation failure (exit 1)' }
  $record.PSObject.Properties.Remove('missing_reason')
  $record | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $invalid -Encoding utf8
  pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx ajv validate --spec=draft2020 -c $formats -s contracts/c1/record.schema.json -d $invalid
  if ($LASTEXITCODE -ne 1) { throw 'Expected validation failure (exit 1)' }
} finally {
  # 이 검증에서 만든 파일과 빈 폴더만 삭제한다.
  Remove-Item -LiteralPath (Join-Path $scratch 'missing-reason-null.json') -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $scratch
}
```

`pnpm check`도 실행하되 현재 contracts 검사기는 없으므로 위 AJV 검증 결과를 별도로 계획 파일 「진행」에 남긴다. scripts/check.mjs 연결은 다음 할 일이다.

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.2 초안 | 2026-10-29 | document.kind 에 `policy` 추가(온통청년 청년정책 수집). 정책 한 건 × 대상 지역 한 곳이 레코드 하나, `place_code_raw` 는 법정 시군구 코드(`bjd`), 원천 행 전체는 payload. 링크를 주지 않는 원천이라 `link` 는 null |
| v0.2 초안 | 2026-10-28 | 문구: 기사 본문은 저장(팀 결정), 문서 P2 정제는 P2 계약 v0.5 로 연결. 스키마는 그대로 (S15P31C108-122) |
| v0.2 초안 | 2026-10-28 | document 에 link · fetch(본문 수집 결과) · body 추가, 본문이 있으면 `full` 허용(박준우 요청, 본문 저장은 팀·멘토 확인 전). raw_url 은 받아 온 곳, locator 는 `news_id` |
| v0.2 초안 | 2026-10-26 | document 칸·문서 조건·source_text, 합성 빅카인즈 예시. P2·P3·P4 리뷰 대기 |
| v0.1 | 2026-10-21 | 초안: 공통 메타 필드·enum·조건 규칙, 실제 예시 5개와 원천 자료 3개, 결측·좌표·기간 변환 규칙 |
