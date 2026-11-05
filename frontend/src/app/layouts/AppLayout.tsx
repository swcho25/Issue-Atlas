import { Suspense } from "react";

import { AppRail, AppRailPlaceholder } from "@/widgets/app-rail";

import { getCurrentUser } from "./AuthLayout";

// 랜딩을 뺀 앱 화면 틀: 왼쪽 띠(72) + 나머지 전부.
// 틀은 화면 높이에 고정해 페이지 자체는 스크롤되지 않고, 오른쪽 본문 칸만 위아래 · 좌우로 스크롤된다.
// 띠는 지금 주소와 로그인한 사람(세션 쿠키)을 읽어 요청 때 정해진다 → <Suspense> 로 감싼다(Next 16)
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Suspense fallback={<AppRailPlaceholder />}>
        <UserRail />
      </Suspense>
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

/** 관리자면 관리 메뉴를 더 붙인다. 띠 때문에 화면이 깨지지 않게 /v1/auth/me 오류는 로그인 없음으로 본다 */
export async function UserRail() {
  const me = await getCurrentUser().catch(() => null);
  return <AppRail role={me?.role === "ADMIN" ? "admin" : "viewer"} userName={me?.name} />;
}
