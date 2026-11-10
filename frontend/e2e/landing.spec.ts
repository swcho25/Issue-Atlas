import { expect, test } from "@playwright/test";

test("랜딩에 큰 이름 · 문장과 끌어서 돌리는 지구가 보이고, 시작 버튼은 로그인 창을 연다", async ({
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
  await page.getByRole("button", { name: /OPEN THE ATLAS/ }).click();
  await expect(page.getByRole("dialog", { name: "로그인" })).toBeVisible();
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

// 로그인돼 있으면 / → 첫 화면으로 보내는 것은 단위 테스트(src/app/proxy)가 본다. 여기는 백엔드가 없으므로
// 세션 쿠키가 남아 있어도 확인되지 않으면 / ↔ /ask 를 돌지 않고 랜딩이 뜨는지만 본다
test("확인되지 않는 세션 쿠키가 있어도 랜딩이 뜬다", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "JSESSIONID", value: "test", url: baseURL! }]);

  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Issue Atlas" })).toBeVisible();
});

test("배포 상태 응답은 캐시하지 않는다", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toMatchObject({ status: "UP", revision: "local" });
});
