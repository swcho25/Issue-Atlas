"use client";

import { Marker } from "maplibre-gl";
import { useEffect } from "react";

import { Icon } from "@/shared/ui/icon";
import { useMapInstance } from "@/shared/ui/map";

import { ORDER_CAPTION, type OrderStop } from "../../model/observationOrder";

// 관측 순서 그림. Figma v5 에는 이 화면이 없어(「꺼 둠 · 대표 확인 전」) 11/01 대표 결정 #5(그림 유지 · 이름 「관측 순서」)대로
// 보관 시안(v1 「분포형 · 관측 순서」)의 번호 원만 v5 토큰으로 옮겼다. 시안의 「관측 순서 선」은 옮겨 간 경로로 읽혀 그리지 않는다.
// 지도: 지역 대표점에 번호 원(흰 면 · 남색 테두리 2 · 번호 Bold 11). 시트: 변화형 그림 시트와 같은 틀(520 · 모서리 18)에 순서 목록 + 고정 문구

function stopElement(s: OrderStop) {
  const el = document.createElement("span");
  el.className =
    "grid size-6 place-items-center rounded-full border-2 border-map-region bg-surface-1 text-caption-11 font-bold text-map-region shadow-sm";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `관측 순서 ${s.rank} · ${s.name} · ${s.first} 첫 기사`);
  el.title = `${s.rank} · ${s.name} · ${s.first} 첫 기사 · 기사 ${s.total}건`;
  el.textContent = String(s.rank);
  return el;
}

/** 지역마다 번호 원을 놓는다(대표점이 없는 지역은 목록에만) */
export function OrderMarkers({ stops }: { stops: OrderStop[] }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map) return;
    const markers = stops.flatMap((s) =>
      s.at ? [new Marker({ element: stopElement(s) }).setLngLat(s.at).addTo(map)] : [],
    );
    return () => markers.forEach((m) => m.remove());
  }, [map, stops]);
  return null;
}

/** 순서 목록 시트: 번호 · 지역 · 첫 기사 달 · 기사 수, 아래 고정 문구 「첫 관측 순서, 옮겨 간 경로·원인 아님」 */
export function OrderSheet({ stops }: { stops: OrderStop[] }) {
  return (
    <section
      aria-label="관측 순서 그림"
      className="pointer-events-auto flex w-[520px] flex-col gap-2.5 rounded-[18px] border border-text-1/6 bg-surface-1 px-6 py-5 shadow-legend"
    >
      <header className="grid gap-0.5">
        <h2 className="text-heading-16 leading-4.5 text-text-1">관측 순서 · 월</h2>
        <p className="text-caption-12 leading-3.5 text-text-3">
          카드 관련 보도 기사 · 지역마다 처음 나온 달 · 지역 {stops.length}곳
        </p>
      </header>
      <ol className="flex max-h-44 [scrollbar-width:thin] flex-col gap-1 overflow-y-auto">
        {stops.map((s) => (
          <li
            key={s.placeId}
            className="flex h-8 shrink-0 items-center gap-2.5 rounded-lg bg-surface-2 px-2.5"
          >
            <span
              aria-label={`${s.rank}번째`}
              className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-map-region bg-surface-1 text-caption-11 font-bold text-map-region"
            >
              {s.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-label-12 text-text-1">{s.name}</span>
            <span className="shrink-0 text-caption-12 text-text-2">{s.first} 첫 기사</span>
            <span className="w-12 shrink-0 text-right text-label-12 text-text-1">{s.total}건</span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-1.5 text-caption-12 text-text-2">
        <Icon name="alert" className="mt-0.5 size-3 shrink-0 text-text-3" />
        {ORDER_CAPTION}
      </p>
    </section>
  );
}
