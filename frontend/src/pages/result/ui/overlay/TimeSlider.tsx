"use client";

import { type KeyboardEvent, type PointerEvent, useRef } from "react";

import { monthAt, monthPosition, yearMarks } from "../../model/timeline";

// 공통 시간 슬라이더(시공간 표시 개발 명세 7절 「월 슬라이더 하나를 공유한다」) — 모든 유형이 이 하나를 함께 쓴다.
// 줄 하나 위의 점 하나(사용자 결정 11/10: 「윈디 어플처럼 슬라이더 한 점으로」, 막대 그림 · 시작–끝 범위는 두지 않는다).
// 줄의 왼쪽 끝이 질문 기간의 첫 달, 오른쪽 끝이 마지막 달. 지나온 쪽은 남색으로 채운다.
// 틀은 Figma 「결과 · 변화형 · 대기질」 Time(520 · 유리 · 모서리 12 · 안쪽 12 · 14) — Figma 의 달마다 막대 대신 줄 + 점.
// 줄을 누르거나 끌면 그 달, 키보드 ← → 한 달 · PageUp PageDown 열두 달 · Home End 처음 끝.
// 보이는 것만 바꾼다(판단 · 근거는 질문 기간 그대로). 재생 버튼은 「재생은 P1」 이라 두지 않는다

/** 줄 폭(520 - 안쪽 14 × 2 - 유리 테두리 - 고른 달 글자 칸 64 - 사이 12) */
export const TRACK_WIDTH = 414;

export function TimeSlider({
  months,
  value,
  onChange,
}: {
  /** 질문 기간의 달(「YYYY-MM」), 둘 이상 */
  months: string[];
  value: string;
  onChange: (month: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const index = Math.max(0, months.indexOf(value));
  const last = months.length - 1;
  const pick = (i: number) => {
    const next = months[Math.min(last, Math.max(0, i))];
    if (next !== value) onChange(next);
  };

  // 누른 자리(가로)에서 가장 가까운 달
  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = track.current?.getBoundingClientRect();
    if (box && box.width > 0) pick(monthAt(months, (e.clientX - box.left) / box.width));
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
    else if (e.key === "End") pick(last);
    else return;
    e.preventDefault();
  };

  const at = `${monthPosition(months, index) * 100}%`;

  return (
    <section
      aria-label="시간 슬라이더"
      // select-none: 끌 때 브라우저가 눈금 글자를 선택하기 시작하면, 다음 끌기를 「선택한 것 끌어다 놓기」 로 처리해
      // 포인터 입력을 취소한다(selectstart → 다음 번 dragstart → pointercancel) — 점이 누른 자리로만 가고 따라오지 않았다
      className="pointer-events-auto flex w-[520px] items-start gap-3 rounded-xl glass px-3.5 py-3 select-none [--glass-fill:0.55]"
    >
      {/* 고른 달: 점을 옮겨도 줄이 흔들리지 않게 칸 폭을 고정 */}
      <p className="w-16 shrink-0 text-label-13 leading-5 text-text-1 tabular-nums">{value}</p>
      <div className="min-w-0 flex-1">
        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label="달 고르기"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={index}
          aria-valuetext={value}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
          }}
          // 브라우저의 끌어다 놓기가 시작되면 포인터 입력이 취소된다 — 슬라이더에서는 막는다
          onDragStart={(e) => e.preventDefault()}
          // 누르기 쉽게 줄(4)보다 넓은 칸(20)
          className="group relative h-5 cursor-pointer touch-none rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1"
        >
          <span aria-hidden className="absolute inset-x-0 top-2 h-1 rounded-full bg-text-1/15" />
          {/* 지나온 쪽 */}
          <span
            aria-hidden
            className="absolute top-2 left-0 h-1 rounded-full bg-data-navy"
            style={{ width: at }}
          />
          {/* 점(16 · 남색 · 흰 테두리 2) */}
          <span
            aria-hidden
            className="absolute top-0.5 size-4 -translate-x-1/2 rounded-full bg-data-navy shadow-sm ring-2 ring-surface-1 group-hover:scale-110"
            style={{ left: at }}
          />
        </div>
        {/* 눈금: 왼쪽 끝 = 시작 달, 오른쪽 끝 = 끝 달, 사이에 해마다(그 해 1월 자리) */}
        <div aria-hidden className="relative mt-1 h-3.5 text-caption-11 text-text-3">
          <span className="absolute left-0">{months[0]}</span>
          {yearMarks(months, TRACK_WIDTH).map(({ year, position }) => (
            <span
              key={year}
              className="absolute -translate-x-1/2"
              style={{ left: `${position * 100}%` }}
            >
              {year}
            </span>
          ))}
          <span className="absolute right-0">{months[last]}</span>
        </div>
      </div>
    </section>
  );
}
