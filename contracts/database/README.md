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

## 카드 목록 조회 (S15P31C108-132, V0013)

- `card`: 카드 ID·이름·대분류·상위 질문·카드 버전·분류 버전. C2 예시의 C1(청년 유출·정착)·A3(대기질) 메타만 seed한다. 논증 판정 규칙이나 카드 승인 기능은 포함하지 않는다.
- `card_evidence_status`: `(place_id, card_id, card_version, period_start, period_end, kind)`별 확정 상태. 종류는 C2 근거 4종, 상태는 C2의 5가지다. 기간은 날짜 `[start,end)`이며 정확히 같은 기간·카드 버전만 조회에 사용한다. 다른 기간과 겹친다는 이유로 확보 상태를 재사용하지 않는다.
- P3/P4의 근거 연결 결과를 기록할 조회 경계다. 현재 상태 작성기·자동 분류기는 없으며, API는 미등록을 `not_collected`, 보류 수를 0으로 응답한다. raw_record나 normalized_ready가 있다는 이유만으로 카드·지역 관련성을 추측하지 않는다.
- `review_pending_count`는 근거 종류별 보류 항목 수의 합이며 확보 종류 수와 다르다. `review_pending` 상태이면 양수여야 한다. `available` 종류에도 아직 검토 중인 다른 항목이 있을 수 있다.
- `available_kinds`는 상태가 `available`인 종류 수(0~4)만 센다. 행 수·품질·심각도·순위가 아니다.
- 한 목록의 카드들은 같은 `taxonomy_version`을 사용한다. 서로 다른 분류 버전을 섞어 등록하지 않는다.

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
- v0.1.8 (2026-10-28): 지역 6곳(광주 5구 · 여수시)과 KOSIS 옛 · 새 코드를 `place` · `place_code_map` 에 넣는다(V0011). place_id 는 [C2 예시](../c2/examples/place-list.json)와 같다. `GET /v1/places` 가 이 표를 읽는다.
- v0.1.9 (2026-10-29): 기사 본문 표 `news_article` · `news_article_ready` 뷰를 지운다(V0012, S15P31C108-128). 기사는 C1 기사 칸으로 `raw_record` → `normalized_record` 에 저장한다. V0007 은 이미 적용돼 있어 그대로 둔다. 개발 서버 표에 있던 행도 함께 지워진다.
- v0.1.10 (2026-10-29): 근거 표 `evidence` 추가(V0014, S15P31C108-134). 논증 카드의 근거 하나가 한 행이며 원본 여러 건을 묶을 수 있다(원본 위치는 `locator`). 출처 등급 · 이용허락 · 저장 범위는 근거를 만든 때의 값을 함께 둔다. `link_only` 는 `display` 를 둘 수 없다(CHECK). 채우는 쪽은 질문 실행(S15P31C108-133). `GET /v1/evidence/{evidence_id}` 가 읽는다.
- v0.1.11 (2026-10-29): 지방 세출 표 `local_expenditure` 추가(V0015). 지방재정365 세부사업별 세출현황의 광주 본청 · 5구 · 여수시 행. 기반 6개 테이블과 FK 없이 따로 두고 칸 · 규칙은 [지방 세출 계약](../expenditure/README.md)에 둔다. `storage_scope = full` CHECK.
- v0.1.12 (2026-10-30): 기사 사건 표 `news_event` 추가(V0016, S15P31C108-148). 기사 하나에 요약 · 사건 시간대 · 위치 · 지역(시도 · 시군 · 구) 한 행이며 P3 가 채운다. 기반 6개 테이블과 FK 없이 따로 두고 칸 · 규칙은 [P3 계약](../p3/README.md)에 둔다.
- v0.1.13 (2026-10-30): 측정소 22곳(여수 9 · 광주 13)을 `place`(`plc_stn_<코드>`, 부모 시군구, exact 좌표)와 `place_code_map`(`airkorea_station`)에 넣고, 시군구 6곳에 행정 중심 좌표(`admin_centroid`)와 `attrs` {sido, sigun, gu}를 채운다(V0017, S15P31C108-148). 입력은 P3 지역표. `GET /v1/observations` 가 이 행을 읽는다.
- v0.1.14 (2026-11-01): 시도 18곳(KOSIS 시도 2자리 17곳 + 통합시 12)을 `place`(`kr-<코드>`, `level = sido`, `admin_centroid`)에 넣고 `place_code_map` 에 KOSIS 시도 2자리 · 광주 전체 `29` · 온통청년 `bjd` 시군구 코드 · 측정소 이름(`airkorea_station_name`)을 잇는다(V0018). 칸 · 규칙은 [P3 계약](../p3/README.md) v0.2. `GET /v1/places` 는 시도를 내보내지 않는다.
- v0.1.18 (2026-11-01): 질문 · 실행 표 `question` · `argument_run` · `argument_run_source` 추가(V0023, S15P31C108-133). 질문 하나에 실행 여럿, 실행 하나 = 결과(C2 argument jsonb) 하나이며 고치지 않는다. `argument_run_source` 는 실행이 쓴 근거(`evidence`)와 기존 대응 후보(`existing_response`, 판) — 출처 등급이 없어 근거로 못 만든 후보는 `response_id` 만. `card_id` null = 신규 카드 후보.
