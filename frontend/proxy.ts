import type { NextRequest } from "next/server";

import { redirectSignedIn } from "@/app/proxy";

// 랜딩(/)에서만 돈다: 로그인돼 있으면 랜딩 대신 첫 화면으로(자세한 건 redirectSignedIn).
// 앱 화면의 로그인 확인은 각 묶음의 AuthLayout(서버에서 /v1/auth/me)이 맡는다
export function proxy(request: NextRequest) {
  return redirectSignedIn(request);
}

export const config = {
  matcher: ["/"],
};
