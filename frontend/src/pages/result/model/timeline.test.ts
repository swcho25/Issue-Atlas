import { describe, expect, it } from "vitest";

import { type Argument, argumentSchema } from "@/shared/api";

import a3Json from "../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import unsupportedJson from "../../../../../contracts/c2/examples/argument-unsupported.json";
import { defaultMonth, monthAt, monthOf, monthPosition, periodMonths, yearMarks } from "./timeline";

const ready = argumentSchema.parse(readyJson);
const a3 = argumentSchema.parse(a3Json);

/** start(YYYY-MM)부터 count 개월 */
function monthsFrom(start: string, count: number) {
  const [y, m] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const t = y * 12 + m - 1 + i;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  });
}

describe("공통 시간 슬라이더 — 달", () => {
  it("질문 기간의 달은 그림 줄의 달(C1 · A3 모두 같은 칸 36개월), 그림 줄이 없으면 슬라이더를 두지 않는다", () => {
    for (const a of [ready, a3]) {
      const months = periodMonths(a);
      expect(months).toHaveLength(36);
      expect([months[0], months.at(-1)]).toEqual(["2023-01", "2025-12"]);
    }
    const none = argumentSchema.parse(unsupportedJson);
    expect(periodMonths(none)).toEqual([]);
    expect(defaultMonth(none)).toBeNull();
  });

  it("처음엔 값이 하나라도 있는 마지막 달", () => {
    expect(defaultMonth(ready)).toBe("2025-12");
    expect(defaultMonth(a3)).toBe("2025-12");
    // 마지막 달 값이 모든 줄에서 비면 그 앞 달
    const emptyLast = {
      ...a3,
      series: a3.series.map((s) => ({ ...s, values: [...s.values.slice(0, -1), null] })),
    } as Argument;
    expect(defaultMonth(emptyLast)).toBe("2025-11");
    // 값이 하나도 없으면 기간의 마지막 달
    const empty = {
      ...a3,
      series: a3.series.map((s) => ({ ...s, values: s.values.map(() => null) })),
    } as Argument;
    expect(defaultMonth(empty)).toBe("2025-12");
  });

  it("기사 날짜는 그 달로 본다, 날짜를 모르면 null", () => {
    expect(monthOf("2024-02-29")).toBe("2024-02");
    expect(monthOf(null)).toBeNull();
  });
});

describe("공통 시간 슬라이더 — 줄 위 자리", () => {
  const months = monthsFrom("2023-01", 36);

  it("왼쪽 끝이 첫 달, 오른쪽 끝이 마지막 달", () => {
    expect(monthPosition(months, 0)).toBe(0);
    expect(monthPosition(months, 35)).toBe(1);
    expect(monthPosition(["2024-01"], 0)).toBe(0);
  });

  it("누른 자리에서 가장 가까운 달, 줄 밖으로는 나가지 않는다", () => {
    expect(monthAt(months, 0)).toBe(0);
    expect(monthAt(months, 1)).toBe(35);
    expect(monthAt(months, 0.5)).toBe(18); // 17.5 → 가까운 달
    expect(monthAt(months, -0.3)).toBe(0);
    expect(monthAt(months, 1.4)).toBe(35);
  });

  it("연 눈금: 양 끝 글자(시작 · 끝 달)와 겹치는 해는 빼고, 기간이 길면 건너뛴다", () => {
    // 3년: 2023-01 은 왼쪽 끝 글자가 대신하고 2024 · 2025 만
    expect(yearMarks(months, 414).map((m) => m.year)).toEqual(["2024", "2025"]);
    expect(yearMarks(months, 414)[0].position).toBeCloseTo(12 / 35, 5);
    // 1월로 끝나면(2023-02 ~ 2026-01) 마지막 1월은 오른쪽 끝 글자와 겹쳐 뺀다
    expect(yearMarks(monthsFrom("2023-02", 36), 414).map((m) => m.year)).toEqual(["2024", "2025"]);
    // 20년: 눈금끼리 36 이상 떨어지게 두 해마다
    const long = yearMarks(monthsFrom("2006-01", 240), 414).map((m) => m.year);
    expect(long.length).toBeLessThanOrEqual(10);
    expect(Number(long[1]) - Number(long[0])).toBe(2);
  });
});
