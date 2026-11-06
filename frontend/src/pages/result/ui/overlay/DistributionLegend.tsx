import { aqGrades } from "../../model/distribution";

/**
 * 분포형 범례(Figma Legend 234 × 98: 흰 면 · 모서리 12 · 먹색 6% 선 · shadow-legend · 안쪽 10 · 12 · 사이 6).
 * 제목 Medium 12 「측정소 값, 도시 평균 아님」, 등급 4개(점 8 · 11) · 결측(빈 점) · 아래 줄 text-3 11
 */
export function DistributionLegend() {
  return (
    <section
      aria-label="분포형 범례"
      className="flex flex-col gap-1.5 rounded-xl border border-text-1/6 bg-surface-1 px-3 py-2.5 shadow-legend"
    >
      <p className="text-label-12 text-text-1">측정소 값, 도시 평균 아님</p>
      <ul className="flex gap-2.5">
        {aqGrades.map((g) => (
          <li key={g.key} className="flex items-center gap-1 text-caption-11 text-text-2">
            <span aria-hidden className={`size-2 rounded-full ${g.className}`} />
            {g.label}
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1 text-caption-11 text-text-2">
        <span aria-hidden className="size-2 rounded-full border-[1.5px] border-text-3" />
        결측 — 값 없이 사유만
      </p>
      <p className="text-caption-11 text-text-3">크기 = 월평균 · 색 = 환경부 4단계 (월평균 기준)</p>
    </section>
  );
}
