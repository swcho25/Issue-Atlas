import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mswServer, renderWithQuery } from "@/shared/lib/test";

import { reloadToLanding } from "../lib/reload";
import { LogoutButton } from "./LogoutButton";

// jsdom 은 페이지 이동을 하지 못한다. 랜딩을 새로 여는 함수만 바꿔 불렸는지 본다
vi.mock("../lib/reload", () => ({ reloadToLanding: vi.fn() }));

describe("LogoutButton", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
  });

  afterEach(() => {
    cleanup();
    vi.mocked(reloadToLanding).mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("CSRF 토큰을 실어 로그아웃하고 랜딩을 새로 연다", async () => {
    let token: string | null = null;
    mswServer.use(
      http.post("*/api/v1/auth/logout", ({ request }) => {
        token = request.headers.get("X-XSRF-TOKEN");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithQuery(<LogoutButton />);

    await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(reloadToLanding).toHaveBeenCalled());
    expect(token).toBe("tok");
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeDisabled();
  });

  it("세션이 이미 끝났으면(401) 그대로 랜딩으로", async () => {
    mswServer.use(http.post("*/api/v1/auth/logout", () => new HttpResponse(null, { status: 401 })));
    renderWithQuery(<LogoutButton />);

    await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(reloadToLanding).toHaveBeenCalled());
  });

  it("그 밖의 오류면 머물고 다시 누를 수 있다", async () => {
    mswServer.use(http.post("*/api/v1/auth/logout", () => new HttpResponse(null, { status: 500 })));
    renderWithQuery(<LogoutButton />);

    await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("로그아웃하지 못했어요");
    expect(reloadToLanding).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeEnabled();
  });
});
