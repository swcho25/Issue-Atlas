import { describe, expect, it } from "vitest";

import donggu from "../../../../../contracts/c2/examples/place-boundaries-donggu.json";
import { placeBoundariesSchema } from "./boundaries";

describe("placeBoundariesSchema", () => {
  it("계약 예시(광주 동구 + 행정동)를 통과시킨다", () => {
    const b = placeBoundariesSchema.parse(donggu);
    expect(b.features.map((f) => f.properties.level)).toEqual(["sigungu", "emd"]);
  });

  it("우리 지역 밖 좌표는 실패한다", () => {
    const bad = structuredClone(donggu);
    bad.features[0].geometry.coordinates[0][0][0] = [0, 0];
    expect(placeBoundariesSchema.safeParse(bad).success).toBe(false);
  });
});
