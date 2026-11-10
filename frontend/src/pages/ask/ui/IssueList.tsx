import { Icon } from "@/shared/ui/icon";

import { evidenceKinds, evidenceLabel, type IssueCard } from "../model/schema";

/** 근거 4종 막대(있음 = 초록, 없음 = 주황) + n/4종. 근거의 품질 · 문제의 심각도가 아니라 종류 수다 */
function EvidenceBars({ card }: { card: IssueCard }) {
  const status = new Map(card.evidence.map((e) => [e.kind, e.status]));
  return (
    <div
      className="flex shrink-0 flex-col items-end gap-1.5"
      aria-label={`근거 4종 중 ${card.available_kinds}종`}
    >
      <div className="flex gap-1" aria-hidden="true">
        {evidenceKinds.map((k) => (
          <span
            key={k}
            className={`h-1 w-4.5 rounded-full ${status.get(k) === "available" ? "bg-status-green" : "bg-status-amber"}`}
          />
        ))}
      </div>
      <span className="text-caption-12 text-text-2">근거 {card.available_kinds}/4종</span>
    </div>
  );
}

/** 있는 근거 · 없는 근거를 한 줄로 */
function evidenceLine(card: IssueCard) {
  if (card.available_kinds === 0) return "근거를 아직 모으지 않았어요 — 실행하면 빈칸도 결과예요";
  const has = card.evidence
    .filter((e) => e.status === "available")
    .map((e) => evidenceLabel[e.kind]);
  const missing = card.evidence
    .filter((e) => e.status !== "available")
    .map((e) => evidenceLabel[e.kind]);
  return `${has.join(" · ")} 있음${missing.length ? ` · ${missing.join(" · ")} 없음` : ""}`;
}

function IssueRow({
  card,
  selected,
  onSelect,
}: {
  card: IssueCard;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex min-h-17.5 w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-text-1 ${
        selected ? "bg-surface-3" : "hover:bg-surface-2"
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="text-heading-16 text-text-1">{card.name}</span>
          <span className="text-caption-12 text-text-3">
            {card.domain.replace(/^[A-Z]\s+/, "")}
          </span>
        </span>
        <span className="truncate text-body-13 text-text-2">{evidenceLine(card)}</span>
      </span>
      <EvidenceBars card={card} />
      <Icon name="check" className={`size-4 text-primary-text ${selected ? "" : "invisible"}`} />
    </button>
  );
}

function Group({
  tone,
  title,
  meta,
  children,
}: {
  tone: "green" | "gray";
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 pb-1">
        <span
          className={`size-2 rounded-full ${tone === "green" ? "bg-status-green" : "bg-status-gray"}`}
          aria-hidden="true"
        />
        <span className="text-title-14 font-bold text-text-1">{title}</span>
        <span className="text-body-13 text-text-3">{meta}</span>
      </div>
      {children}
    </div>
  );
}

/** 이슈 목록: 근거가 있어 판단할 수 있는 것 / 아직 근거가 없는 것으로 나눈다(점수 · 순위 없음) */
export function IssueList({
  cards,
  selectedId,
  onSelect,
}: {
  cards: IssueCard[];
  selectedId?: string;
  onSelect: (cardId: string) => void;
}) {
  const ready = cards.filter((c) => c.available_kinds > 0);
  const waiting = cards.filter((c) => c.available_kinds === 0);
  const row = (c: IssueCard) => (
    <IssueRow
      key={c.card_id}
      card={c}
      selected={c.card_id === selectedId}
      onSelect={() => onSelect(c.card_id)}
    />
  );
  return (
    <div role="radiogroup" aria-label="이슈" className="flex flex-col gap-4.5">
      {ready.length > 0 && (
        <Group tone="green" title="판단할 수 있어요" meta="근거가 있어요">
          {ready.map(row)}
        </Group>
      )}
      {waiting.length > 0 && (
        <Group tone="gray" title="아직 답할 수 없어요" meta="필수 근거 없음">
          {waiting.map(row)}
        </Group>
      )}
    </div>
  );
}
