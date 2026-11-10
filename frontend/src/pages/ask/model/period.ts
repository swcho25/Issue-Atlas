export type Period = {
  id: string;
  /** 시작일(포함) · 끝(미포함 날짜로 보낸다) */
  start: string;
  end: string;
  label: string;
  short: string;
};

/** 자료가 있는 해: 2023.01 – 2025.12 월별 */
export const DATA_YEARS = { from: 2023, to: 2025 } as const;

/** 연도 범위로 기간을 만든다(끝 해의 12월까지) */
export function yearsPeriod(from: number, to: number): Period {
  const isDefault = from === DATA_YEARS.from && to === DATA_YEARS.to;
  return {
    id: `${from}-${to}`,
    start: `${from}-01-01`,
    end: `${to + 1}-01-01`,
    label: `${from}.01 – ${to}.12${isDefault ? " · 기본" : ""}`,
    short: from === to ? `${from}` : `${from}–${to}`,
  };
}

/** 기본 기간: 자료 범위 전체 */
export const DEFAULT_PERIOD = yearsPeriod(DATA_YEARS.from, DATA_YEARS.to);

/** 「이슈 골라서」 의 기간 칸. MVP 는 기본 하나 */
export const PERIODS: Period[] = [DEFAULT_PERIOD];
