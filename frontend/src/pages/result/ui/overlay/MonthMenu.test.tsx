import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { MonthMenu, monthsByYear } from "./MonthMenu";

const months = ["2023-11", "2023-12", "2024-01", "2024-02"];

function Harness() {
  const [month, setMonth] = useState("2023-12");
  return (
    <>
      <MonthMenu months={months} value={month} onChange={setMonth} />
      <p data-testid="picked">{month}</p>
    </>
  );
}

describe("monthsByYear", () => {
  it("달을 해마다 묶는다", () => {
    expect(monthsByYear(months)).toEqual([
      ["2023", ["2023-11", "2023-12"]],
      ["2024", ["2024-01", "2024-02"]],
    ]);
  });
});

describe("MonthMenu", () => {
  it("누르면 해마다 묶인 목록이 열리고, 고른 달에 초점 · 표시, 다른 달을 누르면 그 달로 닫힌다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole("button", { name: "분포형 시점 2023-12" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "2024년" })).toBeInTheDocument();
    const selected = screen.getByRole("option", { selected: true });
    expect(selected).toHaveTextContent("2023-12");
    expect(selected).toHaveFocus();

    await user.click(screen.getByRole("option", { name: "2024-02" }));
    expect(screen.getByTestId("picked")).toHaveTextContent("2024-02");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "분포형 시점 2024-02" })).toHaveFocus();
  });

  it("키보드: ↓ 로 열고 ↓ · End · Home 으로 옮겨 Enter 로 고르고, Esc 는 고르지 않고 닫는다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("button").focus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "2023-12" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "2024-01" })).toHaveFocus();
    await user.keyboard("{End}{Enter}");
    expect(screen.getByTestId("picked")).toHaveTextContent("2024-02");

    await user.keyboard("{ArrowDown}{Home}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("picked")).toHaveTextContent("2024-02");
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("바깥을 누르면 닫힌다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByTestId("picked"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
