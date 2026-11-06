import type {
  Argument,
  EvidenceKind,
  EvidenceStatus,
  Provenance,
  RunStatus,
  StorageScope,
} from "@/shared/api";
import type { ProvKind, StatusTone } from "@/shared/ui/badge";

// 판단 배지 · 근거 충실도 · 기간 연도는 내 질문과 함께 쓴다(entities/argument)
import { claimBadge, qualifierGrade, yearSpan } from "@/entities/argument";

export { claimBadge, qualifierGrade, yearSpan };

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

/** ① 판단 수준(Figma 「계산값」) */
export const claimLevelLabel: Record<Argument["claim"]["level"], string> = {
  observed_fact: "관측 사실",
  calculated: "계산값",
  associated: "연관",
  insufficient_evidence: "근거 부족",
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

/** 출처 등급(원문 탭 읽기 배지). Figma 예는 A(초록)뿐 — B · C 는 디자이너 확인 */
export const sourceGradeTone: Record<"A" | "B" | "C", StatusTone> = {
  A: "green",
  B: "blue",
  C: "gray",
};

/** 저장 범위(원문 탭). 「링크만」은 이용 조건상 원문을 저장하지 않아 미리보기가 없다 */
export const storageScopeBadge: Record<StorageScope, { tone: StatusTone; label: string }> = {
  full: { tone: "blue", label: "전문 저장" },
  metadata: { tone: "gray", label: "요약 · 메타만" },
  link_only: { tone: "gray", label: "링크만" },
};

/** 시각을 한국 날짜(YYYY-MM-DD), withTime 이면 「YYYY-MM-DD HH:mm」 */
export function kstDate(iso: string, withTime = false) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  return withTime ? `${day} ${get("hour")}:${get("minute")}` : day;
}

/** 원문 위치(locator)를 한 줄로: 「tbl_id DT_1B26001 · C1 46130 · prd_de 2023 · 2024 · 2025」 */
export function locatorLine(locator: Record<string, unknown>) {
  return Object.entries(locator)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      const text = Array.isArray(value)
        ? value.map(String).join(" · ")
        : typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value);
      return `${key} ${text}`;
    })
    .join(" · ");
}

/**
 * 기간(끝 미포함)을 날짜로: 2023-01-01 ~ 2026-01-01 → 「2023-01-01 – 2025-12-31」.
 * 끝을 하루 당겨 각주(2023–2025)와 같은 기간으로 읽히게 한다. 시작이 없으면 「~ 끝」
 */
export function periodRange(start: string | null, end: string | null) {
  const last =
    end && new Date(Date.parse(`${end}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (start && last) return `${start} – ${last}`;
  if (start) return `${start} –`;
  return last ? `~ ${last}` : "";
}
