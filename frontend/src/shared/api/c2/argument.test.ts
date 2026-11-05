import { describe, expect, it } from "vitest";

import notComparable from "../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import insufficient from "../../../../../contracts/c2/examples/argument-c1-insufficient.json";
import ready from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import unsupported from "../../../../../contracts/c2/examples/argument-unsupported.json";
import { argumentSchema, seriesShape } from "./argument";

// 계약 예시(contracts/c2/examples)를 그대로 읽어 검증한다. 계약이 바뀌면 이 테스트가 먼저 알려 준다.
// 고쳐 보는 테스트가 서로 영향을 주지 않게 매번 복사본을 준다
const examples = {
  "argument-c1-ready.json": ready,
  "argument-c1-insufficient.json": insufficient,
  "argument-a3-not-comparable.json": notComparable,
  "argument-unsupported.json": unsupported,
};
const example = (name: keyof typeof examples): Record<string, unknown> =>
  structuredClone(examples[name]);

const issuePaths = (input: unknown) => {
  const r = argumentSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("argumentSchema — 계약 예시", () => {
  it.each([
    ["argument-c1-ready.json", "ready", "increasing"],
    ["argument-c1-insufficient.json", "blocked", "insufficient"],
    ["argument-a3-not-comparable.json", "partial", "not_comparable"],
    ["argument-unsupported.json", "unsupported", "insufficient"],
  ] as const)("%s 를 통과시킨다", (file, runStatus, claim) => {
    const a = argumentSchema.parse(example(file));
    expect(a.run_status).toBe(runStatus);
    expect(a.claim.value).toBe(claim);
    expect(a.evidence_table).toHaveLength(4);
  });

  it("그림 줄 모양을 칸으로 가른다(막대 · 이동)", () => {
    const a = argumentSchema.parse(example("argument-c1-ready.json"));
    expect(a.series.map(seriesShape)).toEqual(["bar", "flow"]);
  });

  it("계약에 없는 칸은 버리고 통과시킨다", () => {
    const a = argumentSchema.parse({ ...example("argument-c1-ready.json"), extra: 1 });
    expect(a).not.toHaveProperty("extra");
  });
});

describe("argumentSchema — 계약 규칙을 어긴 응답", () => {
  // 고칠 칸에 타입이 붙도록 JSON 모양 그대로 복사한다
  const copyReady = () => structuredClone(ready);

  it("필수 칸이 빠지면 실패한다", () => {
    const a: Partial<typeof ready> = copyReady();
    delete a.claim;
    expect(issuePaths(a)).toContain("claim");
  });

  it("근거 수요표가 4행이 아니면 실패한다", () => {
    const a = copyReady();
    a.evidence_table = a.evidence_table.slice(0, 3);
    expect(issuePaths(a)).toContain("evidence_table");
  });

  it("증가 · 감소인데 비교 조건이 하나라도 통과가 아니면 실패한다", () => {
    const a = copyReady();
    a.comparability.same_boundary.passed = false;
    expect(issuePaths(a)).toContain("comparability.same_boundary.passed");
  });

  it("blocked 인데 판단을 내면 실패한다", () => {
    const a = copyReady();
    a.run_status = "blocked";
    expect(issuePaths(a)).toContain("claim.value");
  });

  it("card_id 가 null 인데 unsupported 가 아니면 실패한다", () => {
    const a = structuredClone(unsupported);
    a.run_status = "partial";
    expect(issuePaths(a)).toContain("run_status");
  });

  it("그림 줄의 periods · values 길이가 다르면 실패한다", () => {
    const a = copyReady();
    a.series[0].values.pop();
    expect(issuePaths(a)).toContain("series.0");
  });

  it("근거 충실도 등급이 규칙과 다르면 실패한다", () => {
    const a = copyReady();
    a.qualifier.components.independent_evidence = 1;
    expect(issuePaths(a)).toContain("qualifier.grade");
  });
});
