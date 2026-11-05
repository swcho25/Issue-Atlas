"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  type FilterSpecification,
  type GeoJSONSource,
  type GeoJSONSourceSpecification,
  type LngLatBoundsLike,
  Map as MapLibreMap,
  setWorkerUrl,
} from "maplibre-gl";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { PlaceBoundaries } from "@/shared/api";

// MapLibre 6 은 타일 처리 워커를 자기 파일 옆(import.meta.url)에서 찾는데, 번들러가 옮기면 못 찾는다.
// 워커 파일을 번들러가 함께 내보내게 하고 그 주소를 알려 준다
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

// 바탕 지도: OpenFreeMap Liberty(키 · 요청 제한 없음, 11/5 positron 에서 바꿈). 지명은 한국어.
// Liberty 는 낮은 확대에서 음영(Natural Earth) · 높은 확대에서 건물 입체를 스타일 안에 갖고 있다
const BASEMAP = "https://tiles.openfreemap.org/styles/liberty";
// 경계가 오기 전 처음 자리(남한 가운데쯤)
const KOREA: [number, number] = [127.8, 36.0];

// 지명: OpenMapTiles 의 name:ko 를 먼저, 없으면 현지 이름(원본은 「Gwangyang 광양시」처럼 영어 · 한국어를 함께 쓴다).
// 이름을 쓰는 글자 층만 바꾼다 — 도로 번호 방패(ref)까지 바꾸면 번호 대신 이름이 들어간다
function showKoreanLabels(m: MapLibreMap) {
  for (const layer of m.getStyle().layers) {
    if (layer.type !== "symbol") continue;
    const field = m.getLayoutProperty(layer.id, "text-field");
    if (field !== undefined && JSON.stringify(field).includes('"name')) {
      m.setLayoutProperty(layer.id, "text-field", [
        "coalesce",
        ["get", "name:ko"],
        ["get", "name"],
      ]);
    }
  }
}

/** 경계 전체를 감싸는 [서남, 동북] */
function boundsOf(features: PlaceBoundaries["features"]): LngLatBoundsLike | null {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features)
    for (const polygon of f.geometry.coordinates)
      for (const ring of polygon)
        for (const [lng, lat] of ring) {
          w = Math.min(w, lng);
          s = Math.min(s, lat);
          e = Math.max(e, lng);
          n = Math.max(n, lat);
        }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

// 지도 색은 토큰을 읽어 쓴다(MapLibre 는 CSS 변수를 못 읽어서, 토큰 글자색을 단 요소의 계산값을 넘긴다)
const tokenColor = (el: HTMLElement | null, fallback: string) =>
  el ? getComputedStyle(el).color : fallback;

/**
 * 결과 화면의 지도 바탕. 시군구 경계를 받으면 시군구는 굵게 · 옅게 칠하고 그 안 행정동은 가는 선으로 그린 뒤
 * 경계에 맞춰 화면을 맞춘다. 지도 위에 띄울 것(결과 카드 · 버튼)은 children 으로 넘긴다
 */
export function MapView({
  boundaries,
  padding = 80,
  className = "",
  children,
}: {
  boundaries?: PlaceBoundaries;
  /** 경계에 맞출 때 가장자리 여백(px). 결과 카드가 덮는 쪽은 더 크게 { left: 440, … } */
  padding?: number | { top: number; right: number; bottom: number; left: number };
  className?: string;
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const region = useRef<HTMLSpanElement>(null);
  const regionFill = useRef<HTMLSpanElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  // 지도는 한 번만 만든다
  useEffect(() => {
    if (!box.current) return;
    const m = new MapLibreMap({
      container: box.current,
      style: BASEMAP,
      center: KOREA,
      zoom: 6,
      attributionControl: { compact: true },
    });
    m.on("load", () => {
      showKoreanLabels(m);
      setMap(m);
    });
    return () => {
      setMap(null);
      m.remove();
    };
  }, []);

  // 경계가 바뀌면 층을 채우고 화면을 맞춘다
  useEffect(() => {
    if (!map || !boundaries) return;
    const data = boundaries as GeoJSONSourceSpecification["data"];
    const source = map.getSource<GeoJSONSource>("boundaries");
    if (source) {
      source.setData(data);
    } else {
      map.addSource("boundaries", { type: "geojson", data });
      const sigungu: FilterSpecification = ["==", ["get", "level"], "sigungu"];
      map.addLayer({
        id: "sigungu-fill",
        type: "fill",
        source: "boundaries",
        filter: sigungu,
        paint: { "fill-color": tokenColor(regionFill.current, "rgba(46,74,125,0.08)") },
      });
      map.addLayer({
        id: "emd-line",
        type: "line",
        source: "boundaries",
        filter: ["==", ["get", "level"], "emd"],
        paint: { "line-color": tokenColor(line.current, "#9aa0b4"), "line-width": 0.75 },
      });
      map.addLayer({
        id: "sigungu-line",
        type: "line",
        source: "boundaries",
        filter: sigungu,
        paint: { "line-color": tokenColor(region.current, "#2e4a7d"), "line-width": 2 },
      });
    }
    const bounds = boundsOf(boundaries.features.filter((f) => f.properties.level === "sigungu"));
    if (!bounds) return;
    // 여백이 지도보다 넓으면 맞출 수 없어 MapLibre 가 크게 물러난다 → 좁은 창에서는 여백을 줄인다.
    // 창 크기가 바뀌면(창 늘리기 · 옆 패널) 다시 맞춘다
    const fit = () => {
      const { clientWidth: w, clientHeight: h } = map.getContainer();
      const p =
        typeof padding === "number"
          ? { top: padding, right: padding, bottom: padding, left: padding }
          : padding;
      const sx = Math.min(1, (w * 0.7) / (p.left + p.right));
      const sy = Math.min(1, (h * 0.7) / (p.top + p.bottom));
      map.fitBounds(bounds, {
        padding: { top: p.top * sy, bottom: p.bottom * sy, left: p.left * sx, right: p.right * sx },
        duration: 0,
      });
    };
    fit();
    map.on("resize", fit);
    return () => {
      map.off("resize", fit);
    };
  }, [map, boundaries, padding]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* MapLibre CSS 가 이 칸을 position: relative 로 바꿔서 absolute 대신 부모 크기를 그대로 채운다 */}
      <div ref={box} data-map className="size-full" />
      <span ref={region} aria-hidden="true" className="hidden text-map-region" />
      <span ref={regionFill} aria-hidden="true" className="hidden text-map-region-fill" />
      <span ref={line} aria-hidden="true" className="hidden text-map-boundary" />
      {children}
    </div>
  );
}
