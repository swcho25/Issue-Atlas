import { describe, expect, it } from "vitest";

import example from "../../../../../contracts/c2/examples/my-question-list.json";
import { myQuestionListSchema } from "@/shared/api";

import { candidateName, monthDay, questionMeta, questionTitle } from "./text";

const [saved, candidate] = myQuestionListSchema.parse(example).questions;

describe("내 질문 줄 글자", () => {
  it("저장한 질문은 지역 · 기간 · 이슈로 문장을 만든다(받침에 맞춰 은 · 는)", () => {
    expect(questionTitle(saved)).toBe("여수시에서 2023–2025년 청년 유출·정착은 어떻게 달라졌나요?");
    expect(questionTitle({ ...saved, card_name: "고령화" })).toBe(
      "여수시에서 2023–2025년 고령화는 어떻게 달라졌나요?",
    );
  });

  it("아래 글은 지역 · 이슈 · 기간 · 회차 · 마지막 실행 날짜(한국 시각)", () => {
    expect(questionMeta(saved)).toBe("여수시 · 청년 유출·정착 · 2023–2025 · 2회 · 11-06");
  });

  it("새 이슈 후보는 원래 문장의 「이슈 이름」 줄을 이름으로", () => {
    expect(candidateName(candidate)).toBe("관광객 수");
    expect(questionTitle(candidate)).toBe("관광객 수");
    expect(questionMeta(candidate)).toBe("여수시 · 2024 · 11-05 접수");
    expect(candidateName({ ...candidate, raw_text: "여수 관광객" })).toBe("여수 관광객");
  });

  it("날짜는 한국 시각으로 센다(UTC 15시 = 다음 날)", () => {
    expect(monthDay("2026-11-05T15:30:00Z")).toBe("11-06");
  });
});
