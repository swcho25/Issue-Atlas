// @vitest-environment node
import { delay, http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { API_BASE_URL } from "@/shared/config";
import { mswServer } from "@/shared/lib/test";

import { redirectSignedIn } from "./redirect-signed-in";

const landing = (cookie?: string) =>
  new NextRequest("http://localhost:3000/", { headers: cookie ? { cookie } : {} });

const me = (role: "ADMIN" | "VIEWER") => ({ id: 1, email: "a@issue-atlas.kr", name: "이름", role });

describe("redirectSignedIn", () => {
  it("세션 쿠키가 없으면 백엔드를 부르지 않고 랜딩을 보여 준다", async () => {
    // 정해 둔 응답이 없으므로 /v1/auth/me 를 부르면 MSW 가 실패시킨다
    const res = await redirectSignedIn(landing());

    expect(res.headers.get("location")).toBeNull();
  });

  it.each([
    ["VIEWER", "/ask"],
    ["ADMIN", "/admin"],
  ] as const)("로그인한 %s 은 쿠키를 실어 확인한 뒤 %s 로 보낸다", async (role, home) => {
    let cookie: string | null = null;
    mswServer.use(
      http.get(`${API_BASE_URL}/v1/auth/me`, ({ request }) => {
        cookie = request.headers.get("cookie");
        return HttpResponse.json(me(role));
      }),
    );

    const res = await redirectSignedIn(landing("JSESSIONID=abc; XSRF-TOKEN=tok"));

    expect(res.headers.get("location")).toBe(`http://localhost:3000${home}`);
    expect(cookie).toBe("JSESSIONID=abc; XSRF-TOKEN=tok");
  });

  it.each([401, 403])(
    "세션이 끝난 쿠키(%i)면 쿠키를 지우고 랜딩을 보여 준다 — / ↔ /ask 를 돌지 않게",
    async (status) => {
      mswServer.use(
        http.get(`${API_BASE_URL}/v1/auth/me`, () => new HttpResponse(null, { status })),
      );

      const res = await redirectSignedIn(landing("JSESSIONID=old"));

      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("set-cookie")).toMatch(/^JSESSIONID=;.*Expires=Thu, 01 Jan 1970/);
    },
  );

  it("백엔드에 닿지 않으면 쿠키는 두고 랜딩을 보여 준다", async () => {
    mswServer.use(http.get(`${API_BASE_URL}/v1/auth/me`, () => HttpResponse.error()));

    const res = await redirectSignedIn(landing("JSESSIONID=abc"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("백엔드가 답하지 않으면 오래 기다리지 않고 랜딩을 보여 준다", { timeout: 6000 }, async () => {
    mswServer.use(
      http.get(`${API_BASE_URL}/v1/auth/me`, async () => {
        await delay("infinite");
        return HttpResponse.json(me("VIEWER"));
      }),
    );

    const started = Date.now();
    const res = await redirectSignedIn(landing("JSESSIONID=abc"));

    expect(Date.now() - started).toBeLessThan(4000);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
