import { z } from "zod";

// 관리자 CSV 요청(contracts/csv-imports v0.1). 올리면 서버가 양식을 검증해 보관하고, 담당자가 따로 적재한 뒤 결과를 보고한다.
// completed 는 담당자의 처리 보고일 뿐 API 가 적재를 보증하는 상태가 아니다
const time = z.iso.datetime({ offset: true });

export const importStatuses = [
  "pending",
  "validation_failed",
  "no_changes",
  "completed",
  "failed",
] as const;
export const importStatus = z.enum(importStatuses);
export type ImportStatus = z.infer<typeof importStatus>;

const validationSchema = z.object({
  total_rows: z.number().int(),
  valid_rows: z.number().int(),
  duplicate_rows: z.number().int(),
  eligible_rows: z.number().int(),
  error_count: z.number().int(),
  errors_truncated: z.boolean(),
  /** row 는 머리 줄 = 1 인 CSV 행 번호. 셀 값은 돌려주지 않는다 */
  errors: z.array(
    z.object({ row: z.number().int(), column: z.string().nullable(), code: z.string() }),
  ),
  duplicate_row_numbers: z.array(z.number().int()),
});
export type Validation = z.infer<typeof validationSchema>;

export const importRequestSchema = z.object({
  import_id: z.string(),
  requested_by: z.number().int(),
  assignee_id: z.number().int(),
  file_name: z.string(),
  file_sha256: z.string(),
  template_version: z.string(),
  status: importStatus,
  revision: z.number().int(),
  validation: validationSchema,
  created_at: time,
  updated_at: time,
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

export const importPageSchema = z.object({
  items: z.array(importRequestSchema),
  total: z.number().int(),
  page: z.number().int(),
  size: z.number().int(),
});

export const importDetailSchema = z.object({
  request: importRequestSchema,
  result: z
    .object({
      status: z.enum(["completed", "failed"]),
      actor_id: z.number().int(),
      reason: z.string(),
      loaded_rows: z.number().int(),
      skipped_rows: z.number().int(),
      created_at: time,
    })
    .nullable(),
});
export type ImportDetail = z.infer<typeof importDetailSchema>;

export const templatesSchema = z.array(
  z.object({
    template_id: z.string(),
    template_version: z.string(),
    max_bytes: z.number().int(),
    max_rows: z.number().int(),
    columns: z.array(z.string()),
  }),
);
export type Template = z.infer<typeof templatesSchema>[number];
