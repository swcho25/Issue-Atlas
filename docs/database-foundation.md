# DB 기반 마이그레이션 설계 검토

기준: 2026-10-21 로컬 ERD v0 및 C1 공통 메타 작업 지시서. 루트 erd_v0.md·수집 샘플은 읽기만 하며 이 문서에는 설계 결정을 새로 정리한다. ERD 원본은 이동·수정·커밋하지 않는다.

## 이번 마이그레이션 초안 범위

전체 ERD 13개 중 수집·지역의 기반 6개(source, source_spec, job_run, raw_record, place, place_code_map)를 먼저 만든다. observation·document·card·question·run·card_revision·app_user는 뒤이어 계약과 업무 규칙을 대조한다. 우선 권고한 기반 6개 범위로 초안을 작성하며, 전체 13개 확대는 후속 범위로 남긴다. 구현 계약은 [DB 기반 v0.1](../contracts/database/README.md)에 정리한다.

| 테이블 | 역할 | 관계 |
| --- | --- | --- |
| source | 소스·이용 조건·보관 범위 | source_spec의 기준 |
| source_spec | 수집 방식·분류·인자 | source 참조 |
| job_run | 수집 실행 이력 | source_spec 참조 |
| raw_record | 원문 추적과 수집 원본 | job_run·source_spec 참조 |
| place | 행정구역·측정소 기준 정보 | 자기 참조 parent_id |
| place_code_map | 원천 코드와 공통 지역 연결 | place 참조 |

API·JPA Entity·초기 운영 데이터는 별도 작업이다. 새 빈 PostGIS DB에서 Flyway가 순서대로 적용되고 FK·UNIQUE·CHECK가 실제로 실패를 잡는지 통합 테스트한다.

## ERD와 C1 대조에서 확인한 항목

- 코드 체계 이름: ERD의 airkorea_name은 C1의 airkorea_station_name과 다르므로 C1 이름으로 맞춰야 한다.
- content_hash: C1은 수집기가 채우기 전 null을 허용한다. raw_record의 hash를 NOT NULL로 만들지 않는다. ERD의 전역 hash UNIQUE는 동일 본문을 여러 소스·실행에서 다시 만날 때 수집 이력과 어떻게 연결할지 후속 확인이 필요하다.
- 원문 추적: raw_url·file_name 중 하나 이상은 null이 아니어야 한다. URL 키 제거는 수집기의 책임이며 DB 형식 검사만으로 실제 비밀값 유무를 보장하지 않는다.
- spec/run: raw_record가 실행과 다른 spec을 가리키지 않도록 복합 FK로 강제했다.
- 공간: 측정소 좌표는 place에 저장한다. geography(Point,4326)와 GiST는 거리·근접 조회를 지원하지만 행정 경계 포함 판정은 Point만으로 해결되지 않는다. P3의 경계 자료 설계가 별도로 필요하다.
- 날짜: C1 관측 기간은 [start,end)이지만 지역 코드 valid_to는 ERD 예시의 2026-06-30처럼 날짜 단위의 마지막 유효일이다. 두 규칙을 구분하고 미상 경계는 null로 보존해야 한다.
- JSON: params·stats·attrs는 객체가 기대되므로 jsonb_typeof CHECK를 적용했다. 원천 payload는 실제 응답 배열도 허용한다.
- 보관 정책: metadata/link_only 소스에 원문 payload 저장을 강제하면 안 된다. payload null을 허용하며 수집 단계에서도 이용 조건을 검사해야 한다.
- 실행 상태: ERD의 ok/failed/aborted 이외 진행 중에는 status·finished_at 둘 다 null, 종료 시 둘 다 채우는 초안을 사용한다. P1 리뷰에서 이 표현을 확정한다.

## 후속 테이블에서 확인할 항목

- observation: C1의 nullable indicator_id, 결측 사유 XOR, provisional, 기간·시각, place 미매핑 정보를 저장하는 경계.
- document: ERD 열린 질문인 is_provisional·missing_reason 및 C1 메타 보존 방식.
- card/question/run: 복합키(card_id,version)와 참조 구조. question이 어느 버전 카드를 가리키는지, run에서 어떤 입력을 고정할지 합의.
- card_revision/app_user: 권한·검수 담당과 승인 주체 FK, 삭제·보관 정책 대조.

## 참고

- [PostgreSQL 17 제약조건](https://www.postgresql.org/docs/17/sql-createtable.html)
- [PostGIS 좌표 읽기](https://postgis.net/docs/ST_X.html)
