import { describe, expect, it } from "vitest";

import example from "../../../../../contracts/c2/examples/my-question-list.json";
import { myQuestionListSchema } from "@/shared/api";

import { counts, recentQuestions } from "./summary";

const { questions } = myQuestionListSchema.parse(example);
const [saved] = questions;

describe("마이페이지 숫자 · 최근 질문", () => {
  it("저장한 질문 · 실행(후보 회차까지) · 새 이슈 후보를 센다", () => {
    expect(counts(questions)).toEqual([
      { label: "저장한 질문", value: 1 },
      { label: "실행", value: 3 },
      { label: "새 이슈 후보", value: 1 },
    ]);
    expect(counts([]).map((c) => c.value)).toEqual([0, 0, 0]);
  });

  it("최근 질문은 저장한 질문만, 마지막 회차 결과로 간다", () => {
    expect(recentQuestions(questions)).toEqual([
      {
        id: "q_0001",
        title: "여수시 · 청년 유출·정착",
        meta: "2023–2025 · 2회 · 11-06",
        href: "/results/run_0002",
      },
    ]);
  });

  it("실행한 적 없는 질문은 빼고, 앞에서 정한 개수만", () => {
    const many = [1, 2, 3, 4].map((n) => ({ ...saved, question_id: `q_${n}` }));
    expect(recentQuestions([{ ...saved, runs: [] }, ...many]).map((q) => q.id)).toEqual([
      "q_1",
      "q_2",
      "q_3",
    ]);
  });
});
