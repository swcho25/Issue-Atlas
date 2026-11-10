import Link from "next/link";

import type { Job, Source } from "@/shared/api";
import { dateTime, monthDayTime, num } from "@/shared/lib/format";
import { StatusBadge } from "@/shared/ui/badge";
import { buttonClass } from "@/shared/ui/button";
import { Pager } from "@/shared/ui/pager";
import { SegmentLinks } from "@/shared/ui/segment";
import { table } from "@/shared/ui/table";

import { getJobs } from "../api/server";
import { jobBadge, methodLabel, storageLabel } from "../model/labels";
import { jobStatuses, PAGE_SIZE, type SourcesQuery, sourcesHref } from "../model/query";

// 출처 보기의 오른쪽: 고른 출처가 없으면 전체 수집 기록(최근 시작 순), 있으면 그 출처 정보 + 그 출처의 수집 기록.
// 수집 기록은 실행 상태로 거르고, 재실행은 없다
export async function SourcePanel({ q, sources }: { q: SourcesQuery; sources: Source[] }) {
  const source = q.source ? (sources.find((s) => s.source_id === q.source) ?? null) : null;
  const list = await getJobs({ status: q.status, source: q.source, page: q.page });
  return (
    <>
      {source ? (
        <SourceInfo source={source} />
      ) : (
        <header className="flex flex-col gap-1">
          <h2 className="text-heading-24 text-text-1">최근 수집 기록</h2>
          <p className="text-body-13 text-text-3">전체 출처 · 최근 시작 순</p>
        </header>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {source && <h3 className="text-label-14 text-text-1">이 출처의 수집 기록</h3>}
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
        <JobsTable jobs={list.jobs} withSource={!source} />
      )}
      <Pager
        page={q.page}
        size={PAGE_SIZE}
        total={list.total}
        hrefFor={(page) => sourcesHref({ source: q.source, status: q.status, page })}
      />
    </>
  );
}

/** 고른 출처: 등급 · 이용 조건 · 저장 범위 · 수집 대상(명세마다 방식 · 마지막 성공) */
function SourceInfo({ source: s }: { source: Source }) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-heading-24 text-text-1">{s.name}</h2>
          <p className="text-body-13 text-text-3">
            {s.org} · {s.source_id}
          </p>
        </div>
        <Link href={sourcesHref({})} className={buttonClass({ variant: "secondary", size: "s" })}>
          전체 기록 보기
        </Link>
      </header>
      <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-xl border border-border-1 bg-surface-1 p-4 text-body-13">
        <dt className="text-text-3">출처 등급</dt>
        <dd className="text-text-1">{s.source_grade ?? "—"}</dd>
        <dt className="text-text-3">이용 조건</dt>
        <dd className="break-all text-text-1">{s.license_type}</dd>
        <dt className="text-text-3">저장 범위</dt>
        <dd className="text-text-1">{storageLabel[s.storage_scope]}</dd>
        <dt className="text-text-3">수집 대상</dt>
        <dd>
          {s.specs.length === 0 ? (
            <span className="text-text-3">없음</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {s.specs.map((sp) => (
                <li key={sp.spec_id} className="flex flex-wrap gap-x-2">
                  <span className="break-all text-text-1">{sp.spec_id}</span>
                  <span className="text-text-3">
                    {methodLabel[sp.method]} ·{" "}
                    {sp.last_success_at
                      ? `마지막 성공 ${monthDayTime(sp.last_success_at)}`
                      : "성공 기록 없음"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
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

/** 수집 기록 표. 전체 기록이면 출처 칸을 두고, 한 출처면 수집 대상만 */
function JobsTable({ jobs, withSource }: { jobs: Job[]; withSource: boolean }) {
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
            <th className={table.headCell}>{withSource ? "출처 · 수집 대상" : "수집 대상"}</th>
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
                {withSource ? (
                  <span className="flex flex-col">
                    <span className="truncate text-text-1">{j.source_name}</span>
                    <span className="truncate text-caption-12 text-text-3">
                      {j.spec_id} · {j.collector_version}
                    </span>
                  </span>
                ) : (
                  <span className="flex flex-col">
                    <span className="truncate text-text-1">{j.spec_id}</span>
                    <span className="truncate text-caption-12 text-text-3">
                      {j.collector_version}
                    </span>
                  </span>
                )}
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
