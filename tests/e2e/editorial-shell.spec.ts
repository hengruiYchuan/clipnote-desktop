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

test("creates, locks, and unlocks a local password vault", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await page.getByRole("button", { name: "密码本" }).click();
  await page.getByLabel("主密码", { exact: true }).fill("browser master password");
  await page.getByLabel("再输一次").fill("browser master password");
  await page.getByRole("button", { name: "创建并解锁" }).click();
  await expect(page.getByRole("heading", { name: "密码本" })).toBeVisible();

  await page.getByRole("button", { name: "新建" }).click();
  await page.getByLabel("名称", { exact: true }).fill("发布邮箱");
  await page.getByLabel("账号", { exact: true }).fill("release@example.test");
  await page.getByLabel("密码", { exact: true }).fill("a-secret-value");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("发布邮箱")).toBeVisible();

  await page.getByRole("button", { name: "锁定密码本" }).click();
  await expect(page.getByRole("heading", { name: "解锁密码本" })).toBeVisible();
  await page.getByLabel("主密码", { exact: true }).fill("browser master password");
  await page.getByRole("button", { name: "解锁", exact: true }).click();
  await expect(page.getByText("发布邮箱")).toBeVisible();
});

test("configures the AI pet studio in memory", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "AI 设计" }).click();
  await page.getByLabel("OpenAI API Key").fill("sk-browser-12345678901234567890");
  await page.getByRole("button", { name: "保存凭据" }).click();
  await expect(page.getByText(/OpenAI · gpt-image/)).toBeVisible();
  await expect(page.getByLabel("形象描述")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("clipnote-ai-key"))).toBeNull();
});

test("visually folds long clipboard text and exposes settings", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "clipnote-browser-data-v1",
      JSON.stringify({
        clips: [
          {
            id: 1,
            kind: "text",
            source: "系统剪贴板",
            capturedAt: Math.floor(Date.now() / 1000),
            title: "长文本检查",
            preview: Array.from(
              { length: 12 },
              (_, index) => `第 ${index + 1} 行用于检查真实折叠高度`,
            ).join("\n"),
            favorite: false,
            useCount: 0,
          },
        ],
        notes: [],
        paused: false,
      }),
    );
  });

  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();

  const preview = page.locator(".clip-card__preview");
  const collapsedHeight = await preview.evaluate((element) => element.getBoundingClientRect().height);
  await expect(page).toHaveScreenshot("long-clip-collapsed.png", {
    animations: "disabled",
  });
  await page.getByRole("button", { name: "展开全文" }).click();
  const expandedHeight = await preview.evaluate((element) => element.getBoundingClientRect().height);
  expect(expandedHeight).toBeGreaterThan(collapsedHeight);

  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page).toHaveScreenshot("settings-panel.png", {
    animations: "disabled",
  });
  await page.getByRole("radio", { name: "4 行" }).check();
  await expect(page.getByRole("radio", { name: "4 行" })).toBeChecked();
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
