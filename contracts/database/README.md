# 수집·지역 DB 기반 계약 v0.1 초안

P1 수집·P3 지역·P7 서버가 공유하는 DB 기반. 구현은 backend/src/main/resources/db/migration/V0002__collection_place_foundation.sql이며 P1·P3 담당 리뷰가 필요하다. 전체 ERD 13개 중 기반 6개만 포함한다. 나머지는 docs/database-foundation.md의 후속 확인을 거친다.

| 테이블 | 식별자 | 핵심 저장 규칙 |
| --- | --- | --- |
| source | source_id text | 이름·기관·이용 조건·storage_scope 필수. 신뢰 등급·robots 결과는 확인 전 null 허용 |
| source_spec | spec_id text | source FK, method(api/file/board/rss), evidence_class 4종, params 객체 기본 {}. 수동 수집 schedule은 null |
| job_run | job_run_id text | spec FK, collector_version·started_at 필수, stats 객체 기본 {}. 종료 전 status·finished_at 모두 null, 종료 시 둘 다 입력 |
| raw_record | bigint identity | 실행과 spec이 일치하는 복합 FK. raw_url/file_name 중 하나 이상 필수. content_hash·payload null 허용. `c1_record`(V0005): 수집기가 이 원본에서 만든 C1 레코드(장부), jsonb 객체 또는 null. P1이 채우고 P2 정제가 읽는다([P2 계약](../p2/README.md)) |
| place | place_id text | 계층 sido/sigungu/emd/station, parent 자기 FK. geography(Point,4326), 한국 범위 경도 124~132·위도 33~39 |
| place_code_map | bigint identity | place FK, C1 코드 체계 5종, 코드·유효 날짜 연결 |

## C1과의 관계

- C1 run_id는 DB의 job_run.job_run_id다. 분석 실행 run과 구분한다.
- source_id는 source_spec을 통해 연결한다. raw_record의 spec_id는 job_run과 일치해야 한다.
- content_hash는 수집기가 채우기 전 null을 허용한다. null hash 여러 행은 허용하고 같은 non-null hash는 전역 UNIQUE로 거절한다(ERD 기준). 재수집 이력·다른 소스의 동일 본문을 보존할 때의 연결 모델은 P1과 별도 확정한다.
- **원본은 content_hash로 찾는다.** C1 run_id는 마지막 확인 실행이고, raw_record.job_run_id는 최초 저장 실행일 수 있다. 같은 hash 재수집으로 원본의 FK를 덮어쓰지 않으며 원본 조회에 run_id 일치 조건을 추가하지 않는다.
- payload는 원천 JSON의 객체·배열을 모두 저장할 수 있다. metadata/link_only는 payload 없이 추적 정보만 저장할 수 있다. 이용 조건에 따른 payload 보관은 수집기에서 검사한다. DB는 다른 테이블의 storage_scope를 CHECK로 자동 판정하지 않는다.
- 측정소 좌표는 place에 저장하고 GeoJSON 순서대로 [경도,위도]를 사용한다. geometry가 null이면 location_precision=none. 빈 Point·허용 범위 밖 좌표는 거절한다.
- place_code_map은 kosis/airkorea_station/airkorea_station_name/bjd/sgis를 사용한다. ERD의 airkorea_name은 C1과 이름을 통일했다.

## 실행과 날짜

에어코리아 XLSX의 신규 spec_id는 `airkorea_final_yeosu_gwangju`로 고정한다(S15P31C108-102).
source_spec.params에는 지역·지표 같은 불변 수집 명세만 둔다. 매 실행의 file_name·start_date·end_date_exclusive·data_status는
job_run.stats에 실행 시작 때부터 저장한다. 종료 시 건수·실패 원인과 함께 보존한다.
raw_record는 공식 자료 목록 raw_url과 허용된 원천 관측 셀 payload를 보존하고 file_name은 null이다.
따라서 파일명 변경·하루/월 재수집으로 C1 식별자가 달라지지 않는다. 원천 파일명은 실행 stats로 조회한다.
기존 동적 spec_id 자료는 자동 이관·삭제하지 않는다. P2·P7 리뷰 후 과거 레코드와의 연결 절차를 정한다.

job_run의 종료 상태는 ok/failed/aborted다. 진행 중 상태를 새 enum으로 만들지 않고 status=null, finished_at=null로 저장하는 초안이다. 종료 시 둘을 한 UPDATE에서 채운다. finished_at은 started_at보다 빠를 수 없다. 이 표현은 P1 리뷰가 필요하다.

코드의 valid_from·valid_to는 날짜 단위이며 양 끝 포함, null은 해당 경계 미상/무제한이다. C1 관측 기간의 끝 미포함 규칙과 다르다. 예: 46130은 valid_to=2026-06-30, 12130은 valid_from=2026-07-01. 동일 코드 체계·코드·valid_from은 중복 불가하고 미상 valid_from의 중복도 NULLS NOT DISTINCT로 막는다. 서로 다른 시작일 사이의 기간 겹침, 지역 부모의 다중 단계 순환은 현재 DB에서 검사하지 않으며 P3 매핑 검증에서 확인한다.

시각은 timestamptz로 저장한다. 같은 순간의 KST·UTC 입력은 동일하게 비교되며 화면 표시 시간대는 별도다. place Point의 GiST는 근접 조회용이며 행정 경계 판정을 위해서는 별도 경계 자료가 필요하다.

## 인덱스·보존

FK 조회 인덱스, spec별 실행/수집 시각 인덱스, place geometry GiST 및 코드 고유 인덱스를 만든다. FK는 기본 NO ACTION이며 원본 이력을 연쇄 삭제하지 않는다. 운영 seed·실제 수집 데이터·API 키는 마이그레이션에 넣지 않는다. 기존 V0001은 수정하지 않는다.

V0006은 `vector` 확장만 활성화한다. 벡터 칼럼과 벡터 인덱스는 이 DB 계약에 아직 없다.

## 검증

새 Testcontainers PostGIS에 Flyway V0001→V0002 적용, 재실행의 migrationsExecuted=0, FK·UNIQUE·CHECK의 거절 및 null hash·서강동 실제 좌표·KOSIS 옛/새 코드 저장을 FoundationMigrationTest에서 확인한다.

- `node scripts/gradle.mjs test --tests com.c108.issueatlas.FoundationMigrationTest`
- `pnpm check`
- `pnpm backend:build`

## 변경 이력

- v0.1 (2026-10-21): 수집·지역 기반 6개 초안. P1·P3 리뷰 대기.
- v0.1.1 (2026-10-26): raw_record에 장부 칸 `c1_record` 추가(V0005, S15P31C108-99). P1이 채운다.
- v0.1.2 (2026-10-26): pgvector 확장 활성화(V0006, S15P31C108-104). 벡터 칼럼·인덱스는 후속 작업.
- v0.1.3 (2026-10-26): P1 수집기가 원본 저장 때 장부를 함께 저장한다. 같은 원본을 다시 받으면 비어 있던 장부만 채우고, 있는 장부는 덮지 않는다(장부의 run_id는 처음 장부를 저장한 실행). S15P31C108-102.
- v0.1.4 (2026-10-27): 기사 본문 표 `news_article` · `news_article_ready` 뷰 추가(V0007, S15P31C108-112). 기반 6개 테이블과 FK 없이 따로 두고 칸·규칙은 [기사 계약](../article/README.md)에 둔다.
- v0.1.5 (2026-10-27): 에어코리아 월별 집계 materialized view `air_monthly` 추가(V0008, S15P31C108-114). `normalized_ready` 위의 파생이며 칸·규칙은 [P2 계약](../p2/README.md) 「월별 집계」에 둔다.
- v0.1.6 (2026-10-27): `air_monthly` 를 materialized view 에서 표로 바꾸고 `normalized_record` 의 에어코리아 확정 시간 행을 지운다(V0009, S15P31C108-115). 이후 P2 정제가 이 표만 채운다.
- v0.1.7 (2026-10-28): 보도자료 목록 표 `press_release` 추가(V0010). 기반 6개 테이블과 FK 없이 따로 두고 칸·규칙은 [보도자료 계약](../press/README.md)에 둔다. 본문 칸은 없다(`storage_scope = metadata` CHECK).
- v0.1.8 (2026-10-29): 기사 본문 표 `news_article` · `news_article_ready` 뷰를 지운다(V0012, S15P31C108-128). 기사는 C1 기사 칸으로 `raw_record` → `normalized_record` 에 저장한다. V0007 은 이미 적용돼 있어 그대로 둔다. 개발 서버 표에 있던 행도 함께 지워진다.
