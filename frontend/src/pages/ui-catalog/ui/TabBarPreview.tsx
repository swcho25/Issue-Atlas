import { TabBar, type TabBarItem } from "@/shared/ui/tab-bar";

// Figma v3/Icon(grid · table · compare · doc). 결과 탭 위젯을 만들 때 그쪽으로 옮긴다
const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.45833,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;
const icon = (d: string) => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d={d} {...line} />
  </svg>
);

const items: TabBarItem[] = [
  {
    key: "summary",
    label: "요약",
    href: "#summary",
    icon: icon(
      "M3.75 2.5h3.33c.69 0 1.25.56 1.25 1.25v3.33c0 .69-.56 1.25-1.25 1.25H3.75c-.69 0-1.25-.56-1.25-1.25V3.75c0-.69.56-1.25 1.25-1.25ZM12.92 2.5h3.33c.69 0 1.25.56 1.25 1.25v3.33c0 .69-.56 1.25-1.25 1.25h-3.33c-.69 0-1.25-.56-1.25-1.25V3.75c0-.69.56-1.25 1.25-1.25ZM3.75 11.67h3.33c.69 0 1.25.56 1.25 1.25v3.33c0 .69-.56 1.25-1.25 1.25H3.75c-.69 0-1.25-.56-1.25-1.25v-3.33c0-.69.56-1.25 1.25-1.25ZM12.92 11.67h3.33c.69 0 1.25.56 1.25 1.25v3.33c0 .69-.56 1.25-1.25 1.25h-3.33c-.69 0-1.25-.56-1.25-1.25v-3.33c0-.69.56-1.25 1.25-1.25Z",
    ),
  },
  {
    key: "demand",
    label: "수요표",
    href: "#demand",
    icon: icon(
      "M4.17 3.33h11.66c.92 0 1.67.75 1.67 1.67v10c0 .92-.75 1.67-1.67 1.67H4.17c-.92 0-1.67-.75-1.67-1.67V5c0-.92.75-1.67 1.67-1.67ZM2.5 8.33h15M7.5 3.33v13.34M2.5 12.5h15",
    ),
  },
  {
    key: "argument",
    label: "논증",
    href: "#argument",
    icon: icon(
      "M3.75 3.33h4.17c.69 0 1.25.56 1.25 1.25v10.84c0 .69-.56 1.25-1.25 1.25H3.75c-.69 0-1.25-.56-1.25-1.25V4.58c0-.69.56-1.25 1.25-1.25ZM12.08 3.33h4.17c.69 0 1.25.56 1.25 1.25v10.84c0 .69-.56 1.25-1.25 1.25h-4.17c-.69 0-1.25-.56-1.25-1.25V4.58c0-.69.56-1.25 1.25-1.25Z",
    ),
  },
  {
    key: "source",
    label: "원문 16",
    href: "#source",
    icon: icon(
      "M11.67 2.5H5a.83.83 0 0 0-.83.83v13.34c0 .46.37.83.83.83h10c.46 0 .83-.37.83-.83v-10L11.67 2.5ZM11.67 2.5v4.17h4.16M7.5 10.83h5M7.5 14.17h3.33",
    ),
  },
];

// Figma 의 두 쓰임을 같은 폭으로: 04 결과 카드 안(350) · 05 오른쪽 패널(326)
export function TabBarPreview() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">탭 바</h2>
      <p className="mt-1 text-body-13 text-text-2">
        <code className="font-mono">
          {'<TabBar variant="clear|amber" items={…} current="…" />'}
        </code>
      </p>
      <div className="mt-6 flex flex-wrap items-start gap-10">
        <figure className="grid gap-2">
          <div className="w-[350px] rounded-2xl bg-surface-1 shadow-card">
            <TabBar variant="clear" items={items} current="summary" />
          </div>
          <figcaption className="text-caption-12 text-text-3">
            clear · 무색 렌즈 · 04 결과 카드 안
          </figcaption>
        </figure>
        <figure className="grid gap-2">
          <div className="w-[326px]">
            <TabBar variant="amber" items={items} current="demand" />
          </div>
          <figcaption className="text-caption-12 text-text-3">
            amber · 앰버 렌즈 · 05 패널
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
