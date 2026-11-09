"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/shared/ui/icon";

// 분포형 시점(Figma glass · 시점 102 × 34: 유리 알약 · 안쪽 8 · 16 · Bold 14 「2024-03 ▾」). 유형 전환 오른쪽 8(448 + 392 + 8).
// 누르면 버튼 아래 달 목록 — Figma 에 달 목록 그림은 없어 같은 v5 의 Menu(2374:6063, 논증 탭 칸 메뉴와 같은 모양)로:
// 흰(surface-1) · 테두리 border-1 · 모서리 8 · 안쪽 6 · 줄 사이 2 · shadow-md, 줄 28(안쪽 6 · 10 · 모서리 6) · Label 12, 누름 · 초점 줄 primary-soft.
// 36개월이라 해마다 묶음 머리(Caption 11 text-3)를 두고 8줄쯤 보이게 스크롤, 고른 달은 primary-text + 체크.
// 키보드: 버튼 ↓ ↑ 로도 열기, 목록 ↑ ↓ · Home End 로 옮기고 Enter · Space 로 고르기, Esc 는 닫고 버튼으로 초점

const itemClass =
  "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-label-12 whitespace-nowrap outline-none hover:bg-primary-soft focus-visible:bg-primary-soft cursor-pointer";

/** 달을 해마다 묶는다: [["2023", ["2023-01", …]], …] */
export function monthsByYear(months: string[]) {
  const years = new Map<string, string[]>();
  for (const m of months) {
    const y = m.slice(0, 4);
    years.set(y, [...(years.get(y) ?? []), m]);
  }
  return [...years];
}

export function MonthMenu({
  months,
  value,
  onChange,
}: {
  months: string[];
  value: string;
  onChange: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  const options = () => [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };
  const choose = (month: string) => {
    onChange(month);
    close();
  };

  // 열면 고른 달로 초점 · 목록 가운데로 스크롤(쪽 전체가 움직이지 않게 목록만), 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const all = options();
    const current = all.find((o) => o.getAttribute("aria-selected") === "true") ?? all[0];
    if (current && list.current) {
      list.current.scrollTop =
        current.offsetTop - list.current.clientHeight / 2 + current.offsetHeight / 2;
      current.focus({ preventScroll: true });
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onListKey = (e: KeyboardEvent) => {
    const all = options();
    const i = all.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      all[Math.min(all.length - 1, Math.max(0, to))]?.focus();
    };
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(all.length - 1);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const month = all[i]?.dataset.month;
      if (month) choose(month);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") close(false);
  };

  return (
    // 열려 있는 동안은 카드 · 시트 위로(z-popover)
    <div className={`absolute top-[21px] left-[848px] ${open ? "z-popover" : "z-control"}`}>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`분포형 시점 ${value}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-[34px] items-center gap-1 rounded-full glass pr-3 pl-4 text-title-14 font-bold text-text-1 outline-none hover:bg-glass-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1"
      >
        {value}
        <Icon
          name="chevronDown"
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label="분포형 시점(달)"
          onKeyDown={onListKey}
          className="absolute top-full left-0 mt-1 flex max-h-[268px] w-max min-w-full [scrollbar-width:thin] flex-col gap-0.5 overflow-y-auto rounded-lg border border-border-1 bg-surface-1 p-1.5 shadow-md"
        >
          {monthsByYear(months).map(([year, inYear]) => (
            <div key={year} role="group" aria-label={`${year}년`} className="flex flex-col gap-0.5">
              <span aria-hidden className="px-2.5 pt-1 text-caption-11 text-text-3">
                {year}
              </span>
              {inYear.map((m) => {
                const selected = m === value;
                return (
                  <div
                    key={m}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    data-month={m}
                    onClick={() => choose(m)}
                    className={`${itemClass} ${selected ? "font-bold text-primary-text" : "text-text-1"}`}
                  >
                    {m}
                    {selected && <Icon name="check" className="size-3.5" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
