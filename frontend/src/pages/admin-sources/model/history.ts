import type { Job, Source } from "@/shared/api";

/** 출처 상태 표에 보이는 최근 실행 수 */
export const HISTORY_SIZE = 10;

/**
 * 최근 실행(최근 시작 순으로 받은 것)을 점 줄로: 왼쪽이 오래된 것, 오른쪽이 최신.
 * 실행이 HISTORY_SIZE 보다 적으면 왼쪽을 null(기록 없음)로 채운다
 */
export function historyOf(recent: Job[], size = HISTORY_SIZE): (Job | null)[] {
  const oldestFirst = recent.slice(0, size).reverse();
  return [...Array<null>(size - oldestFirst.length).fill(null), ...oldestFirst];
}

/** 수집 대상 중 가장 늦은 마지막 성공(없으면 null) */
export function lastSuccess(source: Source) {
  return source.specs.reduce<string | null>(
    (latest, s) =>
      s.last_success_at && (!latest || Date.parse(s.last_success_at) > Date.parse(latest))
        ? s.last_success_at
        : latest,
    null,
  );
}
