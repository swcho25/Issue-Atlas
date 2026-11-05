"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import type { Provenance } from "@/shared/api";
import { Icon } from "@/shared/ui/icon";

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
      {sent && <SentToast onDone={() => setSent(false)} />}
    </ReportContext>
  );
}

/**
 * 보낸 뒤 알림(Figma v5/Toast Info: 높이 44 · 모서리 8 · 왼쪽 14 · 오른쪽 8 · 사이 10 · text-1 바탕 · Shadow md,
 * check 16 + Body 13). Figma 의 흰 글자 · 초록 체크는 토큰이 아니라 반대색(surface-1) · status-green 으로.
 * 「보기」(내 수정 제안)는 그 화면이 생기면 붙인다. 4초 뒤 사라진다
 */
function SentToast({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      role="status"
      className="fixed bottom-8 left-1/2 z-toast flex h-11 -translate-x-1/2 items-center gap-2.5 rounded-lg bg-text-1 pr-4 pl-3.5 text-body-13 text-surface-1 shadow-md"
    >
      <Icon name="check" className="size-4 text-status-green" />
      수정 제안을 보냈어요 — 검수 대기
    </div>
  );
}
