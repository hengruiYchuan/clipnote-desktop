export const applicationSteps = [
  {
    id: "problem",
    eyebrow: "01 / 问题",
    prompt: "你想解决的真实问题是什么？",
    help: "描述一个反复发生、让你或他人感到麻烦的具体时刻。",
  },
  {
    id: "audience",
    eyebrow: "02 / 读者",
    prompt: "这个问题主要发生在谁身上？",
    help: "先只选择一种最重要的使用者。",
  },
  {
    id: "currentMethod",
    eyebrow: "03 / 现状",
    prompt: "他们现在如何处理它？",
    help: "写下现有工具、人工步骤或放弃处理的原因。",
  },
  {
    id: "painMoment",
    eyebrow: "04 / 瞬间",
    prompt: "最令人挫败的一刻是什么？",
    help: "具体到一个动作、一段等待或一次错误。",
  },
  {
    id: "outcome",
    eyebrow: "05 / 结果",
    prompt: "七天后，什么结果值得交给别人使用？",
    help: "用可观察结果描述，不要罗列功能。",
  },
  {
    id: "materials",
    eyebrow: "06 / 素材",
    prompt: "你已经拥有哪些真实素材？",
    help: "例如访谈记录、表格、文本、图片或工作流程。",
  },
  {
    id: "firstReader",
    eyebrow: "07 / 试读",
    prompt: "谁愿意成为第一位试用者？",
    help: "可以是一位同事、朋友、同学或你自己。",
  },
] as const;

export type ApplicationStepId = (typeof applicationSteps)[number]["id"];
export type ApplicationAnswers = Partial<Record<ApplicationStepId, string>>;
export type ApplicationDraft = {
  stepIndex: number;
  answers: ApplicationAnswers;
};
