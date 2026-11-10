import { describe, expect, it } from "vitest";

import { dateTime, day, monthDayTime, num } from ".";

describe("숫자 · 시각 표기", () => {
  it("숫자는 천 단위", () => {
    expect(num(3497962)).toBe("3,497,962");
  });

  it("시각은 표기가 달라도 같은 순간이면 같은 한국 시간", () => {
    expect(dateTime("2026-11-03T07:02:00Z")).toBe("2026-11-03 16:02");
    expect(dateTime("2026-11-03T16:02:00+09:00")).toBe("2026-11-03 16:02");
    expect(monthDayTime("2026-11-08T07:14:41Z")).toBe("11-08 16:14");
  });

  it("날짜만 온 값은 그대로, 시각은 한국 날짜로", () => {
    expect(day("2026-11-03")).toBe("2026-11-03");
    expect(day("2026-11-02T20:00:00Z")).toBe("2026-11-03");
  });
});
