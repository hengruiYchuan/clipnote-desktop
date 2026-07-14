import { expect, test } from "@playwright/test";

test("creates a note and keeps the shared navigation available", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await page.getByRole("button", { name: "便签" }).click();
  await page.getByRole("button", { name: "新建便签" }).click();
  await page.getByLabel("标题").fill("发布检查");
  await page.getByLabel("内容", { exact: true }).fill("确认本地便签闭环");
  await page.getByLabel("选择截图文件").setInputFiles(
    "tests/e2e/editorial-shell.spec.ts-snapshots/expanded-editorial-workspace-chromium-win32.png",
  );
  await expect(page.getByRole("img", { name: "便签截图预览" })).toBeVisible();
  await page.getByRole("radio", { name: "绿色" }).check();
  await expect(page.getByRole("dialog", { name: "新建便签" })).toHaveScreenshot(
    "note-editor-with-image.png",
    { animations: "disabled" },
  );
  await page.getByRole("button", { name: "保存便签" }).click();

  await expect(page.getByRole("heading", { name: "发布检查" })).toBeVisible();
  await page.getByRole("button", { name: "查看截图：发布检查" }).click();
  await expect(page.getByRole("img", { name: "便签截图：发布检查" })).toBeVisible();
  await page.getByRole("button", { name: "关闭截图预览" }).click();
  await page.getByRole("button", { name: "最近" }).click();
  await expect(page.getByText("还没有剪贴板记录")).toBeVisible();
  await page.getByRole("button", { name: "便签" }).click();
  await expect(page.getByRole("heading", { name: "发布检查" })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看截图：发布检查" })).toBeVisible();
});

test("toggles capture state from the workspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await page.getByRole("button", { name: "暂停剪贴板采集" }).click();

  await expect(page.getByText("采集已暂停", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "恢复剪贴板采集" })).toBeVisible();
});

test("matches the real collapsed and expanded window compositions", async ({ page }) => {
  await page.setViewportSize({ width: 56, height: 56 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "打开 ClipNote 工作台" })).toBeInViewport();
  await expect(page.getByRole("button")).toHaveCount(1);
  await expect(page).toHaveScreenshot("collapsed-editorial-tab.png", {
    animations: "disabled",
  });

  await page.setViewportSize({ width: 648, height: 1000 });
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await expect(page).toHaveScreenshot("expanded-editorial-workspace.png", {
    animations: "disabled",
  });
});
