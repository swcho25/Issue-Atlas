# feat/map-base — 지도 바탕(MapLibre) · 시군구 경계

- Jira: S15P31C108-258 · PRD: — · 묶음/단위: 결과 화면 04 지도

## 완료 조건
- [x] `maplibre-gl` 설치(버전 고정)
- [x] 바탕 지도 타일 결정 — OpenFreeMap positron, 음영 없음(사용자 결정 11/4). 지명은 name:ko
- [x] 시군구 경계 응답 스키마(`shared/api/c2/boundaries.ts`, 계약 c2-0.1)와 테스트
- [x] 견본 `/dev/ui` 「지도 바탕」에서 dev 의 실제 여수 경계(`GET /v1/places/kr-12130/boundaries`)를 스키마로 받아 그린다
- 다시 쓰는 지도 컴포넌트(`MapView`)는 다음 단위로 옮김(사용자가 여기서 완료하기로 함, 11/5)

## 진행
- 2026-11-04: 시작. 지도 라이브러리는 MapLibre 로 결정(사용자). `maplibre-gl` 최신 6.16.0 은 10/25 공개(2주 안 됨)라 공급망 안전을 위해 6.15.0(10/18)으로 고정. 새 패키지 22개, 라이선스 BSD-3-Clause
- 2026-11-04: 견본으로 Esri light + 음영 · OpenFreeMap positron · MapLibre 데모 타일을 여수에서 비교. 문제 둘: ① MapLibre 6 은 워커 파일을 자기 옆(import.meta.url)에서 찾는데 번들 후 못 찾음("Worker failed to load") → `setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href)` ② 브라우저 창이 숨어 있으면 requestAnimationFrame 이 0번이라 스타일 로드가 멈춤(코드 문제 아님)
- 2026-11-04: Esri 조사 — `services.arcgisonline.com` 옛 타일은 Esri 소프트웨어 · ArcGIS Online 구독과 함께만 써야 해 MapLibre 로 쓰면 조건 밖. 공식 길은 ArcGIS Location Platform 계정 + API 키(월 200만 타일 무료, `language=ko`). OpenFreeMap + MapLibre `hillshade`(Mapterhorn 높이 타일) 후보도 비교
- 2026-11-04: 바탕은 OpenFreeMap positron, 음영 없음으로 결정(사용자). 키 · 요청 제한 없음, 상업 사용 가능, 출처 표기 자동. 견본은 positron + 한국어 지명 하나만 남김. 중간 커밋(push 안 함)
- 2026-11-05: develop 이 axios 등으로 앞서 나가 lockfile 이 겹칠 것이라, 새 브랜치를 develop 최신에서 다시 만들고 MapLibre 를 다시 설치 · 견본 파일만 옮김(옛 브랜치 `feat/map-base-old` 는 보관 후 삭제)
- 2026-11-05: `shared/api/c2/boundaries.ts`(GeoJSON FeatureCollection · MultiPolygon · 우리 지역 좌표 범위) + 테스트(계약 예시 통과 · 지역 밖 좌표 실패). 견본이 `browserGet` + 스키마로 받도록. 로컬 개발 서버를 dev 백엔드에 붙여(`.claude/launch.json` 의 `API_BASE_URL`, 커밋 안 함) 실제 여수 경계 확인 — 28개(시 1 + 행정동 27) 스키마 통과, 본문 180KB · 전송 47KB(gzip) · 약 1.0초. `pnpm check` 통과(테스트 42)
- 2026-11-05: dev 데이터 확인 — 여수 2023–2025 카드 목록에서 C1(청년 유출) 근거 4종이 모두 not_collected. 데모 전에 통계 적재가 필요(백엔드 · 수집 담당에 전달)

- 2026-11-05: 마무리. Jira S15P31C108-258. `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- 다시 쓰는 지도 컴포넌트 `MapView`(`shared/ui/map`): 바탕 · 한국어 지명 · 경계 층(시군구 굵게 · 행정동 얇게, 토큰 색) · 경계에 맞춰 화면 맞추기
- 바탕 색을 우리 토큰(map-*)에 맞출지: positron 스타일을 받아 색만 덮어쓰는 방식 검토. 다크 모드에서 지도 색
- Figma 04 지도 위 부품: 확대 · 위치 · 층 버튼(`v5/Map controls`), 유형 전환, 결과 유리 바, 범례, 기사 점, 아래 막대 그림
- 경계 응답 180KB — 화면에서 캐시(TanStack Query staleTime 길게) 검토
