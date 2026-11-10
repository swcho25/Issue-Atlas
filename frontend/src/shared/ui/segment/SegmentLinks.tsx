import Link from "next/link";

export type SegmentItem = {
  key: string;
  label: string;
  count?: number;
  /** 알림 숫자(앰버 동그라미). 처리할 것이 있을 때만 준다 — 0 이나 없음이면 그리지 않는다 */
  badge?: { count: number; label: string };
  href: string;
  active: boolean;
};

/** 링크 탭(회색 틀 · 고른 칸 흰색 · 개수 · 알림 숫자). 칸은 링크라 주소가 상태다(뒤로 가기 · 새로 고침 · 공유) */
export function SegmentLinks({ label, items }: { label: string; items: SegmentItem[] }) {
  return (
    <nav aria-label={label} className="inline-flex w-fit gap-0.5 rounded-lg bg-surface-2 p-0.75">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex h-7.5 items-center gap-1.5 rounded-md px-3 text-label-13 whitespace-nowrap ${
            t.active ? "bg-surface-1 text-text-1 shadow-xs" : "text-text-2 hover:text-text-1"
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="text-caption-11 text-text-3">{t.count}</span>}
          {t.badge && t.badge.count > 0 && (
            <span
              title={t.badge.label}
              className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-caption-11 text-text-on-primary tabular-nums"
            >
              {t.badge.count}
              <span className="sr-only"> {t.badge.label}</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
