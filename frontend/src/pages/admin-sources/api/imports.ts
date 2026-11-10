import { browserPost } from "@/shared/api";

import { type ImportDetail, importDetailSchema, importRequestSchema } from "../model/schema";

// CSV 요청 쓰기(브라우저). 올리기는 multipart, 결과 보고는 요청 번호(revision)로 동시 보고를 막는다

/** 양식 1 CSV 올리기. request_key 는 같은 올리기를 다시 보낼 때 같은 값이어야 한다(네트워크 재시도에 같은 요청을 돌려준다) */
export function uploadImport(input: { file: File; assigneeId: number; requestKey: string }) {
  const form = new FormData();
  form.set("file", input.file);
  form.set("template_version", "1");
  form.set("assignee_id", String(input.assigneeId));
  form.set("request_key", input.requestKey);
  return browserPost("/v1/admin/imports", form, importRequestSchema);
}

export const finishImport = (
  detail: ImportDetail,
  input: { status: "completed" | "failed"; loaded: number; skipped: number; reason: string },
) =>
  browserPost(
    `/v1/admin/imports/${encodeURIComponent(detail.request.import_id)}/results`,
    {
      expected_revision: detail.request.revision,
      status: input.status,
      reason: input.reason.trim(),
      loaded_rows: input.loaded,
      skipped_rows: input.skipped,
    },
    importDetailSchema,
  );
