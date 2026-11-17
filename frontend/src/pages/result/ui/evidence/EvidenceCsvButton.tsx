"use client";

import type { EvidenceRow } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { evidenceKindLabel, evidenceStatusBadge } from "../../model/labels";

// 「CSV로 내려받기」(Figma Secondary S): 화면의 근거 수요표 4행을 그대로 CSV 로. 엑셀에서 한글이 깨지지 않게 BOM 을 붙인다
const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;

export function EvidenceCsvButton({ runId, rows }: { runId: string; rows: EvidenceRow[] }) {
  const download = () => {
    const lines = [
      ["근거 종류", "필수", "상태", "건수", "검증 대기", "사유"],
      ...rows.map((r) => [
        evidenceKindLabel[r.kind],
        r.required ? "필수" : "선택",
        evidenceStatusBadge[r.status].label,
        r.count,
        r.review_pending_count,
        r.reason ?? "",
      ]),
    ].map((line) => line.map(cell).join(","));
    const url = URL.createObjectURL(
      new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `자료현황_${runId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="secondary" size="s" icon={<Icon name="download" />} onClick={download}>
      CSV로 내려받기
    </Button>
  );
}
