import type { Argument } from "@/shared/api";

export type Citation = NonNullable<Argument["rebuttals"][number]["citations"]>[number];

/** 인용 모달의 한 줄: 같은 인용문(전재 기사)은 한 줄로 묶는다 */
export type CitationGroup = {
  quote: string;
  /** 묶음에서 제목 · 링크가 있는 첫 기사(없으면 첫 기사) */
  title: string | null;
  url: string | null;
  /** 묶음에서 가장 이른 날짜 */
  date: string;
  /** 같은 인용문 기사 수 */
  count: number;
};

/**
 * ⑤ 반박 인용(-343)을 인용문마다 묶는다. 요약이 같은 전재 기사는 기사 ID 만 달라 같은 문장이 여러 번 온다.
 * 순서는 처음 나온 순서(engine 이 반박마다 고른 순위).
 */
export function groupCitations(citations: Citation[]): CitationGroup[] {
  const groups = new Map<string, Citation[]>();
  for (const c of citations) {
    const key = c.quote.trim();
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.entries()].map(([quote, items]) => {
    const linked = items.find((c) => c.url) ?? items.find((c) => c.title) ?? items[0];
    return {
      quote,
      title: linked.title ?? null,
      url: linked.url ?? null,
      date: items.map((c) => c.date).sort()[0],
      count: items.length,
    };
  });
}
