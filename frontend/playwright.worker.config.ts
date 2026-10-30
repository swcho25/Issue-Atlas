import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

// 같은 화면 검사를 Node 서버와 실제 Workers 런타임에서 각각 실행한다.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:8787" },
  webServer: {
    command: `pnpm exec opennextjs-cloudflare preview --env ${process.env.WORKER_ENV ?? "development"} --port 8787`,
    url: "http://127.0.0.1:8787/healthz",
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
