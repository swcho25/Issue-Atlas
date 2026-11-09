import Link from "next/link";

/** 쪽 넘기기(이전 · n / 끝 · 다음). 한 쪽뿐이면 그리지 않는다 */
export function Pager({
  page,
  size,
  total,
  hrefFor,
}: {
  page: number;
  size: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const last = Math.max(1, Math.ceil(total / size));
  if (last <= 1) return null;
  const step = "rounded-md px-2.5 py-1 text-label-13";
  return (
    <nav
      aria-label="쪽"
      className="flex items-center justify-center gap-3 text-body-13 text-text-2"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={`${step} hover:bg-surface-2`}>
          이전
        </Link>
      ) : (
        <span className={`${step} text-text-3`}>이전</span>
      )}
      <span>
        {page} / {last}
      </span>
      {page < last ? (
        <Link href={hrefFor(page + 1)} className={`${step} hover:bg-surface-2`}>
          다음
        </Link>
      ) : (
        <span className={`${step} text-text-3`}>다음</span>
      )}
    </nav>
  );
}
