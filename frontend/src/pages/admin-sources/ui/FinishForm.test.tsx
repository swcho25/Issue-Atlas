import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mswServer, renderWithQuery } from "@/shared/lib/test";

import { type ImportDetail, importDetailSchema } from "../model/schema";
import { FinishForm } from "./FinishForm";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// contracts/csv-imports 「응답과 상태」 예시와 같은 모양(검증 통과 3행 · 중복 1 → 반영 대상 2)
const request = {
  import_id: "import_1",
  requested_by: 1,
  assignee_id: 6,
  file_name: "youth_program_2025.csv",
  file_sha256: "a".repeat(64),
  template_version: "1",
  status: "pending",
  revision: 0,
  validation: {
    total_rows: 3,
    valid_rows: 3,
    duplicate_rows: 1,
    eligible_rows: 2,
    error_count: 0,
    errors_truncated: false,
    errors: [],
    duplicate_row_numbers: [4],
  },
  created_at: "2026-11-08T07:00:00Z",
  updated_at: "2026-11-08T07:00:00Z",
};
const detail: ImportDetail = importDetailSchema.parse({ request, result: null });

describe("FinishForm", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
  });

  afterEach(() => {
    cleanup();
    refresh.mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("반영 담당자가 아니면 꺼져 있다", () => {
    renderWithQuery(<FinishForm detail={detail} meId={1} assigneeName="관리자(admin)" />);
    expect(screen.getByRole("button", { name: "완료 보고" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "사유 (필수)" })).toBeDisabled();
  });

  it("완료는 반영 + 건너뜀 = 반영 대상이어야 보내고, 요청 번호를 expected_revision 으로", async () => {
    let body: unknown = null;
    mswServer.use(
      http.post("*/api/v1/admin/imports/:id/results", async ({ request: req }) => {
        body = await req.json();
        return HttpResponse.json({
          request: { ...request, status: "completed", revision: 1 },
          result: null,
        });
      }),
    );
    renderWithQuery(<FinishForm detail={detail} meId={6} assigneeName="관리자(admin)" />);
    const loaded = screen.getByRole("textbox", { name: "반영" });
    await userEvent.clear(loaded);
    await userEvent.type(loaded, "1");
    await userEvent.type(screen.getByRole("textbox", { name: "사유 (필수)" }), "별도 적재 확인");
    expect(screen.getByText("반영 + 건너뜀 = 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "완료 보고" })).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox", { name: "건너뜀" }), "{backspace}1");
    await userEvent.click(screen.getByRole("button", { name: "완료 보고" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(body).toEqual({
      expected_revision: 0,
      status: "completed",
      reason: "별도 적재 확인",
      loaded_rows: 1,
      skipped_rows: 1,
    });
  });

  it("실패는 합계가 반영 대상 이하면 된다", async () => {
    renderWithQuery(<FinishForm detail={detail} meId={6} assigneeName="관리자(admin)" />);
    await userEvent.click(screen.getByRole("radio", { name: "실패" }));
    const loaded = screen.getByRole("textbox", { name: "반영" });
    await userEvent.clear(loaded);
    await userEvent.type(loaded, "0");
    await userEvent.type(screen.getByRole("textbox", { name: "사유 (필수)" }), "참조 오류");
    expect(screen.getByRole("button", { name: "실패 보고" })).toBeEnabled();
  });
});
