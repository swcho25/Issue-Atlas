"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  type ExpressionSpecification,
  type FilterSpecification,
  type GeoJSONSource,
  type GeoJSONSourceSpecification,
  type LngLatBoundsLike,
  Map as MapLibreMap,
  Marker,
  type MapLayerMouseEvent,
  setWorkerUrl,
} from "maplibre-gl";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import type { PlaceBoundaries } from "@/shared/api";

import { groupName, labelPoint } from "./labels";
import { MapControls } from "./MapControls";

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

type Feature = PlaceBoundaries["features"][number];
type Data = GeoJSONSourceSpecification["data"];
const collection = (features: unknown[]) => ({ type: "FeatureCollection", features }) as Data;

// 지도 색은 토큰을 읽어 쓴다(MapLibre 는 CSS 변수를 못 읽어서, 토큰 글자색을 단 요소의 계산값을 넘긴다)
const tokenColor = (el: HTMLElement | null, fallback: string) =>
  el ? getComputedStyle(el).color : fallback;

/** 고르는 화면에서는 바탕 지도의 지명 · 기호를 흐리게 해 지역 이름표가 묻히지 않게 한다 */
function fadeBasemapLabels(m: MapLibreMap) {
  for (const layer of m.getStyle().layers) {
    if (layer.type !== "symbol" || layer.source !== "openmaptiles") continue;
    m.setPaintProperty(layer.id, "text-opacity", 0.45);
    m.setPaintProperty(layer.id, "icon-opacity", 0.45);
  }
}

// 지역 이름: 점 + 글자(Pretendard 로 쓰려고 지도 글자가 아닌 화면 요소로 둔다). 상자 없이 글자 테두리로 읽히게.
// 고를 수 있는 곳은 남색 점 · 누르는 버튼(올리면 밑줄), 고른 곳은 앰버 점 + 크고 굵게
const NAME = "flex items-center gap-1.5 whitespace-nowrap text-text-1 map-halo";
const CHOICE = `${NAME} cursor-pointer text-title-14 font-semibold underline-offset-4 hover:underline data-hover:underline`;

function dot(className: string) {
  const el = document.createElement("span");
  el.className = `shrink-0 rounded-full ring-2 ring-surface-1 ${className}`;
  return el;
}

function nameTag(f: Feature, picked: boolean) {
  const el = document.createElement(picked ? "div" : "button");
  if (picked) {
    el.className = `${NAME} text-heading-16 font-extrabold`;
    el.append(dot("size-2.5 bg-primary"));
  } else {
    el.className = CHOICE;
    el.setAttribute("type", "button");
    el.dataset.place = f.properties.place_id;
    el.append(dot("size-2 bg-map-region"));
  }
  el.append(f.properties.name);
  return el;
}

/** 같은 상위 지역의 시군구 여럿을 축소했을 때 하나로 묶어 보일 이름표(「광주 5개 구」). 이름을 못 지으면 묶지 않는다 */
function groupTag(features: Feature[]) {
  const name = groupName(features.map((f) => f.properties.name));
  if (!name) return null;
  const el = document.createElement("button");
  el.type = "button";
  el.className = CHOICE;
  el.append(dot("size-2 bg-map-region"), name);
  return el;
}

/**
 * 이름표를 지도 위 한 점에 띄운다. 이름표 위의 누르기 · 마우스 움직임이 아래 지역 면으로 번지지 않게 막는다
 * (「광주 5개 구」 를 누르면 그 아래 서구가 골라지고, 이름표 위에서 아래 구가 떠오르던 것).
 * 끌어서 옮기기는 MapLibre 가 문서 전체에서 받으므로 이름표 위에서 시작해도 된다
 */
function addTag(m: MapLibreMap, el: HTMLElement, at: [number, number]) {
  el.addEventListener("click", (e) => e.stopPropagation());
  el.addEventListener("mousemove", (e) => e.stopPropagation());
  return new Marker({ element: el }).setLngLat(at).addTo(m);
}

/** 경계에 맞춰 화면을 옮긴다. 여백이 지도보다 넓으면 맞출 수 없어 MapLibre 가 크게 물러나므로 좁은 창에서는 여백을 줄인다 */
function fitTo(m: MapLibreMap, bounds: LngLatBoundsLike, padding: Padding, duration: number) {
  const { clientWidth: w, clientHeight: h } = m.getContainer();
  const p =
    typeof padding === "number"
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : padding;
  const sx = Math.min(1, (w * 0.7) / (p.left + p.right));
  const sy = Math.min(1, (h * 0.7) / (p.top + p.bottom));
  m.fitBounds(bounds, {
    padding: { top: p.top * sy, bottom: p.bottom * sy, left: p.left * sx, right: p.right * sx },
    duration,
  });
}

type Padding = number | { top: number; right: number; bottom: number; left: number };

/** 지도의 한 지역에 마우스를 올린 표시(면은 흰빛 · 진한 선, 이름은 밑줄). 지역 면과 이름 어느 쪽에서 올려도 한 곳만 */
function setHover(m: MapLibreMap, hovered: { current?: string | number }, id?: string | number) {
  const name = (place: string | number) =>
    m.getContainer().querySelector<HTMLElement>(`[data-place="${place}"]`);
  if (hovered.current !== undefined) {
    m.setFeatureState({ source: "choices", id: hovered.current }, { hover: false });
    name(hovered.current)?.removeAttribute("data-hover");
  }
  hovered.current = id;
  if (id !== undefined) {
    m.setFeatureState({ source: "choices", id }, { hover: true });
    name(id)?.setAttribute("data-hover", "");
  }
}

/**
 * 결과 화면의 지도 바탕. 시군구 경계를 받으면 시군구는 굵게 · 옅게 칠하고 그 안 행정동은 가는 선으로 그린 뒤
 * 경계에 맞춰 화면을 맞춘다. 지도 위에 띄울 것(결과 카드 · 버튼)은 children 으로 넘긴다.
 * 새 질문처럼 지도에서 지역을 고르게 하려면 choices(다른 지역 경계) · onPick 을 함께 넘긴다.
 * controls 를 켜면 오른쪽 아래에 확대 · 축소 · 위치(경계에 다시 맞추기) 버튼을 띄운다
 */
export function MapView({
  boundaries,
  choices,
  onPick,
  padding = 80,
  controls = false,
  className = "",
  children,
}: {
  boundaries?: PlaceBoundaries;
  /**
   * 눌러서 고를 수 있는 다른 지역(시군구). 가는 선 · 점 + 이름으로 그리고(고른 지역은 앰버 점 + 크고 굵게),
   * 마우스를 올리면 그 지역이 밝게 떠오르며, 지역이나 이름표를 누르면 onPick. 넘기면 바탕 지도의 지명은 흐려진다
   */
  choices?: Feature[];
  onPick?: (placeId: string) => void;
  /** 경계에 맞출 때 가장자리 여백(px). 결과 카드가 덮는 쪽은 더 크게 { left: 440, … } */
  padding?: Padding;
  /** 오른쪽 아래 지도 버튼(Figma v5/Map controls). 지도 위 다른 부품은 그 자리(오른쪽 16 · 아래 40, 36 × 117)를 비워 둔다 */
  controls?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const pick = useRef(onPick);
  const shown = useRef<PlaceBoundaries>(undefined);
  const hovered = useRef<string | number>(undefined);
  // 고른 지역(시군구) 전체를 감싸는 범위. 경계가 오면 여기에 맞추고, 위치 버튼도 여기로 돌아간다
  const bounds = useMemo(
    () =>
      boundaries
        ? boundsOf(boundaries.features.filter((f) => f.properties.level === "sigungu"))
        : null,
    [boundaries],
  );

  // 지도는 한 번만 만든다. 층도 이때 그리는 순서대로(아래 → 위) 쌓아 두고, 경계가 오면 데이터만 바꾼다
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
      const color = (name: string, fallback: string) =>
        tokenColor(
          palette.current?.querySelector<HTMLElement>(`[data-color=${name}]`) ?? null,
          fallback,
        );
      const regionColor = color("region", "#2e4a7d");
      const fillColor = color("region-fill", "rgba(46,74,125,0.08)");
      const hoveredState: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
      // 고를 수 있는 다른 지역: 평소엔 가는 선으로 나누고, 마우스를 올리면 흰빛으로 떠오르며 선이 진해진다.
      // 고른 지역(남색으로 옅게 칠함)과 헷갈리지 않게 흰빛으로. 바탕 지도는 다크 모드에도 밝아서 흰색 그대로
      m.addSource("choices", { type: "geojson", data: collection([]), promoteId: "place_id" });
      m.addLayer({
        id: "choice-fill",
        type: "fill",
        source: "choices",
        paint: { "fill-color": "#ffffff", "fill-opacity": ["case", hoveredState, 0.55, 0] },
      });
      m.addLayer({
        id: "choice-line",
        type: "line",
        source: "choices",
        paint: {
          "line-color": regionColor,
          "line-width": ["case", hoveredState, 1.5, 1],
          "line-opacity": ["case", hoveredState, 0.9, 0.45],
        },
      });
      // 고른 지역
      m.addSource("boundaries", { type: "geojson", data: collection([]) });
      const sigungu: FilterSpecification = ["==", ["get", "level"], "sigungu"];
      m.addLayer({
        id: "sigungu-fill",
        type: "fill",
        source: "boundaries",
        filter: sigungu,
        paint: { "fill-color": fillColor },
      });
      m.addLayer({
        id: "emd-line",
        type: "line",
        source: "boundaries",
        filter: ["==", ["get", "level"], "emd"],
        paint: { "line-color": color("boundary", "#9aa0b4"), "line-width": 0.75 },
      });
      m.addLayer({
        id: "sigungu-line",
        type: "line",
        source: "boundaries",
        filter: sigungu,
        paint: { "line-color": regionColor, "line-width": 2 },
      });
      setMap(m);
    });
    return () => {
      setMap(null);
      m.remove();
    };
  }, []);

  // 경계가 바뀌면 데이터를 바꾸고 화면을 맞춘다
  useEffect(() => {
    if (!map || !boundaries) return;
    map.getSource<GeoJSONSource>("boundaries")?.setData(boundaries as Data);
    if (!bounds) return;
    // 처음은 바로, 고른 지역이 바뀌면 그쪽으로 옮겨 간다(움직임 줄이기 설정이면 MapLibre 가 바로 옮긴다).
    // 창 크기가 바뀌면(창 늘리기 · 옆 패널) 다시 맞춘다
    const moved = shown.current !== undefined && shown.current !== boundaries;
    shown.current = boundaries;
    fitTo(map, bounds, padding, moved ? 600 : 0);
    const refit = () => fitTo(map, bounds, padding, 0);
    map.on("resize", refit);
    return () => {
      map.off("resize", refit);
    };
  }, [map, boundaries, bounds, padding]);

  // 고르는 화면: 다른 지역의 시군구 경계와 이름표(고른 곳 + 고를 수 있는 곳), 바탕 지명은 흐리게
  useEffect(() => {
    if (!map) return;
    const isSigungu = (f: Feature) => f.properties.level === "sigungu";
    const others = (choices ?? []).filter(isSigungu);
    map.getSource<GeoJSONSource>("choices")?.setData(collection(others));
    if (!choices) return;
    fadeBasemapLabels(map);

    const current = (boundaries?.features ?? []).filter(isSigungu);
    const tags = [
      ...current.map((f) => ({ f, picked: true })),
      ...others.map((f) => ({ f, picked: false })),
    ].map(({ f, picked }) => {
      const el = nameTag(f, picked);
      const id = f.properties.place_id;
      if (!picked) {
        el.addEventListener("mouseenter", () => setHover(map, hovered, id));
        el.addEventListener("mouseleave", () => setHover(map, hovered, undefined));
        el.addEventListener("click", () => {
          setHover(map, hovered, undefined);
          pick.current?.(id);
        });
      }
      const at = labelPoint(f);
      return { el, at, marker: addTag(map, el, at), picked, parent: f.properties.parent_id, f };
    });

    // 같은 상위 지역의 구들(고른 곳이 없는 묶음)은 축소해 서로 겹치면 「광주 5개 구」 하나로 묶고, 누르면 그곳으로 확대한다
    const byParent = new Map<string, typeof tags>();
    for (const t of tags) {
      if (t.parent) byParent.set(t.parent, [...(byParent.get(t.parent) ?? []), t]);
    }
    const groups = [...byParent.values()].flatMap((members) => {
      const el =
        members.length > 1 && !members.some((t) => t.picked)
          ? groupTag(members.map((t) => t.f))
          : null;
      if (!el) return [];
      const bounds = boundsOf(members.map((t) => t.f));
      el.addEventListener("click", () => bounds && fitTo(map, bounds, padding, 600));
      const at: [number, number] = [
        members.reduce((s, t) => s + t.at[0], 0) / members.length,
        members.reduce((s, t) => s + t.at[1], 0) / members.length,
      ];
      return [{ el, at, marker: addTag(map, el, at), members }];
    });

    // 이름표끼리 겹치면 앞의 것(고른 곳 → 묶음 → 목록 순서)만 남긴다
    type Box = [number, number, number, number];
    const boxOf = (el: HTMLElement, at: [number, number]): Box => {
      const p = map.project(at);
      const [w, h] = [el.offsetWidth / 2 + 4, el.offsetHeight / 2 + 4];
      return [p.x - w, p.y - h, p.x + w, p.y + h];
    };
    const overlap = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const declutter = () => {
      const collapsed = new Set(
        groups.filter(({ members }) => {
          const boxes = members.map((t) => boxOf(t.el, t.at));
          return boxes.some((a, i) => boxes.some((b, j) => i < j && overlap(a, b)));
        }),
      );
      const hidden = new Set(groups.flatMap((g) => (collapsed.has(g) ? g.members : [])));
      const order = [
        ...tags.filter((t) => t.picked),
        ...groups.filter((g) => collapsed.has(g)),
        ...tags.filter((t) => !t.picked && !hidden.has(t)),
      ];
      const placed: Box[] = [];
      for (const { el, at } of order) {
        const box = boxOf(el, at);
        const hit = placed.some((b) => overlap(box, b));
        el.style.visibility = hit ? "hidden" : "";
        if (!hit) placed.push(box);
      }
      for (const t of hidden) t.el.style.visibility = "hidden";
      for (const g of groups) if (!collapsed.has(g)) g.el.style.visibility = "hidden";
    };
    // 확대 · 회전 · 기울이기에 따라 다시 잰다. 글꼴이 늦게 오면 이름 폭이 바뀌므로 그때도 다시
    let live = true;
    declutter();
    void document.fonts?.ready.then(() => live && declutter());
    const moves = ["zoom", "rotate", "pitch"] as const;
    for (const type of moves) map.on(type, declutter);
    return () => {
      live = false;
      for (const type of moves) map.off(type, declutter);
      for (const { marker } of [...tags, ...groups]) marker.remove();
    };
  }, [map, choices, boundaries, padding]);

  // 다른 지역 면에 마우스를 올리면 칠하고 손 모양, 누르면 고른다
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  useEffect(() => {
    if (!map) return;
    const hover = (id?: string | number) => {
      setHover(map, hovered, id);
      map.getCanvas().style.cursor = id === undefined ? "" : "pointer";
    };
    const move = (e: MapLayerMouseEvent) => hover(e.features?.[0]?.id);
    const leave = () => hover(undefined);
    const click = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id;
      if (typeof id !== "string") return;
      leave();
      pick.current?.(id);
    };
    map.on("mousemove", "choice-fill", move);
    map.on("mouseleave", "choice-fill", leave);
    map.on("click", "choice-fill", click);
    return () => {
      map.off("mousemove", "choice-fill", move);
      map.off("mouseleave", "choice-fill", leave);
      map.off("click", "choice-fill", click);
    };
  }, [map]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* MapLibre CSS 가 이 칸을 position: relative 로 바꿔서 absolute 대신 부모 크기를 그대로 채운다 */}
      <div ref={box} data-map className="size-full" />
      <div ref={palette} aria-hidden="true" className="hidden">
        <span data-color="region" className="text-map-region" />
        <span data-color="region-fill" className="text-map-region-fill" />
        <span data-color="boundary" className="text-map-boundary" />
      </div>
      {controls && map && (
        <MapControls
          map={map}
          onLocate={bounds ? () => fitTo(map, bounds, padding, 600) : undefined}
        />
      )}
      {children}
    </div>
  );
}
