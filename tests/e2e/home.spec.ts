import { expect, test } from "@playwright/test";

test("品牌首页清楚呈现驻留价值并进入申请", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /所有好作品/ })).toBeVisible();
  await expect(page.getByText("12 位驻留创作者")).toBeVisible();
  await expect(page.getByText("7 天完成一次正式发行")).toBeVisible();
  await expect(page.getByRole("heading", { name: "本期入选作品" })).toBeVisible();

  const applicationLink = page.getByRole("link", { name: "提交你的选题" }).first();
  await expect(applicationLink).toHaveAttribute("href", "/apply");
  await applicationLink.click();
  await expect(page).toHaveURL(/\/apply$/);
  await expect(page.getByRole("heading", { name: /从一个真实时刻开始/ })).toBeVisible();
});
