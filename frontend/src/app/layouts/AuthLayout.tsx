import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";

import { ApiError, apiGet, type Me, meSchema } from "@/shared/api";

// 로그인한 사람만 보는 화면 틀. 로그인이 안 돼 있으면 랜딩(/)으로 보낸다.
// 아직 어느 화면에도 적용하지 않았다. 쓸 때는 그 묶음의 layout.tsx 에서 `export { AuthLayout as default }`.
//
// 「키」 = 서버 세션 쿠키(JSESSIONID, HttpOnly). 화면 JS 는 못 읽으므로 서버에서 그 쿠키를 그대로 실어
// GET /v1/auth/me 를 부르고, 401 · 403 이면 로그인이 없는 것으로 본다.
// Cache Components 에서는 cookies() 를 <Suspense> 밖에서 읽으면 빌드 오류이고, 레이아웃 맨 위에서 기다리면
// 하위 화면 전체가 막힌다(Next 문서 「Authentication with Cache Components」). 그래서 확인은 경계 안의 AuthGate 가 한다
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}

/** 로그인한 사람을 돌려준다. 로그인이 없으면(401 · 403) null, 그 밖의 오류는 그대로 던진다 */
export async function getCurrentUser(): Promise<Me | null> {
  const cookie = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  try {
    return await apiGet("/v1/auth/me", meSchema, { headers: { cookie }, cache: "no-store" });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
}

export async function AuthGate({ children }: { children: ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/");
  return children;
}
