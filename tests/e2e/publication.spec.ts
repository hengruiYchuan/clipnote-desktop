import { expect, test } from "@playwright/test";

test("第 001 期在无本地授权作品时仍是完整特刊", async ({ page }) => {
  await page.goto("/publication/001");

  await expect(
    page.getByRole("heading", { name: "十二个问题，十二种回答" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("img")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "申请下一期驻留" })).toHaveAttribute(
    "href",
    "/apply",
  );
});
