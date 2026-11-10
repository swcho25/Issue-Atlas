import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { argumentSchema } from "@/shared/api";
import { renderWithQuery } from "@/shared/lib/test";

import a3Json from "../../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import { stationPoints, stationSeries } from "../../model/distribution";
import { popoverPlacement } from "./MapPopover";
import { StationDetail } from "./StationDetail";

// 지도는 jsdom 에서 그리지 않는다: 점은 (400, 300), 지도는 1600 × 900 으로 둔다.
// 실제처럼 같은 지도 하나를 돌려준다(부를 때마다 새 객체면 자리 재기가 끝없이 돈다)
const fakeMap = vi.hoisted(() => ({
  project: () => ({ x: 400, y: 300 }),
  getContainer: () => ({ clientWidth: 1600, clientHeight: 900 }),
  on: () => {},
  off: () => {},
}));
vi.mock("@/shared/ui/map", () => ({ useMapInstance: () => fakeMap }));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

const a3 = argumentSchema.parse(a3Json);
const stations = stationSeries(a3);

describe("popoverPlacement — 점 옆 자리", () => {
  const size = { width: 360, height: 300 };
  const area = { width: 1600, height: 900 };

  it("보통은 점 오른쪽 30 · 점은 창 위에서 60 아래(Figma)", () => {
    expect(popoverPlacement({ x: 800, y: 400 }, size, area)).toEqual({
      side: "right",
      left: 830,
      top: 340,
      tail: 60,
    });
  });

  it("오른쪽에 자리가 없으면 점 왼쪽", () => {
    const p = popoverPlacement({ x: 1400, y: 400 }, size, area);
    expect(p.side).toBe("left");
    expect(p.left).toBe(1400 - 30 - 360);
  });

  it("위아래는 지도 안(가장자리 16)에 두고, 꼬리는 점 높이를 따르되 모서리에 걸리지 않게", () => {
    const top = popoverPlacement({ x: 800, y: 20 }, size, area);
    expect(top.top).toBe(16);
    expect(top.tail).toBe(26);
    const bottom = popoverPlacement({ x: 800, y: 880 }, size, area);
    expect(bottom.top).toBe(900 - 300 - 16);
    expect(bottom.tail).toBe(300 - 26);
  });
});

describe("StationDetail", () => {
  it("측정소 이름 · 그 달 값 · 등급 · 근거 줄을 보이고, 원문 탭으로 잇는다", () => {
    const [point] = stationPoints(stations, "2023-03");
    renderWithQuery(
      <StationDetail
        point={point}
        month="2023-03"
        unit="µg/m³"
        refs={a3.data.statistics}
        runId={a3.run_id}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "서강동 측정소" });
    expect(dialog).toHaveTextContent("22.8");
    expect(dialog).toHaveTextContent("µg/m³ · 2023-03 월평균");
    expect(dialog).toHaveTextContent("보통"); // PM2.5 22.8 → 보통(15 초과 35 이하)
    expect(dialog).toHaveTextContent("이 값의 근거 1건");
    expect(screen.getByRole("link", { name: /원문 보기/ })).toHaveAttribute(
      "href",
      `/results/${a3.run_id}/sources?e=ev_air_final_yeosu`,
    );
  });

  it("값이 없는 달은 「—」 와 사유, Esc · 닫기는 점으로 초점을 돌리며 닫는다", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const series = stations.map((s) => ({
      ...s,
      values: s.values.map((v, i) => (i === 0 ? null : v)),
      statuses: s.statuses.map((st, i) => (i === 0 ? ("not_published" as const) : st)),
    }));
    const [point] = stationPoints(series, "2023-01");
    renderWithQuery(
      <StationDetail
        point={point}
        month="2023-01"
        unit="µg/m³"
        refs={a3.data.statistics}
        runId={a3.run_id}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("—");
    expect(dialog).toHaveTextContent("미공표");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
