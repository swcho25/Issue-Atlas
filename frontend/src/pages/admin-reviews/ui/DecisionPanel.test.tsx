import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mswServer, renderWithQuery } from "@/shared/lib/test";

import { type ReviewDetail, reviewDetailSchema } from "../model/schema";
import { DecisionPanel } from "./DecisionPanel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// dev 의 출처(S01) 검수 상세와 같은 모양(contracts/reviews/openapi.json Detail)
const source = { org: "KOSIS", name: "KOSIS 인구이동", source_id: "S01", reliability_grade: "A" };
const detailOf = (over: Partial<ReviewDetail> & { status?: string; target_type?: string } = {}) =>
  reviewDetailSchema.parse({
    request: {
      review_id: "review_1",
      origin: "admin",
      target_type: over.target_type ?? "source",
      target_id: "S01",
      issue_type: "metadata",
      card_id: null,
      reason: "출처 이름 확인",
      proposed_value: null,
      submitted_value: source,
      submitted_by: 1,
      status: over.status ?? "pending",
      revision: 3,
      approval_request_id: null,
      created_at: "2026-11-08T06:15:00Z",
      updated_at: "2026-11-08T06:15:00Z",
    },
    current_value: source,
    proposable_fields: ["name"],
    editable_fields: [],
    scope: "source",
    approval_status: null,
    supported_actions: over.supported_actions ?? ["confirm", "hold", "reject"],
    decisions: [],
  });

const radio = (name: string) => screen.getByRole("radio", { name });

describe("DecisionPanel", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
  });

  afterEach(() => {
    cleanup();
    refresh.mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("서버가 알려 준 행위만 켜고, 사유를 적어야 처리할 수 있다", async () => {
    renderWithQuery(<DecisionPanel detail={detailOf()} />);
    expect(radio("확정")).toBeEnabled();
    expect(radio("수정")).toBeDisabled();
    expect(radio("보류")).toBeEnabled();
    expect(radio("반려")).toBeEnabled();
    expect(screen.getByRole("button", { name: /확정 처리/ })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "현재 값이 맞음");
    expect(screen.getByRole("button", { name: /확정 처리/ })).toBeEnabled();
  });

  it("확정하면 수정 번호 · 적용 범위 · 지금 값을 함께 보내고 상세를 다시 받는다", async () => {
    let body: unknown;
    mswServer.use(
      http.post("*/api/v1/admin/reviews/:id/decisions", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...detailOf().request, status: "resolved", revision: 4 });
      }),
    );
    renderWithQuery(<DecisionPanel detail={detailOf()} />);
    await userEvent.type(screen.getByRole("textbox"), "  현재 값이 맞음  ");
    await userEvent.click(screen.getByRole("button", { name: /확정 처리/ }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(body).toEqual({
      expected_revision: 3,
      action: "confirm",
      scope: "source",
      reason: "현재 값이 맞음",
      expected_value: source,
    });
  });

  it("보류 · 반려는 지금 값을 보내지 않고, 409 면 다시 불러오라고 알린다", async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(
      http.post("*/api/v1/admin/reviews/:id/decisions", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 409 }, { status: 409 });
      }),
    );
    renderWithQuery(<DecisionPanel detail={detailOf()} />);
    await userEvent.click(radio("반려"));
    await userEvent.type(screen.getByRole("textbox"), "범위 밖 요청");
    await userEvent.click(screen.getByRole("button", { name: /반려 처리/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "다른 관리자가 먼저 처리했거나 값이 바뀌었어요",
    );
    expect(body.action).toBe("reject");
    expect(body).not.toHaveProperty("expected_value");
    expect(refresh).toHaveBeenCalled();
  });

  it("보류 중에는 보류를 끄고, 카드 수정은 카드 화면으로 넘긴다", () => {
    renderWithQuery(<DecisionPanel detail={detailOf({ status: "on_hold" })} />);
    expect(radio("보류")).toBeDisabled();
    cleanup();
    renderWithQuery(
      <DecisionPanel
        detail={detailOf({
          target_type: "card",
          supported_actions: ["confirm", "correct", "hold", "reject"],
        })}
      />,
    );
    expect(radio("수정")).toBeDisabled();
    expect(screen.getByText(/카드 초안 수정은 카드 화면에서/)).toBeInTheDocument();
  });

  it("처리가 끝난 요청은 버튼 대신 상태를 알린다", () => {
    renderWithQuery(
      <DecisionPanel detail={detailOf({ status: "resolved", supported_actions: [] })} />,
    );
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(/처리가 끝난 요청이에요/)).toBeInTheDocument();
  });
});
