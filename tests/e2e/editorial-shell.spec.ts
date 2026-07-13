import { expect, test } from "@playwright/test";

test("opens the editorial workspace and searches clips", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await expect(
    page.getByRole("searchbox", { name: "搜索工作碎片" }),
  ).toBeFocused();
  await page
    .getByRole("searchbox", { name: "搜索工作碎片" })
    .fill("Tauri");
  await expect(page.getByText("启动 Tauri 开发环境")).toBeVisible();
  await expect(page.getByText("MVP 产品决策")).toBeHidden();
});

test("matches the approved collapsed and expanded compositions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot("collapsed-editorial-tab.png", {
    animations: "disabled",
  });
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await expect(page).toHaveScreenshot("expanded-editorial-workspace.png", {
    animations: "disabled",
  });
});
