import { ProvBadge, type ProvKind } from "@/shared/ui/badge";

// 05 · 논증 카드 패널: 「칸마다 누가 썼나」(surface-2 · 모서리 12 · 안쪽 14 · 칸 사이 8)와
// 「틀린 곳을 봤나요?」(테두리 1 · 안쪽 14 · 칸 사이 6)

const legend: { kind: ProvKind; text: string }[] = [
  { kind: "rule", text: "같은 입력이면 같은 출력 — 판단 · 한정어" },
  { kind: "card", text: "카드 양식에 미리 정한 문장 — 보증 · 상한선" },
  { kind: "ai", text: "문장 다듬기 · 반박 근거 유무 판정만" },
  { kind: "human", text: "관리자가 고친 칸" },
];

export function ArgumentPanel() {
  return (
    <>
      <section aria-label="칸마다 누가 썼나" className="grid gap-2 rounded-xl bg-surface-2 p-3.5">
        <h2 className="text-label-12 text-text-1">칸마다 누가 썼나</h2>
        <ul className="contents">
          {legend.map((l) => (
            <li key={l.kind} className="flex items-center gap-2">
              <ProvBadge kind={l.kind} />
              <span className="text-caption-12 text-text-2">{l.text}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-1.5 rounded-xl border border-border-1 p-3.5">
        <h2 className="text-label-13 text-text-1">틀린 곳을 봤나요?</h2>
        <p className="text-caption-12 text-text-2">
          칸의 ⋯ → 「오류 신고」로 수정 제안을 보내요. 원본은 바뀌지 않고, 관리자가 검수한 뒤 다음
          실행부터 반영돼요.
        </p>
      </section>
    </>
  );
}
