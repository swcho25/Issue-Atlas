import { NextResponse, type NextRequest } from "next/server";

import { ApiError, apiGet, homeOf, meSchema } from "@/shared/api";

// 랜딩(/)은 로그인하지 않은 사람만 본다. 로그인돼 있으면 그리기 전에 그 사람의 첫 화면으로 보낸다(랜딩이 잠깐 비치지 않게).
// 쿠키가 있는지만 보면 안 된다: 서버 세션이 끝난 쿠키가 남아 있으면 / → /ask → (AuthLayout) / → … 로 끝없이 돈다.
// 그래서 /v1/auth/me 로 확인하고, 끝난 세션(401 · 403)이면 쿠키를 지우고 랜딩을 보여 준다
const SESSION_COOKIE = "JSESSIONID"; // Spring 세션(HttpOnly · Lax · Path=/), /api 를 거쳐 이 사이트 쿠키로 저장된다
// 확인을 기다리는 동안 랜딩도 기다린다. 백엔드가 멈춰 있으면(배포 중 등) 이만큼만 기다리고 랜딩을 보여 준다
const CHECK_TIMEOUT_MS = 2500;

export async function redirectSignedIn(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  try {
    const me = await apiGet("/v1/auth/me", meSchema, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    return NextResponse.redirect(new URL(homeOf(me), request.url));
  } catch (e) {
    const page = NextResponse.next();
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      page.cookies.delete(SESSION_COOKIE);
    }
    // 백엔드에 닿지 않거나 늦으면 쿠키는 두고 랜딩을 그대로 보여 준다(로그인 창에서 다시 들어간다)
    return page;
  }
}
