import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { mswServer } from "@/shared/lib/test";

import { ApiError, browserGet, browserPost } from "./client";

const schema = z.object({ ok: z.boolean() });

describe("browserGet", () => {
  it("넘긴 헤더를 유지하면서 Accept 를 붙인다", async () => {
    let received: Headers | undefined;
    mswServer.use(
      http.get("*/api/ping", ({ request }) => {
        received = request.headers;
        return HttpResponse.json({ ok: true });
      }),
    );

    await browserGet("/ping", schema, { headers: new Headers({ "X-Trace": "abc" }) });

    expect(received?.get("X-Trace")).toBe("abc");
    expect(received?.get("Accept")).toBe("application/json");
  });

  it("오류 응답이면 상태 코드를 담은 ApiError 를 던진다", async () => {
    mswServer.use(http.get("*/api/ping", () => new HttpResponse(null, { status: 404 })));

    await expect(browserGet("/ping", schema)).rejects.toMatchObject({
      name: ApiError.name,
      status: 404,
    });
  });
});

describe("browserPost", () => {
  afterEach(() => {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("CSRF 쿠키가 없으면 먼저 받고, 그 값을 X-XSRF-TOKEN 헤더로 보낸다", async () => {
    let received: { headers: Headers; body: unknown } | undefined;
    mswServer.use(
      http.get("*/api/v1/auth/csrf", () => {
        document.cookie = "XSRF-TOKEN=tok%3D1; path=/";
        return new HttpResponse(null, { status: 204 });
      }),
      http.post("*/api/login", async ({ request }) => {
        received = { headers: request.headers, body: await request.json() };
        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(browserPost("/login", { email: "a@b.c" }, schema)).resolves.toEqual({ ok: true });

    expect(received?.headers.get("X-XSRF-TOKEN")).toBe("tok=1");
    expect(received?.headers.get("Content-Type")).toBe("application/json");
    expect(received?.body).toEqual({ email: "a@b.c" });
  });

  it("오류 응답이면 상태 코드를 담은 ApiError 를 던진다", async () => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
    mswServer.use(http.post("*/api/login", () => new HttpResponse(null, { status: 401 })));

    await expect(browserPost("/login", {}, schema)).rejects.toMatchObject({
      name: ApiError.name,
      status: 401,
    });
  });
});
