# feat/result-map — 결과 화면 지도(/results/[id]) · MapView · 목 API

- Jira: S15P31C108-262 · PRD: — · 묶음/단위: 결과 화면 04 지도 · 먼저
- 쌓인 MR: `feat/map-base`(!164) 위에 만든 브랜치. !164 가 먼저 머지돼야 한다

## 완료 조건
- [x] 다시 쓰는 지도 컴포넌트 `MapView`(`shared/ui/map`): 바탕 · 한국어 지명 · 경계 층(시군구 굵게 · 옅게 칠, 행정동 가는 선, 토큰 색) · 경계에 맞춰 화면 맞추기(창 크기가 바뀌면 다시)
- [x] 결과 주소 `/results/[id]`(id = run_id, 11/5 결정): 서버에서 논증 응답 + 질문 지역 경계, 없는 결과는 404
- [x] 지도 위 결과 카드 틀(상태 배지 · 기간 · 지역 · 카드 · clear 탭 바 · 판단 문장)
- [x] 목 API 서버(`mocks/api-server.ts`) — 계약 예시 run_id 4개를 답하고 나머지는 dev 백엔드로

## 진행
- 2026-11-05: 시작. 결과 주소는 `/results`(사용자, `/runs` 는 백엔드 용어). Figma 탭에서 Plugin API(`figma`)가 열리지 않아 카드 값 대조는 다음으로 미룸
- 2026-11-05: `MapView` — MapLibre CSS 가 지도 칸을 `position: relative` 로 바꿔 `absolute inset-0` 이 높이 0 이 됨(빈 지도) → `size-full`. 좁은 창에서 여백(왼쪽 488)이 지도보다 넓어 「Map cannot fit」 → 여백을 창의 70% 안으로 줄이고 resize 때 다시 맞춤
- 2026-11-05: 동적 주소에서 왼쪽 띠가 `usePathname()` 을 Suspense 밖에서 읽어 Next 16 blocking-route 오류 → `AppLayout` 이 띠를 `<Suspense>` 로 감싸고 같은 폭의 `AppRailPlaceholder` 를 먼저
- 2026-11-05: dev 에 실행 결과가 없어 목 서버로 확인(사용자 결정). 처음엔 MSW 를 `instrumentation.ts` 로 Next 서버에 붙였으나 코드가 다시 컴파일되면 Next 가 fetch 를 다시 덮어 가로채기가 풀림 → 따로 뜨는 목 API 서버(Node 타입 지우기로 바로 실행, 포트 4010)로 바꿈. 네 가지 상태(판단 가능 · 근거 부족 · 일부 근거 · 카드 밖) 화면 확인. `pnpm check` 통과(테스트 42)

- 2026-11-05: 마무리. Jira S15P31C108-262. `pnpm check:all` 9개 통과(배포 빌드 · e2e 포함)

## 다음 할 일 / 범위 밖
- 결과 카드를 Figma 04(Panel · glass bar · 막대 그림 Sheet)와 숫자로 대조 — Figma Plugin API 가 다시 열리면
- 여수는 남쪽 섬까지 경계라 지도가 멀리 잡힌다 → 본토 기준으로 맞출지 디자이너와
- 탭(수요표 · 논증 · 원문) 화면 `/results/[id]/evidence` · `/argument` · `/sources` — 지금은 404
- 지도 위 부품(확대 · 위치 · 층, 유형 전환, 범례, 기사 점, 막대 그림)
- 결과 화면 페이지 테스트(Playwright) — 서버에서 부르는 API 라 page.route 로 못 막음 → 목 API 를 webServer 로 띄우는 방식 검토
