import Link from "next/link";

import type { Job, Source } from "@/shared/api";
import { monthDayTime } from "@/shared/lib/format";
import { Icon } from "@/shared/ui/icon";

import { getRecentJobs } from "../api/server";
import { HISTORY_SIZE, historyOf, lastSuccess } from "../model/history";
import { jobBadge, methodLabel, storageLabel } from "../model/labels";
import { type SourcesQuery, sourcesHref } from "../model/query";

// 출처 상태: 출처 하나 = 한 줄(이름 · 최근 HISTORY_SIZE 번 수집 점 · 마지막 성공), 두 칸으로 놓아 높이를 줄인다.
// 줄을 누르면 아래 수집 기록이 그 출처로 걸러지고(다시 누르면 풀림), 고른 출처의 기관 · 등급 · 이용 조건 · 수집 대상이
// 칸 아래 한 줄로 나온다. 점은 실행 기록일 뿐 출처 건강 판정이 아니다
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
  const picked = sources.find((s) => s.source_id === q.source) ?? null;
  return (
    <section aria-label="출처 상태" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-label-14 text-text-1">
          출처 상태{" "}
          <span className="text-caption-12 text-text-3">
            최근 {HISTORY_SIZE}번 수집 · 오른쪽이 최신
          </span>
        </h2>
        <Legend />
      </div>
      <div className="rounded-xl border border-border-1 bg-surface-1 p-1.5">
        <ul className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
          {sources.map((s) => {
            const active = q.source === s.source_id;
            const last = lastSuccess(s);
            return (
              <li key={s.source_id}>
                <Link
                  href={sourcesHref({ source: active ? null : s.source_id, status: q.status })}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`flex h-9 items-center gap-3 rounded-lg px-3 ${
                    active ? "bg-primary-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-body-13 text-text-1">{s.name}</span>
                  <History jobs={recent[s.source_id] ?? []} />
                  <span className="w-24 shrink-0 text-right text-caption-12 text-text-3 tabular-nums">
                    {last ? monthDayTime(last) : "성공 없음"}
                  </span>
                  <span className="w-3.5 shrink-0 text-text-3">
                    {active && <Icon name="close" label="거르기 풀기" className="size-3.5" />}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {picked && <PickedInfo source={picked} />}
      </div>
    </section>
  );
}

/** 고른 출처 한 줄: 기관 · 등급 · 저장 범위 · 이용 조건 · 수집 대상 */
function PickedInfo({ source: s }: { source: Source }) {
  const items: [string, string][] = [
    ["기관", s.org],
    ["등급", s.source_grade ?? "—"],
    ["저장 범위", storageLabel[s.storage_scope]],
    ["이용 조건", s.license_type],
    [
      "수집 대상",
      s.specs.length === 0
        ? "없음"
        : s.specs.map((sp) => `${sp.spec_id} (${methodLabel[sp.method]})`).join(" · "),
    ],
  ];
  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 border-t border-border-1 px-3 pt-2 pb-1 text-caption-12">
      <div className="flex gap-1.5">
        <dt className="sr-only">출처</dt>
        <dd className="text-label-12 text-text-1">{s.name}</dd>
      </div>
      {items.map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="text-text-3">{k}</dt>
          <dd className="break-all text-text-1">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 점 한 줄: 칸마다 실행 하나(시작 시각 · 상태는 title 과 화면 낭독용 글자로) */
function History({ jobs }: { jobs: Job[] }) {
  return (
    <ol className="flex shrink-0 items-center gap-0.75">
      {historyOf(jobs).map((j, i) => (
        <li
          key={j?.job_run_id ?? `empty-${i}`}
          title={j ? `${monthDayTime(j.started_at)} ${jobBadge[j.status].label}` : "기록 없음"}
          className={`h-3.5 w-1.5 rounded-sm ${j ? dotClass[j.status] : "bg-border-1"}`}
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
