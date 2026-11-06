"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

import type { Provenance } from "@/shared/api";

import { Toast } from "../toast/Toast";
import { SuggestionDialog } from "./SuggestionDialog";

// 오류 신고: 칸의 ⋯ → 「오류 신고 · 수정 제안」이 어느 칸인지 담아 수정 제안 창을 연다(Figma 06).
// 보내면 창을 닫고 아래에 알림(Figma v5/Toast)을 띄운다

/** 신고할 칸 */
export type ReportTarget = {
  cell: "claim" | "data" | "warrant" | "qualifier" | "rebuttals" | "ceiling";
  /** ①…⑥ */
  no: string;
  title: string;
  /** 그 칸을 누가 채웠나(창의 배지) */
  provenance: Provenance;
  /** 그 칸에 보이는 글(창 위쪽에 인용 · 사유 글에도 적는다) */
  quote: string | null;
};

/** 신고를 받을 수 있으면 「이 칸 신고」, 카드가 없는 결과(카드 밖)면 null */
const ReportContext = createContext<((target: ReportTarget) => void) | null>(null);

export const useReport = () => useContext(ReportContext);

export function ReportProvider({
  cardId,
  runId,
  context,
  children,
}: {
  /** 신고 대상 카드. 없으면 신고를 받지 않는다 */
  cardId: string | null;
  runId: string;
  /** 창 위쪽 줄에 붙일 카드 · 지역(「청년 유출·정착 · 여수시」) */
  context: string;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <ReportContext value={cardId ? setTarget : null}>
      {children}
      {target && cardId && (
        <SuggestionDialog
          target={target}
          cardId={cardId}
          runId={runId}
          context={context}
          onClose={() => setTarget(null)}
          onSent={() => setSent(true)}
        />
      )}
      {/* 보낸 뒤 알림(초록 체크). 「보기」(내 수정 제안)는 그 화면이 생기면 붙인다 */}
      {sent && (
        <Toast icon="check" iconClassName="text-status-green" onDone={() => setSent(false)}>
          수정 제안을 보냈어요 — 검수 대기
        </Toast>
      )}
    </ReportContext>
  );
}
