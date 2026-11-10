import { describe, expect, it } from "vitest";

import notComparable from "../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import insufficient from "../../../../../contracts/c2/examples/argument-c1-insufficient.json";
import ready from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import unsupportedYears from "../../../../../contracts/c2/examples/argument-c1-unsupported-years.json";
import unsupported from "../../../../../contracts/c2/examples/argument-unsupported.json";
import { argumentSchema, seriesShape } from "./argument";

// 계약 예시(contracts/c2/examples)를 그대로 읽어 검증한다. 계약이 바뀌면 이 테스트가 먼저 알려 준다.
// 고쳐 보는 테스트가 서로 영향을 주지 않게 매번 복사본을 준다
const examples = {
  "argument-c1-ready.json": ready,
  "argument-c1-insufficient.json": insufficient,
  "argument-a3-not-comparable.json": notComparable,
  "argument-unsupported.json": unsupported,
  "argument-c1-unsupported-years.json": unsupportedYears,
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
    ["argument-c1-unsupported-years.json", "unsupported", "insufficient"],
  ] as const)("%s 를 통과시킨다", (file, runStatus, claim) => {
    const a = argumentSchema.parse(example(file));
    expect(a.run_status).toBe(runStatus);
    expect(a.claim.value).toBe(claim);
    expect(a.evidence_table).toHaveLength(4);
  });

  it("C2 v1: 판단 배지 글자(claim.label)와 적용 조건(applicability)", () => {
    const r = argumentSchema.parse(example("argument-c1-ready.json"));
    expect(r.claim.label).toBe("청년 순유출 확대");
    expect(r.applicability.map((c) => [c.condition, c.passed])).toEqual([
      ["place_level", true],
      ["min_complete_years", true],
      ["population", null],
    ]);
    const years = argumentSchema.parse(example("argument-c1-unsupported-years.json"));
    expect(years.claim.label).toBeNull();
    expect(years.applicability.filter((c) => c.passed === false)).toEqual([
      {
        condition: "min_complete_years",
        label: "완전한 연 값 3개 이상",
        passed: false,
        note: "2개(2024–2025)",
      },
    ]);
    expect(argumentSchema.parse(example("argument-unsupported.json")).applicability).toEqual([]);
  });

  it("그림 줄 모양을 칸으로 가른다(막대 · 이동 · 기사 건수)", () => {
    const a = argumentSchema.parse(example("argument-c1-ready.json"));
    // 통계 막대 1 · 이동 1 · 기사 건수(지역마다) 4
    expect(a.series.map(seriesShape)).toEqual(["bar", "flow", "tag", "tag", "tag", "tag"]);
    // 근거 기사도 실제 응답처럼 들어 있다(화면 개발용 가짜 값)
    expect(a.articles).toHaveLength(8);
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

  it("blocked · unsupported 인데 판단 배지 글자가 있으면 실패한다", () => {
    const a = structuredClone(insufficient);
    a.claim.label = "청년 순유출 확대" as never;
    expect(issuePaths(a)).toContain("claim.label");
  });

  it("적용 조건을 못 채웠는데 unsupported 가 아니면 실패한다", () => {
    const a = copyReady();
    a.applicability[1].passed = false;
    expect(issuePaths(a)).toContain("run_status");
  });

  it("카드가 없는데 적용 조건이 있으면 실패한다", () => {
    const a = structuredClone(unsupported);
    a.applicability = [
      { condition: "place_level", label: "시군구 단위", passed: true, note: null },
    ] as never;
    expect(issuePaths(a)).toContain("applicability");
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

  it("그림 줄의 기준선(baseline)에 위 · 아래 뜻이 하나라도 비면 실패한다", () => {
    const a = copyReady();
    const line = a.series[0] as Record<string, unknown>;
    line.baseline = { value: 0, below: "순유출" };
    expect(issuePaths(a).some((p) => p.startsWith("series.0"))).toBe(true);
  });

  it("근거 충실도 등급이 규칙과 다르면 실패한다", () => {
    const a = copyReady();
    a.qualifier.components.independent_evidence = 1;
    expect(issuePaths(a)).toContain("qualifier.grade");
  });
});
