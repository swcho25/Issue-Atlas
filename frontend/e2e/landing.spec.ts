import { expect, test } from "@playwright/test";

// 백엔드 없이 돈다: /api 요청은 page.route 로 가짜 응답을 준다.
test("랜딩 화면에 질문 문구와 서버 상태가 보인다", async ({ page }) => {
  await page.route("**/api/actuator/health", (route) => route.fulfill({ json: { status: "UP" } }));

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "우리 지역에 이 문제가 정말 있는가?" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("서버 정상");
});

test("배포 상태 응답은 캐시하지 않는다", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toMatchObject({ status: "UP", revision: "local" });
});
