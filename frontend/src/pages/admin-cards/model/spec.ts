import type { EvidenceKind, Source } from "@/shared/api";

import type { Spec } from "./schema";

// 카드 초안(draft_spec)에서 화면에 쓸 칸을 꺼낸다. 미완성 초안도 저장되므로 칸이 없거나 모양이 달라도 빈 값으로 읽는다
// (칸 이름은 contracts/cards · c3 「spec 형식」)

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => !!str(x)) : []);

export const specName = (s: Spec) => str(s.name);

/** 판단 문장 · 보증 · 경쟁 설명 · 판단하지 않는 것 · 지표 */
export function specClaim(s: Spec) {
  return {
    domain: str(s.domain),
    parentQuestion: str(s.parent_question),
    template: str(s.claim_template),
    warrant: str(obj(s.warrant).text),
    rebuttals: (Array.isArray(obj(s.rebuttals).items) ? (obj(s.rebuttals).items as unknown[]) : [])
      .map((r) => ({ id: str(obj(r).id), text: str(obj(r).text) }))
      .filter((r): r is { id: string | null; text: string } => !!r.text),
    ceiling: strs(s.ceiling),
    indicators: (Array.isArray(s.claim_items) ? s.claim_items : [])
      .map((c) => ({ role: str(obj(c).role), id: str(obj(c).indicator_id) }))
      .filter((c): c is { role: string | null; id: string } => !!c.id),
  };
}

/** 근거 4종 순서(결과 화면 근거 수요표와 같음) */
export const evidenceKinds: EvidenceKind[] = [
  "statistics",
  "documents",
  "existing_responses",
  "denominators",
];

export type SpecEvidence = {
  kind: EvidenceKind;
  required: boolean;
  items: { specId: string | null; indicatorId: string | null; note: string | null }[];
};

export function specEvidence(s: Spec): SpecEvidence[] {
  const ev = obj(s.evidence);
  const need = obj(s.required_for_claim);
  return evidenceKinds.map((kind) => ({
    kind,
    required: need[kind] === "required",
    items: (Array.isArray(ev[kind]) ? (ev[kind] as unknown[]) : []).map((x) => ({
      specId: str(obj(x).spec_id),
      indicatorId: str(obj(x).indicator_id),
      note: str(obj(x).note),
    })),
  }));
}

export type SpecState = "available" | "not_collected" | "no_source" | "unknown";

/** 수집 명세 하나의 지금 상태: 출처 목록(GET /v1/sources)의 마지막 성공 시각으로 확보 · 미수집을 가른다 */
export function specState(specId: string | null, sources: Source[]) {
  if (!specId) return { state: "no_source" as SpecState, source: null };
  const source = sources.find((src) => src.specs.some((sp) => sp.spec_id === specId)) ?? null;
  if (!source) return { state: "unknown" as SpecState, source: null };
  const spec = source.specs.find((sp) => sp.spec_id === specId);
  return {
    state: (spec?.last_success_at ? "available" : "not_collected") as SpecState,
    source,
  };
}
