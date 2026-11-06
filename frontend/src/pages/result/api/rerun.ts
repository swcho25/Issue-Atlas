import { type Argument, browserPost, questionCreatedSchema } from "@/shared/api";

/**
 * 같은 질문(지역 · 카드 · 기간)을 다시 실행한다. 백엔드는 지난 실행을 덮지 않고 새 질문 · 새 실행을 만들어
 * 새 run_id 를 준다(지금 자료로 다시 계산). 실행이 끝나야 응답이 온다
 */
export const rerunQuestion = ({ question }: Argument) =>
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
