import { rerunQuestion } from "@/features/rerun-question";
import { ApiError, type Argument, browserPost, questionCreatedSchema } from "@/shared/api";

/**
 * 결과 화면 「다시 실행」: 같은 질문의 새 회차(POST /v1/questions/{question_id}/runs)를 만든다 — 내 질문 화면의 회차 비교와 이어진다.
 * 남이 물은 질문을 보고 있으면(404) 같은 지역 · 카드 · 기간으로 새 질문을 만들어 실행한다(POST /v1/questions, 내 질문에 새로 쌓인다).
 * 어느 쪽이든 실행이 끝나야 응답이 온다(새 run_id)
 */
export async function rerunResult(argument: Argument) {
  try {
    return await rerunQuestion(argument.question.question_id);
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
    return askAgain(argument);
  }
}

const askAgain = ({ question }: Argument) =>
  browserPost(
    "/v1/questions",
    {
      place_id: question.place_id,
      card_id: question.card_id,
      period_start: question.period_start,
      period_end: question.period_end,
      raw_text: null,
    },
    questionCreatedSchema,
  );
