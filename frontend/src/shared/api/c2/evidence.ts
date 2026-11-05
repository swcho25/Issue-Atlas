import { z } from "zod";

import {
  date,
  dateTime,
  evidenceKind,
  id,
  locationPrecision,
  schemaVersion,
  sourceGrade,
  storageScope,
} from "./common";

// GET /v1/evidence/{evidence_id} 응답 — 근거 상세(contracts/c2/schemas/evidence.schema.json, c2-0.1).
// 05 원문 탭의 읽기 칸과 각주 복사가 쓴다. 각주 문자열은 서버가 만든다(출처명 · 자료명 · 시점 · 등급 · URL · 조회일, FR-E4)
const evidenceObject = z.object({
  schema_version: schemaVersion,
  evidence_id: id,
  kind: evidenceKind,
  title: z.string(),
  source_name: z.string(),
  source_grade: sourceGrade,
  license_type: z.string(),
  storage_scope: storageScope,
  observed_at: dateTime.nullable(),
  period_start: date.nullable(),
  period_end: date.nullable(),
  published_at: dateTime.nullable(),
  collected_at: dateTime,
  location_precision: locationPrecision,
  /** 판단에 쓰인 위치(통계표 칸 · 시트 · 행 · 문장 발췌 위치). 칸 이름은 출처마다 다르다 */
  locator: z.record(z.string(), z.unknown()),
  /** 저장 범위 안에서 보여 줄 내용. link_only 면 null */
  display: z.string().nullable(),
  url: z.url().nullable(),
  footnote: z.string(),
});

// 계약 JSON Schema 의 if/then: 링크만(link_only) 저장하는 자료는 display 가 없다
export const evidenceSchema = evidenceObject.superRefine((e, ctx) => {
  if (e.storage_scope === "link_only" && e.display !== null)
    ctx.addIssue({
      code: "custom",
      path: ["display"],
      message: "storage_scope 가 link_only 면 display 는 null",
    });
});

export type Evidence = z.infer<typeof evidenceSchema>;
