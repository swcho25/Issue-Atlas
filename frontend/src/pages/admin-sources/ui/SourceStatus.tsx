import Link from "next/link";

import type { Job, Source } from "@/shared/api";
import { monthDayTime } from "@/shared/lib/format";
import { Icon } from "@/shared/ui/icon";
import { table } from "@/shared/ui/table";

import { getRecentJobs } from "../api/server";
import { HISTORY_SIZE, historyOf, lastSuccess } from "../model/history";
import { jobBadge, methodLabel, storageLabel } from "../model/labels";
import { type SourcesQuery, sourcesHref } from "../model/query";

// 출처 상태: 출처마다 최근 HISTORY_SIZE 번 수집을 점 한 줄로(왼쪽이 오래된 것). 줄을 누르면 아래 수집 기록이 그 출처로
// 걸러지고(다시 누르면 풀림), 고른 줄 아래에 이용 조건 · 수집 대상이 펼쳐진다. 점은 실행 기록일 뿐 출처 건강 판정이 아니다
const dotClass: Record<Job["status"], string> = {
  ok: "bg-status-green",
  failed: "bg-status-red",
  aborted: "bg-status-amber",
  running: "bg-status-blue",
};

export async function SourceStatus({ sources, q }: { sources: Source[]; q: SourcesQuery }) {
  const recent = await getRecentJobs(
    sources.map((s) => s.source_id),
    HISTORY_SIZE,
  );
  return (
    <section aria-label="출처 상태" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-label-14 text-text-1">출처 상태</h2>
        <Legend />
      </div>
      <div className={table.wrap}>
        <table className={table.box}>
          <colgroup>
            <col />
            <col className="w-16" />
            <col className="w-32" />
            <col className="w-60" />
            <col className="w-40" />
            <col className="w-10" />
          </colgroup>
          <thead className={table.headRow}>
            <tr>
              <th className={table.headCell}>출처</th>
              <th className={table.headCell}>등급</th>
              <th className={table.headCell}>저장 범위</th>
              <th className={table.headCell}>최근 {HISTORY_SIZE}번 수집</th>
              <th className={table.headCell}>마지막 성공</th>
              <th className={table.headCell}>
                <span className="sr-only">거르기</span>
              </th>
            </tr>
          </thead>
          <tbody className="text-body-13">
            {sources.map((s) => {
              const active = q.source === s.source_id;
              const last = lastSuccess(s);
              return (
                <SourceRows key={s.source_id} source={s} active={active}>
                  <td className={table.bodyCell}>
                    <Link
                      href={sourcesHref({ source: active ? null : s.source_id, status: q.status })}
                      scroll={false}
                      aria-current={active ? "true" : undefined}
                      className="flex flex-col after:absolute after:inset-0"
                    >
                      <span className="text-text-1">{s.name}</span>
                      <span className="text-caption-12 text-text-3">{s.org}</span>
                    </Link>
                  </td>
                  <td className={`${table.bodyCell} text-text-2`}>{s.source_grade ?? "—"}</td>
                  <td className={`${table.bodyCell} text-text-2`}>
                    {storageLabel[s.storage_scope]}
                  </td>
                  <td className={table.bodyCell}>
                    <History jobs={recent[s.source_id] ?? []} />
                  </td>
                  <td className={`${table.bodyCell} text-text-2`}>
                    {last ? monthDayTime(last) : "성공 기록 없음"}
                  </td>
                  <td className={`${table.bodyCell} text-text-3`}>
                    {active && <Icon name="close" label="거르기 풀기" className="size-3.5" />}
                  </td>
                </SourceRows>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 출처 한 줄(+ 고르면 아래에 이용 조건 · 수집 대상 줄) */
function SourceRows({
  source: s,
  active,
  children,
}: {
  source: Source;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr
        className={`relative border-t border-border-1 align-top ${
          active ? "bg-primary-soft" : "hover:bg-surface-2"
        }`}
      >
        {children}
      </tr>
      {active && (
        <tr className="bg-primary-soft">
          <td colSpan={6} className="px-4 pt-0 pb-3">
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-caption-12">
              <div className="flex gap-1.5">
                <dt className="text-text-3">이용 조건</dt>
                <dd className="text-text-1">{s.license_type}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-text-3">수집 대상</dt>
                <dd className="text-text-1">
                  {s.specs.length === 0
                    ? "없음"
                    : s.specs.map((sp) => `${sp.spec_id} (${methodLabel[sp.method]})`).join(" · ")}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-text-3">출처 ID</dt>
                <dd className="text-text-1">{s.source_id}</dd>
              </div>
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

/** 점 한 줄: 칸마다 실행 하나(시작 시각 · 상태는 title 과 화면 낭독용 글자로) */
function History({ jobs }: { jobs: Job[] }) {
  return (
    <ol className="flex items-center gap-0.75">
      {historyOf(jobs).map((j, i) => (
        <li
          key={j?.job_run_id ?? `empty-${i}`}
          title={j ? `${monthDayTime(j.started_at)} ${jobBadge[j.status].label}` : "기록 없음"}
          className={`h-4 w-2 rounded-sm ${j ? dotClass[j.status] : "bg-border-1"}`}
        >
          <span className="sr-only">
            {j ? `${monthDayTime(j.started_at)} ${jobBadge[j.status].label}` : "기록 없음"}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-status-green", jobBadge.ok.label],
    ["bg-status-red", jobBadge.failed.label],
    ["bg-status-amber", jobBadge.aborted.label],
    ["bg-status-blue", jobBadge.running.label],
    ["bg-border-1", "기록 없음"],
  ];
  return (
    <ul className="flex flex-wrap items-center gap-3 text-caption-12 text-text-3">
      {items.map(([cls, label]) => (
        <li key={label} className="flex items-center gap-1">
          <span aria-hidden className={`h-3 w-1.5 rounded-sm ${cls}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
