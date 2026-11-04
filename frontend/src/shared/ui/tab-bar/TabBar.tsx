import Link from "next/link";
import type { ReactNode } from "react";

// Figma Tab bar/Item(2366:394): 알약 틀 높이 64 · 안쪽 4 · 칸 76 × 56 균등 배치 · 아이콘 24 · 간격 3 · SemiBold 12.
// 결과(요약) 카드와 05 화면(수요표 · 논증 · 원문)을 오가므로 링크 탭이다
export type TabBarItem = {
  key: string;
  label: string;
  href: string;
  /** 24px 아이콘(svg). 색은 글자색을 따른다 */
  icon: ReactNode;
};

// 고른 칸 렌즈 색으로 나눈다. 모양만 정하고, 이동은 href 가 정한다
// clear = 무색 렌즈 · surface-2 단색 틀(04 결과 카드 안), amber = 앰버 렌즈 · 유리 틀(05 오른쪽 패널)
export type TabBarVariant = "clear" | "amber";

const frames: Record<TabBarVariant, string> = {
  clear: "bg-surface-2",
  amber: "tab-glass",
};
const lenses: Record<TabBarVariant, string> = {
  clear: "lens-clear",
  amber: "lens-amber",
};

export function TabBar({
  items,
  current,
  variant = "amber",
  label = "결과 보기",
  className = "",
}: {
  items: TabBarItem[];
  /** 고른 칸의 key */
  current: string;
  variant?: TabBarVariant;
  /** 화면 낭독기용 이름 */
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ul className={`flex h-16 justify-between rounded-full p-1 ${frames[variant]}`}>
        {items.map((item) => {
          const active = item.key === current;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 w-19 flex-col items-center justify-center gap-0.75 rounded-full text-text-1 [&_svg]:size-6 ${active ? lenses[variant] : "hover:bg-text-1/5"}`}
              >
                {item.icon}
                <span className="text-label-12 leading-[15px] font-semibold whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
