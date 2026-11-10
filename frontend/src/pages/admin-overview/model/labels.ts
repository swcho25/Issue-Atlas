import type { StatusTone } from "@/shared/ui/badge";

import type { JobStatus } from "./schema";

// 운영 요약 글자. 계약(contracts/operations) 주의 사항을 지킨다:
// running 은 DB 상태가 비어 있다는 뜻일 뿐 수집이 살아 있다는 보장이 아니고, 최신 작업 하나로 출처 전체를 판정하지 않는다

export const jobBadge: Record<JobStatus, { tone: StatusTone; label: string }> = {
  ok: { tone: "green", label: "최근 성공" },
  failed: { tone: "red", label: "최근 실패" },
  aborted: { tone: "amber", label: "최근 중단" },
  running: { tone: "blue", label: "종료 미확인" },
  unknown: { tone: "gray", label: "기록 없음" },
};

export const storageLabel: Record<string, string> = {
  full: "원문 저장",
  metadata: "메타데이터만",
  summary: "요약만",
  link_only: "링크만",
};

/** 기간 칸: 최근 7일 · 30일(주소 ?days). 계약 기본값이 7일이라 7일이면 기간을 보내지 않는다 */
export const periodDays = [7, 30] as const;
export type PeriodDays = (typeof periodDays)[number];

export function daysOf(v: string | string[] | undefined): PeriodDays {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return periodDays.find((d) => d === n) ?? 7;
}
