"use client";

import { Icon } from "@/shared/ui/icon";

import {
  countText,
  insideLine,
  MOVEMENT_CAPTION,
  type movementBars,
  VISIBLE_BARS,
} from "../../model/movement";

// 이동형 그림 시트(Figma 「결과 · 이동형 · 청년 유출」 Sheet · 그림 460: 안쪽 20 · 24 · 칸 사이 10 · 모서리 18 · 테두리 text-1 6% · 그림자 0 6 20 10%).
// 제목(Bold 16) · 출처 줄(Caption 12) · 도착 시도별 가로 막대(이름 34 · Medium 12 / 막대 12 · 모서리 2 · data-navy, 가장 큰 값 170 / 값 Bold 12, 줄 사이 6)
// · 고정 문구(경고 12 앰버 + Caption 12 text-2) · 같은 도 안 이동(막대 밖 한 줄, text-1 70%).
// 지도에는 선 · 화살표를 그리지 않는다(11/01 대표 결정 — 이동 경로로 읽힌다). 도착지는 대표점 원(MovementDots)

/** 가장 큰 막대 폭(Figma 경기 1,602 = 170) */
const MAX_BAR = 170;

export function MovementSheet({
  data,
  place,
}: {
  data: NonNullable<ReturnType<typeof movementBars>>;
  /** 출발 지역 이름(「여수시에서 나간 곳」) */
  place: string | null;
}) {
  const max = Math.max(0, ...data.bars.map((b) => b.value));
  const scroll = data.bars.length > VISIBLE_BARS;

  return (
    <section
      aria-label="이동형 그림"
      className="pointer-events-auto flex w-[460px] flex-col gap-2.5 rounded-[18px] border border-text-1/6 bg-surface-1 px-6 py-5 shadow-legend"
    >
      <header className="grid gap-0.5">
        <h2 className="text-heading-16 leading-4.5 text-text-1">전출지별 이동 · {data.month}</h2>
        {/* Figma 「KOSIS 전출지→전입지 (SP02) · …」 — 응답에 이 줄의 출처 칸이 없어 지표 이름으로 */}
        <p className="text-caption-12 leading-3.5 text-text-3">
          {[
            "전출지→전입지 이동자 수",
            place && `${place}에서 나간 곳`,
            data.unit && `단위 ${data.unit}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {/* 7줄(Figma 148 = 16 × 7 + 사이 6 × 6)씩 보이고, 더 있으면 위아래로 스크롤(사용자 결정 11/09) */}
      <ol
        tabIndex={scroll ? 0 : undefined}
        aria-label={scroll ? `도착지 ${data.bars.length}곳 막대, 위아래로 스크롤` : undefined}
        className={`flex flex-col gap-1.5 ${scroll ? "max-h-[148px] [scrollbar-width:thin] overflow-y-auto rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-text-1" : ""}`}
      >
        {data.bars.map((b) => (
          <li key={b.to} title={b.fullName} className="flex h-4 shrink-0 items-center gap-2">
            <span className="w-[34px] shrink-0 text-label-12 text-text-1">{b.name}</span>
            <span
              aria-hidden
              className="h-3 shrink-0 rounded-[2px] bg-data-navy"
              style={{ width: max > 0 ? Math.max(2, (b.value / max) * MAX_BAR) : 2 }}
            />
            <span className="text-label-12 font-bold text-text-1">
              {countText(b.value)}
              <span className="sr-only">{data.unit}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="flex items-center gap-1.5 text-caption-12 text-text-2">
        <Icon name="alert" className="size-3 shrink-0 text-status-amber" />
        {MOVEMENT_CAPTION}
      </p>
      {data.inside && (
        <p className="text-caption-12 text-text-1/70">{insideLine(data.inside, data.unit)}</p>
      )}
    </section>
  );
}
