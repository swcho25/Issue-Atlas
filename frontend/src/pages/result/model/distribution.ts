import { type Argument, type ArgumentSeries, type EvidenceStatus, seriesShape } from "@/shared/api";

import { evidenceStatusBadge } from "./labels";

// 04 분포형(Figma 「결과 · 분포형 · 대기질」): 한 달(시점)의 측정소 점. 크기 = 월평균, 색 = 환경부 4단계(월평균 기준).
// 판정하지 않고 관측만 보여 준다(Figma 「시공간 유형 5가지」)

type PlaceSeries = Extract<ArgumentSeries, { station_id: string | null }>;

/** 지도 점 줄(좌표가 있는 측정소). 경도 · 위도가 모두 있는 것만 */
export const stationSeries = (a: Argument) =>
  a.series.filter(
    (s): s is PlaceSeries =>
      seriesShape(s) === "map" &&
      "coordinates" in s &&
      s.coordinates?.[0] != null &&
      s.coordinates[1] != null,
  );

/** 고를 수 있는 달(질문 기간의 달 모두, 앞에서부터) */
export const distributionMonths = (series: PlaceSeries[]) => series[0]?.periods ?? [];

/**
 * 시간 막대(A3 변화형)의 달마다 높이: 그 달 값이 있는 측정소의 평균. 값이 하나도 없는 달은 null.
 * 점은 측정소 값 그대로이고(「측정소 값, 도시 평균 아님」), 이 평균은 달을 고르기 위한 모양일 뿐이다
 */
export function monthlyMeans(series: PlaceSeries[]): (number | null)[] {
  return distributionMonths(series).map((month) => {
    const values = series.flatMap((s) => {
      const v = s.values[s.periods.indexOf(month)];
      return v == null ? [] : [v];
    });
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  });
}

/** 처음 보여 줄 달: 값이 하나라도 있는 마지막 달(없으면 기간의 마지막 달) */
export function defaultMonth(series: PlaceSeries[]) {
  const months = distributionMonths(series);
  for (let i = months.length - 1; i >= 0; i--) {
    if (series.some((s) => s.values[i] != null)) return months[i];
  }
  return months.at(-1) ?? null;
}

/** 결과 카드 칩(Figma Panel > Meta > stats): 측정소 수 · 기간 전체에서 가장 높은 · 낮은 측정소 월평균과 그 달 */
export type StationStats = {
  count: number;
  unit: string | null;
  high: { value: number; month: string; station: string } | null;
  low: { value: number; month: string; station: string } | null;
};

/**
 * 카드 칩에 쓸 관측 요약. 최고 · 최저는 달 평균이 아니라 측정소 값 그대로(분포형 유리 바 「9–41」 과 같은 값).
 * 같은 값이 여럿이면 가장 이른 달. 측정소 줄이 없으면 null, 값이 하나도 없으면 high · low 가 null.
 * 해마다 평균의 변화(Figma 「연평균 17.0 → 14.7」)는 판정 규칙의 값이라 여기서 계산하지 않는다
 */
export function stationStats(series: PlaceSeries[]): StationStats | null {
  if (!series.length) return null;
  let high: StationStats["high"] = null;
  let low: StationStats["low"] = null;
  for (const month of distributionMonths(series)) {
    for (const s of series) {
      const value = s.values[s.periods.indexOf(month)];
      if (value == null) continue;
      const at = { value, month, station: s.name ?? "이름 없는 측정소" };
      if (!high || value > high.value) high = at;
      if (!low || value < low.value) low = at;
    }
  }
  return { count: series.length, unit: series[0].unit, high, low };
}

/** 칩 글자: 「최고 41 · 2024-03」(유리 바처럼 정수) */
export const statChip = (label: string, at: { value: number; month: string }) =>
  `${label} ${Math.round(at.value)} · ${at.month}`;

/** 환경부 대기질 4단계(예보 등급, µg/m³ 이하): 좋음 · 보통 · 나쁨 · 그 위 매우나쁨 */
export const aqGrades = [
  { key: "good", label: "좋음", className: "bg-aq-good" },
  { key: "moderate", label: "보통", className: "bg-aq-moderate" },
  { key: "bad", label: "나쁨", className: "bg-aq-bad" },
  { key: "veryBad", label: "매우나쁨", className: "bg-aq-very-bad" },
] as const;
export type AqGrade = (typeof aqGrades)[number];

const AQ_BANDS: Record<string, [number, number, number]> = {
  air_pm25: [15, 35, 75],
  air_pm10: [30, 80, 150],
};

/** 지표가 4단계 기준을 가지는가(범례 · 색을 쓸 수 있는가) */
export const hasAqBands = (indicatorId: string | undefined) =>
  indicatorId !== undefined && indicatorId in AQ_BANDS;

/** 값의 등급. 기준이 없는 지표면 null(점은 남색) */
export function aqGrade(indicatorId: string, value: number): AqGrade | null {
  const bands = AQ_BANDS[indicatorId];
  if (!bands) return null;
  const i = bands.findIndex((limit) => value <= limit);
  return aqGrades[i === -1 ? 3 : i];
}

// 점 지름(Figma 바깥 원 21 ~ 39): 기간 전체 최댓값에 대한 넓이 비율로 20 ~ 40.
// 달마다 다시 맞추지 않아 달을 바꿔도 크기를 서로 비교할 수 있다. 안쪽 점은 바깥의 절반
const MIN_DOT = 20;
const MAX_DOT = 40;

export type StationPoint = {
  id: string;
  name: string;
  at: [number, number];
  value: number | null;
  status: EvidenceStatus;
  grade: AqGrade | null;
  /** 바깥 원 지름(px). 값이 없으면 0 */
  size: number;
};

/** 고른 달의 측정소 점 */
export function stationPoints(series: PlaceSeries[], month: string): StationPoint[] {
  const max = Math.max(0, ...series.flatMap((s) => s.values.filter((v) => v != null)));
  return series.map((s) => {
    const i = s.periods.indexOf(month);
    const value = i === -1 ? null : s.values[i];
    return {
      id: s.station_id ?? s.place_id,
      name: s.name ?? "이름 없는 측정소",
      at: s.coordinates as [number, number],
      value,
      status: i === -1 ? "not_collected" : s.statuses[i],
      grade: value == null ? null : aqGrade(s.indicator_id, value),
      size:
        value == null
          ? 0
          : Math.round(MIN_DOT + (MAX_DOT - MIN_DOT) * (max > 0 ? Math.sqrt(value / max) : 0)),
    };
  });
}

/** 상세 창 값: 소수 첫째 자리까지(유리 바 한 줄은 정수로 줄이지만, 창은 그 측정소 값을 본다) */
export const stationValueText = (v: number) => String(Math.round(v * 10) / 10);

/** 결측 점 이름표: 「서강동 · 미공표」 */
export const missingLabel = (p: StationPoint) =>
  `${p.name} · ${p.status === "available" ? "값 없음" : evidenceStatusBadge[p.status].label}`;

/** 유리 바 한 줄: 「2024-03 한 달 · 측정소 9곳 · 9–41 µg/m³」(결측이 있으면 「· 결측 1곳」) */
export function monthSummary(points: StationPoint[], month: string, unit: string | null) {
  const values = points.flatMap((p) => (p.value == null ? [] : [Math.round(p.value)]));
  const missing = points.length - values.length;
  const [low, high] = [Math.min(...values), Math.max(...values)];
  // 측정소가 하나이거나 값이 모두 같으면 「13–13」 대신 한 값
  const range = values.length
    ? `${low === high ? low : `${low}–${high}`}${unit ? ` ${unit}` : ""}`
    : "값 없음";
  return [
    `${month} 한 달`,
    `측정소 ${values.length}곳`,
    range,
    missing ? `결측 ${missing}곳` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
