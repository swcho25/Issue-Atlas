import type { IconName } from "@/shared/ui/icon";

// 왼쪽 띠 메뉴(Figma v5/Rail). 화면 주소는 여기 한 곳에만 둔다
export type MenuItem = {
  label: string;
  href: string;
  icon: IconName;
  /** true 면 주소가 정확히 같을 때만 고른 칸이 된다(하위 주소가 다른 메뉴인 경우) */
  exact?: boolean;
};

export const viewerMenu: MenuItem[] = [
  { label: "새 질문", href: "/ask", icon: "sparkle" },
  { label: "내 질문", href: "/me/questions", icon: "bookmark" },
];

export const adminMenu: MenuItem[] = [
  { label: "운영 요약", href: "/admin", icon: "chart", exact: true },
  { label: "검수", href: "/admin/reviews", icon: "shield" },
  { label: "카드", href: "/admin/cards", icon: "cards" },
  { label: "데이터 소스", href: "/admin/sources", icon: "db" },
];

export function isActive(item: MenuItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
