import { describe, expect, it } from "vitest";

import c1 from "../../../../../contracts/cards/C1.json";
import type { Source } from "@/shared/api";

import { ruleOutcomes, specClaim, specEvidence, specName, specState } from "./spec";

// C1 설계도(contracts/cards/C1.json)는 초안(draft_spec)과 같은 칸 이름을 쓴다
const spec = c1 as unknown as Record<string, unknown>;

const sources: Source[] = [
  {
    source_id: "S01",
    name: "KOSIS 인구이동",
    org: "KOSIS",
    license_type: "KOSIS-활용약관",
    storage_scope: "full",
    source_grade: "A",
    specs: [
      {
        spec_id: "SP01",
        method: "api",
        evidence_kind: "statistics",
        last_success_at: "2026-10-30T02:33:31Z",
      },
      { spec_id: "SP10", method: "api", evidence_kind: "denominators", last_success_at: null },
    ],
  },
];

describe("카드 초안 읽기", () => {
  it("이름 · 판단 문장 · 보증 · 경쟁 설명 · 지표를 꺼낸다", () => {
    expect(specName(spec)).toBe("청년 유출·정착");
    const c = specClaim(spec);
    expect(c.template).toContain("{판정값}");
    expect(c.rebuttals.length).toBeGreaterThanOrEqual(2);
    expect(c.indicators.find((x) => x.role === "main")?.id).toBe("population_net_migration_19_39");
  });

  it("결과별 문장: 규칙 결과마다 이름과 claim_text, 문장이 없으면 판단 틀에 결과 이름, 근거 부족은 문장 없음", () => {
    const template = specClaim(spec).template;
    const outcomes = ruleOutcomes(spec.rule, template);
    expect(outcomes.map((o) => o.label)).toEqual([
      "근거 부족",
      "청년 순유출 확대",
      "청년 순유출 축소",
      "순유입 전환",
      "불분명",
    ]);
    expect(outcomes[1].text).toBe(
      "{지역} 청년(19–39세) 순유출은 {첫해}년 {첫값}명에서 {끝해}년 {끝값}명으로 매년 커졌습니다.",
    );
    expect(outcomes[0].text).toBeNull();
    // v3 전 규칙(결과 문장 없음)은 판단 틀로 채운다
    expect(ruleOutcomes({ outcomes: [{ label: "불분명", claim: "unclear" }] }, template)).toEqual([
      { label: "불분명", text: template?.replace("{판정값}", "불분명") },
    ]);
    expect(ruleOutcomes(null, template)).toEqual([]);
    expect(ruleOutcomes({ outcomes: [{ label: "불분명" }] }, null)).toEqual([
      { label: "불분명", text: null },
    ]);
  });

  it("근거 4종은 정해진 순서로, 필수 여부와 함께", () => {
    const ev = specEvidence(spec);
    expect(ev.map((g) => g.kind)).toEqual([
      "statistics",
      "documents",
      "existing_responses",
      "denominators",
    ]);
    expect(ev[0]).toMatchObject({ required: true });
    expect(ev[0].items[0]).toMatchObject({ specId: "SP01" });
  });

  it("미완성 초안(칸 없음 · 모양 다름)도 빈 값으로 읽는다", () => {
    const bare = { name: "  ", evidence: { statistics: "x" }, rebuttals: [] };
    expect(specName(bare)).toBeNull();
    expect(specClaim(bare)).toMatchObject({ template: null, rebuttals: [], indicators: [] });
    expect(specEvidence(bare).every((g) => g.items.length === 0)).toBe(true);
  });

  it("명세 상태: 마지막 성공이 있으면 확보, 없으면 미수집, 출처에 없으면 등록 안 됨", () => {
    expect(specState("SP01", sources).state).toBe("available");
    expect(specState("SP10", sources).state).toBe("not_collected");
    expect(specState("SP99", sources).state).toBe("unknown");
    expect(specState(null, sources).state).toBe("no_source");
  });
});
