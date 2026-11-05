import { describe, expect, it } from "vitest";

import { argumentSchema } from "@/shared/api";

import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import unsupportedJson from "../../../../../contracts/c2/examples/argument-unsupported.json";
import { cardRefs, fallbackFootnote, joinFootnotes } from "./footnotes";

const ready = argumentSchema.parse(readyJson);

describe("카드 각주", () => {
  it("근거는 수요표 순서로, 같은 근거는 한 번만", () => {
    expect(cardRefs(ready).map((r) => r.evidence_id)).toEqual([
      "ev_kosis_net_yeosu",
      "ev_doc_yeosu_press_0001",
      "ev_policy_yeosu_youth_2025",
      "ev_kosis_pop_yeosu",
    ]);
    const twice = { ...ready, data: { ...ready.data, denominators: ready.data.statistics } };
    expect(cardRefs(twice).map((r) => r.evidence_id)).toEqual([
      "ev_kosis_net_yeosu",
      "ev_doc_yeosu_press_0001",
      "ev_policy_yeosu_youth_2025",
    ]);
    expect(cardRefs(argumentSchema.parse(unsupportedJson))).toEqual([]);
  });

  it("상세를 못 받은 근거는 목록 값(출처 · 자료명 · 기간 · 등급)으로 대신 쓴다", () => {
    const refs = cardRefs(ready).slice(0, 2);
    expect(fallbackFootnote(refs[1])).toBe(
      "여수시 · [보도자료 제목] 청년 정착 지원 확대 · 2025 · 출처 등급 B",
    );
    expect(joinFootnotes(refs, ["KOSIS 각주", null])).toBe(
      "KOSIS 각주\n여수시 · [보도자료 제목] 청년 정착 지원 확대 · 2025 · 출처 등급 B",
    );
  });
});
