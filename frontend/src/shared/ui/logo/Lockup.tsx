"use client";

import Link from "next/link";
import { useState } from "react";

import { AtlasMark } from "./AtlasMark";

type LockupProps = {
  /** 크기는 글자 크기로 정한다: 심벌 폭 1.294em · 간격 0.353em (Figma Logo/Lockup 가로형 44 · 12 · 34) */
  className?: string;
  tone?: "ink" | "paper";
};

/** 심벌 + 워드마크. 홈으로 가는 링크이며, 마우스를 올리거나 키보드로 초점을 두면 심벌이 펼쳐진다 */
export function Lockup({ className = "", tone = "ink" }: LockupProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-[0.353em] font-serif leading-none tracking-[-0.02em] ${
        tone === "paper" ? "text-logo-paper" : "text-logo-ink"
      } ${className}`}
      onPointerEnter={(e) => e.pointerType !== "touch" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
      onBlur={() => setFocused(false)}
    >
      <AtlasMark open={hovered || focused} tone={tone} className="w-[1.294em] shrink-0" />
      <span>Issue Atlas</span>
    </Link>
  );
}
