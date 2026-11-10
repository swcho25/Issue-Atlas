# feat/observation-view — 관측 행 view observation (SP10 연령 지표 ID 포함)

- Jira: S15P31C108-176 · 기준: Notion 「시공간 표시 개발 명세」 2 · 3절 · 앞선 작업: !79(시군구 kr-)

## 완료 조건
- [x] V0025 view `observation` 이 SP01 · SP02 · SP10 · `air_monthly` · `news_event` 를 명세 칸(what · when · where · value · status)으로 읽는다
- [x] SP10 연령 22코드가 `population_registered_total` · `_19` – `_39` 로 나뉜다(박준우 대응표)
- [x] SP02 전국 합계(C2 = 00) · 대응표에 없는 연령 코드는 빠지고, 통계 행은 모두 시군구 `kr-` 지역이 있다
- [x] 로컬 실데이터에서 명세 8절 행 수와 같다(SP10 은 396 = 18 + 378)

## 진행
- 2026-11-02: 측정소 → 읍면동 연결이 DB 에 없어 측정소 행 place_id 는 시군구로 둔다. 빅카인즈 수집은 검색어 하나라 기사 태그(카드)는 비운다 — 둘 다 계약 「명세와 다른 곳」
- 2026-11-02: 로컬 DB 에 view 본문을 임시 view(세션 한정)로 돌려 air 4,752 · SP01 648 · SP02 3,672 · SP10 396, obs_id 중복 0 확인
- 2026-11-02: ObservationViewTest 3 통과

## 다음 할 일 / 범위 밖
- series(명세 5절) 묶기와 질문 응답에 `series[]` · 근거 기사 목록(6절) — 장성우
- 측정소 행 place_id 를 읍면동으로(측정소 → 행정동 연결), 측정소 ID kr- 형식(정우현)
- 기사 태그: 기사 분류(P4)
