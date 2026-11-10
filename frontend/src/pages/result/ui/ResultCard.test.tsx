import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { argumentSchema } from "@/shared/api";

import a3Json from "../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import { ResultCard } from "./ResultCard";

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
