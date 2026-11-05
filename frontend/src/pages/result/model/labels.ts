import type {
  Argument,
  ClaimValue,
  EvidenceKind,
  EvidenceStatus,
  Provenance,
  RunStatus,
} from "@/shared/api";
import type { ProvKind, StatusTone } from "@/shared/ui/badge";

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

/** 논증 카드 ② 근거 칸의 짧은 종류 이름(Figma 칸 폭 64) */
export const evidenceKindShort: Record<EvidenceKind, string> = {
  statistics: "통계",
  documents: "기사·보도",
  existing_responses: "기존 대응",
  denominators: "분모·맥락",
};

/** 칸을 누가 채웠나 → 배지 종류. AI 문장화 · AI 판단은 둘 다 AI */
export const provKind: Record<Provenance, ProvKind> = {
  rule: "rule",
  card: "card",
  llm_phrasing: "ai",
  llm_judgment: "ai",
  human: "human",
};

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
  insufficient: { tone: "red", label: "판단 안 함" },
};

/** ① 판단 수준(Figma 「계산값」) */
export const claimLevelLabel: Record<Argument["claim"]["level"], string> = {
  observed_fact: "관측 사실",
  calculated: "계산값",
  associated: "연관",
  insufficient_evidence: "근거 부족",
};

/** ④ 근거 충실도 상 · 중 · 하. Figma 예는 상(초록)뿐 — 중 · 하는 상태 색 순서를 따른다 */
export const qualifierGrade: Record<
  Argument["qualifier"]["grade"],
  { label: string; className: string }
> = {
  high: { label: "상", className: "text-status-green" },
  medium: { label: "중", className: "text-status-amber" },
  low: { label: "하", className: "text-status-red" },
};

/** ⑤ 반박 상태. Figma: 검토 필요 amber · 근거 없음 gray. 근거 있음(판단을 약하게 함)은 red(디자이너 확인) */
export const rebuttalBadge: Record<
  Argument["rebuttals"][number]["status"],
  { tone: StatusTone; label: string }
> = {
  needs_review: { tone: "amber", label: "검토 필요" },
  not_found: { tone: "gray", label: "근거 없음" },
  supported: { tone: "red", label: "근거 있음" },
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
