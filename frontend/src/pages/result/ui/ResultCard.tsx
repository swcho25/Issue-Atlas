import type { Argument, RunStatus } from "@/shared/api";
import { StatusBadge, type StatusTone } from "@/shared/ui/badge";
import { TabBar } from "@/shared/ui/tab-bar";

import { resultTabs } from "./tabs";

// 실행 상태를 한 단어로. 색만으로 뜻을 전하지 않게 글자를 함께 쓴다
const runStatusBadge: Record<RunStatus, { tone: StatusTone; label: string }> = {
  ready: { tone: "green", label: "판단 가능" },
  partial: { tone: "amber", label: "일부 근거" },
  blocked: { tone: "red", label: "근거 부족" },
  unsupported: { tone: "gray", label: "카드 밖 질문" },
};

const period = (a: Argument) => {
  // 기간 끝은 미포함이라 하루 전 연도로 보여 준다(2023-01-01 ~ 2026-01-01 → 2023–2025)
  const start = a.question.period_start.slice(0, 4);
  const end = String(Number(a.question.period_end.slice(0, 4)) - 1);
  return start === end ? start : `${start}–${end}`;
};

// 04 · 결과 · 지도 먼저: 지도 위에 뜨는 결과 카드(요약 탭). 이번 단위는 틀까지 — Figma 값 대조는 다음 단위
export function ResultCard({ argument }: { argument: Argument }) {
  const status = runStatusBadge[argument.run_status];
  return (
    <section
      aria-label="결과 요약"
      className="absolute top-6 bottom-6 left-6 z-panel flex w-[400px] flex-col gap-5 overflow-y-auto rounded-2xl bg-surface-1 p-6 shadow-card"
    >
      <header className="grid gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          <span className="text-caption-12 text-text-3">{period(argument)}</span>
        </div>
        <h1 className="text-heading-20">
          {argument.question.place_name} · {argument.question.card_name ?? "목록에 없는 질문"}
        </h1>
      </header>

      <TabBar variant="clear" items={resultTabs(argument)} current="summary" className="-mx-1" />

      <p className="text-body-14 text-text-1">{argument.claim.text ?? "판단 문장이 없습니다."}</p>
    </section>
  );
}
