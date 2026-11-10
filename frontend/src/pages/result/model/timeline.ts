import type { Argument } from "@/shared/api";

// 04 공통 시간 슬라이더(시공간 표시 개발 명세 7절 「월 슬라이더 하나를 공유한다」).
// 응답의 그림 줄(series)은 종류와 상관없이 같은 칸(periods · values · statuses)을 가지므로,
// 모든 유형이 고른 달 하나를 함께 쓴다. 보이는 것만 바꾼다 — 판단 문장 · 근거 4종은 질문 기간 그대로

/** 그림 줄들이 함께 쓰는 달 목록(「YYYY-MM」, 질문 기간). 줄이 없으면 빈 배열(슬라이더를 두지 않는다) */
export const periodMonths = (a: Argument): string[] =>
  a.series.reduce<string[]>(
    (longest, s) => (s.periods.length > longest.length ? s.periods : longest),
    [],
  );

/** 처음 고를 달: 값이 하나라도 있는 마지막 달(없으면 기간의 마지막 달, 달이 없으면 null) */
export function defaultMonth(a: Argument, months = periodMonths(a)): string | null {
  for (let i = months.length - 1; i >= 0; i--) {
    const month = months[i];
    if (a.series.some((s) => s.values[s.periods.indexOf(month)] != null)) return month;
  }
  return months.at(-1) ?? null;
}

/** 날짜(「YYYY-MM-DD」)의 달. 날짜를 모르면 null */
export const monthOf = (date: string | null | undefined) => (date ? date.slice(0, 7) : null);

/** 달의 자리(0 … 1): 줄의 왼쪽 끝이 기간의 첫 달, 오른쪽 끝이 마지막 달 */
export const monthPosition = (months: string[], index: number) =>
  months.length > 1 ? index / (months.length - 1) : 0;

/** 줄 위 자리(0 … 1)에서 가장 가까운 달의 번호 */
export const monthAt = (months: string[], position: number) =>
  Math.min(months.length - 1, Math.max(0, Math.round(position * (months.length - 1))));

/** 연 눈금 글자(「2025」 11 ≈ 27) · 끝 글자(「2025-12」 ≈ 44)가 서로 붙지 않게 둘 간격 */
const YEAR_GAP = 36;
const END_LABEL = 48;

/**
 * 연 눈금: 그 해 1월 자리. 줄 양 끝에는 시작 · 끝 달 글자가 있으므로 그 글자와 겹치는 해는 빼고,
 * 기간이 길면(10 · 20년) 눈금끼리 YEAR_GAP 이상 떨어지게 건너뛴다
 */
export function yearMarks(months: string[], width: number) {
  const per = months.length > 1 ? width / (months.length - 1) : width;
  const step = Math.max(1, Math.ceil(YEAR_GAP / (per * 12)));
  return months
    .flatMap((m, i) => (m.endsWith("-01") ? [{ i, year: m.slice(0, 4) }] : []))
    .filter(({ i }) => i * per >= END_LABEL && (months.length - 1 - i) * per >= END_LABEL)
    .filter((_, k) => k % step === 0)
    .map(({ i, year }) => ({ year, position: monthPosition(months, i) }));
}
