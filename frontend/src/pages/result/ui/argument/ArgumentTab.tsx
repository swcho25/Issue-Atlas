import Link from "next/link";
import type { ReactNode } from "react";

import type { Argument, Provenance } from "@/shared/api";
import { ProvBadge, StatusBadge } from "@/shared/ui/badge";
import { Icon } from "@/shared/ui/icon";

import {
  claimBadge,
  claimLevelLabel,
  evidenceKindShort,
  provKind,
  qualifierGrade,
  rebuttalBadge,
} from "../../model/labels";
import { emptyRefsText, kindCount, refsTitle } from "../../model/sources";
import { sourcesHref } from "../tabs";

// 05 · 논증 카드 본문(Figma 05 · 논증 카드 탭): 두 열(폭 546 · 사이 12)에 칸 여섯.
// 왼쪽 ① 판단 · ② 근거, 오른쪽 ③ 보증 · ④ 한정어 · ⑤ 반박 · ⑥ 상한선. 칸마다 누가 채웠는지 배지를 단다.
// 빈 칸은 빈 상자로 두지 않고 왜 비었는지 한 문장으로 쓴다

/** 칸 하나: 모서리 12 · 테두리 1(자리 차지) · 안쪽 위 12 · 옆 · 아래 14 · 칸 사이 8 */
function Cell({
  no,
  title,
  provenance,
  tone = "default",
  children,
}: {
  no: string;
  title: string;
  provenance: Provenance;
  /** 보증 칸만 앰버 선(Figma primary/line) */
  tone?: "default" | "warrant";
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`flex flex-col gap-2 rounded-xl border bg-surface-1 px-3.5 pt-3 pb-3.5 ${tone === "warrant" ? "border-primary-line" : "border-border-1"}`}
    >
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="text-label-12 text-text-3">
          {no}
        </span>
        <h2 className="min-w-0 flex-1 text-label-13 text-text-1">{title}</h2>
        <ProvBadge kind={provKind[provenance]} />
      </div>
      {children}
    </section>
  );
}

/** 칸이 비었을 때의 한 문장 */
function Empty({ children }: { children: ReactNode }) {
  return <p className="text-body-13 text-text-3">{children}</p>;
}

/** 근거 충실도 구성: 「A 출처 2 · 독립 근거 3 · 최신 2025-12-31」(최신은 한국 날짜) */
function qualifierNote(c: Argument["qualifier"]["components"]) {
  const latest =
    c.latest_observed_at &&
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
      new Date(c.latest_observed_at),
    );
  return [
    `A 출처 ${c.a_grade_sources}`,
    `독립 근거 ${c.independent_evidence}`,
    latest ? `최신 ${latest}` : "최신 자료 없음",
  ].join(" · ");
}

export function ArgumentTab({ argument }: { argument: Argument }) {
  const { claim, data, warrant, qualifier, rebuttals, ceiling } = argument;
  const judged = claim.value !== "insufficient";
  const badge = claimBadge[claim.value];
  const grade = qualifierGrade[qualifier.grade];

  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Cell no="①" title="판단" provenance={claim.provenance}>
          <div className="flex items-center gap-1.5">
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            <span className="text-caption-11 text-text-3">{claimLevelLabel[claim.level]}</span>
          </div>
          <p className="text-heading-16 text-text-1">{claim.text ?? "판단 문장이 없어요."}</p>
        </Cell>

        <Cell no="②" title="근거" provenance={data.provenance}>
          <ul className="contents">
            {/* 수요표와 같은 순서 · 같은 4행 */}
            {argument.evidence_table.map((row) => {
              const kind = row.kind;
              const first = data[kind][0];
              // 「외 N건」은 수요표의 전체 건수로(목록에는 대표 자료만 온다)
              const count = kindCount(argument, row);
              return (
                <li key={kind} className="flex items-start gap-2.5 py-1.5">
                  <span className="w-16 shrink-0 text-caption-12 text-text-3">
                    {evidenceKindShort[kind]}
                  </span>
                  {first ? (
                    <>
                      <span className="grid min-w-0 flex-1 gap-px">
                        <span className="text-body-13 text-text-1">{refsTitle(first, count)}</span>
                        <span className="text-caption-11 text-text-3">
                          {first.source_name} · {first.source_grade}
                        </span>
                      </span>
                      {/* 원문 탭에서 이 근거를 고른 채로 연다(원문 · 각주) */}
                      <Link
                        href={sourcesHref(argument.run_id, first.evidence_id)}
                        className="flex shrink-0 items-center gap-0.75 text-label-12 text-primary-text"
                      >
                        원문
                        <Icon name="external" className="size-3 text-primary" />
                      </Link>
                    </>
                  ) : (
                    // 목록이 비었으면: 건수가 있으면 「자료 N건 · 목록 없음」, 없으면 수요표의 사유 · 상태(미수집 · 미공표 …)
                    <span className="min-w-0 flex-1 text-body-13 text-text-3">
                      {emptyRefsText(row, count)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Cell>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Cell no="③" title="보증" provenance={warrant.provenance} tone="warrant">
          {warrant.text ? (
            <p className="text-body-13 text-text-1">{warrant.text}</p>
          ) : (
            <Empty>
              {judged ? "카드에 보증 문장이 없어요." : "판단하지 않아 보증 문장을 쓰지 않았어요."}
            </Empty>
          )}
        </Cell>

        <Cell no="④" title="한정어 · 근거 충실도" provenance={qualifier.provenance}>
          <div className="flex items-baseline gap-3">
            <span className={`text-heading-24 ${grade.className}`}>{grade.label}</span>
            <span className="text-body-13 text-text-2">{qualifierNote(qualifier.components)}</span>
          </div>
        </Cell>

        {/* 반박은 줄마다 누가 썼는지가 있다. 칸 배지는 사람이 고친 줄이 있으면 검수, 아니면 첫 줄(없으면 규칙) */}
        <Cell
          no="⑤"
          title="반박 · 다른 설명"
          provenance={
            rebuttals.some((r) => r.provenance === "human")
              ? "human"
              : (rebuttals[0]?.provenance ?? "rule")
          }
        >
          {rebuttals.length ? (
            <ul className="contents">
              {rebuttals.map((r) => (
                <li key={r.text} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-body-13 text-text-1">{r.text}</span>
                  <StatusBadge tone={rebuttalBadge[r.status].tone}>
                    {rebuttalBadge[r.status].label}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              {judged ? "찾은 다른 설명이 없어요." : "판단하지 않아 다른 설명을 찾지 않았어요."}
            </Empty>
          )}
        </Cell>

        <Cell no="⑥" title="상한선 · 말하지 않는 것" provenance={ceiling.provenance}>
          {ceiling.items.length ? (
            <ul className="contents">
              {ceiling.items.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Icon name="close" className="size-3 shrink-0 text-text-3" />
                  <span className="text-caption-12 text-text-2">{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              {argument.question.card_id
                ? "카드에 적힌 상한선이 없어요."
                : "카드가 없어 상한선이 없어요."}
            </Empty>
          )}
        </Cell>
      </div>
    </div>
  );
}
