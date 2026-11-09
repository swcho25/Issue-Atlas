// 관리자 표 틀(Figma 07: 모서리 12 · 테두리 · 머리 줄 surface-2). 좁은 창에서는 칸이 찌그러지지 않게 틀 안에서 옆으로 넘긴다.
// 세로로 쌓인 화면(flex-col)에서 표가 눌려 줄어들지 않게 shrink-0.
// <div className={table.wrap}><table className={table.box}> … 처럼 class 로 쓴다
export const table = {
  wrap: "shrink-0 overflow-x-auto rounded-xl border border-border-1 bg-surface-1",
  box: "w-full min-w-280 table-fixed text-left",
  headRow: "bg-surface-2 text-caption-11 text-text-3",
  headCell: "px-4 py-2.5 font-normal",
  bodyCell: "px-4 py-3 align-middle",
} as const;
