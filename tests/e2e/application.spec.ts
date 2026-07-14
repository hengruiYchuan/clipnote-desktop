import { expect, test } from "@playwright/test";

test("申请人完成七页访谈并得到选题诊断", async ({ page }) => {
  await page.goto("/apply");

  const answers = [
    "每周整理访谈记录时，很难快速发现共性。",
    "需要定期处理用户反馈的产品经理。",
    "现在复制到表格，再手工分类和总结。",
    "面对几十条记录时，不知道先看哪一条。",
    "上传记录后得到带依据的主题和下一步建议。",
    "已有匿名化的访谈记录和分类表格。",
    "同组的一位产品经理愿意试用。",
  ];

  for (const answer of answers) {
    await page.getByLabel("你的回答").fill(answer);
    await page.getByRole("button", { name: /继续|完成访谈/ }).click();
  }

  await expect(page).toHaveURL(/diagnosis/);
  await expect(page.getByRole("heading", { name: "选题诊断单" })).toBeVisible();
  await expect(page.getByText("七日完成概率")).toBeVisible();
  await expect(page.getByText("只做三步")).toBeVisible();

  await page.getByRole("link", { name: "进入 Day 1 工作室 →" }).click();
  await expect(page).toHaveURL(/studio\/day-1/);
  await expect(page.getByText("从你的选题诊断中带过来的方向")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /这个人是/ })).not.toHaveValue("");
  await expect(page.getByRole("textbox", { name: /七天后可以/ })).not.toHaveValue("");
  await expect(
    page.getByRole("list", { name: "暂时不做清单" }).locator("li"),
  ).not.toHaveCount(0);
});

test("逐题校验并允许返回修改已经保存的回答", async ({ page }) => {
  await page.goto("/apply");

  await page.getByLabel("你的回答").fill("太短");
  await page.getByRole("button", { name: "继续编辑 →" }).click();
  await expect(page.locator("#answer-error")).toContainText("至少写下 8 个字");

  const answer = "每周整理访谈记录时，很难快速发现共性。";
  await page.getByLabel("你的回答").fill(answer);
  await page.getByRole("button", { name: "继续编辑 →" }).click();
  await expect(page.getByRole("group", { name: /这个问题主要发生在谁身上/ })).toBeVisible();

  await page.getByRole("button", { name: "← 上一题" }).click();
  await expect(page.getByLabel("你的回答")).toHaveValue(answer);
});
