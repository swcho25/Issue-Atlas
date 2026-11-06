"use client";

import { type ReactNode, useEffect } from "react";

import { Icon, type IconName } from "@/shared/ui/icon";

/**
 * 잠깐 뜨는 알림(Figma v5/Toast Info: 높이 44 · 모서리 8 · 왼쪽 14 · 오른쪽 16 · 사이 10 · text-1 바탕 · Shadow md,
 * 아이콘 16 + Body 13). Figma 의 흰 글자는 토큰이 아니라 반대색(surface-1)으로. 4초 뒤 사라진다.
 * 자리는 className 으로(기본: 화면 아래 가운데)
 */
export function Toast({
  icon,
  iconClassName,
  onDone,
  className = "fixed bottom-8 left-1/2 -translate-x-1/2",
  children,
}: {
  icon: IconName;
  /** 아이콘 색(보냄 status-green · 실패 status-red …) */
  iconClassName: string;
  onDone: () => void;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      role="status"
      className={`z-toast flex h-11 items-center gap-2.5 rounded-lg bg-text-1 pr-4 pl-3.5 text-body-13 whitespace-nowrap text-surface-1 shadow-md ${className}`}
    >
      <Icon name={icon} className={`size-4 ${iconClassName}`} />
      {children}
    </div>
  );
}
