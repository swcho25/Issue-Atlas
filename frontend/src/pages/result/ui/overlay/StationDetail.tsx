"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { EvidenceRef } from "@/shared/api";
import { StatusBadge, type StatusTone } from "@/shared/ui/badge";
import { Button, buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { useMapInstance } from "@/shared/ui/map";

import { type AqGrade, type StationPoint, stationValueText } from "../../model/distribution";
import { evidenceStatusBadge, yearSpan } from "../../model/labels";
import { copyIcon, useCopy } from "../copy/useCopy";
import { useCardFootnotes } from "../copy/useCardFootnotes";
import { sourcesHref } from "../tabs";

// 04 측정소 상세 창(Figma 「결과 · 측정소 누름 → 상세 창」 Popover · 측정소 360: 흰 · 모서리 18 · 테두리 검정 6% · 안쪽 18 · 20 · 사이 12).
// 점 오른쪽 30 에 꼬리(16 정사각 45°)와 함께 뜨고, 점은 창 위에서 60 아래. 지도를 움직이면 점을 따라간다.
// 머리(이름 · 닫기) · 출처 줄 · 고른 달 값(Number 32) + 단위 · 월평균 + 등급 배지 · 「이 값의 근거 N건」 줄 · 원문 보기 · 각주 복사.
// Figma 의 측정소 종류(도시대기) · 시간값 수 · 확정일 · 측정소 정보 · 고시 근거는 계약에 없어 카드의 통계 근거만 보인다

const WIDTH = 360;
/** 점 가운데에서 창 가장자리까지 */
const GAP = 30;
/** 창 위에서 점(꼬리)까지 */
const DOT_FROM_TOP = 60;
/** 지도 가장자리에서 띄울 거리 */
const EDGE = 16;
/** 꼬리가 모서리(18)에 걸리지 않게 위아래 끝에서 띄울 거리 */
const TAIL_INSET = 26;

/** 등급 배지 색: 점 색(좋음 파랑 · 보통 초록 · 나쁨 앰버 · 매우나쁨 빨강)과 같은 계열, Figma 나쁨 = amber */
const gradeTone: Record<AqGrade["key"], StatusTone> = {
  good: "blue",
  moderate: "green",
  bad: "amber",
  veryBad: "red",
};

/**
 * 창 자리: 점 오른쪽에 자리가 없으면 왼쪽. 위아래는 지도 안에 두고, 꼬리는 점 높이(창 안쪽으로 줄여서)
 */
export function popoverPlacement(
  dot: { x: number; y: number },
  size: { width: number; height: number },
  area: { width: number; height: number },
) {
  const side = dot.x + GAP + size.width <= area.width - EDGE ? "right" : "left";
  const left = side === "right" ? dot.x + GAP : Math.max(EDGE, dot.x - GAP - size.width);
  const top = Math.max(EDGE, Math.min(dot.y - DOT_FROM_TOP, area.height - size.height - EDGE));
  const tail = Math.max(TAIL_INSET, Math.min(dot.y - top, size.height - TAIL_INSET));
  return { side, left, top, tail } as const;
}

/** 점의 화면 자리. 지도가 움직이면 다시 잰다 */
function useDotPosition(at: [number, number]) {
  const map = useMapInstance();
  const [pos, setPos] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const p = map.project(at);
      const box = map.getContainer();
      setPos({ x: p.x, y: p.y, width: box.clientWidth, height: box.clientHeight });
    };
    update();
    map.on("move", update);
    map.on("resize", update);
    return () => {
      map.off("move", update);
      map.off("resize", update);
    };
  }, [map, at]);
  return pos;
}

const copyLabels = { idle: "각주 복사", copied: "복사했어요", failed: "복사하지 못했어요" };

export function StationDetail({
  point,
  month,
  unit,
  refs,
  runId,
  onClose,
}: {
  point: StationPoint;
  month: string;
  unit: string | null;
  /** 이 값의 근거(카드의 통계 근거) */
  refs: EvidenceRef[];
  runId: string;
  /** refocus: 닫은 뒤 점으로 초점을 돌릴지(닫기 · Esc) */
  onClose: (refocus: boolean) => void;
}) {
  const map = useMapInstance();
  const pos = useDotPosition(point.at);
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const { result, copy } = useCopy();
  const footnotes = useCardFootnotes(refs);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  // 창이 붙으면 높이(값 · 근거 수에 따라 다르다)를 재서 자리를 맞춘다
  const attach = useCallback((el: HTMLDivElement | null) => {
    box.current = el;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // 창이 보이면(높이를 재기 전엔 숨어 있어 초점을 못 받는다) · 다른 측정소를 누르면 창으로 초점 — 낭독기가 창을 읽는다
  const shown = height > 0;
  useEffect(() => {
    if (shown) box.current?.focus({ preventScroll: true });
  }, [point.id, shown]);
  // Esc · 지도 빈 곳 누름으로 닫는다(점을 누르면 점이 막아 지도까지 가지 않는다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current(true);
    const onMapClick = () => onCloseRef.current(false);
    document.addEventListener("keydown", onKey);
    map?.on("click", onMapClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      map?.off("click", onMapClick);
    };
  }, [map]);

  if (!pos) return null;
  const place = popoverPlacement(pos, { width: WIDTH, height }, pos);
  const titleId = `station-${point.id}`;
  const main = refs[0];

  return (
    <div
      ref={attach}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      // 높이를 재기 전(첫 그림)에는 숨긴다 — 자리가 튀지 않게
      className={`absolute z-popover flex w-[360px] flex-col gap-3 rounded-[18px] bg-surface-1 px-5 py-4.5 shadow-card inset-ring inset-ring-black/6 outline-none ${height ? "" : "invisible"}`}
      style={{ left: place.left, top: place.top }}
    >
      {/* 꼬리: 16 정사각을 45° 돌려 창 가장자리에 반쯤 걸친다 */}
      <span
        aria-hidden
        className={`absolute size-4 rotate-45 bg-surface-1 ${place.side === "right" ? "-left-px" : "-right-px"}`}
        style={{ top: place.tail - 8 }}
      />
      <div className="relative flex items-center gap-2">
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-heading-16 text-text-1">
          {point.name} 측정소
        </h2>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => onClose(true)}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-text-1 hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-text-1"
        >
          <Icon name="close" className="size-4" />
        </button>
      </div>
      <p className="relative text-caption-12 text-text-3">
        {["실좌표", main?.title, main && `출처 등급 ${main.source_grade}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="relative flex flex-wrap items-baseline gap-2">
        <span className={`text-number-32 ${point.value == null ? "text-text-3" : "text-text-1"}`}>
          {point.value == null ? "—" : stationValueText(point.value)}
        </span>
        <span className="text-caption-12 text-text-2">
          {[unit, `${month} 월평균`].filter(Boolean).join(" · ")}
        </span>
        {point.value == null ? (
          <StatusBadge tone="gray" className="self-center">
            {point.status === "available" ? "값 없음" : evidenceStatusBadge[point.status].label}
          </StatusBadge>
        ) : (
          point.grade && (
            <StatusBadge tone={gradeTone[point.grade.key]} className="self-center">
              {point.grade.label}
            </StatusBadge>
          )
        )}
      </div>
      {refs.length > 0 && (
        <>
          <hr className="relative border-border-1" />
          <h3 className="relative text-label-12 text-text-2">이 값의 근거 {refs.length}건</h3>
          <ul className="relative flex flex-col gap-3">
            {refs.map((ref, i) => (
              <li
                key={ref.evidence_id}
                className={`flex gap-2.5 rounded-lg px-3 py-2.5 ${i === 0 ? "bg-primary-soft" : "bg-surface-2"}`}
              >
                <span className="grid size-5.5 shrink-0 place-items-center rounded-sm bg-surface-2 text-label-12 text-text-1">
                  <span className="sr-only">출처 등급 </span>
                  {ref.source_grade}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-label-13 text-text-1">{ref.title}</span>
                  <span className="text-caption-11 text-text-3">
                    {[ref.source_name, yearSpan(ref.period_start, ref.period_end)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Link
                  href={sourcesHref(runId, ref.evidence_id)}
                  className="flex shrink-0 items-center gap-0.75 self-start rounded-sm text-label-12 text-primary-text hover:underline"
                >
                  원문
                  <span className="sr-only">: {ref.title}</span>
                  <Icon name="external" className="size-3 text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="relative flex gap-2">
        <Link
          href={sourcesHref(runId, main?.evidence_id)}
          className={buttonClass({ variant: "secondary", className: "flex-1" })}
        >
          <Icon name="doc" />
          원문 보기
        </Link>
        <Button
          className="flex-1"
          icon={<Icon name={copyIcon(result)} />}
          disabled={!refs.length}
          onClick={() => copy(footnotes())}
        >
          {copyLabels[result]}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {result === "idle" ? "" : `각주 ${refs.length}건을 ${copyLabels[result]}`}
      </span>
    </div>
  );
}
