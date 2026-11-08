"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { decideApproval } from "../api/decide";
import type { ApprovalDetail, Decision } from "../model/schema";

// 승인 요청 처리(Figma 「카드 승인」 아래 보류 · 반려 · 승인). 지정 승인자만 처리할 수 있다(그 밖은 403).
// 같은 보류를 되풀이하면 409 라 보류 중에는 보류를 끈다. 처리하면 상세의 요청 번호가 바뀌어 새로 그린다(key = revision)
const MAX_REASON = 2000;

const failText = (e: unknown) => {
  if (e instanceof ApiError && e.status === 409)
    return "이미 처리됐거나 초안 · 규칙이 바뀌었어요. 최신 내용으로 다시 불러왔어요.";
  if (e instanceof ApiError && e.status === 400) return "승인 조건이나 사유를 확인해 주세요.";
  if (e instanceof ApiError && e.status === 403) return "지정 승인자만 처리할 수 있어요.";
  if (e instanceof ApiError && e.status === 401) return "세션이 끝났어요. 다시 로그인해 주세요.";
  return "처리하지 못했어요. 다시 시도해 주세요.";
};

export function ApprovalActions({ detail, meId }: { detail: ApprovalDetail; meId: number }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [reason, setReason] = useState("");
  const r = detail.request;
  const decide = useMutation({
    mutationFn: (d: Decision) => decideApproval(detail, d, reason),
    onSuccess: () => {
      setReason("");
      startRefresh(() => router.refresh());
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) startRefresh(() => router.refresh());
    },
  });
  const busy = decide.isPending || refreshing;
  const mine = r.approver_id === meId;
  const ready = mine && !!reason.trim() && !busy;

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border-1 bg-surface-1 p-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex flex-col gap-1">
        <span className="text-label-12 text-text-3">
          처리 사유 (필수) · 승인자 {r.approver_name}
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
          rows={3}
          disabled={!mine || busy}
          placeholder={mine ? "처리 사유" : `${r.approver_name}만 처리`}
          className="resize-none rounded-lg border border-border-1 bg-surface-1 px-3 py-2 text-body-14 text-text-1 outline-none placeholder:text-text-3 focus:border-border-2 disabled:bg-surface-2"
        />
      </label>
      {decide.isError && (
        <p role="alert" className="text-body-13 text-status-red">
          {failText(decide.error)}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={!ready || r.status === "on_hold"}
          onClick={() => decide.mutate("hold")}
        >
          보류
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!ready}
          onClick={() => decide.mutate("reject")}
        >
          반려
        </Button>
        <Button
          type="button"
          disabled={!ready}
          icon={<Icon name="check" />}
          onClick={() => decide.mutate("approve")}
        >
          {busy ? "처리 중" : "승인 · 카드 공개"}
        </Button>
      </div>
    </form>
  );
}
