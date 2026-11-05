import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithQuery } from "@/shared/lib/test";

import { CellMenu } from "./CellMenu";
import { ReportProvider } from "./report";

// jsdom 의 <dialog> 에는 showModal · close 가 없다
HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
});

const target = {
  cell: "warrant",
  no: "③",
  title: "보증",
  quote: "순이동은 정착을 재는 지표다",
} as const;

function renderMenu() {
  return renderWithQuery(
    <ReportProvider context="청년 유출·정착 · 여수시">
      <CellMenu target={target} sourcesHref="/results/x/sources" refs={[]} />
    </ReportProvider>,
  );
}

describe("CellMenu", () => {
  it("⋯ 를 누르면 메뉴가 열리고 첫 줄로 초점이 간다. Esc 로 닫으면 ⋯ 로 돌아온다", async () => {
    const user = userEvent.setup();
    renderMenu();
    const button = screen.getByRole("button", { name: "보증 칸 메뉴" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "원문 보기" })).toHaveFocus();
    // 근거가 없으면 각주 복사 줄이 없다
    expect(screen.queryByRole("menuitem", { name: "각주 복사" })).toBeNull();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "오류 신고 · 수정 제안" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "원문 보기" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("원문 보기는 원문 탭 주소다", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "보증 칸 메뉴" }));
    expect(screen.getByRole("menuitem", { name: "원문 보기" })).toHaveAttribute(
      "href",
      "/results/x/sources",
    );
  });

  it("바깥을 누르면 닫힌다", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "보증 칸 메뉴" }));
    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("오류 신고는 그 칸을 담아 수정 제안 창을 연다", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "보증 칸 메뉴" }));
    await user.click(screen.getByRole("menuitem", { name: "오류 신고 · 수정 제안" }));

    const dialog = await screen.findByRole("dialog", { name: "수정 제안 보내기" });
    expect(dialog).toHaveTextContent("③ 보증 · 청년 유출·정착 · 여수시");
    expect(dialog).toHaveTextContent("순이동은 정착을 재는 지표다");

    await user.click(screen.getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
