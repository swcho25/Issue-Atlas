import type { ButtonHTMLAttributes, ReactNode } from "react";

// Figma v5/Button(2375:396): 알약 · 가운데 정렬 · 아이콘과 글자 사이 6.
// Figma 에는 AI · Danger 도 있지만 v5 화면에서 쓰이지 않아(37번 중 0) 만들지 않았다. 쓰는 화면이 생기면 더한다
export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "m" | "s";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1 " +
  "disabled:pointer-events-none disabled:opacity-40";

// M: 높이 36 · 좌우 14 · Label 13 · 아이콘 16 / S: 높이 30 · 좌우 10 · Label 12 · 아이콘 14
const sizes: Record<ButtonSize, string> = {
  m: "h-9 px-3.5 text-label-13 [&_svg]:size-4",
  s: "h-7.5 px-2.5 text-label-12 [&_svg]:size-3.5",
};

// 호버 모습은 Figma 에 없다. Primary 만 DESIGN.md 의 primary-hover, 나머지는 바탕 한 단계(가장 작게)
const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-text-on-primary shadow-button hover:bg-primary-hover",
  // Figma 테두리는 안쪽(INSIDE)이라 여백을 차지하지 않는다. border 대신 inset-ring 으로
  secondary:
    "bg-surface-1 text-text-1 shadow-button-soft inset-ring inset-ring-border-2 hover:bg-surface-2",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text-1",
};

/** Link 처럼 button 이 아닌 요소를 버튼 모양으로 그릴 때 쓴다 */
export function buttonClass({
  variant = "primary",
  size = "m",
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 글자 앞 아이콘(svg). 색은 글자색을 따른다 */
  icon?: ReactNode;
};

// 창을 닫거나 다른 화면으로 넘기는 버튼이 많아 누름 움직임(줄어들기)은 넣지 않는다(DESIGN.md 「하지 말 것」)
export function Button({
  variant = "primary",
  size = "m",
  icon,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...props}>
      {icon}
      {children}
    </button>
  );
}
