import type { z } from "zod";

import { API_BASE_URL } from "@/shared/config";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`API ${status} ${path}`);
    this.name = "ApiError";
  }
}

// 서버 컴포넌트 · Route Handler 용. Spring API 를 직접 부른다(주소는 서버 전용).
// 서버는 fetch 로 둔다: Next 의 캐시 · 재검증(cache · next.revalidate)은 fetch 에만 붙는다. 브라우저 요청은 ./browser(axios)
// 응답을 Zod 스키마로 검증한다. 계약(C2)과 다른 응답은 화면에 닿기 전에 여기서 실패한다.
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  // Headers 인스턴스 · 배열 · 객체 어느 형태로 넘겨도 합쳐지도록 Headers 로 만든다
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new ApiError(res.status, path);
  }
  return schema.parse(await res.json());
}
