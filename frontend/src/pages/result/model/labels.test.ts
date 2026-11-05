import { describe, expect, it } from "vitest";

import { kstDate, locatorLine, periodRange, yearSpan } from "./labels";

describe("yearSpan — 기간(끝 미포함)을 연도로", () => {
  it.each([
    ["2023-01-01", "2026-01-01", "2023–2025"],
    ["2025-01-01", "2026-01-01", "2025"],
    ["2025-03-01", "2025-03-02", "2025"],
    ["2025-12-01", "2026-01-01", "2025"],
    ["2026-01-01", null, "2026"],
    [null, null, ""],
  ])("%s ~ %s → %s", (start, end, want) => {
    expect(yearSpan(start, end)).toBe(want);
  });
});

describe("periodRange — 기간(끝 미포함)을 날짜로, 끝은 하루 당김", () => {
  it.each([
    ["2023-01-01", "2026-01-01", "2023-01-01 – 2025-12-31"],
    ["2024-02-01", "2024-03-01", "2024-02-01 – 2024-02-29"],
    ["2025-06-01", null, "2025-06-01 –"],
    [null, "2026-01-01", "~ 2025-12-31"],
    [null, null, ""],
  ])("%s ~ %s → %s", (start, end, want) => {
    expect(periodRange(start, end)).toBe(want);
  });
});

describe("kstDate — 한국 날짜 · 시각", () => {
  it("UTC 저녁은 한국 다음 날이다", () => {
    expect(kstDate("2026-10-20T15:30:00Z")).toBe("2026-10-21");
    expect(kstDate("2026-10-20T15:30:00Z", true)).toBe("2026-10-21 00:30");
    expect(kstDate("2026-10-21T11:00:00+09:00", true)).toBe("2026-10-21 11:00");
  });
});

describe("locatorLine — 원문 위치를 한 줄로", () => {
  it("배열은 · 로 잇고, 빈 값은 뺀다", () => {
    expect(
      locatorLine({ tbl_id: "DT_1B26001", C2: "0", prd_de: ["2023", "2024"], sheet: null }),
    ).toBe("tbl_id DT_1B26001 · C2 0 · prd_de 2023 · 2024");
  });
});
