import Link from "next/link";
import { Suspense } from "react";

import { dateTime } from "@/shared/lib/format";
import { href } from "@/shared/lib/url";
import { StatusBadge } from "@/shared/ui/badge";
import { BackIcon, backButtonClass } from "@/shared/ui/button";

import {
  getAdmins,
  getCardApprovals,
  getCardChecks,
  getCardDraft,
  getCardRevisions,
  getCardVersion,
  getMe,
  getSources,
} from "../api/server";
import { approvalBadge, cardBadge } from "../model/labels";
import { specClaim, specName } from "../model/spec";
import { Block, ChecksList, ClaimBlock, EvidenceTable } from "./CardSpecBlocks";
import { RequestApprovalForm } from "./RequestApprovalForm";

// /admin/cards/[id] — 카드 하나: 공개 상태 · 초안 검사 · 근거 · 판단 · 버전 이력 · 이 카드의 승인 요청, 오른쪽은 승인 요청 보내기
export function AdminCardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="h-full bg-bg-app">
      <Suspense
        fallback={<p className="px-7 pt-6 text-body-13 text-text-3">카드를 불러오는 중이에요</p>}
      >
        <CardContent params={params} />
      </Suspense>
    </main>
  );
}

async function CardContent({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const draft = await getCardDraft(id);
  const [checks, revisions, approvals, sources, admins, me, published] = await Promise.all([
    getCardChecks(id),
    getCardRevisions(id),
    getCardApprovals(id),
    getSources(),
    getAdmins(),
    getMe(),
    draft.current_version === null ? null : getCardVersion(id, draft.current_version),
  ]);
  const spec = draft.draft_spec;
  const claim = specClaim(spec);
  const openRequest = approvals.find((r) => r.status === "pending" || r.status === "on_hold");
  const blocked = openRequest
    ? `열린 요청 있음 · ${approvalBadge[openRequest.status].label}`
    : published?.draft_revision === draft.draft_revision
      ? `초안 ${draft.draft_revision}번은 v${published.version} 로 승인됨`
      : !checks.valid
        ? "작성 기준 미달"
        : null;

  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-7 pt-6 pb-10 *:shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/cards" aria-label="카드 승인" className={backButtonClass()}>
            <BackIcon />
          </Link>
          <span className="text-body-13 text-text-3">카드 승인</span>
        </div>
        <header className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone={cardBadge[draft.status].tone}>
              {cardBadge[draft.status].label}
            </StatusBadge>
            {claim.domain && <StatusBadge tone="gray">{claim.domain}</StatusBadge>}
          </div>
          <h1 className="text-heading-24 text-text-1">{specName(spec) ?? id}</h1>
          <p className="text-body-13 text-text-3">
            {id} · 공개 {draft.current_version === null ? "없음" : `v${draft.current_version}`} ·
            초안 {draft.draft_revision}번{claim.parentQuestion && ` · ${claim.parentQuestion}`}
          </p>
        </header>

        <ChecksList checks={checks} />
        <EvidenceTable spec={spec} sources={sources} />
        <ClaimBlock spec={spec} />

        <Block title="버전 이력">
          {revisions.length === 0 ? (
            <p className="text-body-13 text-text-3">승인 이력 없음</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {revisions.map((v) => (
                <li
                  key={v.revision_id}
                  className="flex flex-col gap-0.5 border-l-2 border-border-2 pl-3"
                >
                  <p className="text-body-13 text-text-1">
                    v{v.from_version} → v{v.to_version}
                    <span className="text-text-3">
                      {" "}
                      · {v.approved_by} · {dateTime(v.created_at)}
                    </span>
                  </p>
                  <p className="text-body-13 text-text-2">{v.reason}</p>
                </li>
              ))}
            </ol>
          )}
        </Block>

        <Block title="승인 요청">
          {approvals.length === 0 ? (
            <p className="text-body-13 text-text-3">요청 없음</p>
          ) : (
            <ul className="flex flex-col">
              {approvals.map((r) => (
                <li key={r.request_id} className="border-t border-border-1 first:border-t-0">
                  <Link
                    href={href("/admin/cards", {
                      status: r.status === "pending" ? null : r.status,
                      id: r.request_id,
                    })}
                    className="flex items-center gap-3 py-2 text-body-13 hover:text-text-1"
                  >
                    <StatusBadge tone={approvalBadge[r.status].tone}>
                      {approvalBadge[r.status].label}
                    </StatusBadge>
                    <span className="min-w-0 flex-1 truncate text-text-1">{r.reason}</span>
                    <span className="shrink-0 text-text-3">
                      초안 {r.draft_revision}번 · {r.approver_name} · {dateTime(r.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </section>
      <RequestApprovalForm
        key={draft.draft_revision}
        cardId={id}
        draftRevision={draft.draft_revision}
        admins={admins}
        meId={me.id}
        blocked={blocked}
      />
    </div>
  );
}
