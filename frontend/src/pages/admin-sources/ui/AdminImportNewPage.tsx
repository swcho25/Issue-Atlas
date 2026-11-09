import Link from "next/link";
import { Suspense } from "react";

import { getAdmins } from "@/entities/admin-user";
import { num } from "@/shared/lib/format";
import { BackIcon, backButtonClass, buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { getMe, getTemplates } from "../api/server";
import { ImportSteps } from "./SourcesNav";
import { UploadForm } from "./UploadForm";

// /admin/sources/imports/new — 07 · 데이터 소스 추가(Figma 2374:7133)의 첫 단계. 양식 1 CSV 를 올려 자동 검증한다.
// 실제 적재는 담당자가 따로 하고 결과를 보고한다(API 가 업무 DB 를 바꾸지 않는다)
export function AdminImportNewPage() {
  return (
    <main className="flex h-full flex-col gap-5 overflow-y-auto bg-bg-app px-7 pt-6 pb-10">
      <div className="flex items-center gap-3">
        <Link href="/admin/sources/imports" aria-label="CSV 요청" className={backButtonClass()}>
          <BackIcon />
        </Link>
        <span className="text-body-13 text-text-3">CSV 요청</span>
      </div>
      <h1 className="text-heading-24 text-text-1">CSV 올리기</h1>
      <ImportSteps at={1} />
      <Suspense fallback={<p className="text-body-13 text-text-3">양식을 불러오는 중이에요</p>}>
        <NewContent />
      </Suspense>
    </main>
  );
}

async function NewContent() {
  const [templates, admins, me] = await Promise.all([getTemplates(), getAdmins(), getMe()]);
  const t = templates.find((x) => x.template_id === "normalized-record") ?? templates[0];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,24rem)] items-start gap-4">
      <UploadForm admins={admins} meId={me.id} maxBytes={t?.max_bytes ?? 2 * 1024 * 1024} />
      {t && (
        <section className="flex flex-col gap-3 rounded-xl border border-border-1 bg-surface-1 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-label-13 text-text-1">양식 {t.template_version}</h2>
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
  );
}
