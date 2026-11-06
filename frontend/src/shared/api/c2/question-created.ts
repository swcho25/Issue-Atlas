import { z } from "zod";

import { id, runStatus, schemaVersion } from "./common";

// POST /v1/questions · POST /v1/questions/{question_id}/runs(다시 실행) 응답
// (contracts/c2/schemas/question-create-response.schema.json, c2-0.1). 새 질문 화면 · 내 질문이 함께 쓴다
export const questionCreatedSchema = z
  .object({
    schema_version: schemaVersion,
    question_id: id,
    run_id: id,
    run_status: runStatus,
    // card_id 가 null 이라 신규 카드 후보로 저장했으면 true
    candidate: z.boolean(),
  })
  .refine((r) => !r.candidate || r.run_status === "unsupported", {
    message: "신규 카드 후보면 run_status 는 unsupported",
    path: ["run_status"],
  });
