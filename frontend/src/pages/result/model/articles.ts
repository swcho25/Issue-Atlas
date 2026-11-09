import type { Argument, ArgumentArticle } from "@/shared/api";

// 04 변화형 위 기사 점(Figma 「결과 · 변화형 · 청년 유출」): 근거 기사(articles[])를 지도에 놓는다.
// 주소 · 정확한 위치는 점 하나씩, 위치 근사(admin_centroid — 행정구역 중심, 11/01 대표 결정 #6)는 같은 자리끼리 묶어 원 하나와 건수로.
// 위치가 없는 기사(none · point 없음)는 그리지 않는다

export type ArticleDot = { id: string; at: [number, number]; name: string };
export type ApproxGroup = {
  key: string;
  at: [number, number];
  area: string;
  count: number;
  name: string;
};

/** 점 이름(낭독기 · 툴팁): 「2023-01-27 · 여수시가 청년행복도시 …」 */
const articleName = (a: ArgumentArticle) => [a.date, a.summary].filter(Boolean).join(" · ");

const pointOf = (a: ArgumentArticle): [number, number] | null =>
  a.point && a.point[0] != null && a.point[1] != null ? [a.point[0], a.point[1]] : null;

/**
 * 기사 점과 위치 근사 묶음. 묶음의 지역 이름은 같은 자리의 기사 건수 줄(series 의 tag 모양, 지역마다 한 줄) 이름에서,
 * 없으면 「행정구역」
 */
export function articleMarks(a: Argument): { dots: ArticleDot[]; groups: ApproxGroup[] } {
  const areaName = new Map<string, string>();
  for (const s of a.series) if ("tag" in s && s.name) areaName.set(s.place_id, s.name);

  const dots: ArticleDot[] = [];
  const groups = new Map<string, ApproxGroup>();
  for (const article of a.articles) {
    const at = pointOf(article);
    if (!at) continue;
    if (article.precision === "exact" || article.precision === "address") {
      dots.push({ id: article.id, at, name: articleName(article) });
    } else if (article.precision === "admin_centroid") {
      // 같은 행정구역 중심은 같은 좌표다. 소수 다섯째 자리(약 1m)까지 같으면 한 자리로 본다
      const key = at.map((v) => v.toFixed(5)).join(",");
      const group = groups.get(key);
      if (group) group.count += 1;
      else {
        const area = areaName.get(article.place_id) ?? "행정구역";
        groups.set(key, { key, at, area, count: 1, name: "" });
      }
    }
  }
  return {
    dots,
    groups: [...groups.values()].map((g) => ({ ...g, name: approxLabel(g) })),
  };
}

/** 묶음 이름표: 「위치 근사 · 여수시 중심 3건」 */
export const approxLabel = (g: Pick<ApproxGroup, "area" | "count">) =>
  `위치 근사 · ${g.area} 중심 ${g.count}건`;
