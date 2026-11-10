import { z } from "zod";

// 수정 제안(POST /v1/review-requests, contracts/reviews). 로그인 사용자의 신고 — 원본은 바뀌지 않고 관리자 검수 큐로 간다.
// 논증 칸에서 고를 수 있는 대상은 카드뿐이다(근거 ID 는 정제 자료 ID 와 다르다). 카드의 proposed_value 는 draft_spec 만 받아,
// 어느 칸 · 어느 실행 · 붙인 근거는 사유(reason) 글에 적는다(백엔드 변경 없이, 관리자는 검수 화면에서 글로 읽는다)

/** 무엇이 틀렸나요?(Figma 06 순서. 계약의 metadata 는 화면에 없다) */
export const issueTypes = [
  { value: "location", label: "지역 매핑" },
  { value: "classification", label: "이슈 분류" },
  { value: "duplicate", label: "중복" },
  { value: "value", label: "값" },
  { value: "wording", label: "문장 표현" },
  { value: "other", label: "기타" },
] as const;
export type IssueType = (typeof issueTypes)[number]["value"];

/** 201 응답(Receipt) */
export const reviewReceiptSchema = z.object({
  review_id: z.string().min(1),
  status: z.enum(["pending", "on_hold", "resolved", "rejected", "approval_pending"]),
});

/** 계약의 reason 최대 길이 */
export const REASON_MAX = 2000;
/** 인용은 길면 자른다(사유 글이 설명을 밀어내지 않게) */
const QUOTE_MAX = 300;

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/**
 * 사유 글: 첫 줄에 칸 · 카드 · 지역 · 실행, 다음 줄에 칸 내용 인용, 빈 줄 뒤 사용자 설명, 붙인 근거.
 * 「[③ 보증] 청년 유출·정착 · 여수시 · 실행 run_c1…」
 */
export function suggestionReason({
  cell,
  context,
  runId,
  quote,
  description,
  link,
}: {
  cell: string;
  context: string;
  runId: string;
  quote: string | null;
  description: string;
  link: string;
}) {
  const head = [
    `[${cell}] ${[context, `실행 ${runId}`].filter(Boolean).join(" · ")}`,
    quote && `칸 내용: 「${clip(quote, QUOTE_MAX)}」`,
  ]
    .filter(Boolean)
    .join("\n");
  const tail = link.trim() ? `\n\n근거: ${link.trim()}` : "";
  // 설명이 너무 길면 머리 · 근거를 지키고 설명을 자른다
  const room = REASON_MAX - head.length - tail.length - 2;
  return `${head}\n\n${clip(description.trim(), room)}${tail}`;
}

/** 붙인 근거 링크 검사: 비었거나 http(s) 주소 */
export const isLinkOk = (link: string) => {
  if (!link.trim()) return true;
  try {
    return ["http:", "https:"].includes(new URL(link.trim()).protocol);
  } catch {
    return false;
  }
};
