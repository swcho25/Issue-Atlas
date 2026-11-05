import { z } from "zod";

// contracts/c2/schemas/common.schema.json(C2 공통 정의 v0.1) 을 Zod 로 옮긴 것. 값이 다르면 계약 파일이 맞다
export const schemaVersion = z.literal("c2-0.1");
export const id = z.string().min(1);
export const date = z.iso.date();
// 계약 예시가 +09:00 처럼 시간대를 붙여 보낸다
export const dateTime = z.iso.datetime({ offset: true });
export const textOrNull = z.string().nullable();

export const evidenceStatus = z.enum([
  "available",
  "not_published",
  "not_collected",
  "license_blocked",
  "review_pending",
]);
export const runStatus = z.enum(["ready", "partial", "blocked", "unsupported"]);
export const evidenceKind = z.enum([
  "statistics",
  "documents",
  "existing_responses",
  "denominators",
]);
export const claimValue = z.enum([
  "observed",
  "increasing",
  "decreasing",
  "unclear",
  "insufficient",
  "not_comparable",
]);
export const claimLevel = z.enum([
  "observed_fact",
  "calculated",
  "associated",
  "insufficient_evidence",
]);
/** 누가 채웠나: 규칙 · 카드 · AI 문장화 · AI 판단 · 사람 검수 */
export const provenance = z.enum(["rule", "card", "llm_phrasing", "llm_judgment", "human"]);
export const ruleProvenance = z.enum(["rule", "card"]);
export const qualifierGrade = z.enum(["high", "medium", "low"]);
export const rebuttalStatus = z.enum(["supported", "not_found", "needs_review"]);
export const sourceGrade = z.enum(["A", "B", "C"]);
export const storageScope = z.enum(["full", "metadata", "link_only"]);
export const locationPrecision = z.enum(["exact", "address", "admin_centroid", "none"]);

export const evidenceRef = z.object({
  evidence_id: id,
  title: z.string(),
  source_name: z.string(),
  source_grade: sourceGrade,
  period_start: date.nullable(),
  period_end: date.nullable(),
  storage_scope: storageScope,
});

export type EvidenceStatus = z.infer<typeof evidenceStatus>;
export type RunStatus = z.infer<typeof runStatus>;
export type EvidenceKind = z.infer<typeof evidenceKind>;
export type ClaimValue = z.infer<typeof claimValue>;
export type Provenance = z.infer<typeof provenance>;
export type EvidenceRef = z.infer<typeof evidenceRef>;
export type StorageScope = z.infer<typeof storageScope>;
