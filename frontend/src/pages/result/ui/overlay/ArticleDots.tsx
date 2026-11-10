"use client";

import { Marker } from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef } from "react";

import { useMapInstance } from "@/shared/ui/map";

import { type ApproxGroup, type ArticleDot, markInMonth } from "../../model/articles";
import { pressable } from "./pressable";

// 기사 점(Figma 「기사 점」): 주소 기사 = 남색 점 10 · 흰 테두리 2 · 옅은 그림자,
// 위치 근사 묶음 = 흰 60% · 남색 테두리 1.5 원 22 + 이름표(흰 92% · 모서리 4 · 안쪽 2 · 6 · Medium 11).
// Figma 의 「흰」 은 surface-1 로 — 어두운 화면에서 고정 흰 바탕 위 밝은 글자(text-1)가 1.02 : 1 로 안 읽혔다.
// 분포형 측정소 점처럼 지도 층이 아니라 Marker 로(바탕을 갈아 끼워도 남는다)

/**
 * 고른 달의 기사가 없는 자리는 흐리게(명세 7절 「기사 점: 고른 달은 진하게, 다른 달은 흐린 점」).
 * MapLibre 가 Marker 요소의 opacity 를 직접 쓰므로(가림 처리) 요소 자신이 아니라 안쪽에 건다
 */
const DIM = "*:opacity-35";

/** 기사 점 · 묶음의 data-mark 키(창을 닫은 뒤 초점을 돌릴 때) */
export const articleMark = (id: string) => `article:${id}`;
export const groupMark = (key: string) => `article-group:${key}`;

/**
 * 점 10 은 누르기에 작아 투명한 18 칸 안에 둔다. 고른 점은 테두리가 먹색 · 12 로.
 * 같은 자리 기사가 여럿이면 점 오른쪽에 「N건」(묶음 이름표와 같은 모양)
 */
function dotElement(d: ArticleDot) {
  const el = document.createElement("span");
  el.className = "flex items-center gap-0.5";
  const hit = document.createElement("span");
  hit.className = "grid size-[18px] place-items-center";
  const dot = document.createElement("span");
  dot.dataset.ring = "";
  dot.className = "block size-2.5 rounded-full bg-map-region shadow-sm ring-2 ring-white";
  hit.append(dot);
  el.append(hit);
  if (d.ids.length > 1) {
    const tag = document.createElement("span");
    tag.className =
      "rounded-sm bg-surface-1/92 px-1 py-px text-caption-11 font-medium whitespace-nowrap text-map-region";
    tag.textContent = `${d.ids.length}건`;
    el.append(tag);
  }
  el.title = d.name;
  return { el, label: `기사 ${d.name}` };
}

/**
 * 위치 근사 묶음: 원 + 「N건」. 행정동 중심끼리는 가까워 전체 이름(「위치 근사 · 여수시 중심 3건」)을 늘 쓰면
 * 이름표끼리 겹친다. 전체 이름은 마우스를 올렸을 때(title) · 눌러 연 창 제목으로 보인다
 */
function groupElement(g: ApproxGroup) {
  const el = document.createElement("div");
  el.className = "flex items-center gap-1";
  const ring = document.createElement("span");
  ring.dataset.ring = "";
  ring.className =
    "size-[22px] shrink-0 rounded-full border-[1.5px] border-map-region bg-surface-1/60";
  const tag = document.createElement("span");
  tag.className =
    "rounded-sm bg-surface-1/92 px-1.5 py-0.5 text-caption-11 font-medium whitespace-nowrap text-text-1";
  tag.textContent = `${g.count}건`;
  el.append(ring, tag);
  el.title = g.name;
  return { el, label: g.name };
}

/** 고른 표시: 점은 먹색 테두리 · 12, 묶음 원은 먹색 테두리 2 */
function markSelected(el: HTMLElement, on: boolean) {
  el.setAttribute("aria-expanded", String(on));
  const ring = el.querySelector<HTMLElement>("[data-ring]");
  if (!ring) return;
  if (ring.classList.contains("ring-2")) {
    ring.classList.toggle("ring-white", !on);
    ring.classList.toggle("ring-text-1", on);
    ring.classList.toggle("size-2.5", !on);
    ring.classList.toggle("size-3", on);
  } else {
    ring.classList.toggle("border-map-region", !on);
    ring.classList.toggle("border-[1.5px]", !on);
    ring.classList.toggle("border-text-1", on);
    ring.classList.toggle("border-2", on);
  }
}

/**
 * 기사 점 · 위치 근사 묶음을 지도에 놓는다. 묶음은 원 가운데가 그 자리에 오게(왼쪽 기준 · 반지름 11 만큼).
 * 누르면(Enter · Space) onSelect(data-mark 키) — 기사 창 · 묶음 목록 창
 */
export function ArticleDots({
  dots,
  groups,
  month,
  selected,
  onSelect,
}: {
  dots: ArticleDot[];
  groups: ApproxGroup[];
  /** 고른 달(공통 시간 슬라이더). 그 달 기사가 없는 자리는 흐리게 — 누를 수는 있다 */
  month: string | null;
  /** 고른 점 · 묶음의 data-mark 키 */
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const map = useMapInstance();
  const select = useRef(onSelect);
  useLayoutEffect(() => {
    select.current = onSelect;
  });
  const placed = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!map) return;
    const marks = placed.current;
    const put = (key: string, { el, label }: { el: HTMLElement; label: string }) => {
      pressable(el, key, label, () => select.current(key));
      marks.set(key, el);
      return el;
    };
    const markers = [
      ...groups.map((g) =>
        new Marker({
          element: put(groupMark(g.key), groupElement(g)),
          anchor: "left",
          offset: [-11, 0],
        })
          .setLngLat(g.at)
          .addTo(map),
      ),
      // 점 가운데가 그 자리에 오게: 왼쪽 끝 기준, 누름 칸 반지름(9) 만큼 왼쪽으로(「N건」 이 붙어도 점이 움직이지 않게)
      ...dots.map((d) =>
        new Marker({
          element: put(articleMark(d.key), dotElement(d)),
          anchor: "left",
          offset: [-9, 0],
        })
          .setLngLat(d.at)
          .addTo(map),
      ),
    ];
    return () => {
      markers.forEach((m) => m.remove());
      marks.clear();
    };
  }, [map, dots, groups]);

  useEffect(() => {
    for (const [key, el] of placed.current) markSelected(el, key === selected);
  }, [selected, dots, groups]);

  // 고른 달 기사가 없으면 흐리게. 점을 다시 놓은 뒤(map · dots · groups)에도 다시 건다
  useEffect(() => {
    const marks = placed.current;
    const dim = (key: string, mark: { dates: (string | null)[] }) =>
      marks.get(key)?.classList.toggle(DIM, month !== null && !markInMonth(mark, month));
    for (const d of dots) dim(articleMark(d.key), d);
    for (const g of groups) dim(groupMark(g.key), g);
  }, [map, dots, groups, month]);
  return null;
}

/**
 * 기사 점 범례(Figma Legend · 기사 점 193 × 112: 흰 면 · 모서리 12 · 안쪽 12 · 14 · 사이 8, 「보도 기사」 Bold 13 · 줄 Regular 13 text-2).
 * Figma 의 「고른 달」(◆) 줄은 「다른 달」(흐린 점)로 — 고른 달 기사가 진한 쪽이고 모양은 바꾸지 않아서
 */
export function ArticleLegend({
  hasDots,
  hasGroups,
  dimsOthers = false,
}: {
  hasDots: boolean;
  hasGroups: boolean;
  /** 달을 골라 다른 달 기사가 흐려지는가 */
  dimsOthers?: boolean;
}) {
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
      {dimsOthers && (
        <p className="flex items-center gap-2 text-body-13 text-text-2">
          <span aria-hidden className="size-[9px] shrink-0 rounded-full bg-map-region opacity-35" />
          다른 달 기사
        </p>
      )}
    </section>
  );
}
