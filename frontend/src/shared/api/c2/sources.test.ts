import { describe, expect, it } from "vitest";

import example from "../../../../../contracts/c2/examples/source-list.json";
import { sourceListSchema } from "./sources";

describe("sourceListSchema", () => {
  it("계약 예시(등급 없는 출처 · 수집 안 된 명세 포함)를 통과시킨다", () => {
    const list = sourceListSchema.parse(example);
    expect(list.sources.length).toBeGreaterThan(0);
    expect(list.sources.some((s) => s.source_grade === null)).toBe(true);
  });

  it("모르는 수집 방법이면 실패한다", () => {
    const bad = structuredClone(example);
    bad.sources[0].specs[0].method = "ftp";
    expect(sourceListSchema.safeParse(bad).success).toBe(false);
  });
});
