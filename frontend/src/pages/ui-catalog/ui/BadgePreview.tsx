import { ProvBadge, type ProvKind, StatusBadge, type StatusTone } from "@/shared/ui/badge";

// v5 화면에서 실제로 쓰인 글자로. data-figma 는 자동 대조용 Figma 변형 이름
const statuses: { tone: StatusTone; label: string; figma: string }[] = [
  { tone: "green", label: "수집 완료", figma: "Green" },
  { tone: "red", label: "비교 불가", figma: "Red" },
  { tone: "amber", label: "미수집", figma: "Amber" },
  { tone: "blue", label: "검증 대기", figma: "Blue" },
  { tone: "gray", label: "미공표", figma: "Gray" },
  { tone: "primary", label: "지역 매핑", figma: "Violet" },
];
const provs: ProvKind[] = ["rule", "card", "ai", "human"];

export function BadgePreview() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">배지</h2>
      <p className="mt-1 text-body-13 text-text-2">
        <code className="font-mono">
          {'<StatusBadge tone="green|red|amber|blue|gray|primary">'}
        </code>
        {" · "}
        <code className="font-mono">{'<ProvBadge kind="rule|card|ai|human" />'}</code>
      </p>
      <div className="mt-6 grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-16 text-caption-12 text-text-3">상태</span>
          {statuses.map(({ tone, label, figma }) => (
            <StatusBadge key={tone} tone={tone} data-figma={figma}>
              {label}
            </StatusBadge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-16 text-caption-12 text-text-3">출처</span>
          {provs.map((kind) => (
            <ProvBadge key={kind} kind={kind} />
          ))}
        </div>
      </div>
    </section>
  );
}
