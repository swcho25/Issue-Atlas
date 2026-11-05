"use client";

import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

import { copyIcon, useCopy } from "../copy/useCopy";

// 각주 복사(원문 탭): 서버가 만든 각주 문자열을 클립보드로. 결과를 2초 동안 글자로 알려 준다.
// 화면 낭독기에는 role="status" 로 읽힌다.
// icon 은 각주 상자 머리의 아이콘 버튼(14), button 은 읽기 칸 아래 Primary S(Figma 둘 다 있다)
const labels = { idle: "각주 복사", copied: "복사했어요", failed: "복사하지 못했어요" };

export function FootnoteCopyButton({
  footnote,
  variant = "button",
}: {
  footnote: string;
  variant?: "button" | "icon";
}) {
  const { result, copy } = useCopy();
  const label = labels[result];
  const status = (
    <span role="status" className="sr-only">
      {result === "idle" ? "" : `각주를 ${label}`}
    </span>
  );

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={() => copy(footnote)}
          aria-label="각주 복사"
          title={label}
          className="shrink-0 rounded-sm text-text-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-text-1"
        >
          <Icon name={copyIcon(result)} className="size-3.5" />
        </button>
        {status}
      </>
    );
  }
  return (
    <>
      <Button size="s" icon={<Icon name={copyIcon(result)} />} onClick={() => copy(footnote)}>
        {label}
      </Button>
      {status}
    </>
  );
}
