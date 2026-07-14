import { expect, test } from "@playwright/test";

const completedAt = "2026-07-14T08:00:00.000Z";

const studioSession = {
  draft: {
    audience: "需要定期处理用户反馈的产品经理",
    outcome: "从访谈记录中得到三条有依据的主题和行动建议",
    exclusions: ["登录系统", "团队协作"],
  },
  confirmed: true,
  version: "V0.0",
};

const journeySession = {
  version: 1,
  days: {
    2: {
      draft: {
        entry: "打开首页后看到粘贴区域",
        mainInput: "一段匿名访谈记录",
        processing: "找出重复主题，并为每条主题保留对应原文依据",
        result: "展示三条主题、对应证据和一条可以执行的行动建议",
        previewUrl: "",
      },
      completedAt,
    },
    3: {
      draft: {
        reviewer: "同事小周",
        understood: "帮助产品经理找到访谈共性",
        hesitation: "没有立即发现证据入口",
        unnecessary: "团队空间入口",
        valuable: "主题可以回到原文证据",
        decision: "change",
        changeSummary: "删除团队空间，并明确证据入口",
      },
      completedAt,
    },
    4: {
      draft: {
        checks: { emptyInput: true, invalidInput: true, errorState: true },
        incident: "空白文本仍然触发分析",
        fix: "分析前检查有效文字",
        rollbackDecision: "keep",
        reflection: "固定重跑空值、异常和请求失败校样",
      },
      completedAt,
    },
    5: {
      draft: {
        emotion: "清楚和安心",
        keyInformation: "主题与原文证据的对应关系",
        emphasis: "输入安静，结果强调证据入口",
        memorableAction: "点击主题时展开对应原文",
        responsiveChecked: true,
        accessibilityChecked: true,
      },
      completedAt,
    },
    6: {
      draft: {
        reader: "产品经理阿澄",
        solved: "整理访谈共性并保留依据",
        pause: "没有立即发现证据入口",
        usefulness: "可以核对总结是否可信",
        oneChange: "把查看证据放到主题旁边",
        category: "must",
        finalChange: "发布前明确证据入口",
      },
      completedAt,
    },
    7: {
      draft: {
        checks: {
          link: true,
          coreFlow: true,
          errorState: true,
          mobile: true,
          aiBoundary: true,
          realFeedback: true,
        },
        title: "访谈证据镜",
        introduction: "为产品经理把访谈记录整理成可回看原文的主题和行动建议。",
        aiDataBoundary: "AI 只整理主动粘贴的匿名文本，不保存输入，也不替人判断。",
        publicListing: true,
      },
      completedAt,
    },
  },
};

test("代表页面没有横向溢出或控制台错误", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.addInitScript(
    ({ studio, journey }) => {
      window.sessionStorage.setItem("wei-ding-gao:studio:v1", JSON.stringify(studio));
      window.sessionStorage.setItem("wei-ding-gao:journey:v1", JSON.stringify(journey));
    },
    { studio: studioSession, journey: journeySession },
  );

  for (const route of [
    "/studio/day-2",
    "/studio/day-4",
    "/studio/day-6",
    "/studio/day-7",
    "/publication/001",
  ]) {
    await page.goto(route);
    if (route.startsWith("/studio/")) {
      await page.getByRole("button", { name: "返回修改" }).click();
    }

    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );
    });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${route} should not overflow horizontally`).toBeLessThanOrEqual(1);

    const name = route.replaceAll("/", "-").replace(/^-/, "");
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }

  expect(errors).toEqual([]);
});
