import { describe, expect, it } from "vitest";

import { argumentSchema } from "@/shared/api";

import a3Json from "../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import {
  aqGrade,
  distributionMonths,
  missingLabel,
  monthSummary,
  statChip,
  stationPoints,
  stationSeries,
  stationStats,
} from "./distribution";

const a3 = argumentSchema.parse(a3Json);
const stations = stationSeries(a3);

describe("분포형", () => {
  it("측정소 지도 점 줄만 고른다(C1 막대 · 이동 줄은 아님)", () => {
    expect(stations.length).toBe(a3.series.length);
    expect(stations.length).toBeGreaterThan(0);
    expect(stationSeries(argumentSchema.parse(readyJson))).toEqual([]);
  });

  it("달은 질문 기간의 36개월(처음 달 · 고르기는 공통 시간 슬라이더 — timeline.test)", () => {
    const months = distributionMonths(stations);
    expect(months).toHaveLength(36);
    expect([months[0], months.at(-1)]).toEqual(["2023-01", "2025-12"]);
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
  it("카드 칩: 측정소 수 · 기간 전체에서 가장 높은 · 낮은 측정소 값과 그 달(같은 값이면 이른 달)", () => {
    const series = [
      {
        ...stations[0],
        name: "서강동",
        periods: ["2024-02", "2024-03", "2024-08"],
        values: [20, 40.6, 9.4],
        statuses: ["available", "available", "available"],
      },
      {
        ...stations[0],
        station_id: "s2",
        name: "여천동",
        periods: ["2024-02", "2024-03", "2024-08"],
        values: [40.6, null, 12],
        statuses: ["available", "not_published", "available"],
      },
    ] as typeof stations;
    const stats = stationStats(series);
    expect(stats).toMatchObject({ count: 2, unit: "µg/m³" });
    // 40.6 이 두 번 — 이른 달(2024-02 여천동). 달 평균(30.3)이 아니라 측정소 값
    expect(stats?.high).toEqual({ value: 40.6, month: "2024-02", station: "여천동" });
    expect(stats?.low).toEqual({ value: 9.4, month: "2024-08", station: "서강동" });
    expect(statChip("최고", stats!.high!)).toBe("최고 41 · 2024-02");
    expect(statChip("최저", stats!.low!)).toBe("최저 9 · 2024-08");
  });

  it("카드 칩: 측정소 줄이 없으면 null, 값이 하나도 없으면 최고 · 최저 없이 수만", () => {
    expect(stationStats([])).toBeNull();
    const empty = [{ ...stations[0], periods: ["2024-03"], values: [null] }] as typeof stations;
    expect(stationStats(empty)).toMatchObject({ count: 1, high: null, low: null });
    // 계약 예시(서강동 36개월): 값이 모두 있다
    const real = stationStats(stations);
    expect(real?.count).toBe(stations.length);
    expect(real?.high?.value).toBeGreaterThan(real?.low?.value ?? Infinity);
  });
});
