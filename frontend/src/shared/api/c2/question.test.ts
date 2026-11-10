import { describe, expect, it } from "vitest";

import created from "../../../../../contracts/c2/examples/question-create-response.json";
import { questionCreatedSchema } from "./question";

describe("questionCreatedSchema", () => {
  it("계약 예시(새 실행)를 통과시킨다", () => {
    expect(questionCreatedSchema.parse(created).run_id).toBe("run_c1_yeosu_2023_2025");
  });

  it("후보 질문인데 unsupported 가 아니면 실패한다", () => {
    expect(questionCreatedSchema.safeParse({ ...created, candidate: true }).success).toBe(false);
    expect(
      questionCreatedSchema.safeParse({ ...created, candidate: true, run_status: "unsupported" })
        .success,
    ).toBe(true);
  });
});
