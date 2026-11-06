"use client";

import { useState } from "react";

import { Icon } from "@/shared/ui/icon";
import { Toggle } from "@/shared/ui/toggle";

// Figma 「토글」 보드의 네 상태(꺼짐 · 켜짐 · 비활성) + 누르는 동안(직접 눌러 본다) · 손잡이 그림을 넣은 테마 토글
export function TogglePreview() {
  const [layer, setLayer] = useState(true);
  const [relief, setRelief] = useState(false);
  const [dark, setDark] = useState(false);
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">토글</h2>
      <p className="mt-1 text-body-13 text-text-2">
        <code className="font-mono">{"<Toggle checked onChange label knob? disabled? />"}</code>
        {" · 누르고 있으면 손잡이가 늘어나 유리 방울이 된다"}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-8">
        <label className="flex items-center gap-3 text-body-13 text-text-2">
          <Toggle checked={relief} onChange={setRelief} label="꺼짐" />
          꺼짐
        </label>
        <label className="flex items-center gap-3 text-body-13 text-text-2">
          <Toggle checked={layer} onChange={setLayer} label="켜짐" />
          켜짐
        </label>
        <label className="flex items-center gap-3 text-body-13 text-text-2">
          <Toggle checked={false} onChange={() => undefined} label="비활성 꺼짐" disabled />
          <Toggle checked onChange={() => undefined} label="비활성 켜짐" disabled />
          비활성
        </label>
        <label className="flex items-center gap-3 text-body-13 text-text-2">
          <Toggle
            checked={dark}
            onChange={setDark}
            label="어두운 화면"
            knob={<Icon name={dark ? "moon" : "sun"} />}
          />
          손잡이 그림(테마)
        </label>
      </div>
    </section>
  );
}
