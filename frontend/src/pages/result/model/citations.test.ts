import { describe, expect, it } from "vitest";

import { groupCitations } from "./citations";

const cite = (article_id: string, date: string, quote: string, extra = {}) => ({
  article_id,
  date,
  quote,
  title: null,
  url: null,
  evidence_id: null,
  ...extra,
});

describe("groupCitations", () => {
  it("같은 인용문(전재 기사)은 한 줄로 묶고 가장 이른 날짜 · 링크 있는 기사를 쓴다", () => {
    const groups = groupCitations([
      cite("a1", "2024-05-22", "직원 1000여 명 이주", {
        title: "여수산단 사택 떠나는 직원들",
        url: "https://news.test/a1",
      }),
      cite("b2", "2024-12-20", "채용 시장 위축 "),
      cite("b1", "2024-12-19", "채용 시장 위축", { url: "https://news.test/b1" }),
      cite("b3", "2024-12-19", "채용 시장 위축"),
    ]);
    expect(groups).toEqual([
      {
        quote: "직원 1000여 명 이주",
        title: "여수산단 사택 떠나는 직원들",
        url: "https://news.test/a1",
        date: "2024-05-22",
        count: 1,
      },
      {
        quote: "채용 시장 위축",
        title: null,
        url: "https://news.test/b1",
        date: "2024-12-19",
        count: 3,
      },
    ]);
  });

  it("제목 · 링크가 없는 앞 판 인용도 묶는다", () => {
    const groups = groupCitations([
      { article_id: "a1", date: "2024-05-22", quote: "직원 이주", evidence_id: null },
    ]);
    expect(groups).toEqual([
      { quote: "직원 이주", title: null, url: null, date: "2024-05-22", count: 1 },
    ]);
  });
});
