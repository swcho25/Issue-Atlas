import Link from "next/link";
import type { ReactNode } from "react";

import type { Argument } from "@/shared/api";
import { BackIcon, backButtonClass, buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { TabBar } from "@/shared/ui/tab-bar";

import { type DetailTab, resultTabs, summaryHref } from "./tabs";

// 실행 시각을 한국 시간 「MM-DD HH:mm」으로(Figma 「1회차 · 10-28 10:00」. 회차는 응답에 없어 시각만)
const runAt = (iso: string) => {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
};

/**
 * 05 화면 틀(근거 수요표 · 논증 카드 · 원문). Figma 05: 왼쪽 띠 다음 본문(안쪽 24 · 28, 칸 사이 16)과
 * 오른쪽에 떠 있는 패널(폭 368, 가장자리 16, 모서리 20, 안쪽 16 · 20, 칸 사이 14).
 * 패널: 탭 바(앰버) → 탭마다 다른 내용 → 맨 아래 「지도로 돌아가기」
 */
export function DetailFrame({
  argument,
  tab,
  title,
  caption,
  action,
  panel,
  children,
}: {
  argument: Argument;
  tab: DetailTab;
  title: string;
  caption?: string;
  /** 제목 오른쪽 버튼(CSV로 내려받기 · 각주 전체 복사 …) */
  action?: ReactNode;
  /** 패널의 탭별 내용(실행 상태 · 칸마다 누가 썼나 …) */
  panel?: ReactNode;
  children: ReactNode;
}) {
  const back = summaryHref(argument.run_id);
  return (
    <div className="flex h-full">
      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-7 py-6">
        <div className="flex items-center gap-2">
          {/* Figma Button/뒤로. 05 에서는 결과 지도(요약)로 가는 링크라 모양만 빌려 쓴다 */}
          <Link
            href={back}
            aria-label="결과 지도로"
            title="결과 지도로"
            className={backButtonClass()}
          >
            <BackIcon />
          </Link>
          <span className="text-caption-12 text-text-2">실행 · {runAt(argument.created_at)}</span>
        </div>

        <header className="flex items-center gap-3">
          <div className="grid min-w-0 flex-1 gap-1">
            <h1 className="text-heading-24">{title}</h1>
            {caption && <p className="text-caption-12 text-text-3">{caption}</p>}
          </div>
          {action}
        </header>

        {children}
      </main>

      {/* 패널 자리(폭 368). 패널은 그 안에서 가장자리 16 을 두고 떠 있어 본문 쪽으로 16 겹친다(Figma 그대로) */}
      <div className="relative w-[368px] shrink-0">
        <aside
          aria-label="결과 보기 패널"
          // Figma 테두리 1px 이 여백에 들어가(안쪽 20 · 16 + 1) 내용이 21 · 17 에서 시작한다. inset-ring 은 자리를 안 차지해 여백에 1 을 더한다
          className="absolute top-4 right-4 bottom-4 z-panel flex w-[368px] flex-col gap-3.5 overflow-y-auto rounded-[20px] bg-surface-1 px-5.25 py-4.25 shadow-panel inset-ring inset-ring-text-1/6"
        >
          <TabBar variant="amber" items={resultTabs(argument)} current={tab} />
          {panel}
          <Link
            href={back}
            className={buttonClass({ variant: "secondary", className: "mt-auto w-full" })}
          >
            <Icon name="map" />
            지도로 돌아가기
          </Link>
        </aside>
      </div>
    </div>
  );
}
