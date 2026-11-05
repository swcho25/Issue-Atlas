import type { Argument, RunStatus } from "@/shared/api";
import { StatusBadge } from "@/shared/ui/badge";

import { evidenceKindLabel, runStatusInfo } from "../../model/labels";

// 05 · 근거 수요표 패널: 실행 상태 상자(surface-2 · 안쪽 14 · 칸 사이 8) + 상태 4가지 설명(배지 + 한 줄)

/** 실행 상태를 한 문장으로. 필수 근거 이름은 응답의 수요표에서 */
function statusSentence(a: Argument) {
  const required = a.evidence_table.filter((r) => r.required);
  const names = (rows: typeof required) => rows.map((r) => evidenceKindLabel[r.kind]).join(" · ");
  switch (a.run_status) {
    case "ready":
      return `필수 근거(${names(required)})가 있어서 판단까지 갔어요.`;
    case "partial":
      return "필수 근거는 있지만 선택 근거 일부가 빠졌어요. 판단은 했어요.";
    case "blocked": {
      const missing = required.filter((r) => r.status !== "available");
      return `필수 근거(${names(missing.length ? missing : required)})가 없어서 판단하지 않았어요.`;
    }
    case "unsupported":
      return "목록에 없는 질문이라 신규 카드 후보로 남겼어요. 판단하지 않았어요.";
  }
}

const order: RunStatus[] = ["ready", "partial", "blocked", "unsupported"];

export function EvidencePanel({ argument }: { argument: Argument }) {
  const current = runStatusInfo[argument.run_status];
  return (
    <>
      <section aria-label="실행 상태" className="grid gap-2 rounded-xl bg-surface-2 p-3.5">
        <div className="flex items-center gap-2">
          <span className="text-label-12 text-text-1">실행 상태</span>
          <StatusBadge tone={current.tone}>{argument.run_status}</StatusBadge>
        </div>
        <p className="text-body-13 text-text-1">{statusSentence(argument)}</p>
      </section>
      <ul aria-label="실행 상태 설명" className="contents">
        {order.map((status) => (
          <li key={status} className="flex items-center gap-2">
            <StatusBadge tone={runStatusInfo[status].tone}>{status}</StatusBadge>
            <span className="text-caption-12 text-text-2">{runStatusInfo[status].legend}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
