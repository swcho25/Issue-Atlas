import type { Argument, EvidenceRef, EvidenceRow } from "@/shared/api";

import { evidenceStatusBadge } from "./labels";

// 근거 건수 · 고른 근거 — 수요표 · 논증 · 원문 탭과 탭 바가 같은 수를 쓰도록 한 곳에 둔다.
// 응답의 data[kind] 는 대표 자료 몇 건뿐이고, 전체 건수는 수요표 줄의 count 다(계약 예시: 기사 count 12 · 목록 1)

/**
 * 종류 하나의 원문 건수. 수요표 count 가 전체, 기사(articles)는 기사 · 보도 묶음에 들어간다.
 * count 에 기사가 들어 있는지 계약에 적혀 있지 않아, 겹쳐 세지 않도록 둘 중 큰 쪽을 쓴다
 */
export function kindCount(argument: Argument, row: EvidenceRow) {
  const listed =
    argument.data[row.kind].length + (row.kind === "documents" ? argument.articles.length : 0);
  return Math.max(row.count, listed);
}

/** 원문 전체 건수(탭 바 「원문 N」 = 패널 「원문 N건」) */
export function sourcesTotal(argument: Argument) {
  return argument.evidence_table.reduce((sum, row) => sum + kindCount(argument, row), 0);
}

/** 대표 자료 제목에 나머지 건수를 붙인다: 「청년 정착 지원 확대 외 11건」 */
export function refsTitle(first: EvidenceRef, count: number) {
  return count > 1 ? `${first.title} 외 ${count - 1}건` : first.title;
}

/**
 * 대표 자료가 없을 때 그 자리에 쓸 말. 건수가 있으면 「자료 5건 · 목록 없음」(A3 예시: 기사 확보 5 · 목록 0),
 * 없으면 수요표의 사유, 사유도 없으면 상태(미수집 · 미공표 …). 「확보」인데 0건이면 모순이라 「—」
 */
export function emptyRefsText(row: EvidenceRow, count: number) {
  if (count > 0) return `자료 ${count}건 · 목록 없음`;
  return row.reason ?? (row.status === "available" ? "—" : evidenceStatusBadge[row.status].label);
}

type Article = Argument["articles"][number];

/**
 * 문서 근거가 있는 기사를 근거 줄 값으로(-318). 근거 상세를 못 받았을 때 읽기 칸이 쓰는 값이라 제목은 요약, 출처는 「기사」.
 * 근거 ID · 등급이 없는 기사(지난 실행 결과 · 등급 없는 출처)는 null — 원문 사이트로만 연다
 */
export function articleRef(article: Article): EvidenceRef | null {
  if (!article.evidence_id || !article.source_grade) return null;
  return {
    evidence_id: article.evidence_id,
    title: article.summary ?? "기사",
    source_name: "기사",
    source_grade: article.source_grade,
    period_start: null,
    period_end: null,
    storage_scope: "metadata",
  };
}

/**
 * 원문 탭에서 고를 근거: ?e= 가 목록에 있으면 그것, 없거나 모르는 ID 면 첫 근거(수요표 순서, 기사는 기사 · 보도 묶음 끝).
 * ?e= 가 여럿이면 첫 값
 */
export function pickEvidence(argument: Argument, e: string | string[] | undefined) {
  const wanted = Array.isArray(e) ? e[0] : e;
  const refs = argument.evidence_table.flatMap((row) => [
    ...argument.data[row.kind],
    ...(row.kind === "documents" ? argument.articles.flatMap((a) => articleRef(a) ?? []) : []),
  ]);
  return refs.find((r) => r.evidence_id === wanted) ?? refs[0] ?? null;
}
