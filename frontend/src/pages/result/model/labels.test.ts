import { describe, expect, it } from "vitest";

import { argumentSchema } from "@/shared/api";

import insufficientJson from "../../../../../contracts/c2/examples/argument-c1-insufficient.json";
import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import yearsJson from "../../../../../contracts/c2/examples/argument-c1-unsupported-years.json";
import candidateJson from "../../../../../contracts/c2/examples/argument-unsupported.json";
import {
  judgmentBadge,
  kstDate,
  locatorLine,
  periodRange,
  unmetConditions,
  yearSpan,
} from "./labels";

describe("yearSpan — 기간(끝 미포함)을 연도로", () => {
  it.each([
    ["2023-01-01", "2026-01-01", "2023–2025"],
    ["2025-01-01", "2026-01-01", "2025"],
    ["2025-03-01", "2025-03-02", "2025"],
    ["2025-12-01", "2026-01-01", "2025"],
    ["2026-01-01", null, "2026"],
    [null, null, ""],
  ])("%s ~ %s → %s", (start, end, want) => {
    expect(yearSpan(start, end)).toBe(want);
  });
});

describe("periodRange — 기간(끝 미포함)을 날짜로, 끝은 하루 당김", () => {
  it.each([
    ["2023-01-01", "2026-01-01", "2023-01-01 – 2025-12-31"],
    ["2024-02-01", "2024-03-01", "2024-02-01 – 2024-02-29"],
    ["2025-06-01", null, "2025-06-01 –"],
    [null, "2026-01-01", "~ 2025-12-31"],
    [null, null, ""],
  ])("%s ~ %s → %s", (start, end, want) => {
    expect(periodRange(start, end)).toBe(want);
  });
});

describe("kstDate — 한국 날짜 · 시각", () => {
  it("UTC 저녁은 한국 다음 날이다", () => {
    expect(kstDate("2026-10-20T15:30:00Z")).toBe("2026-10-21");
    expect(kstDate("2026-10-20T15:30:00Z", true)).toBe("2026-10-21 00:30");
    expect(kstDate("2026-10-21T11:00:00+09:00", true)).toBe("2026-10-21 11:00");
  });
});

describe("locatorLine — 원문 위치를 한 줄로", () => {
  it("배열은 · 로 잇고, 빈 값은 뺀다", () => {
    expect(
      locatorLine({ tbl_id: "DT_1B26001", C2: "0", prd_de: ["2023", "2024"], sheet: null }),
    ).toBe("tbl_id DT_1B26001 · C2 0 · prd_de 2023 · 2024");
  });

  it("안의 객체는 한 단계만 풀고, 더 깊은 것 · 해시 · 검색 조건은 뺀다", () => {
    expect(
      locatorLine({
        spec_id: "bigkinds_news",
        locator: {
          news_id: "01100101.2024",
          search_query: "여수 AND 청년",
          obs_key: "obs:ab",
          query: { keyword: "청년", ranges: [{ from: 1 }] },
        },
        content_hash: "ab12",
      }),
    ).toBe("spec_id bigkinds_news · news_id 01100101.2024");
  });
});

describe("판단 배지(C2 v1)", () => {
  const ready = argumentSchema.parse(readyJson);

  it("글자는 claim.label 그대로, 색은 claim.value 로", () => {
    expect(judgmentBadge(ready)).toEqual({ tone: "amber", label: "청년 순유출 확대" });
  });

  it("C2 v1 전 실행(ready 인데 label null)은 이전 배지로", () => {
    expect(judgmentBadge({ ...ready, claim: { ...ready.claim, label: null } })).toEqual({
      tone: "amber",
      label: "증가",
    });
  });

  it("판정하지 않은 실행: blocked 「자료 부족」 · unsupported 「근거 부족」", () => {
    expect(judgmentBadge(argumentSchema.parse(insufficientJson)).label).toBe("자료 부족");
    expect(judgmentBadge(argumentSchema.parse(yearsJson)).label).toBe("근거 부족");
    expect(judgmentBadge(argumentSchema.parse(candidateJson)).label).toBe("근거 부족");
  });

  it("못 채운 적용 조건은 passed false 줄만", () => {
    expect(unmetConditions(argumentSchema.parse(yearsJson)).map((c) => c.note)).toEqual([
      "2개(2024–2025)",
    ]);
    expect(unmetConditions(ready)).toEqual([]);
  });
});
