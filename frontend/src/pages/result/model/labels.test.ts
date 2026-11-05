import { describe, expect, it } from "vitest";

import { yearSpan } from "./labels";

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
