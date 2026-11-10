import Link from "next/link";
import { Suspense } from "react";

import { countPendingFor } from "@/entities/csv-import";
import type { SearchParams } from "@/shared/lib/url";
import { buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { SegmentLinks } from "@/shared/ui/segment";

import { getImports, getMe, getSources } from "../api/server";
import { sourcesHref, sourcesQuery } from "../model/query";
import { ImportPanel } from "./ImportPanel";
import { JobLog } from "./JobLog";
import { SourceStatus } from "./SourceStatus";

// /admin/sources — 07 · 데이터 소스 한 화면(위에서 아래로 한 줄). 출처 보기는 출처 상태(출처마다 최근 수집 점 줄) 아래에
// 수집 기록(기본 전체, 출처 · 실행 상태로 거르기), CSV 업로드 보기는 업로드 표 → 업로드 하나 · 올리기 양식. 상태는 모두 주소에 둔다
export function AdminSourcesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main className="flex h-full flex-col gap-6 overflow-y-auto bg-bg-app px-7 pt-6 pb-10 *:shrink-0">
      <Suspense
        fallback={<p className="text-body-13 text-text-3">데이터 소스를 불러오는 중이에요</p>}
      >
        <SourcesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SourcesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = sourcesQuery(await searchParams);
  const [sources, me, all] = await Promise.all([
    getSources(),
    getMe(),
    getImports({ page: 1, size: 1 }),
  ]);
  const mine = await countPendingFor(me.id);
  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-heading-24 text-text-1">데이터 소스</h1>
        <SegmentLinks
          label="보기"
          items={[
            {
              key: "sources",
              label: "출처",
              count: sources.length,
              href: sourcesHref({}),
              active: q.view === "sources",
            },
            {
              key: "imports",
              label: "CSV 업로드",
              count: all.total,
              href: sourcesHref({ view: "imports" }),
              active: q.view === "imports",
            },
          ]}
        />
        {/* CSV 업로드 보기에는 「전체 · 처리 필요」 칸이 있어 출처 보기에서만 */}
        {q.view === "sources" && mine > 0 && (
          <Link
            href={sourcesHref({ view: "imports", mine: true })}
            className="flex items-center gap-1.5 text-label-13 text-primary-text hover:underline"
          >
            {/* 왼쪽 띠 「데이터 소스」 알림 점과 같은 빨간 점 */}
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-status-red" />
            CSV 처리 필요 {mine}
          </Link>
        )}
        <Link
          href={sourcesHref({ view: "imports", isNew: true })}
          className={buttonClass({ className: "ml-auto" })}
        >
          <Icon name="plus" />
          CSV 올리기
        </Link>
      </header>
      {q.view === "sources" ? (
        <>
          <SourceStatus sources={sources} q={q} />
          <Suspense
            key={`${q.source}:${q.status}:${q.page}`}
            fallback={<p className="text-body-13 text-text-3">수집 기록을 불러오는 중이에요</p>}
          >
            <JobLog q={q} sources={sources} />
          </Suspense>
        </>
      ) : (
        <Suspense
          fallback={<p className="text-body-13 text-text-3">CSV 업로드를 불러오는 중이에요</p>}
        >
          <ImportPanel q={q} me={me} mineTotal={mine} allTotal={all.total} />
        </Suspense>
      )}
    </>
  );
}
