import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mswServer, renderWithQuery } from "@/shared/lib/test";

import { LoginDialogProvider, useLoginDialog } from "../model/login-dialog";
import { LoginDialog } from "./LoginDialog";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// 테스트는 창이 열린 상태에서 시작한다
function Opened() {
  const { open } = useLoginDialog();
  useEffect(() => open(), [open]);
  return <LoginDialog />;
}

const renderOpened = () =>
  renderWithQuery(
    <LoginDialogProvider>
      <Opened />
    </LoginDialogProvider>,
  );

const fill = async (email: string, password: string) => {
  await userEvent.type(screen.getByLabelText("이메일"), email);
  await userEvent.type(screen.getByLabelText("비밀번호"), password);
  await userEvent.click(screen.getByRole("button", { name: "로그인" }));
};

describe("LoginDialog", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
    // jsdom 에는 matchMedia 가 없다(로고 심벌이 움직임 줄이기 설정을 읽는다)
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    push.mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("빈 칸이면 보내지 않고 무엇을 입력할지 알려 준다", async () => {
    renderOpened();

    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.getByRole("status")).toHaveTextContent("이메일과 비밀번호를 입력해 주세요");
    expect(screen.getByLabelText("이메일")).toHaveAttribute("aria-invalid", "true");
    expect(push).not.toHaveBeenCalled();
  });

  it("관리자로 로그인하면 운영 요약으로 간다", async () => {
    let body: unknown;
    mswServer.use(
      http.post("*/api/v1/auth/login", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          id: 1,
          email: "admin@example.com",
          name: "관리자",
          role: "ADMIN",
        });
      }),
    );
    renderOpened();

    await fill("admin@example.com", "secret");

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
    expect(body).toEqual({ email: "admin@example.com", password: "secret" });
  });

  it("비밀번호가 틀리면 안내하고 머문다", async () => {
    mswServer.use(http.post("*/api/v1/auth/login", () => new HttpResponse(null, { status: 401 })));
    renderOpened();

    await fill("admin@example.com", "wrong");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "이메일 또는 비밀번호가 맞지 않아요",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
