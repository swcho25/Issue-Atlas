import type { StatusTone } from "@/shared/ui/badge";

import type { ChangeAction, IssueType, Origin, ReviewStatus, Scope, TargetType } from "./schema";

// 검수 화면 글자. 계약(contracts/reviews)의 영문 값을 사람이 읽는 말로

export const issueLabel: Record<IssueType, string> = {
  location: "지역",
  classification: "분류",
  duplicate: "중복",
  value: "값",
  wording: "문장 표현",
  metadata: "자료 정보",
  other: "기타",
};

export const originLabel: Record<Origin, string> = {
  user: "조회자 신고",
  admin: "관리자 등록",
  local_import: "일괄 적재",
  model: "자동",
};

export const targetLabel: Record<TargetType, string> = {
  news_event: "기사",
  normalized_record: "자료",
  source: "출처",
  card: "카드",
};

export const statusBadge: Record<ReviewStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: "amber", label: "대기" },
  on_hold: { tone: "gray", label: "보류" },
  approval_pending: { tone: "blue", label: "승인 대기" },
  resolved: { tone: "green", label: "확정" },
  rejected: { tone: "red", label: "반려" },
};

export const actionLabel: Record<ChangeAction, string> = {
  confirm: "확정",
  correct: "수정",
  hold: "보류",
  reject: "반려",
  approve: "최종 승인",
};

export const scopeLabel: Record<Scope, string> = {
  record: "이 기록만",
  source: "이 출처 정보",
  card: "이 카드",
};

const FIELD: Record<string, string> = {
  summary: "요약",
  place_name: "지역",
  place_id: "지역 코드",
  address: "주소",
  regions: "언급 지역",
  sido: "시도",
  sigun: "시군",
  gu: "구",
  event_start: "사건 시작",
  event_end: "사건 끝",
  latitude: "위도",
  longitude: "경도",
  time_precision: "시간 정밀도",
  location_precision: "위치 정밀도",
  news_id: "기사 ID",
  title: "제목",
  category: "분류",
  categories: "분류",
  department: "담당 부서",
  org: "기관",
  publisher: "발행 기관",
  name: "이름",
  link: "링크",
  url: "링크",
  site: "게시판",
  kind: "문서 종류",
  press_id: "보도자료 ID",
  license_type: "이용 조건",
  storage_scope: "저장 범위",
  reliability_grade: "출처 등급",
  robots_status: "robots",
  published_on: "공표일",
  published_at: "공표",
  collected_at: "수집",
  refined_at: "정제",
  value: "값",
  unit: "단위",
  indicator_id: "지표",
  spec_id: "명세",
  source_id: "출처 ID",
  place_code_raw: "지역 코드(원본)",
  place_code_system: "지역 코드 체계",
  validation_status: "정제 상태",
  draft_revision: "초안 수정 번호",
  current_version: "공개 버전",
  domain: "영역",
  parent_question: "상위 질문",
};

/** 칸 이름(`document.title` 처럼 펼친 이름은 마지막 칸으로 읽는다) */
export const fieldLabel = (key: string) => FIELD[key.split(".").at(-1) ?? key] ?? key;

const text = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) {
    return v.every((x) => typeof x !== "object" || x === null)
      ? v.map(text).join(" · ") || "—"
      : JSON.stringify(v);
  }
  if (typeof v === "object") return JSON.stringify(v);
  // 시각은 표기(+00:00 · Z · +09:00)가 달라도 같은 순간이면 같게 보이도록 한국 시간으로
  if (typeof v === "string" && ISO_TIME.test(v)) return dateTime(v);
  return String(v);
};

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** 카드 값은 초안 전체(수백 줄)라 비교에는 요점만 */
const CARD_KEYS = [
  "draft_revision",
  "current_version",
  "draft_spec.name",
  "draft_spec.domain",
  "draft_spec.parent_question",
];

/** 비교 · 이력 표용: 한 단계 아래 객체까지 `부모.칸` 으로 펼친 글자 값 */
export function flatValues(v: Record<string, unknown>, target?: TargetType): [string, string][] {
  const rows: [string, string][] = [];
  for (const [k, x] of Object.entries(v)) {
    if (x && typeof x === "object" && !Array.isArray(x)) {
      for (const [k2, y] of Object.entries(x)) rows.push([`${k}.${k2}`, text(y)]);
    } else rows.push([k, text(x)]);
  }
  if (target !== "card") return rows;
  return CARD_KEYS.map((k) => [k, rows.find(([key]) => key === k)?.[1] ?? "—"]);
}

const pick = (v: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const [a, b] = k.split(".");
    const x = b ? (v[a] as Record<string, unknown> | undefined)?.[b] : v[a];
    if (typeof x === "string" && x) return x;
  }
  return null;
};

/** 목록 · 상세 제목: 요청 당시 값에서 사람이 알아볼 이름을 고른다(없으면 대상 ID) */
export function targetTitle(type: TargetType, id: string, v: Record<string, unknown>) {
  const title =
    type === "news_event"
      ? pick(v, "summary")
      : type === "normalized_record"
        ? pick(v, "title", "document.title", "indicator_id", "spec_id")
        : type === "source"
          ? pick(v, "name")
          : pick(v, "draft_spec.name", "name");
  return title ?? id;
}

/** 제목 아래 한 줄: 대상 종류 · 지역이나 기관 · 날짜 */
export function targetMeta(type: TargetType, id: string, v: Record<string, unknown>) {
  const place = pick(v, "place_name", "org", "document.publisher", "publisher");
  const date = pick(v, "event_start", "published_on", "published_at");
  return [targetLabel[type], type === "card" || type === "source" ? id : place, date && day(date)]
    .filter(Boolean)
    .join(" · ");
}

const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString();
/** 2026-11-03 (한국 시간) */
export const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : kst(iso).slice(0, 10));
/** 2026-11-03 16:02 (한국 시간) */
export const dateTime = (iso: string) => kst(iso).slice(0, 16).replace("T", " ");
