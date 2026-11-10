// Figma 변수 IA v5 를 묶음별로. 값은 globals.css 에만 두고 여기에는 이름만 적는다
export const colorGroups = [
  { title: "바탕", names: ["bg-app", "bg-sidebar", "bg-canvas"] },
  { title: "면", names: ["surface-1", "surface-2", "surface-3"] },
  { title: "선", names: ["border-1", "border-2"] },
  { title: "글자", names: ["text-1", "text-2", "text-3", "text-on-primary"] },
  {
    title: "앰버 · 누르는 것",
    names: [
      "primary-base",
      "primary-hover",
      "primary-strong",
      "primary-soft",
      "primary-line",
      "primary-text",
      "key-amber-80",
    ],
  },
  {
    title: "남색 · 데이터 · 지도",
    names: ["data-navy", "map-region", "map-region-fill", "map-boundary", "map-annot"],
  },
  {
    title: "상태",
    names: [
      "status-green",
      "status-green-soft",
      "status-red",
      "status-red-soft",
      "status-amber",
      "status-amber-soft",
      "status-blue",
      "status-blue-soft",
      "status-gray",
      "status-gray-soft",
    ],
  },
  { title: "출처", names: ["prov-rule", "prov-card", "prov-ai", "prov-human"] },
  { title: "대기질", names: ["aq-good", "aq-moderate", "aq-bad", "aq-very-bad"] },
  { title: "덮개", names: ["scrim"] },
] as const;

// Tailwind 는 소스에 적힌 클래스 이름만 만든다. 그래서 이름을 조립하지 않고 통째로 적는다. spec 은 Figma 스타일 값
export const textStyles = [
  { className: "text-display-56", spec: "56 / 64 · -2% · 700" },
  { className: "text-display-40", spec: "40 / 48 · -2% · 700" },
  { className: "text-heading-24", spec: "24 / 32 · -1% · 700" },
  { className: "text-heading-20", spec: "20 / 28 · -0.5% · 700" },
  { className: "text-heading-16", spec: "16 / 24 · -0.3% · 700" },
  { className: "text-title-14", spec: "14 / 20 · -0.2% · 500" },
  { className: "text-body-14", spec: "14 / 22 · -0.2% · 400" },
  { className: "text-body-13", spec: "13 / 20 · -0.1% · 400" },
  { className: "text-label-13", spec: "13 / 18 · -0.1% · 500" },
  { className: "text-label-12", spec: "12 / 16 · 0% · 500" },
  { className: "text-caption-12", spec: "12 / 16 · 0% · 400" },
  { className: "text-caption-11", spec: "11 / 14 · 0% · 400" },
  { className: "text-number-32", spec: "32 / 36 · -2% · 700" },
  { className: "text-number-20", spec: "20 / 24 · -1% · 700" },
  { className: "text-number-14", spec: "14 / 18 · -0.5% · 600" },
] as const;

export const radii = [
  { className: "rounded-sm", spec: "4px" },
  { className: "rounded-md", spec: "6px" },
  { className: "rounded-lg", spec: "8px" },
  { className: "rounded-xl", spec: "12px" },
  { className: "rounded-2xl", spec: "22px" },
  { className: "rounded-full", spec: "999px" },
] as const;

// 그림자. spec 은 Figma 효과 값(x y 흐림 색 투명도)
export const shadows = [
  { className: "shadow-xs", spec: "IA/Shadow xs · 0 1 2 #101828 5%" },
  { className: "shadow-sm", spec: "IA/Shadow sm · 0 1 3 6% + 0 1 2 4%" },
  { className: "shadow-md", spec: "IA/Shadow md · 0 4 12 8% + 0 2 4 4%" },
  { className: "shadow-drawer", spec: "IA/Shadow drawer · 0 12 32 12% + 0 4 8 4%" },
  { className: "shadow-frame", spec: "IA/Shadow frame · 0 24 64 18%" },
  { className: "shadow-card", spec: "결과 카드 · 0 10 36 #000 14%" },
  { className: "shadow-legend", spec: "범례 · 0 6 20 #000 10%" },
  { className: "shadow-button", spec: "버튼 Primary · 흰 테두리 빛 + 0 2 6 14%" },
  { className: "shadow-button-soft", spec: "버튼 Secondary · 0 1 3 #000 6%" },
] as const;

// 겹침 순서. 아래일수록 위에 그려진다
export const layers = [
  { className: "z-map", spec: "0 · 지도" },
  { className: "z-control", spec: "10 · 유리 컨트롤 · 범례 · 시간 막대" },
  { className: "z-panel", spec: "20 · 결과 카드" },
  { className: "z-popover", spec: "30 · 지점 상세 창 · 메뉴 · 툴팁" },
  { className: "z-toast", spec: "40 · 토스트" },
  { className: "z-modal", spec: "50 · 모달 · 덮개" },
] as const;
