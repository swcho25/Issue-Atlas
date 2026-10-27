# fix/airkorea-monthly-files — 에어코리아 월별 파일(zip) 형식 읽기

- Jira: (미생성 — 이 세션에 Atlassian 미연결) · PRD: v4.0 카드 A3 · SP23 · 묶음/단위: P1

## 완료 조건
- [ ] 2023·2025 형식(zip 안 월별 `YYYY년 M월.xlsx`, 시트 `Data`, 짧은 열 이름 `SO2`…)을 읽는다
- [ ] 2024 형식(엑셀 1개, 월별 시트, 긴 열 이름)도 그대로 읽는다
- [ ] 같은 측정값은 파일 형식이 달라도 content_hash · locator(obs_key)가 같다. 형식만 다른 두 묶음을 같이 정제해도 DEDUP_KEY_CONFLICT 가 없다
- [ ] 실제 2023(확정)·2025(잠정) 파일 한 달씩 로컬 DB 에 넣고 P2 정제가 held 없이 통과한다
- [ ] engine lint · test, tests_postgres 통과

## 진행
- 2026-10-27: 시작. 기준 origin/develop(5886c2b). 에어코리아 확정자료 다운로드 탭(last_amb_hour_data)에서 2023·2025* 받음. 2025* 는 페이지 안내상 월보 통계(잠정)
- 2026-10-27: 결정 — 시트 이름은 포장(파일 형식) 정보라 content_hash(payload)·locator 에서 뺀다. 파일명·기간은 이미 job_run.stats.run_params 에 남는다. C1 README 의 「locator 에 시트명 보존」 문구를 같이 고친다

- 2026-10-27: zip(월별 파일) 입력·짧은 열 이름 지원, 시트를 payload·locator 에서 제거. 새 테스트 3건이 고치기 전 실패하는 것을 본 뒤 구현
- 2026-10-27: 실제 파일 export-only 확인 — 2023-01-01 22곳 3,168건 pass. 2025-01-01 은 처음 9곳(여수만)만 나옴: 2025 파일은 광주 표기가 `전남광주 북구`(2023 은 `광주 북구`). 지역 정규식에 `전남광주 <구>` 추가 후 22곳 3,168건 pass, 전부 is_provisional=true
- 2026-10-27: engine lint PASS, pytest 전부 PASS. tests_postgres 는 Docker Desktop 꺼짐으로 미실행

## 다음 할 일 / 범위 밖
- 2023·2025 전 기간 적재(월 단위 실행 × 24)와 개발 서버 DB 적재
