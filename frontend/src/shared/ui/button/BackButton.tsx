import type { ButtonHTMLAttributes } from "react";

import { Icon } from "../icon";

// Figma Button/뒤로(2411:560): 36 동그라미 · surface-2 · 안쪽 선 border-1 · chevron(오른쪽 화살표를 180° 돌림) 20 · 선 2.
// v5 화면 17번, 모두 화면 위 머리(Header · sticky). 컴포넌트의 「질문 바꾸기」 글자는 모든 화면에서 숨김이라 만들지 않았다.
// 모양만 담는다. 누르면 무엇을 할지(이전 화면 · 위 화면 주소 · 옆 패널 닫기)는 쓰는 쪽이 onClick 으로 정한다.
// 링크로 쓸 때는 <Link className={backButtonClass()}> 에 같은 아이콘을 넣는다.
// 호버 모습은 Figma 에 없어 바탕 한 단계(surface-3)로 가장 작게
export function backButtonClass(className = "") {
  return `inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-1 inset-ring inset-ring-border-1 hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1 ${className}`;
}

export function BackIcon() {
  return <Icon name="chevronRight" weight={2} className="size-5 rotate-180" />;
}

// 글자 없는 아이콘 버튼이라 화면 낭독기용 이름 「뒤로」를 기본으로 단다
export function BackButton({
  className,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type={type}
      aria-label="뒤로"
      title="뒤로"
      className={backButtonClass(className)}
      {...props}
    >
      <BackIcon />
    </button>
  );
}
