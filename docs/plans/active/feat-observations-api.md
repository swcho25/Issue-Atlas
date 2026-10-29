# feat/observations-api — A3 지도 점(측정소 × 월평균) API

- Jira: S15P31C108-135 · PRD: 8장 API ⑤ · FR-D1·D2·D4·D7 · 묶음/단위: P7 (L2)

## 완료 조건
- [x] GET /v1/observations 가 A3 측정소 점과 월평균을 C2 GeoJSON 으로 돌려준다 (격리된 테스트 데이터로 확인)
- [x] 값이 없으면 value null + missing_reason 을 준다
- [x] 좌표 없는 카드(C1)는 features 빈 배열로 준다
- [ ] 실제 측정소 22곳이 place(level station) · place_code_map(airkorea_station)에 들어간 DB 에서 확인한다 — 적재 담당 · 기준 확인 대기(정우현, 116·117)

## 진행
- 2026-10-29: 시작. 새 표 없이 place · place_code_map · air_monthly 를 읽는다. 측정소는 지역의 자식(parent_id), 코드는 airkorea_station 의 유효 기간 안에서만 잇는다. 이름으로 잇지 않는다
- 2026-10-29: 월평균은 air_monthly 그대로(다시 계산하지 않음). 월 표에 없는 달 not_collected, 월 표에 있지만 월평균이 없는 달(유효 시간 75% 미만) not_published. 좌표 없는 측정소는 점을 만들지 않는다
- 2026-10-29: ObservationApiTest 4건(측정소 격리 · 코드 변경 · 기간 경계 · 결측 · C1 · 오류 · 401) PASS. 실제 응답 2개(A3 · C1)를 ajv 로 C2 observations 스키마 검증 → valid

## 다음 할 일 / 범위 밖
- 확인 필요: 달 중간에서 시작 · 끝나는 기간의 포함 기준이 계약에 없다. 지금은 달 1일이 아니면 400
- 확인 필요: C2 예시 observations-a3-yeosu 는 요약(max/min_month)이 요청 기간 밖의 달을 가리킨다. 지금 구현은 요청 기간 안에서 고른다
- 확인 필요: 「월 표에 있지만 월평균 없음」을 not_published 로 볼지
- 132(카드 표)가 생기면 카드 상수(A3 지표 · 범례 문구)를 카드 표에서 읽는다
- 134(근거 상세)가 생기면 evidence_id 를 근거 표의 ID 로 바꾼다. 지금은 C2 예시 규칙 ev_air_<측정소코드>_<YYYYMM>
- station_type(도시대기 · 항만 …)은 저장 위치가 정해지지 않아 null
- 나쁨 일수(bad_days_total)는 일 단위 값이 없어 null
