"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  type ExpressionSpecification,
  type FilterSpecification,
  type GeoJSONSource,
  type GeoJSONSourceSpecification,
  type LayerSpecification,
  type LngLatBoundsLike,
  Map as MapLibreMap,
  Marker,
  type MapLayerMouseEvent,
  setWorkerUrl,
} from "maplibre-gl";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import type { PlaceBoundaries } from "@/shared/api";
import { type Theme, useTheme } from "@/shared/lib/theme";

import { MapContext } from "./context";
import { ASIA, loadEarth, MERCATOR_LAT } from "./earth";
import { groupName, labelPoint } from "./labels";
import { MapControls } from "./MapControls";

// MapLibre 6 은 타일 처리 워커를 자기 파일 옆(import.meta.url)에서 찾는데, 번들러가 옮기면 못 찾는다.
// 워커 파일을 번들러가 함께 내보내게 하고 그 주소를 알려 준다
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

// 바탕 지도: OpenFreeMap(키 · 요청 제한 없음). 밝은 화면은 Liberty(11/5 positron 에서 바꿈), 다크 모드는 Fiord(푸른 회색, 11/06 Dark 에서 바꿈).
// 화면 테마를 바꾸면 바탕만 갈아 끼우고 우리 층(경계 · 고를 지역)은 그대로 옮겨 온다. 지명은 한국어.
// Liberty 는 낮은 확대에서 음영(Natural Earth) · 높은 확대에서 건물 입체를 스타일 안에 갖고 있다
const BASEMAPS: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/fiord",
};
const HOVERED: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
const SIGUNGU: FilterSpecification = ["==", ["get", "level"], "sigungu"];

type Colors = { region: string; regionFill: string; boundary: string };

/**
 * 바탕 위에 얹는 층(아래 → 위): 고를 수 있는 다른 지역 → 고른 지역. 색은 토큰에서 읽은 값.
 * 고를 수 있는 지역은 평소엔 가는 선, 마우스를 올리면 흰빛으로 떠오르며 선이 진해진다
 * (고른 지역의 남색 칠과 헷갈리지 않게 흰빛. 어두운 바탕에서는 흰빛을 옅게)
 */
/** 레이어 패널에서 켜고 끄는 경계 층과 그 MapLibre 층들 */
const BOUNDARY_LAYERS = {
  sigungu: { label: "시군구 경계", ids: ["sigungu-fill", "sigungu-line"] },
  emd: { label: "행정동 경계", ids: ["emd-line"] },
} as const;
type BoundaryLayer = keyof typeof BOUNDARY_LAYERS;
const layerOf = (id: string) =>
  (Object.keys(BOUNDARY_LAYERS) as BoundaryLayer[]).find((k) =>
    (BOUNDARY_LAYERS[k].ids as readonly string[]).includes(id),
  );

/** 숨긴 경계 층은 처음부터 안 보이게(바탕을 갈아 끼울 때도 그대로) */
function ourLayers(c: Colors, theme: Theme, hidden: Set<BoundaryLayer>): LayerSpecification[] {
  return baseLayers(c, theme).map((layer) => {
    const group = layerOf(layer.id);
    return group && hidden.has(group) ? { ...layer, layout: { visibility: "none" } } : layer;
  });
}

function baseLayers(c: Colors, theme: Theme): LayerSpecification[] {
  return [
    {
      id: "choice-fill",
      type: "fill",
      source: "choices",
      paint: {
        "fill-color": "#ffffff",
        "fill-opacity": ["case", HOVERED, theme === "dark" ? 0.16 : 0.55, 0],
      },
    },
    {
      id: "choice-line",
      type: "line",
      source: "choices",
      paint: {
        "line-color": c.region,
        "line-width": ["case", HOVERED, 1.5, 1],
        "line-opacity": ["case", HOVERED, 0.9, 0.45],
      },
    },
    {
      id: "sigungu-fill",
      type: "fill",
      source: "boundaries",
      filter: SIGUNGU,
      paint: { "fill-color": c.regionFill },
    },
    {
      id: "emd-line",
      type: "line",
      source: "boundaries",
      filter: ["==", ["get", "level"], "emd"],
      paint: { "line-color": c.boundary, "line-width": 0.75 },
    },
    {
      id: "sigungu-line",
      type: "line",
      source: "boundaries",
      filter: SIGUNGU,
      paint: { "line-color": c.region, "line-width": 2 },
    },
  ];
}

// 이보다 더 축소하지 않는다: 지구가 랜딩처럼 보이는 지도 칸 절반쯤 크기(확대 1.7 ≈ 지름 520px)
const GLOBE_MIN_ZOOM = 1.7;

/**
 * 크게 축소하면 평면 지도 대신 지구로 보인다(MapLibre globe). 가까이 오면 저절로 평면처럼 펴진다.
 * 지구는 랜딩과 같은 NASA 사진으로 덮고(지명 아래), 확대 5 → 3 사이에 지도에서 사진으로 바뀐다.
 * 랜딩 지구만큼만 축소되고, 지구는 보이는 지도 칸 가운데에 온다(MapView 의 카메라 여백).
 * 지구 둘레의 옅은 대기는 밝은 화면에서 축소했을 때만(어두운 화면에서는 밝은 테두리로 튀어서 끈다)
 */
function showGlobe(m: MapLibreMap, theme: Theme) {
  m.setProjection({ type: "globe" });
  m.setMinZoom(GLOBE_MIN_ZOOM);
  m.setSky({
    "atmosphere-blend":
      theme === "dark" ? 0 : ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
  });
  // 사진은 다 만든 뒤 한 번에 얹는다(그 전엔 지도 그대로). 바탕을 갈아 끼우는 사이에 오면 새 바탕에서 다시 얹는다
  void loadEarth()
    .then(({ world, asia, pole }) => {
      // 바탕을 갈아 끼우는 중이면 addSource 가 던진다 — 새 바탕의 style.load 에서 다시 얹으므로 넘긴다
      if (m.getSource("earth-world")) return;
      // 사진은 위도 85° 까지만 덮어(지도 투영의 끝) 극에는 바탕의 물 · 바탕색이 비친다.
      // 지구로 보일 때만 그 자리를 사진 맨 윗줄 색으로 채워 이음매가 보이지 않게
      for (const [id, prop] of [
        ["background", "background-color"],
        ["water", "fill-color"],
      ] as const) {
        const base = m.getLayer(id) ? m.getPaintProperty(id, prop) : undefined;
        if (typeof base === "string") {
          m.setPaintProperty(id, prop, ["interpolate", ["linear"], ["zoom"], 3, pole, 5, base]);
        }
      }
      const box = (lon: readonly [number, number], lat: readonly [number, number]) =>
        [
          [lon[0], lat[0]],
          [lon[1], lat[0]],
          [lon[1], lat[1]],
          [lon[0], lat[1]],
        ] as [[number, number], [number, number], [number, number], [number, number]];
      m.addSource("earth-world", {
        type: "canvas",
        canvas: world,
        animate: false,
        coordinates: box([-180, 180], [MERCATOR_LAT, -MERCATOR_LAT]),
      });
      m.addSource("earth-asia", {
        type: "canvas",
        canvas: asia,
        animate: false,
        coordinates: box(ASIA.lon, ASIA.lat),
      });
      const firstLabel = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
      const fade: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 3, 1, 5, 0];
      for (const id of ["earth-world", "earth-asia"]) {
        m.addLayer(
          { id, type: "raster", source: id, maxzoom: 6, paint: { "raster-opacity": fade } },
          firstLabel,
        );
      }
    })
    .catch(() => undefined); // 사진을 못 받았으면 지구는 지도 그림 그대로
}

/** 바탕을 새로 불러온 뒤마다: 한국어 지명, 지명 진하기(고르는 화면 · 지구), 지구 보기 */
function dressBasemap(m: MapLibreMap, opts: { theme: Theme; picking: boolean; globe: boolean }) {
  showKoreanLabels(m);
  fadeBasemapLabels(m, opts);
  if (opts.globe) showGlobe(m, opts.theme);
}

/** 토큰 색을 지금 테마로 읽는다. 토큰 글자색을 단 숨은 요소(data-color)의 계산값 */
function readColors(palette: HTMLElement | null): Colors {
  const color = (name: string, fallback: string) =>
    tokenColor(palette?.querySelector<HTMLElement>(`[data-color=${name}]`) ?? null, fallback);
  return {
    region: color("region", "#2e4a7d"),
    regionFill: color("region-fill", "rgba(46,74,125,0.08)"),
    boundary: color("boundary", "#9aa0b4"),
  };
}
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

/**
 * 바탕 지도의 지명 · 기호 진하기. 고르는 화면에서는 흐리게 해 지역 이름표가 묻히지 않게 하고,
 * 지구로 보일 만큼 축소하면(확대 3 이하) 사진 위에서 어지럽지 않게 지운다(확대 5 에서 다시 보임)
 */
function fadeBasemapLabels(m: MapLibreMap, opts: { picking: boolean; globe: boolean }) {
  if (!opts.picking && !opts.globe) return;
  const shown = opts.picking ? 0.45 : 1;
  const opacity: ExpressionSpecification | number = opts.globe
    ? ["interpolate", ["linear"], ["zoom"], 3, 0, 5, shown]
    : shown;
  for (const layer of m.getStyle().layers) {
    if (layer.type !== "symbol" || layer.source !== "openmaptiles") continue;
    m.setPaintProperty(layer.id, "text-opacity", opacity);
    m.setPaintProperty(layer.id, "icon-opacity", opacity);
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

/** 화면 여백. 여백이 지도보다 넓으면 맞출 수 없어 MapLibre 가 크게 물러나므로 좁은 창에서는 줄인다 */
function scaledPadding(m: MapLibreMap, padding: Padding) {
  const { clientWidth: w, clientHeight: h } = m.getContainer();
  const p =
    typeof padding === "number"
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : padding;
  const sx = Math.min(1, (w * 0.7) / (p.left + p.right));
  const sy = Math.min(1, (h * 0.7) / (p.top + p.bottom));
  return { top: p.top * sy, bottom: p.bottom * sy, left: p.left * sx, right: p.right * sx };
}

/** 경계에 맞춰 화면을 옮긴다. 지구 보기에서는 카메라 여백이 이미 카드 자리를 비우므로 작은 여백만 더한다 */
function fitTo(
  m: MapLibreMap,
  bounds: LngLatBoundsLike,
  padding: Padding,
  duration: number,
  globe: boolean,
) {
  m.fitBounds(bounds, { padding: globe ? 24 : scaledPadding(m, padding), duration });
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
  focus,
  onPick,
  globe = false,
  padding = 80,
  controls = false,
  className = "",
  children,
}: {
  boundaries?: PlaceBoundaries;
  /** 크게 축소하면 지구로 보이게 한다(새 질문처럼 지역을 넓게 둘러보는 지도) */
  globe?: boolean;
  /**
   * 눌러서 고를 수 있는 다른 지역(시군구). 가는 선 · 점 + 이름으로 그리고(고른 지역은 앰버 점 + 크고 굵게),
   * 마우스를 올리면 그 지역이 밝게 떠오르며, 지역이나 이름표를 누르면 onPick. 넘기면 바탕 지도의 지명은 흐려진다
   */
  choices?: Feature[];
  /** 고른 곳이 없을 때 보여 줄 곳(「광주」 처럼 고를 후보가 여럿이면 그 구들로 옮겨 간다) */
  focus?: Feature[];
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
  // 우리 원본의 마지막 데이터(바탕을 갈아 끼울 때 다시 넣는다)
  const data = useRef({ choices: collection([]), boundaries: collection([]) });
  const theme = useTheme();
  // 지도를 만들 때 · 바탕을 갈아 끼울 때 읽는 지금 상태(효과 밖에서 바뀌는 값)
  const now = useRef({ theme, globe, picking: choices !== undefined });
  useEffect(() => {
    now.current = { theme, globe, picking: choices !== undefined };
  });

  // 지금 바탕이 어느 테마로 그려졌는지. 처음 그린 뒤 화면 테마가 바로 바뀌는 경우(새로 고침 직후 다크)도 따라간다
  const styledTheme = useRef<Theme>(undefined);
  // 레이어 패널에서 숨긴 경계 층. 바탕을 갈아 끼울 때 읽도록 ref 로도 둔다
  const [hidden, setHidden] = useState<Set<BoundaryLayer>>(() => new Set());
  const hiddenNow = useRef(hidden);
  useEffect(() => {
    hiddenNow.current = hidden;
    if (!map) return;
    for (const [group, { ids }] of Object.entries(BOUNDARY_LAYERS)) {
      const visibility = hidden.has(group as BoundaryLayer) ? "none" : "visible";
      for (const id of ids)
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
    }
  }, [map, hidden]);

  // 지도는 한 번만 만든다. 층도 이때 그리는 순서대로(아래 → 위) 쌓아 두고, 경계가 오면 데이터만 바꾼다
  useEffect(() => {
    if (!box.current) return;
    const styled = now.current.theme;
    styledTheme.current = styled;
    const m = new MapLibreMap({
      container: box.current,
      style: BASEMAPS[styled],
      center: KOREA,
      zoom: 6,
      attributionControl: {
        compact: true,
        customAttribution: now.current.globe ? "NASA Blue Marble" : undefined,
      },
    });
    m.on("load", () => {
      dressBasemap(m, now.current);
      m.addSource("choices", {
        type: "geojson",
        data: data.current.choices,
        promoteId: "place_id",
      });
      m.addSource("boundaries", { type: "geojson", data: data.current.boundaries });
      for (const layer of ourLayers(readColors(palette.current), styled, hiddenNow.current))
        m.addLayer(layer);
      setMap(m);
    });
    return () => {
      setMap(null);
      m.remove();
    };
  }, []);

  // 화면 테마가 바뀌면 바탕을 갈아 끼운다. 우리 원본은 마지막 데이터로, 우리 층은 새 테마 색으로 다시 얹는다
  // (갈아 끼우는 동안 들어온 경계 · 고를 지역도 data 에 남아 있어 빠지지 않는다)
  useEffect(() => {
    if (!map || styledTheme.current === theme) return;
    styledTheme.current = theme;
    map.setStyle(BASEMAPS[theme], {
      diff: false,
      transformStyle: (_, next) => ({
        ...next,
        sources: {
          ...next.sources,
          choices: { type: "geojson", data: data.current.choices, promoteId: "place_id" },
          boundaries: { type: "geojson", data: data.current.boundaries },
        },
        layers: [
          ...next.layers,
          ...ourLayers(readColors(palette.current), theme, hiddenNow.current),
        ],
      }),
    });
    map.once("style.load", () => dressBasemap(map, now.current));
  }, [map, theme]);

  // 지구 보기에서는 카드가 덮는 자리를 카메라 여백으로 비운다 — 축소한 지구가 보이는 지도 칸 가운데 온다
  useEffect(() => {
    if (!map || !globe) return;
    const apply = () => map.setPadding(scaledPadding(map, padding));
    apply();
    map.on("resize", apply);
    return () => {
      map.off("resize", apply);
    };
  }, [map, globe, padding]);

  // 경계가 바뀌면 데이터를 바꾸고 화면을 맞춘다. 고르고 있던 지역을 비우면(boundaries 없음) 그려 둔 것도 지우고,
  // 보여 줄 곳(focus)이 있으면 그쪽으로 옮긴다
  useEffect(() => {
    if (!map) return;
    if (!boundaries) {
      if (shown.current) {
        data.current.boundaries = collection([]);
        map.getSource<GeoJSONSource>("boundaries")?.setData(data.current.boundaries);
        shown.current = undefined;
      }
      const area = focus?.length ? boundsOf(focus) : null;
      if (area) fitTo(map, area, padding, 600, globe);
      return;
    }
    data.current.boundaries = boundaries as Data;
    map.getSource<GeoJSONSource>("boundaries")?.setData(data.current.boundaries);
    if (!bounds) return;
    // 처음은 바로, 고른 지역이 바뀌면 그쪽으로 옮겨 간다(움직임 줄이기 설정이면 MapLibre 가 바로 옮긴다).
    // 창 크기가 바뀌면(창 늘리기 · 옆 패널) 다시 맞춘다
    const moved = shown.current !== undefined && shown.current !== boundaries;
    shown.current = boundaries;
    fitTo(map, bounds, padding, moved ? 600 : 0, globe);
    const refit = () => fitTo(map, bounds, padding, 0, globe);
    map.on("resize", refit);
    return () => {
      map.off("resize", refit);
    };
  }, [map, boundaries, bounds, focus, padding, globe]);

  // 고르는 화면: 다른 지역의 시군구 경계와 이름표(고른 곳 + 고를 수 있는 곳), 바탕 지명은 흐리게
  useEffect(() => {
    if (!map) return;
    const isSigungu = (f: Feature) => f.properties.level === "sigungu";
    const others = (choices ?? []).filter(isSigungu);
    data.current.choices = collection(others);
    map.getSource<GeoJSONSource>("choices")?.setData(data.current.choices);
    if (!choices) return;
    // 바탕을 갈아 끼우는 중이면 다 불러온 뒤 dressBasemap 이 흐리게 한다
    if (map.isStyleLoaded()) fadeBasemapLabels(map, now.current);

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
      const area = boundsOf(members.map((t) => t.f));
      el.addEventListener("click", () => area && fitTo(map, area, padding, 600, globe));
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
  }, [map, choices, boundaries, padding, globe]);

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
          onLocate={bounds ? () => fitTo(map, bounds, padding, 600, globe) : undefined}
          layers={(Object.keys(BOUNDARY_LAYERS) as BoundaryLayer[]).map((id) => ({
            id,
            label: BOUNDARY_LAYERS[id].label,
            on: !hidden.has(id),
          }))}
          onToggleLayer={(id) =>
            setHidden((now) => {
              const next = new Set(now);
              if (!next.delete(id as BoundaryLayer)) next.add(id as BoundaryLayer);
              return next;
            })
          }
        />
      )}
      <MapContext value={map}>{children}</MapContext>
    </div>
  );
}
