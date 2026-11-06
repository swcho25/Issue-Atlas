/** MVP 기간은 하나: 2023.01 – 2025.12 월별(끝은 미포함 날짜로 보낸다) */
export const PERIODS = [
  {
    id: "2023-2025",
    start: "2023-01-01",
    end: "2026-01-01",
    label: "2023.01 – 2025.12 · 기본",
    short: "2023–2025",
  },
] as const;

export type Period = (typeof PERIODS)[number];
