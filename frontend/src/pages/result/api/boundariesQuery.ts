import { queryOptions } from "@tanstack/react-query";

import { browserGet, placeBoundariesSchema } from "@/shared/api";

// 지역 경계(약 180KB)는 거의 바뀌지 않는다. 브라우저에서 한 번 받으면 이 탭 세션 동안 다시 받지 않는다.
// 서버에서 받으면 결과 화면에 들어올 때마다 다시 받고 그동안 카드까지 막혀(1.8–2.8초) 브라우저 쪽 캐시로 옮겼다
export const boundariesQuery = (placeId: string) =>
  queryOptions({
    queryKey: ["places", placeId, "boundaries"],
    queryFn: ({ signal }) =>
      browserGet(`/v1/places/${encodeURIComponent(placeId)}/boundaries`, placeBoundariesSchema, {
        signal,
      }),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
