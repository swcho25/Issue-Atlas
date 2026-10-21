import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { mswServer } from "@/shared/lib/test";

import { ApiError, browserGet } from "./client";

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
