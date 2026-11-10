import type { Argument } from "@/shared/api";

// ④ 근거 수준의 기준과 모자란 것을 한 줄씩(계약 c2 README 「근거 충실도 규칙표」 qualifier-0.1).
// 화면 이름: a_grade_sources = 공식 통계(A등급), ab_grade_sources = 공식 통계 · 행정 자료(A · B등급),
// independent_evidence = 교차 확인, latest_within_one_year = 기준 시점 1년 이내

type Components = Argument["qualifier"]["components"];

/** 높음 · 보통이 되는 기준 */
export const qualifierRule =
  "높음 = 공식 통계 2곳 · 교차 확인 3건 · 기준 시점 1년 이내, 보통 = 공식 통계 · 행정 자료 1곳 · 교차 확인 2건";

/** 한 단계 위까지 모자란 것: 「높음까지 공식 통계 1곳 더」. 높음이면 null */
export function qualifierGap(grade: Argument["qualifier"]["grade"], c: Components) {
  if (grade === "high") return null;
  const gaps: string[] = [];
  if (grade === "medium") {
    if (c.a_grade_sources < 2) gaps.push(`공식 통계 ${2 - c.a_grade_sources}곳`);
    if (c.independent_evidence < 3) gaps.push(`교차 확인 ${3 - c.independent_evidence}건`);
    if (!c.latest_within_one_year) gaps.push("1년 이내 자료");
    return `높음까지 ${gaps.join(" · ")} 더`;
  }
  if (c.ab_grade_sources < 1) gaps.push("공식 통계 · 행정 자료 1곳");
  if (c.independent_evidence < 2) gaps.push(`교차 확인 ${2 - c.independent_evidence}건`);
  return `보통까지 ${gaps.join(" · ")} 더`;
}
