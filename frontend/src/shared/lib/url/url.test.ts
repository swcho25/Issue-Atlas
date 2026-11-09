import { describe, expect, it } from "vitest";

import { href, one, pageOf } from ".";

describe("주소 도구", () => {
  it("비어 있는 칸은 주소에서 뺀다", () => {
    expect(href("/admin/reviews", { status: null, origin: "user", page: 2 })).toBe(
      "/admin/reviews?origin=user&page=2",
    );
    expect(href("/admin/reviews", { status: null })).toBe("/admin/reviews");
  });

  it("같은 이름이 여러 번 오면 처음 값, 쪽은 1 이상 정수만", () => {
    expect(one(["a", "b"])).toBe("a");
    expect(pageOf("3")).toBe(3);
    expect(pageOf("-2")).toBe(1);
    expect(pageOf(undefined)).toBe(1);
  });
});
