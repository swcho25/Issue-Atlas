"use client";

import type { EvidenceRef } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { copyIcon, useCopy } from "../copy/useCopy";
import { useCardFootnotes } from "../copy/useCardFootnotes";

// 논증 탭 머리 「각주 전체 복사」(Figma Secondary S · copy): 카드 근거들의 각주를 한 번에 복사한다
const labels = { idle: "각주 전체 복사", copied: "복사했어요", failed: "복사하지 못했어요" };

export function CardFootnotesButton({ refs }: { refs: EvidenceRef[] }) {
  const { result, copy } = useCopy();
  const footnotes = useCardFootnotes(refs);
  // 근거가 하나도 없으면(근거 부족 · 카드 밖) 복사할 각주가 없다
  if (!refs.length) return null;
  return (
    <>
      <Button
        variant="secondary"
        size="s"
        icon={<Icon name={copyIcon(result)} />}
        onClick={() => copy(footnotes())}
      >
        {labels[result]}
      </Button>
      <span role="status" className="sr-only">
        {result === "idle" ? "" : `각주 ${refs.length}건을 ${labels[result]}`}
      </span>
    </>
  );
}
