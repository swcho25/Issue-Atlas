import type { MenuIcon } from "../model/menu";

// Figma v3/Icon 에서 내보낸 20px 아이콘. 색은 currentColor 라 글자색을 따른다
const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.45833,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const paths: Record<MenuIcon, React.ReactNode> = {
  sparkle: (
    <path
      d="M10 2.08 11.75 7.25 17.08 9.17 11.75 11.08 10 16.25 8.25 11.08 2.92 9.17 8.25 7.25 10 2.08Z"
      fill="currentColor"
    />
  ),
  bookmark: <path d="M5 2.5H15V17.5L10 14.17 5 17.5V2.5Z" {...line} />,
  chart: <path d="M3.33 3.33V16.67H16.67M6.67 13.33V10M10 13.33V6.67M13.33 13.33V8.33" {...line} />,
  shield: (
    <path
      d="M10 2.5 3.33 5V10C3.33 13.75 6.17 16.83 10 17.5 13.83 16.83 16.67 13.75 16.67 10V5L10 2.5ZM7.5 10 9.17 11.67 12.5 8.33"
      {...line}
    />
  ),
  cards: (
    <path
      d="M4.17 5H11.67C12.59 5 13.33 5.75 13.33 6.67V15.83C13.33 16.75 12.59 17.5 11.67 17.5H4.17C3.25 17.5 2.5 16.75 2.5 15.83V6.67C2.5 5.75 3.25 5 4.17 5ZM6.67 2.5H15.83C16.28 2.5 16.7 2.68 17.01 2.99 17.32 3.3 17.5 3.72 17.5 4.17V14.17"
      {...line}
    />
  ),
  db: (
    <path
      d="M16.67 4.58C16.67 5.73 13.68 6.67 10 6.67 6.32 6.67 3.33 5.73 3.33 4.58 3.33 3.43 6.32 2.5 10 2.5 13.68 2.5 16.67 3.43 16.67 4.58ZM3.33 4.58V15.42C3.33 16.58 6.33 17.5 10 17.5 13.67 17.5 16.67 16.58 16.67 15.42V4.58M3.33 10C3.33 11.17 6.33 12.08 10 12.08 13.67 12.08 16.67 11.17 16.67 10"
      {...line}
    />
  ),
};

export function RailIcon({ name, className }: { name: MenuIcon; className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      {paths[name]}
    </svg>
  );
}
