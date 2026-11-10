import { describe, expect, it } from "vitest";

import example from "../../../../../contracts/c2/examples/my-question-list.json";
import { myQuestionListSchema } from "./my-questions";

describe("myQuestionListSchema", () => {
  it("계약 예시(저장한 질문 2회차 + 새 이슈 후보)를 통과시킨다", () => {
    const list = myQuestionListSchema.parse(example);
    expect(list.questions.map((q) => [q.candidate, q.runs.length])).toEqual([
      [false, 2],
      [true, 1],
    ]);
  });

  it("이슈가 있는데 candidate 이면 실패한다", () => {
    const bad = structuredClone(example);
    bad.questions[0].candidate = true;
    expect(myQuestionListSchema.safeParse(bad).success).toBe(false);
  });
});
