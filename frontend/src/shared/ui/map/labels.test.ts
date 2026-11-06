import { describe, expect, it } from "vitest";

import { groupName, labelPoint } from "./labels";

// 가로 w · 세로 h 네모 고리(닫힌 고리라 처음 점으로 끝난다)
const box = (x: number, y: number, w: number, h: number) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
  [x, y],
];

const feature = (polygons: number[][][]) =>
  ({
    type: "Feature",
    id: "kr-12130",
    geometry: { type: "MultiPolygon", coordinates: polygons.map((ring) => [ring]) },
    properties: {
      place_id: "kr-12130",
      name: "여수시",
      level: "sigungu",
      parent_id: "kr-46",
      source: "sgis_hadmarea",
      source_year: 2025,
    },
  }) as Parameters<typeof labelPoint>[0];

describe("labelPoint", () => {
  it("한 조각이면 그 무게중심", () => {
    const [x, y] = labelPoint(feature([box(127, 34, 0.4, 0.2)]));
    expect(x).toBeCloseTo(127.2);
    expect(y).toBeCloseTo(34.1);
  });

  it("섬이 여럿이면 가장 넓은 조각(본토)에만 단다", () => {
    const [x, y] = labelPoint(
      feature([
        box(127.9, 34.0, 0.02, 0.02),
        box(127, 34.5, 0.4, 0.4),
        box(127.6, 33.9, 0.05, 0.05),
      ]),
    );
    expect(x).toBeCloseTo(127.2);
    expect(y).toBeCloseTo(34.7);
  });
});

describe("groupName", () => {
  it("같은 시의 구들은 「광주 5개 구」", () => {
    expect(groupName(["광주 동구", "광주 서구", "광주 남구", "광주 북구", "광주 광산구"])).toBe(
      "광주 5개 구",
    );
  });

  it("끝 글자가 섞이면(시 · 군) 「곳」", () => {
    expect(groupName(["전남 여수시", "전남 담양군"])).toBe("전남 2곳");
  });

  it("앞 낱말이 다르거나 한 낱말 이름이거나 하나뿐이면 묶지 않는다", () => {
    expect(groupName(["광주 동구", "부산 동구"])).toBeNull();
    expect(groupName(["여수시", "순천시"])).toBeNull();
    expect(groupName(["광주 동구"])).toBeNull();
  });
});
