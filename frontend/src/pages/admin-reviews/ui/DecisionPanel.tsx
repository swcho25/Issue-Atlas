"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { decideReview } from "../api/decide";
import { actionHint, actionLabel, scopeLabel } from "../model/labels";
import { type DecisionAction, decisionActions, type ReviewDetail } from "../model/schema";

// 오른쪽 처리 패널(Figma 「처리」 360 폭). 켜지는 행위는 서버가 알려 준 supported_actions 만.
// 카드 「수정」은 카드 전체 초안 · 승인자를 함께 보내야 해 카드 화면에서 한다(이 패널에서는 끈다).
// 처리하면 상세의 수정 번호가 바뀌어 패널을 새로 그린다(key = revision, AdminReviewDetailPage)
const MAX_REASON = 2000;

const failText = (e: unknown) => {
  if (e instanceof ApiError && e.status === 409)
    return "다른 관리자가 먼저 처리했거나 값이 바뀌었어요. 새로 고친 내용을 보고 다시 처리해 주세요.";
  if (e instanceof ApiError && e.status === 400)
    return "입력을 확인해 주세요. 사유는 꼭 적어야 해요.";
  if (e instanceof ApiError && (e.status === 401 || e.status === 403))
    return "관리자 세션이 끝났어요. 다시 로그인해 주세요.";
  return "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
};

export function DecisionPanel({ detail }: { detail: ReviewDetail }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  // 같은 보류를 되풀이하면 409 라 보류 중에는 보류를 끈다
  const usable = (a: DecisionAction) =>
    detail.supported_actions.includes(a) &&
    !(a === "correct" && detail.request.target_type === "card") &&
    !(a === "hold" && detail.request.status === "on_hold");
  const [picked, setAction] = useState<DecisionAction | null>(null);
  // 고른 행위가 (보류 뒤처럼) 더는 안 되면 처음 되는 행위로
  const action = picked && usable(picked) ? picked : (decisionActions.find(usable) ?? null);
  const [reason, setReason] = useState("");
  const decide = useMutation({
    mutationFn: (a: DecisionAction) => decideReview(detail, a, reason),
    onSuccess: () => {
      setReason("");
      startRefresh(() => router.refresh());
    },
    onError: (e) => {
      // 그 사이 다른 처리가 있었으면 최신 상세를 다시 받는다
      if (e instanceof ApiError && e.status === 409) startRefresh(() => router.refresh());
    },
  });
  const busy = decide.isPending || refreshing;
  const closed = detail.supported_actions.length === 0;

  return (
    <aside
      aria-label="처리"
      className="m-4 flex w-90 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl bg-surface-1 p-5 shadow-panel"
    >
      <h2 className="text-heading-20 text-text-1">처리</h2>
      {closed ? (
        <p className="text-body-13 text-text-2">
          {detail.request.status === "approval_pending"
            ? "카드 승인 요청으로 넘어갔어요. 지정 승인자가 카드 화면에서 처리해요."
            : "처리가 끝난 요청이에요. 다시 요청하려면 새 검수로 등록해요."}
        </p>
      ) : (
        <form
          className="flex flex-1 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (action && reason.trim()) decide.mutate(action);
          }}
        >
          <div role="radiogroup" aria-label="처리 방법" className="grid grid-cols-4 gap-1.5">
            {decisionActions.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={action === a}
                disabled={!usable(a) || busy}
                onClick={() => setAction(a)}
                className={`h-9 rounded-md border text-label-13 disabled:opacity-40 ${
                  action === a
                    ? "border-primary-line bg-primary-soft text-text-1"
                    : "border-border-1 text-text-2 hover:bg-surface-2"
                }`}
              >
                {actionLabel[a]}
              </button>
            ))}
          </div>
          {action && <p className="text-body-13 text-text-2">{actionHint[action]}</p>}
          {detail.supported_actions.includes("correct") &&
            detail.request.target_type === "card" && (
              <p className="text-caption-12 text-text-3">
                카드 초안 수정은 카드 화면에서 해요(승인자 지정 포함).
              </p>
            )}

          <div className="flex flex-col gap-1">
            <span className="text-label-12 text-text-3">적용 범위</span>
            <p className="text-body-13 text-text-1">{scopeLabel[detail.scope]}</p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-label-12 text-text-3">사유 (필수)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
              rows={4}
              required
              placeholder="왜 이렇게 처리하는지 남겨요. 변경 이력에 그대로 남아요"
              className="resize-none rounded-lg border border-border-1 bg-surface-1 px-3 py-2 text-body-14 text-text-1 outline-none placeholder:text-text-3 focus:border-border-2"
            />
            <span className="self-end text-caption-11 text-text-3">
              {reason.length} / {MAX_REASON}
            </span>
          </label>

          {decide.isError && (
            <p role="alert" className="text-body-13 text-status-red">
              {failText(decide.error)}
            </p>
          )}

          <Button
            type="submit"
            className="mt-auto w-full"
            disabled={!action || !reason.trim() || busy}
            icon={<Icon name="check" />}
          >
            {busy ? "처리 중" : action ? `${actionLabel[action]} 처리` : "처리"}
          </Button>
        </form>
      )}
    </aside>
  );
}
