import { expect, test } from "@playwright/test";

test("签署 Day 1 项目边界并在刷新后恢复", async ({ page }) => {
  await page.goto("/studio/day-1");

  await page
    .getByRole("textbox", { name: /这个人是/ })
    .fill("需要定期处理用户反馈的产品经理");
  await page
    .getByRole("textbox", { name: /七天后可以/ })
    .fill("上传访谈记录后得到三条带依据的主题和行动建议");
  await page.getByRole("textbox", { name: /暂时不做/ }).fill("登录系统");
  await page.getByRole("button", { name: "加入暂时不做清单" }).click();
  await page.getByRole("button", { name: "确认这份 7 天计划 →" }).click();

  await expect(page.getByText("7 天计划已确认")).toBeVisible();
  await expect(page.getByText("方向已经清楚了。")).toBeVisible();
  await expect(page.getByText("第一版已保存")).toBeVisible();

  await page.reload();
  await expect(page.getByText("7 天计划已确认")).toBeVisible();
  await expect(page.getByText("需要定期处理用户反馈的产品经理")).toBeVisible();
});

test("完成 Day 2 后解锁下一天并保护未完成路由", async ({ page }) => {
  await page.goto("/studio/day-1");

  await page.getByRole("textbox", { name: /这个人是/ }).fill("产品经理");
  await page
    .getByRole("textbox", { name: /七天后可以/ })
    .fill("从访谈记录得到三条有依据的主题和行动建议");
  await page.getByRole("textbox", { name: /暂时不做/ }).fill("登录系统");
  await page.getByRole("button", { name: "加入暂时不做清单" }).click();
  await page.getByRole("button", { name: "确认这份 7 天计划 →" }).click();
  await page.getByRole("link", { name: /开始第 2 天/ }).click();

  await page.getByRole("textbox", { name: /唯一入口/ }).fill("打开作品首页");
  await page
    .getByRole("textbox", { name: /主要输入/ })
    .fill("粘贴一段访谈记录");
  await page
    .getByRole("textbox", { name: /核心处理/ })
    .fill("找出重复主题并保留对应的原文依据");
  await page
    .getByRole("textbox", { name: /唯一结果/ })
    .fill("显示三条主题、对应证据和一条行动建议");
  await page.getByRole("button", { name: "完成今天 →" }).click();

  await expect(page.getByText("V0.1 已保存")).toBeVisible();
  await expect(page.getByRole("link", { name: /继续第 3 天/ })).toBeVisible();

  await page.reload();
  await expect(page.getByText("V0.1 已保存")).toBeVisible();

  await page.goto("/studio/day-4");
  await expect(page.getByRole("heading", { name: "先完成第 3 天。" })).toBeVisible();
  await expect(page.getByRole("link", { name: "回到第 3 天 →" })).toHaveAttribute(
    "href",
    "/studio/day-3",
  );
});
