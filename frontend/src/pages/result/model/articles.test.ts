import { describe, expect, it } from "vitest";

import { type Argument, argumentSchema } from "@/shared/api";

import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import { approxLabel, articleMarks } from "./articles";

const ready = argumentSchema.parse(readyJson);

// 계약 예시에는 기사가 없어(dev 실제 실행에는 있음) 기사 · 기사 건수 줄만 얹어 본다
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
    expect(dots.map((d) => d.id)).toEqual(["n1", "n2"]);
    expect(dots[0].name).toBe("2023-01-27 · 요약 n1");
    expect(groups.map((g) => [g.area, g.count, g.name])).toEqual([
      ["여수시", 2, "위치 근사 · 여수시 중심 2건"],
      // 기사 건수 줄에 이름이 없는 지역
      ["행정구역", 1, "위치 근사 · 행정구역 중심 1건"],
    ]);
  });

  it("기사가 없으면 아무것도 그리지 않는다", () => {
    expect(articleMarks(ready)).toEqual({ dots: [], groups: [] });
    expect(approxLabel({ area: "만덕동", count: 7 })).toBe("위치 근사 · 만덕동 중심 7건");
  });
});
