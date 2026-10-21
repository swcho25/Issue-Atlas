// 테스트 전용 도구. 앱 코드에서 import 하지 않는다.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { setupServer } from "msw/node";
import type { ReactElement } from "react";

// 모든 테스트가 공유하는 MSW 서버. 테스트마다 mswServer.use(...) 로 응답을 정한다(vitest.setup.ts 가 켜고 끈다).
export const mswServer = setupServer();

// 테스트마다 새 QueryClient. 재시도를 끄고 캐시를 공유하지 않는다.
export function renderWithQuery(ui: ReactElement, options?: RenderOptions) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, options);
}
