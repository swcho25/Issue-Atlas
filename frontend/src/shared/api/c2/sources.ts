import { z } from "zod";

import { dateTime, evidenceKind, id, schemaVersion, sourceGrade, storageScope } from "./common";

// GET /v1/sources 응답(contracts/c2/schemas/source-list.schema.json, c2-0.1).
// 출처마다 등급 · 이용 조건 · 저장 범위, 수집 명세마다 마지막 성공 시각(한 번도 없으면 null)
const spec = z.object({
  spec_id: id,
  method: z.enum(["api", "file", "board", "rss"]),
  evidence_kind: evidenceKind,
  last_success_at: dateTime.nullable(),
});

const source = z.object({
  source_id: id,
  name: z.string(),
  org: z.string(),
  license_type: z.string(),
  storage_scope: storageScope,
  source_grade: sourceGrade.nullable(),
  specs: z.array(spec),
});

export const sourceListSchema = z.object({
  schema_version: schemaVersion,
  sources: z.array(source),
});
export type Source = z.infer<typeof source>;
export type SourceSpec = z.infer<typeof spec>;
