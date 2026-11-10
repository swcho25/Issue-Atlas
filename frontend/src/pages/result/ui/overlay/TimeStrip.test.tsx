import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { stripLayout, TimeStrip, yearTicks } from "./TimeStrip";

const months = ["2023-11", "2023-12", "2024-01", "2024-02"];

function Harness() {
  const [month, setMonth] = useState("2024-01");
  return (
    <TimeStrip
      months={months}
      means={[10, null, 20, 30]}
      value={month}
      unit="µg/m³"
      onChange={setMonth}
    />
  );
}

describe("stripLayout — 기간이 길어져도 막대가 보이게", () => {
  it.each([
    // 개월 · 사이 · 연 눈금 간격
    [36, 3, 1], // 3년: Figma 그대로
    [60, 2, 1], // 5년
    [120, 1, 1], // 10년
    [240, 0, 2], // 20년: 사이 없이, 연 눈금은 두 해마다
  ])("%i개월 → 사이 %i · 연 눈금 %i해마다", (count, gap, yearStep) => {
    const layout = stripLayout(count);
    expect(layout.gap).toBe(gap);
    expect(layout.yearStep).toBe(yearStep);
    // 막대는 늘 보이고(1 이상) 줄을 넘치지 않는다
    expect(layout.bar).toBeGreaterThanOrEqual(1);
    expect(layout.bar * count + layout.gap * (count - 1)).toBeCloseTo(490, 5);
  });
});

/** start(YYYY-MM)부터 count 개월 */
function monthsFrom(start: string, count: number) {
  const [y, m] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const t = y * 12 + m - 1 + i;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  });
}
const years = (months: string[]) => yearTicks(months).map((t) => t.year);

describe("yearTicks — 연 눈금이 겹치거나 줄 밖으로 나가지 않게", () => {
  it("1월 시작이면 해마다, 20년이면 두 해마다", () => {
    expect(years(monthsFrom("2023-01", 36))).toEqual(["2023", "2024", "2025"]);
    expect(years(monthsFrom("2017-01", 108))).toHaveLength(9);
    expect(years(monthsFrom("2006-01", 240))).toEqual(
      Array.from({ length: 10 }, (_, k) => String(2006 + k * 2)),
    );
  });

  it("1월이 아닌 달에 시작하면 다음 1월과 충분히 떨어질 때만 첫 칸에 그 해", () => {
    // 2016-11: 두 칸 뒤가 2017-01 → 「2016」 은 겹치므로 뺀다
    expect(years(monthsFrom("2016-11", 108))[0]).toBe("2017");
    expect(years(monthsFrom("2022-11", 36))).toEqual(["2023", "2024", "2025"]);
    // 2022-07: 여섯 칸(약 82) 뒤가 1월 → 둘 다 둔다
    expect(years(monthsFrom("2022-07", 36))).toEqual(["2022", "2023", "2024", "2025"]);
  });

  it("1월로 끝나면 마지막 1월 글자는 줄 밖이라 뺀다", () => {
    expect(years(monthsFrom("2023-02", 36))).toEqual(["2023", "2024", "2025"]);
  });
});

describe("TimeStrip", () => {
  it("키보드로 달을 바꾸고, 지금 달 · 측정소 평균을 낭독기에 알린다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const slider = screen.getByRole("slider", { name: "달 고르기" });
    expect(slider).toHaveAttribute("aria-valuetext", "2024-01 · 측정소 평균 20 µg/m³");

    slider.focus();
    await user.keyboard("{ArrowLeft}");
    expect(slider).toHaveAttribute("aria-valuetext", "2023-12 · 값 없음");
    await user.keyboard("{End}");
    expect(slider).toHaveAttribute("aria-valuenow", "3");
    await user.keyboard("{Home}");
    expect(screen.getByText("2023-11")).toBeVisible();
  });

  it("막대 줄을 누른 자리의 달로 바뀐다", () => {
    render(<Harness />);
    const slider = screen.getByRole("slider");
    // jsdom 은 크기가 0 이라 가로 400 으로 둔다: 오른쪽 끝(390)을 누르면 마지막 달
    slider.getBoundingClientRect = () => ({ left: 0, width: 400 }) as DOMRect;
    slider.setPointerCapture = () => {};
    fireEvent.pointerDown(slider, { clientX: 390, pointerId: 1 });
    expect(slider).toHaveAttribute("aria-valuenow", "3");
    fireEvent.pointerDown(slider, { clientX: 10, pointerId: 1 });
    expect(slider).toHaveAttribute("aria-valuenow", "0");
  });
});
