"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useTheme } from "@/shared/lib/theme";
import { AtlasMark } from "@/shared/ui/logo";

import { adminMenu, isActive, type MenuItem, viewerMenu } from "../model/menu";
import { RailIcon } from "./icons";
import { ThemeToggle } from "./ThemeToggle";

type AppRailProps = {
  /** 관리자는 조회자 메뉴 아래 구분선 다음에 관리 메뉴가 더 붙는다 */
  role?: "viewer" | "admin";
  /** 로그인한 사람 이름. 있으면 맨 아래 첫 글자 동그라미를 보여 준다 */
  userName?: string;
  /** 견본 페이지처럼 실제 주소와 다른 칸을 고른 모습으로 보일 때만 넘긴다 */
  currentPath?: string;
  className?: string;
};

// 왼쪽 띠(Figma v5/Rail): 폭 72, 위아래 18, 칸 사이 6. 메뉴 칸 60 × 56 · 모서리 14.
// 안의 크기는 모두 「Figma 숫자 × --u」. --u 하나로 띠 전체 비율을 바꾼다.
// 16:10 노트북에서 Figma(16:9, 1600 × 900) 크기 그대로면 두꺼워 보여 90% 로 둔다(2026-11-03 사용자 확인)
const RAIL_UNIT = "[--u:0.9px]";

export function AppRail({ role = "viewer", userName, currentPath, className = "" }: AppRailProps) {
  const pathname = usePathname();
  const path = currentPath ?? pathname ?? "";
  const [logoOpen, setLogoOpen] = useState(false);
  const theme = useTheme();

  const item = (menu: MenuItem) => {
    const active = isActive(menu, path);
    return (
      <Link
        key={menu.href}
        href={menu.href}
        aria-current={active ? "page" : undefined}
        className="flex h-[calc(56*var(--u))] w-[calc(60*var(--u))] flex-col items-center justify-center gap-[calc(4*var(--u))] rounded-[calc(14*var(--u))] text-text-2 hover:text-text-1 aria-[current=page]:bg-surface-3 aria-[current=page]:text-text-1"
      >
        <RailIcon name={menu.icon} className="size-[calc(20*var(--u))]" />
        {/* Figma 글자 11px(caption-11 크기 · 줄 높이)에 같은 비율을 곱한다 */}
        <span
          className={`text-[length:calc(11*var(--u))] leading-[calc(14*var(--u))] whitespace-nowrap ${active ? "font-bold" : "font-medium"}`}
        >
          {menu.label}
        </span>
      </Link>
    );
  };

  return (
    <aside
      className={`${RAIL_UNIT} flex w-[calc(72*var(--u))] shrink-0 flex-col items-center gap-[calc(6*var(--u))] border-r border-border-1 bg-bg-sidebar py-[calc(18*var(--u))] ${className}`}
    >
      {/* 로고에 올리면 지도책이 펼쳐진다(docs/design/logo.md) */}
      <Link
        href="/"
        aria-label="Issue Atlas 처음 화면"
        className="mb-[calc(18*var(--u))]"
        onPointerEnter={() => setLogoOpen(true)}
        onPointerLeave={() => setLogoOpen(false)}
        onFocus={() => setLogoOpen(true)}
        onBlur={() => setLogoOpen(false)}
      >
        {/* 어두운 바탕에서는 종이 톤(docs/design/logo.md) */}
        <AtlasMark
          open={logoOpen}
          tone={theme === "dark" ? "paper" : "ink"}
          className="h-[calc(28*var(--u))] w-[calc(30*var(--u))]"
        />
      </Link>

      <nav aria-label="주 메뉴" className="contents">
        {viewerMenu.map(item)}
        {role === "admin" && (
          <>
            <div
              role="separator"
              className="mb-[calc(8*var(--u))] h-px w-[calc(32*var(--u))] bg-border-2"
            />
            {adminMenu.map(item)}
          </>
        )}
      </nav>

      {/* Figma 의 설정 자리. 설정 화면이 아직 없어 다크 모드 전환으로 쓴다(아이콘도 Figma 의 해 모양 그대로) */}
      <ThemeToggle
        className="mt-auto grid size-[calc(44*var(--u))] place-items-center rounded-full text-text-1 hover:bg-surface-2"
        iconClassName="size-[calc(20*var(--u))]"
      />
      {userName && (
        <div
          aria-label={`${userName} 계정`}
          className="grid size-[calc(32*var(--u))] place-items-center rounded-full bg-surface-3 text-[length:calc(13*var(--u))] font-bold"
        >
          {userName.slice(0, 1)}
        </div>
      )}
    </aside>
  );
}
