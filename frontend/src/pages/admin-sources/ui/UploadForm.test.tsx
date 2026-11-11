import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mswServer, renderWithQuery } from "@/shared/lib/test";

import { UploadForm } from "./UploadForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const admins = [
  { id: 1, email: "a@x", name: "관리자", role: "ADMIN", is_active: true },
  { id: 6, email: "admin", name: "관리자(admin)", role: "ADMIN", is_active: true },
];
const created = {
  import_id: "import_9",
  requested_by: 6,
  assignee_id: 1,
  file_name: "a.csv",
  file_sha256: "b".repeat(64),
  template_version: "1",
  status: "validation_failed",
  revision: 0,
  validation: {
    total_rows: 0,
    valid_rows: 0,
    duplicate_rows: 0,
    eligible_rows: 0,
    error_count: 1,
    errors_truncated: false,
    errors: [{ row: 1, column: null, code: "header_mismatch" }],
    duplicate_row_numbers: [],
  },
  created_at: "2026-11-08T07:00:00Z",
  updated_at: "2026-11-08T07:00:00Z",
};

describe("UploadForm", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
  });

  afterEach(() => {
    cleanup();
    push.mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("파일을 골라야 올리고, 양식 1 · 반영 담당자 · 요청 키를 multipart 로 보낸 뒤 상세로", async () => {
    // jsdom 의 File 은 undici formData() 가 못 읽어 multipart 본문을 글자로 읽는다
    let body = "";
    mswServer.use(
      http.post("*/api/v1/admin/imports", async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    renderWithQuery(<UploadForm admins={admins} meId={6} maxBytes={2 * 1024 * 1024} />);
    const send = screen.getByRole("button", { name: "올리고 검증" });
    expect(send).toBeDisabled();

    const file = new File(["data_kind,source_id\n"], "a.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText("CSV 파일"), file);
    await userEvent.click(send);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/sources?view=imports&id=import_9"),
    );
    expect(body).toMatch(/name="template_version"\s+1\s/);
    expect(body).toMatch(/name="assignee_id"\s+1\s/);
    expect(body).toMatch(/name="request_key"\s+[0-9a-f-]{36}\s/);
    expect(body).toContain('filename="a.csv"');
  });

  it("2 MiB 를 넘는 파일은 올리지 않는다", async () => {
    renderWithQuery(<UploadForm admins={admins} meId={6} maxBytes={4} />);
    await userEvent.upload(
      screen.getByLabelText("CSV 파일"),
      new File(["0123456789"], "big.csv", { type: "text/csv" }),
    );
    expect(screen.getByText("2 MiB 초과")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "올리고 검증" })).toBeDisabled();
  });
});
