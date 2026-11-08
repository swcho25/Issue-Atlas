"use client";

import { Marker } from "maplibre-gl";
import { useEffect } from "react";

import { useMapInstance } from "@/shared/ui/map";

import { missingLabel, type StationPoint } from "../../model/distribution";

// 분포형 측정소 점(Figma 「결과 · 분포형 · 대기질」 Dot): 바깥 원(등급 색 18%, 지름 = 월평균) + 안쪽 점(바깥의 절반, 흰 테두리 1.5).
// 등급이 없는 지표면 남색(데이터 색). 값이 없는 달은 회색 빈 점 16(테두리 2 text-3) + 「측정소 · 사유」 이름표(흰 바탕 · 모서리 6 · 11).
// 지도 층이 아니라 Marker 로 그린다 — 바탕을 갈아 끼워도(밝은 ↔ 어두운) 남는다

function valueDot(p: StationPoint, unit: string | null) {
  const el = document.createElement("div");
  const color = p.grade?.className ?? "bg-map-region";
  el.className = "relative grid place-items-center";
  el.style.width = el.style.height = `${p.size}px`;
  el.setAttribute("role", "img");
  el.setAttribute(
    "aria-label",
    `${p.name} ${p.value}${unit ? ` ${unit}` : ""}${p.grade ? ` · ${p.grade.label}` : ""}`,
  );
  el.innerHTML = `<span class="absolute inset-0 rounded-full opacity-18 ${color}"></span><span class="size-1/2 rounded-full ring-[1.5px] ring-white ${color}"></span>`;
  return el;
}

function missingDot(p: StationPoint) {
  const el = document.createElement("div");
  el.className = "flex items-center gap-1";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", missingLabel(p));
  const dot = document.createElement("span");
  dot.className = "size-4 shrink-0 rounded-full border-2 border-text-3";
  const tag = document.createElement("span");
  tag.className =
    "rounded-md bg-surface-1 px-2 py-0.75 text-caption-11 whitespace-nowrap text-text-2 shadow-xs";
  tag.textContent = missingLabel(p);
  el.append(dot, tag);
  return el;
}

/** 고른 달의 측정소 점을 지도에 놓는다. 달이 바뀌면 다시 놓는다 */
export function StationDots({ points, unit }: { points: StationPoint[]; unit: string | null }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map) return;
    const markers = points.map((p) =>
      p.value == null
        ? // 빈 점 가운데가 그 자리에 오게: 왼쪽 끝 기준으로 놓고 점 반지름(8)만큼 왼쪽으로
          new Marker({ element: missingDot(p), anchor: "left", offset: [-8, 0] })
            .setLngLat(p.at)
            .addTo(map)
        : new Marker({ element: valueDot(p, unit) }).setLngLat(p.at).addTo(map),
    );
    return () => markers.forEach((m) => m.remove());
  }, [map, points, unit]);
  return null;
}
