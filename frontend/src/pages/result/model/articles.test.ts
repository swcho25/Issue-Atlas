import { describe, expect, it } from "vitest";

import { type Argument, argumentSchema } from "@/shared/api";

import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import { approxLabel, articleMarks, markInMonth } from "./articles";

const ready = argumentSchema.parse(readyJson);

// 규칙은 기사 · 기사 건수 줄을 직접 만들어 본다(계약 예시의 기사는 아래 「계약 예시」 에서)
const article = (
  id: string,
  precision: Argument["articles"][number]["precision"],
  point: [number, number] | null,
  place_id = "kr-12130",
) => ({
  id,
  date: "2023-01-27",
  place_id,
  point,
  precision,
  summary: `요약 ${id}`,
  place_name: null,
  url: null,
});
const countLine = (place_id: string, name: string) => ({
  tag: "C1",
  place_id,
  name,
  coordinates: null,
  unit: "건",
  periods: ["2023-01"],
  values: [1],
  statuses: ["available" as const],
});

describe("기사 점", () => {
  it("주소 · 정확한 위치는 점, 위치 근사는 같은 자리끼리 묶고, 위치 없는 기사는 뺀다", () => {
    const a = {
      ...ready,
      series: [...ready.series, countLine("kr-12130", "여수시")],
      articles: [
        article("n1", "address", [127.66, 34.76]),
        article("n2", "exact", [127.7, 34.75]),
        article("n3", "admin_centroid", [127.662203, 34.760374]),
        article("n4", "admin_centroid", [127.662203, 34.760374]),
        article("n5", "admin_centroid", [127.7, 34.8], "kr-12130-510"),
        article("n6", "none", null),
      ],
    } as Argument;
    const { dots, groups } = articleMarks(a);
    expect(dots.map((d) => d.ids)).toEqual([["n1"], ["n2"]]);
    expect(dots[0].name).toBe("2023-01-27 · 요약 n1");
    expect(groups.map((g) => [g.area, g.count, g.name])).toEqual([
      ["여수시", 2, "위치 근사 · 여수시 중심 2건"],
      // 기사 건수 줄에 이름이 없는 지역
      ["행정구역", 1, "위치 근사 · 행정구역 중심 1건"],
    ]);
    // 묶음을 누르면 목록 창 — 묶음에 든 기사 id
    expect(groups.map((g) => g.ids)).toEqual([["n3", "n4"], ["n5"]]);
  });

  it("같은 주소의 기사는 점 하나에 모은다(겹쳐 놓으면 맨 위 하나만 눌린다 — 여수 C1 실제: 17건이 4곳)", () => {
    const a = {
      ...ready,
      articles: [
        { ...article("e1", "address", [127.747131, 34.750901]), place_name: "여수세계박람회장" },
        { ...article("e2", "address", [127.747132, 34.750902]), place_name: "여수세계박람회장" },
        { ...article("e3", "address", [127.747131, 34.750901]), place_name: "여수세계박람회장" },
        { ...article("s1", "address", [127.661524, 34.760494]), place_name: "여수시청" },
      ],
    } as Argument;
    const { dots } = articleMarks(a);
    expect(dots.map((d) => [d.ids, d.name])).toEqual([
      [["e1", "e2", "e3"], "여수세계박람회장 · 기사 3건"],
      [["s1"], "2023-01-27 · 요약 s1"],
    ]);
  });

  it("고른 달의 기사가 하나라도 있는 자리만 진하게(다른 달은 흐리게), 날짜를 모르면 흐리게 하지 않는다", () => {
    const a = {
      ...ready,
      articles: [
        { ...article("e1", "address", [127.747131, 34.750901]), date: "2023-01-27" },
        { ...article("e2", "address", [127.747131, 34.750901]), date: "2024-06-03" },
        { ...article("s1", "address", [127.661524, 34.760494]), date: "2023-02-10" },
        { ...article("g1", "admin_centroid", [127.662203, 34.760374]), date: "2024-06-30" },
      ],
    } as Argument;
    const { dots, groups } = articleMarks(a);
    expect(dots.map((d) => d.dates)).toEqual([["2023-01-27", "2024-06-03"], ["2023-02-10"]]);
    // 같은 자리 두 건 중 하나가 2024-06 → 진하게, 2023-02 한 건뿐인 자리는 흐리게
    expect(dots.map((d) => markInMonth(d, "2024-06"))).toEqual([true, false]);
    expect(markInMonth(groups[0], "2024-06")).toBe(true);
    expect(markInMonth(groups[0], "2024-07")).toBe(false);
    expect(markInMonth({ dates: [null] }, "2024-06")).toBe(true);
  });

  it("계약 예시(여수 C1): 같은 자리 2건 · 한 건 · 위치 근사 묶음 셋, 위치 없는 기사는 빠진다", () => {
    const { dots, groups } = articleMarks(ready);
    expect(dots.map((d) => [d.place, d.ids.length, d.name])).toEqual([
      ["여수시청", 2, "여수시청 · 기사 2건"],
      ["여수세계박람회장", 1, "2024-03-05 · 여수세계박람회장에서 청년 취업 박람회가 열렸다."],
    ]);
    expect(groups.map((g) => g.name)).toEqual([
      "위치 근사 · 여수시 중심 2건",
      "위치 근사 · 쌍봉동 중심 1건",
      "위치 근사 · 만덕동 중심 1건",
    ]);
    // 8건 중 지도에 놓이는 것은 7건(위치 없음 1건)
    const placed = [...dots, ...groups].reduce((n, m) => n + m.ids.length, 0);
    expect([ready.articles.length, placed]).toEqual([8, 7]);
  });

  it("기사가 없으면 아무것도 그리지 않는다", () => {
    expect(articleMarks({ ...ready, articles: [] })).toEqual({ dots: [], groups: [] });
    expect(approxLabel({ area: "만덕동", count: 7 })).toBe("위치 근사 · 만덕동 중심 7건");
  });
});
