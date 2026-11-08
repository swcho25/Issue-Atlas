"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { finishImport } from "../api/imports";
import type { ImportDetail } from "../model/schema";

// 담당자 결과 보고(오른쪽 패널). 지정 담당자만 보고한다(그 밖은 403).
// 완료는 적재 + 건너뜀 = 적재 대상, 실패는 합계 ≤ 적재 대상(contracts/csv-imports). 보고는 업무 DB 를 되돌리지 않는다
const MAX_REASON = 2000;

const failText = (e: unknown) => {
  if (e instanceof ApiError && e.status === 409)
    return "이미 보고됐거나 요청이 바뀌었어요. 최신 내용으로 다시 불러왔어요.";
  if (e instanceof ApiError && e.status === 400) return "건수 · 사유를 확인해 주세요.";
  if (e instanceof ApiError && e.status === 403) return "지정 담당자만 보고할 수 있어요.";
  if (e instanceof ApiError && e.status === 401) return "세션이 끝났어요. 다시 로그인해 주세요.";
  return "보고하지 못했어요. 다시 시도해 주세요.";
};

const toCount = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);

export function FinishForm({
  detail,
  meId,
  assigneeName,
}: {
  detail: ImportDetail;
  meId: number;
  assigneeName: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const eligible = detail.request.validation.eligible_rows;
  const [status, setStatus] = useState<"completed" | "failed">("completed");
  const [loaded, setLoaded] = useState(String(eligible));
  const [skipped, setSkipped] = useState("0");
  const [reason, setReason] = useState("");
  const mine = detail.request.assignee_id === meId;
  const l = toCount(loaded);
  const s = toCount(skipped);
  const sumOk =
    l !== null && s !== null && (status === "completed" ? l + s === eligible : l + s <= eligible);
  const finish = useMutation({
    mutationFn: () => finishImport(detail, { status, loaded: l ?? 0, skipped: s ?? 0, reason }),
    onSuccess: () => startRefresh(() => router.refresh()),
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) startRefresh(() => router.refresh());
    },
  });
  const busy = finish.isPending || refreshing;
  const off = !mine || busy;
  const field =
    "h-9 rounded-lg border border-border-1 bg-surface-1 px-3 text-body-14 text-text-1 outline-none focus:border-border-2 disabled:bg-surface-2";

  return (
    <aside
      aria-label="결과 보고"
      className="m-4 flex w-90 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl bg-surface-1 p-5 shadow-panel"
    >
      <h2 className="text-heading-20 text-text-1">결과 보고</h2>
      <p className="text-body-13 text-text-2">
        담당자 {assigneeName} · 적재 대상 {eligible}행
      </p>
      <form
        className="flex flex-1 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (sumOk && reason.trim()) finish.mutate();
        }}
      >
        <div role="radiogroup" aria-label="결과" className="grid grid-cols-2 gap-1.5">
          {(["completed", "failed"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={status === v}
              disabled={off}
              onClick={() => setStatus(v)}
              className={`h-9 rounded-md border text-label-13 disabled:opacity-40 ${
                status === v
                  ? "border-primary-line bg-primary-soft text-text-1"
                  : "border-border-1 text-text-2 hover:bg-surface-2"
              }`}
            >
              {v === "completed" ? "완료" : "실패"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-text-3">적재</span>
            <input
              inputMode="numeric"
              value={loaded}
              disabled={off}
              onChange={(e) => setLoaded(e.target.value.trim())}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-text-3">건너뜀</span>
            <input
              inputMode="numeric"
              value={skipped}
              disabled={off}
              onChange={(e) => setSkipped(e.target.value.trim())}
              className={field}
            />
          </label>
        </div>
        {!sumOk && (
          <p className="text-caption-12 text-status-amber">
            {status === "completed" ? `적재 + 건너뜀 = ${eligible}` : `적재 + 건너뜀 ≤ ${eligible}`}
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-label-12 text-text-3">사유 (필수)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
            rows={4}
            required
            disabled={off}
            placeholder={mine ? "처리 내용" : `${assigneeName}만 보고`}
            className="resize-none rounded-lg border border-border-1 bg-surface-1 px-3 py-2 text-body-14 text-text-1 outline-none placeholder:text-text-3 focus:border-border-2 disabled:bg-surface-2"
          />
        </label>
        {finish.isError && (
          <p role="alert" className="text-body-13 text-status-red">
            {failText(finish.error)}
          </p>
        )}
        <Button
          type="submit"
          className="mt-auto w-full"
          disabled={off || !sumOk || !reason.trim()}
          icon={<Icon name="check" />}
        >
          {busy ? "보고 중" : `${status === "completed" ? "완료" : "실패"} 보고`}
        </Button>
      </form>
    </aside>
  );
}
