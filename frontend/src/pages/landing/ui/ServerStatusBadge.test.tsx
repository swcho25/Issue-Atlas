import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { mswServer, renderWithQuery } from "@/shared/lib/test";

import { ServerStatusBadge } from "./ServerStatusBadge";

const healthUrl = "*/api/actuator/health";

describe("ServerStatusBadge", () => {
  it("서버가 UP 이면 정상으로 보인다", async () => {
    mswServer.use(http.get(healthUrl, () => HttpResponse.json({ status: "UP" })));
    renderWithQuery(<ServerStatusBadge />);

    expect(screen.getByRole("status")).toHaveTextContent("서버 확인 중");
    expect(await screen.findByText("서버 정상")).toBeInTheDocument();
  });

  it("서버 오류면 응답 없음으로 보인다", async () => {
    mswServer.use(http.get(healthUrl, () => new HttpResponse(null, { status: 503 })));
    renderWithQuery(<ServerStatusBadge />);

    expect(await screen.findByText("서버 응답 없음")).toBeInTheDocument();
  });

  it("서버가 DOWN 으로 응답하면 점검 중으로 보인다", async () => {
    mswServer.use(http.get(healthUrl, () => HttpResponse.json({ status: "DOWN" })));
    renderWithQuery(<ServerStatusBadge />);

    expect(await screen.findByText("서버 점검 중")).toBeInTheDocument();
  });

  it("계약과 다른 응답도 응답 없음으로 처리한다", async () => {
    mswServer.use(http.get(healthUrl, () => HttpResponse.json({ state: "ok" })));
    renderWithQuery(<ServerStatusBadge />);

    expect(await screen.findByText("서버 응답 없음")).toBeInTheDocument();
  });
});
