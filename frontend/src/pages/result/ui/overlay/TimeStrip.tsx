"use client";

import { type KeyboardEvent, type PointerEvent, useRef } from "react";

// A3 변화형 시간 막대(Figma 「결과 · 변화형 · 대기질」 Time 520 × 122: 유리(흰 10% 위 흰 50%) · 모서리 12 · 안쪽 12 · 14 · 사이 8).
// 위 줄: 고른 달(Medium 13) · 「월 · 관측 시점 기준」(11 text-3). 막대 36(사이 3 · 높이 44 안 · 모서리 1, text-1 22%, 고른 달 남색), 아래 연 눈금.
// 기간이 길면 막대 사이 · 연 눈금을 stripLayout 이 줄인다.
// 막대 줄 전체가 슬라이더 — 누르거나 끌면 그 달, 키보드 ← → 한 달 · PageUp PageDown 열두 달 · Home End 처음 끝.
// Figma 의 재생 버튼은 「재생은 P1」이라 두지 않는다(눌러도 아무 일 없는 버튼을 두지 않는다)

const BAR_MAX = 44;
/** 막대 줄 폭(520 - 안쪽 14 × 2 - 유리 테두리) */
export const STRIP_WIDTH = 490;
/** 연 눈금 글자(「2025」 11 ≈ 27)가 서로 붙지 않게 둘 최소 간격 */
const YEAR_GAP = 36;

/**
 * 달 수가 늘어도(기간 5 · 10 · 20년) 막대가 보이게: 막대가 사이보다 두 배 이상 넓도록 사이를 3 → 2 → 1 → 0 으로 줄이고,
 * 연 눈금은 36 이상 떨어지게 건너뛴다(20년이면 두 해마다). 3년(36개월)은 Figma 그대로 사이 3 · 막대 약 10.7
 */
export function stripLayout(count: number, width = STRIP_WIDTH) {
  const barFor = (gap: number) => (width - gap * (count - 1)) / count;
  const gap = [3, 2, 1].find((g) => barFor(g) >= g * 2) ?? 0;
  const yearStep = Math.max(1, Math.ceil(YEAR_GAP / ((width / count) * 12)));
  return { gap, bar: barFor(gap), yearStep };
}

/** 연 눈금 글자(「2025」 11) 폭 */
const YEAR_LABEL = 28;

/**
 * 연 눈금: 그 해 1월 막대 자리(yearStep 해마다). 기간이 1월에 시작하지 않으면 첫 칸에 그 해를 두되,
 * 다음 해 1월과 YEAR_GAP 보다 가까우면 뺀다(2016-11 시작이면 「2016」 과 두 칸 뒤 「2017」 이 겹친다).
 * 끝 칸 가까이의 1월(1월로 끝나는 기간)은 글자가 줄 밖으로 나가므로 뺀다
 */
export function yearTicks(months: string[], width = STRIP_WIDTH) {
  const per = width / months.length;
  const { yearStep } = stripLayout(months.length, width);
  const januaries = months
    .flatMap((m, i) => (m.endsWith("-01") ? [{ i, year: m.slice(0, 4) }] : []))
    .filter((_, k) => k % yearStep === 0)
    .filter(({ i }) => (months.length - i) * per >= YEAR_LABEL);
  const first = months[0];
  const lead =
    first && !first.endsWith("-01") && (januaries[0]?.i ?? months.length) * per >= YEAR_GAP
      ? [{ i: 0, year: first.slice(0, 4) }]
      : [];
  return [...lead, ...januaries];
}

export function TimeStrip({
  months,
  means,
  value,
  unit,
  onChange,
}: {
  months: string[];
  /** 달마다 측정소 평균(값 없는 달은 null) */
  means: (number | null)[];
  value: string;
  unit: string | null;
  onChange: (month: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const index = Math.max(0, months.indexOf(value));
  const max = Math.max(0, ...means.filter((v): v is number => v != null));
  const pick = (i: number) => onChange(months[Math.min(months.length - 1, Math.max(0, i))]);

  // 누른 자리(가로)의 달
  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return;
    pick(Math.floor(((e.clientX - box.left) / box.width) * months.length));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -12,
      PageUp: 12,
    };
    if (e.key in step) pick(index + step[e.key]);
    else if (e.key === "Home") pick(0);
    else if (e.key === "End") pick(months.length - 1);
    else return;
    e.preventDefault();
  };

  const mean = means[index];
  const valueText = `${value} · ${mean == null ? "값 없음" : `측정소 평균 ${Math.round(mean)}${unit ? ` ${unit}` : ""}`}`;
  const layout = stripLayout(months.length);
  const yearStarts = yearTicks(months);

  return (
    <section
      aria-label="시간 막대"
      className="pointer-events-auto flex w-[520px] flex-col gap-2 rounded-xl glass px-3.5 py-3 [--glass-fill:0.55]"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-label-13 text-text-1">{value}</span>
        <span className="text-caption-11 text-text-3">
          월 · 관측 시점 기준 · 막대는 측정소 평균
        </span>
      </div>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="달 고르기"
        aria-valuemin={0}
        aria-valuemax={months.length - 1}
        aria-valuenow={index}
        aria-valuetext={valueText}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
        }}
        className="flex h-11 cursor-pointer touch-none items-end rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1"
        style={{ gap: layout.gap }}
      >
        {means.map((v, i) => (
          <span
            key={months[i]}
            aria-hidden
            title={`${months[i]} · ${v == null ? "값 없음" : Math.round(v)}`}
            className={`min-w-0 flex-1 rounded-[1px] ${
              i === index ? "bg-data-navy" : v == null ? "bg-text-1/8" : "bg-text-1/22"
            }`}
            // 값 없는 달은 바닥에 얇은 줄만(2)
            style={{ height: v == null || max === 0 ? 2 : Math.max(3, (v / max) * BAR_MAX) }}
          />
        ))}
      </div>
      {/* 연 눈금: 그 해 첫 달 막대 자리 */}
      <div aria-hidden className="relative h-3.5">
        {yearStarts.map(({ i, year }) => (
          <span
            key={year}
            className="absolute text-caption-11 text-text-3"
            style={{ left: `${(i / months.length) * 100}%` }}
          >
            {year}
          </span>
        ))}
      </div>
    </section>
  );
}
