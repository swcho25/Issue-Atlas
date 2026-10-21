import { describe, expect, it } from "vitest";

import { serverStatusSchema } from "./schema";

describe("serverStatusSchema", () => {
  it("Actuator 응답에서 status 만 꺼낸다", () => {
    const parsed = serverStatusSchema.parse({ status: "UP", groups: ["liveness"] });
    expect(parsed).toEqual({ status: "UP" });
  });

  it("정의되지 않은 상태 값은 거부한다", () => {
    expect(serverStatusSchema.safeParse({ status: "SLEEPING" }).success).toBe(false);
  });

  it("status 가 없으면 거부한다", () => {
    expect(serverStatusSchema.safeParse({}).success).toBe(false);
  });
});
