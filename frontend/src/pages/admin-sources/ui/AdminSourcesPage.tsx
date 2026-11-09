import Link from "next/link";
import { Suspense } from "react";

import { monthDayTime } from "@/shared/lib/format";
import { href } from "@/shared/lib/url";
import { StatusBadge } from "@/shared/ui/badge";
import { table } from "@/shared/ui/table";

import { getImports, getJobTotal, getLatestJobs, getSources } from "../api/server";
import { jobBadge, methodLabel, storageLabel } from "../model/labels";
import { SourcesNav } from "./SourcesNav";

// /admin/sources — 07 · 데이터 소스: 출처마다 등급 · 이용 조건 · 저장 범위 · 수집 명세(마지막 성공) · 가장 최근 실행.
// 줄을 누르면 그 출처의 수집 이력
export function AdminSourcesPage() {
  return (
    <main className="flex h-full flex-col gap-4 overflow-y-auto bg-bg-app px-7 pt-6 pb-10">
      <Suspense fallback={<p className="text-body-13 text-text-3">출처를 불러오는 중이에요</p>}>
        <SourcesContent />
      </Suspense>
    </main>
  );
}

async function SourcesContent() {
  const [sources, jobTotal, imports] = await Promise.all([
    getSources(),
    getJobTotal(),
    getImports({ status: null, page: 1 }),
  ]);
  const latest = await getLatestJobs(sources.map((s) => s.source_id));
  return (
    <>
      <h1 className="text-heading-24 text-text-1">데이터 소스</h1>
      <SourcesNav
        current="sources"
        counts={{ sources: sources.length, jobs: jobTotal, imports: imports.total }}
      />
      <div className={table.wrap}>
        <table className={table.box}>
          <colgroup>
            <col className="w-64" />
            <col className="w-40" />
            <col className="w-28" />
            <col className="w-16" />
            <col />
            <col className="w-36" />
          </colgroup>
          <thead className={table.headRow}>
            <tr>
              <th className={table.headCell}>출처</th>
              <th className={table.headCell}>이용 조건</th>
              <th className={table.headCell}>저장 범위</th>
              <th className={table.headCell}>등급</th>
              <th className={table.headCell}>수집 명세</th>
              <th className={table.headCell}>최근 실행</th>
            </tr>
          </thead>
          <tbody className="text-body-13">
            {sources.map((s) => {
              const job = latest[s.source_id];
              return (
                <tr
                  key={s.source_id}
                  className="relative border-t border-border-1 align-top hover:bg-surface-2"
                >
                  <td className={table.bodyCell}>
                    <Link
                      href={href("/admin/sources/jobs", { source: s.source_id })}
                      className="flex flex-col after:absolute after:inset-0"
                    >
                      <span className="text-text-1">{s.name}</span>
                      <span className="text-caption-12 text-text-3">
                        {s.source_id} · {s.org}
                      </span>
                    </Link>
                  </td>
                  <td className={`${table.bodyCell} break-all text-text-2`}>{s.license_type}</td>
                  <td className={`${table.bodyCell} text-text-2`}>
                    {storageLabel[s.storage_scope]}
                  </td>
                  <td className={`${table.bodyCell} text-text-2`}>{s.source_grade ?? "—"}</td>
                  <td className={table.bodyCell}>
                    {s.specs.length === 0 ? (
                      <span className="text-text-3">명세 없음</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {s.specs.map((sp) => (
                          <li key={sp.spec_id} className="flex flex-wrap gap-x-2 text-text-2">
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
                  </td>
                  <td className={table.bodyCell}>
                    {job ? (
                      <span className="flex flex-col items-start gap-1">
                        <StatusBadge tone={jobBadge[job.status].tone}>
                          {jobBadge[job.status].label}
                        </StatusBadge>
                        <span className="text-caption-12 text-text-3">
                          {monthDayTime(job.started_at)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-text-3">기록 없음</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
