import { describe, expect, it } from "vitest";

import type { Job, Source } from "@/shared/api";

import { historyOf, lastSuccess } from "./history";

const job = (id: string, status: Job["status"]) => ({ job_run_id: id, status }) as Job;

describe("출처 상태 점 줄", () => {
  it("최근 시작 순을 뒤집어 오른쪽이 최신, 모자란 칸은 왼쪽을 비운다", () => {
    const h = historyOf([job("j3", "failed"), job("j2", "ok"), job("j1", "aborted")], 5);
    expect(h.map((j) => j?.job_run_id ?? null)).toEqual([null, null, "j1", "j2", "j3"]);
  });

  it("많으면 최근 것만 칸 수만큼", () => {
    const recent = Array.from({ length: 12 }, (_, i) => job(`j${12 - i}`, "ok"));
    const h = historyOf(recent, 10);
    expect(h).toHaveLength(10);
    expect(h[9]?.job_run_id).toBe("j12");
    expect(h[0]?.job_run_id).toBe("j3");
  });

  it("마지막 성공은 수집 대상 중 가장 늦은 것, 없으면 null", () => {
    const source = {
      specs: [
        { last_success_at: "2026-11-09T04:00:00+09:00" },
        { last_success_at: null },
        { last_success_at: "2026-11-10T06:00:00+09:00" },
      ],
    } as Source;
    expect(lastSuccess(source)).toBe("2026-11-10T06:00:00+09:00");
    expect(lastSuccess({ specs: [] } as unknown as Source)).toBeNull();
  });
});
