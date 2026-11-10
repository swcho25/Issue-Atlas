"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminUser } from "@/entities/admin-user";
import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { requestApproval } from "../api/decide";

// 승인 요청 보내기(오른쪽 패널). 승인자는 활성 관리자 중에서(본인도 된다), 사유 필수.
// 요청하면 초안이 잠기고 승인자가 카드 승인 화면에서 처리한다
const MAX_REASON = 2000;

const failText = (e: unknown) => {
  if (e instanceof ApiError && e.status === 409)
    return "열린 요청이 있거나 초안이 바뀌었어요. 최신 내용으로 다시 불러왔어요.";
  if (e instanceof ApiError && e.status === 400)
    return "작성 기준 · 승인자 · 사유를 확인해 주세요.";
  if (e instanceof ApiError && (e.status === 401 || e.status === 403))
    return "세션이 끝났어요. 다시 로그인해 주세요.";
  return "요청하지 못했어요. 다시 시도해 주세요.";
};

export function RequestApprovalForm({
  cardId,
  draftRevision,
  admins,
  meId,
  blocked,
}: {
  cardId: string;
  draftRevision: number;
  admins: AdminUser[];
  meId: number;
  /** 요청할 수 없는 까닭(열린 요청 · 검사 미달 · 이미 승인한 초안). 있으면 칸을 끈다 */
  blocked: string | null;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [approver, setApprover] = useState(
    () => admins.find((u) => u.id !== meId)?.id ?? admins[0]?.id ?? null,
  );
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: () => requestApproval({ cardId, draftRevision, approverId: approver ?? 0, reason }),
    onSuccess: (r) => {
      setReason("");
      startRefresh(() => router.push(`/admin/cards?id=${encodeURIComponent(r.request_id)}`));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) startRefresh(() => router.refresh());
    },
  });
  const busy = send.isPending || refreshing;
  const off = !!blocked || busy;

  return (
    <aside
      aria-label="승인 요청"
      className="m-4 flex w-90 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl bg-surface-1 p-5 shadow-panel"
    >
      <h2 className="text-heading-20 text-text-1">승인 요청</h2>
      {blocked && <p className="text-body-13 text-text-2">{blocked}</p>}
      <form
        className="flex flex-1 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (approver !== null && reason.trim()) send.mutate();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-label-12 text-text-3">승인자</span>
          <select
            value={approver ?? ""}
            onChange={(e) => setApprover(Number(e.target.value))}
            disabled={off}
            className="h-9 rounded-lg border border-border-1 bg-surface-1 px-3 text-body-14 text-text-1 outline-none focus:border-border-2 disabled:bg-surface-2"
          >
            {admins.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.id === meId ? " (나)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-12 text-text-3">사유 (필수)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
            rows={4}
            required
            disabled={off}
            placeholder="요청 사유"
            className="resize-none rounded-lg border border-border-1 bg-surface-1 px-3 py-2 text-body-14 text-text-1 outline-none placeholder:text-text-3 focus:border-border-2 disabled:bg-surface-2"
          />
          <span className="self-end text-caption-11 text-text-3">
            {reason.length} / {MAX_REASON}
          </span>
        </label>
        {send.isError && (
          <p role="alert" className="text-body-13 text-status-red">
            {failText(send.error)}
          </p>
        )}
        <Button
          type="submit"
          className="mt-auto w-full"
          disabled={off || approver === null || !reason.trim()}
          icon={<Icon name="check" />}
        >
          {busy ? "요청 중" : `초안 ${draftRevision}번 승인 요청`}
        </Button>
      </form>
    </aside>
  );
}
