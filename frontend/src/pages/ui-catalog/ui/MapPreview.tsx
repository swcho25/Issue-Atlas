"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  type GeoJSONSourceSpecification,
  getVersion,
  Map as MapLibreMap,
  setWorkerUrl,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { ApiError, browserGet, placeBoundariesSchema } from "@/shared/api";

// MapLibre 6 은 타일 처리 워커를 자기 파일 옆(import.meta.url)에서 찾는데, 번들러가 옮기면 못 찾는다.
// 워커 파일을 번들러가 함께 내보내게 하고 그 주소를 알려 준다
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

// 바탕 지도 견본(여수). MapLibre 는 그리는 엔진이고 지도 그림(타일)은 OpenFreeMap positron 에서 받는다
// (11/4 결정, 음영 없음). Esri 타일은 MapLibre 로 쓰면 이용 조건 밖이라 뺐다. 지도 위젯을 만들면 위젯 견본으로 바뀐다
const POSITRON = "https://tiles.openfreemap.org/styles/positron";

// 지명은 OpenMapTiles 의 name:ko 를 먼저, 없으면 현지 이름(원본 positron 은 영어 · 한국어를 함께 쓴다)
function showKoreanLabels(m: MapLibreMap) {
  for (const layer of m.getStyle().layers) {
    if (layer.type === "symbol" && m.getLayoutProperty(layer.id, "text-field") !== undefined) {
      m.setLayoutProperty(layer.id, "text-field", [
        "coalesce",
        ["get", "name:ko"],
        ["get", "name"],
      ]);
    }
  }
}

// 여수시청 근처
const YEOSU: [number, number] = [127.66, 34.76];

export function MapPreview() {
  const box = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [boundary, setBoundary] = useState("불러오는 중");

  useEffect(() => {
    if (!box.current) return;
    const m = new MapLibreMap({
      container: box.current,
      style: POSITRON,
      center: YEOSU,
      zoom: 9,
      attributionControl: { compact: true },
    });

    // 시군구 경계(C2 /v1/places/{id}/boundaries). 로컬 백엔드가 없으면 건너뛴다
    m.on("load", async () => {
      showKoreanLabels(m);
      try {
        // 계약 스키마로 검증한 GeoJSON(시군구 + 그 안 행정동)
        const geojson = await browserGet("/v1/places/kr-12130/boundaries", placeBoundariesSchema);
        // 색은 토큰(map-boundary)을 읽어 쓴다
        const color = probe.current ? getComputedStyle(probe.current).color : "currentColor";
        m.addSource("boundary", {
          type: "geojson",
          data: geojson as GeoJSONSourceSpecification["data"],
        });
        m.addLayer({
          id: "boundary-line",
          type: "line",
          source: "boundary",
          paint: { "line-color": color, "line-width": 1.5 },
        });
        setBoundary(`경계 ${geojson.features.length}개 표시`);
      } catch (e) {
        setBoundary(`경계 없음(${e instanceof ApiError ? `API ${e.status}` : "오류"})`);
      }
    });

    return () => m.remove();
  }, []);

  return (
    <section className="mt-12">
      <h2 className="text-heading-20">지도 바탕</h2>
      <p className="mt-1 text-body-13 text-text-2">
        MapLibre {getVersion()} · OpenFreeMap positron · 한국어 지명 · 여수 · {boundary}
      </p>
      <span ref={probe} className="hidden text-map-boundary" />
      <div ref={box} data-map className="mt-4 h-[480px] overflow-hidden rounded-xl shadow-card" />
    </section>
  );
}
