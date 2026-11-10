import Link from "next/link";

import { getAdmins } from "@/entities/admin-user";
import { dateTime, num } from "@/shared/lib/format";
import { StatusBadge } from "@/shared/ui/badge";
import { buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { getImport, getImports, getTemplates } from "../api/server";
import { errorLabel, importBadge } from "../model/labels";
import { type SourcesQuery, sourcesHref } from "../model/query";
import type { ImportDetail } from "../model/schema";
import { FinishForm } from "./FinishForm";
import { ImportSteps } from "./ImportSteps";
import { UploadForm } from "./UploadForm";

// CSV 요청 보기의 오른쪽: 올리기 양식(?new) · 고른 요청(검증 결과 · 결과 보고) · 아무것도 없으면 내 차례
export async function ImportPanel({ q, me }: { q: SourcesQuery; me: { id: number } }) {
  if (q.isNew) return <NewImport meId={me.id} />;
  if (q.id) return <ImportView id={q.id} meId={me.id} />;
  return <MyTurn meId={me.id} />;
}

/** 내 차례: 내가 반영 담당자인 반영 대기 요청 */
async function MyTurn({ meId }: { meId: number }) {
  const list = await getImports({ status: "pending", assignee: meId, page: 1 });
  return (
    <>
      <header className="flex flex-col gap-1">
        <h2 className="text-heading-24 text-text-1">내 차례</h2>
        <p className="text-body-13 text-text-3">반영 담당자가 나인 반영 대기 요청</p>
      </header>
      {list.items.length === 0 ? (
        <p className="py-10 text-center text-body-13 text-text-3">내 차례인 요청 없음</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.items.map((r) => (
            <li key={r.import_id}>
              <Link
                href={sourcesHref({ view: "imports", id: r.import_id })}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-1 bg-surface-1 px-4 py-3 hover:bg-surface-2"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-label-14 truncate text-text-1">{r.file_name}</span>
                  <span className="text-caption-12 text-text-3">
                    {dateTime(r.created_at)} · 반영 대상 {num(r.validation.eligible_rows)}행
                  </span>
                </span>
                <StatusBadge tone={importBadge[r.status].tone}>
                  {importBadge[r.status].label}
                </StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** 07 · 데이터 소스 추가(Figma 2374:7133)의 첫 단계. 양식 1 CSV 를 올려 자동 검증한다(업무 DB 는 반영 담당자가 따로) */
async function NewImport({ meId }: { meId: number }) {
  const [templates, admins] = await Promise.all([getTemplates(), getAdmins()]);
  const t = templates.find((x) => x.template_id === "normalized-record") ?? templates[0];
  return (
    <>
      <h2 className="text-heading-24 text-text-1">CSV 올리기</h2>
      <ImportSteps at={1} />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start gap-4">
        <UploadForm admins={admins} meId={meId} maxBytes={t?.max_bytes ?? 2 * 1024 * 1024} />
        {t && (
          <section className="flex flex-col gap-3 rounded-xl border border-border-1 bg-surface-1 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-label-13 text-text-1">양식 {t.template_version}</h3>
              <span className="text-caption-12 text-text-3">
                최대 {num(t.max_rows)}행 · {Math.round(t.max_bytes / 1024 / 1024)} MiB
              </span>
            </div>
            <ol className="flex flex-wrap gap-1.5">
              {t.columns.map((c) => (
                <li
                  key={c}
                  className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-caption-12 text-text-2"
                >
                  {c}
                </li>
              ))}
            </ol>
            {/* 같은 출처 rewrites 로 세션 쿠키가 실린다 */}
            <a
              href="/api/v1/admin/import-templates/normalized-record/file"
              className={buttonClass({ variant: "secondary", className: "self-start" })}
            >
              <Icon name="download" />
              양식 내려받기
            </a>
          </section>
        )}
      </div>
    </>
  );
}

/** 지금 단계: 검증에서 끝난 요청(검증 오류 · 변경 없음)은 2, 반영 대기는 3, 보고까지 끝나면 4 */
const stepOf = (d: ImportDetail) =>
  d.request.status === "pending"
    ? 3
    : d.request.status === "completed" || d.request.status === "failed"
      ? 4
      : 2;

/** CSV 요청 하나: 자동 검증 결과(오류 · 중복 행) · 원본 내려받기 · 결과 보고 */
async function ImportView({ id, meId }: { id: string; meId: number }) {
  const [detail, admins] = await Promise.all([getImport(id), getAdmins()]);
  const r = detail.request;
  const v = r.validation;
  const who = (uid: number) =>
    `${admins.find((u) => u.id === uid)?.name ?? `#${uid}`}${uid === meId ? " (나)" : ""}`;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-heading-24 break-all text-text-1">{r.file_name}</h2>
          <p className="text-body-13 text-text-3">
            {who(r.requested_by)} 올림 · {dateTime(r.created_at)} · 반영 담당자 {who(r.assignee_id)}
          </p>
        </div>
        <StatusBadge tone={importBadge[r.status].tone}>{importBadge[r.status].label}</StatusBadge>
      </header>
      <ImportSteps at={stepOf(detail)} />

      <section className="flex flex-col gap-3 rounded-xl border border-border-1 bg-surface-1 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-label-13 text-text-1">자동 검증</h3>
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
              ["반영 대상", v.eligible_rows],
              ["오류", v.error_count],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2.5">
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
          <h3 className="text-label-13 text-text-1">결과 보고</h3>
          <p className="text-body-13 text-text-1">
            {detail.result.status === "completed" ? "반영 완료" : "반영 실패"} · 반영{" "}
            {num(detail.result.loaded_rows)}행 · 건너뜀 {num(detail.result.skipped_rows)}행
            <span className="text-text-3">
              {" "}
              · {who(detail.result.actor_id)} · {dateTime(detail.result.created_at)}
            </span>
          </p>
          <p className="text-body-13 whitespace-pre-wrap text-text-2">{detail.result.reason}</p>
        </section>
      )}
      {r.status === "pending" && (
        <FinishForm
          key={r.revision}
          detail={detail}
          meId={meId}
          assigneeName={who(r.assignee_id)}
        />
      )}
    </>
  );
}
