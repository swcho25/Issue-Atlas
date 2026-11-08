import Link from "next/link";
import { Suspense } from "react";

import type { Job } from "@/shared/api";
import { dateTime, num } from "@/shared/lib/format";
import { href, type SearchParams } from "@/shared/lib/url";
import { StatusBadge } from "@/shared/ui/badge";
import { Icon } from "@/shared/ui/icon";
import { Pager } from "@/shared/ui/pager";
import { SegmentLinks } from "@/shared/ui/segment";
import { table } from "@/shared/ui/table";

import { getImports, getJobs, getJobTotal, getSources } from "../api/server";
import { jobBadge, methodLabel } from "../model/labels";
import { jobQuery, jobStatuses, PAGE_SIZE } from "../model/query";
import { SourcesNav } from "./SourcesNav";

// /admin/sources/jobs — 수집 이력(최근 시작 순, 재실행 없음). 상태 · 출처로 거른다
export function AdminJobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main className="flex h-full flex-col gap-4 overflow-y-auto bg-bg-app px-7 pt-6 pb-10">
      <Suspense
        fallback={<p className="text-body-13 text-text-3">수집 이력을 불러오는 중이에요</p>}
      >
        <JobsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function JobsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = jobQuery(await searchParams);
  const [list, sources, jobTotal, imports] = await Promise.all([
    getJobs(q),
    getSources(),
    getJobTotal(),
    getImports({ status: null, page: 1 }),
  ]);
  const sourceName = q.source ? sources.find((s) => s.source_id === q.source)?.name : null;
  return (
    <>
      <h1 className="text-heading-24 text-text-1">데이터 소스</h1>
      <SourcesNav
        current="jobs"
        counts={{ sources: sources.length, jobs: jobTotal, imports: imports.total }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SegmentLinks
          label="실행 상태"
          items={[null, ...jobStatuses].map((s) => ({
            key: s ?? "all",
            label: s ? jobBadge[s].label : "전체",
            href: href("/admin/sources/jobs", { status: s, source: q.source }),
            active: q.status === s,
          }))}
        />
        {q.source && (
          <Link
            href={href("/admin/sources/jobs", { status: q.status })}
            className="flex h-8 items-center gap-1.5 rounded-full border border-border-1 bg-surface-1 pr-2.5 pl-3 text-label-13 text-text-1 hover:bg-surface-2"
          >
            {sourceName ?? q.source}
            <Icon name="close" className="size-3.5 text-text-3" />
            <span className="sr-only">출처 거르기 풀기</span>
          </Link>
        )}
      </div>
      {list.jobs.length === 0 ? (
        <p className="py-10 text-center text-body-13 text-text-3">수집 이력 없음</p>
      ) : (
        <div className={table.wrap}>
          <table className={table.box}>
            <colgroup>
              <col className="w-40" />
              <col />
              <col className="w-20" />
              <col className="w-32" />
              <col className="w-52" />
              <col className="w-24" />
              <col className="w-40" />
            </colgroup>
            <thead className={table.headRow}>
              <tr>
                <th className={table.headCell}>시작</th>
                <th className={table.headCell}>출처 · 명세</th>
                <th className={table.headCell}>방식</th>
                <th className={table.headCell}>상태</th>
                <th className={table.headCell}>받음 · 새로 · 중복</th>
                <th className={table.headCell}>걸린 시간</th>
                <th className={table.headCell}>오류 코드</th>
              </tr>
            </thead>
            <tbody className="text-body-13">
              {list.jobs.map((j) => (
                <JobRow key={j.job_run_id} job={j} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={q.page}
        size={PAGE_SIZE}
        total={list.total}
        hrefFor={(page) =>
          href("/admin/sources/jobs", { status: q.status, source: q.source, page })
        }
      />
    </>
  );
}

const count = (n: number | null) => (n === null ? "—" : num(n));

/** 걸린 시간: 2분 0초 · 45초. 끝 기록이 없으면 — */
function took(j: Job) {
  if (!j.finished_at) return "—";
  const s = Math.max(0, Math.round((Date.parse(j.finished_at) - Date.parse(j.started_at)) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
}

function JobRow({ job: j }: { job: Job }) {
  return (
    <tr className="border-t border-border-1">
      <td className={`${table.bodyCell} text-text-2`}>{dateTime(j.started_at)}</td>
      <td className={table.bodyCell}>
        <span className="flex flex-col">
          <span className="truncate text-text-1">{j.source_name}</span>
          <span className="truncate text-caption-12 text-text-3">
            {j.spec_id} · {j.collector_version}
          </span>
        </span>
      </td>
      <td className={`${table.bodyCell} text-text-2`}>{methodLabel[j.method]}</td>
      <td className={table.bodyCell}>
        <StatusBadge tone={jobBadge[j.status].tone}>{jobBadge[j.status].label}</StatusBadge>
      </td>
      <td className={`${table.bodyCell} text-text-2 tabular-nums`}>
        {count(j.received)} · {count(j.inserted)} · {count(j.duplicates)}
      </td>
      <td className={`${table.bodyCell} text-text-2 tabular-nums`}>{took(j)}</td>
      <td className={`${table.bodyCell} truncate text-text-2`}>{j.error_code ?? "—"}</td>
    </tr>
  );
}
