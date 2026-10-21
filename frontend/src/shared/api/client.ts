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

// 응답을 Zod 스키마로 검증한다. 계약(C2)과 다른 응답은 화면에 닿기 전에 여기서 실패한다.
async function requestJson<S extends z.ZodType>(
  url: string,
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  // Headers 인스턴스 · 배열 · 객체 어느 형태로 넘겨도 합쳐지도록 Headers 로 만든다
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    throw new ApiError(res.status, path);
  }
  return schema.parse(await res.json());
}

// 서버 컴포넌트 · Route Handler 용. Spring API 를 직접 부른다(주소는 서버 전용).
export function apiGet<S extends z.ZodType>(path: string, schema: S, init?: RequestInit) {
  return requestJson(`${API_BASE_URL}${path}`, path, schema, init);
}

// 클라이언트 전용(TanStack Query). 같은 출처의 /api 로 부르면 next.config 의 rewrites 가 Spring 으로 넘긴다.
// 서버에서 불리면(useSuspenseQuery · 서버 prefetch 등) 바로 알 수 있게 실패시킨다. 서버에서는 apiGet 을 쓴다.
export function browserGet<S extends z.ZodType>(path: string, schema: S, init?: RequestInit) {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error(`browserGet(${path}) 은 브라우저 전용이다. 서버에서는 apiGet 을 쓴다`),
    );
  }
  return requestJson(`${window.location.origin}/api${path}`, path, schema, init);
}
