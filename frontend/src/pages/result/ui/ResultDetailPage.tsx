import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { Argument } from "@/shared/api";

import { getArgument } from "../api/getResult";
import { DetailFrame } from "./DetailFrame";
import { type DetailTab, isDetailTab } from "./tabs";

// /results/[id]/[tab] — 05 · 근거 수요표(evidence) · 논증 카드(argument) · 원문(sources).
// 세 탭이 같은 논증 응답 하나를 쓴다. params · 데이터 읽기는 <Suspense> 안에서(Next 16 Cache Components)
export function ResultDetailPage({ params }: { params: Promise<{ id: string; tab: string }> }) {
  return (
    <Suspense>
      <DetailContent params={params} />
    </Suspense>
  );
}

// 탭마다 제목 · 설명(Figma 05 머리)
const heads: Record<DetailTab, (a: Argument) => { title: string; caption: string }> = {
  evidence: () => ({
    title: "근거 수요표",
    caption: "판단보다 먼저 — 이 질문에 필요한 근거 4종 중 있는 것과 없는 것",
  }),
  argument: (a) => ({
    title: "논증 카드",
    caption: [
      a.question.card_name,
      a.card_version !== null && `카드 v${a.card_version}`,
      a.formula_version && `판정 규칙 ${a.formula_version}`,
      `근거 충실도 규칙 ${a.qualifier.formula_version}`,
    ]
      .filter(Boolean)
      .join(" · "),
  }),
  sources: (a) => ({
    title: "원문",
    caption: `${a.question.place_name} · ${a.question.card_name ?? "목록에 없는 질문"}에 쓴 근거 자료`,
  }),
};

async function DetailContent({ params }: { params: Promise<{ id: string; tab: string }> }) {
  const { id, tab } = await params;
  if (!isDetailTab(tab)) notFound();
  const argument = await getArgument(id);
  const head = heads[tab](argument);
  return (
    <DetailFrame argument={argument} tab={tab} title={head.title} caption={head.caption}>
      {/* 탭 내용은 다음 단위(U11 수요표 · U12 논증 · U13 원문)에서 채운다 */}
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-body-13 text-text-2">준비 중이에요.</p>
    </DetailFrame>
  );
}
