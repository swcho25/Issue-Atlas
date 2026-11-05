# feat/tab-bar — 결과 탭 바(Figma Tab bar/Item)

- Jira: S15P31C108-244 · PRD: — · 묶음/단위: 화면 공통 세팅 (U8)

## 완료 조건
- [x] `shared/ui/tab-bar` 의 `TabBar` 가 Figma `Tab bar/Item`(2366:394) 과 같다 — 틀 높이 64 · 안쪽 4 · 칸 76 × 56 균등 배치 · 아이콘 24 · 간격 3 · SemiBold 12(자동 대조)
- [x] 두 모양: `variant="clear"`(무색 렌즈 · surface-2 틀, 04 결과 카드 안), `variant="amber"`(앰버 렌즈 · 유리 틀, 05 오른쪽 패널). 렌즈 · 틀 그림자가 Figma 값과 같다
- [x] 견본 `/dev/ui` 에 두 쓰임

## 진행
- 2026-11-04: 시작. `ui` 스킬 순서로. Figma `Tab bar/Item` 3 상태(기본 · 선택 앰버 · 선택 무색)와 04 · 05 화면의 틀 「Tab bar · 유리」를 Plugin API 로 읽음. 탭은 요약 · 수요표 · 논증 · 원문 N(04 · 05 · 06 · 08 화면 공통)
- 2026-11-04: 렌즈 · 유리 틀은 그림자 여러 겹 + 반투명 겹칠이라 `globals.css` 에 유틸리티 `lens-amber` · `lens-clear` · `tab-glass` 로 둠. 탭은 결과 요약(04)과 05 화면을 오가므로 `next/link` 링크 탭(`aria-current="page"`). 견본 자동 대조 — 크기 · 위치 · 글자 · 그림자 불일치 0, 유리 틀 합성색 248 = Figma 248. `pnpm check` 통과
- 2026-11-04: variant 이름을 놓이는 곳(`card` · `page`)에서 렌즈 색(`clear` · `amber`)으로 바꿈. `page` 가 「페이지 이동」으로 읽혀 헷갈렸고, variant 는 모양만 정하기 때문
- 2026-11-04: 마무리. Jira S15P31C108-244. `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- Figma 확인 요청: 05 패널은 흰 바탕인데 탭 바 틀이 유리다. DESIGN.md 「흰 화면 위 유리 안 씀」과 어긋난다(코드는 Figma 대로)
- 렌즈가 칸 사이를 미끄러지는 움직임은 넣지 않았다. 탭이 주소마다 다른 화면이라 다시 그려진다. 필요하면 결과 화면 레이아웃에서 탭 바를 유지할 때 넣는다
- 아이콘 4개(grid · table · compare · doc)는 지금 견본에만 있다. 결과 탭 위젯을 만들 때 그쪽으로 옮긴다
- U9 `shared/ui/README.md`
