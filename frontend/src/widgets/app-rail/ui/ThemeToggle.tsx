"use client";

import { setTheme, useTheme } from "@/shared/lib/theme";

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.45833,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// 해는 Figma v5/Rail 맨 아래 아이콘(v3/Icon settings) 그대로, 달은 같은 선 굵기로 그렸다
const sun = (
  <path
    d="M12.5 10A2.5 2.5 0 1 1 7.5 10 2.5 2.5 0 0 1 12.5 10ZM10 1.67V4.17M10 15.83V18.33M1.67 10H4.17M15.83 10H18.33M4.08 4.08 5.83 5.83M14.17 14.17 15.92 15.92M4.08 15.92 5.83 14.17M14.17 5.83 15.92 4.08"
    {...line}
  />
);
const moon = <path d="M16.67 11.9A6.67 6.67 0 1 1 8.1 3.33 5.2 5.2 0 0 0 16.67 11.9Z" {...line} />;

// 아이콘은 지금 테마(밝으면 해), 누르면 반대로 바뀐다
export function ThemeToggle({
  className = "",
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={next === "dark" ? "어두운 화면으로 바꾸기" : "밝은 화면으로 바꾸기"}
      onClick={() => setTheme(next)}
      className={className}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className={iconClassName}>
        {theme === "dark" ? moon : sun}
      </svg>
    </button>
  );
}
