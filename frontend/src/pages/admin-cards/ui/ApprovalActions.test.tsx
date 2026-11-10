import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mswServer, renderWithQuery } from "@/shared/lib/test";

import { type ApprovalDetail, approvalDetailSchema } from "../model/schema";
import { ApprovalActions } from "./ApprovalActions";

const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));

// dev 의 GET /v1/admin/approval-requests/{id} 와 같은 모양(contracts/c3 ApprovalDetail)
const request = {
  request_id: "approval_1",
  card_id: "C990",
  draft_revision: 4,
  requested_by: 1,
  requester_name: "관리자",
  approver_id: 6,
  approver_name: "관리자(admin)",
  status: "pending",
  reason: "카드 검토 요청",
  revision: 0,
  created_at: "2026-11-08T07:00:00Z",
  decided_by: null,
  decided_at: null,
  decision_reason: null,
  approved_version: null,
};
const detailOf = (status = "pending", revision = 0): ApprovalDetail =>
  approvalDetailSchema.parse({
    request: { ...request, status, revision },
    draft_spec: { name: "QA 카드" },
    indicator_versions: { population_movers: 1 },
    current_version: 2,
    decisions: [],
  });

const button = (name: string) => screen.getByRole("button", { name });

describe("ApprovalActions", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
  });

  afterEach(() => {
    cleanup();
    refresh.mockReset();
    replace.mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("지정 승인자가 아니면 칸과 버튼이 꺼져 있다", () => {
    renderWithQuery(<ApprovalActions detail={detailOf()} meId={1} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(button("승인 · 카드 공개")).toBeDisabled();
  });

  it("승인자는 사유를 적어야 처리하고, 요청 번호를 expected_revision 으로 보낸 뒤 새 상태 칸으로", async () => {
    let body: unknown = null;
    mswServer.use(
      http.post("*/api/v1/admin/approval-requests/:id/decisions", async ({ request: req }) => {
        body = await req.json();
        return HttpResponse.json({ ...request, status: "on_hold", revision: 1 });
      }),
    );
    renderWithQuery(<ApprovalActions detail={detailOf("pending", 3)} meId={6} />);
    expect(button("보류")).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), " 근거 확인 필요 ");
    await userEvent.click(button("보류"));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/cards?status=on_hold&id=approval_1"),
    );
    expect(body).toEqual({ expected_revision: 3, decision: "hold", reason: "근거 확인 필요" });
  });

  it("보류 중에는 보류를 끄고, 409 면 알리고 다시 불러온다", async () => {
    mswServer.use(
      http.post("*/api/v1/admin/approval-requests/:id/decisions", () =>
        HttpResponse.json({ status: 409 }, { status: 409 }),
      ),
    );
    renderWithQuery(<ApprovalActions detail={detailOf("on_hold", 1)} meId={6} />);
    await userEvent.type(screen.getByRole("textbox"), "반려");
    expect(button("보류")).toBeDisabled();
    await userEvent.click(button("반려"));
    expect(await screen.findByRole("alert")).toHaveTextContent("다시 불러왔어요");
    expect(refresh).toHaveBeenCalled();
  });
});
