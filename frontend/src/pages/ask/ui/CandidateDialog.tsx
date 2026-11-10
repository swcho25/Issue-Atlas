"use client";

import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";

import { createQuestion } from "../api/queries";
import type { Period } from "../model/period";
import type { Place } from "../model/schema";

// 새 이슈 후보 만들기(Figma 03 「새 이슈 후보 만들기」): 목록에 없는 이슈를 판단하지 않고 후보로 저장한다.
// POST /v1/questions 에 card_id null(계약 C2 · FR-A3) — 관리자가 이슈 카드로 만들지 검토한다.
// 이슈 이름 · 궁금한 까닭은 따로 받는 칸이 없어 원래 문장(raw_text)에 함께 적는다

function failText(e: unknown) {
  if (e instanceof ApiError && e.status === 401)
    return "로그인이 필요해요. 다시 로그인한 뒤 만들어 주세요.";
  if (e instanceof ApiError && e.status === 400) return "입력을 다시 확인해 주세요.";
  return "만들지 못했어요. 잠시 뒤 다시 시도해 주세요.";
}

export function CandidateDialog({
  name: initialName,
  place,
  period,
  sentence,
  onClose,
}: {
  name: string;
  place?: Place;
  period: Period;
  /** 문장으로 물었으면 그 문장 */
  sentence?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const ids = { title: useId(), name: useId(), why: useId(), error: useId() };
  const [name, setName] = useState(initialName);
  const [why, setWhy] = useState("");

  // 모달로 열어 바깥 초점을 막고, Esc · 취소로 닫는다(초점은 연 버튼으로 돌아간다)
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const save = useMutation({
    mutationFn: () => {
      if (!place) throw new Error("no place");
      const rawText = [
        sentence,
        `이슈 이름: ${name.trim()}`,
        why.trim() && `궁금한 까닭: ${why.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");
      return createQuestion({ placeId: place.place_id, cardId: null, period, rawText });
    },
  });

  const ready = !!place && name.trim().length > 0 && !save.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) save.mutate();
  };
  const where = [place?.name, period.short].filter(Boolean).join(" × ");

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={ids.title}
      className="m-auto w-[520px] max-w-[calc(100vw-32px)] rounded-2xl bg-surface-1 px-7 pt-6 pb-5.5 shadow-md backdrop:bg-scrim"
    >
      {save.isSuccess ? (
        <div className="flex flex-col gap-4">
          <h2 id={ids.title} className="text-heading-20 text-text-1">
            새 이슈 후보로 만들었어요
          </h2>
          <p className="text-body-14 text-text-2">
            「{name.trim()}」은 판단하지 않고 후보로 저장했어요. 관리자가 이슈 카드로 만들지
            검토해요.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => ref.current?.close()}>닫기</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 id={ids.title} className="text-heading-20 text-text-1">
            새 이슈 후보로 만들까요?
          </h2>
          <p className="text-body-14 text-text-2">
            「{name.trim() || "이 이슈"}」은 아직 이슈 카드가 없어요. 판단하지 않고 새 이슈 후보로
            만들면 관리자가 이슈 카드로 만들지 검토해요.
            {where && ` 카드가 생기면 「${where}」 질문을 바로 실행할 수 있어요.`}
          </p>

          <label htmlFor={ids.name} className="flex flex-col gap-1.5">
            <span className="text-label-13 text-text-2">이슈 이름</span>
            <input
              id={ids.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-10 rounded-lg bg-surface-1 px-3 text-body-14 text-text-1 inset-ring inset-ring-border-2 outline-none focus:inset-ring-[1.5px] focus:inset-ring-primary"
            />
          </label>

          <label htmlFor={ids.why} className="flex flex-col gap-1.5">
            <span className="text-label-13 text-text-2">왜 궁금한가요? (선택)</span>
            <textarea
              id={ids.why}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={3}
              placeholder="월세 지원 사업이 늘었는데 청년 정착과 관련이 있는지 보고 싶어요"
              className="resize-none rounded-lg bg-surface-1 px-3 py-2.5 text-body-14 text-text-1 inset-ring inset-ring-border-2 outline-none placeholder:text-text-3 focus:inset-ring-[1.5px] focus:inset-ring-primary"
            />
          </label>

          {!place && (
            <p className="text-body-13 text-status-red">어느 지역의 이슈인지 먼저 골라 주세요.</p>
          )}
          {save.isError && (
            <p id={ids.error} role="alert" className="text-body-13 text-status-red">
              {failText(save.error)}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => ref.current?.close()}>
              취소
            </Button>
            <Button type="submit" disabled={!ready}>
              {save.isPending ? "만드는 중…" : "새 이슈 후보 만들기"}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
