import Link from "next/link";

import { Icon, type IconName } from "@/shared/ui/icon";

// 결과를 보여 줄 수 없을 때의 카드(Figma 08 「State / 실행 실패」 Failed 720 × 190):
// 흰(surface-1) · 모서리 16 · 안쪽 22 · 24 · 20 · 24 · 칸 사이 14 · shadow-md.
// 머리(사이 12): 연한 원 36 안 아이콘 18 · 제목 Heading 20 · 이유 Caption 12 text-3.
// 고를 것 두 칸(사이 12, 각 모서리 10 · 안쪽 14 · 16 · 사이 8): 첫 칸 primary-soft + primary-line(권하는 것), 둘째 칸 surface-2.
// 지도 대신 바탕(bg-canvas) 가운데에 둔다 — 결과가 없으면 그릴 지역도 없다

export type StateChoice = {
  label: string;
  note: string;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

const tones = {
  red: "bg-status-red-soft text-status-red",
  gray: "bg-surface-2 text-text-2",
} as const;

function Choice({ choice, primary }: { choice: StateChoice; primary: boolean }) {
  const className = `flex flex-1 flex-col gap-2 rounded-[10px] px-4 py-3.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1 ${
    primary
      ? "bg-primary-soft inset-ring inset-ring-primary-line hover:bg-primary-soft/70"
      : "bg-surface-2 hover:bg-surface-3"
  }`;
  const body = (
    <>
      <span className={`text-label-13 ${primary ? "text-primary-text" : "text-text-1"}`}>
        {choice.label}
      </span>
      <span className="text-caption-12 text-text-2">{choice.note}</span>
    </>
  );
  return choice.href ? (
    <Link href={choice.href} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={choice.onClick} className={className}>
      {body}
    </button>
  );
}

export function StateCard({
  icon,
  tone,
  title,
  reason,
  choices,
  role = "status",
}: {
  icon: IconName;
  tone: keyof typeof tones;
  title: string;
  reason: string;
  /** 첫 칸이 권하는 것(앰버) */
  choices: [StateChoice, StateChoice];
  /** 오류는 alert(낭독기가 바로 읽음), 없는 결과는 status */
  role?: "status" | "alert";
}) {
  return (
    <main className="grid h-full place-items-center bg-bg-canvas p-6">
      <section
        role={role}
        aria-labelledby="state-title"
        className="flex w-full max-w-[720px] flex-col gap-3.5 rounded-2xl bg-surface-1 px-6 pt-5.5 pb-5 shadow-md"
      >
        <div className="flex items-center gap-3">
          <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tones[tone]}`}>
            <Icon name={icon} className="size-4.5" />
          </span>
          <div className="grid gap-0.5">
            <h1 id="state-title" className="text-heading-20 text-text-1">
              {title}
            </h1>
            <p className="text-caption-12 text-text-3">{reason}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Choice choice={choices[0]} primary />
          <Choice choice={choices[1]} primary={false} />
        </div>
      </section>
    </main>
  );
}
