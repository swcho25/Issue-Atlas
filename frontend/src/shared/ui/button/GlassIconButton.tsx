import type { ButtonHTMLAttributes } from "react";

import { Icon, type IconName } from "../icon";

// Figma Glass/Icon button(2410:657): 유리(흰 10% 위 흰 45% = glass-strong) · 흰 테두리 빛 · 0 4 14 · 12% · 아이콘 20 · text-1.
//   아이콘 형태 40 × 40 동그라미 — v5 화면 39번(각주 복사 copy · 저장 bookmark · 다시 실행 refresh). 저장은 두지 않는다(11/09, 질문은 자동 저장)
//   글자 형태 높이 40 · 왼쪽 14 오른쪽 16 · 아이콘과 글자 사이 6 · 굵게 14 — 1번(관리자 「2회차 실행」)
// 지도 · 결과 화면 위에 떠 있는 버튼이다. 흰 화면 위에는 쓰지 않는다(DESIGN.md 「유리는 아래에 볼 것이 있을 때만」).
// 호버 모습은 Figma 에 없어 채움만 한 단계 진하게
type GlassIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: IconName;
  /** 버튼 이름. 아이콘만 보일 때는 화면 낭독기 · 툴팁으로, showLabel 이면 글자로 보인다 */
  label: string;
  showLabel?: boolean;
};

export function GlassIconButton({
  icon,
  label,
  showLabel = false,
  className = "",
  type = "button",
  ...props
}: GlassIconButtonProps) {
  // glass 의 1px 선이 자리를 차지해(Figma 테두리는 안쪽) 여백을 1px 씩 줄여 Figma 14 · 16 에 맞춘다
  const shape = showLabel ? "h-10 gap-1.5 pr-3.75 pl-3.25" : "size-10 justify-center";
  return (
    <button
      type={type}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
      className={`inline-flex shrink-0 items-center rounded-full glass text-text-1 glass-strong hover:[--glass-fill:0.62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1 disabled:pointer-events-none disabled:opacity-40 ${shape} ${className}`}
      {...props}
    >
      <Icon name={icon} />
      {showLabel && (
        <span className="text-title-14 leading-[18px] font-bold whitespace-nowrap">{label}</span>
      )}
    </button>
  );
}
