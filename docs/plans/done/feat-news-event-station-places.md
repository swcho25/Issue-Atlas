# feat/news-event-station-places — P3 기사 사건 표와 측정소 · 시군구 지역 시드

- Jira: S15P31C108-148 · PRD: — · 묶음/단위: P3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] V0016 이 news_event 표를 만든다(P3 칸 · CHECK · 인덱스). 기간 역전, 좌표 없이 정밀도 지정, 한국 범위 밖 좌표를 PostGIS 통합 테스트가 거절로 확인한다
- [x] V0017 이 측정소 22곳을 place(plc_stn_<코드>, level station, 부모 시군구, exact 좌표)와 place_code_map(airkorea_station)에 넣고, 시군구 6곳에 중심 좌표(admin_centroid)와 attrs {sido, sigun, gu}를 채운다
- [x] 시드만 있는 DB에서 GET /v1/observations (A3, plc_yeosu)가 여수 측정소 9곳을 돌려준다
- [x] contracts/p3 에 news_event 칸 · 적재 규칙 · 지역 맞추기 쿼리를 적고, contracts/README · database README 변경 이력을 고친다
- [x] pnpm backend:format:check · backend:test · backend:build 통과

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-30: 시작. 입력은 P3 region_lab 산출물 news_event.sql · stat_region.sql(P2 dump issueatlas-p3-handoff 에서 만든 것)
- 2026-10-30: 결정 — stat_region 은 새 표로 만들지 않고 place · place_code_map(V0002 계약 「측정소 좌표는 place에 저장한다」)에 넣는다. 측정소 place_id 는 C2 예시의 plc_stn_<코드>, 시군구는 V0011 의 plc_* 그대로
- 2026-10-30: 결정 — 번호는 V0016 · V0017. V0015 는 feat/lofin-expenditure-collector(장성우)가 쓰고 있다. 이 브랜치가 먼저 머지되면 그쪽 V0015 는 Flyway 가 거절하므로(outOfOrder 꺼짐) 그쪽 번호를 올려야 한다
- 2026-10-30: V0016 · V0017 · contracts/p3 · 테스트 3개(NewsEventMigrationTest · StationPlaceSeedTest · ObservationApiTest 여수 시드) 작성. spotlessCheck · compileTestJava 통과. Docker 가 꺼져 있어 backend:test · build 는 아직 못 돌림
- 2026-10-30: backend:test 73개 통과(새 테스트 9개 포함) · backend:build · pnpm check 통과
- 2026-10-30: finish. 커밋 하나(V0016 · V0017 · contracts/p3 · 테스트). MR 은 P3 정우현 · P7 장성우 리뷰 필요

## 다음 할 일 / 범위 밖
- 측정소 유형(station_type: 도시대기 · 도로변 · 항만 …)이 stat_region 에 없다. C2 observations 는 null 허용이라 비워 둠 — P3 가 채워 주면 attrs 에 넣는다
- 읍면동 place 행과 그 place_id 형식(P3 는 kr-<코드>)이 정해지지 않았다. news_event.place_id 는 외래키 없는 참고 값으로 둔다
- news_event 행 적재(P3 파이프라인)와 기사 ↔ 카드 분류(P4)는 이 작업 밖
- feat/lofin-expenditure-collector(V0015)와 머지 순서를 맞춘다. 이 브랜치가 먼저면 그쪽 번호를 V0018 로
