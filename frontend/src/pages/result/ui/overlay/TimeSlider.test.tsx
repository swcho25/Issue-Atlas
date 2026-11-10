import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { TimeSlider } from "./TimeSlider";

// 2023-11 ~ 2025-02 (16개월)
const months = Array.from({ length: 16 }, (_, i) => {
  const t = 2023 * 12 + 10 + i;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
});

function Harness({ start = "2025-02" }: { start?: string }) {
  const [month, setMonth] = useState(start);
  return <TimeSlider months={months} value={month} onChange={setMonth} />;
}

describe("TimeSlider", () => {
  it("점 하나: 고른 달을 글자와 낭독기에 알리고, 줄 양 끝에 시작 · 끝 달을 적는다", () => {
    render(<Harness />);
    const slider = screen.getByRole("slider", { name: "달 고르기" });
    expect(slider).toHaveAttribute("aria-valuetext", "2025-02");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "15");
    expect(slider).toHaveAttribute("aria-valuenow", "15");
    // 슬라이더는 하나뿐(시작 · 끝 손잡이를 두지 않는다)
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    const section = screen.getByRole("region", { name: "시간 슬라이더" });
    expect(section).toHaveTextContent("2023-11");
    expect(section).toHaveTextContent("2025-02");
  });

  it("키보드: ← → 한 달 · PageUp PageDown 열두 달 · Home End 처음 끝, 줄 밖으로 나가지 않는다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const slider = screen.getByRole("slider");
    slider.focus();
    await user.keyboard("{ArrowLeft}");
    expect(slider).toHaveAttribute("aria-valuetext", "2025-01");
    await user.keyboard("{PageDown}");
    expect(slider).toHaveAttribute("aria-valuetext", "2024-01");
    await user.keyboard("{Home}");
    expect(slider).toHaveAttribute("aria-valuetext", "2023-11");
    await user.keyboard("{ArrowLeft}");
    expect(slider).toHaveAttribute("aria-valuetext", "2023-11");
    await user.keyboard("{End}{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuetext", "2025-02");
  });

  it("줄을 누르거나 끌면 가장 가까운 달로", () => {
    render(<Harness />);
    const slider = screen.getByRole("slider");
    // jsdom 은 크기가 0 이라 가로 300 으로 둔다(한 달 20)
    slider.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
    slider.setPointerCapture = () => {};
    slider.hasPointerCapture = () => true;
    fireEvent.pointerDown(slider, { clientX: 0, pointerId: 1 });
    expect(slider).toHaveAttribute("aria-valuetext", "2023-11");
    // 45 는 둘째(20) · 셋째(40) 달 사이에서 셋째에 가깝다
    fireEvent.pointerMove(slider, { clientX: 45, pointerId: 1 });
    expect(slider).toHaveAttribute("aria-valuetext", "2024-01");
    fireEvent.pointerMove(slider, { clientX: 999, pointerId: 1 });
    expect(slider).toHaveAttribute("aria-valuetext", "2025-02");
  });

  it("끄는 동안 글자 선택 · 브라우저 끌어다 놓기가 끼어들지 않는다(끼어들면 포인터 입력이 취소돼 점이 안 따라온다)", () => {
    render(<Harness />);
    // 눈금 글자를 선택하지 못하게(선택이 생기면 다음 끌기가 끌어다 놓기로 바뀐다)
    expect(screen.getByRole("region", { name: "시간 슬라이더" })).toHaveClass("select-none");
    // 끌어다 놓기 시작은 막는다(fireEvent 는 preventDefault 되면 false)
    expect(fireEvent.dragStart(screen.getByRole("slider"))).toBe(false);
  });
});
