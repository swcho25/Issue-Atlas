import { z } from "zod";

import {
  claimLevel,
  claimValue,
  date,
  dateTime,
  evidenceKind,
  evidenceRef,
  evidenceStatus,
  id,
  locationPrecision,
  provenance,
  qualifierGrade,
  rebuttalStatus,
  ruleProvenance,
  runStatus,
  schemaVersion,
  textOrNull,
} from "./common";

// GET /v1/arguments/{run_id} 응답 — 근거 수요표 + 논증 카드 6칸(contracts/c2/schemas/argument.schema.json, c2-0.1).
// 05 화면의 세 탭(수요표 · 논증 · 원문)과 04 결과 카드가 이 응답 하나로 그려진다.
// 모르는 칸은 버리고 통과시킨다(z.object). 칸 추가는 계약 쪽 리뷰로 막고, 화면은 아는 칸만 쓴다

const lonLat = z.tuple([z.number().nullable(), z.number().nullable()]);

const question = z.object({
  question_id: id,
  place_id: id,
  place_name: z.string(),
  /** null 이면 목록에 없는 질문(신규 카드 후보). run_status 는 unsupported */
  card_id: z.string().nullable(),
  card_name: z.string().nullable(),
  period_start: date,
  period_end: date,
});

const evidenceRow = z.object({
  kind: evidenceKind,
  required: z.boolean(),
  status: evidenceStatus,
  count: z.number().int().min(0),
  review_pending_count: z.number().int().min(0),
  reason: textOrNull,
});

const condition = z.object({ passed: z.boolean().nullable(), note: textOrNull });

/**
 * 카드 적용 조건 한 줄(C2 v1, 카드 양식 B6). condition = 승인본 칸 이름(place_level · min_complete_years · min_stations · population),
 * label = 화면 문구, passed = true 충족 · false 못 채움 · null 확인 못 함 또는 표시만, note 예 「2개(2024–2025)」
 */
const applicabilityItem = z.object({
  condition: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  passed: z.boolean().nullable(),
  note: textOrNull,
});

const qualifierComponents = z.object({
  a_grade_sources: z.number().int().min(0),
  ab_grade_sources: z.number().int().min(0),
  independent_evidence: z.number().int().min(0),
  latest_observed_at: dateTime.nullable(),
  latest_within_one_year: z.boolean(),
});

// 그림 줄 공통: 질문 기간의 달마다 한 칸, 세 배열의 길이가 같다
const seriesBase = {
  unit: z.string().nullable(),
  periods: z.array(z.string().regex(/^\d{4}-\d{2}$/)),
  values: z.array(z.number().nullable()),
  statuses: z.array(evidenceStatus),
};
/** 통계 한 지역 · 측정소(coordinates 가 있으면 지도 점, 없으면 막대) */
const placeSeries = z.object({
  ...seriesBase,
  indicator_id: z.string(),
  place_id: id,
  station_id: z.string().nullable(),
  name: z.string().nullable(),
  coordinates: lonLat.nullable(),
});
/** 이동: from → to */
const flowSeries = z.object({
  ...seriesBase,
  indicator_id: z.string(),
  from: id,
  to: id,
  to_name: z.string().nullable(),
  from_coordinates: lonLat,
  to_coordinates: lonLat,
});
/** 기사 건수(관측 순서 그림) */
const tagSeries = z.object({
  ...seriesBase,
  tag: z.string(),
  place_id: id,
  name: z.string().nullable(),
  coordinates: lonLat.nullable(),
});
const series = z.union([flowSeries, tagSeries, placeSeries]);

const article = z.object({
  id: z.string(),
  date,
  place_id: id,
  point: lonLat.nullable(),
  precision: locationPrecision,
  summary: z.string().nullable(),
  place_name: z.string().nullable(),
  url: z.url().nullable(),
});

const argumentObject = z.object({
  schema_version: schemaVersion,
  run_id: id,
  question,
  card_version: z.number().int().min(0).nullable(),
  /** 카드 판정 규칙 판. 카드가 없거나 규칙이 없으면 null */
  formula_version: z.string().nullable(),
  taxonomy_version: z.string(),
  run_status: runStatus,
  created_at: dateTime,
  /** 근거 수요표. 판단보다 먼저 보여준다(FR-B2). 항상 4행 */
  evidence_table: z.array(evidenceRow).length(4),
  /** 카드 적용 조건(C2 v1). 카드 계약 칸 순서. 카드 · 승인본이 없거나 C2 v1 전에 저장된 실행이면 빈 배열 */
  applicability: z.array(applicabilityItem),
  /** 비교 조건 4가지. 하나라도 false 면 증가 · 감소를 낼 수 없다(FR-C4) */
  comparability: z.object({
    same_indicator: condition,
    same_period_length: condition,
    same_boundary: condition,
    same_method: condition,
  }),
  claim: z.object({
    value: claimValue,
    /**
     * 판단 배지 글자 = 카드 결과 이름(「청년 순유출 확대」 · 「비교 불가」, C2 v1). 판정하지 않은 실행(blocked · unsupported)은 null.
     * ready · partial 인데 null 이면 C2 v1 전에 저장된 실행 — 화면은 이전 배지(claim.value)로 대신한다
     */
    label: z.string().min(1).nullable(),
    level: claimLevel,
    text: textOrNull,
    provenance: ruleProvenance,
  }),
  data: z.object({
    statistics: z.array(evidenceRef),
    documents: z.array(evidenceRef),
    existing_responses: z.array(evidenceRef),
    denominators: z.array(evidenceRef),
    provenance,
  }),
  warrant: z.object({ text: textOrNull, provenance }),
  /** 근거 충실도. 수치 신뢰도는 내지 않는다(FR-C5) */
  qualifier: z.object({
    grade: qualifierGrade,
    components: qualifierComponents,
    formula_version: z.literal("qualifier-0.1"),
    provenance: ruleProvenance,
  }),
  rebuttals: z.array(z.object({ text: z.string(), status: rebuttalStatus, provenance })),
  ceiling: z.object({ items: z.array(z.string()), provenance: ruleProvenance }),
  series: z.array(series),
  articles: z.array(article),
});

type Components = z.infer<typeof qualifierComponents>;
// qualifier-0.1(PRD 7.3) 상: A등급 2+ · 독립 근거 3+ · 1년 이내 / 중 이상: A · B등급 1+ · 독립 근거 2+
const isHigh = (c: Components) =>
  c.a_grade_sources >= 2 && c.independent_evidence >= 3 && c.latest_within_one_year;
const isMediumOrAbove = (c: Components) => c.ab_grade_sources >= 1 && c.independent_evidence >= 2;

// 계약 JSON Schema 의 allOf(if/then) 규칙을 그대로 검사한다
export const argumentSchema = argumentObject.superRefine((a, ctx) => {
  const fail = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });

  if (a.question.card_id === null) {
    if (a.run_status !== "unsupported")
      fail(["run_status"], "card_id 가 null 이면 run_status 는 unsupported");
    if (a.card_version !== null)
      fail(["card_version"], "card_id 가 null 이면 card_version 도 null");
    if (a.applicability.length)
      fail(["applicability"], "card_id 가 null 이면 applicability 는 빈 배열");
  }
  if (a.run_status === "blocked" || a.run_status === "unsupported") {
    if (a.claim.value !== "insufficient")
      fail(["claim", "value"], `run_status ${a.run_status} 이면 claim 은 insufficient`);
    if (a.claim.label !== null)
      fail(["claim", "label"], `run_status ${a.run_status} 이면 claim.label 은 null`);
  }
  // 카드 적용 조건을 하나라도 못 채우면 실행하지 않는다(양식 B6)
  if (a.applicability.some((c) => c.passed === false) && a.run_status !== "unsupported")
    fail(["run_status"], "적용 조건에 passed false 가 있으면 run_status 는 unsupported");
  if (a.claim.value === "increasing" || a.claim.value === "decreasing") {
    for (const [key, cond] of Object.entries(a.comparability))
      if (cond.passed !== true)
        fail(
          ["comparability", key, "passed"],
          `claim ${a.claim.value} 이면 비교 조건이 모두 통과여야 한다`,
        );
  }
  a.series.forEach((s, i) => {
    if (s.values.length !== s.periods.length || s.statuses.length !== s.periods.length)
      fail(["series", i], "periods · values · statuses 길이가 다르다");
  });
  const c = a.qualifier.components;
  const expected = isHigh(c) ? "high" : isMediumOrAbove(c) ? "medium" : "low";
  if (a.qualifier.grade !== expected)
    fail(["qualifier", "grade"], `근거 충실도 규칙(qualifier-0.1)으로는 ${expected}`);
});

export type Argument = z.infer<typeof argumentSchema>;
export type ArgumentSeries = z.infer<typeof series>;
export type EvidenceRow = z.infer<typeof evidenceRow>;
export type ArgumentArticle = z.infer<typeof article>;

/** 그림 종류는 칸으로 정한다(시공간 표시 개발 명세 5절): to → 이동, tag → 기사 건수, coordinates → 지도 점, 없으면 막대 */
export function seriesShape(s: ArgumentSeries): "flow" | "tag" | "map" | "bar" {
  if ("to" in s) return "flow";
  if ("tag" in s) return "tag";
  return s.coordinates ? "map" : "bar";
}
