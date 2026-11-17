import type { Argument, ArgumentArticle } from "@/shared/api";

import { monthOf } from "./timeline";

// 04 변화형 위 기사 점(Figma 「결과 · 변화형 · 청년 유출」): 근거 기사(articles[])를 지도에 놓는다.
// 주소 · 정확한 위치는 점으로 — 같은 자리(같은 주소) 기사는 점 하나에 모아 건수를 단다(겹쳐 놓으면 맨 위 하나만 눌린다:
// 여수 C1 11/06 실행은 주소 기사 17건이 4곳뿐, 박람회장 7 · 시청 6 · 여수산단 3).
// 위치 근사(admin_centroid — 행정구역 중심, 11/01 대표 결정 #6)는 같은 자리끼리 묶어 원 하나와 건수로.
// 위치가 없는 기사(none · point 없음)는 그리지 않는다

export type ArticleDot = {
  /** 자리 키(좌표 소수 다섯째 자리) */
  key: string;
  at: [number, number];
  /** 점 이름(낭독기 · 툴팁): 하나면 「날짜 · 요약」, 여럿이면 「장소 · 기사 N건」 */
  name: string;
  /** 이 자리의 기사 id(하나면 기사 창, 여럿이면 목록 창) */
  ids: string[];
  /** 그 기사들의 날짜(ids 와 같은 순서) — 고른 달 기사가 없는 자리는 흐리게 */
  dates: (string | null)[];
  /** 장소 이름(기사의 place_name) */
  place: string | null;
};
export type ApproxGroup = {
  key: string;
  at: [number, number];
  area: string;
  count: number;
  name: string;
  /** 묶음에 든 기사 id(누르면 목록 창) */
  ids: string[];
  /** 그 기사들의 날짜(ids 와 같은 순서) */
  dates: (string | null)[];
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

  const dots = new Map<string, ArticleDot & { first: ArgumentArticle }>();
  const groups = new Map<string, ApproxGroup>();
  for (const article of a.articles) {
    const at = pointOf(article);
    if (!at) continue;
    // 소수 다섯째 자리(약 1m)까지 같으면 한 자리로 본다
    const key = at.map((v) => v.toFixed(5)).join(",");
    if (article.precision === "exact" || article.precision === "address") {
      const dot = dots.get(key);
      if (dot) {
        dot.ids.push(article.id);
        dot.dates.push(article.date);
      } else
        dots.set(key, {
          key,
          at,
          name: "",
          ids: [article.id],
          dates: [article.date],
          place: article.place_name,
          first: article,
        });
    } else if (article.precision === "admin_centroid") {
      // 같은 행정구역 중심은 같은 좌표다
      const group = groups.get(key);
      if (group) {
        group.count += 1;
        group.ids.push(article.id);
        group.dates.push(article.date);
      } else {
        const area = areaName.get(article.place_id) ?? "행정구역";
        groups.set(key, {
          key,
          at,
          area,
          count: 1,
          name: "",
          ids: [article.id],
          dates: [article.date],
        });
      }
    }
  }
  return {
    dots: [...dots.values()].map(({ first, ...d }) => ({
      ...d,
      name: d.ids.length === 1 ? articleName(first) : stackLabel(d),
    })),
    groups: [...groups.values()].map((g) => ({ ...g, name: approxLabel(g) })),
  };
}

/**
 * 고른 달까지 나온 기사가 하나라도 있는 자리인가 — 그 달 뒤에만 나온 자리는 흐리게 한다.
 * 명세 7절은 「고른 달은 진하게, 다른 달은 흐린 점」 인데, 한 달에 기사가 몇 건뿐이라 처음 화면(마지막 달)에서
 * 점이 거의 다 흐려 안 보였다 → 관측 순서처럼 「슬라이더 달까지」 로 쌓는다(처음 화면은 모두 진하다).
 * 날짜를 모르는 기사는 흐리게 하지 않는다
 */
export const markUpToMonth = (mark: { dates: (string | null)[] }, month: string) =>
  mark.dates.some((d) => !d || d.slice(0, 7) <= month);

/** 고른 달 뒤에만 나온 자리가 있는가(범례의 흐린 점 줄을 보일지) */
export const hasLaterMarks = (marks: { dates: (string | null)[] }[], month: string | null) =>
  month !== null && marks.some((m) => !markUpToMonth(m, month));

/** 같은 자리 점 이름: 「여수세계박람회장 · 기사 7건」 */
export const stackLabel = (d: Pick<ArticleDot, "place" | "ids">) =>
  `${d.place ?? "같은 자리"} · 기사 ${d.ids.length}건`;

/** 묶음 이름표: 「위치 근사 · 여수시 중심 3건」 */
export const approxLabel = (g: Pick<ApproxGroup, "area" | "count">) =>
  `위치 근사 · ${g.area} 중심 ${g.count}건`;
