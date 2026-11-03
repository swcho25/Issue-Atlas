import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "@/shared/lib/theme";

import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    // jsdom 에는 matchMedia 가 없다. OS 설정이 밝은 화면인 브라우저로 둔다
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    // 화면을 먼저 내린다. 남아 있으면 아래에서 속성을 지울 때 버튼이 matchMedia 를 다시 읽는다
    cleanup();
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("누르면 페이지 전체가 어두운 화면으로 바뀌고 선택을 기억한다", async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole("button", { name: "어두운 화면으로 바꾸기" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "밝은 화면으로 바꾸기" })).toBeInTheDocument();
  });

  it("다른 곳에서 테마를 바꿔도 버튼이 따라 바뀐다", async () => {
    render(<ThemeToggle />);

    document.documentElement.setAttribute("data-theme", "dark");

    expect(await screen.findByRole("button", { name: "밝은 화면으로 바꾸기" })).toBeInTheDocument();
  });
});
