import { describe, expect, it } from "vitest";

import { candidateName, readIssue, readPeriod, readPlace } from "./interpret";
import type { IssueCard, Place } from "./schema";

const place = (place_id: string, name: string, parent_id: string): Place => ({
  place_id,
  name,
  level: "sigungu",
  parent_id,
});
const PLACES = [
  place("kr-12210", "광주 동구", "kr-29"),
  place("kr-12240", "광주 서구", "kr-29"),
  place("kr-12270", "광주 남구", "kr-29"),
  place("kr-12300", "광주 북구", "kr-29"),
  place("kr-12330", "광주 광산구", "kr-29"),
  place("kr-12130", "여수시", "kr-46"),
];

const card = (card_id: string, name: string, domain: string, available_kinds = 2): IssueCard => ({
  card_id,
  name,
  domain,
  parent_question: "",
  card_version: 1,
  evidence: [],
  available_kinds,
  review_pending_count: 0,
});
const CARDS = [
  card("A3", "대기질", "A 환경·기후"),
  card("C1", "청년 유출·정착", "C 인구·지역소멸"),
  card("C2", "고령화", "C 인구·지역소멸", 3),
];

describe("readPlace — 지명 사전", () => {
  it.each([
    ["여수 청년은 어디로 떠나고 있나", "kr-12130"],
    ["여수시 미세먼지", "kr-12130"],
    ["광주 광산구 대기질", "kr-12330"],
    ["광주동구 청년", "kr-12210"],
    ["광산구 고령화는?", "kr-12330"],
  ])("「%s」 → %s", (text, id) => {
    expect(readPlace(text, PLACES).placeId).toBe(id);
  });

  it("「광주」 만 있으면 정하지 않고 광주 구 다섯 곳을 후보로", () => {
    const r = readPlace("광주 청년은 떠나고 있나", PLACES);
    expect(r.placeId).toBeUndefined();
    expect(r.options).toHaveLength(5);
  });

  it("지명이 없으면 비워 둔다", () => {
    expect(readPlace("청년은 어디로 떠나나", PLACES)).toEqual({ options: [] });
  });
});

describe("readPeriod — 기간 표현", () => {
  it("기간이 없으면 자료 범위 전체(2023–2025)로 채우고 그렇다고 표시", () => {
    expect(readPeriod("여수 청년")).toMatchObject({ defaulted: true, period: { id: "2023-2025" } });
  });

  it.each([
    ["2024년 여수 대기질", "2024-2024", "2024-01-01", "2025-01-01"],
    ["2023~2024 청년", "2023-2024", "2023-01-01", "2025-01-01"],
    ["2024년부터 2025년까지", "2024-2025", "2024-01-01", "2026-01-01"],
    ["최근 2년 미세먼지", "2024-2025", "2024-01-01", "2026-01-01"],
    ["작년 대기질", "2025-2025", "2025-01-01", "2026-01-01"],
  ])("「%s」 → %s", (text, id, start, end) => {
    expect(readPeriod(text)).toMatchObject({ defaulted: false, period: { id, start, end } });
  });

  it("자료 밖 해는 자료 범위로 줄이고 줄였다고 표시", () => {
    expect(readPeriod("2020~2025 청년")).toMatchObject({
      clamped: true,
      period: { id: "2023-2025" },
    });
  });
});

describe("readIssue — 이슈 키워드", () => {
  it.each([
    ["여수 청년은 어디로 떠나고 있나", "C1"],
    ["젊은 사람들이 빠져나가는지", "C1"],
    ["광산구 미세먼지 심해졌나", "A3"],
    ["어르신이 늘었나", "C2"],
  ])("「%s」 → %s", (text, id) => {
    expect(readIssue(text, CARDS).best?.card_id).toBe(id);
  });

  it("인구 영역 낱말만 걸리면 같은 영역의 다른 이슈가 「다른 이슈일 수도」", () => {
    const r = readIssue("여수 청년 인구", CARDS);
    expect(r.best?.card_id).toBe("C1");
    expect(r.others.map((c) => c.card_id)).toEqual(["C2"]);
  });

  it("「청년」 하나만 걸리면 그 이슈로 정하지 않고(새 이슈 후보로) 다른 이슈로만 보여 준다", () => {
    const r = readIssue("여수 청년 주거비 부담", CARDS);
    expect(r.best).toBeUndefined();
    expect(r.others.map((c) => c.card_id)).toEqual(["C1"]);
  });
});

describe("candidateName — 새 이슈 후보 이름", () => {
  it("지역 · 기간 · 물음 꼬리를 뺀다", () => {
    expect(candidateName("여수 청년 주거비 부담은 어떤가요?", "여수")).toBe("청년 주거비 부담");
    expect(candidateName("2024년 여수시 관광객 수는 어떻게 변했나", "여수")).toBe("관광객 수");
  });
});
