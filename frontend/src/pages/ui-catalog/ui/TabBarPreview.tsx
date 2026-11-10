import { Icon } from "@/shared/ui/icon";
import { TabBar, type TabBarItem } from "@/shared/ui/tab-bar";

const items: TabBarItem[] = [
  { key: "summary", label: "요약", href: "#summary", icon: <Icon name="grid" /> },
  { key: "demand", label: "자료 현황", href: "#demand", icon: <Icon name="table" /> },
  { key: "argument", label: "분석 근거", href: "#argument", icon: <Icon name="compare" /> },
  { key: "source", label: "출처 16", href: "#source", icon: <Icon name="doc" /> },
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
