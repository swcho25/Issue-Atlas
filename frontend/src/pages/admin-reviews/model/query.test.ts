import { describe, expect, it } from "vitest";

import { changeQuery, reviewQuery } from "./query";

describe("reviewQuery", () => {
  it("값이 없거나 모르는 값이면 대기 · 전체 · 1쪽", () => {
    expect(reviewQuery({})).toEqual({ status: "pending", origin: null, page: 1 });
    expect(reviewQuery({ status: "done", origin: "robot", page: "-2" })).toEqual({
      status: "pending",
      origin: null,
      page: 1,
    });
  });

  it("주소의 상태 · 출처 · 쪽을 읽는다(배열이면 첫 값)", () => {
    expect(reviewQuery({ status: "on_hold", origin: ["user", "admin"], page: "3" })).toEqual({
      status: "on_hold",
      origin: "user",
      page: 3,
    });
  });
});

describe("changeQuery", () => {
  it("처리 종류는 계약 값만", () => {
    expect(changeQuery({ action: "approve" }).action).toBe("approve");
    expect(changeQuery({ action: "delete" }).action).toBeNull();
  });
});
