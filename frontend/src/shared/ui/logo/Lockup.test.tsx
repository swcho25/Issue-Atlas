import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Lockup } from "./Lockup";

const goldFace = (root: HTMLElement) => root.querySelector('path[fill$="-gold)"]');

describe("Lockup", () => {
  // jsdom 에는 matchMedia 가 없다. 동작 줄이기 설정이 꺼진 브라우저로 둔다
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("홈으로 가는 링크로 보인다", () => {
    render(<Lockup />);
    expect(screen.getByRole("link", { name: "Issue Atlas" })).toHaveAttribute("href", "/");
  });

  it("마우스를 올리면 페이지가 펼쳐져 금색 안쪽 면이 보이고, 떼면 다시 닫힌다", async () => {
    const user = userEvent.setup();
    render(<Lockup />);
    const link = screen.getByRole("link", { name: "Issue Atlas" });
    expect(goldFace(link)).toBeNull();

    await user.hover(link);
    await waitFor(() => expect(goldFace(link)).not.toBeNull());

    await user.unhover(link);
    await waitFor(() => expect(goldFace(link)).toBeNull(), { timeout: 3000 });
  });
});
