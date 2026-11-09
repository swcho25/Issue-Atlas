import { describe, expect, it } from "vitest";

import { errorLabel } from "./labels";
import { importQuery, jobQuery } from "./query";

describe("데이터 소스 주소 · 글자", () => {
  it("수집 이력: 모르는 상태는 전체, 출처 · 쪽은 그대로", () => {
    expect(jobQuery({})).toEqual({ status: null, source: null, page: 1 });
    expect(jobQuery({ status: "zombie", source: "S01", page: "2" })).toEqual({
      status: null,
      source: "S01",
      page: 2,
    });
    expect(jobQuery({ status: "failed" }).status).toBe("failed");
  });

  it("CSV 요청: 계약 상태만", () => {
    expect(importQuery({ status: "pending" }).status).toBe("pending");
    expect(importQuery({ status: "loaded" }).status).toBeNull();
  });

  it("검증 오류 코드는 말로, 모르는 코드는 그대로", () => {
    expect(errorLabel("header_mismatch")).toBe("머리 줄이 양식과 다름");
    expect(errorLabel("new_code")).toBe("new_code");
  });
});
