import type { JourneyDay } from "./journey-session";

export const journeyDayMeta: Record<
  JourneyDay,
  {
    label: string;
    eyebrow: string;
    title: string;
    introduction: string;
    outcome: string;
    duration: string;
    completionTitle: string;
  }
> = {
  2: {
    label: "初稿",
    eyebrow: "今天只跑通一条路",
    title: "让第一版动起来",
    introduction:
      "先不追求完整。把入口、输入、处理和结果连成最短的一次使用，你就有了可以被看见的 V0.1。",
    outcome: "V0.1 校样",
    duration: "约 60–90 分钟",
    completionTitle: "第一版已经可以被讲清楚。",
  },
  3: {
    label: "编辑",
    eyebrow: "今天只听一次真实反馈",
    title: "让别人读懂它",
    introduction:
      "找一位现实中的人看 V0.1。记录他怎么理解、在哪里犹豫，再由你决定保留、修改还是拒绝。",
    outcome: "V0.2 与编辑决定",
    duration: "约 60 分钟",
    completionTitle: "反馈已经变成编辑决定。",
  },
  4: {
    label: "校样",
    eyebrow: "今天主动把它试坏",
    title: "让错误也有出口",
    introduction:
      "空输入、异常输入和处理失败都是真实使用的一部分。主动试出问题，修一次，也保留回退的判断。",
    outcome: "V0.3 与校样复盘",
    duration: "约 60–90 分钟",
    completionTitle: "这次错误已经留下方法。",
  },
  5: {
    label: "成形",
    eyebrow: "今天只统一一种体验",
    title: "让重点一眼可见",
    introduction:
      "先决定使用者该感到什么，再统一信息顺序、强调方式和反馈。最后确认小屏和基础无障碍。",
    outcome: "V0.5 发行候选版",
    duration: "约 60–90 分钟",
    completionTitle: "作品已经有了清楚的语气。",
  },
  6: {
    label: "试读",
    eyebrow: "今天观察，不替作品解释",
    title: "让真实使用说话",
    introduction:
      "邀请一位目标使用者完成一次真实试用。区分核心障碍与个人偏好，只把发布前必须做的事留下。",
    outcome: "V0.8 与最终修改",
    duration: "约 60 分钟",
    completionTitle: "发布前的范围已经守住。",
  },
  7: {
    label: "发行",
    eyebrow: "今天把作品交给读者",
    title: "完成一次正式发行",
    introduction:
      "走完核心流程，说明作品与 AI 的边界，再决定哪些内容可以公开。确认后，作品说明会进入第 001 期特刊。",
    outcome: "正式发行",
    duration: "约 60 分钟",
    completionTitle: "你的作品已经正式入刊。",
  },
};
