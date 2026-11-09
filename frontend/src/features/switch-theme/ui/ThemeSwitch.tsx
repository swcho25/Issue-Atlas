"use client";

import { useEffect, useState } from "react";

import { setTheme, useTheme } from "@/shared/lib/theme";
import { Icon } from "@/shared/ui/icon";
import { Toggle } from "@/shared/ui/toggle";

/**
 * 화면 테마 토글(켜짐 = 어두운 화면). 손잡이에 해 · 달을 그려 무엇을 바꾸는지 보인다. 랜딩 머리 · 마이페이지가 같이 쓴다.
 * 처음 그릴 때는 저장된 테마로 바로 놓고(밝음 → 어두움으로 미끄러지는 움직임 없이), 그 뒤 누를 때만 움직인다
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const dark = useTheme() === "dark";
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <Toggle
      checked={dark}
      onChange={(on) => setTheme(on ? "dark" : "light")}
      label="어두운 화면"
      knob={<Icon name={dark ? "moon" : "sun"} />}
      animate={ready}
      className={className}
    />
  );
}
