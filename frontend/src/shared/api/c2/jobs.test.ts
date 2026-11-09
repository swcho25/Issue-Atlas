import { describe, expect, it } from "vitest";

import failed from "../../../../../contracts/c2/examples/job-failed.json";
import list from "../../../../../contracts/c2/examples/job-list.json";
import { jobListSchema, jobSchema } from "./jobs";

describe("jobListSchema · jobSchema", () => {
  it("계약 예시(목록 · 실패 1건)를 통과시킨다", () => {
    expect(jobListSchema.parse(list).jobs.length).toBeGreaterThan(0);
    expect(jobSchema.parse(failed).job.status).toBe("failed");
  });

  it("모르는 상태면 실패한다", () => {
    const bad = structuredClone(failed);
    bad.job.status = "zombie";
    expect(jobSchema.safeParse(bad).success).toBe(false);
  });
});
