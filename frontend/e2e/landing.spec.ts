import { expect, test } from "@playwright/test";

test("랜딩에 큰 이름 · 문장과 끌어서 돌리는 지구가 보이고, 시작 버튼은 새 질문으로 간다", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Issue Atlas" }).first()).toHaveAttribute(
    "href",
    "/",
  );
  await expect(page.getByRole("heading", { level: 1, name: "Issue Atlas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "지역의 문제를, 근거로 읽다." })).toBeVisible();
  await expect(page.getByRole("img", { name: /아틀라스가 받친 지구/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /OPEN THE ATLAS/ })).toHaveAttribute("href", "/ask");
});

test("헤더 「로그인」 으로 로그인 창이 열리고 Esc 로 닫힌다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("banner").getByRole("button", { name: "로그인" }).click();
  const dialog = page.getByRole("dialog", { name: "로그인" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("이메일")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("배포 상태 응답은 캐시하지 않는다", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toMatchObject({ status: "UP", revision: "local" });
});
