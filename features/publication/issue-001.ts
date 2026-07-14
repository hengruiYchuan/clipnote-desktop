export type PublishedWork = {
  slug: string;
  number: string;
  title: string;
  creator: string;
  problem: string;
  decision: string;
  image: string;
  imageAlt: string;
};

export const issue001 = {
  number: "001",
  title: "十二个问题，十二种回答",
  dek: "第 001 期驻留创作者把工作与生活中的真实混乱，编辑成可以被使用、被分享的数字作品。",
  works: [
    {
      slug: "interview-lens",
      number: "WORK 01",
      title: "访谈透镜",
      creator: "林述",
      problem: "让产品经理从访谈记录中看见有依据的共性。",
      decision: "删除团队协作，只保留粘贴、分析和证据回看。",
      image: "/publication/work-01.svg",
      imageAlt: "访谈透镜结果页，三条主题旁标有对应访谈证据",
    },
    {
      slug: "brief-editor",
      number: "WORK 02",
      title: "简报裁纸刀",
      creator: "迟青",
      problem: "把过长活动需求裁成一页可执行简报。",
      decision: "不生成完整策划案，只指出矛盾、缺口和下一步。",
      image: "/publication/work-02.svg",
      imageAlt: "简报裁纸刀编辑页，原始需求被整理为矛盾、缺口和下一步",
    },
  ] satisfies PublishedWork[],
} as const;
