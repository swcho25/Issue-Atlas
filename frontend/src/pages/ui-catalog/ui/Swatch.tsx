"use client";

import { useState } from "react";

// 브라우저가 계산한 색을 Figma 와 같은 #RRGGBB(+ 투명도 %) 로 보여 준다
function toHex(rgb: string) {
  const [r = 0, g = 0, b = 0, a = 1] = rgb.match(/[\d.]+/g)?.map(Number) ?? [];
  const hex = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
  return a < 1 ? `${hex} ${Math.round(a * 100)}%` : hex;
}

export function Swatch({ name }: { name: string }) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-3">
      <div
        ref={(el) => {
          if (el) setValue(toHex(getComputedStyle(el).backgroundColor));
        }}
        className="size-10 shrink-0 rounded-lg border border-border-1"
        style={{ background: `var(--${name})` }}
      />
      <div>
        <div className="text-label-13">{name}</div>
        <div className="font-mono text-caption-12 text-text-3">{value}</div>
      </div>
    </div>
  );
}
