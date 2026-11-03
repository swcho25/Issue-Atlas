"use client";

import { setTheme, useTheme } from "@/shared/lib/theme";

import { colorGroups } from "../model/tokens";
import { Swatch } from "./Swatch";

// 토큰 다크 값은 <html data-theme> 로만 바뀐다(globals.css 주석). 그래서 칸을 나누지 않고 페이지 전체를 바꾼다.
// 왼쪽 띠의 다크 모드 버튼과 같은 상태를 쓴다
export function ColorTokens() {
  const theme = useTheme();

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3">
        <h2 className="text-heading-20">색</h2>
        {(["light", "dark"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
            className="rounded-full border border-border-2 px-3 py-1 text-label-13 aria-pressed:bg-surface-3"
          >
            {t === "light" ? "Light" : "Dark"}
          </button>
        ))}
      </div>

      {/* 테마가 바뀌면 다시 그려 견본 값(계산된 색)을 새로 읽는다 */}
      <div key={theme} className="mt-4 grid grid-cols-4 gap-x-6 gap-y-8">
        {colorGroups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-3 text-label-13 text-text-2">{group.title}</h3>
            <div className="grid gap-3">
              {group.names.map((name) => (
                <Swatch key={name} name={name} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
