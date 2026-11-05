"use client";

import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { ApiError, browserPost } from "@/shared/api";
import { ProvBadge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { provKind } from "../../model/labels";
import {
  isLinkOk,
  type IssueType,
  issueTypes,
  reviewReceiptSchema,
  suggestionReason,
} from "../../model/suggestion";
import type { ReportTarget } from "./report";

// 수정 제안 보내기(Figma 06 Modal 560 × 513: 모서리 16 · 안쪽 24 · 28 · 22 · 칸 사이 16 · Shadow md, 뒤 scrim).
// 칸 정보 → 무엇이 틀렸나요?(하나) → 설명 → 근거 붙이기(선택) → 안내 → 취소 · 보내기

/** 보내기 실패 이유를 사용자 말로 */
function failText(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 401) return "로그인이 필요해요. 다시 로그인한 뒤 보내 주세요.";
    if (e.status === 403) return "이 계정으로는 수정 제안을 보낼 수 없어요.";
    if (e.status === 400) return "입력을 다시 확인해 주세요.";
    if (e.status === 404) return "이 카드를 찾지 못했어요. 결과를 새로고침해 주세요.";
  }
  return "보내지 못했어요. 잠시 뒤 다시 보내 주세요.";
}

export function SuggestionDialog({
  target,
  cardId,
  runId,
  context,
  onClose,
  onSent,
}: {
  target: ReportTarget;
  cardId: string;
  runId: string;
  context: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const ids = { title: useId(), issue: useId(), desc: useId(), link: useId(), error: useId() };
  const [issue, setIssue] = useState<IssueType | null>(null);
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);

  // 모달로 열어 바깥 초점을 막고, Esc · 취소로 닫는다(초점은 연 버튼으로 돌아간다)
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    if (linkOpen) linkInput.current?.focus();
  }, [linkOpen]);

  const send = useMutation({
    mutationFn: () =>
      browserPost(
        "/v1/review-requests",
        {
          target_type: "card",
          target_id: cardId,
          issue_type: issue,
          card_id: cardId,
          reason: suggestionReason({
            cell: `${target.no} ${target.title}`,
            context,
            runId,
            quote: target.quote,
            description,
            link,
          }),
        },
        reviewReceiptSchema,
      ),
    onSuccess: () => {
      onSent();
      ref.current?.close();
    },
  });

  const linkOk = isLinkOk(link);
  const ready = issue !== null && description.trim().length > 0 && linkOk && !send.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) send.mutate();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={ids.title}
      className="m-auto w-[560px] max-w-[calc(100vw-32px)] rounded-2xl bg-surface-1 px-7 pt-6 pb-5.5 shadow-md backdrop:bg-scrim"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 id={ids.title} className="text-heading-20 text-text-1">
          수정 제안 보내기
        </h2>

        {/* 신고할 칸: surface-2 · 모서리 10 · 안쪽 12 · 사이 10, 배지 + Label 13 · Caption 12 */}
        <div className="flex items-center gap-2.5 rounded-[10px] bg-surface-2 p-3">
          <ProvBadge kind={provKind[target.provenance]} />
          <div className="grid min-w-0 gap-0.5">
            <p className="text-label-13 text-text-1">
              {[`${target.no} ${target.title}`, context].filter(Boolean).join(" · ")}
            </p>
            {target.quote && (
              <p className="truncate text-caption-12 text-text-2">「{target.quote}」</p>
            )}
          </div>
        </div>

        {/* 무엇이 틀렸나요?: 칩 높이 30 · 모서리 8 · 안쪽 6 · 12 · 6 · 10 · 점 10, 고른 칩은 primary-soft + primary 테두리 */}
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-label-12 text-text-2">무엇이 틀렸나요?</legend>
          <div className="flex flex-wrap gap-1.5">
            {issueTypes.map((t) => (
              <label
                key={t.value}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-2 bg-surface-1 py-1.5 pr-3 pl-2.5 text-label-12 text-text-1 has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-text has-focus-visible:outline-2 has-focus-visible:outline-text-1"
              >
                <input
                  type="radio"
                  name={ids.issue}
                  value={t.value}
                  checked={issue === t.value}
                  onChange={() => setIssue(t.value)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="size-2.5 rounded-full border-[1.5px] border-border-2 peer-checked:border-primary peer-checked:bg-primary"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <label htmlFor={ids.desc} className="text-label-12 text-text-2">
            설명
          </label>
          <textarea
            id={ids.desc}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1500}
            placeholder="무엇이 어떻게 다른지 적어 주세요."
            className="min-h-21 resize-y rounded-lg border border-border-2 bg-surface-1 px-3 py-2.5 text-body-13 text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-text-1"
          />
        </div>

        {/* 근거 붙이기(선택): 누르면 링크 칸으로 바뀐다. 원문 탭의 자료는 그 원문 사이트 주소를 붙인다 */}
        {linkOpen ? (
          <div className="grid gap-1.5">
            <label htmlFor={ids.link} className="text-label-12 text-text-2">
              근거 링크 (선택)
            </label>
            <input
              ref={linkInput}
              id={ids.link}
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
              aria-invalid={!linkOk}
              className="h-8.5 rounded-lg border border-border-2 bg-surface-1 px-3 text-body-13 text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-text-1 aria-invalid:border-status-red"
            />
            {!linkOk && (
              <p className="text-caption-12 text-status-red">
                https:// 로 시작하는 주소를 넣어 주세요.
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border-2 px-3 py-2 text-left text-caption-12 text-text-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-text-1"
          >
            <Icon name="plus" className="size-3.5" />
            근거 붙이기 (선택) — 링크 또는 원문 탭의 자료
          </button>
        )}

        {/* 안내: status-blue-soft · 모서리 8 · 안쪽 10 · 12 · shield 14 */}
        <p className="flex items-start gap-2 rounded-lg bg-status-blue-soft px-3 py-2.5 text-caption-12 text-text-1">
          <Icon name="shield" className="mt-px size-3.5 shrink-0" />
          원본은 바뀌지 않아요. 관리자가 검수한 뒤 다음 실행부터 반영돼요. 결과는 내 질문 › 내 수정
          제안에서 볼 수 있어요.
        </p>

        {send.isError && (
          <p id={ids.error} role="alert" className="text-caption-12 text-status-red">
            {failText(send.error)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => ref.current?.close()}>
            취소
          </Button>
          <Button
            type="submit"
            disabled={!ready}
            aria-describedby={send.isError ? ids.error : undefined}
          >
            {send.isPending ? "보내는 중…" : "보내기"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
