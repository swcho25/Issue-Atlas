import Link from "next/link";
import { Suspense } from "react";

import { getAdmins } from "@/entities/admin-user";
import { dateTime, num } from "@/shared/lib/format";
import { href, type SearchParams } from "@/shared/lib/url";
import { StatusBadge } from "@/shared/ui/badge";
import { buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Pager } from "@/shared/ui/pager";
import { SegmentLinks } from "@/shared/ui/segment";
import { table } from "@/shared/ui/table";

import { getImportCounts, getImports, getJobTotal, getSources } from "../api/server";
import { importBadge } from "../model/labels";
import { importQuery, PAGE_SIZE } from "../model/query";
import { importStatuses } from "../model/schema";
import { SourcesNav } from "./SourcesNav";

// /admin/sources/imports — CSV 요청 목록(올린 순). 상태로 거르고, 줄을 누르면 검증 결과 · 결과 보고
export function AdminImportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main className="flex h-full flex-col gap-4 overflow-y-auto bg-bg-app px-7 pt-6 pb-10">
      <Suspense fallback={<p className="text-body-13 text-text-3">CSV 요청을 불러오는 중이에요</p>}>
        <ImportsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ImportsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = importQuery(await searchParams);
  const [list, counts, sources, jobTotal, admins] = await Promise.all([
    getImports(q),
    getImportCounts(),
    getSources(),
    getJobTotal(),
    getAdmins(),
  ]);
  const who = (id: number) => admins.find((u) => u.id === id)?.name ?? `#${id}`;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-heading-24 text-text-1">데이터 소스</h1>
        <Link href="/admin/sources/imports/new" className={buttonClass()}>
          <Icon name="plus" />
          CSV 올리기
        </Link>
      </header>
      <SourcesNav
        current="imports"
        counts={{ sources: sources.length, jobs: jobTotal, imports: counts.all }}
      />
      <SegmentLinks
        label="요청 상태"
        items={[null, ...importStatuses].map((s) => ({
          key: s ?? "all",
          label: s ? importBadge[s].label : "전체",
          count: s ? counts[s] : counts.all,
          href: href("/admin/sources/imports", { status: s }),
          active: q.status === s,
        }))}
      />
      {list.items.length === 0 ? (
        <p className="py-10 text-center text-body-13 text-text-3">CSV 요청 없음</p>
      ) : (
        <div className={table.wrap}>
          <table className={table.box}>
            <colgroup>
              <col className="w-40" />
              <col />
              <col className="w-64" />
              <col className="w-56" />
              <col className="w-32" />
            </colgroup>
            <thead className={table.headRow}>
              <tr>
                <th className={table.headCell}>올림</th>
                <th className={table.headCell}>파일</th>
                <th className={table.headCell}>올린 사람 → 담당자</th>
                <th className={table.headCell}>행 (전체 · 적재 대상 · 오류)</th>
                <th className={table.headCell}>상태</th>
              </tr>
            </thead>
            <tbody className="text-body-13">
              {list.items.map((r) => (
                <tr
                  key={r.import_id}
                  className="relative border-t border-border-1 hover:bg-surface-2"
                >
                  <td className={`${table.bodyCell} text-text-2`}>{dateTime(r.created_at)}</td>
                  <td className={table.bodyCell}>
                    <Link
                      href={`/admin/sources/imports/${encodeURIComponent(r.import_id)}`}
                      className="block truncate text-text-1 after:absolute after:inset-0"
                    >
                      {r.file_name}
                    </Link>
                  </td>
                  <td className={`${table.bodyCell} truncate text-text-2`}>
                    {who(r.requested_by)} → {who(r.assignee_id)}
                  </td>
                  <td className={`${table.bodyCell} text-text-2 tabular-nums`}>
                    {num(r.validation.total_rows)} · {num(r.validation.eligible_rows)} ·{" "}
                    {num(r.validation.error_count)}
                  </td>
                  <td className={table.bodyCell}>
                    <StatusBadge tone={importBadge[r.status].tone}>
                      {importBadge[r.status].label}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={q.page}
        size={PAGE_SIZE}
        total={list.total}
        hrefFor={(page) => href("/admin/sources/imports", { status: q.status, page })}
      />
    </>
  );
}
