import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mswServer, renderWithQuery } from "@/shared/lib/test";

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
  title: "해석 기준",
  provenance: "card",
  quote: "순이동은 정착을 재는 지표다",
} as const;

function renderMenu(cardId: string | null = "C1") {
  return renderWithQuery(
    <ReportProvider cardId={cardId} runId="run_c1" context="청년 유출·정착 · 여수시">
      <CellMenu target={target} sourcesHref="/results/x/sources" refs={[]} />
    </ReportProvider>,
  );
}

async function openReport(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "해석 기준 칸 메뉴" }));
  await user.click(screen.getByRole("menuitem", { name: "오류 신고 · 수정 제안" }));
  return screen.findByRole("dialog", { name: "수정 제안 보내기" });
}

describe("CellMenu", () => {
  it("⋯ 를 누르면 메뉴가 열리고 첫 줄로 초점이 간다. Esc 로 닫으면 ⋯ 로 돌아온다", async () => {
    const user = userEvent.setup();
    renderMenu();
    const button = screen.getByRole("button", { name: "해석 기준 칸 메뉴" });
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
    await user.click(screen.getByRole("button", { name: "해석 기준 칸 메뉴" }));
    expect(screen.getByRole("menuitem", { name: "원문 보기" })).toHaveAttribute(
      "href",
      "/results/x/sources",
    );
  });

  it("바깥을 누르면 닫힌다", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "해석 기준 칸 메뉴" }));
    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("카드가 없는 결과는 오류 신고를 막는다", async () => {
    const user = userEvent.setup();
    renderMenu(null);
    await user.click(screen.getByRole("button", { name: "해석 기준 칸 메뉴" }));
    expect(screen.queryByRole("menuitem", { name: "오류 신고 · 수정 제안" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: /카드가 없는 결과/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("수정 제안 창", () => {
  beforeEach(() => {
    // 쓰기 요청은 CSRF 쿠키가 있으면 그 값을 헤더로 보낸다
    document.cookie = "XSRF-TOKEN=test-token";
  });

  it("그 칸(배지 · 칸 · 카드 · 지역 · 인용)을 보여 주고, 문제 종류와 설명이 있어야 보낼 수 있다", async () => {
    const user = userEvent.setup();
    renderMenu();
    const dialog = await openReport(user);
    expect(dialog).toHaveTextContent("③ 해석 기준 · 청년 유출·정착 · 여수시");
    expect(dialog).toHaveTextContent("「순이동은 정착을 재는 지표다」");
    expect(dialog).toHaveTextContent("기준 문구");

    const send = screen.getByRole("button", { name: "보내기" });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "문장 표현" }));
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("설명"), "과한 표현 같아요");
    expect(send).toBeEnabled();
  });

  it("보내면 카드 대상 신고를 POST 하고, 창을 닫고 알림을 띄운다", async () => {
    let body: Record<string, unknown> = {};
    let csrf: string | null = null;
    mswServer.use(
      http.post("*/api/v1/review-requests", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        csrf = request.headers.get("x-xsrf-token");
        return HttpResponse.json({ review_id: "review_1", status: "pending" }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderMenu();
    await openReport(user);
    await user.click(screen.getByRole("radio", { name: "문장 표현" }));
    await user.type(screen.getByLabelText("설명"), "과한 표현 같아요");
    await user.click(screen.getByRole("button", { name: /근거 붙이기/ }));
    await user.type(screen.getByLabelText("근거 링크 (선택)"), "https://kosis.kr/x");
    await user.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // 알림은 role=status 로 읽힌다(칸 메뉴의 복사 알림도 status 라 글로 찾는다)
    expect(screen.getByText("수정 제안을 보냈어요 — 검수 대기")).toHaveAttribute("role", "status");
    expect(csrf).toBe("test-token");
    expect(body).toMatchObject({
      target_type: "card",
      target_id: "C1",
      card_id: "C1",
      issue_type: "wording",
    });
    expect(body.reason).toBe(
      "[③ 해석 기준] 청년 유출·정착 · 여수시 · 실행 run_c1\n" +
        "칸 내용: 「순이동은 정착을 재는 지표다」\n\n" +
        "과한 표현 같아요\n\n근거: https://kosis.kr/x",
    );
  });

  it("로그인이 풀려 있으면(401) 창 안에 이유를 보여 주고 창은 그대로 둔다", async () => {
    mswServer.use(
      http.post("*/api/v1/review-requests", () => new HttpResponse(null, { status: 401 })),
    );
    const user = userEvent.setup();
    renderMenu();
    await openReport(user);
    await user.click(screen.getByRole("radio", { name: "값" }));
    await user.type(screen.getByLabelText("설명"), "값이 달라요");
    await user.click(screen.getByRole("button", { name: "보내기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("로그인이 필요해요");
    expect(screen.getByRole("dialog", { name: "수정 제안 보내기" })).toBeInTheDocument();
  });

  it("근거 링크가 주소가 아니면 보내지 않는다", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openReport(user);
    await user.click(screen.getByRole("radio", { name: "기타" }));
    await user.type(screen.getByLabelText("설명"), "확인 부탁해요");
    await user.click(screen.getByRole("button", { name: /근거 붙이기/ }));
    await user.type(screen.getByLabelText("근거 링크 (선택)"), "kosis.kr");
    expect(screen.getByText(/https:\/\/ 로 시작하는 주소/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  });

  it("취소하면 닫히고 ⋯ 로 돌아간다", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openReport(user);
    await user.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
