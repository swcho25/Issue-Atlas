import type { ReactNode } from "react";

// 손잡이: 튕기듯 미끄러진다(끝에서 살짝 넘쳤다 돌아옴). 누르면 늘어나 유리 방울이 되고, 놓으면 제 크기로
const knobMotion =
  "transition-[translate,width,height,top,left,background-color,box-shadow,backdrop-filter] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]";

/**
 * 토글(Figma Toggle 2360:388): 52 × 32 · 손잡이 28. 꺼짐 = 맑은 유리 트랙 · 흰 손잡이, 켜짐 = 빛고을 앰버 80% + 유리 테두리,
 * 누르는 동안 손잡이가 36 × 32 로 늘어나 유리 방울이 된다. 비활성은 전체 40%.
 * 켜짐 · 꺼짐을 색으로만 알리지 않게 이름(label)은 꼭 준다. 손잡이 안 작은 그림(knob)은 고를 때만.
 * animate 를 끄면 움직임 없이 그 자리에 놓인다(처음 그릴 때 저장된 값으로 건너뛸 때)
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  knob,
  animate = true,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  knob?: ReactNode;
  animate?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group relative inline-flex h-8 w-13 shrink-0 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1 disabled:cursor-default disabled:opacity-40 ${className}`}
    >
      <span aria-hidden="true" className="absolute inset-0 rounded-full toggle-track" />
      <span
        aria-hidden="true"
        className={`absolute inset-0 rounded-full toggle-track-on ${animate ? "transition-opacity duration-300" : ""} ${checked ? "opacity-100" : "opacity-0"}`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 flex size-7 items-center justify-center rounded-full toggle-knob text-black/55 group-active:top-0 group-active:left-0 group-active:h-8 group-active:w-9 group-active:toggle-knob-drop [&_svg]:size-3.5 ${animate ? knobMotion : ""} ${checked ? "translate-x-5 group-active:translate-x-4" : ""}`}
      >
        {knob}
      </span>
    </button>
  );
}
