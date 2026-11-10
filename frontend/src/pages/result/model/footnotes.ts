import type { Argument, EvidenceRef } from "@/shared/api";

import { yearSpan } from "./labels";

// 각주 모으기: 카드에 온 대표 근거들(수요표 순서)의 각주를 한 줄씩. 각주 문자열은 근거 상세 API 가 만든다(FR-E4)

/** 카드 각주를 만들 근거(수요표 순서 · 중복 없이) */
export function cardRefs(argument: Argument) {
  const seen = new Set<string>();
  return argument.evidence_table
    .flatMap((row) => argument.data[row.kind])
    .filter((ref) => !seen.has(ref.evidence_id) && seen.add(ref.evidence_id));
}

/**
 * 근거 상세를 못 받았을 때 목록 값으로 만든 각주(출처 · 자료명 · 기간 · 등급).
 * URL · 조회일은 상세에만 있어 빠진다
 */
export function fallbackFootnote(ref: EvidenceRef) {
  return [
    ref.source_name,
    ref.title,
    yearSpan(ref.period_start, ref.period_end),
    `출처 등급 ${ref.source_grade}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 각주 줄들을 하나로. 받은 각주가 없으면 목록 값으로 */
export function joinFootnotes(refs: EvidenceRef[], footnotes: (string | null)[]) {
  return refs.map((ref, i) => footnotes[i] ?? fallbackFootnote(ref)).join("\n");
}
