"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { claimBadge, qualifierGrade, yearSpan } from "@/entities/argument";
import type { Argument, MyQuestion } from "@/shared/api";
import { Button, buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { argumentQuery } from "../api/queries";
import { candidateName, monthDay } from "../model/text";

// 오른쪽 패널(Figma 06 「1회차 → 2회차」): 고른 질문의 최근 두 회차를 나란히. 값은 두 실행의 저장된 결과(GET /v1/arguments)에서 센다.
// 「그 사이 바뀐 것」(검수 승인 · 새 기사 건수)은 받을 API 가 없어 아직 없다

const GRADE_ORDER = { low: 0, medium: 1, high: 2 } as const;

type Cell = { text: string; className?: string };
type Row = { label: string; cells: Cell[]; change?: Cell };

const available = (a: Argument) => a.evidence_table.filter((r) => r.status === "available").length;
const pending = (a: Argument) => a.evidence_table.reduce((n, r) => n + r.review_pending_count, 0);

/** 수의 변화. more = 늘면 좋은 값(근거)인지, 줄면 좋은 값(검증 대기)인지 */
function delta(before: number, now: number, more: "good" | "bad"): Cell | undefined {
  const d = now - before;
  if (d === 0) return undefined;
  const good = d > 0 === (more === "good");
  return {
    text: d > 0 ? `+${d}` : String(d),
    className: good ? "text-status-green" : "text-status-red",
  };
}

function rows(runs: Argument[]): Row[] {
  const [before, now] = runs.length === 2 ? runs : [undefined, runs[0]];
  const grade = (a: Argument) => qualifierGrade[a.qualifier.grade];
  return [
    {
      label: "분석 결과",
      cells: runs.map((a) => ({ text: claimBadge[a.claim.value].label })),
      change: before && {
        text: before.claim.value === now.claim.value ? "같음" : "바뀜",
        className: before.claim.value === now.claim.value ? "text-text-3" : "text-primary-text",
      },
    },
    {
      label: "근거 4종",
      cells: runs.map((a) => ({ text: `${available(a)} / 4` })),
      change: before && delta(available(before), available(now), "good"),
    },
    {
      label: "근거 수준",
      cells: runs.map((a) => ({ text: grade(a).label, className: grade(a).className })),
      change:
        before && before.qualifier.grade !== now.qualifier.grade
          ? GRADE_ORDER[now.qualifier.grade] > GRADE_ORDER[before.qualifier.grade]
            ? { text: "▲ 올라감", className: "text-status-green" }
            : { text: "▼ 내려감", className: "text-status-red" }
          : undefined,
    },
    {
      label: "교차 확인",
      cells: runs.map((a) => ({ text: `${a.qualifier.components.independent_evidence}건` })),
      change:
        before &&
        delta(
          before.qualifier.components.independent_evidence,
          now.qualifier.components.independent_evidence,
          "good",
        ),
    },
    {
      label: "검증 대기",
      cells: runs.map((a) => ({ text: `${pending(a)}건` })),
      change: before && delta(pending(before), pending(now), "bad"),
    },
  ];
}

export function ComparePanel({
  question: q,
  onRerun,
  running,
}: {
  question: MyQuestion;
  onRerun: () => void;
  running: boolean;
}) {
  return (
    <aside
      aria-label={q.candidate ? "새 이슈 후보" : "회차 비교"}
      className="m-4 flex w-92 shrink-0 flex-col gap-3.5 overflow-y-auto rounded-2xl bg-surface-1 p-5 shadow-panel"
    >
      {q.candidate ? <CandidateInfo question={q} /> : <RunCompare question={q} />}
      {!q.candidate && q.runs[0] && (
        <div className="mt-auto flex gap-2">
          <Link
            href={`/results/${encodeURIComponent(q.runs[0].run_id)}`}
            className={buttonClass({ variant: "secondary", className: "flex-1" })}
          >
            <Icon name="map" />
            결과 열기
          </Link>
          <Button className="flex-1" onClick={onRerun} disabled={running}>
            {running ? "실행 중" : "다시 실행"}
          </Button>
        </div>
      )}
    </aside>
  );
}

function RunCompare({ question: q }: { question: MyQuestion }) {
  const [now, before] = q.runs;
  const nowArg = useQuery({ ...argumentQuery(now?.run_id ?? ""), enabled: !!now });
  const beforeArg = useQuery({ ...argumentQuery(before?.run_id ?? ""), enabled: !!before });
  const n = q.runs.length;
  if (!now) return <p className="text-body-13 text-text-3">아직 실행한 적이 없어요</p>;

  const loaded = before ? [beforeArg.data, nowArg.data] : [nowArg.data];
  const runs = loaded.every(Boolean) ? (loaded as Argument[]) : undefined;
  const failed = nowArg.isError || beforeArg.isError;
  const sameRule = !before || !runs || runs[0].formula_version === runs[1].formula_version;
  const heads = before ? [`${n - 1}회차`, `${n}회차`] : [`${n}회차`];

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-heading-20 text-text-1">
          {before ? `${n - 1}회차 → ${n}회차` : `${n}회차`}
        </h2>
        <p className="text-body-13 text-text-3">
          {before
            ? `${monthDay(before.created_at)} → ${monthDay(now.created_at)} · 같은 질문 · ${
                sameRule ? "같은 규칙 버전" : "규칙 버전이 바뀜"
              }`
            : `${monthDay(now.created_at)} 실행 · ${q.place_name} · ${yearSpan(q.period_start, q.period_end)}`}
        </p>
      </div>

      {failed && <p className="text-body-13 text-status-red">회차 결과를 불러오지 못했어요</p>}
      {!failed && !runs && (
        <p className="text-body-13 text-text-3">회차 결과를 불러오는 중이에요</p>
      )}
      {runs && (
        <table className="w-full table-fixed overflow-hidden rounded-lg text-left inset-ring inset-ring-border-1">
          {/* Figma 칸 너비: 항목 96 · 회차마다 같은 너비 · 남은 칸은 변화. 회차가 바뀌어도 칸이 흔들리지 않게 고정한다 */}
          <colgroup>
            <col className="w-24" />
            {heads.map((h) => (
              <col key={h} className="w-20" />
            ))}
            {before && <col />}
          </colgroup>
          <thead className="bg-surface-2">
            <tr className="text-caption-11 text-text-3">
              <th className="py-2.5 pl-3 font-normal">
                <span className="sr-only">항목</span>
              </th>
              {heads.map((h) => (
                <th key={h} className="py-2.5 font-normal">
                  {h}
                </th>
              ))}
              {before && (
                <th className="py-2.5 pr-3 font-normal">
                  <span className="sr-only">변화</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows(runs).map((r) => (
              <tr key={r.label} className="border-t border-border-1 text-body-13">
                <th scope="row" className="py-2.5 pl-3 font-normal text-text-2">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={heads[i]} className={`py-2.5 ${c.className ?? "text-text-1"}`}>
                    {c.text}
                  </td>
                ))}
                {before && (
                  <td className={`py-2.5 pr-3 ${r.change?.className ?? ""}`}>{r.change?.text}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-body-13 text-text-3">
        {before
          ? "같은 지역 · 이슈 · 기간을 그때 자료로 다시 판단한 결과예요. 지난 회차 결과는 바뀌지 않아요."
          : "다시 실행하면 그 사이 검수 · 새 자료를 반영한 결과를 이 회차와 나란히 비교해요."}
      </p>
    </>
  );
}

function CandidateInfo({ question: q }: { question: MyQuestion }) {
  const why = (q.raw_text ?? "")
    .split("\n")
    .find((l) => l.startsWith("궁금한 까닭:"))
    ?.slice("궁금한 까닭:".length)
    .trim();
  const sentence = (q.raw_text ?? "").split("\n")[0];
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-heading-20 text-text-1">{candidateName(q)}</h2>
        <p className="text-body-13 text-text-3">
          {q.place_name} · {yearSpan(q.period_start, q.period_end)} · {monthDay(q.created_at)} 접수
        </p>
      </div>
      <dl className="flex flex-col gap-2.5 rounded-lg bg-surface-2 p-3.5 text-body-13">
        {sentence && sentence !== candidateName(q) && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-label-12 text-text-3">물은 문장</dt>
            <dd className="text-text-1">{sentence}</dd>
          </div>
        )}
        {why && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-label-12 text-text-3">궁금한 까닭</dt>
            <dd className="text-text-1">{why}</dd>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <dt className="text-label-12 text-text-3">상태</dt>
          <dd className="text-text-1">판단하지 않고 후보로 저장했어요</dd>
        </div>
      </dl>
      <p className="text-body-13 text-text-3">
        관리자가 이슈 카드로 만들지 검토해요. 카드가 생기면 새 질문에서 같은 지역 · 기간으로 바로
        물어볼 수 있어요.
      </p>
    </>
  );
}
