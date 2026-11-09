import { z } from "zod";

import { claimValue, date, dateTime, id, runStatus, schemaVersion, textOrNull } from "./common";

// GET /v1/me/questions 응답(contracts/c2/schemas/my-question-list.schema.json, c2-0.1).
// 로그인한 사람이 물은 질문 — 마지막 실행이 새로운 질문부터, 실행(회차)도 새것부터
const run = z.object({
  run_id: id,
  run_status: runStatus,
  created_at: dateTime,
  // 그 실행에 저장된 결과의 claim.value · claim.text 그대로
  claim: claimValue,
  claim_text: textOrNull,
});

const question = z
  .object({
    question_id: id,
    place_id: id,
    place_name: z.string(),
    card_id: z.string().nullable(),
    card_name: z.string().nullable(),
    period_start: date,
    period_end: date,
    raw_text: textOrNull,
    // card_id 가 null 이라 신규 카드 후보로 저장한 질문
    candidate: z.boolean(),
    created_at: dateTime,
    runs: z.array(run),
  })
  .refine((q) => q.candidate === (q.card_id === null), {
    message: "card_id 가 null 이면 candidate, 아니면 아니다",
    path: ["candidate"],
  });

export const myQuestionListSchema = z.object({
  schema_version: schemaVersion,
  questions: z.array(question),
});

export type MyQuestion = z.infer<typeof question>;
export type MyRun = z.infer<typeof run>;
