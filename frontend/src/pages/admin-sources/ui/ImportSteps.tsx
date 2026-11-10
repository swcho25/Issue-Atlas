/** CSV 요청 네 단계(Figma 「데이터 소스 추가」). 지금 단계까지 앰버 */
export function ImportSteps({ at }: { at: 1 | 2 | 3 | 4 }) {
  const steps = ["CSV 올리기", "자동 검증", "담당자 반영", "결과 보고"];
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
