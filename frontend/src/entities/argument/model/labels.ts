import type { Argument, ClaimValue } from "@/shared/api";
import type { StatusTone } from "@/shared/ui/badge";

// 논증 결과를 화면 글자 · 배지 색으로(결과 화면 · 내 질문이 함께 쓴다)

/**
 * ① 판단 배지. Figma 예는 카드 문구(「청년 순유출 확대」 amber) 하나뿐이라, 카드와 상관없는 말로 두고
 * 증가 · 감소는 그 예의 amber 를 따른다(디자이너 확인)
 */
export const claimBadge: Record<ClaimValue, { tone: StatusTone; label: string }> = {
  observed: { tone: "blue", label: "관측" },
  increasing: { tone: "amber", label: "증가" },
  decreasing: { tone: "amber", label: "감소" },
  unclear: { tone: "gray", label: "뚜렷하지 않음" },
  not_comparable: { tone: "gray", label: "비교 불가" },
  insufficient: { tone: "red", label: "분석 안 함" },
};

/** ④ 근거 수준 높음 · 보통 · 낮음(계약 high · medium · low). Figma 예는 상(초록)뿐 — 중 · 하는 상태 색 순서를 따른다 */
export const qualifierGrade: Record<
  Argument["qualifier"]["grade"],
  { label: string; className: string }
> = {
  high: { label: "높음", className: "text-status-green" },
  medium: { label: "보통", className: "text-status-amber" },
  low: { label: "낮음", className: "text-status-red" },
};

/** 기간(끝 미포함)을 연도로: 2023-01-01 ~ 2026-01-01 → 2023–2025 */
export function yearSpan(start: string | null, end: string | null) {
  if (!start) return "";
  const from = start.slice(0, 4);
  if (!end) return from;
  // 끝은 미포함이라, 1월 1일로 끝나면 그 전 해까지
  const to = end.slice(5) === "01-01" ? String(Number(end.slice(0, 4)) - 1) : end.slice(0, 4);
  return from === to ? from : `${from}–${to}`;
}
