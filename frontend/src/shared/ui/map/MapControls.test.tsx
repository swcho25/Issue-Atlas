import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Map as MapLibreMap } from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";

import { MapControls } from "./MapControls";

// MapLibre 는 jsdom 에서 못 그리므로, 버튼이 쓰는 것만 가진 가짜 지도
function fakeMap(zoom = 8, [min, max] = [0, 22]) {
  const listeners = new Set<() => void>();
  const map = {
    zoom,
    getZoom: () => map.zoom,
    getMinZoom: () => min,
    getMaxZoom: () => max,
    zoomIn: vi.fn(() => (map.zoom += 1)),
    zoomOut: vi.fn(() => (map.zoom -= 1)),
    on: (_: string, f: () => void) => listeners.add(f),
    off: (_: string, f: () => void) => listeners.delete(f),
    zoomEnd: () => act(() => listeners.forEach((f) => f())),
  };
  return map;
}
const asMap = (m: ReturnType<typeof fakeMap>) => m as unknown as MapLibreMap;

describe("MapControls", () => {
  it("확대 · 축소는 지도 확대 수준을 바꾸고, 위치는 onLocate 를 부른다", async () => {
    const user = userEvent.setup();
    const map = fakeMap();
    const onLocate = vi.fn();
    render(<MapControls map={asMap(map)} onLocate={onLocate} />);

    await user.click(screen.getByRole("button", { name: "확대" }));
    await user.click(screen.getByRole("button", { name: "축소" }));
    await user.click(screen.getByRole("button", { name: "고른 지역으로 돌아가기" }));

    expect(map.zoomIn).toHaveBeenCalledOnce();
    expect(map.zoomOut).toHaveBeenCalledOnce();
    expect(onLocate).toHaveBeenCalledOnce();
  });

  it("확대 수준이 끝에 닿으면 그쪽 버튼이 꺼진다", () => {
    const map = fakeMap(21, [0, 22]);
    render(<MapControls map={asMap(map)} onLocate={() => {}} />);
    expect(screen.getByRole("button", { name: "확대" })).toBeEnabled();

    map.zoomIn();
    map.zoomEnd();
    expect(screen.getByRole("button", { name: "확대" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "축소" })).toBeEnabled();
  });

  it("맞출 경계가 없으면(onLocate 없음) 위치 버튼이 꺼진다", () => {
    render(<MapControls map={asMap(fakeMap())} />);
    expect(screen.getByRole("button", { name: "고른 지역으로 돌아가기" })).toBeDisabled();
  });

  it("레이어 버튼은 지도 레이어 패널을 열고, 줄을 누르면 그 층을 켜고 끈다. Esc 로 닫으면 버튼으로 돌아온다", async () => {
    const user = userEvent.setup();
    const onToggleLayer = vi.fn();
    const layers = [
      { id: "sigungu", label: "시군구 경계", on: true },
      { id: "emd", label: "행정동 경계", on: false },
    ];
    render(<MapControls map={asMap(fakeMap())} layers={layers} onToggleLayer={onToggleLayer} />);
    const button = screen.getByRole("button", { name: "지도 레이어" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("switch")).toBeNull();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("switch", { name: "시군구 경계" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("switch", { name: "행정동 경계" }));
    expect(onToggleLayer).toHaveBeenCalledWith("emd");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("switch")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("지도 레이어 패널은 묶음 바깥을 누르면 닫힌다", async () => {
    const user = userEvent.setup();
    render(
      <>
        <MapControls
          map={asMap(fakeMap())}
          layers={[{ id: "sigungu", label: "시군구 경계", on: true }]}
        />
        <p>지도 바깥</p>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "지도 레이어" }));
    expect(screen.getByRole("switch")).toBeVisible();
    await user.click(screen.getByText("지도 바깥"));
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("layers 가 없으면 레이어 버튼이 없다", () => {
    render(<MapControls map={asMap(fakeMap())} />);
    expect(screen.queryByRole("button", { name: "지도 레이어" })).toBeNull();
  });
});
