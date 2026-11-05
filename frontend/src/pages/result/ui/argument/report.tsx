"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";

// 오류 신고: 칸의 ⋯ → 「오류 신고 · 수정 제안」이 어느 칸인지 담아 수정 제안 창을 연다(Figma 06).
// 창 안의 문제 종류 · 설명 · 근거 붙이기 · 보내기(POST /v1/review-requests)는 다음 단위(U15)에서 채운다

/** 신고할 칸 */
export type ReportTarget = {
  cell: "claim" | "data" | "warrant" | "qualifier" | "rebuttals" | "ceiling";
  /** ①…⑥ */
  no: string;
  title: string;
  /** 그 칸에 보이는 글(창 위쪽에 인용) */
  quote: string | null;
};

const ReportContext = createContext<(target: ReportTarget) => void>(() => {});

/** 칸 메뉴가 부르는 「이 칸 신고」 */
export const useReport = () => useContext(ReportContext);

export function ReportProvider({
  context,
  children,
}: {
  /** 창 위쪽 줄에 붙일 카드 · 지역(「청년 유출·정착 · 여수시」) */
  context: string;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  return (
    <ReportContext value={setTarget}>
      {children}
      {target && <ReportDialog target={target} context={context} onClose={() => setTarget(null)} />}
    </ReportContext>
  );
}

function ReportDialog({
  target,
  context,
  onClose,
}: {
  target: ReportTarget;
  context: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // 모달로 열어 바깥 초점을 막고, Esc · 닫기로 닫는다(초점은 브라우저가 연 버튼으로 돌려준다)
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="report-title"
      className="m-auto w-[560px] max-w-[calc(100vw-32px)] rounded-2xl bg-surface-1 p-6 shadow-md backdrop:bg-text-1/40"
    >
      <div className="grid gap-3">
        <h2 id="report-title" className="text-heading-20 text-text-1">
          수정 제안 보내기
        </h2>
        <p className="text-caption-12 text-text-2">
          {target.no} {target.title} · {context}
        </p>
        {target.quote && (
          <blockquote className="rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-body-13 text-text-1">
            {target.quote}
          </blockquote>
        )}
        <p className="text-caption-12 text-text-3">
          원본은 바뀌지 않아요. 관리자가 검수한 뒤 다음 실행부터 반영돼요.
        </p>
        <div className="flex justify-end">
          <Button variant="secondary" size="s" onClick={() => ref.current?.close()}>
            닫기
          </Button>
        </div>
      </div>
    </dialog>
  );
}
