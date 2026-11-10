import type { Argument } from "@/shared/api";
import { Icon } from "@/shared/ui/icon";
import type { TabBarItem } from "@/shared/ui/tab-bar";

import { sourcesTotal } from "../model/sources";

// 결과 화면 탭: 요약(04 지도) · 자료 현황 · 분석 근거 · 출처(05). 주소는 /results/[id](/evidence · /argument · /sources)
export const detailTabs = ["evidence", "argument", "sources"] as const;
export type DetailTab = (typeof detailTabs)[number];

export const isDetailTab = (tab: string): tab is DetailTab =>
  (detailTabs as readonly string[]).includes(tab);

export const summaryHref = (runId: string) => `/results/${encodeURIComponent(runId)}`;

/** 원문 탭. evidenceId 를 주면 그 근거를 고른 채로 연다(?e=) */
export const sourcesHref = (runId: string, evidenceId?: string) =>
  `${summaryHref(runId)}/sources${evidenceId ? `?e=${encodeURIComponent(evidenceId)}` : ""}`;

export function resultTabs(argument: Argument): TabBarItem[] {
  const base = summaryHref(argument.run_id);
  // 출처 수 = 근거 4종의 전체 건수(패널 「원문 16건」과 같은 수)
  const sources = sourcesTotal(argument);
  return [
    { key: "summary", label: "요약", href: base, icon: <Icon name="grid" /> },
    { key: "evidence", label: "자료 현황", href: `${base}/evidence`, icon: <Icon name="table" /> },
    {
      key: "argument",
      label: "분석 근거",
      href: `${base}/argument`,
      icon: <Icon name="compare" />,
    },
    {
      key: "sources",
      label: sources ? `출처 ${sources}` : "출처",
      href: sourcesHref(argument.run_id),
      icon: <Icon name="doc" />,
    },
  ];
}
