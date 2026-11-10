"use client";

import { LngLatBounds, type Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect } from "react";

import { useMapInstance } from "@/shared/ui/map";

import type { movementDots } from "../../model/movement";

// 이동형 지도(사용자 결정 11/09 — 「도착 지역을 지도에 하이라이트, 테두리 말고 대표점으로」): 도착 시도 대표점마다 남색 원
// (막대와 같은 data-navy, 지름 = 이동자 수 넓이 비율), 모든 원 안에 짧은 이름(사용자 결정 11/09). 출발지에는 점을 찍지 않는다(경계로 보인다).
// 선 · 화살표는 그리지 않는다(11/01 대표 결정 — 이동 경로로 읽힌다). 지도 층이 아니라 Marker 로 그린다(바탕을 갈아 끼워도 남는다).
// 켜면 도착지가 모두 보이게 지도를 넓히고(카드 · 그림 시트 자리는 비움), 끄면 켜기 전 자리로 돌아간다.
// 달(시간 슬라이더)을 바꿔도 도착지 자리가 같으면 지도는 그대로 둔다

type Dot = ReturnType<typeof movementDots>[number];

/** 지도를 맞출 때 비울 자리: 카드(왼쪽 24 + 400 + 64) · 유형 전환(위) · 지도 버튼(오른쪽) · 그림 시트 + 유리 바(아래 약 420) */
const PADDING = { top: 80, right: 80, bottom: 420, left: 488 };

/** 여백이 지도보다 넓으면 맞출 수 없어(MapLibre 가 크게 물러남) 좁은 창에서는 줄인다 — MapView 와 같은 70% 규칙 */
function fitPadding(map: MapLibreMap) {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const sx = Math.min(1, (w * 0.7) / (PADDING.left + PADDING.right));
  const sy = Math.min(1, (h * 0.7) / (PADDING.top + PADDING.bottom));
  return {
    top: PADDING.top * sy,
    bottom: PADDING.bottom * sy,
    left: PADDING.left * sx,
    right: PADDING.right * sx,
  };
}

/**
 * 지도를 맞출 자리들(도착지 대표점 + 출발지)을 글자 하나로: 「경도,위도|경도,위도 …」. 원이 없으면 빈 글자.
 * 달이 바뀌어 값(원 크기)만 달라지면 같은 글자라, 지도를 다시 맞추지 않는다
 */
export function fitSpots(dots: Pick<Dot, "at">[], from: [number, number] | null) {
  if (!dots.length) return "";
  return [...dots.map((d) => d.at), ...(from ? [from] : [])]
    .map(([lon, lat]) => `${lon},${lat}`)
    .sort()
    .join("|");
}

/**
 * 원 글자 · 테두리는 surface-1(밝은 화면 흰 · 어두운 화면 먹색). 어두운 화면에서 남색이 밝은 파랑(#8faee0)이 되어
 * 흰 글자가 3.52 : 1 로 흐렸다
 */
function dotElement(d: Dot) {
  const el = document.createElement("div");
  el.className =
    "grid place-items-center rounded-full bg-data-navy/75 ring-2 ring-surface-1 text-caption-11 font-bold text-surface-1";
  el.style.width = el.style.height = `${d.size}px`;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `도착 ${d.label}`);
  el.title = d.label;
  el.textContent = d.name;
  return el;
}

export function MovementDots({
  dots,
  from,
}: {
  dots: Dot[];
  /** 출발지 대표점 — 점은 찍지 않고(사용자 결정 11/09, 출발 지역은 경계로 이미 보인다) 지도 범위에만 넣는다 */
  from: [number, number] | null;
}) {
  const map = useMapInstance();

  // 도착지 원
  useEffect(() => {
    if (!map) return;
    const markers = dots.map((d) =>
      new Marker({ element: dotElement(d) }).setLngLat(d.at).addTo(map),
    );
    return () => markers.forEach((m) => m.remove());
  }, [map, dots]);

  // 이동형을 켜기 전 자리. 켤 때 한 번만 적고, 끌 때(다른 유형으로) 그 자리로 돌아간다.
  // 달을 바꾸면 원(dots)이 새로 오는데, 그때마다 적으면 이미 넓힌 자리가 「켜기 전 자리」 가 되어
  // 다른 유형으로 돌아가도 전국으로 넓어진 채 남는다(시간 슬라이더 뒤에 생긴 문제)
  useEffect(() => {
    if (!map) return;
    const before = { center: map.getCenter(), zoom: map.getZoom() };
    return () => {
      map.easeTo({ ...before, duration: 600 });
    };
  }, [map]);

  // 도착지가 모두 보이게 넓힌다. 범위(도착지 · 출발지 자리)가 같으면 달이 바뀌어도 다시 맞추지 않는다 — 지도가 움찔하지 않게.
  // 결과 지도(MapView)는 경계가 올 때 · 창 크기가 바뀔 때 고른 지역에 다시 맞춘다 — 그 뒤(다음 그림 틀)에 맞춰야 이긴다
  const spots = fitSpots(dots, from);
  useEffect(() => {
    if (!map || !spots) return;
    const bounds = new LngLatBounds();
    for (const spot of spots.split("|")) {
      const [lon, lat] = spot.split(",").map(Number);
      bounds.extend([lon, lat]);
    }
    let frame = 0;
    const fit = (duration: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        map.fitBounds(bounds, { padding: fitPadding(map), duration, maxZoom: 9 }),
      );
    };
    fit(600);
    const refit = () => fit(0);
    map.on("resize", refit);
    return () => {
      cancelAnimationFrame(frame);
      map.off("resize", refit);
    };
  }, [map, spots]);
  return null;
}
