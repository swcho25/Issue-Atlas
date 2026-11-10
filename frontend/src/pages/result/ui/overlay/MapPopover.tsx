"use client";

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Icon } from "@/shared/ui/icon";
import { useMapInstance } from "@/shared/ui/map";

// 지도 위 지점 상세 창 틀(DESIGN.md 「지점을 누르면 그 점 옆에 작은 창(모서리 18 + 꼬리)」, Figma 「결과 · 측정소 누름 → 상세 창」 Popover 360:
// 흰 · 모서리 18 · 테두리 검정 6% · 안쪽 18 · 20 · 사이 12). 측정소 창 · 기사 창이 함께 쓴다.
// 점 오른쪽 30 에 꼬리(16 정사각 45°)와 함께 뜨고, 점은 창 위에서 60 아래. 지도를 움직이면 점을 따라간다.
// 머리(제목 · 닫기). 닫기 · Esc · 지도 빈 곳 누름으로 닫힌다(점을 누르면 점이 막아 지도까지 가지 않는다)

const WIDTH = 360;
/** 점 가운데에서 창 가장자리까지 */
const GAP = 30;
/** 창 위에서 점(꼬리)까지 */
const DOT_FROM_TOP = 60;
/** 지도 가장자리에서 띄울 거리 */
const EDGE = 16;
/** 꼬리가 모서리(18)에 걸리지 않게 위아래 끝에서 띄울 거리 */
const TAIL_INSET = 26;

/**
 * 창 자리: 점 오른쪽에 자리가 없으면 왼쪽. 위아래는 지도 안에 두고, 꼬리는 점 높이(창 안쪽으로 줄여서)
 */
export function popoverPlacement(
  dot: { x: number; y: number },
  size: { width: number; height: number },
  area: { width: number; height: number },
) {
  const side = dot.x + GAP + size.width <= area.width - EDGE ? "right" : "left";
  const left = side === "right" ? dot.x + GAP : Math.max(EDGE, dot.x - GAP - size.width);
  const top = Math.max(EDGE, Math.min(dot.y - DOT_FROM_TOP, area.height - size.height - EDGE));
  const tail = Math.max(TAIL_INSET, Math.min(dot.y - top, size.height - TAIL_INSET));
  return { side, left, top, tail } as const;
}

/** 점의 화면 자리. 지도가 움직이면 다시 잰다 */
function useDotPosition(at: [number, number]) {
  const map = useMapInstance();
  const [pos, setPos] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const p = map.project(at);
      const box = map.getContainer();
      setPos({ x: p.x, y: p.y, width: box.clientWidth, height: box.clientHeight });
    };
    update();
    map.on("move", update);
    map.on("resize", update);
    return () => {
      map.off("move", update);
      map.off("resize", update);
    };
  }, [map, at]);
  return pos;
}

export function MapPopover({
  at,
  focusKey,
  titleId,
  title,
  onClose,
  children,
}: {
  /** 점 자리(경도 · 위도) */
  at: [number, number];
  /** 이 값이 바뀌면(다른 점을 누르면) 창으로 다시 초점 */
  focusKey: string;
  titleId: string;
  title: ReactNode;
  /** refocus: 닫은 뒤 점으로 초점을 돌릴지(닫기 · Esc) */
  onClose: (refocus: boolean) => void;
  children: ReactNode;
}) {
  const map = useMapInstance();
  const pos = useDotPosition(at);
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  // 창이 붙으면 높이(내용에 따라 다르다)를 재서 자리를 맞춘다
  const attach = useCallback((el: HTMLDivElement | null) => {
    box.current = el;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // 창이 보이면(높이를 재기 전엔 숨어 있어 초점을 못 받는다) · 다른 점을 누르면 창으로 초점 — 낭독기가 창을 읽는다
  const shown = height > 0;
  useEffect(() => {
    if (shown) box.current?.focus({ preventScroll: true });
  }, [focusKey, shown]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current(true);
    const onMapClick = () => onCloseRef.current(false);
    document.addEventListener("keydown", onKey);
    map?.on("click", onMapClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      map?.off("click", onMapClick);
    };
  }, [map]);

  if (!pos) return null;
  const place = popoverPlacement(pos, { width: WIDTH, height }, pos);

  return (
    <div
      ref={attach}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      // 높이를 재기 전(첫 그림)에는 숨긴다 — 자리가 튀지 않게
      className={`absolute z-popover flex w-[360px] flex-col gap-3 rounded-[18px] bg-surface-1 px-5 py-4.5 shadow-card inset-ring inset-ring-black/6 outline-none ${height ? "" : "invisible"}`}
      style={{ left: place.left, top: place.top }}
    >
      {/* 꼬리: 16 정사각을 45° 돌려 창 가장자리에 반쯤 걸친다 */}
      <span
        aria-hidden
        className={`absolute size-4 rotate-45 bg-surface-1 ${place.side === "right" ? "-left-px" : "-right-px"}`}
        style={{ top: place.tail - 8 }}
      />
      <div className="relative flex items-center gap-2">
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-heading-16 text-text-1">
          {title}
        </h2>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => onClose(true)}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-text-1 hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-text-1"
        >
          <Icon name="close" className="size-4" />
        </button>
      </div>
      {children}
    </div>
  );
}
