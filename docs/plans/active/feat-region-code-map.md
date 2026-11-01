# feat/region-code-map — 통계 · 추가 자료 지역 코드 연결과 시도 place

- Jira: (Atlassian 연결 전이라 미생성 — MR 전에 만든다) · PRD: 7.6 · 묶음/단위: P3-7 · P3-8

## 완료 조건
- [x] 개발 DB 에서 출처마다 지역 코드를 세어 `place_code_map` 에 없는 코드를 찾는다 (읽기만)
- [x] V0018 이 시도 18곳(KOSIS 시도 2자리 17곳 + 통합시 12)을 `place`(`kr-<코드>`, `level = sido`, 대표점 `admin_centroid`, `attrs` {sido, sigun, gu})에 넣는다
- [x] V0018 이 `place_code_map` 에 KOSIS 시도 2자리 · 광주 전체 `29` · 온통청년 `bjd` 시군구 코드 · 측정소 이름(`airkorea_station_name`)을 잇는다. 기존 행(V0011 · V0017)은 고치지 않는다
- [x] `GET /v1/places` 가 시도를 내보내지 않는다 (지역 선택 화면은 시군구 6곳 그대로)
- [x] contracts/p3 v0.2 · database README · contracts README 변경 이력
- [x] `pnpm backend:format:check` · `backend:test` · `backend:build` 통과
- [ ] 장성우(P7) 리뷰: `plc_` → `kr-` 전환(11/3)과 마이그레이션 번호 · 형식 맞추기

## 진행
- 2026-11-01: 개발 DB 확인. 연결된 것: KOSIS SP01 · SP02 · SP10 시군구 6곳, `air_monthly` 측정소 22곳, 세출 · 보도자료의 5개 구 · 여수. 빠진 것: 온통청년 `bjd` 5,633행, 세출 「광주 본청」 · 보도자료 광주 `29` 15,399행, 측정소 메타 이름 22행, SP02 도착 시도 `locator.C2` 17곳
- 2026-11-01: 결정 — 새 place 는 `kr-<코드>`. 11/3 `kr-` 전환 방향과 같고 `news_event.place_id`(개발 DB 3,477건)가 이미 `kr-29` · `kr-12` · `kr-44` 로 가리킨다. 시군구 · 측정소에 잇는 코드는 place_id 를 쓰지 않고 기존 코드(KOSIS 새 코드 · 측정소 코드)로 찾아 넣어 전환 뒤에도 맞게
- 2026-11-01: 결정 — 광주 `29` · 전남 `46` 은 유효 기간을 두지 않는다(통합 뒤 다른 곳을 가리키지 않고 수집기가 계속 `29` 를 씀). 통합시 `12` 는 2026-07-01 부터
- 2026-11-01: 개발 DB `source_spec` 8개 전부 확인. V0018 적용 전 `place_code_map` 에 없는 코드는 측정소 이름 22 · `bjd` 6 뿐이고 둘 다 V0018 이 잇는다(측정소 이름 22개 모두 V0017 `place.name` 과 같음). 세출 · 보도자료 `29` 와 SP02 `locator.C2` 도 V0018. 백엔드 test · format · build 통과
- 2026-11-01: 좌표는 P3 시도 대표점(p3-region-lab `data/sido_points.tsv`, SGIS · 역지오코딩으로 18곳 모두 자기 시도 안 확인)

## 다음 할 일 / 범위 밖
- 넓은 지역 기사(광주 구 모름 · 통합시 전체)를 구의 근거로 셀지 — 대표 피드백 #6. 정해지면 contracts/p3 「지역 맞추기」 수정
- 읍면동 place 행 (기사 `place_id` 읍면동은 참고 값)
- `news_event` 판 칸(`extraction_version`) 마이그레이션
- 보도자료 사건 시간, 온통청년 정책 기간의 시간 정규화
- p3-region-lab 의 지역 추출 · 덤프 코드를 `engine/pipeline/region` 으로 옮기기
