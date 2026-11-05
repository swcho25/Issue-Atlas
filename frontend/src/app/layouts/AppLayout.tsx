import { Suspense } from "react";

import { AppRail, AppRailPlaceholder } from "@/widgets/app-rail";

// 랜딩을 뺀 앱 화면 틀: 왼쪽 띠(72) + 나머지 전부.
// 틀은 화면 높이에 고정해 페이지 자체는 스크롤되지 않고, 오른쪽 본문 칸만 위아래 · 좌우로 스크롤된다.
// 띠는 지금 주소를 읽어(고른 칸 표시) 동적 주소 화면에서는 요청 때 정해진다 → <Suspense> 로 감싼다(Next 16)
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Suspense fallback={<AppRailPlaceholder />}>
        <AppRail />
      </Suspense>
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
