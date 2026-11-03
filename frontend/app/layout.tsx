import type { Metadata } from "next";

import { QueryProvider } from "@/app/query-client";
import { fontVariables } from "@/app/styles/fonts";
import { themeInitScript } from "@/shared/lib/theme";
import "@/app/styles/globals.css";

export const metadata: Metadata = {
  title: "Issue Atlas",
  description: "지역사회 이슈를 근거 기반으로 분석하는 Community Intelligence 플랫폼",
};

// 루트 app/ 은 Next 라우팅만 맡는다. 화면 구성은 src/pages 에서 가져온다(FSD).
// <html data-theme> 은 그리기 전 스크립트가 저장된 테마로 먼저 걸 수 있어 서버 HTML 과 다를 수 있다(suppressHydrationWarning)
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
