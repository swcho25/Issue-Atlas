# shared/ui — 공통 컴포넌트

화면을 만들기 전에 이 목록을 먼저 본다. 여기 있는 것은 새로 만들지 않고 가져다 쓴다.
모두 Figma IA v5 와 숫자로 대조했다(견본: 개발 서버 `/dev/ui`). 토큰 · 유틸리티는 `src/app/styles/globals.css`.

## 목록

| 가져오기 | 쓰는 곳 | Figma |
| --- | --- | --- |
| `Button` · `buttonClass` ← `@/shared/ui/button` | 누르는 것 전부. 링크를 버튼 모양으로는 `buttonClass()` | `v5/Button` |
| `BackButton` · `backButtonClass` · `BackIcon` ← `@/shared/ui/button` | 36 동그라미 「뒤로」 모양. 이전 화면 · 옆 패널 닫기 등 동작은 쓰는 쪽이 정한다 | `Button/뒤로` |
| `GlassIconButton` ← `@/shared/ui/button` | 지도 · 결과 위 유리 아이콘 버튼(각주 복사 · 저장 · 다시 실행), 글자 형태도 | `Glass/Icon button` |
| `StatusBadge` ← `@/shared/ui/badge` | 근거 · 작업 상태(확보 · 미수집 · 검수 대기 …) | `v5/Status` |
| `ProvBadge` ← `@/shared/ui/badge` | 논증 카드 칸을 누가 채웠는지(규칙 · 카드 · AI · 검수) | `v5/Prov badge` |
| `TabBar` ← `@/shared/ui/tab-bar` | 결과 화면 요약 · 수요표 · 논증 · 원문 오가기 | `Tab bar/Item` |
| `Icon` ← `@/shared/ui/icon` | 모든 줄 아이콘(30개) | `v3/Icon` |
| `MapView` ← `@/shared/ui/map` | 지도 바탕(OpenFreeMap Liberty · 한국어 지명) + 시군구 · 행정동 경계. 지도 위 부품은 children | 04 지도 |
| `AtlasMark` · `Lockup` ← `@/shared/ui/logo` | 로고(띠 · 랜딩 · 바닥글) | 로고 |

## 쓰는 법

```tsx
import { Button, buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

<Button>질문 만들기</Button>                                   // primary · m
<Button variant="secondary" size="s" icon={<Icon name="copy" />}>복사</Button>
<Link href="/ask" className={buttonClass({ variant: "ghost" })}>새 질문</Link>
```

| 컴포넌트 | 고르는 값 | 메모 |
| --- | --- | --- |
| `Button` | `variant` primary(앰버) · secondary · ghost, `size` m(36) · s(30), `icon` | 아이콘 크기는 버튼이 정한다(m 16 · s 14). `type` 기본 `button` |
| `StatusBadge` | `tone` green · red · amber · blue · gray · primary | 글자는 children. 색만으로 뜻을 전하지 않게 글자를 꼭 쓴다 |
| `ProvBadge` | `kind` rule · card · ai · human | 글자는 종류로 정해져 있다 |
| `TabBar` | `variant` clear(무색 렌즈 · 04 결과 카드 안) · amber(앰버 렌즈 · 유리 틀 · 05 패널), `items`, `current` | 링크 탭이다. 이동은 각 칸 `href`, 고른 칸은 `current` |
| `BackButton` | `onClick` | 모양만 담은 `button`(이름 「뒤로」). 링크로 쓸 때는 `<Link className={backButtonClass()}><BackIcon /></Link>` |
| `GlassIconButton` | `icon`, `label`(필수), `showLabel` | 아이콘만이면 `label` 이 화면 낭독기 · 툴팁 이름. 흰 화면 위에는 쓰지 않는다 |
| `Icon` | `name`, `className`(크기), `label`, `weight` | 기본 20. 색은 글자색. 글자 없이 아이콘만 쓰면 `label` 로 이름을 준다. `weight` 는 Figma 가 선 굵기를 덮어쓴 곳만 |

## 아이콘

- 이름: alert · bookmark · cards · chart · check · chevronDown · chevronRight · close · compare · copy · db · doc · download · external · grid · home · layers · locate · lock · map · minus · more · play · plus · refresh · search · settings · shield · sparkle · table
- v5 화면에서 쓰는 것만 있다. 새 아이콘은 Figma `v3/Icon` 에서 `exportAsync({ format: "SVG_STRING" })` 로 받아 `icon/paths.ts` 에 더한다(좌표 소수 둘째 자리). 아이콘 SVG 를 화면 파일에 직접 쓰지 않는다
- 크기를 바꾸면 선 굵기도 같은 비율로 바뀐다(Figma 와 같다: 16 → 1.17 · 24 → 1.75)

## 컴포넌트가 아니라 유틸리티로 있는 것

| 클래스 | 쓰는 곳 |
| --- | --- |
| `glass` (+ `glass-strong` · `glass-thin`) | 지도 · 지구 위에 뜨는 판. 흰 화면 위에는 쓰지 않는다 |
| `lens-amber` · `lens-clear` · `tab-glass` | 탭 바의 고른 칸 · 틀. 같은 모양의 고른 칸(분할 버튼 등)이 생기면 다시 쓴다 |
| `shadow-card` · `shadow-legend` · `shadow-button` … | 그림자. 목록은 globals.css `@theme` |
| `z-map` < `z-control` < `z-panel` < `z-popover` < `z-toast` < `z-modal` | 겹침 순서 |

## 아직 없는 것 (쓰는 화면을 만들 때 만든다)

| Figma | 쓰는 곳 |
| --- | --- |
| `v5/Map controls` | 지도 오른쪽 확대 · 위치 · 층(폭 36 세로 묶음) |
| `Button/키 컬러` | 유리 바 안의 큰 앰버 버튼(L 56 · M 36) |
| `v5/Button` AI · Danger | v5 화면에서 0번. 필요해지면 `Button` 에 변형으로 더한다 |

## 새 공통 컴포넌트를 더할 때

1. 두 화면 이상에서 쓰이는지 본다. 한 화면에서만 쓰면 그 슬라이스 안에 둔다.
2. `ui` 스킬 순서대로(Figma 값 읽기 → 토큰으로 → `/dev/ui` 견본 → 자동 대조).
3. `<이름>/index.ts` 로 내보내고, 이 README 목록에 한 줄 더한다.
