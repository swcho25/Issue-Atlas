import { describe, expect, it } from "vitest";

import example from "../../../../../contracts/c2/examples/my-question-list.json";
import { myQuestionListSchema } from "@/shared/api";

import { counts } from "./summary";

const { questions } = myQuestionListSchema.parse(example);

describe("마이페이지 숫자", () => {
  it("저장한 질문 · 실행(후보 회차까지) · 새 이슈 후보를 센다", () => {
    expect(counts(questions)).toEqual([
      { label: "저장한 질문", value: 1 },
      { label: "실행", value: 3 },
      { label: "새 이슈 후보", value: 1 },
    ]);
    expect(counts([]).map((c) => c.value)).toEqual([0, 0, 0]);
  });
});
