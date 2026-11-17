import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Argument } from "@/shared/api";

import { RebuttalCitations } from "./RebuttalCitations";

// jsdom 의 <dialog> 에는 showModal · close 가 없다
HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
});

const supported: Argument["rebuttals"][number] = {
  text: "산단 · 대형 사업장 고용 변동에 따른 일시 전입 · 전출",
  status: "supported",
  provenance: "llm_judgment",
  citations: [
    {
      article_id: "a1",
      date: "2024-05-22",
      quote: "직원들이 한 해에 1000여 명씩 다른 지역으로 이주",
      title: "한 해에 1000명 이주",
      url: "https://news.test/a1",
      evidence_id: "ev_news_1",
    },
    {
      article_id: "b1",
      date: "2024-12-19",
      quote: "채용 시장이 위축되어 청년 유출 우려",
      title: null,
      url: null,
      evidence_id: null,
    },
    {
      article_id: "b2",
      date: "2024-12-20",
      quote: "채용 시장이 위축되어 청년 유출 우려",
      title: null,
      url: null,
      evidence_id: null,
    },
  ],
};

describe("RebuttalCitations", () => {
  it("근거 있음 반박의 「근거 N」이 인용 모달을 열고 원문은 새 탭으로 연다", async () => {
    const user = userEvent.setup();
    render(<RebuttalCitations rebuttal={supported} />);
    await user.click(screen.getByRole("button", { name: "근거 3" }));
    const dialog = screen.getByRole("dialog", { name: "다른 해석의 근거" });
    expect(within(dialog).getByText(supported.text)).toBeInTheDocument();
    expect(within(dialog).getByText("한 해에 1000명 이주")).toBeInTheDocument();
    const original = within(dialog).getByRole("link", { name: /원문 기사 새 탭에서 열기/ });
    expect(original).toHaveAttribute("href", "https://news.test/a1");
    expect(original).toHaveAttribute("target", "_blank");
    expect(original).toHaveAttribute("rel", "noopener noreferrer");
    // 같은 인용문 전재 기사 2건은 한 줄, 링크가 없으면 원문 버튼도 없다
    expect(within(dialog).getByText(/같은 내용 기사 2건/)).toBeInTheDocument();
    expect(within(dialog).getAllByRole("link")).toHaveLength(1);

    // 머리의 ✕ 와 아래 「닫기」 둘 다 닫는다
    const closes = within(dialog).getAllByRole("button", { name: "닫기" });
    expect(closes).toHaveLength(2);
    await user.click(closes[1]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("인용이 없는 반박은 버튼을 그리지 않는다", () => {
    const { container } = render(
      <RebuttalCitations
        rebuttal={{
          text: "코로나 이후 이동 회복",
          status: "not_found",
          provenance: "llm_judgment",
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
