import { expect, test, type Page } from "@playwright/test";

async function completeApplication(page: Page) {
  const answers = [
    "每周整理访谈记录时，很难快速发现共性。",
    "需要定期处理用户反馈的产品经理。",
    "现在复制到表格，再手工分类和总结。",
    "面对几十条记录时，不知道先看哪一条。",
    "上传记录后得到带依据的主题和下一步建议。",
    "已有匿名化的访谈记录和分类表格。",
    "同组的一位产品经理愿意完成真实试用。",
  ];

  await page.goto("/apply");
  for (const answer of answers) {
    await page.getByLabel("你的回答").fill(answer);
    await page.getByRole("button", { name: /继续|完成访谈/ }).click();
  }

  await page.getByRole("link", { name: "进入 Day 1 工作室 →" }).click();
}

async function completeDayOne(page: Page) {
  await page.getByRole("button", { name: "确认这份 7 天计划 →" }).click();
  await page.getByRole("link", { name: /开始第 2 天/ }).click();
}

async function completeDayTwo(page: Page) {
  await page.getByRole("textbox", { name: /唯一入口/ }).fill("打开首页后看到粘贴区域");
  await page.getByRole("textbox", { name: /主要输入/ }).fill("一段匿名访谈记录");
  await page
    .getByRole("textbox", { name: /核心处理/ })
    .fill("找出重复主题，并为每条主题保留对应原文依据");
  await page
    .getByRole("textbox", { name: /唯一结果/ })
    .fill("展示三条主题、对应证据和一条可以执行的行动建议");
  await page.getByRole("button", { name: "完成今天 →" }).click();
  await page.getByRole("link", { name: /继续第 3 天/ }).click();
}

async function completeDayThree(page: Page) {
  await page.getByRole("textbox", { name: /反馈者姓名或称呼/ }).fill("同事小周");
  await page
    .getByRole("textbox", { name: /他认为作品为谁解决什么/ })
    .fill("帮助产品经理从很多访谈记录中快速找到有依据的共性");
  await page
    .getByRole("textbox", { name: /哪一步让他犹豫/ })
    .fill("他不知道主题旁边的数字能否打开对应原文");
  await page
    .getByRole("textbox", { name: /看起来不必要的部分/ })
    .fill("顶部的团队空间入口与这次分析没有直接关系");
  await page
    .getByRole("textbox", { name: /对他最有价值的结果/ })
    .fill("每条主题都能回到原文证据，方便确认总结是否可信");
  await page.getByRole("radio", { name: /修改/ }).check();
  await page
    .getByRole("textbox", { name: /具体保留、修改或拒绝什么/ })
    .fill("删除团队空间入口，并把证据数字改成明确的查看原文按钮");
  await page.getByRole("button", { name: "完成今天 →" }).click();
  await page.getByRole("link", { name: /继续第 4 天/ }).click();
}

async function completeDayFour(page: Page) {
  await page.getByRole("checkbox", { name: /空输入/ }).check();
  await page.getByRole("checkbox", { name: /异常输入/ }).check();
  await page.getByRole("checkbox", { name: /错误状态/ }).check();
  await page
    .getByRole("textbox", { name: /发生了什么/ })
    .fill("粘贴空白文本后仍然开始分析，最后显示了没有依据的空主题");
  await page
    .getByRole("textbox", { name: /你做了什么修复/ })
    .fill("分析前检查有效文字，并在空输入时说明需要粘贴什么内容");
  await page.getByRole("radio", { name: /保留修复/ }).check();
  await page
    .getByRole("textbox", { name: /下次如何更早发现/ })
    .fill("每次改动后固定重跑空输入、超长输入和请求失败三组校样");
  await page.getByRole("button", { name: "完成今天 →" }).click();
  await page.getByRole("link", { name: /继续第 5 天/ }).click();
}

async function completeDayFive(page: Page) {
  await page.getByRole("textbox", { name: /使用者首先应该感到什么/ }).fill("清楚和安心");
  await page
    .getByRole("textbox", { name: /第一眼最重要的信息/ })
    .fill("每条主题与原始访谈证据之间的对应关系");
  await page
    .getByRole("textbox", { name: /哪一步需要安静或强调/ })
    .fill("输入阶段保持安静，结果出现时强调可展开的证据入口");
  await page
    .getByRole("textbox", { name: /最值得记住的一个视觉动作/ })
    .fill("点击主题时展开一条对应原文，让依据与判断同时出现");
  await page.getByRole("checkbox", { name: /移动端可浏览/ }).check();
  await page.getByRole("checkbox", { name: /基础无障碍/ }).check();
  await page.getByRole("button", { name: "完成今天 →" }).click();
  await page.getByRole("link", { name: /继续第 6 天/ }).click();
}

async function completeDaySix(page: Page) {
  await page.getByRole("textbox", { name: /试读者姓名或称呼/ }).fill("产品经理阿澄");
  await page
    .getByRole("textbox", { name: /他认为作品解决什么/ })
    .fill("把分散的访谈记录整理成可以核对来源的主题和行动建议");
  await page
    .getByRole("textbox", { name: /他在哪一步停顿/ })
    .fill("第一次看到结果时没有立即发现主题可以展开查看证据");
  await page
    .getByRole("textbox", { name: /结果对他是否有用/ })
    .fill("有用，因为可以先看共性，再用原文确认是否值得进入产品计划");
  await page
    .getByRole("textbox", { name: /只能改一处时/ })
    .fill("希望把查看证据的入口放到主题标题旁边，并使用更明确的文字");
  await page.getByRole("radio", { name: /必须修/ }).check();
  await page
    .getByRole("textbox", { name: /最终修改或不修改的理由/ })
    .fill("发布前把证据入口改为查看原文，因为它直接影响结果是否可信");
  await page.getByRole("button", { name: "完成今天 →" }).click();
  await page.getByRole("link", { name: /继续第 7 天/ }).click();
}

async function completeDaySeven(page: Page) {
  for (const name of [
    /公开入口可访问/,
    /核心流程已完成/,
    /错误状态可理解/,
    /移动端可浏览/,
    /AI 与数据边界明确/,
    /存在真实试用反馈/,
  ]) {
    await page.getByRole("checkbox", { name }).check();
  }

  await page.getByRole("textbox", { name: /作品名称/ }).fill("访谈证据镜");
  await page
    .getByRole("textbox", { name: /它为谁解决什么/ })
    .fill("为需要定期处理用户反馈的产品经理，把匿名访谈记录整理成三条可回看原文的主题和行动建议。");
  await page
    .getByRole("textbox", { name: /AI 做了什么/ })
    .fill("AI 只整理使用者主动粘贴的匿名文本并标出依据，不保存输入，也不替人判断是否进入产品计划。");
  await page
    .getByRole("checkbox", { name: /同意将作品说明加入第 001 期公开特刊/ })
    .check();
  await page.getByRole("button", { name: "完成今天 →" }).click();
}

test("从申请到授权发行形成一条可恢复的真实路径", async ({ page }) => {
  await completeApplication(page);
  await completeDayOne(page);
  await completeDayTwo(page);
  await completeDayThree(page);
  await completeDayFour(page);
  await completeDayFive(page);
  await completeDaySix(page);
  await completeDaySeven(page);

  await expect(page.getByText("正式发行 已保存")).toBeVisible();
  await page.getByRole("link", { name: /查看第 001 期特刊/ }).click();

  await expect(page).toHaveURL(/publication\/001/);
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "访谈证据镜" })).toBeVisible();
  await expect(page.getByText("产品经理阿澄")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "访谈证据镜" })).toBeVisible();
});
