import { describe, expect, it } from "vitest";

import { qualifierGap } from "./qualifier";

const c = (
  a: number,
  ab: number,
  independent: number,
  recent: boolean,
): Parameters<typeof qualifierGap>[1] => ({
  a_grade_sources: a,
  ab_grade_sources: ab,
  independent_evidence: independent,
  latest_observed_at: null,
  latest_within_one_year: recent,
});

describe("qualifierGap", () => {
  it("높음이면 모자란 것이 없다", () => {
    expect(qualifierGap("high", c(2, 3, 3, true))).toBeNull();
  });

  it("보통이면 높음까지 모자란 공식 통계 · 교차 확인 · 기준 시점을 센다", () => {
    expect(qualifierGap("medium", c(1, 2, 3, true))).toBe("높음까지 공식 통계 1곳 더");
    expect(qualifierGap("medium", c(0, 1, 2, false))).toBe(
      "높음까지 공식 통계 2곳 · 교차 확인 1건 · 1년 이내 자료 더",
    );
  });

  it("낮음이면 보통까지 모자란 것을 센다", () => {
    expect(qualifierGap("low", c(0, 0, 1, false))).toBe(
      "보통까지 공식 통계 · 행정 자료 1곳 · 교차 확인 1건 더",
    );
  });
});
