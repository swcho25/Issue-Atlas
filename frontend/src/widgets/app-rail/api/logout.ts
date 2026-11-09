import { ApiError, browserHttp } from "@/shared/api";

/**
 * 로그아웃(POST /v1/auth/logout, 204 · 본문 없음). 서버 세션을 끝낸다. CSRF 토큰은 browserHttp 가 넣는다.
 * 세션이 이미 끝났으면(401) 로그아웃된 것과 같으므로 성공으로 본다
 */
export async function logout() {
  try {
    await browserHttp.post("/v1/auth/logout");
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) throw e;
  }
}
