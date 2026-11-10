"use client";

import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

import type { ViewType } from "../model/views";

// 04 에서 지금 고른 것: 시공간 유형(유형 전환)과 달(공통 시간 슬라이더).
// 지도 위 부품(MapOverlays)이 바꾸고, 결과 카드도 읽는다 — Figma 의 카드는 고른 유형을 따라 달라진다
// (이동형 카드의 「전 연령 · 집계 이동량, 이동 경로 아님 · 2025」 줄). 카드는 서버 컴포넌트라 읽는 쪽만 작은 클라이언트 부품으로 둔다

type ViewState = {
  view: ViewType | null;
  setView: (view: ViewType) => void;
  /** 고른 달 「YYYY-MM」. 달이 없는 결과(그림 줄 없음)는 null */
  month: string | null;
  setMonth: (month: string) => void;
};

const ViewStateContext = createContext<ViewState | null>(null);

/** 처음 유형 · 달은 서버에서 정해 넘긴다(openViews · defaultMonth) */
export function ViewStateProvider({
  initialView,
  initialMonth,
  children,
}: {
  initialView: ViewType | null;
  initialMonth: string | null;
  children: ReactNode;
}) {
  const [view, setView] = useState(initialView);
  const [month, setMonth] = useState(initialMonth);
  const value = useMemo(() => ({ view, setView, month, setMonth }), [view, month]);
  return <ViewStateContext value={value}>{children}</ViewStateContext>;
}

/** 지도 위 부품용: 반드시 ViewStateProvider 안에서 쓴다 */
export function useViewState() {
  const state = useContext(ViewStateContext);
  if (!state) throw new Error("useViewState 는 ViewStateProvider 안에서만 쓴다");
  return state;
}

/** 카드 부품용: 지도 없이 카드만 그리는 곳(테스트 등)에서는 null */
export const useViewStateOptional = () => useContext(ViewStateContext);
