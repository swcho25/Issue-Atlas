import type { Job, Source } from "@/shared/api";
import { dateTime, num } from "@/shared/lib/format";
import { StatusBadge } from "@/shared/ui/badge";
import { Pager } from "@/shared/ui/pager";
import { SegmentLinks } from "@/shared/ui/segment";
import { table } from "@/shared/ui/table";

import { getJobs } from "../api/server";
import { jobBadge, methodLabel } from "../model/labels";
import { jobStatuses, PAGE_SIZE, type SourcesQuery, sourcesHref } from "../model/query";
import { SourceFilter } from "./SourceFilter";

// 수집 기록(최근 시작 순, 재실행 없음): 기본은 전체 출처, 출처 · 실행 상태로 거른다. 출처 거르기는 위 출처 상태 표의 줄과 같은 주소(?source)
export async function JobLog({ q, sources }: { q: SourcesQuery; sources: Source[] }) {
  const list = await getJobs({ status: q.status, source: q.source, page: q.page });
  return (
    <section aria-label="수집 기록" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-label-14 mr-auto text-text-1">
          수집 기록 <span className="text-caption-12 text-text-3">{num(list.total)}건</span>
        </h2>
        <SourceFilter sources={sources} value={q.source} status={q.status} />
        <SegmentLinks
          label="실행 상태"
          items={[null, ...jobStatuses].map((s) => ({
            key: s ?? "all",
            label: s ? jobBadge[s].label : "전체",
            href: sourcesHref({ source: q.source, status: s }),
            active: q.status === s,
          }))}
        />
      </div>
      {list.jobs.length === 0 ? (
        <p className="py-10 text-center text-body-13 text-text-3">수집 기록 없음</p>
      ) : (
        <JobsTable jobs={list.jobs} />
      )}
      <Pager
        page={q.page}
        size={PAGE_SIZE}
        total={list.total}
        hrefFor={(page) => sourcesHref({ source: q.source, status: q.status, page })}
      />
    </section>
  );
}

const count = (n: number | null) => (n === null ? "—" : num(n));

/** 걸린 시간: 2분 0초 · 45초. 끝 기록이 없으면 — */
function took(j: Job) {
  if (!j.finished_at) return "—";
  const s = Math.max(0, Math.round((Date.parse(j.finished_at) - Date.parse(j.started_at)) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
}

/** 수집 기록 표 */
function JobsTable({ jobs }: { jobs: Job[] }) {
  return (
    <div className={table.wrap}>
      <table className={table.box}>
        <colgroup>
          <col className="w-40" />
          <col />
          <col className="w-20" />
          <col className="w-32" />
          <col className="w-44" />
          <col className="w-24" />
          <col className="w-36" />
        </colgroup>
        <thead className={table.headRow}>
          <tr>
            <th className={table.headCell}>시작</th>
            <th className={table.headCell}>출처 · 수집 대상</th>
            <th className={table.headCell}>방식</th>
            <th className={table.headCell}>상태</th>
            <th className={table.headCell}>받음 · 새로 · 중복</th>
            <th className={table.headCell}>걸린 시간</th>
            <th className={table.headCell}>오류 코드</th>
          </tr>
        </thead>
        <tbody className="text-body-13">
          {jobs.map((j) => (
            <tr key={j.job_run_id} className="border-t border-border-1">
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
