import type { EvidenceKind } from "@/shared/api";
import type { StatusTone } from "@/shared/ui/badge";

import type { ApprovalStatus, CardDraft, Decision } from "./schema";
import type { SpecState } from "./spec";

export const approvalBadge: Record<ApprovalStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: "amber", label: "대기" },
  on_hold: { tone: "gray", label: "보류" },
  approved: { tone: "green", label: "승인" },
  rejected: { tone: "red", label: "반려" },
};

export const cardBadge: Record<CardDraft["status"], { tone: StatusTone; label: string }> = {
  card: { tone: "green", label: "공개" },
  legacy: { tone: "gray", label: "기존" },
  candidate: { tone: "blue", label: "후보" },
  on_hold: { tone: "gray", label: "보류" },
};

export const decisionLabel: Record<Decision, string> = {
  approve: "승인",
  hold: "보류",
  reject: "반려",
};

export const kindLabel: Record<EvidenceKind, string> = {
  statistics: "통계",
  documents: "기사 · 보도",
  existing_responses: "기존 대응",
  denominators: "분모 · 맥락",
};

export const specStateBadge: Record<SpecState, { tone: StatusTone; label: string }> = {
  available: { tone: "green", label: "확보" },
  not_collected: { tone: "amber", label: "미수집" },
  no_source: { tone: "gray", label: "소스 없음" },
  unknown: { tone: "gray", label: "등록 안 됨" },
};
