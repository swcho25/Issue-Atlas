import type { HTMLAttributes } from "react";

// Figma v5/Status(2375:430): 높이 22 · 모서리 4 · 왼쪽 6 오른쪽 7 · 점 6 과 글자 사이 5 · IA5/Label 12.
// v5 화면에서 6 색조 모두 쓴다(121번). Figma 의 Tone=Violet 은 실제로 앰버(primary) 색이라 이름을 primary 로
export type StatusTone = "green" | "red" | "amber" | "blue" | "gray" | "primary";

const tones: Record<StatusTone, { box: string; dot: string }> = {
  green: { box: "bg-status-green-soft text-status-green", dot: "bg-status-green" },
  red: { box: "bg-status-red-soft text-status-red", dot: "bg-status-red" },
  amber: { box: "bg-status-amber-soft text-status-amber", dot: "bg-status-amber" },
  blue: { box: "bg-status-blue-soft text-status-blue", dot: "bg-status-blue" },
  gray: { box: "bg-status-gray-soft text-status-gray", dot: "bg-status-gray" },
  primary: { box: "bg-primary-soft text-primary-text", dot: "bg-primary" },
};

export function StatusBadge({
  tone,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone: StatusTone }) {
  return (
    <span
      className={`inline-flex h-5.5 shrink-0 items-center gap-1.25 rounded-sm pr-1.75 pl-1.5 text-label-12 whitespace-nowrap ${tones[tone].box} ${className}`}
      {...props}
    >
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${tones[tone].dot}`} />
      {children}
    </span>
  );
}
