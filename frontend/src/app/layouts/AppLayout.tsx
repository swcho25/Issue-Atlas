import { AppRail } from "@/widgets/app-rail";

// 랜딩을 뺀 앱 화면 틀: 왼쪽 띠(72) + 나머지 전부.
// 틀은 화면 높이에 고정해 페이지 자체는 스크롤되지 않고, 오른쪽 본문 칸만 위아래 · 좌우로 스크롤된다
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <AppRail />
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
