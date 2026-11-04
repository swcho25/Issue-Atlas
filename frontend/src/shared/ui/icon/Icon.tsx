import { iconPaths } from "./paths";

export type IconName = keyof typeof iconPaths;

// 판이 20 이고 선 굵기가 판에 붙어 있어, 크기를 바꾸면 Figma 처럼 선도 같은 비율로 바뀐다(16 → 1.17 · 24 → 1.75).
// 크기는 className(size-4 …)이나 부모의 [&_svg]:size-* 로, 색은 글자색(currentColor)을 따른다
export function Icon({
  name,
  label,
  className = "size-5",
}: {
  name: IconName;
  /** 아이콘만으로 뜻을 전할 때(글자 없는 버튼 등) 화면 낭독기용 이름. 없으면 장식으로 숨긴다 */
  label?: string;
  className?: string;
}) {
  const icon: { d: string; fill?: true } = iconPaths[name];
  return (
    <svg
      viewBox="0 0 20 20"
      className={`shrink-0 ${className}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {icon.fill ? (
        <path d={icon.d} fill="currentColor" />
      ) : (
        <path
          d={icon.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.45833}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
