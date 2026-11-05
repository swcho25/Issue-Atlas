import { queryOptions } from "@tanstack/react-query";

import { browserGet, evidenceSchema } from "@/shared/api";

// 근거 상세(브라우저). 논증 탭의 각주 복사가 쓴다 — 누를 때만 받고, 한 번 받은 근거는 이 탭 세션 동안 다시 받지 않는다.
// 원문 탭의 읽기 칸은 서버(getEvidence)에서 받는다
export const evidenceQuery = (evidenceId: string) =>
  queryOptions({
    queryKey: ["evidence", evidenceId],
    queryFn: ({ signal }) =>
      browserGet(`/v1/evidence/${encodeURIComponent(evidenceId)}`, evidenceSchema, { signal }),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
