import { browserPost, questionCreatedSchema } from "@/shared/api";

/**
 * 내 질문을 같은 지역 · 이슈 · 기간으로 다시 실행한다(같은 질문의 새 회차, 계약 c2 「내 질문」).
 * 응답은 POST /v1/questions 와 같은 모양(같은 question_id · 새 run_id). 없는 질문 · 남이 물은 질문은 404.
 * 내 질문 화면 · 결과 화면 「다시 실행」이 함께 쓴다
 */
export const rerunQuestion = (questionId: string) =>
  browserPost(
    `/v1/questions/${encodeURIComponent(questionId)}/runs`,
    undefined,
    questionCreatedSchema,
  );
