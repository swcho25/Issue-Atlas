import { expect, test } from "@playwright/test";

test("랜딩에 로고 · 문장 · 시작 버튼과 끌어서 돌리는 지구가 보인다", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Issue Atlas" })).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("heading", { name: "우리 지역에 이 문제가 정말 있는가?" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "질문 시작하기" })).toBeVisible();
  await expect(page.getByRole("img", { name: /지구가 천천히 자전해요/ })).toBeVisible();
});

test("배포 상태 응답은 캐시하지 않는다", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toMatchObject({ status: "UP", revision: "local" });
});
