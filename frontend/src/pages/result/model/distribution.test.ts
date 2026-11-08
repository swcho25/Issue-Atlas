import { describe, expect, it } from "vitest";

import { argumentSchema } from "@/shared/api";

import a3Json from "../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import {
  aqGrade,
  defaultMonth,
  distributionMonths,
  missingLabel,
  monthSummary,
  stationPoints,
  stationSeries,
} from "./distribution";

const a3 = argumentSchema.parse(a3Json);
const stations = stationSeries(a3);

describe("분포형", () => {
  it("측정소 지도 점 줄만 고른다(C1 막대 · 이동 줄은 아님)", () => {
    expect(stations.length).toBe(a3.series.length);
    expect(stations.length).toBeGreaterThan(0);
    expect(stationSeries(argumentSchema.parse(readyJson))).toEqual([]);
  });

  it("달은 질문 기간의 36개월, 처음엔 값이 있는 마지막 달", () => {
    const months = distributionMonths(stations);
    expect(months).toHaveLength(36);
    expect(defaultMonth(stations)).toBe("2025-12");
    const emptyLast = stations.map((s) => ({ ...s, values: [...s.values.slice(0, -1), null] }));
    expect(defaultMonth(emptyLast)).toBe("2025-11");
  });

  it("환경부 4단계: PM2.5 15 · 35 · 75 이하, PM10 30 · 80 · 150 이하, 기준 없는 지표는 null", () => {
    expect(aqGrade("air_pm25", 15)?.label).toBe("좋음");
    expect(aqGrade("air_pm25", 15.1)?.label).toBe("보통");
    expect(aqGrade("air_pm25", 76)?.label).toBe("매우나쁨");
    expect(aqGrade("air_pm10", 80)?.label).toBe("보통");
    expect(aqGrade("population_net_migration_19_39", 10)).toBeNull();
  });

  it("점 지름은 기간 전체 최댓값 기준 20 ~ 40(달을 바꿔도 비교된다), 값이 없으면 0", () => {
    const series = [
      {
        ...stations[0],
        periods: ["2024-01", "2024-02"],
        values: [10, 40],
        statuses: ["available", "available"],
      },
      {
        ...stations[0],
        station_id: "s2",
        periods: ["2024-01", "2024-02"],
        values: [null, 0],
        statuses: ["not_published", "available"],
      },
    ] as typeof stations;
    const jan = stationPoints(series, "2024-01");
    expect(jan.map((p) => p.size)).toEqual([30, 0]); // 20 + 20 × √(10/40)
    expect(stationPoints(series, "2024-02").map((p) => p.size)).toEqual([40, 20]);
    expect(missingLabel(jan[1])).toBe(`${stations[0].name} · 미공표`);
  });

  it("유리 바 한 줄: 달 · 값이 있는 측정소 수 · 최소–최대(반올림) · 결측 수", () => {
    const series = [
      { ...stations[0], periods: ["2024-03"], values: [9.4], statuses: ["available"] },
      {
        ...stations[0],
        station_id: "s2",
        periods: ["2024-03"],
        values: [40.6],
        statuses: ["available"],
      },
      {
        ...stations[0],
        station_id: "s3",
        periods: ["2024-03"],
        values: [null],
        statuses: ["not_published"],
      },
    ] as typeof stations;
    expect(monthSummary(stationPoints(series, "2024-03"), "2024-03", "µg/m³")).toBe(
      "2024-03 한 달 · 측정소 2곳 · 9–41 µg/m³ · 결측 1곳",
    );
    // 측정소가 하나면 「13–13」 이 아니라 한 값, 모두 결측이면 「값 없음」
    expect(monthSummary(stationPoints(series.slice(0, 1), "2024-03"), "2024-03", "µg/m³")).toBe(
      "2024-03 한 달 · 측정소 1곳 · 9 µg/m³",
    );
    expect(monthSummary(stationPoints(series.slice(2), "2024-03"), "2024-03", "µg/m³")).toBe(
      "2024-03 한 달 · 측정소 0곳 · 값 없음 · 결측 1곳",
    );
  });
});
