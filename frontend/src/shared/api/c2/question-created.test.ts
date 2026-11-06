import { describe, expect, it } from "vitest";

import example from "../../../../../contracts/c2/examples/question-create-response.json";
import { questionCreatedSchema } from "./question-created";

describe("questionCreatedSchema", () => {
  it("계약 예시를 통과시킨다", () => {
    expect(questionCreatedSchema.parse(example).run_id).toBe(example.run_id);
  });

  it("신규 카드 후보인데 판단 상태면 실패한다", () => {
    const bad = { ...example, candidate: true, run_status: "ready" };
    expect(questionCreatedSchema.safeParse(bad).success).toBe(false);
  });
});
