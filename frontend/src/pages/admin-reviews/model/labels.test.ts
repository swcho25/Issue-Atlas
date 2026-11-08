import { describe, expect, it } from "vitest";

import { dateTime, flatValues, targetMeta, targetTitle } from "./labels";

describe("flatValues", () => {
  it("한 단계 아래 객체는 「부모.칸」 으로 펼치고, 글자 목록은 · 로 잇는다", () => {
    expect(
      flatValues({
        title: "광주 사회안전망 더 촘촘해진다",
        document: { publisher: "광주광역시", categories: ["안전", "복지"] },
        department: null,
      }),
    ).toEqual([
      ["title", "광주 사회안전망 더 촘촘해진다"],
      ["document.publisher", "광주광역시"],
      ["document.categories", "안전 · 복지"],
      ["department", "—"],
    ]);
  });

  it("같은 순간의 시각은 표기(+00:00 · Z)가 달라도 같은 한국 시간 글자가 된다", () => {
    const [a] = flatValues({ collected_at: "2026-10-30T02:36:44+00:00" });
    const [b] = flatValues({ collected_at: "2026-10-30T02:36:44Z" });
    expect(a[1]).toBe("2026-10-30 11:36");
    expect(b[1]).toBe(a[1]);
  });

  it("카드는 초안 전체 대신 요점 칸만", () => {
    const rows = flatValues(
      {
        draft_revision: 2,
        current_version: null,
        draft_spec: { name: "청년 유출·정착", rule: {} },
      },
      "card",
    );
    expect(rows.map(([k]) => k)).toEqual([
      "draft_revision",
      "current_version",
      "draft_spec.name",
      "draft_spec.domain",
      "draft_spec.parent_question",
    ]);
    expect(rows[2][1]).toBe("청년 유출·정착");
  });
});

describe("targetTitle · targetMeta", () => {
  it("대상 종류마다 알아볼 이름을 고르고, 없으면 대상 ID", () => {
    expect(targetTitle("news_event", "n1", { summary: "초미세먼지 역대 최저" })).toBe(
      "초미세먼지 역대 최저",
    );
    expect(
      targetTitle("normalized_record", "77618", { document: { title: "보도자료 제목" } }),
    ).toBe("보도자료 제목");
    expect(targetTitle("source", "S01", { name: "KOSIS 인구이동" })).toBe("KOSIS 인구이동");
    expect(targetTitle("card", "C1", { draft_spec: { name: "청년 유출·정착" } })).toBe(
      "청년 유출·정착",
    );
    expect(targetTitle("normalized_record", "1", {})).toBe("1");
  });

  it("제목 아래 줄: 종류 · 지역이나 기관(출처 · 카드는 ID) · 날짜", () => {
    expect(
      targetMeta("news_event", "n1", {
        place_name: "광주(5개 구)",
        event_start: "2023-01-23T15:00:00+00:00",
      }),
    ).toBe("기사 · 광주(5개 구) · 2023-01-24");
    expect(targetMeta("source", "S01", { org: "KOSIS" })).toBe("출처 · S01");
  });

  it("dateTime 은 한국 시간", () => {
    expect(dateTime("2026-11-03T07:02:15.188659Z")).toBe("2026-11-03 16:02");
  });
});
