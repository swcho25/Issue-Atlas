import { SegmentLinks } from "@/shared/ui/segment";

// 데이터 소스 위쪽 탭: 출처 · 수집 이력 · CSV 요청(칸마다 건수)
export function SourcesNav({
  current,
  counts,
}: {
  current: "sources" | "jobs" | "imports";
  counts: { sources: number; jobs: number; imports: number };
}) {
  return (
    <SegmentLinks
      label="데이터 소스"
      items={[
        { key: "sources", label: "출처", href: "/admin/sources" },
        { key: "jobs", label: "수집 이력", href: "/admin/sources/jobs" },
        { key: "imports", label: "CSV 요청", href: "/admin/sources/imports" },
      ].map((t) => ({
        ...t,
        count: counts[t.key as keyof typeof counts],
        active: current === t.key,
      }))}
    />
  );
}

/** CSV 요청 네 단계(Figma 「데이터 소스 추가」). 지금 단계까지 앰버 */
export function ImportSteps({ at }: { at: 1 | 2 | 3 | 4 }) {
  const steps = ["CSV 올리기", "자동 검증", "담당자 적재", "결과 보고"];
  return (
    <ol className="flex flex-wrap items-center gap-3">
      {steps.map((label, i) => {
        const n = i + 1;
        const on = n <= at;
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="h-px w-10 bg-border-2" />}
            <span
              aria-current={n === at ? "step" : undefined}
              className={`grid size-6 place-items-center rounded-full text-label-12 ${
                on ? "bg-primary-soft text-primary-text" : "bg-surface-2 text-text-3"
              }`}
            >
              {n}
            </span>
            <span className={`text-label-13 ${on ? "text-text-1" : "text-text-3"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
