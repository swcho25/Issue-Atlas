"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 복사 하나의 상태(복사 전 · 복사했어요 · 복사하지 못했어요)와 2초 뒤 되돌리기.
// 글자를 받아 와야 하는 복사(각주 전체)는 ClipboardItem 에 Promise 를 넘겨, 받아 오는 동안에도 누른 동작으로 인정받게 한다
// (Safari 는 누른 뒤 await 를 거치면 클립보드를 막는다). 클립보드는 HTTPS · localhost 에서만 열린다
export type CopyResult = "idle" | "copied" | "failed";

async function write(text: string | Promise<string>) {
  if (typeof text !== "string" && typeof ClipboardItem !== "undefined") {
    const blob = text.then((t) => new Blob([t], { type: "text/plain" }));
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    return;
  }
  await navigator.clipboard.writeText(await text);
}

export function useCopy() {
  const [result, setResult] = useState<CopyResult>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // 화면을 떠나면 남은 타이머를 지운다
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text: string | Promise<string>) => {
    let next: CopyResult = "copied";
    try {
      await write(text);
    } catch {
      next = "failed";
    }
    setResult(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult("idle"), 2000);
  }, []);

  return { result, copy };
}

/** 결과에 맞는 아이콘 */
export const copyIcon = (result: CopyResult) =>
  result === "copied" ? "check" : result === "failed" ? "alert" : "copy";
