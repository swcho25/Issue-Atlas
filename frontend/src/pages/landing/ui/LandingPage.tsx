import { ServerStatusBadge } from "./ServerStatusBadge";

export function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold">우리 지역에 이 문제가 정말 있는가?</h1>
      <p className="text-sm opacity-70">Issue Atlas — 뼈대 화면</p>
      <ServerStatusBadge />
    </main>
  );
}
