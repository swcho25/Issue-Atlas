import type { Argument, ArgumentSeries } from "@/shared/api";

// 04 관측 순서(11/01 대표 결정 #5: 「확산」 그림은 유지하되 이름은 「관측 순서」, 「확산」 「전파」 낱말 금지).
// 기사 건수 줄(series 의 tag 모양, 지역마다 한 줄 · 월별 건수)에서 지역마다 카드 태그 기사가 처음 나온 달을 찾아 순서를 매긴다.
// 순서만 보여 준다 — 옮겨 간 경로 · 원인이 아니어서 지역을 잇는 선 · 화살표는 그리지 않는다(Figma 시공간 유형 「판정: 순서만」)

/** 그림 아래 고정 문구(11/01 대표 결정 #5) */
export const ORDER_CAPTION = "첫 관측 순서, 옮겨 간 경로·원인 아님";

type CountSeries = Extract<ArgumentSeries, { tag: string }>;

export type OrderStop = {
  placeId: string;
  name: string;
  /** 지역 대표점 [경도, 위도]. 없으면 지도에는 못 놓고 목록에만 */
  at: [number, number] | null;
  /** 처음 나온 달 「YYYY-MM」 */
  first: string;
  /** 기간 안 기사 수 */
  total: number;
  /** 순서. 같은 달에 처음 나온 지역은 같은 번호(1, 1, 3 …) */
  rank: number;
};

const countSeries = (a: Argument) => a.series.filter((s): s is CountSeries => "tag" in s);

/** 관측 순서를 켤 수 있는가(기사가 하나라도 있는 기사 건수 줄이 있음) */
export const hasObservationOrder = (a: Argument) => observationOrder(a).length > 0;

/** 지역마다 첫 관측 달 순서(이른 달 → 같은 달이면 기사가 많은 곳 → 이름). 기사가 한 건도 없는 줄은 뺀다 */
export function observationOrder(a: Argument): OrderStop[] {
  const stops = countSeries(a).flatMap((s) => {
    const i = s.values.findIndex((v) => (v ?? 0) > 0);
    if (i === -1) return [];
    const at: [number, number] | null =
      s.coordinates && s.coordinates[0] != null && s.coordinates[1] != null
        ? [s.coordinates[0], s.coordinates[1]]
        : null;
    return [
      {
        placeId: s.place_id,
        name: s.name ?? "이름 없는 지역",
        at,
        first: s.periods[i],
        total: s.values.reduce<number>((sum, v) => sum + (v ?? 0), 0),
        rank: 0,
      },
    ];
  });
  stops.sort(
    (x, y) =>
      x.first.localeCompare(y.first) || y.total - x.total || x.name.localeCompare(y.name, "ko"),
  );
  // 같은 달은 같은 번호, 다음 번호는 건너뛴다(1, 1, 3)
  stops.forEach((s, i) => {
    s.rank = i > 0 && stops[i - 1].first === s.first ? stops[i - 1].rank : i + 1;
  });
  return stops;
}
