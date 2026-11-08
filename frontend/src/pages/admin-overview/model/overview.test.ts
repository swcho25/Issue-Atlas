import { describe, expect, it } from "vitest";

import { daysOf, monthDayTime, num } from "./labels";
import { overviewSchema } from "./schema";

// dev 의 GET /v1/admin/overview 응답과 같은 모양(contracts/operations, 출처는 한 곳만 남김)
const sample = {
  generated_at: "2026-11-08T07:14:41.947343851Z",
  period: { from: "2026-11-01T07:14:41.947343851Z", to: "2026-11-08T07:14:41.947343851Z" },
  current_queues: {
    reviews: { pending: 0, on_hold: 0, resolved: 5, rejected: 2, approval_pending: 0 },
    approvals: { pending: 0, on_hold: 0, approved: 3, rejected: 1 },
    imports: { validation_failed: 0, no_changes: 0, pending: 0, completed: 0, failed: 0 },
  },
  period_activity: {
    review_decisions: { confirm: 4, correct: 1, hold: 2, reject: 2 },
    approval_decisions: { approve: 3, reject: 1, hold: 2 },
    import_results: { completed: 0, failed: 0 },
    jobs_started: { ok: 11, failed: 1, aborted: 0, running: 0 },
  },
  current_inventory: { raw_records: 3497962, normalized_records: 25834, ready_records: 25815 },
  source_statuses: [
    {
      source_id: "lofin",
      name: "지방재정365 세부사업별 세출현황",
      storage_scope: "full",
      reliability_grade: "B",
      robots_status: null,
      spec_count: 0,
      never_run_spec_count: 0,
      latest_job_status: "unknown",
      last_started_at: null,
      last_successful_at: null,
    },
  ],
};

describe("운영 요약", () => {
  it("dev 응답 모양을 그대로 받는다(기록 없는 출처는 unknown · 시각 null)", () => {
    const o = overviewSchema.parse(sample);
    expect(o.current_inventory.raw_records).toBe(3497962);
    expect(o.source_statuses[0].latest_job_status).toBe("unknown");
  });

  it("모르는 작업 상태가 오면 화면에 닿기 전에 실패한다", () => {
    const bad = {
      ...sample,
      source_statuses: [{ ...sample.source_statuses[0], latest_job_status: "zombie" }],
    };
    expect(() => overviewSchema.parse(bad)).toThrow();
  });

  it("기간은 7일 · 30일만(그 밖은 7일)", () => {
    expect(daysOf(undefined)).toBe(7);
    expect(daysOf("30")).toBe(30);
    expect(daysOf(["14"])).toBe(7);
  });

  it("숫자는 천 단위, 시각은 한국 시간", () => {
    expect(num(3497962)).toBe("3,497,962");
    expect(monthDayTime("2026-11-08T07:14:41Z")).toBe("11-08 16:14");
  });
});
