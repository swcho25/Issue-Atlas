"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, type Argument } from "@/shared/api";
import { GlassIconButton } from "@/shared/ui/button";

import { rerunResult } from "../../api/rerun";
import { cardRefs } from "../../model/footnotes";
import { copyIcon, useCopy } from "../copy/useCopy";
import { useCardFootnotes } from "../copy/useCardFootnotes";
import { Toast } from "../toast/Toast";

const copyLabels = { idle: "각주 복사", copied: "복사했어요", failed: "복사하지 못했어요" };

/** 다시 실행이 실패한 까닭을 사람 말로 */
const failureText = (e: unknown) =>
  e instanceof ApiError && e.status === 429
    ? "요청이 많아요. 1분 뒤 다시 실행해 주세요"
    : "다시 실행하지 못했어요. 잠시 뒤 다시 해 주세요";

/**
 * 04 지도 오른쪽 위 유리 아이콘(Figma Actions · 유리 아이콘: 오른쪽 16 · 위 20, Glass/Icon button 40 · 사이 8).
 * - 각주 복사: 카드 근거 각주를 한 번에(논증 탭 「각주 전체 복사」와 같은 글). 근거가 없으면 꺼진다
 * - 다시 실행: 같은 질문의 새 회차를 만들고(남이 물은 질문이면 같은 지역 · 카드 · 기간의 새 질문) 새 결과로 간다. 카드 밖 질문이면 꺼진다.
 *   실행이 끝나야 응답이 와서 그동안 아이콘이 돈다. 실패하면 아래에 알림
 * Figma 의 저장(bookmark)은 두지 않는다(사용자 결정 11/09): 질문은 만들 때 내 질문에 자동 저장되고
 * (Figma 03 「창을 닫아도 내 질문에 저장돼요」 · 06 「저장은 결과를 고정하는 게 아니라 질문을 남기는 것」) 누르면 할 일이 없다
 */
export function GlassActions({ argument }: { argument: Argument }) {
  const refs = cardRefs(argument);
  const { result, copy } = useCopy();
  const footnotes = useCardFootnotes(refs);
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const rerun = useMutation({
    mutationFn: () => rerunResult(argument),
    onSuccess: (created) => router.push(`/results/${created.run_id}`),
    onError: (e) => {
      // 세션이 끝났으면 랜딩으로 — 다시 로그인한다(새 질문 화면과 같다)
      if (e instanceof ApiError && e.status === 401) router.replace("/");
      else setFailure(failureText(e));
    },
  });
  // 성공해도 새 결과로 넘어갈 때까지는 도는 채로 둔다(두 번 누르기 막기)
  const running = rerun.isPending || rerun.isSuccess;

  return (
    <div className="absolute top-5 right-4 z-control flex gap-2">
      <GlassIconButton
        icon={copyIcon(result)}
        label={copyLabels[result]}
        disabled={!refs.length}
        onClick={() => copy(footnotes())}
      />
      {/* 도는 동안 흐리게 하지 않으려고 disabled 대신 aria-disabled 로 막는다 */}
      <GlassIconButton
        icon="refresh"
        label={running ? "다시 실행하는 중" : "다시 실행"}
        disabled={!argument.question.card_id}
        aria-disabled={running || undefined}
        aria-busy={running || undefined}
        onClick={() => {
          if (running) return;
          setFailure(null);
          rerun.mutate();
        }}
        className={running ? "cursor-progress [&_svg]:motion-safe:animate-spin" : ""}
      />
      <span role="status" className="sr-only">
        {result === "idle" ? "" : `각주 ${refs.length}건을 ${copyLabels[result]}`}
      </span>
      {failure && (
        <Toast
          icon="alert"
          iconClassName="text-status-red"
          className="absolute top-12 right-0"
          onDone={() => setFailure(null)}
        >
          {failure}
        </Toast>
      )}
    </div>
  );
}
