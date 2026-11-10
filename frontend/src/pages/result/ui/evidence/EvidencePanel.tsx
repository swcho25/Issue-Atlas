import type { Argument, RunStatus } from "@/shared/api";
import { StatusBadge } from "@/shared/ui/badge";

import { evidenceKindLabel, runStatusInfo, unmetConditions } from "../../model/labels";

// 05 · 근거 수요표 패널: 실행 상태 상자(surface-2 · 안쪽 14 · 칸 사이 8) + 상태 4가지 설명(배지 + 한 줄)

/** 실행 상태를 한 문장으로. 필수 근거 이름은 응답의 수요표에서 */
function statusSentence(a: Argument) {
  const required = a.evidence_table.filter((r) => r.required);
  const names = (rows: typeof required) => rows.map((r) => evidenceKindLabel[r.kind]).join(" · ");
  switch (a.run_status) {
    case "ready":
      return `필수 근거(${names(required)})가 있어서 분석 결과를 냈어요.`;
    case "partial":
      return "필수 근거는 있지만 선택 근거 일부가 빠졌어요. 분석 결과는 냈어요.";
    case "blocked": {
      const missing = required.filter((r) => r.status !== "available");
      return `필수 근거(${names(missing.length ? missing : required)})가 없어서 분석하지 않았어요.`;
    }
    case "unsupported": {
      if (a.question.card_id === null)
        return "목록에 없는 질문이라 신규 카드 후보로 남겼어요. 분석하지 않았어요.";
      // 카드는 있지만 적용 조건(C2 v1)을 못 채움. 지난 실행은 조건 줄이 없어 판단 문장으로
      const unmet = unmetConditions(a).map((c) => c.label);
      return unmet.length
        ? `카드 적용 조건(${unmet.join(" · ")})을 못 채워 분석하지 않았어요.`
        : (a.claim.text ?? "카드 적용 조건을 못 채워 분석하지 않았어요.");
    }
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
          <StatusBadge tone={current.tone}>{current.label}</StatusBadge>
        </div>
        <p className="text-body-13 text-text-1">{statusSentence(argument)}</p>
      </section>
      <ul aria-label="실행 상태 설명" className="contents">
        {order.map((status) => (
          <li key={status} className="flex items-center gap-2">
            <StatusBadge tone={runStatusInfo[status].tone}>
              {runStatusInfo[status].label}
            </StatusBadge>
            <span className="text-caption-12 text-text-2">{runStatusInfo[status].legend}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
