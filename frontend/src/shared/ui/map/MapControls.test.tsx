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
});
