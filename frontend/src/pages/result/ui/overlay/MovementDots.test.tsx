import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fitSpots, MovementDots } from "./MovementDots";

// 지도는 jsdom 에서 그리지 않는다: 지금 자리(camera)만 가진 가짜 지도. 범위를 맞추면 자리가 「넓힌 자리」 로 바뀐다
const fakeMap = vi.hoisted(() => {
  const map = {
    camera: { center: "고른 지역", zoom: 9 },
    getCenter: () => map.camera.center,
    getZoom: () => map.camera.zoom,
    getContainer: () => ({ clientWidth: 1600, clientHeight: 900 }),
    fitBounds: vi.fn(() => {
      map.camera = { center: "전국", zoom: 6 };
    }),
    easeTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  return map;
});
vi.mock("@/shared/ui/map", () => ({ useMapInstance: () => fakeMap }));
vi.mock("maplibre-gl", () => ({
  Marker: class {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  },
  LngLatBounds: class {
    extend() {
      return this;
    }
  },
}));

const from: [number, number] = [127.67, 34.76];
/** 그 달의 원(자리는 같고 크기 · 이름표만 달마다 다르다) */
const dotsOf = (seoul: number, gyeonggi: number) => [
  {
    to: "kr-41",
    at: [127.0, 37.4] as [number, number],
    name: "경기",
    label: `경기도 ${gyeonggi}명`,
    size: 44,
  },
  {
    to: "kr-11",
    at: [126.94, 37.56] as [number, number],
    name: "서울",
    label: `서울특별시 ${seoul}명`,
    size: 40,
  },
];

beforeEach(() => {
  fakeMap.camera = { center: "고른 지역", zoom: 9 };
  fakeMap.fitBounds.mockClear();
  fakeMap.easeTo.mockClear();
  // 다음 그림 틀을 바로 실행
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
    run(0);
    return 1;
  });
});

describe("fitSpots — 지도를 맞출 자리", () => {
  it("도착지 대표점 + 출발지. 순서 · 크기가 달라도 자리가 같으면 같은 글자", () => {
    const a = fitSpots(dotsOf(141, 126), from);
    expect(a).toBe("126.94,37.56|127,37.4|127.67,34.76");
    expect(fitSpots([...dotsOf(161, 149)].reverse(), from)).toBe(a);
    // 출발지 대표점이 없으면 도착지만, 원이 없으면 빈 글자(맞추지 않는다)
    expect(fitSpots(dotsOf(1, 1), null)).toBe("126.94,37.56|127,37.4");
    expect(fitSpots([], from)).toBe("");
  });
});

describe("MovementDots — 지도 범위", () => {
  it("켜면 도착지가 보이게 한 번 넓히고, 달이 바뀌어도(자리가 같으면) 다시 맞추지 않는다", () => {
    const view = render(<MovementDots dots={dotsOf(141, 126)} from={from} />);
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    // 시간 슬라이더로 달을 바꾸면 원이 새로 온다(값만 다름)
    view.rerender(<MovementDots dots={dotsOf(161, 149)} from={from} />);
    view.rerender(<MovementDots dots={dotsOf(125, 149)} from={from} />);
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    // 달을 바꾸는 동안 「켜기 전 자리」 로 돌아가려 하지 않는다(지도가 움찔하지 않게)
    expect(fakeMap.easeTo).not.toHaveBeenCalled();
  });

  it("끄면(다른 유형으로) 켜기 전 자리로 — 달을 바꾼 뒤에도 넓힌 자리가 아니라 처음 자리", () => {
    const view = render(<MovementDots dots={dotsOf(141, 126)} from={from} />);
    view.rerender(<MovementDots dots={dotsOf(161, 149)} from={from} />);
    view.unmount();
    expect(fakeMap.easeTo).toHaveBeenCalledTimes(1);
    expect(fakeMap.easeTo).toHaveBeenCalledWith({ center: "고른 지역", zoom: 9, duration: 600 });
  });

  it("도착지가 달라지면(값이 빈 시도가 빠짐) 그때는 다시 맞춘다", () => {
    const view = render(<MovementDots dots={dotsOf(141, 126)} from={from} />);
    view.rerender(<MovementDots dots={dotsOf(141, 126).slice(0, 1)} from={from} />);
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(2);
    expect(fakeMap.easeTo).not.toHaveBeenCalled();
  });
});
