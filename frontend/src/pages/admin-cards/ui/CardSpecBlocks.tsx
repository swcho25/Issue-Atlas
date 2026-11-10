import type { Source } from "@/shared/api";
import { StatusBadge } from "@/shared/ui/badge";
import { Icon } from "@/shared/ui/icon";

import { kindLabel, specStateBadge } from "../model/labels";
import type { Checks, Spec } from "../model/schema";
import { ruleOutcomes, specClaim, specEvidence, specState } from "../model/spec";

// 카드 승인 · 카드별 화면이 함께 쓰는 초안 읽기 칸: 작성 기준 검사 · 근거 4종 · 판단 문장과 보증 · 경쟁 설명

export function Block({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border-1 bg-surface-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-label-13 text-text-1">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** 작성 기준 검사 10개(card_spec_check). 통과는 초록 체크, 못 미친 칸은 앰버 경고 */
export function ChecksList({ checks }: { checks: Checks }) {
  const failed = checks.checks.filter((c) => !c.ok).length;
  return (
    <Block
      title="작성 기준"
      aside={
        <span className="text-caption-12 text-text-3">
          {failed ? `${failed}개 미달` : "모두 통과"} · 초안 {checks.draft_revision}번
        </span>
      }
    >
      <ul className="grid grid-cols-2 gap-x-8 gap-y-2">
        {checks.checks.map((c) => (
          <li key={c.check_no} className="flex items-start gap-2 text-body-13 text-text-1">
            <Icon
              name={c.ok ? "check" : "alert"}
              className={`mt-0.5 size-4 shrink-0 ${c.ok ? "text-status-green" : "text-status-amber"}`}
            />
            <span className="sr-only">{c.ok ? "통과" : "미달"}</span>
            {c.label}
          </li>
        ))}
      </ul>
    </Block>
  );
}

/** 근거 4종: 종류 · 필수/선택 · 소스(명세) · 지금 확보 상태 · 출처 등급 */
export function EvidenceTable({ spec, sources }: { spec: Spec; sources: Source[] }) {
  const rows = specEvidence(spec).flatMap((g) =>
    (g.items.length ? g.items : [null]).map((item, i) => ({ g, item, first: i === 0 })),
  );
  const cell = "px-4 py-2.5 align-top";
  return (
    <div className="overflow-x-auto rounded-xl border border-border-1 bg-surface-1">
      <table className="w-full min-w-200 table-fixed text-left text-body-13">
        <colgroup>
          <col className="w-32" />
          <col />
          <col className="w-28" />
          <col className="w-16" />
        </colgroup>
        <thead className="bg-surface-2 text-caption-11 text-text-3">
          <tr>
            <th className={`${cell} font-normal`}>근거 종류</th>
            <th className={`${cell} font-normal`}>소스</th>
            <th className={`${cell} font-normal`}>상태</th>
            <th className={`${cell} font-normal`}>등급</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ g, item, first }, i) => {
            const { state, source } = specState(item?.specId ?? null, sources);
            return (
              <tr key={i} className={first ? "border-t border-border-1" : ""}>
                <th scope="row" className={`${cell} font-normal`}>
                  {first && (
                    <span className="flex flex-col">
                      <span className="text-text-1">{kindLabel[g.kind]}</span>
                      <span className="text-caption-11 text-text-3">
                        {g.required ? "필수" : "선택"}
                      </span>
                    </span>
                  )}
                </th>
                <td className={cell}>
                  {item ? (
                    <span className="flex flex-col gap-0.5">
                      <span className="break-all text-text-1">
                        {source?.name ?? item.specId ?? "소스 없음"}
                        {item.specId && (
                          <span className="text-caption-11 text-text-3"> {item.specId}</span>
                        )}
                      </span>
                      {(item.indicatorId || item.note) && (
                        <span className="text-caption-12 text-text-3">
                          {[item.indicatorId, item.note].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-text-3">비어 있음</span>
                  )}
                </td>
                <td className={cell}>
                  {item && (
                    <StatusBadge tone={specStateBadge[state].tone}>
                      {specStateBadge[state].label}
                    </StatusBadge>
                  )}
                </td>
                <td className={`${cell} text-text-2`}>{source?.source_grade ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 판단 틀 · 결과별 문장 · 보증 · 경쟁 설명 · 판단하지 않는 것 · 지표(요청 당시 규칙 버전이 있으면 함께).
 * 결과별 문장은 주 지표의 규칙(rule)에서 — 화면 ① 문장이 결과마다 무엇으로 나가는지 승인하는 사람이 본다
 */
export function ClaimBlock({
  spec,
  rule,
  ruleVersions,
}: {
  spec: Spec;
  rule?: unknown;
  ruleVersions?: Record<string, number>;
}) {
  const c = specClaim(spec);
  const outcomes = ruleOutcomes(rule, c.template);
  const row = "grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-body-13";
  return (
    <Block title="판단">
      <dl className="flex flex-col gap-2.5">
        <div className={row}>
          <dt className="text-text-3">판단 틀</dt>
          <dd className="text-text-1">{c.template ?? "—"}</dd>
        </div>
        <div className={row}>
          <dt className="text-text-3">결과별 문장</dt>
          <dd>
            {outcomes.length ? (
              <ul className="flex flex-col gap-1.5">
                {outcomes.map((o) => (
                  <li key={o.label} className="flex flex-col gap-0.5">
                    <span className="text-label-12 text-text-2">{o.label}</span>
                    <span className="text-text-1">{o.text ?? "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-text-1">—</span>
            )}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-text-3">지표</dt>
          <dd className="flex flex-col gap-0.5 text-text-1">
            {c.indicators.length
              ? c.indicators.map((x) => (
                  <span key={x.id}>
                    {x.id}
                    <span className="text-caption-12 text-text-3">
                      {" "}
                      {x.role === "main" ? "주" : "보조"}
                      {ruleVersions?.[x.id] !== undefined && ` · 규칙 ${ruleVersions[x.id]}`}
                    </span>
                  </span>
                ))
              : "—"}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-text-3">보증</dt>
          <dd className="text-text-1">{c.warrant ?? "—"}</dd>
        </div>
        <div className={row}>
          <dt className="text-text-3">경쟁 설명 {c.rebuttals.length}</dt>
          <dd>
            <ol className="flex flex-col gap-1 text-text-1">
              {c.rebuttals.map((r, i) => (
                <li key={r.id ?? i}>{r.text}</li>
              ))}
            </ol>
          </dd>
        </div>
        <div className={row}>
          <dt className="text-text-3">판단하지 않음</dt>
          <dd className="text-text-1">{c.ceiling.length ? c.ceiling.join(" · ") : "—"}</dd>
        </div>
      </dl>
    </Block>
  );
}
