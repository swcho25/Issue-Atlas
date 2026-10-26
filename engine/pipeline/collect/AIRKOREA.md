# 에어코리아 측정소·확정/잠정 자료 수집

[S15P31C108-86](https://ssafy.atlassian.net/browse/S15P31C108-86).
별도 단계로 측정소 API 메타와 최종확정 XLSX의 시간별 6개 농도를 수집한다.
공통 PostgresStore와 원자적 C1 파일 출력을 KOSIS 수집기와 공유한다. DB 스키마는 기존 V0002 그대로다.

## 실행 (저장소 루트)

```powershell
# 측정소 API. 루트 .env의 AIRKOREA_SERVICE_KEY에 공공데이터포털 키 입력.
uv --directory engine run python -m pipeline.collect.airkorea_cli stations

# 최종확정 파일: 원천 2024-01-01 하루(01~24시) · 여수·광주 5개 구 기본값
uv --directory engine run python -m pipeline.collect.airkorea_cli final --xlsx "C:\경로\한국환경공단_에어코리아_최종확정 측정자료_20241231.xlsx"

# DB 없이 파일→C1→P2 검증. API 키도 읽지 않는다.
uv --directory engine run python -m pipeline.collect.airkorea_cli final --xlsx "C:\경로\최종확정.xlsx" --export-only
uv --directory engine run python -m pipeline.refine ../outputs/collect/airkorea-final-c1.json

# 원천에서 2025 잠정 자료로 확인한 파일. 상태를 명시한다.
uv --directory engine run python -m pipeline.collect.airkorea_cli final --xlsx "C:\경로\2025잠정.xlsx" --start-date 2025-01-01 --end-date 2025-01-02 --data-status provisional

# 기본 검사 + Docker로 실제 PostGIS 통합 검사
pnpm check
uv --directory engine run pytest tests_postgres
```

DB 저장에는 기존 KOSIS와 동일한 `.env`의 DB 설정을 사용한다. 로컬 PostGIS와 기존 Flyway 적용이 먼저 필요하다.
`--export-only`는 DB에 쓰지 않는다. stations에서는 실제 API를 호출하므로 키는 필요하다.
`stations --fixture <JSON 배열>`은 테스트/원천 스냅샷 입력이며 실시간 API 성공으로 간주하지 않는다.

`--start-date YYYY-MM-DD --end-date YYYY-MM-DD`는 원천 일자 기준 `[start, end)`다.
최대 31일·C1 100,000건으로 실행 크기를 제한한다. 월별 시트는 필요한 달만 선택하고 read_only로 읽는다.
대상 기간의 시트가 빠졌으면 부분 성공을 내지 않고 실패한다. 큰 기간은 날짜별 실행으로 나눈다.
출력 기본 위치는 `outputs/collect/airkorea-stations-c1.json`과 `airkorea-final-c1.json`이며 gitignore 대상이다.
실행 실패(exit 1) 시 기존 파일이 남을 수 있으므로 exit 0에서만 후속 P2를 실행한다.

## 원천·변환

- source_id `airkorea_station` / `airkorea_final`, 지표 ID `air_pm10`·`air_pm25`·`air_o3`·`air_no2`·`air_co`·`air_so2`.
  정의·단위는 [C1 목록](../../../contracts/c1/indicators.json), 이용 조건은 [소스 목록](../../../contracts/c1/airkorea-sources.json)에 기록한다. P2·P3 수신 측 리뷰 대상이다.
- 측정소는 `addr=여수`, `addr=광주`의 모든 페이지를 읽고 총건수 변동·빈 중간 페이지·중복을 거절한다.
  경기 광주시와 대상 밖 지역을 제외한다. 통합 시도명의 ‘광주’ 검색에 여수가 섞이는 경우도 구분한다.
- dmX는 위도, dmY는 경도로 읽어 GeoJSON `[dmY, dmX]`를 저장한다. 측정소 API에 없는 코드를 만들어내지 않고 원천 측정소명을 보존한다.
- 확정 파일의 헤더 12개와 월 시트 이름을 확인한다. `2024010124`는 `2024-01-02T00:00:00+09:00`이며 시간 구간은 `[23:00, 00:00)`이다. 하루 필터에는 원천 날짜 1/1의 24시가 포함된다.
- 빈칸과 원천 -999(숫자 또는 문자열)는 `null + not_published`, 실제 0은 0으로 보존한다. 그 밖의 음수·무한대·문자·수식은 오류다. 원본 payload의 -999는 보존한다. PM10/PM2.5는 µg/m³, 나머지는 ppm이며 원천 값을 보간·환산하지 않는다.
- 현재 측정소 좌표를 2024년 자료에 자동 부착하지 않는다. 기본 geometry=null, location_precision=none을 유지하며 공통 지역 매핑은 P3 범위다.
  과거 위치의 유효성을 별도로 확인한 경우에만 `--stations <C1 메타 JSON>`으로 명시적으로 좌표를 연결할 수 있다. 이름·지역이 일치하고 유일한 측정소만 연결하며 모호하면 null이다.
- raw_record 하나는 원천 관측 셀 하나다. payload에 원본 시트·12개 셀 전체·원천 열명을 보관하고 C1 locator에 시트·측정소 코드·원천 시각·열을 남긴다. 행 번호는 제외해 행 순서를 바꿔도 같은 관측 칸으로 찾는다.
  SHA-256은 시트·원천 행·항목 열의 canonical JSON으로 계산한다. 같은 파일/행의 같은 항목은 재수집해도 중복 저장하지 않는다. 파일 전체 바이트 해시를 뜻하지 않는다.
- 같은 dedup_key에 서로 다른 값이 있어도 입구 검사를 통과하면 원본을 보존하고 P2가 충돌을 판정한다. 수집기는 수정본을 선택하거나 덮어쓰지 않는다.
- 2025년 이후 파일은 `--data-status confirmed|provisional`을 원천 표시에 맞춰 지정한다. 미지정이면 중단하며 연도·파일명으로 상태를 추측하지 않는다. 2024 최종확정 파일의 기본 상태는 confirmed다. 잠정은 is_provisional=true이고 dedup_key에 :provisional을 붙여 확정본과 구분한다.

## 실행 이력·보안

API/파일 읽기 전 job_run을 먼저 커밋한다. 필수 칸·금지 출처·URL 키·C1 형식만 validate로 검사한 뒤 raw 배치를 한 트랜잭션으로 저장하고 실행 결과를 기록한다. 이용허락·저장 범위·중복 판정은 저장 뒤 P2가 맡는다.
DB 중간 오류는 배치 전체 롤백 후 failed를 남긴다. 파일 출력 실패는 이미 저장한 raw와 실패 통계를 유지하고 재시도는 중복 없이 파일을 재생성한다.
파일 spec_id는 airkorea_final_yeosu_gwangju로 고정하고 source_spec.params에는 지역·지표 목록만 둔다. 파일명·기간·상태는 job_run.stats에 시작 때부터 남긴다. C1/원본은 공식 자료 목록 raw_url을 쓰고 file_name은 null이므로 재배포 파일명으로 내용이 달라지지 않는다. 실제 파일명은 해당 실행 stats.file_name으로 찾는다.
원본은 content_hash로 찾는다. C1 run_id가 마지막 확인 실행이어도 동일 hash의 원본은 첫 저장 실행에 연결돼 있을 수 있다. 과거 동적 spec_id 자료의 키 전환은 P2·P7 협의 전까지 보류한다.
키는 `.env`에서만 런타임에 읽고, Encoding 키를 한 번 디코딩해 한 번만 URL 인코딩한다.
저장 URL에는 `<KEY>`만 넣고 리다이렉트·키 반사 응답을 거절한다. API 응답 msg·DB 예외 문자열은 출력하지 않는다.

실제 API 키가 없으면 파일 경로·모의 API·원천 예시의 검증을 진행하고 실제 API 미검증을 명시한다.
확정/잠정 상태를 원천에서 확인한 파일만 입력한다. 일정 실행·P2/P3 판정 변경·정책 문서 수집은 이번 범위에 없다.

원천 참고: [공식 측정소 API·이용 조건](https://www.data.go.kr/data/15073877/openapi.do),
[에어코리아 최종확정 자료](https://www.airkorea.or.kr/web/detailViewDown?pMENU_NO=123).
