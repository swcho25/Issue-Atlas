"use client";

import { type FormEvent, useState } from "react";

import { Icon } from "@/shared/ui/icon";

import type { Period } from "../model/period";
import type { IssueCard, Place } from "../model/schema";

// 「문장으로 질문」 탭(Figma 03 「질문 만들기 · 문장으로」): 문장 입력 → 이렇게 이해했어요(칩) → 다른 이슈일 수도 있어요.
// 칩은 눌러서 바꾸고(목록), × 로 비운다. 해석은 model/interpret 의 규칙

type Option = { value: string; label: string };

/**
 * 해석한 한 칸(v5/AI chip: 높이 28 · 모서리 6 · 왼 10 오 6 · 사이 6, Label 13).
 * 칩 전체가 목록(select)이라 눌러 바꾼다. 비었으면 「골라 주세요」
 */
function ReadingChip({
  label,
  value,
  options,
  onChange,
  onClear,
  tone = "read",
}: {
  label: string;
  value?: string;
  options: Option[];
  onChange: (value: string) => void;
  onClear?: () => void;
  /** read = 문장에서 읽음(앰버 옅게), filled = 기본값으로 채움, empty = 못 읽음 */
  tone?: "read" | "filled" | "empty";
}) {
  const shown = options.find((o) => o.value === value)?.label;
  const bg = { read: "bg-primary-soft", filled: "bg-status-amber-soft", empty: "bg-surface-2" }[
    tone
  ];
  return (
    <span className={`relative flex h-7 items-center gap-1.5 rounded-md pr-1.5 pl-2.5 ${bg}`}>
      <span className="text-label-13 text-text-2 opacity-80">{label}</span>
      <span className={`text-label-13 ${shown ? "text-text-1" : "text-text-3"}`}>
        {shown ?? "골라 주세요"}
      </span>
      <Icon name="chevronDown" className="size-3 text-text-3" />
      {/* 칩 위에 보이지 않는 목록을 깔아 눌러서 바꾼다 */}
      <select
        aria-label={`${label} 바꾸기`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {!value && <option value="">골라 주세요</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {onClear && shown && (
        <button
          type="button"
          aria-label={`${label} 지우기`}
          onClick={onClear}
          className="relative flex size-4 items-center justify-center rounded-sm text-text-3 hover:text-text-1"
        >
          <Icon name="close" className="size-3" />
        </button>
      )}
    </span>
  );
}

/** 다른 이슈 · 새 이슈 후보 한 줄(테두리 1 · 모서리 8 · 위아래 8 · 좌우 12 · 사이 10) */
function AltRow({
  name,
  desc,
  action,
  onAction,
}: {
  name: string;
  desc: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg px-3 py-2 inset-ring inset-ring-border-1">
      <span className="text-title-14 whitespace-nowrap text-text-1">{name}</span>
      <span className="min-w-0 flex-1 truncate text-body-13 text-text-3">{desc}</span>
      <button
        type="button"
        onClick={onAction}
        className="text-label-13 whitespace-nowrap text-primary-text hover:underline"
      >
        {action}
      </button>
    </li>
  );
}

export type SentenceState = {
  /** 보낸 문장(아직 없으면 undefined) */
  text?: string;
  /** 고른 지역 후보(「광주」 처럼 여러 곳이면 그 목록, 아니면 전체) */
  placeOptions: Place[];
  placeId?: string;
  /** 해석 안내 한두 문장 */
  notes: string[];
  period: Period;
  periodOptions: Period[];
  periodTone: "read" | "filled";
  card?: IssueCard;
  cards: IssueCard[];
  others: IssueCard[];
  /** 새 이슈 후보 이름(문장에서 지역 · 기간 · 물음 꼬리를 뺀 나머지). 맞는 이슈가 있으면 undefined */
  candidate?: string;
};

export function SentenceBuilder({
  state,
  onSubmit,
  onPlace,
  onCard,
  onPeriod,
  onCandidate,
}: {
  state: SentenceState;
  onSubmit: (text: string) => void;
  onPlace: (id: string | null) => void;
  onCard: (id: string | null) => void;
  onPeriod: (period: Period) => void;
  onCandidate: (name: string) => void;
}) {
  const [draft, setDraft] = useState(state.text ?? "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) onSubmit(draft.trim());
  };
  const evidence = (c: IssueCard) =>
    `근거 ${c.available_kinds}/4종${c.available_kinds === 0 ? " · 근거를 아직 모으지 않았어요" : ""}`;

  return (
    <div className="flex flex-col gap-4.5">
      {/* v5/Search(문장): 높이 40 · 모서리 8 · 왼 14 오 8 · 사이 10, 고른 상태는 앰버 1.5 테두리 */}
      <form
        onSubmit={submit}
        className="flex h-10 items-center gap-2.5 rounded-lg bg-surface-1 pr-2 pl-3.5 inset-ring inset-ring-border-2 focus-within:inset-ring-[1.5px] focus-within:inset-ring-primary"
      >
        <Icon name="sparkle" className="size-4 text-primary-text" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="문장으로 질문해 보세요 — 여수 청년은 어디로 떠나고 있나"
          aria-label="문장으로 질문"
          className="h-full min-w-0 flex-1 bg-transparent text-body-14 text-text-1 outline-none placeholder:text-text-3"
        />
        <kbd className="flex h-5.5 items-center rounded-sm px-1.5 font-sans text-label-13 text-text-3 inset-ring inset-ring-border-1">
          Enter
        </kbd>
      </form>

      {state.text && (
        <>
          <section aria-label="이렇게 이해했어요" className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <h2 className="text-title-14 text-text-1">이렇게 이해했어요</h2>
              <span className="text-body-13 text-text-3">
                문장에서 지역 · 이슈 · 기간을 찾았어요
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <ReadingChip
                label="지역"
                value={state.placeId}
                options={state.placeOptions.map((p) => ({ value: p.place_id, label: p.name }))}
                onChange={(id) => onPlace(id)}
                onClear={() => onPlace(null)}
                tone={state.placeId ? "read" : "empty"}
              />
              <ReadingChip
                label="이슈"
                value={state.card?.card_id}
                options={state.cards.map((c) => ({ value: c.card_id, label: c.name }))}
                onChange={(id) => onCard(id)}
                onClear={() => onCard(null)}
                tone={state.card ? "read" : "empty"}
              />
              <ReadingChip
                label="기간"
                value={state.period.id}
                options={state.periodOptions.map((p) => ({
                  value: p.id,
                  label:
                    state.periodTone === "filled" && p.id === state.period.id
                      ? `${p.short} · 기본값`
                      : p.short,
                }))}
                onChange={(id) => {
                  const p = state.periodOptions.find((o) => o.id === id);
                  if (p) onPeriod(p);
                }}
                tone={state.periodTone}
              />
            </div>
            {state.notes.length > 0 && (
              <p className="text-body-13 text-text-2">{state.notes.join(" ")}</p>
            )}
          </section>

          {(state.others.length > 0 || state.candidate !== undefined) && (
            <section aria-label="다른 이슈일 수도 있어요" className="flex flex-col gap-2">
              <h2 className="text-label-13 text-text-2">다른 이슈일 수도 있어요</h2>
              <ul className="flex flex-col gap-2">
                {state.others.map((c) => (
                  <AltRow
                    key={c.card_id}
                    name={c.name}
                    desc={evidence(c)}
                    action="바꾸기"
                    onAction={() => onCard(c.card_id)}
                  />
                ))}
                {state.candidate !== undefined && (
                  <AltRow
                    name={state.candidate}
                    desc="이슈 카드가 아직 없어요"
                    action="새 이슈 후보 만들기"
                    onAction={() => onCandidate(state.candidate ?? "")}
                  />
                )}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
