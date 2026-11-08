---
version: alpha
name: Issue Atlas
description: 지역 × 이슈 × 기간을 고르면 공식 통계 · 행정 자료 · 정책 문서를 맞춰 논증 카드로 보여 주는 데스크톱 웹. 기준은 Figma 「Design notes v5」 페이지와 변수 컬렉션 IA v5(Light).
colors:
  bg-app: "#FFFFFF"
  bg-sidebar: "#FAFAF8"
  bg-canvas: "#F3F3F0"
  surface-1: "#FFFFFF"
  surface-2: "#F6F6F3"
  surface-3: "#ECECE8"
  border-1: "#E7E7E2"
  border-2: "#D6D6CF"
  text-1: "#252624"
  text-2: "#50524C"
  text-3: "#8A8C85"
  text-on-primary: "#252624"
  primary-base: "#FFB000"
  primary-hover: "#E69E00"
  primary-strong: "#E69E00"
  primary-soft: "#FFF4D6"
  primary-line: "#F5D27A"
  primary-text: "#9A6700"
  key-amber-80: "rgba(255, 176, 0, 0.8)"
  glass-hover: "rgba(255, 255, 255, 0.3)"
  glass-press: "rgba(255, 255, 255, 0.5)"
  data-navy: "#2E4A7D"
  map-region: "#2E4A7D"
  map-region-fill: "rgba(46, 74, 125, 0.08)"
  map-boundary: "#9AA0B4"
  map-annot: "#2E4A7D"
  status-green: "#16A34A"
  status-green-soft: "#E8F7EE"
  status-red: "#E5484D"
  status-red-soft: "#FDECEC"
  status-amber: "#D97706"
  status-amber-soft: "#FEF3DC"
  status-blue: "#2F6FEB"
  status-blue-soft: "#E8F0FE"
  status-gray: "#8B90A0"
  status-gray-soft: "#F0F1F5"
  prov-rule: "#2F6FEB"
  prov-card: "#0E9F8E"
  prov-ai: "#9A6700"
  prov-human: "#C2410C"
  aq-good: "#2F6FEB"
  aq-moderate: "#16A34A"
  aq-bad: "#F59E0B"
  aq-very-bad: "#E5484D"
  scrim: "rgba(14, 15, 19, 0.32)"
typography:
  display-56:
    fontFamily: Pretendard
    fontSize: 56px
    fontWeight: 700
    lineHeight: 64px
    letterSpacing: -0.02em
  display-40:
    fontFamily: Pretendard
    fontSize: 40px
    fontWeight: 700
    lineHeight: 48px
    letterSpacing: -0.02em
  heading-24:
    fontFamily: Pretendard
    fontSize: 24px
    fontWeight: 700
    lineHeight: 32px
    letterSpacing: -0.01em
  heading-20:
    fontFamily: Pretendard
    fontSize: 20px
    fontWeight: 700
    lineHeight: 28px
    letterSpacing: -0.005em
  heading-16:
    fontFamily: Pretendard
    fontSize: 16px
    fontWeight: 700
    lineHeight: 24px
    letterSpacing: -0.003em
  title-14:
    fontFamily: Pretendard
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: -0.002em
  body-14:
    fontFamily: Pretendard
    fontSize: 14px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: -0.002em
  body-13:
    fontFamily: Pretendard
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: -0.001em
  label-13:
    fontFamily: Pretendard
    fontSize: 13px
    fontWeight: 500
    lineHeight: 18px
    letterSpacing: -0.001em
  label-12:
    fontFamily: Pretendard
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0em
  caption-12:
    fontFamily: Pretendard
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0em
  caption-11:
    fontFamily: Pretendard
    fontSize: 11px
    fontWeight: 400
    lineHeight: 14px
    letterSpacing: 0em
  number-32:
    fontFamily: Pretendard
    fontSize: 32px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: -0.02em
  number-20:
    fontFamily: Pretendard
    fontSize: 20px
    fontWeight: 700
    lineHeight: 24px
    letterSpacing: -0.01em
  number-14:
    fontFamily: Pretendard
    fontSize: 14px
    fontWeight: 600
    lineHeight: 18px
    letterSpacing: -0.005em
  wordmark:
    fontFamily: Source Serif 4
    fontWeight: 400
    letterSpacing: -0.02em
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  2xl: 22px
  full: 999px
spacing:
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "8": 32px
components:
  button-primary:
    backgroundColor: "{colors.primary-base}"
    textColor: "{colors.text-on-primary}"
    typography: "{typography.label-13}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 0 14px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.text-on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-1}"
    typography: "{typography.label-13}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 0 14px
  button-ghost:
    textColor: "{colors.text-2}"
    typography: "{typography.label-13}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 0 14px
  button-ai:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-text}"
    typography: "{typography.label-13}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 0 14px
  button-danger:
    backgroundColor: "{colors.status-red-soft}"
    textColor: "{colors.status-red}"
    typography: "{typography.label-13}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 0 14px
  button-key-l:
    backgroundColor: "{colors.key-amber-80}"
    textColor: "{colors.text-on-primary}"
    rounded: "{rounded.full}"
    height: 56px
    padding: 0 32px
  button-key-m:
    backgroundColor: "{colors.key-amber-80}"
    textColor: "{colors.text-on-primary}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 0 18px
  button-back:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.full}"
    size: 36px
  segment-item-selected:
    backgroundColor: "{colors.key-amber-80}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 0 22px
  tab-bar-item-selected:
    backgroundColor: "{colors.key-amber-80}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.full}"
    width: 76px
    height: 56px
  mode-tab:
    textColor: "{colors.text-2}"
    typography: "{typography.label-12}"
    rounded: "{rounded.full}"
    height: 28px
    padding: 0 10px
  mode-tab-active:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-1}"
  search:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-3}"
    typography: "{typography.body-14}"
    rounded: "{rounded.lg}"
    height: 40px
    padding: 0 8px 0 14px
  status-chip:
    backgroundColor: "{colors.status-green-soft}"
    textColor: "{colors.status-green}"
    typography: "{typography.label-12}"
    rounded: "{rounded.sm}"
    height: 22px
    padding: 0 7px 0 6px
  ai-chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.text-1}"
    typography: "{typography.label-12}"
    rounded: "{rounded.md}"
    height: 28px
    padding: 0 6px 0 10px
  toast:
    backgroundColor: "{colors.text-1}"
    textColor: "#FFFFFF"
    typography: "{typography.body-13}"
    rounded: "{rounded.lg}"
    height: 44px
    padding: 0 8px 0 14px
  result-panel:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.2xl}"
    width: 400px
    padding: 25px
  rail:
    backgroundColor: "{colors.bg-sidebar}"
    width: 72px
---

# Issue Atlas 디자인 시스템

이 파일은 Figma 작업 파일 [Issue Atlas — 유저 흐름·화면설계 (복사)](https://www.figma.com/design/eLKq5xtPBVZCn50867JTVm/)에서 2026-11-03에 읽은 값이다. 기준은 아래와 같다.

- 페이지: 「Design notes v5」
- 변수: 컬렉션 IA v5(Light · Dark)
- 글자: 스타일 `IA5/` (글꼴은 2026-11-03 결정이 Figma 보다 앞서 있다 — 「Typography」)
- 컴포넌트: Components 페이지의 「v5 · …」 섹션

Figma 와 이 파일이 다르면 Figma 를 따르고, 이 파일을 고친다. 맨 아래 「Figma 와 맞출 것」에 아직 어긋난 곳을 적어 두었다.

위 YAML 은 [DESIGN.md 형식](https://github.com/google-labs-code/design.md)의 토큰이다. 이름은 Figma 변수 이름의 `/` 를 `-` 로 바꾼 것이다(`primary/base` → `primary-base`).

## Overview

지도가 먼저인 데스크톱 웹이다. 결과 화면은 지도를 화면 끝까지 깔고, 그 위에 카드 하나와 유리 컨트롤을 띄운다.

화면 기준은 16:9 · 1600 × 900 이고, 모바일은 고려하지 않는다.

분위기는 차분한 종이 위 지도다. 따뜻한 회색 바탕과 먹색 글자를 쓰고, 색은 두 가지만 뜻을 갖는다.

- **빛고을 앰버 `#FFB000`**: 누르는 것 · 고른 것. 광주의 별칭 「빛고을」에서 왔다.
- **남색 `#2E4A7D`**: 읽는 것(데이터). 앰버와 보색이라 버튼이 또렷해진다.

로고는 접힌 지도책 두 면 사이의 아틀라스 옆얼굴이다. 명세는 [logo.md](logo.md)에 있고, 재질은 클레이다.

## Colors

### 역할

| 토큰 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `primary-base` | `#FFB000` | 누르는 것: 주요 버튼 · 유형 전환 렌즈 · 유리 바 버튼 · 토글. 화면마다 아껴 쓴다 |
| `primary-soft` | `#FFF4D6` | 선택된 칩 · 행 바탕 |
| `primary-hover` · `primary-strong` | `#E69E00` | 누름 · 호버 |
| `primary-text` | `#9A6700` | 흰 바탕 위 앰버 글자 · 아이콘 (4.9 : 1) |
| `key-amber-80` | `#FFB000` 80% | 유리 위 버튼 · 선택 렌즈 (밝은 지도 위에서 실제로는 약 `#F8B92C`) |
| `data-navy` | `#2E4A7D` | 읽는 것: 막대 · 기사 점 · 지역 테두리 · 슬라이더 선택 |
| `text-on-primary` | `#252624` | 앰버 위 글자. 다크 모드에서도 먹색 그대로 |

대비:

| 조합 | 대비 | 판정 |
| --- | --- | --- |
| 앰버 버튼 위 먹색 글자 | 8.7 : 1 | 통과 |
| 로고 먹색 몸과 앰버 안쪽 면 | 8.3 : 1 | 통과 |
| 흰 바탕 위 앰버 | 1.8 : 1 | 앰버를 글자 · 아이콘 색으로 쓰지 않는다 |

### 바탕 · 면 · 선 · 글자

바탕은 세 단계다.

- `bg-app`: 화면
- `bg-sidebar`: 왼쪽 띠
- `bg-canvas`: 지도 뒤

면은 `surface-1` → `surface-3` 순서로 진해진다. 카드 안에서 한 단계 들어간 상자(예: 판단 상자)는 `surface-2` 다.

선은 `border-1`(구분선) · `border-2`(입력칸 테두리) 두 가지다.

글자도 세 단계다.

- `text-1`: 본문 · 제목 (먹색 `#252624`)
- `text-2`: 보조
- `text-3`: 안내 · 자리 글자

### 상태 · 출처 · 대기질 · 지도

- `status-*`: 상태 배지(초록 · 빨강 · 주황 · 파랑 · 회색). 진한 색은 글자 · 점에, `-soft` 는 바탕에 쓴다. 예: 초록 「수집 중」.
- `prov-*`: 출처 배지(규칙 · 카드 · AI · 검수).
- `aq-*`: 대기질 등급(좋음 파랑 · 보통 초록 · 나쁨 주황 · 매우 나쁨 빨강). 국내 예보 색 관례를 따른다.
- `map-region` · `map-annot`: 고른 지역의 테두리와 지도 주석. 남색과 같은 값이다. `map-region-fill` 은 남색 8% 채움이다.
- `map-boundary`: 다른 행정 경계.
- `scrim`: 모달 뒤를 덮는 어둠.

### 다크 모드 (IA v5 · Dark)

| 토큰 | Light | Dark |
| --- | --- | --- |
| `bg-app` / `bg-sidebar` / `bg-canvas` | `#FFFFFF` / `#FAFAF8` / `#F3F3F0` | `#121311` / `#161714` / `#1B1C19` |
| `surface-1` / `-2` / `-3` | `#FFFFFF` / `#F6F6F3` / `#ECECE8` | `#1A1B18` / `#22231F` / `#2B2C28` |
| `border-1` / `-2` | `#E7E7E2` / `#D6D6CF` | `#2E2F2A` / `#3D3E38` |
| `text-1` / `-2` / `-3` | `#252624` / `#50524C` / `#8A8C85` | `#F2EFE7` / `#BDBBB3` / `#83857E` |
| `primary-base` | `#FFB000` | `#FFB000` |
| `primary-hover` · `primary-strong` · `primary-text` | `#E69E00` · `#E69E00` · `#9A6700` | `#FFC233` |
| `primary-soft` / `primary-line` | `#FFF4D6` / `#F5D27A` | `#3A2C08` / `#6B5216` |
| `data-navy` · `map-region` · `map-annot` | `#2E4A7D` | `#8FAEE0` |
| `map-region-fill` | 남색 8% | `#8FAEE0` 14% |
| `map-boundary` | `#9AA0B4` | `#5A6070` |
| `scrim` | `#0E0F13` 32% | `#000000` 55% |
| `glass-hover` / `glass-press` | 흰 30% / 50% | 흰 8% / 14% |

상태 · 출처 · 대기질 색은 다크에서 한 단계 밝아진다. 예: `status-green` `#3DD07A`, `status-red` `#FF6B6F`, `prov-rule` `#5B8DFF`. 나머지 값은 Figma 변수를 본다.

유리는 다크에서 흰 채움 대신 어두운 채움으로 바뀐다. 값은 아래 「유리」 절의 어두운 화면 항목을 본다. 앰버 위 글자(`text-on-primary`)는 두 테마 모두 먹색이다.

## Typography

세 글꼴을 쓴다. 한 문장 안에서도 글자 종류에 따라 글꼴이 나뉜다.

| 글꼴 | 쓰는 곳 |
| --- | --- |
| **Pretendard** | 기본. 한글과 문장부호(쉼표 · 마침표 · 가운뎃점 · 화살표) |
| **Gothic A1** | 영문 · 숫자 · 띄어쓰기. 한글과 섞이면 아래 「한영 섞어 쓰기」대로 크기와 굵기를 맞춘다. 영문뿐인 큰 글자(랜딩의 「Issue Atlas」)는 맞추지 않은 Gothic A1 을 쓴다 |
| **Source Serif 4** Regular, 자간 -2% | 로고 옆 워드마크 「Issue Atlas」 영문만. 한글이 없는 글꼴이라 한글을 넣으면 기기마다 다른 대체 글꼴로 보인다 |

### 한영 섞어 쓰기

한글은 Pretendard 가, 영문은 Gothic A1 이 더 예뻐서 둘을 섞는다(2026-11-03 결정, 비교는 캔버스 S · T · U 보드).

그대로 섞으면 굵은 글씨에서 영문이 튄다. 1000px 에서 잰 값은 아래와 같다.

- **크기**: Gothic A1 영문 대문자 높이는 굵을수록 커진다(글자 크기의 70% → 81%). Pretendard 영문 대문자는 굵기와 상관없이 71.9% 다.
- **굵기**: 같은 굵기 번호에서 Gothic A1 영문 획과 Pretendard 한글 세로획은 거의 같다(400 에서 7.4 · 7.6, 900 에서 15.6 · 15.6).

그래서 영문 · 숫자는 대문자 높이를 Pretendard 에 맞춰 줄이고, 줄어서 얇아진 획은 한 단계 굵은 파일로 채운다.

| 화면 굵기 | 쓰는 Gothic A1 파일 | 크기(size-adjust) |
| --- | --- | --- |
| 100 · 200 | 같은 굵기 | 102.2% |
| 300 | 300 | 100% |
| 400 | 400 | 97.9% |
| 500 | 500 | 95.8% |
| 600 | 700 | 92% |
| 700 | 800 | 90.2% |
| 800 · 900 | 900 | 88.5% |

900 은 더 굵은 Gothic A1 파일이 없어 한글보다 조금 얇다.

웹에서는 Gothic A1 의 라틴 글꼴 파일을 「IA Latin」 이라는 이름으로 영문 · 숫자 · 띄어쓰기 범위에만 붙이고, 그 뒤에 Pretendard 를 둔다. 범위 밖 글자(한글 · 문장부호)는 다음 글꼴로 넘어간다.

```css
@font-face {
  font-family: "IA Latin";
  font-weight: 600;                       /* 화면 굵기 */
  src: url(/* Gothic A1 700 라틴 woff2 */) format("woff2");
  size-adjust: 92%;
  unicode-range: U+0020, U+0030-0039, U+0041-005A, U+0061-007A, U+00C0-00D6, U+00D8-00F6, U+00F8-00FF;
}
/* 굵기마다 위 표대로 하나씩 */
:root { --sans: "IA Latin", "Pretendard", "Gothic A1", system-ui, sans-serif; }
```

구현 예는 랜딩 스크롤 시제품 `docs/design/landing-scroll/index.html`(브랜치 `docs/landing-scroll-prototype`)이다. 프론트(Next.js)는 아직 Gothic A1 하나만 쓴다.

Figma 는 Pretendard 를 불러올 수 없어(Google Fonts 에 없음) 글자 스타일이 아직 Gothic A1 이다. 아래 「Figma 와 맞출 것」을 본다.

글자 스타일은 `IA5/` 15개다. 크기와 줄 높이는 위 YAML 에 있다.

| 묶음 | 스타일 | 굵기 | 쓰는 곳 |
| --- | --- | --- | --- |
| Display | 56 · 40 | Bold | 랜딩 · 빈 화면의 큰 제목 |
| Heading | 24 · 20 · 16 | Bold | 화면 · 카드 · 묶음 제목 |
| Title | 14 | Medium | 목록 행 제목 |
| Body | 14 · 13 | Regular | 본문 |
| Label | 13 · 12 | Medium | 버튼 · 칩 · 배지 |
| Caption | 12 · 11 | Regular | 출처 · 날짜 · 보조 설명 |
| Number | 32 · 20 · 14 | Bold · Bold · SemiBold | 통계 값 |

자간은 크기가 클수록 좁힌다. 56 · 40 · 32 는 -2%, 24 · 20 은 -1% ~ -0.5% 이고, 12 이하는 0 이다.

## Layout

### 결과 화면 (1600 × 900)

- **왼쪽 띠 `v5/Rail`**: 폭 72, 높이 전체, 바탕 `bg-sidebar`.
  - 맨 위에 클레이 로고를 둔다.
  - 조회자 메뉴는 새 질문 · 내 질문이다. 관리자는 운영 요약 · 검수 · 카드 · 데이터 소스가 더 있다.
  - 메뉴 칸은 60 × 56, 모서리 14 이고, 고른 칸은 `surface-3` 다.
- **지도**: 띠 오른쪽 끝까지 채운다(x 72 → 1600).
- **결과 카드 `Panel`**: 지도 위에 뜬다.
  - 위치 x 96(띠에서 24), 위아래 20, 크기 400 × 860.
  - 모서리 22, 안쪽 여백 25, 흰 바탕, 1px 먹색 6% 테두리, 옅은 그림자.
  - 맨 위 「Header · sticky」(뒤로 · 제목 · 탭)는 카드를 내려도 고정된다. 내리면 제목이 18px 로 줄어 뒤로 버튼 옆에 붙는다.
  - 그 아래 순서: 메타(기간 · 회차) → 근거 → 비교 가능성 → 판단 상자(`surface-2`, 모서리 12) → 한계.
- **지도 위 유리 컨트롤**:
  - 위 가운데: 유형 전환(분포 · 변화 · 이동 · 관측 순서 · 사건). Figma 의 「확산형」은 11/01 대표 결정으로 「관측 순서」라 부른다.
  - 오른쪽 위: 유리 아이콘 버튼.
  - 오른쪽 아래: 확대 · 위치 · 레이어.
  - 보이는 지도의 아래: 유리 질문 바.
- **범례 · 시간 막대**: 카드가 아니라 지도 위에 둔다(모서리 12, 범례는 흰 면 + 그림자).
- **지점 상세**: 지점을 누르면 그 점 옆에 작은 창이 뜬다(모서리 18 + 꼬리). 카드는 요약을 유지한다.

간격은 4 단위다(`spacing` 1 · 2 · 3 · 4 · 5 · 6 · 8 = 4 → 32px). 컴포넌트 안 여백은 6 · 10 · 14 · 18 · 22 처럼 2 단위로 맞춘 곳도 있다.

### 랜딩 (1600 폭, 세로 스크롤)

1. 히어로: 지구를 받친 아틀라스 석상.
2. 지도 이야기: 「어느 지역이든, 근거는 지도 위에 쌓여요」.
3. 실제 화면을 잘라 넣은 세로 목업 3개.
4. 「어느 지역부터 볼까요?」와 세계 도시 칩 두 줄. 열린 곳만 먹색 테두리 + 앰버 점, 나머지는 옅은 회색이다.

제목 상자 폭은 1200 으로, 가운데에 맞춘다.

랜딩은 앱 화면과 달리 차가운 회색을 쓴다. 글자는 `#111318` · `#5B606D` · `#8A8F9C`, 면은 `#E9EAEC` 다. 이 값들은 아직 IA v5 변수가 아니다.

## Elevation & Depth

깊이는 그림자보다 **유리**로 만든다. 유리는 아래에 볼 것(지도 · 지구)이 있을 때만 쓴다. 흰 화면 위 버튼에는 쓰지 않는다.

### 유리 (Figma 효과 스타일)

| 스타일 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `Glass/Control` | 그림자 0 4 14 검정 12% + GLASS(radius 3 · refraction 1 · depth 18 · 빛 -45° · 세기 0.9 · 분산 0.4) | 지도 위 유리 컨트롤 전부 |
| `Glass/Panel` | 그림자 0 10 32 검정 10% + GLASS(radius 6 · depth 34 · 세기 0.9 · 분산 0.35) | 글자가 많은 떠 있는 패널 · 시트. 배경 사각형에 건다 |

유리 면은 네 겹으로 만든다.

1. 채움: 흰 10% 위에 흰 32 ~ 45%.
2. 테두리: 1px 대각선 그라데이션. 왼쪽 위 흰 95% → 20% → 15% → 오른쪽 아래 75%. 왼쪽 위가 가장 밝다.
3. 효과: `Glass/Control`.
4. 글자 · 아이콘: 유리 밖 위층에 둔다.

웹에서는 GLASS 효과가 없어서 이렇게 흉내 낸다.

```css
.glass {
  background: rgb(255 255 255 / .10);
  backdrop-filter: blur(6px) saturate(1.6);
  border: 1px solid rgb(17 19 24 / .14);
  box-shadow: inset 1px 1px 0 rgb(255 255 255 / .95), inset -1px -1px 0 rgb(255 255 255 / .3);
}
```

어두운 화면의 유리는 Figma 에 시안이 없어 웹에서 정했다(2026-11-08). 흰 유리는 어두운 지도 위에서 흐린 회색 판이 되어 밝은 글자가 묻히기 때문이다.

- 채움: 흰색 대신 `surface-1` 어두운 색(#1a1b18). 불투명도는 밝은 화면 채움 단계를 그대로 이어 0.3 + 흰 채움 × 0.6(기본 53% · strong 60% · thin 40%).
- 테두리 빛: 흰 20%(왼쪽 위) · 5%(오른쪽 아래), 선 흰 10%, 그림자 0 4 14 검정 35%.
- 칸 덧칠(`glass-hover` · `glass-press`): 밝은 화면 흰 30% · 50%, 어두운 화면 흰 8% · 14%.
- 앰버 렌즈 위 글자는 두 테마 모두 먹색(`text-on-primary`).

### 버튼의 결: 평면 몸 + 유리 테두리

앰버 버튼(`v5/Button` Primary · `Button/키 컬러`)은 몸이 단색 평면이다. 광택이나 그라데이션 몸은 쓰지 않는다. 결은 테두리와 안쪽 빛으로만 낸다.

- 테두리: 1px 흰 그라데이션(50% → 10% → 6% → 30%).
- 안쪽: 가장자리를 따라 흰 빛(안쪽 그림자).
- 바깥: 옅은 그림자.

### 그림자 (불투명 면)

색은 모두 `#101828` 이다.

| 스타일 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `IA/Shadow xs` | 0 1 2 5% | 지도 위 점 옆 작은 이름표 |
| `IA/Shadow sm` | 0 1 3 6% + 0 1 2 4% | (v5 화면에서 쓰는 곳 확인 안 됨) |
| `IA/Shadow md` | 0 4 12 8% + 0 2 4 4% | 토스트 |
| `IA/Shadow drawer` | 0 12 32 12% + 0 4 8 4% | 이름대로 서랍 · 시트 |
| `IA/Shadow frame` | 0 24 64 18% | 이름대로 큰 창 |

결과 카드 · 범례의 그림자는 스타일이 아니라 직접 넣은 값이다.

`Material/*` · `Elevation/*` · `Glass/Bar` · `Glass/Field` · `Glass/Selected` 는 v2 ~ v4 화면용으로 남은 스타일이다. 새 화면에는 쓰지 않는다.

## Shapes

| 모서리 | 쓰는 곳 |
| --- | --- |
| 4 (`sm`) | 상태 배지 · 출처 배지 · 키보드 표시 |
| 6 (`md`) | AI 칩 · 토스트 안 버튼 |
| 8 (`lg`) | 검색칸 · 토스트 · 지도 확대 버튼 |
| 12 (`xl`) | 범례 · 시간 막대 · 카드 안 상자 |
| 14 | 왼쪽 띠 메뉴 칸 |
| 18 | 지점 상세 창 |
| 22 (`2xl`) | 결과 카드 |
| 999 (`full`) | 버튼 · 세그먼트 · 탭 렌즈 · 유리 바 · 토글 |

누르는 것은 알약(999), 담는 것은 각진 둥근 사각형이다. 원형 버튼은 뒤로 버튼(36)과 유리 아이콘 버튼(40)뿐이다.

## Components

Figma Components 페이지의 v5 섹션 네 개가 기준이다. 숫자는 노드 ID 다.

### v5 · 키 컬러 · 유리 (2313:4421)

- **`Button/키 컬러`**: L 56 · M 36.
  - 앰버 80% + 유리 테두리 + 먹색 Bold 글자(L 18 · M 14).
  - 유리 바처럼 유리 컨테이너 안에서 쓴다.
- **`Toggle`**: 52 × 32.
  - 꺼짐: 맑은 유리 트랙(먹색 14% + 흰 12%).
  - 켜짐: 앰버 80% + 유리 테두리.
  - 누름: 손잡이가 36 × 32 유리 방울로 늘어난다.
  - 비활성: 40%.
  - 다크: 꺼짐 트랙의 테두리 빛을 흰 32% · 18% 로 낮춘다(먹색 14% 는 글자색이라 밝은 회색이 되어 바탕에 묻히지 않는다). 손잡이는 흰색 그대로.
  - 쓰는 곳: 지도 레이어 판, 랜딩 헤더의 테마 토글(손잡이 안에 해 · 달 아이콘).
- **`Tab bar/Item`** · **`Segment/Item`**: 고른 칸에만 렌즈를 깐다.
  - 렌즈는 앰버 80% 이거나 무색(먹색 7% + 흰 20%)이다. 불투명 패널 안 세그먼트는 무색 렌즈를 쓴다.
  - 렌즈는 칸 사이를 스프링으로 미끄러진다.
  - 탭 칸은 76 × 56(아이콘 + SemiBold 12), 세그먼트 칸은 높이 36(Bold 14)이다.

### v5 · 유리 컨트롤 · 지도 위 (2410:646)

- **`Glass/Question bar`**: 556 × 56 알약.
  - 왼쪽부터 앰버 점(지역), 질문 요약(Bold 15), 보조 버튼(Medium 14), 키 컬러 버튼 M 을 놓는다.
  - 키 컬러 버튼이 단독으로 나오는 곳은 이 바 안뿐이다.
- **`Glass/Icon button`**: 40 동그라미. 아이콘만으로 뜻이 안 읽히면 글자형을 쓴다.
- **`Map/유형 전환`**: 392 × 36. 시공간 유형 다섯 칸이다.
  - 카드가 가진 유형만 켜고, 나머지는 32% 로 흐리게 둔다.
  - 처음엔 판정에 쓰는 유형이 열린다. 관측 순서는 꺼 두고, 사건형은 보류 중이다.

### v5 · 컴포넌트 (2375:382)

- **`v5/Button`**: Primary · Secondary · Ghost · AI · Danger × M 36 · S. 알약 모양이고 글자는 `IA5/Label 13`, 좌우 여백 14 다.
  - Primary: 앰버 + 유리 테두리, 먹색 글자.
  - Secondary: 흰 면 + `border-2`.
  - Ghost: 글자만, `text-2`.
  - AI: `primary-soft` 바탕 + `primary-text` 글자.
  - Danger: `status-red-soft` 바탕 + `status-red` 글자.
- **`v5/Status`**: 22 높이 배지. 점 6 + `IA5/Label 12`. 톤은 초록 · 빨강 · 주황 · 파랑 · 회색 · 앰버다.
- **`v5/Prov badge`**: 18 높이 출처 배지(규칙 · 카드 · AI · 검수).
- **`v5/AI chip`**: 28 높이. AI 가 문장에서 뽑은 값이다(채움 · 애매 · 빔). 키는 `primary-text`, 값은 `text-1` 이다.
- **`v5/Mode tab`**: 28 높이. 고르면 흰 면 + `text-1` 이 된다.
- **`v5/Search`**: 560 × 40, 모서리 8.
  - 자리 글자 「문장으로 질문해 보세요」 + 「Enter」 키 표시가 있다.
  - 포커스되면 테두리가 `primary-base` 가 된다.
- **`v5/Annotation`**: 지도 위 주석 상자. 1.5px 남색 테두리 + 남색 이름표.
- **`v5/Toast`**: 먹색 바탕 + 흰 글자. 실행 취소 같은 동작 글자는 라임 `#C8F26B` 다.
- **`v5/Map controls`**: 유리 36 버튼. 확대 · 축소 묶음, 위치, 레이어.
- **`v5/Rail`**: 위 Layout 참고.
- **`Button/뒤로`**: 36 동그라미 + 「‹」 하나, 바탕 `surface-2`.
  - 라벨은 접근성 이름으로만 쓰고 화면에는 안 보인다.
  - 왼쪽 띠에서 바로 가는 최상위 화면에는 두지 않는다.
- **`Button/랜딩 시작`**: 앰버 알약 「OPEN THE ATLAS →」(Gothic A1 ExtraBold 16, 대문자).

### v5 · 로고 (2176:391)

- **`Logo/Symbol`**: 14종. 재질은 평면 · 클레이, 상태는 Rest · 35% · 70% · Open, 톤은 Ink · Paper, 디테일은 Full · Small 이다. 기본은 클레이다.
  - 호버하면 펼쳐지고 안쪽 면에 앰버가 보인다.
  - 16px 파비콘만 평면 Small 이다.
- **`Logo/Lockup`**: 클레이 심벌 + Source Serif 4 워드마크.
  - 가로형 비율: 심벌 44 · 간격 12 · 워드마크 34px(Regular, 자간 -2%, `#252624`). 심벌 크기가 바뀌면 이 비율대로 함께 줄인다.
- 로고는 두 가지로 쓴다. 대부분의 앱 아이콘 · 브랜드처럼 짧게는 심벌만, 이름을 읽혀야 할 때는 워드마크까지 붙인다.
  - **축약형(`Logo/Symbol` 만)**: 파비콘, 좁은 자리, 같은 화면에 이름이 이미 크게 있을 때(랜딩 맨 위).
  - **전체형(`Logo/Lockup`)**: 이름을 처음 알려야 하거나 화면에 다른 이름이 없을 때(스크롤한 랜딩 헤더, 문서 · 공유 이미지).
  - 워드마크는 언제나 Source Serif 4 다. 랜딩 히어로의 큰 「Issue Atlas」(Gothic A1 900)는 화면 제목(제호)이지 로고가 아니므로, 그 글꼴로 워드마크를 쓰지 않는다.

## Do's and Don'ts

**할 것**

- 앰버는 누르는 것 · 고른 것에만 쓰고, 화면마다 아껴 쓴다.
- 데이터(막대 · 점 · 지역 테두리)는 남색으로 그린다.
- 앰버 위 글자는 먹색 `#252624` 으로 쓴다. 흰 바탕 위 앰버 글자 · 아이콘은 `#9A6700` 이다.
- 한글은 Pretendard, 영문 · 숫자는 Gothic A1 로 쓴다. 섞이면 「한영 섞어 쓰기」의 크기 · 굵기 맞춤을 따른다.
- 상태는 UI 자체로 보여 준다. 예를 들어 고른 지역은 유리 바에 이미 채워져 있으면 된다.
- 지도 위 점은 실제 땅 위, 그 지역 경계 안에 둔다.
- 범례는 지도 위에 둔다.
- 문구는 특정 지역에 묶지 않는다(「어느 지역이든」). 나중에 전 세계로 넓힌다.

**하지 말 것**

- 보라 · 청록(해도) · 먹색을 주요 색으로 쓰지 않는다. 셋 다 검토 후 버렸다.
- 흰 바탕 위 앰버를 글자나 얇은 선으로 쓰지 않는다(1.8 : 1).
- 버튼 몸에 광택이나 그라데이션을 넣지 않는다. 앰버로 물들인 유리 버튼도 쓰지 않는다.
- 흰 화면 위 컨트롤을 유리로 만들지 않는다. 유리는 지도 · 지구 위에서만 쓴다.
- 창을 닫거나 다른 화면으로 넘기는 버튼(로그인 · 닫기 · 시작)에 누름 움직임(줄어들기 · 빛 진해지기)을 넣지 않는다. 누르자마자 가려져 보이지 않는다. 토글처럼 누른 뒤에도 같은 화면에 남는 버튼에는 써도 된다.
- Source Serif 4 로 한글을 쓰지 않는다. 가짜 기울임도 쓰지 않는다.
- 설명을 담은 점 + 알약 칩(「● 광주 전체 · 로그인하면 …」)을 쓰지 않는다.
- 제목 위 작은 머리말(「지금 모이는 중」 · 「첫 번째 지역 · 광주」)을 쓰지 않는다.
- 번호 알약 · 아이콘 카드, 「아래로 내려 … 보기」 같은 안내 문장을 쓰지 않는다.
- 뒤로 버튼 옆에 닫기 × 를 또 두지 않는다.
- 모바일 레이아웃을 따로 만들지 않는다.

## Figma 와 맞출 것

### Figma 안에서 어긋난 것

- 섹션 이름 「v5 · 컴포넌트 (해도 청록 · Gothic A1)」: 색은 이미 앰버로 바뀌었는데 이름에 해도 청록이 남아 있다.
- `Button/키 컬러` 설명과 키 컬러 보드 제목 「유리 안 버튼과 로고 안쪽 면에만」: 11/02 결정(앰버 = 화면 전체의 강조색) 전 문구다.
- `v5/Status` 의 `Tone=Violet`: 실제 색은 앰버(`primary-soft` · `primary-text`)다.
- 변수 겹침: `primary/hover` = `primary/strong`, `key/amber` = `primary/base`.
- 쓰는 곳이 확인되지 않은 변수: `brand/blue · cyan · orange · lime`.
- 변수에 묶이지 않은 값:
  - `v5/Prov badge` 바탕(`#2F6FEB` 10%)
  - 토스트 동작 글자(`#C8F26B`)
  - `Button/랜딩 시작` 글자(`#111318`)
  - 랜딩의 차가운 회색들
- 간격 · 모서리 변수는 아직 「IA v3 · Size」 컬렉션에만 있다. v5 컴포넌트는 숫자를 직접 쓴다.
- 글자 스타일 `IA5/` 15개는 2026-11-03 Pretendard 로 바꿨다. Pretendard 는 Google Fonts 에 없어 팀원 각자 PC 에 설치한다(static OTF, 「모든 사용자용으로 설치」). 설치하지 않으면 Figma 에 「없는 글꼴」이 뜬다.
  - Figma MCP 는 Figma 서버에서 돌아 PC 글꼴을 못 불러온다. Pretendard 가 든 글자는 Chrome 의 Figma 에서 Scripter 플러그인으로 고친다.
  - 영문 맞춤은 글자 스타일로는 표현할 수 없어 이 문서의 표를 따른다. 랜딩처럼 꼭 맞춰야 하는 글자만 영문 · 숫자 구간을 Gothic A1 로 따로 맞춰 두었다.

### 랜딩 결정(시제품 → Figma)

2026-11-03 랜딩 스크롤 시제품(`docs/design/landing-scroll/`, 브랜치 `docs/landing-scroll-prototype`)에서 정하고, 같은 날 Figma 「02 · 로그인 · 랜딩」 에 옮겼다(`Landing/Hero` · `Landing/Header`(맨 위 · 스크롤한 뒤) · `Map/점` · `Map/말풍선`, 서울 도착 화면). 움직임 설명은 Figma 주석에 있다. 히어로는 받은 시안(1586 × 992)을 픽셀로 재어 맞췄고, 그 화면 크기를 설계틀로 쓴다.

- 랜딩은 로그인하지 않은 사람에게만 보인다. 헤더 「로그인」 → 랜딩 위 로그인 창 → 바로 「새 질문」(관리자는 「운영 요약」). 로그인한 사람은 첫 주소로 와도 랜딩을 거치지 않는다 — 로그인한 뒤의 랜딩 화면은 두지 않는다.
- 헤더:
  - 높이 78, 로고 마크(28px)와 로그인 사이 폭 1036. 스크롤해도 고정이고 줄어들지 않는다.
  - 맨 위에선 로고 축약형(심벌만) — 이름은 히어로의 큰 글자가 맡는다. 스크롤을 시작하면(4px) 전체형으로 바뀐다: 워드마크가 심벌 뒤에서 오른쪽으로 튀어나와 12px 지나쳤다 돌아온다(0.62초). 맨 위로 오면 다시 심벌 뒤로 들어간다(0.28초). 크기는 `Logo/Lockup` 가로형 비율을 심벌 28px 에 맞춘 21.6px · 간격 7.6px.
  - 버튼은 거의 투명한 유리 「로그인」 하나만 둔다(13px). 노란 「시작하기」는 두지 않는다.
  - 「로그인」 왼쪽에 테마 토글(`Toggle`, 사이 14). 누르면 페이지 전체가 밝은 · 어두운 화면으로 바뀌고 기억된다(2026-11-08).
- 히어로(위에서 아래로):
  - 큰 「Issue Atlas」(로고가 아닌 화면 제목): Gothic A1 900, 시안 화면에서 166px, 자간 -0.056em. 지구 뒤에 깔려 지구 윗부분이 글자 높이의 약 1/3 을 가린다(잡지 표지 제호처럼). 본문 폭의 80% 를 넘지 않는다.
  - 지구(반지름 205)를 받친 아틀라스 석상. 처음 지구는 남반구(오스트레일리아) 쪽이 정면이다.
  - 「지역의 문제를, 근거로 읽다.」: Pretendard 600, 40.45px, 자간 +0.032em.
  - 「공식 통계 · 보도자료로 연결하는 지역의 맥락」: Pretendard 500, 20.22px, 자간 +0.076em, `#5A5F6B`.
  - 아래로 내리라는 꺾쇠(21 × 12, `#7B7F88`).
  - 물음 문장, 큰 시작 버튼, 받침대 이름표, 「SCROLL」 표시는 두지 않는다.
- 어두운 화면(2026-11-08, Figma 시안 없이 웹에서 정함): 같은 차가운 회색 계열을 뒤집는다 — 바탕 `#0A0C11` ~ `#0E1117`, 글자 `#EEF0F5`, 패널 `#151922`, 구름은 밝기 55%, 로고는 종이 색. 도착 지도 장면은 테마와 상관없이 밝은 지도 그대로 두고, 헤더도 지도 위에 있는 동안은 짙은 글자 · 로고다.
- 지도 다음 섹션의 그림(결과 화면 둘러보기 3칸 · 예시 5개)은 손그림이 아니라 실제 결과 화면 캡처다(dev · 여수시 청년 유출·정착). 밝은 · 어두운 화면 한 벌씩 두고, 결과 화면이 크게 바뀌면 다시 찍는다.
- 도착 장면(스크롤 끝): 서울. 지도는 42° 기울고 20° 돈다(55° 는 너무 기울고 18° 는 밋밋했다). 측정소 점은 25개 구 가운데 고르게 10곳과 보도자료 3곳, 말풍선 하나. 위에 큰 제목 「어느 지역이든, 근거는 지도 위에 쌓여요」, 아래 어두운 캡션 알약.
