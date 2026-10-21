import type { Metadata } from "next";

import { QueryProvider } from "@/app/query-client";
import "@/app/styles/globals.css";

export const metadata: Metadata = {
  title: "Issue Atlas",
  description: "지역사회 이슈를 근거 기반으로 분석하는 Community Intelligence 플랫폼",
};

// 루트 app/ 은 Next 라우팅만 맡는다. 화면 구성은 src/pages 에서 가져온다(FSD).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
