import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { Argument } from "@/shared/api";

import { getArgument } from "../api/getResult";
import { pickEvidence } from "../model/sources";
import { ArgumentPanel } from "./argument/ArgumentPanel";
import { ArgumentTab } from "./argument/ArgumentTab";
import { DetailFrame } from "./DetailFrame";
import { EvidenceCsvButton } from "./evidence/EvidenceCsvButton";
import { EvidencePanel } from "./evidence/EvidencePanel";
import { EvidenceTab } from "./evidence/EvidenceTab";
import { SourceReader, SourceReaderFallback } from "./sources/SourceReader";
import { SourcesList } from "./sources/SourcesList";
import { SourcesPanel } from "./sources/SourcesPanel";
import { type DetailTab, isDetailTab, sourcesHref } from "./tabs";

// /results/[id]/[tab] — 05 · 근거 수요표(evidence) · 논증 카드(argument) · 원문(sources).
// 세 탭이 같은 논증 응답 하나를 쓴다. params · 데이터 읽기는 <Suspense> 안에서(Next 16 Cache Components)
type Props = {
  params: Promise<{ id: string; tab: string }>;
  /** 원문 탭의 고른 근거(?e=evidence_id) */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function ResultDetailPage({ params, searchParams }: Props) {
  return (
    <Suspense>
      <DetailContent params={params} searchParams={searchParams} />
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

async function DetailContent({ params, searchParams }: Props) {
  const { id, tab } = await params;
  if (!isDetailTab(tab)) notFound();
  const argument = await getArgument(id);
  const head = heads[tab](argument);
  if (tab === "evidence") {
    return (
      <DetailFrame
        argument={argument}
        tab={tab}
        title={head.title}
        caption={head.caption}
        action={<EvidenceCsvButton runId={argument.run_id} rows={argument.evidence_table} />}
        panel={<EvidencePanel argument={argument} />}
      >
        <EvidenceTab argument={argument} />
      </DetailFrame>
    );
  }
  if (tab === "argument") {
    // 머리 「각주 전체 복사」 · 칸 ⋯ 메뉴는 다음 단위(U14)
    return (
      <DetailFrame
        argument={argument}
        tab={tab}
        title={head.title}
        caption={head.caption}
        panel={<ArgumentPanel />}
      >
        <ArgumentTab argument={argument} />
      </DetailFrame>
    );
  }
  // 원문: 고른 근거(?e=) — 없거나 목록에 없는 ID 면 첫 근거(수요표 순서)
  const selected = pickEvidence(argument, (await searchParams).e);
  return (
    <DetailFrame
      argument={argument}
      tab={tab}
      title={head.title}
      caption={head.caption}
      layout="split"
      panel={<SourcesPanel argument={argument} />}
    >
      <SourcesList
        argument={argument}
        selectedId={selected?.evidence_id ?? null}
        hrefOf={(evidenceId) => sourcesHref(argument.run_id, evidenceId)}
      />
      {/* 근거 상세는 따로 기다린다: 목록 · 패널이 먼저 보이고, 근거를 바꾸면 읽기 칸만 새로 받는다 */}
      <Suspense key={selected?.evidence_id ?? "none"} fallback={<SourceReaderFallback />}>
        <SourceReader item={selected} />
      </Suspense>
    </DetailFrame>
  );
}
