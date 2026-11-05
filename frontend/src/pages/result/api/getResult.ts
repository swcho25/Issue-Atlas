import { notFound } from "next/navigation";

import { ApiError, apiGet, argumentSchema, placeBoundariesSchema } from "@/shared/api";

// 결과 화면 데이터(서버 전용). 논증 응답 하나로 카드를 그리고, 질문 지역의 경계로 지도를 그린다
export async function getResult(runId: string) {
  try {
    const argument = await apiGet(`/v1/arguments/${encodeURIComponent(runId)}`, argumentSchema, {
      cache: "no-store",
    });
    // 경계는 거의 바뀌지 않지만, 결과마다 지역이 달라 같은 요청 안에서 이어 부른다
    const boundaries = await apiGet(
      `/v1/places/${encodeURIComponent(argument.question.place_id)}/boundaries`,
      placeBoundariesSchema,
    );
    return { argument, boundaries };
  } catch (e) {
    // 없는 결과 주소는 404 화면으로. 그 밖의 오류(500 · 스키마 불일치)는 오류 화면으로 올린다
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
