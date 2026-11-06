import { queryOptions } from "@tanstack/react-query";

import { browserGet, browserPost, placeBoundariesSchema } from "@/shared/api";

import type { Period } from "../model/period";
import { placeCardsSchema, placeListSchema, questionCreatedSchema } from "../model/schema";

/** 질문할 수 있는 지역(시군구) */
export const placesQuery = () =>
  queryOptions({
    queryKey: ["places"],
    queryFn: () => browserGet("/v1/places", placeListSchema),
    select: (data) => data.places.filter((p) => p.level === "sigungu"),
    staleTime: 10 * 60_000,
  });

/** 그 지역 · 기간에서 답할 수 있는 이슈 카드와 근거 4종 상태 */
export const placeCardsQuery = (placeId: string, period: Period) =>
  queryOptions({
    queryKey: ["places", placeId, "cards", period.id],
    queryFn: () =>
      browserGet(
        `/v1/places/${placeId}/cards?period_start=${period.start}&period_end=${period.end}`,
        placeCardsSchema,
      ),
    select: (data) => data.cards,
    staleTime: 60_000,
  });

/** 시군구 경계(+ 그 안 행정동). 결과 화면과 같은 지도(MapView)에 그린다 */
export const boundariesQuery = (placeId: string) =>
  queryOptions({
    queryKey: ["places", placeId, "boundaries"],
    queryFn: () => browserGet(`/v1/places/${placeId}/boundaries`, placeBoundariesSchema),
    staleTime: Infinity,
  });

/** 질문을 저장하고 바로 실행한다. 실행이 끝나야 응답이 온다(run_id) */
export const createQuestion = (input: {
  placeId: string;
  cardId: string;
  period: Period;
  signal?: AbortSignal;
}) =>
  browserPost(
    "/v1/questions",
    {
      place_id: input.placeId,
      card_id: input.cardId,
      period_start: input.period.start,
      period_end: input.period.end,
      raw_text: null,
    },
    questionCreatedSchema,
    { signal: input.signal },
  );
