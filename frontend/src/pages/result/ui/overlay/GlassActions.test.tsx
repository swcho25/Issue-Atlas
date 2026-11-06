import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { argumentSchema } from "@/shared/api";
import { mswServer, renderWithQuery } from "@/shared/lib/test";

import created from "../../../../../../contracts/c2/examples/question-create-response.json";
import readyJson from "../../../../../../contracts/c2/examples/argument-c1-ready.json";
import unsupportedJson from "../../../../../../contracts/c2/examples/argument-unsupported.json";
import { GlassActions } from "./GlassActions";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const ready = argumentSchema.parse(readyJson);
const unsupported = argumentSchema.parse(unsupportedJson);

describe("GlassActions", () => {
  // 쓰기 요청은 CSRF 쿠키가 있어야 바로 나간다(없으면 먼저 /v1/auth/csrf 를 부른다)
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    document.cookie = "XSRF-TOKEN=tok; path=/";
  });
  afterEach(() => {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("다시 실행은 같은 지역 · 카드 · 기간으로 질문을 보내고 새 결과로 간다", async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(
      http.post("*/api/v1/questions", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...created, run_id: "run_new" }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(<GlassActions argument={ready} />);
    await user.click(screen.getByRole("button", { name: "다시 실행" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/results/run_new"));
    expect(body).toEqual({
      place_id: "kr-12130",
      card_id: "C1",
      period_start: ready.question.period_start,
      period_end: ready.question.period_end,
      raw_text: null,
    });
  });

  it("요청 제한(429)이면 새 결과로 가지 않고 알림을 띄운다", async () => {
    mswServer.use(http.post("*/api/v1/questions", () => new HttpResponse(null, { status: 429 })));
    const user = userEvent.setup();
    renderWithQuery(<GlassActions argument={ready} />);
    await user.click(screen.getByRole("button", { name: "다시 실행" }));

    expect(await screen.findByText("요청이 많아요. 1분 뒤 다시 실행해 주세요")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
    // 다시 누를 수 있다
    expect(screen.getByRole("button", { name: "다시 실행" })).not.toHaveAttribute("aria-disabled");
  });

  it("세션이 끝났으면(401) 랜딩으로 보낸다", async () => {
    mswServer.use(http.post("*/api/v1/questions", () => new HttpResponse(null, { status: 401 })));
    const user = userEvent.setup();
    renderWithQuery(<GlassActions argument={ready} />);
    await user.click(screen.getByRole("button", { name: "다시 실행" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("카드 밖 질문이면 다시 실행이, 근거가 없으면 각주 복사가 꺼진다", () => {
    renderWithQuery(<GlassActions argument={unsupported} />);
    expect(screen.getByRole("button", { name: "다시 실행" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "각주 복사" })).toBeDisabled();
  });
});
