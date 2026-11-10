import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginDialogProvider } from "../model/login-dialog";
import { SiteHeader } from "./SiteHeader";

const renderHeader = () =>
  render(
    <LoginDialogProvider>
      <SiteHeader />
    </LoginDialogProvider>,
  );

describe("SiteHeader 테마 토글", () => {
  beforeEach(() => {
    // jsdom 에는 matchMedia 가 없다. OS 설정이 밝은 화면 · 움직임 줄이기 꺼짐인 브라우저로 둔다
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  it("로그인 옆 토글로 어두운 화면 ↔ 밝은 화면을 바꾸고 다음 방문을 위해 기억한다", async () => {
    renderHeader();
    const toggle = screen.getByRole("switch", { name: "어두운 화면" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("ia-theme")).toBe("dark");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("저장된 어두운 화면으로 열면 토글이 켜진 채로 나온다", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    renderHeader();
    expect(screen.getByRole("switch", { name: "어두운 화면" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
