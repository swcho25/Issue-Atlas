import Link from "next/link";

export type SegmentItem = {
  key: string;
  label: string;
  count?: number;
  /** 처리할 것이 있다는 알림: 글자 앞 빨간 점(왼쪽 띠 메뉴 알림 점과 같은 모양) */
  alert?: boolean;
  href: string;
  active: boolean;
};

/** 링크 탭(회색 틀 · 고른 칸 흰색 · 개수 · 알림 점). 칸은 링크라 주소가 상태다(뒤로 가기 · 새로 고침 · 공유) */
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
          {t.alert && <span aria-hidden className="size-2 shrink-0 rounded-full bg-status-red" />}
          {t.label}
          {t.count !== undefined && <span className="text-caption-11 text-text-3">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
