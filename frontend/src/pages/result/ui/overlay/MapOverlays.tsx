"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Argument } from "@/shared/api";
import { Icon } from "@/shared/ui/icon";

import { articleMarks } from "../../model/articles";
import {
  defaultMonth,
  distributionMonths,
  hasAqBands,
  monthSummary,
  stationPoints,
  stationSeries,
} from "../../model/distribution";
import { judgmentBadge } from "../../model/labels";
import { observationOrder } from "../../model/observationOrder";
import { openViews, type ViewType, viewTypes } from "../../model/views";
import { summaryHref } from "../tabs";
import { ArticleDots, ArticleLegend } from "./ArticleDots";
import { ChangeSheet } from "./ChangeSheet";
import { DistributionLegend } from "./DistributionLegend";
import { GlassActions } from "./GlassActions";
import { OrderMarkers, OrderSheet } from "./OrderView";
import { StationDots } from "./StationDots";

// 04 지도 위 부품(Figma 04): 위 유형 전환(+ 분포형이면 시점) · 오른쪽 위 유리 아이콘 · 그림 시트 · 범례 · 아래 유리 바.
// 셋 다 결과 카드(왼쪽 24 + 폭 400 + 사이 24 = 448) 오른쪽의 빈 지도 위에 둔다. 유형 전환은 그 왼쪽 끝,
// 시트 · 유리 바는 그 영역 가운데(Figma 520 ~ 1600 의 가운데 1060)
const FREE_LEFT = "left-[448px]";

export function MapOverlays({ argument }: { argument: Argument }) {
  const { enabled, initial } = openViews(argument);
  const [view, setView] = useState<ViewType | null>(initial);

  // 분포형: 고른 달의 측정소 점
  const stations = useMemo(() => stationSeries(argument), [argument]);
  const [month, setMonth] = useState(() => defaultMonth(stations));
  const points = useMemo(() => (month ? stationPoints(stations, month) : []), [stations, month]);
  const unit = stations[0]?.unit ?? null;
  const distribution = view === "distribution" && month !== null;

  // 변화형 위 기사 점
  const articles = useMemo(() => articleMarks(argument), [argument]);
  // 관측 순서: 지역마다 첫 기사 달 순서
  const order = useMemo(() => observationOrder(argument), [argument]);

  return (
    <>
      <TypeSwitch enabled={enabled} current={view} onChange={setView} />
      <GlassActions argument={argument} />
      {distribution && (
        <>
          <MonthPicker months={distributionMonths(stations)} value={month} onChange={setMonth} />
          <StationDots points={points} unit={unit} />
          {/* Figma Legend 자리: 지도 오른쪽 86 · 아래 226(지도 버튼 묶음 위 왼쪽) */}
          {hasAqBands(stations[0]?.indicator_id) && (
            <div className="absolute right-[86px] bottom-[226px] z-control">
              <DistributionLegend />
            </div>
          )}
        </>
      )}
      {view === "change" && (
        <>
          <div
            className={`pointer-events-none absolute right-0 bottom-24 ${FREE_LEFT} z-control flex justify-center`}
          >
            <ChangeSheet argument={argument} />
          </div>
          {/* 순이동 막대 + 기사 점(Figma 「변화형 · 청년 유출」). 범례는 유리 아이콘 아래(오른쪽 16 · 위 72) */}
          {(articles.dots.length > 0 || articles.groups.length > 0) && (
            <>
              <ArticleDots dots={articles.dots} groups={articles.groups} />
              <div className="absolute top-[72px] right-4 z-control">
                <ArticleLegend
                  hasDots={articles.dots.length > 0}
                  hasGroups={articles.groups.length > 0}
                />
              </div>
            </>
          )}
        </>
      )}
      {view === "observationOrder" && (
        <>
          <OrderMarkers stops={order} />
          <div
            className={`pointer-events-none absolute right-0 bottom-24 ${FREE_LEFT} z-control flex justify-center`}
          >
            <OrderSheet stops={order} />
          </div>
        </>
      )}
      <div
        className={`pointer-events-none absolute right-0 bottom-6 ${FREE_LEFT} z-control flex justify-center`}
      >
        <ResultBar
          argument={argument}
          summary={distribution ? monthSummary(points, month, unit) : undefined}
        />
      </div>
    </>
  );
}

/**
 * 분포형 시점(Figma glass · 시점 102 × 34: 유리 알약 · 안쪽 8 · 16 · Bold 14 「2024-03 ▾」). 유형 전환 오른쪽 8(448 + 392 + 8).
 * 고르는 칸은 기본 select 라 키보드 · 낭독기가 그대로 쓴다
 */
function MonthPicker({
  months,
  value,
  onChange,
}: {
  months: string[];
  value: string;
  onChange: (month: string) => void;
}) {
  return (
    <label className="absolute top-[21px] left-[848px] z-control flex h-[34px] items-center rounded-full glass pr-3 pl-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-text-1">
      <span className="sr-only">분포형 시점(달)</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-5 text-title-14 font-bold text-text-1 outline-none"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" className="pointer-events-none -ml-4 size-4 text-text-1" />
    </label>
  );
}

/**
 * 유형 전환(Figma Map/유형 전환: 392 × 36 · 유리 · 안쪽 4(유리 테두리 1 + 안쪽 3), 칸 77 × 28 · Bold 11.2 · 고른 칸 앰버 렌즈, 꺼진 칸 32%).
 * 결과가 가진 유형만 켜진다
 */
function TypeSwitch({
  enabled,
  current,
  onChange,
}: {
  enabled: Set<ViewType>;
  current: ViewType | null;
  onChange: (v: ViewType) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="시공간 유형"
      className={`absolute top-5 glass ${FREE_LEFT} z-control flex rounded-full p-0.75`}
    >
      {viewTypes.map((v) => {
        const on = enabled.has(v.key);
        const selected = current === v.key;
        return (
          <button
            key={v.key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!on}
            onClick={() => onChange(v.key)}
            className={`h-7 w-[77px] rounded-full text-label-12 font-bold disabled:opacity-32 ${selected ? "lens-amber text-text-on-primary" : on ? "text-text-1 hover:bg-glass-hover" : "text-text-1"}`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 아래 유리 바(Figma Glass/Question bar · 결과: 556 × 56 · 안쪽 10 · 10 · 10 · 22 · 사이 12).
 * 점(앰버) · 결과 한 줄 · 「근거 수요표」(글자 버튼) · 「논증 카드 보기」(키 컬러 M 36)
 */
function ResultBar({ argument, summary }: { argument: Argument; summary?: string }) {
  const { question } = argument;
  const base = summaryHref(argument.run_id);
  return (
    <nav
      aria-label="결과 바로 가기"
      // 분포형은 한 줄이 길어 Figma 도 594 폭(그 밖 556)
      className={`pointer-events-auto flex h-14 items-center gap-3 rounded-full glass py-2.5 pr-2.5 pl-5.5 ${summary ? "w-[594px]" : "w-[556px]"}`}
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-primary/80" />
      <p className="min-w-0 flex-1 truncate text-title-14 text-text-1">
        {summary ??
          [question.place_name, question.card_name, judgmentBadge(argument).label]
            .filter(Boolean)
            .join(" · ")}
      </p>
      <Link
        href={`${base}/evidence`}
        className="shrink-0 rounded-full px-3 py-2 text-body-14 text-text-2 hover:bg-glass-hover"
      >
        근거 수요표
      </Link>
      {/* Figma Button/키 컬러 M(36 · 좌우 18 · Bold 14). 이 바에서만 쓰여 공통으로 빼지 않았다 */}
      <Link
        href={`${base}/argument`}
        className="flex h-9 shrink-0 items-center rounded-full bg-primary px-4.5 text-title-14 text-text-on-primary shadow-button hover:bg-primary-hover"
      >
        논증 카드 보기
      </Link>
    </nav>
  );
}
