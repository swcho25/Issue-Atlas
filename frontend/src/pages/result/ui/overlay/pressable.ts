// 지도 Marker 를 누를 수 있게: 버튼 역할 · 초점 테두리 · Enter · Space, 지도의 「빈 곳 누름 = 창 닫기」까지 가지 않게.
// 측정소 점 · 기사 점이 함께 쓴다. key 는 data-mark 로 붙어, 창을 닫은 뒤 그 점으로 초점을 돌릴 때 찾는다
export function pressable(el: HTMLElement, key: string, label: string, onSelect: () => void) {
  el.dataset.mark = key;
  el.setAttribute("role", "button");
  el.setAttribute("aria-haspopup", "dialog");
  el.setAttribute("aria-expanded", "false");
  el.setAttribute("aria-label", `${label} · 상세 보기`);
  el.tabIndex = 0;
  el.classList.add(
    "cursor-pointer",
    "rounded-full",
    "outline-none",
    "focus-visible:outline-2",
    "focus-visible:outline-offset-2",
    "focus-visible:outline-text-1",
  );
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onSelect();
  });
  return el;
}

/** 창을 닫은 뒤 그 점으로 초점(닫기 · Esc) */
export const focusMark = (key: string) =>
  document.querySelector<HTMLElement>(`[data-mark="${CSS.escape(key)}"]`)?.focus();
