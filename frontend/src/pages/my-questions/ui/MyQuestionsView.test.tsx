import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import insufficient from "../../../../../contracts/c2/examples/argument-c1-insufficient.json";
import ready from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import example from "../../../../../contracts/c2/examples/my-question-list.json";
import { myQuestionListSchema } from "@/shared/api";
import { mswServer, renderWithQuery } from "@/shared/lib/test";

import { MyQuestionsView } from "./MyQuestionsView";

const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));

const { questions } = myQuestionListSchema.parse(example);
// 예시의 회차: run_0002(2회차) = 판단한 결과, run_0001(1회차) = 근거 부족
const ARGUMENTS: Record<string, object> = {
  run_0002: { ...ready, run_id: "run_0002" },
  run_0001: { ...insufficient, run_id: "run_0001" },
};

describe("MyQuestionsView", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
    mswServer.use(
      http.get("*/api/v1/arguments/:id", ({ params }) =>
        HttpResponse.json(ARGUMENTS[String(params.id)]),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    refresh.mockReset();
    replace.mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("저장한 질문 줄과, 고른 질문의 최근 두 회차 비교를 보여 준다", async () => {
    renderWithQuery(<MyQuestionsView questions={questions} />);

    expect(screen.getByRole("tab", { name: /저장한 질문\s*1/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText("여수시에서 2023–2025년 청년 유출·정착은 어떻게 달라졌나요?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("여수시 · 청년 유출·정착 · 2023–2025 · 2회 · 11-06"),
    ).toBeInTheDocument();

    const panel = screen.getByRole("complementary", { name: "회차 비교" });
    expect(within(panel).getByRole("heading", { name: "1회차 → 2회차" })).toBeInTheDocument();
    const row = (label: string) =>
      within(panel).getByRole("rowheader", { name: label }).closest("tr") as HTMLTableRowElement;
    expect(await within(panel).findByRole("rowheader", { name: "분석 결과" })).toBeInTheDocument();
    expect(row("분석 결과")).toHaveTextContent("분석 안 함증가바뀜");
    expect(row("근거 4종")).toHaveTextContent("1 / 44 / 4+3");
    expect(row("근거 수준")).toHaveTextContent("낮음높음▲ 올라감");
    expect(within(panel).getByRole("link", { name: /결과 열기/ })).toHaveAttribute(
      "href",
      "/results/run_0002",
    );
  });

  it("새 이슈 후보 탭: 이름 · 접수일, 다시 실행 없이 후보 설명", async () => {
    renderWithQuery(<MyQuestionsView questions={questions} />);

    await userEvent.click(screen.getByRole("tab", { name: /새 이슈 후보\s*1/ }));

    expect(
      within(screen.getByRole("list")).getByText("여수시 · 2024 · 11-05 접수"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 실행" })).not.toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "새 이슈 후보" });
    expect(within(panel).getByRole("heading", { name: "관광객 수" })).toBeInTheDocument();
    expect(within(panel).getByText("판단하지 않고 후보로 저장했어요")).toBeInTheDocument();
  });

  it("다시 실행: CSRF 를 붙여 그 질문의 새 회차를 만들고 목록을 다시 받는다", async () => {
    let sent: { path: string; token: string | null } | undefined;
    mswServer.use(
      http.post("*/api/v1/questions/:id/runs", ({ request, params }) => {
        sent = { path: String(params.id), token: request.headers.get("X-XSRF-TOKEN") };
        return HttpResponse.json(
          {
            schema_version: "c2-0.1",
            question_id: "q_0001",
            run_id: "run_0003",
            run_status: "ready",
            candidate: false,
          },
          { status: 201 },
        );
      }),
    );
    renderWithQuery(<MyQuestionsView questions={questions} />);

    const list = screen.getByRole("list");
    await userEvent.click(within(list).getByRole("button", { name: "다시 실행" }));

    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(sent).toEqual({ path: "q_0001", token: "tok" });
  });

  it("다시 실행 중에 세션이 끝나 401 이면 랜딩으로 보낸다", async () => {
    mswServer.use(
      http.post("*/api/v1/questions/:id/runs", () => new HttpResponse(null, { status: 401 })),
    );
    renderWithQuery(<MyQuestionsView questions={questions} />);

    await userEvent.click(
      within(screen.getByRole("list")).getByRole("button", { name: "다시 실행" }),
    );

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
