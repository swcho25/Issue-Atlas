import { z } from "zod";

import { id, runStatus, schemaVersion } from "./common";

// POST /v1/questions 응답(contracts/c2/schemas/question-create-response.schema.json, c2-0.1).
// 요청마다 질문 하나 · 실행 하나를 새로 만든다(같은 질문을 다시 보내도 새 run_id). 새 질문 · 결과 「다시 실행」이 함께 쓴다
export const questionCreatedSchema = z
  .object({
    schema_version: schemaVersion,
    question_id: id,
    run_id: id,
    run_status: runStatus,
    /** card_id 가 null 이라 신규 카드 후보로 저장됐으면 true(run_status 는 unsupported) */
    candidate: z.boolean(),
  })
  .refine((q) => !q.candidate || q.run_status === "unsupported", {
    message: "후보 질문은 run_status 가 unsupported 다",
  });

export type QuestionCreated = z.infer<typeof questionCreatedSchema>;
