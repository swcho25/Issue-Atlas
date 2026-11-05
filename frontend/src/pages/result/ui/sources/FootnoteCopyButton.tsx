"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

// 각주 복사: 서버가 만든 각주 문자열을 클립보드로. 결과를 2초 동안 글자로 알려 준다(복사했어요 · 복사하지 못했어요).
// 클립보드는 HTTPS · localhost 에서만 열리고, 막히면 실패를 알린다. 화면 낭독기에는 role="status" 로 읽힌다.
// icon 은 각주 상자 머리의 아이콘 버튼(14), button 은 읽기 칸 아래 Primary S(Figma 둘 다 있다)
type Result = "idle" | "copied" | "failed";

const labels: Record<Result, string> = {
  idle: "각주 복사",
  copied: "복사했어요",
  failed: "복사하지 못했어요",
};

export function FootnoteCopyButton({
  footnote,
  variant = "button",
}: {
  footnote: string;
  variant?: "button" | "icon";
}) {
  const [result, setResult] = useState<Result>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // 화면을 떠나면 남은 타이머를 지운다
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    let next: Result = "copied";
    try {
      await navigator.clipboard.writeText(footnote);
    } catch {
      next = "failed";
    }
    setResult(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult("idle"), 2000);
  };
  const label = labels[result];
  const icon = result === "copied" ? "check" : result === "failed" ? "alert" : "copy";
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
          onClick={copy}
          aria-label="각주 복사"
          title={label}
          className="shrink-0 rounded-sm text-text-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-text-1"
        >
          <Icon name={icon} className="size-3.5" />
        </button>
        {status}
      </>
    );
  }
  return (
    <>
      <Button size="s" icon={<Icon name={icon} />} onClick={copy}>
        {label}
      </Button>
      {status}
    </>
  );
}
