import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { API_BASE_URL } from "@/shared/config";
import { mswServer } from "@/shared/lib/test";

import { UserRail } from "./AppLayout";

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [{ name: "JSESSIONID", value: "abc" }] }),
}));

const me = { id: 6, email: "admin", name: "관리자", role: "ADMIN" };

// 띠 자체는 widgets/app-rail 이 그린다. 여기서는 로그인한 사람을 띠의 role · user 로 바꾸는 것만 본다
describe("UserRail", () => {
  it.each([
    ["ADMIN", "admin"],
    ["VIEWER", "viewer"],
  ])("%s 로그인이면 띠 role 은 %s", async (role, expected) => {
    mswServer.use(http.get(`${API_BASE_URL}/v1/auth/me`, () => HttpResponse.json({ ...me, role })));

    const rail = await UserRail();
    expect(rail.props).toMatchObject({ role: expected, user: { name: "관리자", email: "admin" } });
  });

  it.each([401, 500])("로그인이 없거나 오류(%i)면 조회자 띠로 그린다", async (status) => {
    mswServer.use(http.get(`${API_BASE_URL}/v1/auth/me`, () => new HttpResponse(null, { status })));

    const rail = await UserRail();
    expect(rail.props).toMatchObject({ role: "viewer", user: undefined });
  });
});
