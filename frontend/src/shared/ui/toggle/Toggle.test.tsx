import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toggle } from "./Toggle";

function Controlled({ disabled = false }: { disabled?: boolean }) {
  const [on, setOn] = useState(false);
  return <Toggle checked={on} onChange={setOn} label="어두운 화면" disabled={disabled} />;
}

describe("Toggle", () => {
  afterEach(cleanup);

  it("스위치 역할 · 이름 · 켜짐 상태를 알리고, 누르면 바뀐다", async () => {
    render(<Controlled />);
    const toggle = screen.getByRole("switch", { name: "어두운 화면" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    // 키보드로도(스페이스) 바뀐다
    await userEvent.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("비활성이면 누를 수 없다", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="지형 음영" disabled />);
    await userEvent.click(screen.getByRole("switch", { name: "지형 음영" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
