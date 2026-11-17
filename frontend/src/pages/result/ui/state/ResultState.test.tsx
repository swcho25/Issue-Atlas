import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ResultError } from "./ResultError";
import { ResultLoading } from "./ResultLoading";
import { ResultNotFound } from "./ResultNotFound";

describe("결과 상태 화면", () => {
  it("불러오는 중: 04 · 05 모두 낭독기에 「결과를 불러오는 중이에요」", () => {
    const { unmount } = render(<ResultLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("결과를 불러오는 중이에요");
    unmount();
    render(<ResultLoading variant="detail" />);
    expect(screen.getByRole("status")).toHaveTextContent("결과를 불러오는 중이에요");
  });

  it("오류: 바로 읽히고(alert) 오류 번호를 적으며, 「다시 시도」 는 retry, 「내 질문으로」 는 내 질문 화면", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("API 500"), { digest: "abc123" });
    render(<ResultError error={error} retry={retry} />);

    const card = screen.getByRole("alert", { name: "결과를 불러오지 못했어요" });
    expect(card).toHaveTextContent("오류 번호 abc123");
    await user.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /내 질문으로/ })).toHaveAttribute(
      "href",
      "/me/questions",
    );
  });

  it("오류 번호가 없으면(클라이언트에서 난 오류) 이유만", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ResultError error={new Error("boom")} retry={() => {}} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent("오류 번호");
  });

  it("없는 결과: 내 질문 보기 · 새 질문 만들기", () => {
    render(<ResultNotFound />);
    expect(screen.getByRole("status", { name: "결과를 찾을 수 없어요" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /내 질문 보기/ })).toHaveAttribute(
      "href",
      "/me/questions",
    );
    expect(screen.getByRole("link", { name: /새 질문 만들기/ })).toHaveAttribute("href", "/ask");
  });
});
