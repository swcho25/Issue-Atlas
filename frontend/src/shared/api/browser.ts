import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { z } from "zod";

import { ApiError } from "./client";

// 브라우저(클라이언트 컴포넌트 · TanStack Query) 전용 axios.
// 같은 출처의 /api 로 부르면 next.config 의 rewrites 가 Spring 으로 넘긴다(CORS · 주소 노출 없음).
// 로그인은 서버 세션 쿠키(JSESSIONID, HttpOnly)라 브라우저가 알아서 보낸다. 화면이 넣어야 하는 「키」는 CSRF 토큰 하나다
export const browserHttp = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { Accept: "application/json" },
});

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";
// 읽기 요청에는 CSRF 가 필요 없다(Spring csrf.spa 기본)
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

const readCookie = (name: string) =>
  document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);

// 요청 인터셉터: 쓰기 요청(POST · PUT · PATCH · DELETE)이면 CSRF 토큰을 헤더에 넣는다.
// 쿠키가 아직 없으면 GET /v1/auth/csrf 로 먼저 받는다(로그인 · 익명 질문 모두 이 토큰이 있어야 한다)
async function attachCsrf(config: InternalAxiosRequestConfig) {
  if (SAFE_METHODS.has((config.method ?? "get").toUpperCase())) return config;
  if (!readCookie(CSRF_COOKIE)) await browserHttp.get("/v1/auth/csrf");
  const token = readCookie(CSRF_COOKIE);
  if (token) config.headers.set(CSRF_HEADER, decodeURIComponent(token));
  return config;
}

// 응답 인터셉터: 오류 응답을 서버 쪽(apiGet)과 같은 ApiError(상태 코드 · 경로)로 바꾼다.
// 화면은 axios 를 몰라도 `e instanceof ApiError && e.status === 401` 로 가른다
function toApiError(error: unknown) {
  if (error instanceof AxiosError && error.response) {
    return Promise.reject(new ApiError(error.response.status, error.config?.url ?? ""));
  }
  return Promise.reject(error);
}

browserHttp.interceptors.request.use(attachCsrf);
browserHttp.interceptors.response.use((res) => res, toApiError);

type BrowserInit = { headers?: HeadersInit; signal?: AbortSignal };

const toConfig = (init?: BrowserInit) => ({
  headers: init?.headers ? Object.fromEntries(new Headers(init.headers)) : undefined,
  signal: init?.signal,
});

const browserOnly = (name: string, path: string) => {
  if (typeof window === "undefined") {
    throw new Error(`${name}(${path}) 은 브라우저 전용이다. 서버에서는 apiGet 을 쓴다`);
  }
};

// 서버에서 불리면(useSuspenseQuery · 서버 prefetch 등) 바로 알 수 있게 실패시킨다.
// 응답은 Zod 스키마로 검증한다(계약과 다른 응답은 화면에 닿기 전에 실패)
export async function browserGet<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: BrowserInit,
): Promise<z.output<S>> {
  browserOnly("browserGet", path);
  const res = await browserHttp.get(path, toConfig(init));
  return schema.parse(res.data);
}

export async function browserPost<S extends z.ZodType>(
  path: string,
  body: unknown,
  schema: S,
  init?: BrowserInit,
): Promise<z.output<S>> {
  browserOnly("browserPost", path);
  const res = await browserHttp.post(path, body, toConfig(init));
  return schema.parse(res.data);
}
