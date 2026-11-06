import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mswServer, renderWithQuery } from "@/shared/lib/test";

import { AskPage } from "./AskPage";

const push = vi.fn();
const replace = vi.fn();

// jsdom 의 <dialog> 에는 showModal · close 가 없다(새 이슈 후보 창)
HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
// 지도(WebGL)는 jsdom 에서 그릴 수 없다. 고를 수 있는 다른 지역(choices)만 버튼으로 세워 누르기를 흉내 낸다
vi.mock("@/shared/ui/map", () => ({
  MapView: ({
    choices = [],
    onPick,
  }: {
    choices?: { properties: { place_id: string; name: string } }[];
    onPick?: (id: string) => void;
  }) => (
    <div data-testid="map">
      {choices.map(({ properties: p }) => (
        <button key={p.place_id} type="button" onClick={() => onPick?.(p.place_id)}>
          지도: {p.name}
        </button>
      ))}
    </div>
  ),
}));

const NAMES: Record<string, string> = { "kr-12210": "광주 동구", "kr-12130": "여수시" };
// 그 지역 시군구 경계 하나(모양은 보지 않으므로 작은 네모)
const boundaryOf = (placeId: string) => ({
  schema_version: "c2-0.1",
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: placeId,
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [127, 35],
              [127.1, 35],
              [127.1, 35.1],
              [127, 35],
            ],
          ],
        ],
      },
      properties: {
        place_id: placeId,
        name: NAMES[placeId],
        level: "sigungu",
        parent_id: null,
        source: "sgis_hadmarea",
        source_year: 2025,
      },
    },
  ],
});

const evidence = (available: string[]) =>
  ["statistics", "documents", "existing_responses", "denominators"].map((kind) => ({
    kind,
    status: available.includes(kind) ? "available" : "not_collected",
  }));

function mockApi() {
  mswServer.use(
    http.get("*/api/v1/places", () =>
      HttpResponse.json({
        schema_version: "c2-0.1",
        places: [
          {
            place_id: "kr-12210",
            name: "광주 동구",
            level: "sigungu",
            parent_id: "kr-29",
            codes: [],
          },
          { place_id: "kr-12130", name: "여수시", level: "sigungu", parent_id: "kr-46", codes: [] },
        ],
      }),
    ),
    http.get("*/api/v1/places/:id/cards", () =>
      HttpResponse.json({
        schema_version: "c2-0.1",
        cards: [
          {
            card_id: "A3",
            name: "대기질",
            domain: "A 환경·기후",
            parent_question: "생태환경은 어떻게 변하는가?",
            card_version: 2,
            evidence: evidence([]),
            available_kinds: 0,
            review_pending_count: 0,
          },
          {
            card_id: "C1",
            name: "청년 유출·정착",
            domain: "C 인구·지역소멸",
            parent_question: "청년은 어디로 떠나는가?",
            card_version: 2,
            evidence: evidence(["statistics", "existing_responses"]),
            available_kinds: 2,
            review_pending_count: 0,
          },
        ],
      }),
    ),
    http.get("*/api/v1/places/:id/boundaries", ({ params }) =>
      HttpResponse.json(boundaryOf(String(params.id))),
    ),
  );
}

describe("AskPage", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
    mockApi();
  });

  afterEach(() => {
    cleanup();
    push.mockReset();
    replace.mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("여수시로 시작하고, 근거가 있는 이슈를 먼저 고르며 근거 n/4 를 보여 준다", async () => {
    renderWithQuery(<AskPage />);

    expect(await screen.findByRole("radio", { name: /청년 유출·정착/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "지역" })).toHaveValue("kr-12130");
    expect(screen.getByRole("radio", { name: /대기질/ })).toHaveTextContent("근거 0/4");
    expect(screen.getByText("여수시 · 청년 유출·정착 · 2023–2025")).toBeInTheDocument();
  });

  it("질문 실행: CSRF 를 붙여 POST /v1/questions 를 보내고 그 실행의 결과 화면으로 간다", async () => {
    let sent: { body: unknown; token: string | null } | undefined;
    mswServer.use(
      http.post("*/api/v1/questions", async ({ request }) => {
        sent = { body: await request.json(), token: request.headers.get("X-XSRF-TOKEN") };
        return HttpResponse.json(
          {
            schema_version: "c2-0.1",
            question_id: "q_1",
            run_id: "run_test",
            run_status: "partial",
            candidate: false,
          },
          { status: 201 },
        );
      }),
    );
    renderWithQuery(<AskPage />);
    await screen.findByRole("radio", { name: /청년 유출·정착/ });

    await userEvent.click(screen.getByRole("button", { name: "질문 실행" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/results/run_test"));
    expect(sent).toEqual({
      token: "tok",
      body: {
        place_id: "kr-12130",
        card_id: "C1",
        period_start: "2023-01-01",
        period_end: "2026-01-01",
        raw_text: null,
      },
    });
  });

  it("지도에는 고른 곳 말고 다른 지역이 뜨고, 누르면 그 지역으로 바뀐다", async () => {
    renderWithQuery(<AskPage />);

    await userEvent.click(await screen.findByRole("button", { name: "지도: 광주 동구" }));

    expect(screen.getByRole("combobox", { name: "지역" })).toHaveValue("kr-12210");
    expect(await screen.findByRole("button", { name: "지도: 여수시" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "지도: 광주 동구" })).not.toBeInTheDocument();
  });

  it("실행 중에 지역을 바꾸면 그 질문은 끊고, 앞 질문의 결과 화면으로 넘어가지 않는다", async () => {
    mswServer.use(
      http.post("*/api/v1/questions", async () => {
        await delay(300);
        return HttpResponse.json(
          {
            schema_version: "c2-0.1",
            question_id: "q_1",
            run_id: "run_old",
            run_status: "partial",
            candidate: false,
          },
          { status: 201 },
        );
      }),
    );
    renderWithQuery(<AskPage />);
    await screen.findByRole("radio", { name: /청년 유출·정착/ });

    await userEvent.click(screen.getByRole("button", { name: "질문 실행" }));
    await userEvent.click(await screen.findByRole("button", { name: "지도: 광주 동구" }));

    expect(screen.getByRole("combobox", { name: "지역" })).toHaveValue("kr-12210");
    expect(await screen.findByRole("button", { name: "질문 실행" })).toBeInTheDocument();
    await new Promise((done) => setTimeout(done, 800));
    expect(push).not.toHaveBeenCalled();
  });

  it("쓰는 중에 세션이 끝나 401 이면 랜딩으로 보낸다", async () => {
    mswServer.use(http.get("*/api/v1/places", () => new HttpResponse(null, { status: 401 })));
    renderWithQuery(<AskPage />);

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});

describe("AskPage — 문장으로 질문", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
    mockApi();
  });

  afterEach(() => {
    cleanup();
    push.mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  const capture = () => {
    const sent: unknown[] = [];
    mswServer.use(
      http.post("*/api/v1/questions", async ({ request }) => {
        const body = (await request.json()) as { card_id: string | null };
        sent.push(body);
        return HttpResponse.json(
          {
            schema_version: "c2-0.1",
            question_id: "q_1",
            run_id: "run_s",
            run_status: body.card_id ? "partial" : "unsupported",
            candidate: body.card_id === null,
          },
          { status: 201 },
        );
      }),
    );
    return sent;
  };

  const askSentence = async (text: string) => {
    renderWithQuery(<AskPage />);
    await screen.findByRole("radio", { name: /청년 유출·정착/ });
    await userEvent.click(screen.getByRole("tab", { name: /문장으로 질문/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "문장으로 질문" }), `${text}{Enter}`);
  };

  it("문장에서 지역 · 이슈 · 기간을 읽어 칩으로 보여 주고, 원래 문장(raw_text)과 함께 실행한다", async () => {
    const sent = capture();
    await askSentence("여수 청년은 어디로 떠나고 있나");

    expect(await screen.findByRole("combobox", { name: "이슈 바꾸기" })).toHaveValue("C1");
    expect(screen.getByRole("combobox", { name: "지역 바꾸기" })).toHaveValue("kr-12130");
    expect(
      screen.getByText(/문장에 기간이 없어서 자료 범위 전체\(2023–2025\)로 채웠어요/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "질문 실행" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/results/run_s"));
    expect(sent).toEqual([
      {
        place_id: "kr-12130",
        card_id: "C1",
        period_start: "2023-01-01",
        period_end: "2026-01-01",
        raw_text: "여수 청년은 어디로 떠나고 있나",
      },
    ]);
  });

  it("맞는 이슈가 없으면 새 이슈 후보로 만든다(card_id null · 판단 안 함)", async () => {
    const sent = capture();
    await askSentence("2024년 여수 관광객 수는 어떻게 변했나");

    await userEvent.click(await screen.findByRole("button", { name: "새 이슈 후보 만들기" }));
    const dialog = await screen.findByRole("dialog", { name: "새 이슈 후보로 만들까요?" });
    expect(within(dialog).getByLabelText("이슈 이름")).toHaveValue("관광객 수");
    await userEvent.click(within(dialog).getByRole("button", { name: "새 이슈 후보 만들기" }));

    expect(await screen.findByText("새 이슈 후보로 만들었어요")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(sent).toEqual([
      {
        place_id: "kr-12130",
        card_id: null,
        period_start: "2024-01-01",
        period_end: "2025-01-01",
        raw_text: "2024년 여수 관광객 수는 어떻게 변했나\n이슈 이름: 관광객 수",
      },
    ]);
  });

  it("「광주」 만 있으면 지역을 비우고 어느 곳인지 고르게 한다", async () => {
    await askSentence("광주 미세먼지");

    expect(await screen.findByText(/「광주」의 어느 곳인지 골라 주세요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "질문 실행" })).toBeDisabled();
  });
});
