import type { Argument, EvidenceRef, EvidenceRow } from "@/shared/api";
import { StatusBadge } from "@/shared/ui/badge";
import { Icon } from "@/shared/ui/icon";

import {
  comparabilityLabel,
  evidenceKindLabel,
  evidenceStatusBadge,
  yearSpan,
} from "../../model/labels";
import { emptyRefsText, kindCount, refsTitle } from "../../model/sources";

// 05 · 근거 수요표 본문(Figma 05 · 근거 수요표 탭): 표(근거 4행) → 비교 조건 4가지 → 빈칸 안내.
// 판단보다 먼저 「무엇이 있고 무엇이 없는지」를 보여 준다(FR-B2). 없는 근거는 0 이 아니라 상태 · 사유로

// 표 칸: 머리 글자와 폭(Figma: 종류 150 · 필수 70 · 상태 100 · 건수 60 · 검수 대기 80 · 소스 · 사유 330).
// 머리 줄은 이 목록을 돌며 그리고, 각 줄의 칸도 같은 폭(col)을 쓴다
const columns = [
  { key: "kind", label: "근거 종류", width: "w-[150px]" },
  { key: "required", label: "필수", width: "w-[70px]" },
  { key: "status", label: "상태", width: "w-[100px]" },
  { key: "count", label: "건수", width: "w-[60px]" },
  { key: "pending", label: "검증 대기", width: "w-[80px]" },
  { key: "source", label: "소스 · 사유", width: "w-[330px]" },
] as const;

type ColumnKey = (typeof columns)[number]["key"];
// 좁은 창에서도 칸 폭을 지키고(줄어들지 않음) 표가 옆으로 스크롤된다
const col = Object.fromEntries(columns.map((c) => [c.key, `${c.width} shrink-0`])) as Record<
  ColumnKey,
  string
>;

/**
 * 소스 칸: 대표 자료 첫 줄(+ 외 N건 — 건수 칸과 같은 전체 건수로)과 출처 · 등급 · 기간.
 * 대표 자료가 없으면 「자료 N건 · 목록 없음」 또는 사유 · 상태
 */
function sourceOf(row: EvidenceRow, refs: EvidenceRef[], count: number) {
  const first = refs[0];
  if (!first) return { title: emptyRefsText(row, count), sub: null };
  return {
    title: refsTitle(first, count),
    sub: [
      first.source_name,
      `출처 등급 ${first.source_grade}`,
      yearSpan(first.period_start, first.period_end),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function EvidenceTab({ argument }: { argument: Argument }) {
  const conditions = Object.entries(argument.comparability) as [
    keyof typeof comparabilityLabel,
    Argument["comparability"][keyof typeof comparabilityLabel],
  ][];
  const passed = conditions.filter(([, c]) => c.passed === true).length;

  return (
    <>
      {/* 근거 표: 테두리 1 이 자리를 차지하는 것까지 Figma 와 같다(안쪽 칸 x 1) */}
      <div
        role="table"
        aria-label="자료 현황"
        className="overflow-x-auto rounded-xl border border-border-1 bg-surface-1"
      >
        <div role="rowgroup" className="min-w-max">
          <div role="row" className="flex bg-surface-2 px-4 py-2.5 text-caption-11 text-text-3">
            {columns.map((c) => (
              <span key={c.key} role="columnheader" className={col[c.key]}>
                {c.label}
              </span>
            ))}
          </div>
          {argument.evidence_table.map((row) => {
            const badge = evidenceStatusBadge[row.status];
            // 건수는 다른 탭 · 탭 바와 같은 수(보도 기사 포함, model/sources)
            const count = kindCount(argument, row);
            const source = sourceOf(row, argument.data[row.kind], count);
            return (
              <div
                key={row.kind}
                role="row"
                className="flex items-center border-t border-border-1 px-4 py-3.5"
              >
                <span role="cell" className={`${col.kind} text-label-13 text-text-1`}>
                  {evidenceKindLabel[row.kind]}
                </span>
                <span
                  role="cell"
                  className={`${col.required} text-caption-12 ${row.required ? "text-primary-text" : "text-text-1"}`}
                >
                  {row.required ? "필수" : "선택"}
                </span>
                <span role="cell" className={col.status}>
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                </span>
                <span role="cell" className={`${col.count} text-label-13 text-text-1`}>
                  {count}
                </span>
                <span role="cell" className={`${col.pending} text-caption-12 text-text-1`}>
                  {row.review_pending_count}
                </span>
                <span role="cell" className={`${col.source} grid gap-0.5`}>
                  <span className="text-body-13 text-text-1">{source.title}</span>
                  {source.sub && <span className="text-caption-11 text-text-3">{source.sub}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 비교 조건: 4개 모두 충족해야 증가 · 감소를 말할 수 있다(FR-C4) */}
      <section
        aria-label="비교 가능성"
        className="flex flex-col gap-2 rounded-xl border border-border-1 bg-surface-1 p-4"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-heading-16 text-text-1">
            비교 가능성 {passed} / {conditions.length}
          </h2>
          <p className="text-caption-12 text-text-3">4개 모두 충족해야 판정할 수 있어요</p>
        </div>
        {conditions.map(([key, c]) => (
          <div key={key} className="flex items-center gap-2.5">
            {/* 통과는 Figma 그대로 초록 체크. 실패 · 검사 안 함은 Figma 에 예가 없어 빨강 ✕ · 회색 — (디자이너 확인) */}
            {c.passed === true ? (
              <Icon name="check" label="충족" className="size-3.5 text-status-green" />
            ) : c.passed === false ? (
              <Icon name="close" label="충족 안 됨" className="size-3.5 text-status-red" />
            ) : (
              <Icon name="minus" label="검사 안 함" className="size-3.5 text-text-3" />
            )}
            <span className="w-[120px] shrink-0 text-label-13 text-text-1">
              {comparabilityLabel[key]}
            </span>
            <span className="min-w-0 text-caption-12 text-text-2">{c.note ?? "—"}</span>
          </div>
        ))}
      </section>

      <p className="flex items-center gap-2 rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-caption-12 text-text-2">
        <Icon name="alert" className="size-3.5 text-text-3" />
        빈칸도 결과예요 — 미수집 · 미공표 · 이용 제한은 0으로 채우지 않고 이유와 함께 남겨요.
      </p>
    </>
  );
}
