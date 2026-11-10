import { describe, expect, it } from "vitest";

import { adminMenu, isActive, viewerMenu } from "./menu";

const [ask] = viewerMenu;
const [summary, reviews] = adminMenu;

describe("isActive", () => {
  it("메뉴 주소와 그 하위 주소에서 고른 칸이 된다", () => {
    expect(isActive(ask, "/ask")).toBe(true);
    expect(isActive(ask, "/ask/123")).toBe(true);
  });

  it("앞부분만 같은 다른 주소는 고르지 않는다", () => {
    expect(isActive(ask, "/asked")).toBe(false);
  });

  it("운영 요약(/admin)은 하위 관리자 화면에서 고르지 않는다", () => {
    expect(isActive(summary, "/admin")).toBe(true);
    expect(isActive(summary, "/admin/reviews")).toBe(false);
    expect(isActive(reviews, "/admin/reviews/7")).toBe(true);
  });
});
