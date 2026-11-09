import { describe, expect, it } from "vitest";

import { argumentSchema } from "@/shared/api";

import a3Json from "../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import unsupportedJson from "../../../../../contracts/c2/examples/argument-unsupported.json";
import {
  articleRef,
  emptyRefsText,
  kindCount,
  pickEvidence,
  refsTitle,
  sourcesTotal,
} from "./sources";

const ready = argumentSchema.parse(readyJson);
const a3 = argumentSchema.parse(a3Json);
const unsupported = argumentSchema.parse(unsupportedJson);
const row = (a: typeof ready, kind: string) => a.evidence_table.find((r) => r.kind === kind)!;

describe("근거 건수", () => {
  it("건수는 수요표의 전체 건수다(목록에는 대표 자료만 온다)", () => {
    // 계약 예시: 기사 count 12 · 목록 1
    expect(kindCount(ready, row(ready, "documents"))).toBe(12);
    expect(sourcesTotal(ready)).toBe(16);
    // A3: 기사 확보 5 · 목록 0
    expect(kindCount(a3, row(a3, "documents"))).toBe(5);
  });

  it("기사는 기사 · 보도 묶음에 들어가되 count 와 겹쳐 세지 않는다", () => {
    const article = (i: number) => ({
      id: `a${i}`,
      date: "2025-01-01",
      place_id: ready.question.place_id,
      point: null,
      precision: "none" as const,
      summary: null,
      place_name: null,
      url: null,
    });
    // count 12 에 기사 2건 + 목록 1건 → 그대로 12
    expect(
      kindCount({ ...ready, articles: [article(1), article(2)] }, row(ready, "documents")),
    ).toBe(12);
    // count 0 이어도 기사가 3건 오면 3
    expect(
      kindCount(
        { ...unsupported, articles: [article(1), article(2), article(3)] },
        row(unsupported, "documents"),
      ),
    ).toBe(3);
  });

  it("대표 자료 제목에 나머지 건수를 붙인다", () => {
    const first = ready.data.documents[0];
    expect(refsTitle(first, 12)).toBe(`${first.title} 외 11건`);
    expect(refsTitle(first, 1)).toBe(first.title);
  });

  it("대표 자료가 없으면 건수 · 사유 · 상태 순으로 말한다", () => {
    expect(emptyRefsText(row(a3, "documents"), 5)).toBe("자료 5건 · 목록 없음");
    expect(emptyRefsText(row(a3, "denominators"), 0)).toBe(row(a3, "denominators").reason);
    expect(emptyRefsText({ ...row(a3, "documents"), reason: null }, 0)).toBe("—");
    expect(emptyRefsText({ ...row(a3, "denominators"), reason: null }, 0)).toBe("미수집");
  });
});

describe("pickEvidence", () => {
  it("?e= 가 목록에 있으면 그 근거, 없거나 모르면 첫 근거", () => {
    expect(pickEvidence(ready, "ev_policy_yeosu_youth_2025")?.evidence_id).toBe(
      "ev_policy_yeosu_youth_2025",
    );
    expect(pickEvidence(ready, "nope")?.evidence_id).toBe("ev_kosis_net_yeosu");
    expect(pickEvidence(ready, undefined)?.evidence_id).toBe("ev_kosis_net_yeosu");
  });

  it("?e= 가 여럿이면 첫 값을 쓴다", () => {
    expect(pickEvidence(ready, ["ev_kosis_pop_yeosu", "ev_kosis_net_yeosu"])?.evidence_id).toBe(
      "ev_kosis_pop_yeosu",
    );
  });

  it("문서 근거가 있는 기사도 ?e= 로 고를 수 있고, 근거가 없는 기사는 고르지 않는다", () => {
    const base = {
      date: "2025-01-01",
      place_id: ready.question.place_id,
      point: null,
      precision: "none" as const,
      summary: "청년 정착 기사",
      place_name: null,
      url: null,
    };
    const withArticles = {
      ...ready,
      articles: [
        { ...base, id: "a1", evidence_id: "ev_news_a1", source_grade: "C" as const },
        { ...base, id: "a2" },
      ],
    };
    expect(pickEvidence(withArticles, "ev_news_a1")).toMatchObject({
      evidence_id: "ev_news_a1",
      title: "청년 정착 기사",
      source_grade: "C",
      storage_scope: "metadata",
    });
    expect(articleRef(withArticles.articles[1])).toBeNull();
  });

  it("근거가 하나도 없으면 null", () => {
    expect(pickEvidence(unsupported, undefined)).toBeNull();
  });
});
