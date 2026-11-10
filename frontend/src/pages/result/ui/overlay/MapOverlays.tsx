"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Argument } from "@/shared/api";

import { boundariesQuery } from "../../api/boundariesQuery";
import { articleMarks } from "../../model/articles";
import { hasAqBands, monthSummary, stationPoints, stationSeries } from "../../model/distribution";
import { judgmentBadge } from "../../model/labels";
import { movementBars, movementDots } from "../../model/movement";
import { observationOrder } from "../../model/observationOrder";
import { defaultMonth, periodMonths } from "../../model/timeline";
import { changeSeries, openViews, type ViewType, viewTypes } from "../../model/views";
import { summaryHref } from "../tabs";
import { ArticleDetail, ArticleGroupDetail, ArticleStackDetail } from "./ArticleDetail";
import { ArticleDots, ArticleLegend, articleMark, groupMark } from "./ArticleDots";
import { ChangeSheet } from "./ChangeSheet";
import { DistributionLegend } from "./DistributionLegend";
import { GlassActions } from "./GlassActions";
import { MovementDots } from "./MovementDots";
import { MovementSheet } from "./MovementSheet";
import { OrderMarkers, OrderSheet } from "./OrderView";
import { StationDetail } from "./StationDetail";
import { focusMark } from "./pressable";
import { StationDots, stationMark } from "./StationDots";
import { TimeSlider } from "./TimeSlider";

// 04 지도 위 부품(Figma 04): 위 유형 전환 · 오른쪽 위 유리 아이콘 · 시간 슬라이더 · 그림 시트 · 범례 · 아래 유리 바.
// 시간 슬라이더는 모든 유형이 하나를 함께 쓴다(시공간 표시 개발 명세 7절 「월 슬라이더 하나를 공유한다」) — 그림 시트 바로 위.
// 셋 다 결과 카드(왼쪽 24 + 폭 400 + 사이 24 = 448) 오른쪽의 빈 지도 위에 둔다. 유형 전환은 그 왼쪽 끝,
// 시트 · 유리 바는 그 영역 가운데(Figma 520 ~ 1600 의 가운데 1060)
const FREE_LEFT = "left-[448px]";

export function MapOverlays({ argument }: { argument: Argument }) {
  const { enabled, initial } = openViews(argument);
  const [view, setView] = useState<ViewType | null>(initial);

  // 공통 시간 슬라이더: 질문 기간의 달에서 하나를 고른다. 처음엔 값이 있는 마지막 달, 유형을 바꿔도 그대로.
  // 응답의 그림 줄은 모두 같은 칸(달 · 값)이라 모든 유형이 이 달 하나를 쓴다. 보이는 것만 바꾼다(판단은 질문 기간 그대로)
  const months = useMemo(() => periodMonths(argument), [argument]);
  const [month, setMonth] = useState(() => defaultMonth(argument));

  // 측정소 점: 고른 달 값. 분포형, 그리고 막대 그림 줄이 없는 변화형(A3 — C1 은 순이동 막대 시트)
  const stations = useMemo(() => stationSeries(argument), [argument]);
  const points = useMemo(() => (month ? stationPoints(stations, month) : []), [stations, month]);
  const unit = stations[0]?.unit ?? null;
  const distribution = view === "distribution" && month !== null;
  const timeline =
    view === "change" && month !== null && stations.length > 0 && !changeSeries(argument);
  // 측정소 상세 창: 고른 측정소(달을 바꿔도 같은 측정소, 그 달 값으로)
  const [stationId, setStationId] = useState<string | null>(null);
  const station = distribution || timeline ? points.find((p) => p.id === stationId) : undefined;
  const closeStation = (refocus: boolean) => {
    const id = stationId;
    setStationId(null);
    // 닫기 · Esc 로 닫으면 그 점으로 초점을 돌린다(지도 빈 곳을 눌러 닫으면 그대로)
    if (refocus && id) focusMark(stationMark(id));
  };

  // 변화형 위 기사 점. 누르면 기사 창(그 자리 기사 하나) · 목록 창(같은 자리 여럿 · 위치 근사 묶음) — 「근거 기사 2클릭 → 원문」
  const articles = useMemo(() => articleMarks(argument), [argument]);
  const [articleKey, setArticleKey] = useState<string | null>(null);
  const pickedDot = articles.dots.find((d) => articleMark(d.key) === articleKey);
  const pickedGroup = articles.groups.find((g) => groupMark(g.key) === articleKey);
  const pickedIds = pickedDot?.ids ?? pickedGroup?.ids;
  // 고른 자리의 기사(최신 순)
  const pickedArticles = pickedIds
    ? argument.articles
        .filter((a) => pickedIds.includes(a.id))
        .sort((x, y) => (y.date ?? "").localeCompare(x.date ?? ""))
    : [];
  const closeArticle = (refocus: boolean) => {
    const key = articleKey;
    setArticleKey(null);
    if (refocus && key) focusMark(key);
  };
  // 관측 순서: 고른 달까지 처음 나온 지역의 순서
  const order = useMemo(() => observationOrder(argument, month ?? undefined), [argument, month]);
  // 이동형: 출발지의 시도(같은 도 안 이동을 막대 밖으로). 결과 지도가 이미 받은 경계(같은 캐시)의 parent_id.
  // 받는 중이면 undefined, 못 받으면 null(도 안 이동도 막대로)
  const placeId = argument.question.place_id;
  const { data: boundaries, isError: noBoundaries } = useQuery({
    ...boundariesQuery(placeId),
    enabled: view === "movement",
  });
  const parentId = noBoundaries
    ? null
    : boundaries &&
      (boundaries.features.find((f) => f.properties.place_id === placeId)?.properties.parent_id ??
        null);
  // 시트 막대와 지도 원이 같은 값을 쓴다. 출발지 시도를 받는 중이면 둘 다 기다린다(도 안 이동이 잠깐 막대 · 원으로 보이지 않게)
  const movement = useMemo(
    () => (parentId === undefined ? null : movementBars(argument, parentId, month ?? undefined)),
    [argument, parentId, month],
  );
  const movementMarks = useMemo(() => (movement ? movementDots(movement) : []), [movement]);

  return (
    <>
      <TypeSwitch
        enabled={enabled}
        current={view}
        onChange={(v) => {
          setView(v);
          setStationId(null);
          setArticleKey(null);
        }}
      />
      <GlassActions argument={argument} />
      {(distribution || timeline) && (
        <>
          <StationDots
            points={points}
            unit={unit}
            selectedId={station?.id ?? null}
            onSelect={setStationId}
          />
          {station && month && (
            <StationDetail
              point={station}
              month={month}
              unit={unit}
              refs={argument.data.statistics}
              runId={argument.run_id}
              onClose={closeStation}
            />
          )}
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
          {/* 순이동 막대 + 기사 점(Figma 「변화형 · 청년 유출」). 범례는 유리 아이콘 아래(오른쪽 16 · 위 72) */}
          {(articles.dots.length > 0 || articles.groups.length > 0) && (
            <>
              <ArticleDots
                dots={articles.dots}
                groups={articles.groups}
                month={month}
                selected={articleKey}
                onSelect={setArticleKey}
              />
              {pickedDot && pickedArticles.length === 1 && (
                <ArticleDetail
                  article={pickedArticles[0]}
                  at={pickedDot.at}
                  markKey={articleMark(pickedDot.key)}
                  runId={argument.run_id}
                  onClose={closeArticle}
                />
              )}
              {pickedDot && pickedArticles.length > 1 && (
                <ArticleStackDetail
                  dot={pickedDot}
                  articles={pickedArticles}
                  markKey={articleMark(pickedDot.key)}
                  runId={argument.run_id}
                  onClose={closeArticle}
                />
              )}
              {pickedGroup && (
                <ArticleGroupDetail
                  group={pickedGroup}
                  articles={pickedArticles}
                  markKey={groupMark(pickedGroup.key)}
                  runId={argument.run_id}
                  onClose={closeArticle}
                />
              )}
              <div className="absolute top-[72px] right-4 z-control">
                <ArticleLegend
                  hasDots={articles.dots.length > 0}
                  hasGroups={articles.groups.length > 0}
                  dimsOthers={month !== null}
                />
              </div>
            </>
          )}
        </>
      )}
      {/* 이동형(Figma 「결과 · 이동형 · 청년 유출」): 그림 시트 + 도착 시도 대표점 원. 선 · 화살표는 없다 */}
      {view === "movement" && movement && (
        <MovementDots dots={movementMarks} from={movement.from} />
      )}
      {view === "observationOrder" && <OrderMarkers stops={order} />}
      {/* 시간 슬라이더(모든 유형 공통) + 그 유형의 그림 시트. 빈 지도 가운데 아래에 위 → 아래로 쌓는다 */}
      <div
        className={`pointer-events-none absolute right-0 bottom-24 ${FREE_LEFT} z-control flex flex-col items-center gap-3`}
      >
        {view && month && months.length > 1 && (
          <TimeSlider months={months} value={month} onChange={setMonth} />
        )}
        {view === "change" && <ChangeSheet argument={argument} month={month ?? undefined} />}
        {view === "movement" && movement && (
          <MovementSheet data={movement} place={argument.question.place_name} />
        )}
        {view === "observationOrder" && <OrderSheet stops={order} />}
      </div>
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
 * 점(앰버) · 결과 한 줄 · 「자료 현황」(글자 버튼) · 「분석 근거 보기」(키 컬러 M 36)
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
        자료 현황
      </Link>
      {/* Figma Button/키 컬러 M(36 · 좌우 18 · Bold 14). 이 바에서만 쓰여 공통으로 빼지 않았다 */}
      <Link
        href={`${base}/argument`}
        className="flex h-9 shrink-0 items-center rounded-full bg-primary px-4.5 text-title-14 text-text-on-primary shadow-button hover:bg-primary-hover"
      >
        분석 근거 보기
      </Link>
    </nav>
  );
}
