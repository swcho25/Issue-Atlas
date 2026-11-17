import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { argumentSchema } from "@/shared/api";

import a3Json from "../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import { ResultCard } from "./ResultCard";
import { useViewState, ViewStateProvider } from "./viewState";

vi.mock("next/navigation", () => ({
  usePathname: () => "/results/run_x",
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

// 카드 틀(CardShell)이 스크롤 높이를 잰다 — jsdom 에 없는 ResizeObserver 를 빈 것으로
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("결과 카드 관측 요약 칩", () => {
  it("측정소 결과(A3)는 기간 줄 아래에 측정소 수 · 최고 · 최저 칩", () => {
    render(<ResultCard argument={argumentSchema.parse(a3Json)} />);
    const chips = within(screen.getByRole("list", { name: "관측 요약" })).getAllByRole("listitem");
    expect(chips.map((c) => c.textContent?.replace(/ \(.*\)$/, ""))).toEqual([
      "측정소 1곳",
      expect.stringMatching(/^최고 \d+ · \d{4}-\d{2}$/),
      expect.stringMatching(/^최저 \d+ · \d{4}-\d{2}$/),
    ]);
    // 어느 측정소 값인지는 툴팁 · 낭독기 글자로
    expect(chips[1]).toHaveAttribute("title", expect.stringContaining("서강동 측정소"));
    // 판정 규칙의 값(해마다 평균의 변화)은 칩으로 만들지 않는다 — 비교 불가 결과에서 증감으로 읽히지 않게
    expect(screen.queryByText(/연평균/)).toBeNull();
  });

  it("측정소 줄이 없는 결과(C1)는 칩이 없다", () => {
    render(<ResultCard argument={argumentSchema.parse(readyJson)} />);
    expect(screen.queryByRole("list", { name: "관측 요약" })).toBeNull();
  });
});

/** 지도 위 부품 대신: 유형 · 달을 바꾸는 버튼(실제로는 유형 전환 · 시간 슬라이더가 바꾼다) */
function Controls() {
  const { setView, setMonth } = useViewState();
  return (
    <>
      <button onClick={() => setView("movement")}>이동형</button>
      <button onClick={() => setView("change")}>변화형</button>
      <button onClick={() => setMonth("2024-03")}>2024-03</button>
    </>
  );
}

describe("결과 카드 이동형 메타 줄", () => {
  const note = () => screen.queryByText(/전 연령 · 집계 이동량, 이동 경로 아님/);

  it("이동형을 골랐을 때만 기간 줄 아래에 보이고, 줄 끝은 슬라이더에서 고른 달", async () => {
    const user = userEvent.setup();
    render(
      <ViewStateProvider initialView="change" initialMonth="2025-12">
        <ResultCard argument={argumentSchema.parse(readyJson)} />
        <Controls />
      </ViewStateProvider>,
    );
    // 처음 유형(변화형)에는 없다 — Figma 변화형 카드에 없는 줄
    expect(note()).toBeNull();
    await user.click(screen.getByRole("button", { name: "이동형" }));
    expect(note()).toHaveTextContent("전 연령 · 집계 이동량, 이동 경로 아님 · 2025-12");
    // 슬라이더로 달을 바꾸면 같이 바뀐다
    await user.click(screen.getByRole("button", { name: "2024-03" }));
    expect(note()).toHaveTextContent("전 연령 · 집계 이동량, 이동 경로 아님 · 2024-03");
    await user.click(screen.getByRole("button", { name: "변화형" }));
    expect(note()).toBeNull();
  });

  it("지도 없이 카드만 그리면(공유 상태 없음) 나오지 않는다", () => {
    render(<ResultCard argument={argumentSchema.parse(readyJson)} />);
    expect(note()).toBeNull();
  });
});
