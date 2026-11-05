import type { EvidenceKind, EvidenceStatus, RunStatus } from "@/shared/api";
import type { StatusTone } from "@/shared/ui/badge";

// 근거 · 실행 상태를 화면 글자와 배지 색으로. 색은 v5 화면의 쓰임을 센 값(확보 32 · 미수집 11 …)을 따른다

/** 근거 종류(05 원문 탭의 묶음 이름과 같다) */
export const evidenceKindLabel: Record<EvidenceKind, string> = {
  statistics: "통계",
  documents: "기사 · 보도 · 민원",
  existing_responses: "기존 대응",
  denominators: "분모 · 맥락",
};

export const evidenceStatusBadge: Record<EvidenceStatus, { tone: StatusTone; label: string }> = {
  available: { tone: "green", label: "확보" },
  not_collected: { tone: "amber", label: "미수집" },
  not_published: { tone: "gray", label: "미공표" },
  review_pending: { tone: "blue", label: "검수 대기" },
  license_blocked: { tone: "red", label: "이용 제한" },
};

/** 05 패널의 실행 상태(Figma 는 영어 상태 이름을 배지에 그대로 쓴다) */
export const runStatusInfo: Record<RunStatus, { tone: StatusTone; legend: string }> = {
  ready: { tone: "green", legend: "필수 근거가 모두 있음" },
  partial: { tone: "amber", legend: "선택 근거만 빠짐 — 판단은 함" },
  blocked: { tone: "red", legend: "필수 근거가 없음 — 판단 안 함" },
  unsupported: { tone: "gray", legend: "카드 조건 밖 · 카드 없음" },
};

/** 비교 조건 4가지(FR-C4) */
export const comparabilityLabel = {
  same_indicator: "같은 지표",
  same_period_length: "같은 기간 길이",
  same_boundary: "같은 경계",
  same_method: "같은 산출 방식",
} as const;

/** 기간(끝 미포함)을 연도로: 2023-01-01 ~ 2026-01-01 → 2023–2025 */
export function yearSpan(start: string | null, end: string | null) {
  if (!start) return "";
  const from = start.slice(0, 4);
  if (!end) return from;
  // 끝은 미포함이라, 1월 1일로 끝나면 그 전 해까지
  const to = end.slice(5) === "01-01" ? String(Number(end.slice(0, 4)) - 1) : end.slice(0, 4);
  return from === to ? from : `${from}–${to}`;
}
