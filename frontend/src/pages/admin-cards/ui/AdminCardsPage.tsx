import Link from "next/link";
import { Suspense } from "react";

import { href, type SearchParams } from "@/shared/lib/url";
import { StatusBadge } from "@/shared/ui/badge";
import { Pager } from "@/shared/ui/pager";
import { SegmentLinks } from "@/shared/ui/segment";

import { getAdmins } from "@/entities/admin-user";
import { dateTime, monthDay } from "@/shared/lib/format";

import {
  getApproval,
  getApprovalCounts,
  getApprovals,
  getCardChecks,
  getCardNames,
  getMe,
  getSources,
} from "../api/server";
import { approvalBadge, decisionLabel } from "../model/labels";
import { type ApprovalQuery, approvalQuery, PAGE_SIZE } from "../model/query";
import { type ApprovalRequest, approvalStatuses } from "../model/schema";
import { specName } from "../model/spec";
import { ApprovalActions } from "./ApprovalActions";
import { CardIdJump } from "./CardIdJump";
import { Block, ChecksList, ClaimBlock, EvidenceTable } from "./CardSpecBlocks";

// /admin/cards — 07 · 카드 승인(Figma 2374:7022). 왼쪽은 승인 요청 목록(상태 칸 · 건수), 오른쪽은 고른 요청.
// 관리자 카드 목록 API 는 없어(C3 는 카드 하나씩) 카드는 요청에서, 또는 카드 ID 로 연다
export function AdminCardsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main className="h-full bg-bg-app">
      <Suspense
        fallback={
          <p className="px-7 pt-6 text-body-13 text-text-3">승인 요청을 불러오는 중이에요</p>
        }
      >
        <CardsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CardsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = approvalQuery(await searchParams);
  const [list, counts] = await Promise.all([getApprovals(q), getApprovalCounts()]);
  const names = await getCardNames(list.items.map((r) => r.card_id));
  const selected = q.id ?? list.items[0]?.request_id ?? null;
  return (
    <div className="flex h-full">
      <aside className="flex w-90 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-1 px-6 pt-6 pb-8">
        <h1 className="text-heading-24 text-text-1">카드 승인</h1>
        <SegmentLinks
          label="요청 상태"
          items={approvalStatuses.map((s) => ({
            key: s,
            label: approvalBadge[s].label,
            count: counts[s],
            href: href("/admin/cards", { status: s === "pending" ? null : s }),
            active: q.status === s,
          }))}
        />
        {list.items.length === 0 ? (
          <p className="py-6 text-body-13 text-text-3">{approvalBadge[q.status].label} 요청 없음</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.items.map((r) => (
              <RequestItem
                key={r.request_id}
                request={r}
                name={names[r.card_id] ?? null}
                q={q}
                active={r.request_id === selected}
              />
            ))}
          </ul>
        )}
        <Pager
          page={q.page}
          size={PAGE_SIZE}
          total={list.total}
          hrefFor={(page) =>
            href("/admin/cards", { status: q.status === "pending" ? null : q.status, page })
          }
        />
        <CardIdJump />
      </aside>
      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-7 pt-6 pb-10 *:shrink-0">
        {selected ? (
          <Suspense
            key={selected}
            fallback={<p className="text-body-13 text-text-3">요청을 불러오는 중이에요</p>}
          >
            <RequestDetail id={selected} />
          </Suspense>
        ) : (
          <p className="text-body-13 text-text-3">고른 요청 없음</p>
        )}
      </section>
    </div>
  );
}

function RequestItem({
  request: r,
  name,
  q,
  active,
}: {
  request: ApprovalRequest;
  name: string | null;
  q: ApprovalQuery;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href("/admin/cards", {
          status: q.status === "pending" ? null : q.status,
          page: q.page > 1 ? q.page : null,
          id: r.request_id,
        })}
        aria-current={active ? "true" : undefined}
        className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 ${
          active
            ? "border-primary-line bg-primary-soft"
            : "border-border-1 bg-surface-1 hover:bg-surface-2"
        }`}
      >
        <span className="text-label-14 truncate text-text-1">{name ?? r.card_id}</span>
        <span className="truncate text-caption-12 text-text-3">
          {r.card_id} · {r.requester_name} → {r.approver_name} · {monthDay(r.created_at)}
        </span>
      </Link>
    </li>
  );
}

async function RequestDetail({ id }: { id: string }) {
  const [detail, sources, me, admins] = await Promise.all([
    getApproval(id),
    getSources(),
    getMe(),
    getAdmins(),
  ]);
  const r = detail.request;
  const open = r.status === "pending" || r.status === "on_hold";
  // 열린 요청이면 초안이 잠겨 지금 검사 = 요청 당시 초안 검사
  const checks = open ? await getCardChecks(r.card_id) : null;
  const who = (uid: number) => admins.find((u) => u.id === uid)?.name ?? `#${uid}`;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-heading-24 text-text-1">
            {specName(detail.draft_spec) ?? r.card_id}
          </h2>
          <p className="text-body-13 text-text-3">
            {r.card_id} · 초안 {r.draft_revision}번 · 공개{" "}
            {detail.current_version === null ? "없음" : `v${detail.current_version}`} ·{" "}
            {r.requester_name} → {r.approver_name} · {dateTime(r.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/cards/${encodeURIComponent(r.card_id)}`}
            className="text-label-13 text-text-2 hover:text-text-1"
          >
            카드 보기
          </Link>
          <StatusBadge tone={approvalBadge[r.status].tone}>
            {approvalBadge[r.status].label}
            {r.approved_version !== null && ` · v${r.approved_version}`}
          </StatusBadge>
        </div>
      </header>

      <Block title="요청 사유">
        <p className="text-body-14 whitespace-pre-wrap text-text-1">{r.reason}</p>
      </Block>

      {checks && checks.draft_revision === r.draft_revision && <ChecksList checks={checks} />}
      <EvidenceTable spec={detail.draft_spec} sources={sources} />
      <ClaimBlock spec={detail.draft_spec} ruleVersions={detail.indicator_versions} />

      <Block title="처리 이력">
        {detail.decisions.length === 0 ? (
          <p className="text-body-13 text-text-3">처리 이력 없음</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {detail.decisions.map((d) => (
              <li
                key={d.decision_id}
                className="flex flex-col gap-0.5 border-l-2 border-border-2 pl-3"
              >
                <p className="text-body-13 text-text-1">
                  {decisionLabel[d.decision]}
                  <span className="text-text-3">
                    {" "}
                    · {who(d.actor_id)} · {dateTime(d.created_at)}
                  </span>
                </p>
                <p className="text-body-13 text-text-2">{d.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </Block>

      {open && <ApprovalActions key={r.revision} detail={detail} meId={me.id} />}
    </>
  );
}
