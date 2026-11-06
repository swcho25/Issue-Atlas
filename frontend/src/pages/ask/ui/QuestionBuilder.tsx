"use client";

import { useState } from "react";

import { Icon } from "@/shared/ui/icon";

import { PERIODS, type Period } from "../model/period";
import type { IssueCard, Place } from "../model/schema";
import { IssueList } from "./IssueList";

const chevron = (
  <Icon
    name="chevronDown"
    className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-3"
  />
);

const selectClass =
  "h-10 w-full appearance-none rounded-lg bg-surface-1 pr-9 pl-3 text-body-14 text-text-1 inset-ring inset-ring-border-2 focus-visible:outline-2 focus-visible:outline-text-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-label-13 text-text-2">{label}</span>
      <span className="relative">
        {children}
        {chevron}
      </span>
    </label>
  );
}

export type AskMode = "pick" | "sentence";

const MODES: { id: AskMode; label: string }[] = [
  { id: "pick", label: "이슈 골라서" },
  { id: "sentence", label: "✦ 문장으로 질문" },
];

/**
 * 새 질문 왼쪽 카드(Figma 03): 「이슈 골라서」 ① 어디 · 언제 → ② 무엇을 → ③ 답할 수 있는 이슈,
 * 「문장으로 질문」 은 sentence(문장 입력 · 해석 칩)를 그대로 보여 준다
 */
export function QuestionBuilder({
  mode,
  onMode,
  sentence,
  places,
  placeId,
  onPlace,
  period,
  onPeriod,
  cards,
  cardsState,
  selectedId,
  onSelect,
}: {
  mode: AskMode;
  onMode: (mode: AskMode) => void;
  sentence: React.ReactNode;
  places: Place[];
  placeId?: string;
  onPlace: (id: string) => void;
  period: Period;
  onPeriod: (period: Period) => void;
  cards: IssueCard[];
  cardsState: "loading" | "error" | "ready";
  selectedId?: string;
  onSelect: (cardId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const shown = q ? cards.filter((c) => c.name.includes(q) || c.domain.includes(q)) : cards;
  const placeName = places.find((p) => p.place_id === placeId)?.name ?? "";
  // 문장에서 읽은 기간(예: 2024)은 기본 목록에 없으니 함께 보여 준다
  const periods = PERIODS.some((p) => p.id === period.id) ? PERIODS : [...PERIODS, period];

  return (
    <section
      aria-label="새 질문"
      className="absolute top-5 bottom-5 left-6 flex w-140 flex-col gap-4 overflow-y-auto rounded-2xl bg-bg-app px-7 py-5 shadow-card"
    >
      <h1 className="text-heading-24 text-text-1">새 질문</h1>

      <div
        className="inline-flex w-fit gap-0.5 rounded-full bg-surface-2 p-0.75"
        role="tablist"
        aria-label="질문 방법"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => onMode(m.id)}
            className={`flex h-7 items-center rounded-full px-2.5 text-label-13 ${
              mode === m.id ? "bg-surface-1 text-text-1 shadow-xs" : "text-text-3 hover:text-text-2"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "sentence" ? (
        sentence
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h2 className="text-heading-16 text-text-1">① 어디 · 언제</h2>
            <div className="flex gap-3">
              <Field label="지역">
                <select
                  className={selectClass}
                  value={placeId ?? ""}
                  onChange={(e) => onPlace(e.target.value)}
                >
                  {places.map((p) => (
                    <option key={p.place_id} value={p.place_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="기간">
                <select
                  className={selectClass}
                  value={period.id}
                  onChange={(e) => {
                    const p = periods.find((o) => o.id === e.target.value);
                    if (p) onPeriod(p);
                  }}
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-heading-16 text-text-1">② 무엇을</h2>
            <label className="relative flex h-9.5 items-center rounded-lg bg-surface-1 inset-ring inset-ring-border-2 focus-within:outline-2 focus-within:outline-text-1">
              <Icon name="search" className="absolute left-3 size-3.5 text-text-3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="주제 검색 — 청년, 미세먼지, 고령"
                aria-label="주제 검색"
                className="h-full w-full bg-transparent pr-3 pl-8.5 text-body-14 text-text-1 outline-none placeholder:text-text-3"
              />
            </label>
          </div>

          <div className="flex flex-col gap-4.5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-heading-16 text-text-1">③ 답할 수 있는 이슈</h2>
              <span className="text-body-13 text-text-3">
                {placeName} · {period.short} · 미리 계산
              </span>
            </div>
            {cardsState === "loading" && (
              <p className="text-body-13 text-text-3">이슈를 불러오는 중이에요</p>
            )}
            {cardsState === "error" && (
              <p className="text-body-13 text-status-red">이슈 목록을 불러오지 못했어요</p>
            )}
            {cardsState === "ready" &&
              (shown.length ? (
                <IssueList cards={shown} selectedId={selectedId} onSelect={onSelect} />
              ) : (
                <p className="text-body-13 text-text-3">「{q}」 에 맞는 이슈가 없어요</p>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
