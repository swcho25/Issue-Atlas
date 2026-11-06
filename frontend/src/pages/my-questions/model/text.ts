import { yearSpan } from "@/entities/argument";
import type { MyQuestion } from "@/shared/api";

// 내 질문 한 줄의 글자(Figma 06 「내 질문」): 질문 문장 · 지역 · 이슈 · 기간 · 회차 · 날짜

/** 받침이 있으면 「은」, 없으면 「는」(한글이 아니면 「은」) */
function topic(word: string) {
  const last = word.trim().at(-1) ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}은`;
  return code % 28 === 0 ? `${word}는` : `${word}은`;
}

/** 새 이슈 후보의 이름: 원래 문장의 「이슈 이름: …」 줄, 없으면 첫 줄 */
export function candidateName(q: MyQuestion) {
  const lines = (q.raw_text ?? "").split("\n");
  const named = lines.find((l) => l.startsWith("이슈 이름:"));
  return (named ? named.slice("이슈 이름:".length) : lines[0]).trim() || "이름 없는 후보";
}

/** 줄 제목. 저장한 질문은 「여수시에서 2023–2025년 청년 유출·정착은 어떻게 달라졌나요?」 */
export function questionTitle(q: MyQuestion) {
  if (q.candidate || !q.card_name) return candidateName(q);
  return `${q.place_name}에서 ${yearSpan(q.period_start, q.period_end)}년 ${topic(q.card_name)} 어떻게 달라졌나요?`;
}

/** 한국 날짜의 월-일(10-28) */
export function monthDay(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}-${get("day")}`;
}

/** 줄 아래 글. 「여수시 · 청년 유출·정착 · 2023–2025 · 2회 · 10-28」, 후보는 「여수시 · 2024 · 10-27 접수」 */
export function questionMeta(q: MyQuestion) {
  const span = yearSpan(q.period_start, q.period_end);
  const last = q.runs[0]?.created_at ?? q.created_at;
  if (q.candidate) return [q.place_name, span, `${monthDay(q.created_at)} 접수`].join(" · ");
  return [q.place_name, q.card_name, span, `${q.runs.length}회`, monthDay(last)].join(" · ");
}
