import { defineConfig, devices } from "@playwright/test";

// 페이지 테스트. 완성된 페이지마다 핵심 흐름 1~3개만 둔다. 빌드된 앱을 3100 포트로 띄워 확인한다.
// 여러 작업 트리의 E2E 서버가 충돌하면 실행 시 별도 포트를 지정한다.
const PORT = Number(process.env.E2E_PORT ?? 3100);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("E2E_PORT must be an integer between 1 and 65535");
}
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // pnpm 이 PATH 에 없어도 돌도록 next 를 직접 실행한다. 빌드는 `pnpm frontend:e2e` 가 먼저 한다.
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
