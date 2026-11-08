import { describe, expect, it } from "vitest";

import { argumentSchema } from "@/shared/api";

import a3Json from "../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import unsupportedJson from "../../../../../contracts/c2/examples/argument-unsupported.json";
import {
  availableViews,
  barLayout,
  barNumber,
  CHART_WIDTH,
  changeSeries,
  MIN_BAR,
  openViews,
  yearlyBars,
} from "./views";

const ready = argumentSchema.parse(readyJson);
const a3 = argumentSchema.parse(a3Json);
const unsupported = argumentSchema.parse(unsupportedJson);

describe("유형 전환", () => {
  it("결과가 가진 그림 모양으로 유형이 켜진다(여수 C1: 변화 · 이동, Figma 「켜짐=변화·이동」)", () => {
    expect([...availableViews(ready)].sort()).toEqual(["change", "movement"]);
    expect([...availableViews(a3)]).toEqual(["distribution"]);
    expect(availableViews(unsupported).size).toBe(0);
  });

  it("켤 수 있는 건 그림을 만든 유형뿐이고, 처음엔 변화형이(없으면 켤 수 있는 첫 유형이) 열린다", () => {
    // C1 은 이동(flow) 줄도 있지만 이동형은 아직 그림이 없다
    expect(openViews(ready)).toEqual({ enabled: new Set(["change"]), initial: "change" });
    // A3 는 측정소 지도 점만 있어 분포형
    expect(openViews(a3)).toEqual({ enabled: new Set(["distribution"]), initial: "distribution" });
  });

  it("기사 건수 줄이 있으면 관측 순서도 켜진다(처음 열리는 건 그대로 변화형)", () => {
    const withCounts = {
      ...ready,
      series: [
        ...ready.series,
        {
          tag: "C1",
          place_id: "kr-12130",
          name: "여수시",
          coordinates: [127.66, 34.76] as [number, number],
          unit: "건",
          periods: ["2023-01"],
          values: [3],
          statuses: ["available" as const],
        },
      ],
    };
    expect(openViews(withCounts)).toEqual({
      enabled: new Set(["change", "observationOrder"]),
      initial: "change",
    });
  });
});

describe("변화형 막대", () => {
  it("사람 수는 해마다 합계(Figma −1,537 · −1,935 · −2,262)", () => {
    const s = changeSeries(ready)!;
    expect(yearlyBars(s)).toEqual([
      { year: "2023", value: -1537 },
      { year: "2024", value: -1935 },
      { year: "2025", value: -2262 },
    ]);
    expect(barNumber(-1537, "sum")).toBe("−1,537");
  });

  it("농도처럼 셀 수 없는 단위는 해마다 평균, 빈 달은 빼고 한 해가 모두 비면 null", () => {
    const s = {
      ...a3.series[0],
      periods: ["2024-01", "2024-02", "2025-01"],
      values: [10, null, null],
      statuses: ["available", "not_collected", "not_collected"],
    };
    expect(yearlyBars(s as (typeof a3.series)[0])).toEqual([
      { year: "2024", value: 10 },
      { year: "2025", value: null },
    ]);
    expect(barNumber(11.04, "mean")).toBe("11.0");
  });
});

describe("막대 배치", () => {
  it("3개 · 모두 음수는 Figma 칸(122 · 사이 28 · 막대 56), 0 선이 맨 위 · 가장 긴 막대 86", () => {
    const l = barLayout([-1537, -1935, -2262]);
    expect([l.column, l.gap, l.barWidth, l.zero]).toEqual([122, 28, 56, 0]);
    expect(Math.round(l.items[2]!.height)).toBe(86);
    expect(l.items.every((it) => it!.barTop === 0)).toBe(true);
  });

  it("10개 · 부호가 섞이면 폭 안에 들어가고, 0 선이 가운데쯤 · 양수 위로 · 음수 아래로", () => {
    const values = [120, -80, 40, -200, 300, -50, 0, 90, -150, 210];
    const l = barLayout(values);
    expect(l.column * 10 + l.gap * 9).toBeCloseTo(CHART_WIDTH);
    expect(l.small).toBe(true);
    // 양수 끝(300) ~ 음수 끝(200) 이 86 → 0 선은 위 글자 칸 22 + 300 몫
    expect(l.zero).toBeCloseTo(22 + (300 / 500) * 86);
    const pos = l.items[4]!;
    const neg = l.items[3]!;
    expect(pos.barTop + pos.height).toBeCloseTo(l.zero); // 위로 올라가 0 선에서 끝남
    expect(neg.barTop).toBeCloseTo(l.zero); // 0 선에서 아래로
    expect(pos.labelTop).toBeLessThan(pos.barTop); // 값 글자는 양수 위
    expect(neg.labelTop).toBeGreaterThan(neg.barTop + neg.height); // 음수 아래
    expect(l.yearTop).toBeGreaterThan(neg.labelTop); // 연도는 맨 아래 한 줄
  });

  it("20개면 칸이 좁아 값 글자는 숨기고(툴팁 · 화면 낭독기), 연도는 마지막 해부터 하나 걸러 보인다", () => {
    const l = barLayout(Array.from({ length: 20 }, (_, i) => (i % 2 ? -50 : 80)));
    expect(l.column * 20 + l.gap * 19).toBeCloseTo(CHART_WIDTH);
    expect(l.showValues).toBe(false);
    expect(l.showYear(19)).toBe(true);
    expect(l.showYear(18)).toBe(false);
    expect(l.showYear(17)).toBe(true);
    // 값 글자 칸이 없어 0 선이 맨 위 글자 칸 없이 시작
    expect(l.zero).toBeCloseTo((80 / 130) * 86);
  });

  it("10개까지는 값 · 연도를 모두 보인다", () => {
    const l = barLayout(Array.from({ length: 10 }, () => 1));
    expect(l.showValues).toBe(true);
    expect([...Array(10).keys()].every((i) => l.showYear(i))).toBe(true);
  });

  it("막대는 4 보다 가늘어지지 않고, 그래도 넘치면 그림 칸이 시트보다 넓어져 좌우로 스크롤한다", () => {
    const sixty = barLayout(Array.from({ length: 60 }, () => 1));
    expect(sixty.barWidth).toBe(MIN_BAR);
    expect(sixty.scroll).toBe(false);
    const hundred = barLayout(Array.from({ length: 100 }, () => 1));
    expect(hundred.column).toBe(MIN_BAR);
    expect(hundred.barWidth).toBe(MIN_BAR);
    expect(hundred.width).toBe(MIN_BAR * 100 + 2 * 99);
    expect(hundred.scroll).toBe(true);
  });

  it("모두 양수면 0 선이 맨 아래(위 글자 칸 22 + 86)", () => {
    const l = barLayout([1537, 1935, 2262]);
    expect(Math.round(l.zero)).toBe(22 + 86);
  });
});
