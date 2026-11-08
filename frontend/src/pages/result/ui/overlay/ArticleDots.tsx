"use client";

import { Marker } from "maplibre-gl";
import { useEffect } from "react";

import { useMapInstance } from "@/shared/ui/map";

import type { ApproxGroup, ArticleDot } from "../../model/articles";

// 기사 점(Figma 「기사 점」): 주소 기사 = 남색 점 10 · 흰 테두리 2 · 옅은 그림자,
// 위치 근사 묶음 = 흰 60% · 남색 테두리 1.5 원 22 + 이름표(흰 92% · 모서리 4 · 안쪽 2 · 6 · Medium 11).
// 분포형 측정소 점처럼 지도 층이 아니라 Marker 로(바탕을 갈아 끼워도 남는다)

function dotElement(d: ArticleDot) {
  const el = document.createElement("span");
  el.className = "block size-2.5 rounded-full bg-map-region shadow-sm ring-2 ring-white";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `기사 ${d.name}`);
  el.title = d.name;
  return el;
}

function groupElement(g: ApproxGroup) {
  const el = document.createElement("div");
  el.className = "flex items-center gap-1";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", g.name);
  const ring = document.createElement("span");
  ring.className = "size-[22px] shrink-0 rounded-full border-[1.5px] border-map-region bg-white/60";
  const tag = document.createElement("span");
  tag.className =
    "rounded-sm bg-white/92 px-1.5 py-0.5 text-caption-11 font-medium whitespace-nowrap text-text-1";
  tag.textContent = g.name;
  el.append(ring, tag);
  return el;
}

/** 기사 점 · 위치 근사 묶음을 지도에 놓는다. 묶음은 원 가운데가 그 자리에 오게(왼쪽 기준 · 반지름 11 만큼) */
export function ArticleDots({ dots, groups }: { dots: ArticleDot[]; groups: ApproxGroup[] }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map) return;
    const markers = [
      ...groups.map((g) =>
        new Marker({ element: groupElement(g), anchor: "left", offset: [-11, 0] })
          .setLngLat(g.at)
          .addTo(map),
      ),
      ...dots.map((d) => new Marker({ element: dotElement(d) }).setLngLat(d.at).addTo(map)),
    ];
    return () => markers.forEach((m) => m.remove());
  }, [map, dots, groups]);
  return null;
}

/**
 * 기사 점 범례(Figma Legend · 기사 점 193 × 112: 흰 면 · 모서리 12 · 안쪽 12 · 14 · 사이 8, 「보도 기사」 Bold 13 · 줄 Regular 13 text-2).
 * Figma 의 「고른 달」(◆)은 변화형에 달 고르기가 없어 뺐다
 */
export function ArticleLegend({ hasDots, hasGroups }: { hasDots: boolean; hasGroups: boolean }) {
  return (
    <section
      aria-label="기사 점 범례"
      className="flex flex-col gap-2 rounded-xl border border-text-1/6 bg-surface-1 px-3.5 py-3 shadow-legend"
    >
      <p className="text-label-13 font-bold text-text-1">보도 기사</p>
      {hasDots && (
        <p className="flex items-center gap-2 text-body-13 text-text-2">
          <span aria-hidden className="size-[9px] shrink-0 rounded-full bg-map-region" />
          주소가 있는 기사
        </p>
      )}
      {hasGroups && (
        <p className="flex items-center gap-2 text-body-13 text-text-2">
          <span
            aria-hidden
            className="size-[11px] shrink-0 rounded-full border-[1.5px] border-map-region"
          />
          위치 근사 (행정구역 중심)
        </p>
      )}
    </section>
  );
}
