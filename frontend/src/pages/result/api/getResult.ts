import { notFound } from "next/navigation";
import { cache } from "react";
import { ZodError } from "zod";

import { ApiError, apiGet, argumentSchema, evidenceSchema } from "@/shared/api";

// 결과 화면 데이터(서버 전용): 논증 응답 하나로 결과 카드 · 05 세 탭을 그린다(지도 경계는 boundariesQuery, 브라우저).
// 한 요청 안에서 여러 컴포넌트가 불러도 한 번만 받도록 React cache 로 감싼다
export const getArgument = cache(async (runId: string) => {
  try {
    return await apiGet(`/v1/arguments/${encodeURIComponent(runId)}`, argumentSchema, {
      cache: "no-store",
    });
  } catch (e) {
    // 없는 결과 주소는 404 화면으로. 그 밖의 오류(500 · 스키마 불일치)는 오류 화면으로 올린다
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

/**
 * 근거 상세(05 원문 탭의 읽기 칸). 근거 하나를 못 받아도 탭 전체를 깨지 않도록
 * API 오류(404 · 500) · 네트워크 오류는 null 로 돌려 「상세를 불러오지 못했어요」를 보여 준다.
 * 스키마 불일치(ZodError)만 계약 위반이라 오류 화면으로 올린다
 */
export const getEvidence = cache(async (evidenceId: string) => {
  try {
    return await apiGet(`/v1/evidence/${encodeURIComponent(evidenceId)}`, evidenceSchema, {
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof ZodError) throw e;
    return null;
  }
});
