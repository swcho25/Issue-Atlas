import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE_URL } from "@/shared/config";
import { mswServer } from "@/shared/lib/test";

import { AuthGate } from "./AuthLayout";

// 서버 컴포넌트라 Next 의 요청 함수를 가짜로 둔다. redirect 는 Next 처럼 던져서 렌더를 멈춘다
const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [{ name: "JSESSIONID", value: "abc" }] }),
}));

const me = { id: 1, email: "admin@issue-atlas.kr", name: "관리자", role: "ADMIN" };

describe("AuthGate", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("세션 쿠키를 실어 /v1/auth/me 를 부르고, 로그인이 있으면 화면을 그대로 보여 준다", async () => {
    let cookie: string | null = null;
    mswServer.use(
      http.get(`${API_BASE_URL}/v1/auth/me`, ({ request }) => {
        cookie = request.headers.get("cookie");
        return HttpResponse.json(me);
      }),
    );

    await expect(AuthGate({ children: "화면" })).resolves.toBe("화면");
    expect(cookie).toBe("JSESSIONID=abc");
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([401, 403])("로그인이 없으면(%i) 랜딩(/)으로 보낸다", async (status) => {
    mswServer.use(http.get(`${API_BASE_URL}/v1/auth/me`, () => new HttpResponse(null, { status })));

    await expect(AuthGate({ children: "화면" })).rejects.toThrow("NEXT_REDIRECT /");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("서버 오류(500)는 랜딩으로 숨기지 않고 그대로 던진다", async () => {
    mswServer.use(
      http.get(`${API_BASE_URL}/v1/auth/me`, () => new HttpResponse(null, { status: 500 })),
    );

    await expect(AuthGate({ children: "화면" })).rejects.toMatchObject({ status: 500 });
    expect(redirect).not.toHaveBeenCalled();
  });
});
