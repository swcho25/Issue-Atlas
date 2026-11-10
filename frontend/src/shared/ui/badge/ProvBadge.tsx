import { Icon } from "../icon";

// Figma v5/Prov badge(2375:449): 논증 카드 칸을 누가 채웠는지. 높이 18 · 모서리 4 · 왼쪽 4 오른쪽 5 ·
// 아이콘 10 과 글자 사이 3 · IA5/Label 12. 네 종류 모두 같은 반짝 아이콘(v3/Icon sparkle)
export type ProvKind = "rule" | "card" | "ai" | "human";

// 바탕은 Figma 값 그대로: 규칙 · 카드는 자기 색 10%, AI 는 먹색 10%, 검수는 status-amber 10%(prov-human 이 아니다)
const kinds: Record<ProvKind, { label: string; className: string }> = {
  rule: { label: "규칙", className: "bg-prov-rule/10 text-prov-rule" },
  card: { label: "카드", className: "bg-prov-card/10 text-prov-card" },
  ai: { label: "AI", className: "bg-text-1/10 text-prov-ai" },
  human: { label: "검수", className: "bg-status-amber/10 text-prov-human" },
};

export function ProvBadge({ kind, className = "" }: { kind: ProvKind; className?: string }) {
  return (
    <span
      className={`inline-flex h-4.5 shrink-0 items-center gap-0.75 rounded-sm pr-1.25 pl-1 text-label-12 whitespace-nowrap ${kinds[kind].className} ${className}`}
    >
      <Icon name="sparkle" className="size-2.5" />
      {kinds[kind].label}
    </span>
  );
}
