import { type Argument, type ArgumentSeries, seriesShape } from "@/shared/api";

// 04 지도 위 유형 전환(Figma Map/유형 전환): 시공간 유형 5가지. 결과가 가진 그림 줄(series) 모양으로 켜진다
// (시공간 표시 개발 명세 5절: 지도 점 → 분포, 막대 → 변화, 이동 → 이동, 기사 건수 → 관측 순서, 기사 점 → 사건)
// 기사 건수 그림의 이름은 「관측 순서」(11/01 대표 결정 #5 — 「확산」 「전파」는 PRD §5 금지 표현이라 쓰지 않는다. Figma 글자와 다름)

export const viewTypes = [
  { key: "distribution", label: "분포형" },
  { key: "change", label: "변화형" },
  { key: "movement", label: "이동형" },
  { key: "observationOrder", label: "관측 순서" },
  { key: "event", label: "사건형" },
] as const;
export type ViewType = (typeof viewTypes)[number]["key"];

const shapeView = {
  map: "distribution",
  bar: "change",
  flow: "movement",
  tag: "observationOrder",
} as const;

/** 그림을 이미 만든 유형(나머지는 데이터가 있어도 꺼 둔다 — 사건형은 Figma · DESIGN.md 「보류」, 11/09 보류 유지) */
export const builtViews: ReadonlySet<ViewType> = new Set([
  "distribution",
  "change",
  "movement",
  "observationOrder",
]);

/**
 * 결과가 가진 유형(데이터 기준). 측정소 지도 점은 분포형(한 달)과 변화형(점 + 월 막대, Figma 「변화형 · 대기질」) 둘 다 된다
 */
export function availableViews(a: Argument): Set<ViewType> {
  const views = new Set<ViewType>(a.series.map((s) => shapeView[seriesShape(s)]));
  if (views.has("distribution")) views.add("change");
  if (a.articles.length) views.add("event");
  return views;
}

/** 켤 수 있는 유형 = 데이터가 있고 그림을 만든 유형. 처음 열 유형은 판정에 쓰는 변화형, 없으면 켤 수 있는 첫 유형 */
export function openViews(a: Argument) {
  const available = availableViews(a);
  const enabled = viewTypes.filter((v) => available.has(v.key) && builtViews.has(v.key));
  const first = enabled.find((v) => v.key === "change") ?? enabled[0];
  return { enabled: new Set(enabled.map((v) => v.key)), initial: first?.key ?? null };
}

/** 변화형 막대에 쓸 줄: 좌표 없는 통계 한 지역(막대 모양) */
type PlaceSeries = Extract<ArgumentSeries, { station_id: string | null }>;
export const changeSeries = (a: Argument) =>
  (a.series.find((s) => seriesShape(s) === "bar") as PlaceSeries | undefined) ?? null;

/** 사람 · 건처럼 셀 수 있는 단위는 해마다 합계, 그 밖(농도 · 비율)은 해마다 평균 */
const COUNT_UNITS = new Set(["명", "건", "개", "가구", "세대"]);
export const yearlyAggregate = (unit: string | null) =>
  unit && COUNT_UNITS.has(unit) ? ("sum" as const) : ("mean" as const);

/** 월 값을 해마다 묶는다(빈 달은 빼고, 한 해가 모두 비면 null) */
export function yearlyBars(s: ArgumentSeries) {
  const agg = yearlyAggregate(s.unit);
  const years = new Map<string, number[]>();
  s.periods.forEach((p, i) => {
    const y = p.slice(0, 4);
    const list = years.get(y) ?? [];
    const v = s.values[i];
    if (v !== null) list.push(v);
    years.set(y, list);
  });
  return [...years].map(([year, vs]) => {
    if (!vs.length) return { year, value: null };
    const sum = vs.reduce((a, b) => a + b, 0);
    return { year, value: agg === "sum" ? sum : sum / vs.length };
  });
}

/** 막대 그림 칸 폭(Figma 시트 안쪽 470 − 양옆 24) */
export const CHART_WIDTH = 422;
/** 가장 긴 막대(양수 끝 ~ 음수 끝 전체) */
const BAR_SPAN = 86;
/** 값 글자(16) + 막대와 사이(6) */
const LABEL = 22;
/** 글자 하나가 읽히는 칸 간격 */
const LABEL_ROOM = 32;
/** 막대 폭 최솟값(사용자 결정 11/06) */
export const MIN_BAR = 4;

/**
 * 막대 배치. 해 수와 부호가 어떻든 그릴 수 있게 한다.
 * - 칸: 3개까지 Figma 그대로(칸 122 · 사이 28 · 막대 56), 늘어나면 사이를 줄이고(16 · 6 · 30개 넘으면 2) 칸 폭을 나눠 막대는 칸의 60%(최대 56 · 최소 4)
 * - 칸이 막대 최소 폭(4)보다 좁아질 만큼 많으면(약 70개 넘게) 칸을 4 로 두고 그림 칸이 시트보다 넓어진다 → 시트에서 좌우 스크롤
 * - 높이: 가장 큰 양수 ~ 가장 큰 음수를 86 에 맞추고, 0 선은 그 사이(모두 음수면 맨 위, 모두 양수면 맨 아래)
 * - 값 글자는 양수 막대 위 · 음수 막대 아래, 연도는 모든 칸이 한 줄(맨 아래)
 * 막대는 0 선에 붙는다(Figma 는 0 선과 막대 사이 6 — 부호가 섞이면 방향이 헷갈려 붙임)
 */
export function barLayout(values: (number | null)[]) {
  const n = Math.max(values.length, 1);
  const gap = n <= 3 ? 28 : n <= 6 ? 16 : n <= 30 ? 6 : 2;
  const column = Math.max(MIN_BAR, (CHART_WIDTH - gap * (n - 1)) / n);
  const barWidth = Math.max(MIN_BAR, Math.min(56, Math.round(column * 0.6)));
  /** 그림 칸 전체 폭. 시트(422)보다 넓으면 좌우 스크롤 */
  const width = Math.max(CHART_WIDTH, column * n + gap * (n - 1));
  // 글자 하나(「−200」 · 「2016」 ≈ 26)에 32 는 있어야 읽힌다. 칸이 좁으면 값은 숨기고(툴팁 · 화면 낭독기로) 연도는 건너뛴다
  const yearStep = Math.max(1, Math.ceil(LABEL_ROOM / (column + gap)));
  const showValues = yearStep === 1;
  const nums = values.filter((v): v is number => v !== null);
  const maxPos = Math.max(0, ...nums);
  const maxNeg = Math.max(0, ...nums.map((v) => -v));
  const scale = maxPos + maxNeg > 0 ? BAR_SPAN / (maxPos + maxNeg) : 0;
  const top = showValues && nums.some((v) => v >= 0) ? LABEL : 0;
  const bottom = showValues && nums.some((v) => v < 0) ? LABEL : 0;
  const zero = top + maxPos * scale;
  const plot = zero + maxNeg * scale + bottom;
  return {
    gap,
    column,
    barWidth,
    width,
    /** 시트보다 넓어 좌우 스크롤이 필요한지 */
    scroll: width > CHART_WIDTH + 0.5,
    /** 0 선 높이(그림 칸 위에서) */
    zero,
    /** 연도 줄 위치 · 그림 칸 전체 높이 */
    yearTop: plot + 6,
    height: plot + 6 + 14,
    /** 칸이 좁으면 값 글자를 줄인다 */
    small: n > 6,
    /** 값 글자를 막대 옆에 보일지(아주 좁으면 숨김) */
    showValues,
    /** 연도를 보일 칸: 마지막 해는 늘 보이고, 거기서 yearStep 마다 */
    showYear: (i: number) => (n - 1 - i) % yearStep === 0,
    items: values.map((v) => {
      if (v === null) return null;
      const h = Math.abs(v) * scale;
      return v >= 0
        ? { barTop: zero - h, height: h, labelTop: zero - h - LABEL }
        : { barTop: zero, height: h, labelTop: zero + h + 6 };
    }),
  };
}

/**
 * 그래프 기준선 문구(사용자 결정 11/06): 응답 series 의 baseline(카드가 정하고 API 가 보낸다)이 있는 줄만
 * 「기준선 0 · 위 순유입 · 아래 순유출」처럼 적고 값 · 막대는 그대로 둔다.
 * 막대는 0 선을 기준으로 그리므로, 0 이 아닌 기준선은 그 선을 그리기 전까지 적지 않는다
 */
export function baselineNote(series: PlaceSeries) {
  const b = series.baseline;
  if (!b || b.value !== 0) return null;
  return `기준선 ${b.value} · 위 ${b.above} · 아래 ${b.below}`;
}

/** 막대 숫자: 「−1,537」(빼기 기호), 평균은 소수 한 자리 */
export function barNumber(value: number, agg: "sum" | "mean") {
  const text = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: agg === "sum" ? 0 : 1,
    minimumFractionDigits: agg === "sum" ? 0 : 1,
  }).format(value);
  return text.replace("-", "−");
}
