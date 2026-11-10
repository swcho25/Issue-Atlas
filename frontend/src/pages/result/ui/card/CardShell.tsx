"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { BackButton } from "@/shared/ui/button";

// 04 결과 카드의 틀과 머리(Figma 04 Panel · Header · sticky).
// 틀: 왼쪽 24 · 위아래 20 · 폭 400 · 모서리 22 · 안쪽 24 · 24 · 16 · 24 · 칸 사이 18 · 테두리 text-1 6%(자리 차지) · shadow-card.
// 머리는 처음부터 작은 머리(Figma 「카드를 내렸을 때」: 뒤로 + 제목 한 줄 · 사이 10 → 탭, 아래 12)로 고정한다(사용자 결정).
// 내릴 때 머리 모양이 바뀌면 배치가 흔들려서다. 머리는 스크롤 칸 밖, 탭 아래 본문만 스크롤하고,
// 내렸을 때만 머리 아래 선 · 그림자로 「밑에 더 있다」를 알린다(선은 늘 자리를 차지해 높이가 바뀌지 않는다).
// 아래 안쪽 16 은 스크롤 칸 밖이라 모서리 곡선을 지킨다.
// 스크롤 막대는 바탕 없는 4px 표시(Figma scroll indicator: 오른쪽 4 · 둥글게 · 검정 18%)
export function CardShell({
  title,
  tabs,
  children,
}: {
  title: string;
  /** 머리의 탭 바(요약 · 수요표 · 논증 · 원문) */
  tabs: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);

  // 스크롤 표시 위치 · 길이(내용이 넘칠 때만)
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setScrolled(scrollTop > 0);
    if (scrollHeight <= clientHeight + 1) return setThumb(null);
    const height = Math.max(24, (clientHeight * clientHeight) / scrollHeight);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
    setThumb({ top, height });
  }, []);

  // 창 크기 · 내용이 바뀌면 표시를 다시 잰다
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  // 뒤로: 앞 화면이 있으면 그리로, 바로 들어왔으면 새 질문으로
  const back = () => (window.history.length > 1 ? router.back() : router.push("/ask"));

  return (
    <section
      aria-label="결과 요약"
      className="absolute top-5 bottom-5 left-6 z-panel flex w-[400px] flex-col overflow-hidden rounded-[22px] border border-text-1/6 bg-surface-1 pb-4 shadow-card"
    >
      <header
        className={`relative z-control flex shrink-0 flex-col gap-3 border-b px-6 pt-6 pb-3 ${scrolled ? "border-border-1 shadow-md" : "border-transparent"}`}
      >
        <div className="flex items-center gap-2.5">
          <BackButton onClick={back} />
          {/* Figma 작은 머리 제목 18 Bold 는 토큰이 없어 Heading 20 */}
          <h1 className="min-w-0 truncate text-heading-20 text-text-1">{title}</h1>
        </div>
        {tabs}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={measure}
          className="h-full [scrollbar-width:none] overflow-y-auto px-6 pt-4.5 [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex flex-col gap-4.5">{children}</div>
        </div>
        {thumb && (
          <div
            aria-hidden
            className="pointer-events-none absolute right-1 w-1 rounded-full bg-text-1/18"
            style={{ top: thumb.top, height: thumb.height }}
          />
        )}
      </div>
    </section>
  );
}
