import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { mswServer } from "@/shared/lib/test";

// 정해 두지 않은 요청은 실패시킨다. 실제 네트워크로 새지 않게.
beforeAll(() => mswServer.listen({ onUnhandledFrame: "error" })); // MSW 3: onUnhandledRequest → onUnhandledFrame
afterEach(() => {
  cleanup();
  mswServer.resetHandlers();
});
afterAll(() => mswServer.close());
