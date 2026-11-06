import { queryOptions } from "@tanstack/react-query";

import { argumentSchema, browserGet, browserPost, questionCreatedSchema } from "@/shared/api";

/** 회차 비교: 실행 하나의 저장된 결과(지난 실행은 바뀌지 않으므로 다시 받지 않는다) */
export const argumentQuery = (runId: string) =>
  queryOptions({
    queryKey: ["argument", runId],
    queryFn: ({ signal }) =>
      browserGet(`/v1/arguments/${encodeURIComponent(runId)}`, argumentSchema, { signal }),
    staleTime: Infinity,
  });

/** 내 질문을 같은 지역 · 이슈 · 기간으로 다시 실행(같은 질문의 새 회차) */
export const rerunQuestion = (questionId: string) =>
  browserPost(
    `/v1/questions/${encodeURIComponent(questionId)}/runs`,
    undefined,
    questionCreatedSchema,
  );
