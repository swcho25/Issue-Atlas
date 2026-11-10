import { describe, expect, it } from "vitest";

import { isLinkOk, REASON_MAX, suggestionReason } from "./suggestion";

const base = {
  cell: "③ 보증",
  context: "청년 유출·정착 · 여수시",
  runId: "run_c1_yeosu_2023_2025",
  quote: "순이동은 정착 여부를 직접 재는 공식 지표다",
  description: "「직접 재는」은 과한 표현 같아요.",
  link: "",
};

describe("suggestionReason — 사유 글", () => {
  it("칸 · 카드 · 지역 · 실행, 칸 내용, 설명 순서", () => {
    expect(suggestionReason(base)).toBe(
      "[③ 보증] 청년 유출·정착 · 여수시 · 실행 run_c1_yeosu_2023_2025\n" +
        "칸 내용: 「순이동은 정착 여부를 직접 재는 공식 지표다」\n\n" +
        "「직접 재는」은 과한 표현 같아요.",
    );
  });

  it("붙인 근거는 맨 끝에, 인용이 없으면 그 줄을 뺀다", () => {
    const text = suggestionReason({ ...base, quote: null, link: " https://kosis.kr/x " });
    expect(text).toBe(
      "[③ 보증] 청년 유출·정착 · 여수시 · 실행 run_c1_yeosu_2023_2025\n\n" +
        "「직접 재는」은 과한 표현 같아요.\n\n근거: https://kosis.kr/x",
    );
  });

  it("길어도 계약 최대(2000자)를 넘지 않고, 머리와 근거는 남는다", () => {
    const text = suggestionReason({
      ...base,
      quote: "가".repeat(1000),
      description: "나".repeat(3000),
      link: "https://kosis.kr/x",
    });
    expect(text.length).toBeLessThanOrEqual(REASON_MAX);
    expect(text.startsWith("[③ 보증]")).toBe(true);
    expect(text.endsWith("근거: https://kosis.kr/x")).toBe(true);
  });
});

describe("isLinkOk — 붙인 근거 링크", () => {
  it.each([
    ["", true],
    ["https://kosis.kr/statHtml", true],
    ["http://example.com", true],
    ["kosis.kr", false],
    ["javascript:alert(1)", false],
  ])("%s → %s", (link, ok) => {
    expect(isLinkOk(link)).toBe(ok);
  });
});
