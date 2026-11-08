import { queryOptions } from "@tanstack/react-query";

import { argumentSchema, browserGet } from "@/shared/api";

/** 회차 비교: 실행 하나의 저장된 결과(지난 실행은 바뀌지 않으므로 다시 받지 않는다) */
export const argumentQuery = (runId: string) =>
  queryOptions({
    queryKey: ["argument", runId],
    queryFn: ({ signal }) =>
      browserGet(`/v1/arguments/${encodeURIComponent(runId)}`, argumentSchema, { signal }),
    staleTime: Infinity,
  });
