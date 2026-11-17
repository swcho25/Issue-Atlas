import { describe, expect, it } from "vitest";

import { type Argument, argumentSchema } from "@/shared/api";

import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import { hasObservationOrder, observationOrder } from "./observationOrder";

const ready = argumentSchema.parse(readyJson);

// 순서 규칙은 줄을 직접 만들어 본다(계약 예시의 기사 건수 줄은 빼고 얹는다)
const countLine = (
  place_id: string,
  name: string | null,
  values: (number | null)[],
  coordinates: [number, number] | null = [127.6, 34.7],
) => ({
  tag: "C1",
  place_id,
  name,
  coordinates,
  unit: "건",
  periods: ["2023-01", "2023-02", "2023-03"].slice(0, values.length),
  values,
  statuses: values.map(() => "available" as const),
});
/** 기사 건수 줄이 없는 결과 */
const bare = { ...ready, series: ready.series.filter((s) => !("tag" in s)) } as Argument;
const withLines = (...lines: ReturnType<typeof countLine>[]) =>
  ({ ...bare, series: [...bare.series, ...lines] }) as Argument;

describe("관측 순서", () => {
  it("지역마다 처음 나온 달로 순서를 매기고, 같은 달은 같은 번호(기사가 많은 곳 먼저)", () => {
    const stops = observationOrder(
      withLines(
        countLine("kr-12130-520", "만덕동", [0, 3, 4]),
        countLine("kr-12130", "여수시", [5, 9, 0]),
        countLine("kr-12130-530", "쌍봉동", [0, 7, 0]),
        countLine("kr-12130-540", "문수동", [0, 0, 1], null),
        countLine("kr-12130-550", "삼일동", [0, 0, 0]),
      ),
    );
    expect(stops.map((s) => [s.rank, s.name, s.first, s.total])).toEqual([
      [1, "여수시", "2023-01", 14],
      [2, "만덕동", "2023-02", 7],
      [2, "쌍봉동", "2023-02", 7],
      [4, "문수동", "2023-03", 1],
    ]);
    // 대표점이 없는 지역은 지도에 못 놓는다
    expect(stops[3].at).toBeNull();
  });

  it("달을 고르면 그 달까지 처음 나온 지역만 — 기사 수도 그 달까지(명세 「슬라이더 달까지 나타난 곳만」)", () => {
    const a = withLines(
      countLine("kr-12130-520", "만덕동", [0, 3, 4]),
      countLine("kr-12130", "여수시", [5, 9, 0]),
      countLine("kr-12130-540", "문수동", [0, 0, 1]),
    );
    // 2023-01 까지: 여수시만
    expect(observationOrder(a, "2023-01").map((s) => [s.rank, s.name, s.first, s.total])).toEqual([
      [1, "여수시", "2023-01", 5],
    ]);
    // 2023-02 까지: 만덕동이 더해지고, 여수시 기사 수는 두 달 치
    expect(observationOrder(a, "2023-02").map((s) => [s.rank, s.name, s.first, s.total])).toEqual([
      [1, "여수시", "2023-01", 14],
      [2, "만덕동", "2023-02", 3],
    ]);
    // 마지막 달까지는 달을 주지 않은 것과 같다
    expect(observationOrder(a, "2023-03")).toEqual(observationOrder(a));
  });

  it("계약 예시(여수 C1): 지역 4곳이 첫 기사 달 순서로", () => {
    expect(observationOrder(ready).map((s) => [s.rank, s.name, s.first, s.total])).toEqual([
      [1, "쌍봉동", "2023-01", 3],
      [2, "여수시", "2023-06", 3],
      [3, "한려동", "2024-03", 1],
      [4, "만덕동", "2024-11", 1],
    ]);
    expect(hasObservationOrder(ready)).toBe(true);
  });

  it("기사 건수 줄이 없거나 모두 0이면 켜지 않는다", () => {
    expect(hasObservationOrder(bare)).toBe(false);
    expect(hasObservationOrder(withLines(countLine("kr-12130", "여수시", [0, 0])))).toBe(false);
    expect(hasObservationOrder(withLines(countLine("kr-12130", null, [0, 1])))).toBe(true);
    expect(observationOrder(withLines(countLine("kr-12130", null, [0, 1])))[0].name).toBe(
      "이름 없는 지역",
    );
  });
});
