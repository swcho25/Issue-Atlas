"use client";

import Link from "next/link";
import { useState } from "react";

import type { Argument } from "@/shared/api";

import { claimBadge } from "../../model/labels";
import { openViews, type ViewType, viewTypes } from "../../model/views";
import { summaryHref } from "../tabs";
import { ChangeSheet } from "./ChangeSheet";

// 04 지도 위 부품(Figma 04): 위 유형 전환 · 그림 시트 · 아래 유리 바.
// 셋 다 결과 카드(왼쪽 24 + 폭 400 + 사이 24 = 448) 오른쪽의 빈 지도 위에 둔다. 유형 전환은 그 왼쪽 끝,
// 시트 · 유리 바는 그 영역 가운데(Figma 520 ~ 1600 의 가운데 1060)
const FREE_LEFT = "left-[448px]";

export function MapOverlays({ argument }: { argument: Argument }) {
  const { enabled, initial } = openViews(argument);
  const [view, setView] = useState<ViewType | null>(initial);

  return (
    <>
      <TypeSwitch enabled={enabled} current={view} onChange={setView} />
      {view === "change" && (
        <div
          className={`pointer-events-none absolute right-0 bottom-24 ${FREE_LEFT} z-control flex justify-center`}
        >
          <ChangeSheet argument={argument} />
        </div>
      )}
      <div
        className={`pointer-events-none absolute right-0 bottom-6 ${FREE_LEFT} z-control flex justify-center`}
      >
        <ResultBar argument={argument} />
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
            className={`h-7 w-[77px] rounded-full text-label-12 font-bold text-text-1 disabled:opacity-32 ${selected ? "lens-amber" : on ? "hover:bg-white/30" : ""}`}
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
function ResultBar({ argument }: { argument: Argument }) {
  const { question, claim } = argument;
  const base = summaryHref(argument.run_id);
  return (
    <nav
      aria-label="결과 바로 가기"
      className="pointer-events-auto flex h-14 w-[556px] items-center gap-3 rounded-full glass py-2.5 pr-2.5 pl-5.5"
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-primary/80" />
      <p className="min-w-0 flex-1 truncate text-title-14 text-text-1">
        {[question.place_name, question.card_name, claimBadge[claim.value].label]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <Link
        href={`${base}/evidence`}
        className="shrink-0 rounded-full px-3 py-2 text-body-14 text-text-2 hover:bg-white/30"
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
