import { expect, test } from "@playwright/test";

test("creates a note and keeps the shared navigation available", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await page.getByRole("button", { name: "便签" }).click();
  await page.getByRole("button", { name: "新建便签" }).click();
  await page.getByLabel("标题").fill("发布检查");
  await page.getByLabel("内容", { exact: true }).fill("确认本地便签闭环");
  const screenshot = "tests/e2e/editorial-shell.spec.ts-snapshots/expanded-editorial-workspace-chromium-win32.png";
  await page.getByLabel("选择截图文件").setInputFiles([screenshot, screenshot]);
  await expect(page.getByRole("img", { name: "便签截图预览" })).toHaveCount(2);
  await page.getByRole("radio", { name: "绿色" }).check();
  await expect(page.getByRole("dialog", { name: "新建便签" })).toHaveScreenshot(
    "note-editor-with-image.png",
    { animations: "disabled" },
  );
  await page.getByRole("button", { name: "保存便签" }).click();

  await expect(page.getByRole("heading", { name: "发布检查" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "导出 Markdown：发布检查" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "查看截图：发布检查" })).toHaveCount(2);
  await page.getByRole("button", { name: "查看截图：发布检查" }).first().click();
  await expect(page.getByRole("img", { name: "便签截图：发布检查" })).toBeVisible();
  await page.getByRole("button", { name: "关闭截图预览" }).click();
  await page.getByRole("button", { name: "最近" }).click();
  await expect(page.getByText("还没有剪贴板记录")).toBeVisible();
  await page.getByRole("button", { name: "便签" }).click();
  await expect(page.getByRole("heading", { name: "发布检查" })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看截图：发布检查" })).toHaveCount(2);
  await page.getByRole("button", { name: "批量导出" }).click();
  await page.getByRole("checkbox", { name: "选择便签：发布检查" }).check();
  await expect(page.getByRole("button", { name: "合并导出（1）" })).toBeEnabled();
  await page.getByRole("button", { name: "合并导出（1）" }).click();
  await expect(page.getByRole("button", { name: "批量导出" })).toBeVisible();
});

test("toggles capture state from the workspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await page.getByRole("button", { name: "暂停剪贴板采集" }).click();

  await expect(page.getByText("采集已暂停", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "恢复剪贴板采集" })).toBeVisible();
});

test("confirms before exiting from the workspace window", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await page.getByRole("button", { name: "退出 ClipNote" }).click();

  await expect(page.getByRole("alertdialog", { name: "退出 ClipNote？" })).toBeVisible();
  await expect(page.getByText("桌宠和浏览器填充服务也会关闭")).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("alertdialog", { name: "退出 ClipNote？" })).toHaveCount(0);
});

test("clears all unfavorited clips while preserving favorites", async ({ page }) => {
  await page.addInitScript(() => {
    const clip = (id: number, title: string, favorite: boolean) => ({
      id,
      kind: "text",
      source: "系统剪贴板",
      capturedAt: Math.floor(Date.now() / 1000),
      title,
      preview: title,
      favorite,
      useCount: 0,
    });
    window.localStorage.setItem(
      "clipnote-browser-data-v1",
      JSON.stringify({
        clips: [clip(1, "保留收藏", true), clip(2, "清理普通记录", false)],
        notes: [],
        paused: false,
      }),
    );
  });

  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await page.getByRole("button", { name: "清理未收藏" }).click();
  await page.getByRole("button", { name: "确认删除 1 条未收藏记录" }).click();

  await expect(page.getByRole("heading", { name: "保留收藏" })).toBeVisible();
  await expect(page.getByText("清理普通记录", { exact: true })).toHaveCount(0);
  await expect(page.getByText("共 1 条工作碎片")).toBeVisible();
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
  await page.getByLabel("网址", { exact: true }).fill("https://example.test/login");
  await page.getByLabel("密码", { exact: true }).fill("a-secret-value");
  await page.getByLabel("标签", { exact: true }).fill("工作, 邮箱");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("发布邮箱")).toBeVisible();
  await page.getByRole("button", { name: "收藏 发布邮箱" }).click();
  await page.getByRole("button", { name: "置顶 发布邮箱" }).click();
  await expect(page.getByRole("button", { name: "取消收藏 发布邮箱" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "工作", exact: true }).click();
  await expect(page.getByText("发布邮箱")).toBeVisible();
  await page.getByRole("button", { name: "密码本设置" }).click();
  await page.getByRole("button", { name: "导出教程" }).click();
  await expect(page.getByRole("dialog", { name: "如何导出加密备份" })).toBeVisible();
  await expect(page.getByText("ClipNote-密码本备份")).toBeVisible();
  await page.getByRole("button", { name: "知道了" }).click();
  await page.getByRole("button", { name: "导入教程" }).click();
  await expect(page.getByRole("dialog", { name: "从浏览器导入密码" })).toBeVisible();
  await expect(page.getByText("Google 密码管理器", { exact: true })).toBeVisible();
  await expect(page.getByText("Microsoft Edge", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "知道了" }).click();
  await page.getByLabel("当前主密码").fill("browser master password");
  await page.getByLabel("新主密码", { exact: true }).fill("new browser master password");
  await page.getByLabel("确认新主密码").fill("different password");
  await expect(page.getByText("两次输入的新主密码不一致")).toBeVisible();
  await page.getByLabel("确认新主密码").fill("new browser master password");
  await page.getByRole("button", { name: "更新主密码" }).click();

  await page.getByRole("button", { name: "锁定密码本" }).click();
  await expect(page.getByRole("heading", { name: "解锁密码本" })).toBeVisible();
  await page.getByLabel("主密码", { exact: true }).fill("new browser master password");
  await page.getByRole("button", { name: "解锁", exact: true }).click();
  await expect(page.getByText("发布邮箱")).toBeVisible();
});

test("configures the AI pet studio in memory", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 ClipNote 工作台" }).click();
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "AI 设计" }).click();
  await page.getByLabel("API Key").fill("sk-browser-12345678901234567890");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByText("gpt-image-1.5")).toBeVisible();
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
  await expect(page.getByRole("button", { name: "选择窗口" })).toBeVisible();
  await page.getByRole("button", { name: "选择窗口" }).click();
  const processDialog = page.getByRole("alertdialog", { name: "结束这个进程？" });
  await expect(processDialog).toBeVisible();
  await expect(page.getByText("preview.exe", { exact: true })).toBeVisible();
  await expect(processDialog).toHaveScreenshot("process-target-dialog.png", {
    animations: "disabled",
  });
  await page.getByRole("button", { name: "取消" }).click();
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

test("edits a real desktop sticky note composition", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 260 });
  await page.addInitScript(() => {
    window.localStorage.setItem("clipnote-browser-data-v1", JSON.stringify({
      clips: [],
      paused: false,
      notes: [{
        id: 77,
        title: "桌面发布清单",
        body: "检查安装包\n更新发布说明",
        tone: "sun",
        images: [],
        sourceClipIds: [1, 2],
        desktopPinned: true,
        desktopX: 100,
        desktopY: 100,
        desktopWidth: 320,
        desktopHeight: 260,
        alwaysOnTop: true,
        createdAt: 1,
        updatedAt: 1,
      }],
    }));
  });
  await page.goto("/?stickyNote=77");

  await expect(page.getByLabel("便签标题")).toHaveValue("桌面发布清单");
  await page.getByLabel("便签内容").fill("检查安装包\n更新发布说明\n完成视觉验证");
  await expect(page).toHaveScreenshot("desktop-sticky-note.png", { animations: "disabled" });
});
