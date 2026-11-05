import { Icon, type IconName } from "@/shared/ui/icon";

// v5 화면에서 쓰는 v3/Icon 30개. 크기는 Figma 에서 쓰인 10 – 24 중 대표 셋
const names: IconName[] = [
  "alert",
  "bookmark",
  "cards",
  "chart",
  "check",
  "chevronDown",
  "chevronRight",
  "close",
  "compare",
  "copy",
  "db",
  "doc",
  "download",
  "external",
  "grid",
  "home",
  "layers",
  "locate",
  "lock",
  "map",
  "minus",
  "more",
  "play",
  "plus",
  "refresh",
  "search",
  "settings",
  "shield",
  "sparkle",
  "table",
];

export function IconPreview() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">아이콘</h2>
      <p className="mt-1 text-body-13 text-text-2">
        <code className="font-mono">{'<Icon name="check" className="size-4" label?="…" />'}</code>
        {" · "}색은 글자색, 크기는 className 또는 부모의{" "}
        <code className="font-mono">[&_svg]:size-*</code>
      </p>
      <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
        {names.map((name) => (
          <li
            key={name}
            data-icon={name}
            className="grid justify-items-center gap-2 rounded-lg border border-border-1 p-3 text-text-1"
          >
            <span className="flex items-end gap-3">
              <Icon name={name} className="size-4" />
              <Icon name={name} />
              <Icon name={name} className="size-6" />
            </span>
            <span className="font-mono text-caption-12 text-text-3">{name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
