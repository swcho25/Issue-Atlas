"use client";

import { useEffect, useRef } from "react";

import type { Argument } from "@/shared/api";
import { Icon } from "@/shared/ui/icon";

import {
  barLayout,
  barNumber,
  CHART_WIDTH,
  changeSeries,
  signAxis,
  yearlyAggregate,
  yearlyBars,
} from "../../model/views";

// 변화형 그림 시트(Figma Sheet · 그림: 520 · 안쪽 20 · 24 · 칸 사이 10 · 모서리 18 · 테두리 text-1 6% · 그림자 0 6 20 10% = shadow-legend).
// 연도별 막대(data-navy · 모서리 2). 해 수 · 부호가 어떻든 그릴 수 있게 배치는 barLayout 이 정한다(막대 최소 4, 넘치면 좌우 스크롤)
// (3개까지 Figma 칸 122 · 사이 28 · 막대 56, 부호가 섞이면 0 선이 가운데쯤 · 양수 위로 · 음수 아래로)

export function ChangeSheet({ argument }: { argument: Argument }) {
  const series = changeSeries(argument);
  if (!series) return null;
  return <Chart argument={argument} series={series} />;
}

function Chart({
  argument,
  series,
}: {
  argument: Argument;
  series: NonNullable<ReturnType<typeof changeSeries>>;
}) {
  const agg = yearlyAggregate(series.unit);
  const bars = yearlyBars(series);
  const layout = barLayout(bars.map((b) => b.value));
  const axis = signAxis(series.indicator_id);
  const source = argument.data.statistics[0];
  const scroller = useRef<HTMLDivElement>(null);
  // 스크롤이 생기면 최근 해(오른쪽 끝)부터 보인다
  useEffect(() => {
    const el = scroller.current;
    if (el && layout.scroll) el.scrollLeft = el.scrollWidth;
  }, [layout.scroll, layout.width]);

  return (
    <section
      aria-label="변화형 그림"
      className="pointer-events-auto flex w-[520px] flex-col gap-2.5 rounded-[18px] border border-text-1/6 bg-surface-1 px-6 py-5 shadow-legend"
    >
      {/* 제목(16 Bold · 줄 18) · 출처 줄(12 · 줄 14): 응답에 그림 제목 칸이 없어 근거 자료 이름 + 「연」, 출처 · 단위 · 합계/평균 */}
      <header className="grid gap-0.5">
        <h2 className="text-heading-16 leading-4.5 text-text-1">
          {source?.title ?? series.name ?? series.indicator_id} · 연
        </h2>
        <p className="text-caption-12 leading-3.5 text-text-3">
          {[
            source?.source_name,
            series.unit && `단위 ${series.unit}`,
            agg === "sum" ? "해마다 합계" : "해마다 평균",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {/* 부호가 방향인 지표(순이동)만: 0 선 위아래 뜻. 막대가 많아도 겹치지 않게 그림 위 한 줄로 */}
      {axis && (
        <p className="text-caption-12 leading-3.5 text-text-2">
          0 선 위 {axis.positive} · 아래 {axis.negative}
        </p>
      )}

      {/* 막대가 많아 그림 칸이 시트(422)보다 넓으면 좌우 스크롤, 처음엔 최근 해(오른쪽 끝)를 보인다.
          넓지 않으면 스크롤 칸을 두지 않는다(양끝 연도 글자가 칸 밖으로 조금 넘쳐도 잘리지 않게) */}
      <div
        ref={scroller}
        tabIndex={layout.scroll ? 0 : undefined}
        aria-label={layout.scroll ? "막대 그림, 좌우로 스크롤" : undefined}
        className={`mx-auto ${layout.scroll ? "[scrollbar-width:thin] overflow-x-auto" : ""}`}
        style={{ width: CHART_WIDTH }}
      >
        <ol
          className="flex"
          style={{ width: layout.width, height: layout.height, gap: layout.gap }}
        >
          {bars.map((b, i) => {
            const item = layout.items[i];
            const value =
              b.value === null ? (layout.small ? "—" : "자료 없음") : barNumber(b.value, agg);
            // 글자가 칸보다 넓을 수 있어 칸 가운데를 기준으로 양쪽으로 넘친다
            const centered = "absolute left-1/2 -translate-x-1/2 whitespace-nowrap";
            return (
              <li
                key={b.year}
                title={`${b.year} · ${value}`}
                className="relative shrink-0"
                style={{ width: layout.column }}
              >
                {/* 0 선(칸 폭) */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 h-px bg-border-1"
                  style={{ top: layout.zero }}
                />
                {item && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 rounded-[2px] bg-data-navy"
                    style={{ top: item.barTop, height: item.height, width: layout.barWidth }}
                  />
                )}
                {/* 값: 칸이 넉넉하면 막대 끝 바깥, 아주 좁으면 숨기고 툴팁 · 화면 낭독기로 */}
                {layout.showValues ? (
                  <span
                    className={`${centered} text-text-1 ${layout.small ? "text-caption-11" : "text-label-12"}`}
                    style={{ top: item ? item.labelTop : layout.zero + 6 }}
                  >
                    {value}
                  </span>
                ) : (
                  <span className="sr-only">{value}</span>
                )}
                {/* 연도: 마지막 해부터 건너뛰며(좁을 때) 보이고, 안 보이는 해도 화면 낭독기에는 읽힌다 */}
                <span
                  className={
                    layout.showYear(i) ? `${centered} text-caption-11 text-text-3` : "sr-only"
                  }
                  style={layout.showYear(i) ? { top: layout.yearTop } : undefined}
                >
                  {b.year}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {argument.claim.text && (
        <p className="flex items-start gap-1.5 text-caption-12 text-text-2">
          <Icon name="alert" className="mt-0.5 size-3 shrink-0 text-text-3" />
          {argument.claim.text}
        </p>
      )}
    </section>
  );
}
