"use client";

import { MOVEMENT_CAPTION } from "../../model/movement";
import { useViewStateOptional } from "../viewState";

/**
 * 이동형을 골랐을 때 카드의 기간 줄 아래 한 줄(Figma 「결과 · 이동형 · 청년 유출」 Panel > Meta > legend line:
 * 「전 연령 · 집계 이동량, 이동 경로 아님 · 2025」 Medium 14 · 줄 높이 18 · text-2).
 * 줄 끝은 공통 시간 슬라이더에서 고른 달(Figma 는 한 해 「2025」 — 이동 그림이 고른 달 값을 보이므로 그 달).
 * 다른 유형에서는 보이지 않는다(Figma 변화형 카드에 없음)
 */
export function MovementNote() {
  const state = useViewStateOptional();
  if (state?.view !== "movement" || !state.month) return null;
  return (
    <p className="text-title-14 leading-4.5 text-text-2">
      {MOVEMENT_CAPTION} · {state.month}
    </p>
  );
}
