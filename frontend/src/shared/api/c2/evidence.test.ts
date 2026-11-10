import { describe, expect, it } from "vitest";

import kosis from "../../../../../contracts/c2/examples/evidence-kosis.json";
import { evidenceSchema } from "./evidence";

describe("evidenceSchema", () => {
  it("계약 예시(KOSIS 순이동)를 통과시킨다", () => {
    const e = evidenceSchema.parse(kosis);
    expect(e.kind).toBe("statistics");
    expect(e.locator.tbl_id).toBe("DT_1B26001");
  });

  it("링크만 저장하는 자료가 내용을 보내면 실패한다", () => {
    const bad = { ...kosis, storage_scope: "link_only" };
    expect(evidenceSchema.safeParse(bad).success).toBe(false);
    expect(evidenceSchema.safeParse({ ...bad, display: null }).success).toBe(true);
  });
});
