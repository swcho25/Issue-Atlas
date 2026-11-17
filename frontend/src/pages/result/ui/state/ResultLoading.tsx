// 결과를 불러오는 동안(Figma 에 그림 없음): 빈 화면 대신 올 자리를 먼저 보인다.
// map = 04(바탕 위 결과 카드 자리, CardShell 과 같은 틀), detail = 05(본문 줄 + 오른쪽 패널 자리, DetailFrame 과 같은 틀).
// 지도는 데이터가 와야 만든다(먼저 만들면 진짜 지도가 한 번 더 만들어진다). 움직임 줄이기 설정이면 깜빡이지 않는다

const pulse = "bg-text-1/7 motion-safe:animate-pulse";
/** 줄 자리(모서리 md). 동그라미는 pulse 에 rounded-full 을 따로 — 모서리 둘을 함께 걸면 CSS 순서로 갈린다 */
const bar = `rounded-md ${pulse}`;

function Bars({ widths }: { widths: string[] }) {
  return (
    <>
      {widths.map((w, i) => (
        <span key={i} aria-hidden className={`block h-3.5 ${bar} ${w}`} />
      ))}
    </>
  );
}

export function ResultLoading({ variant = "map" }: { variant?: "map" | "detail" }) {
  const status = (
    <p role="status" className="text-body-13 text-text-3">
      결과를 불러오는 중이에요…
    </p>
  );

  if (variant === "detail") {
    return (
      <div aria-busy="true" className="flex h-full bg-bg-app">
        <div className="flex min-w-0 flex-1 flex-col gap-4 px-7 py-6">
          <span aria-hidden className={`block h-8 w-60 ${bar}`} />
          {status}
          <div className="grid gap-3">
            <Bars widths={["w-full", "w-11/12", "w-4/5", "w-full", "w-3/4"]} />
          </div>
        </div>
        <div className="relative w-[368px] shrink-0">
          <div className="absolute top-4 right-4 bottom-4 flex w-[368px] flex-col gap-3.5 rounded-[20px] bg-surface-1 px-5 py-4 shadow-panel inset-ring inset-ring-text-1/6">
            <span aria-hidden className={`block h-16 ${bar}`} />
            <Bars widths={["w-full", "w-5/6", "w-2/3"]} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div aria-busy="true" className="relative h-full bg-bg-canvas">
      <div className="absolute top-5 bottom-5 left-6 flex w-[400px] flex-col gap-4 rounded-[22px] border border-text-1/6 bg-surface-1 px-6 pt-6 shadow-card">
        <span aria-hidden className={`block size-9 rounded-full ${pulse}`} />
        <span aria-hidden className={`block h-7 w-56 ${bar}`} />
        {status}
        <span aria-hidden className={`block h-16 ${bar}`} />
        <div className="grid gap-3">
          <Bars widths={["w-full", "w-5/6", "w-full", "w-2/3"]} />
        </div>
      </div>
    </div>
  );
}
