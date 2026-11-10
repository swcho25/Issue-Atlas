import { describe, expect, it } from "vitest";

import { errorLabel } from "./labels";
import { sourcesHref, sourcesQuery } from "./query";

describe("데이터 소스 주소 · 글자", () => {
  it("기본은 출처 보기 · 전체 수집 기록, 모르는 보기 · 상태는 기본값", () => {
    expect(sourcesQuery({})).toEqual({
      view: "sources",
      source: null,
      status: null,
      id: null,
      mine: false,
      isNew: false,
      page: 1,
    });
    const q = sourcesQuery({ view: "archive", status: "zombie", source: "S01", page: "2" });
    expect(q.view).toBe("sources");
    expect(q.status).toBeNull();
    expect(q.source).toBe("S01");
    expect(q.page).toBe(2);
    expect(sourcesQuery({ status: "failed" }).status).toBe("failed");
  });

  it("CSV 업로드 보기: 고른 업로드 · 처리 필요 · 올리기 양식", () => {
    const q = sourcesQuery({ view: "imports", id: "import_9", mine: "1", new: "0" });
    expect(q).toMatchObject({ view: "imports", id: "import_9", mine: true, isNew: false });
  });

  it("주소는 기본값을 빼고 만든다", () => {
    expect(sourcesHref({})).toBe("/admin/sources");
    expect(sourcesHref({ source: "S01", status: "failed", page: 1 })).toBe(
      "/admin/sources?source=S01&status=failed",
    );
    expect(sourcesHref({ view: "imports", mine: true, page: 2 })).toBe(
      "/admin/sources?view=imports&mine=1&page=2",
    );
    expect(sourcesHref({ view: "imports", isNew: true })).toBe("/admin/sources?view=imports&new=1");
  });

  it("검증 오류 코드는 말로, 모르는 코드는 그대로", () => {
    expect(errorLabel("header_mismatch")).toBe("머리 줄이 양식과 다름");
    expect(errorLabel("new_code")).toBe("new_code");
  });
});
