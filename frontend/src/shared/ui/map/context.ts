"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { createContext, useContext } from "react";

// MapView 가 children(지도 위 부품)에 지도를 건넨다. 점 · 이름표처럼 지도 좌표에 붙는 것을 화면 쪽에서 그릴 때 쓴다.
// 층(layer)을 더하지 말고 Marker(화면 요소)로 그린다 — 밝은 ↔ 어두운 바탕을 갈아 끼우면 MapView 가 모르는 층은 사라진다
export const MapContext = createContext<MapLibreMap | null>(null);

/** MapView 안에서 지도를 쓴다. 지도가 아직 준비되지 않았으면 null */
export const useMapInstance = () => useContext(MapContext);
