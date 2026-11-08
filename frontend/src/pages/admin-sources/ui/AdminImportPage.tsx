import Link from "next/link";
import { Suspense } from "react";

import { getAdmins } from "@/entities/admin-user";
import { dateTime, num } from "@/shared/lib/format";
import { StatusBadge } from "@/shared/ui/badge";
import { BackIcon, backButtonClass, buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { getImport, getMe } from "../api/server";
import { errorLabel, importBadge } from "../model/labels";
import type { ImportDetail } from "../model/schema";
import { FinishForm } from "./FinishForm";
import { ImportSteps } from "./SourcesNav";

// /admin/sources/imports/[id] — CSV 요청 하나: 자동 검증 결과(오류 · 중복 행) · 원본 내려받기 · 담당자 결과 보고
export function AdminImportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="h-full bg-bg-app">
      <Suspense
        fallback={
          <p className="px-7 pt-6 text-body-13 text-text-3">CSV 요청을 불러오는 중이에요</p>
        }
      >
        <ImportContent params={params} />
      </Suspense>
    </main>
  );
}

/** 지금 단계: 검증에서 끝난 요청(실패 · 새 행 없음)은 2, 적재 대기는 3, 보고까지 끝나면 4 */
const stepOf = (d: ImportDetail) =>
  d.request.status === "pending"
    ? 3
    : d.request.status === "completed" || d.request.status === "failed"
      ? 4
      : 2;

async function ImportContent({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const [detail, admins, me] = await Promise.all([getImport(id), getAdmins(), getMe()]);
  const r = detail.request;
  const v = r.validation;
  const who = (uid: number) => admins.find((u) => u.id === uid)?.name ?? `#${uid}`;
  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-7 pt-6 pb-10 *:shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/sources/imports" aria-label="CSV 요청" className={backButtonClass()}>
            <BackIcon />
          </Link>
          <span className="text-body-13 text-text-3">CSV 요청</span>
        </div>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-heading-24 break-all text-text-1">{r.file_name}</h1>
            <p className="text-body-13 text-text-3">
              {who(r.requested_by)} → {who(r.assignee_id)} · {dateTime(r.created_at)} · 양식{" "}
              {r.template_version} · {r.file_sha256.slice(0, 12)}
            </p>
          </div>
          <StatusBadge tone={importBadge[r.status].tone}>{importBadge[r.status].label}</StatusBadge>
        </header>
        <ImportSteps at={stepOf(detail)} />

        <section className="flex flex-col gap-3 rounded-xl border border-border-1 bg-surface-1 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-label-13 text-text-1">자동 검증</h2>
            <a
              href={`/api/v1/admin/imports/${encodeURIComponent(r.import_id)}/file`}
              className={buttonClass({ variant: "ghost", size: "s" })}
            >
              <Icon name="download" />
              원본 내려받기
            </a>
          </div>
          <dl className="grid grid-cols-5 gap-3">
            {(
              [
                ["전체 행", v.total_rows],
                ["통과", v.valid_rows],
                ["중복", v.duplicate_rows],
                ["적재 대상", v.eligible_rows],
                ["오류", v.error_count],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2.5"
              >
                <dt className="text-caption-12 text-text-3">{label}</dt>
                <dd
                  className={`text-heading-20 tabular-nums ${
                    label === "오류" && n > 0 ? "text-status-red" : "text-text-1"
                  }`}
                >
                  {num(n)}
                </dd>
              </div>
            ))}
          </dl>
          {v.duplicate_row_numbers.length > 0 && (
            <p className="text-body-13 text-text-2">중복 행 {v.duplicate_row_numbers.join(", ")}</p>
          )}
          {v.errors.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border-1">
              <table className="w-full table-fixed text-left text-body-13">
                <colgroup>
                  <col className="w-20" />
                  <col className="w-48" />
                  <col />
                </colgroup>
                <thead className="bg-surface-2 text-caption-11 text-text-3">
                  <tr>
                    <th className="px-3 py-2 font-normal">행</th>
                    <th className="px-3 py-2 font-normal">칸</th>
                    <th className="px-3 py-2 font-normal">오류</th>
                  </tr>
                </thead>
                <tbody>
                  {v.errors.map((e, i) => (
                    <tr key={i} className="border-t border-border-1">
                      <td className="px-3 py-1.5 text-text-2 tabular-nums">{e.row}</td>
                      <td className="px-3 py-1.5 font-mono text-caption-12 text-text-2">
                        {e.column ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-text-1">
                        {errorLabel(e.code)}
                        <span className="text-caption-12 text-text-3"> {e.code}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {v.errors_truncated && (
                <p className="border-t border-border-1 px-3 py-2 text-caption-12 text-text-3">
                  오류 {num(v.error_count)}개 중 {v.errors.length}개
                </p>
              )}
            </div>
          )}
        </section>

        {detail.result && (
          <section className="flex flex-col gap-2 rounded-xl border border-border-1 bg-surface-1 p-4">
            <h2 className="text-label-13 text-text-1">결과 보고</h2>
            <p className="text-body-13 text-text-1">
              {detail.result.status === "completed" ? "완료" : "실패"} · 적재{" "}
              {num(detail.result.loaded_rows)} · 건너뜀 {num(detail.result.skipped_rows)}
              <span className="text-text-3">
                {" "}
                · {who(detail.result.actor_id)} · {dateTime(detail.result.created_at)}
              </span>
            </p>
            <p className="text-body-13 whitespace-pre-wrap text-text-2">{detail.result.reason}</p>
          </section>
        )}
      </section>
      {r.status === "pending" && (
        <FinishForm
          key={r.revision}
          detail={detail}
          meId={me.id}
          assigneeName={who(r.assignee_id)}
        />
      )}
    </div>
  );
}
