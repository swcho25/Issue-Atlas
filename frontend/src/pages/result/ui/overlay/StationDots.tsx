"use client";

import { Marker } from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef } from "react";

import { useMapInstance } from "@/shared/ui/map";

import { missingLabel, type StationPoint } from "../../model/distribution";

// 분포형 측정소 점(Figma 「결과 · 분포형 · 대기질」 Dot): 바깥 원(등급 색 18%, 지름 = 월평균) + 안쪽 점(바깥의 절반, 흰 테두리 1.5).
// 등급이 없는 지표면 남색(데이터 색). 값이 없는 달은 회색 빈 점 16(테두리 2 text-3) + 「측정소 · 사유」 이름표(흰 바탕 · 모서리 6 · 11).
// 점을 누르면(키보드 Enter · Space) 상세 창이 열리고, 고른 점에는 진한 테두리(Figma 「측정소 누름 → 상세 창」: 바깥의 79% · text-1 · 1.9).
// 지도 층이 아니라 Marker 로 그린다 — 바탕을 갈아 끼워도(밝은 ↔ 어두운) 남는다

/** 고른 점 테두리(처음엔 숨김) */
const RING = "pointer-events-none absolute hidden rounded-full border-2 border-text-1";

/** 누를 수 있는 점: 버튼 역할 · 초점 테두리 · 지도까지 누름이 가지 않게 */
function pressable(el: HTMLElement, p: StationPoint, label: string, onSelect: () => void) {
  el.dataset.station = p.id;
  el.setAttribute("role", "button");
  el.setAttribute("aria-haspopup", "dialog");
  el.setAttribute("aria-expanded", "false");
  el.setAttribute("aria-label", `${label} · 상세 보기`);
  el.tabIndex = 0;
  el.classList.add(
    "cursor-pointer",
    "rounded-full",
    "outline-none",
    "focus-visible:outline-2",
    "focus-visible:outline-offset-2",
    "focus-visible:outline-text-1",
  );
  el.addEventListener("click", (e) => {
    // 지도의 「빈 곳 누름 = 창 닫기」까지 가지 않게
    e.stopPropagation();
    onSelect();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onSelect();
  });
  return el;
}

function valueDot(p: StationPoint, unit: string | null) {
  const el = document.createElement("div");
  const color = p.grade?.className ?? "bg-map-region";
  el.className = "relative grid place-items-center";
  el.style.width = el.style.height = `${p.size}px`;
  el.innerHTML = `<span class="absolute inset-0 rounded-full opacity-18 ${color}"></span><span class="size-1/2 rounded-full ring-[1.5px] ring-white ${color}"></span><span data-ring class="${RING} inset-[10.5%]"></span>`;
  return {
    el,
    label: `${p.name} ${p.value}${unit ? ` ${unit}` : ""}${p.grade ? ` · ${p.grade.label}` : ""}`,
  };
}

function missingDot(p: StationPoint) {
  const el = document.createElement("div");
  el.className = "flex items-center gap-1";
  const dot = document.createElement("span");
  dot.className = "relative size-4 shrink-0 rounded-full border-2 border-text-3";
  dot.innerHTML = `<span data-ring class="${RING} -inset-1"></span>`;
  const tag = document.createElement("span");
  tag.className =
    "rounded-md bg-surface-1 px-2 py-0.75 text-caption-11 whitespace-nowrap text-text-2 shadow-xs";
  tag.textContent = missingLabel(p);
  el.append(dot, tag);
  return { el, label: missingLabel(p) };
}

/** 고른 달의 측정소 점을 지도에 놓는다. 달이 바뀌면 다시 놓는다 */
export function StationDots({
  points,
  unit,
  selectedId,
  onSelect,
}: {
  points: StationPoint[];
  unit: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const map = useMapInstance();
  const select = useRef(onSelect);
  useLayoutEffect(() => {
    select.current = onSelect;
  });
  const elements = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!map) return;
    const placed = elements.current;
    const markers = points.map((p) => {
      const { el, label } = p.value == null ? missingDot(p) : valueDot(p, unit);
      pressable(el, p, label, () => select.current(p.id));
      placed.set(p.id, el);
      return p.value == null
        ? // 빈 점 가운데가 그 자리에 오게: 왼쪽 끝 기준으로 놓고 점 반지름(8)만큼 왼쪽으로
          new Marker({ element: el, anchor: "left", offset: [-8, 0] }).setLngLat(p.at).addTo(map)
        : new Marker({ element: el }).setLngLat(p.at).addTo(map);
    });
    return () => {
      markers.forEach((m) => m.remove());
      placed.clear();
    };
  }, [map, points, unit]);

  // 고른 점 테두리 · 눌림 상태(점을 다시 놓지 않고 바꾼다 — 초점이 남는다)
  useEffect(() => {
    for (const [id, el] of elements.current) {
      const on = id === selectedId;
      el.setAttribute("aria-expanded", String(on));
      el.querySelector("[data-ring]")?.classList.toggle("hidden", !on);
    }
  }, [selectedId, points]);
  return null;
}
