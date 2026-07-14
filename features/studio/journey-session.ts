import { z } from "zod";

import { failure, success } from "@/lib/result";

const shortText = z.string().max(240);
const longText = z.string().max(800);

const day2DraftSchema = z
  .object({
    entry: shortText,
    mainInput: shortText,
    processing: longText,
    result: longText,
    previewUrl: z.string().max(500),
  })
  .strict();

const day3DraftSchema = z
  .object({
    reviewer: shortText,
    understood: longText,
    hesitation: longText,
    unnecessary: longText,
    valuable: longText,
    decision: z.enum(["", "keep", "change", "reject"]),
    changeSummary: longText,
  })
  .strict();

const day4DraftSchema = z
  .object({
    checks: z
      .object({
        emptyInput: z.boolean(),
        invalidInput: z.boolean(),
        errorState: z.boolean(),
      })
      .strict(),
    incident: longText,
    fix: longText,
    rollbackDecision: z.enum(["", "keep", "rollback"]),
    reflection: longText,
  })
  .strict();

const day5DraftSchema = z
  .object({
    emotion: shortText,
    keyInformation: longText,
    emphasis: longText,
    memorableAction: longText,
    responsiveChecked: z.boolean(),
    accessibilityChecked: z.boolean(),
  })
  .strict();

const day6DraftSchema = z
  .object({
    reader: shortText,
    solved: longText,
    pause: longText,
    usefulness: longText,
    oneChange: longText,
    category: z.enum(["", "must", "could", "later", "reject"]),
    finalChange: longText,
  })
  .strict();

const day7DraftSchema = z
  .object({
    checks: z
      .object({
        link: z.boolean(),
        coreFlow: z.boolean(),
        errorState: z.boolean(),
        mobile: z.boolean(),
        aiBoundary: z.boolean(),
        realFeedback: z.boolean(),
      })
      .strict(),
    title: shortText,
    introduction: z.string().max(1200),
    aiDataBoundary: z.string().max(1200),
    publicListing: z.boolean(),
  })
  .strict();

const savedDay = <T extends z.ZodTypeAny>(draft: T) =>
  z
    .object({
      draft,
      completedAt: z.string().datetime().nullable(),
    })
    .strict();

const journeySessionSchema = z
  .object({
    version: z.literal(1),
    days: z
      .object({
        2: savedDay(day2DraftSchema),
        3: savedDay(day3DraftSchema),
        4: savedDay(day4DraftSchema),
        5: savedDay(day5DraftSchema),
        6: savedDay(day6DraftSchema),
        7: savedDay(day7DraftSchema),
      })
      .strict(),
  })
  .strict();

const requiredShortText = z.string().trim().min(2).max(240);
const requiredLongText = z.string().trim().min(4).max(1200);

const day2CompleteSchema = day2DraftSchema.extend({
  entry: requiredShortText,
  mainInput: requiredShortText,
  processing: requiredLongText,
  result: requiredLongText,
  previewUrl: z.union([z.literal(""), z.url().max(500)]),
});

const day3CompleteSchema = day3DraftSchema.extend({
  reviewer: requiredShortText,
  understood: requiredLongText,
  hesitation: requiredLongText,
  unnecessary: requiredLongText,
  valuable: requiredLongText,
  decision: z.enum(["keep", "change", "reject"]),
  changeSummary: requiredLongText,
});

const day4CompleteSchema = day4DraftSchema.extend({
  checks: z.object({
    emptyInput: z.literal(true),
    invalidInput: z.literal(true),
    errorState: z.literal(true),
  }),
  incident: requiredLongText,
  fix: requiredLongText,
  rollbackDecision: z.enum(["keep", "rollback"]),
  reflection: requiredLongText,
});

const day5CompleteSchema = day5DraftSchema.extend({
  emotion: requiredShortText,
  keyInformation: requiredLongText,
  emphasis: requiredLongText,
  memorableAction: requiredLongText,
  responsiveChecked: z.literal(true),
  accessibilityChecked: z.literal(true),
});

const day6CompleteSchema = day6DraftSchema.extend({
  reader: requiredShortText,
  solved: requiredLongText,
  pause: requiredLongText,
  usefulness: requiredLongText,
  oneChange: requiredLongText,
  category: z.enum(["must", "could", "later", "reject"]),
  finalChange: requiredLongText,
});

const day7CompleteSchema = day7DraftSchema.extend({
  checks: z.object({
    link: z.literal(true),
    coreFlow: z.literal(true),
    errorState: z.literal(true),
    mobile: z.literal(true),
    aiBoundary: z.literal(true),
    realFeedback: z.literal(true),
  }),
  title: requiredShortText,
  introduction: z.string().trim().min(12).max(1200),
  aiDataBoundary: z.string().trim().min(12).max(1200),
  publicListing: z.literal(true),
});

export type JourneySession = z.infer<typeof journeySessionSchema>;
export type JourneyDay = keyof JourneySession["days"];
export type JourneyDayDraft<D extends JourneyDay> =
  JourneySession["days"][D]["draft"];

const KEY = "wei-ding-gao:journey:v1";

const completionErrors: Record<JourneyDay, string> = {
  2: "请写清入口、主要输入、核心处理和结果；预览链接如有填写，需要是完整网址。",
  3: "请记录一位真实反馈者的四项回答，并写下你的编辑决定。",
  4: "请完成三类校样检查，并记录问题、修复、回退决定和复盘。",
  5: "请完成四项体验决定，并确认移动端和无障碍检查。",
  6: "请记录一位真实试读者的回答、反馈分类和最终修改。",
  7: "请完成全部发行检查、作品说明、AI 与数据边界，并确认公开授权。",
};

export const dayVersions: Record<JourneyDay, string> = {
  2: "V0.1",
  3: "V0.2",
  4: "V0.3",
  5: "V0.5",
  6: "V0.8",
  7: "正式发行",
};

export function createJourneySession(): JourneySession {
  return {
    version: 1,
    days: {
      2: {
        draft: {
          entry: "",
          mainInput: "",
          processing: "",
          result: "",
          previewUrl: "",
        },
        completedAt: null,
      },
      3: {
        draft: {
          reviewer: "",
          understood: "",
          hesitation: "",
          unnecessary: "",
          valuable: "",
          decision: "",
          changeSummary: "",
        },
        completedAt: null,
      },
      4: {
        draft: {
          checks: {
            emptyInput: false,
            invalidInput: false,
            errorState: false,
          },
          incident: "",
          fix: "",
          rollbackDecision: "",
          reflection: "",
        },
        completedAt: null,
      },
      5: {
        draft: {
          emotion: "",
          keyInformation: "",
          emphasis: "",
          memorableAction: "",
          responsiveChecked: false,
          accessibilityChecked: false,
        },
        completedAt: null,
      },
      6: {
        draft: {
          reader: "",
          solved: "",
          pause: "",
          usefulness: "",
          oneChange: "",
          category: "",
          finalChange: "",
        },
        completedAt: null,
      },
      7: {
        draft: {
          checks: {
            link: false,
            coreFlow: false,
            errorState: false,
            mobile: false,
            aiBoundary: false,
            realFeedback: false,
          },
          title: "",
          introduction: "",
          aiDataBoundary: "",
          publicListing: false,
        },
        completedAt: null,
      },
    },
  };
}

export function saveJourneySession(session: JourneySession) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function loadJourneySession(): JourneySession | null {
  const value = sessionStorage.getItem(KEY);
  if (!value) return null;

  try {
    const parsed = journeySessionSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Invalid local data is cleared below.
  }

  sessionStorage.removeItem(KEY);
  return null;
}

export function isJourneyDayComplete(
  session: JourneySession,
  day: JourneyDay,
) {
  return session.days[day].completedAt !== null;
}

export function completeJourneyDay(
  session: JourneySession,
  day: JourneyDay,
  completedAt = new Date().toISOString(),
) {
  const draft = session.days[day].draft;
  const valid = (() => {
    switch (day) {
      case 2:
        return day2CompleteSchema.safeParse(draft).success;
      case 3:
        return day3CompleteSchema.safeParse(draft).success;
      case 4:
        return day4CompleteSchema.safeParse(draft).success;
      case 5:
        return day5CompleteSchema.safeParse(draft).success;
      case 6:
        return day6CompleteSchema.safeParse(draft).success;
      case 7:
        return day7CompleteSchema.safeParse(draft).success;
    }
  })();

  if (!valid) return failure(completionErrors[day]);

  return success({
    ...session,
    days: {
      ...session.days,
      [day]: { ...session.days[day], completedAt },
    },
  } as JourneySession);
}

export function reviseJourneyDay<D extends JourneyDay>(
  session: JourneySession,
  day: D,
  draft: JourneyDayDraft<D>,
): JourneySession {
  return {
    ...session,
    days: {
      ...session.days,
      [day]: { draft, completedAt: null },
    },
  };
}

export function getHighestUnlockedDay(
  dayOneConfirmed: boolean,
  session: JourneySession,
): 1 | JourneyDay {
  if (!dayOneConfirmed) return 1;

  for (const day of [2, 3, 4, 5, 6] as const) {
    if (!isJourneyDayComplete(session, day)) return day;
  }

  return 7;
}

export function isPublicationReady(session: JourneySession) {
  return (
    isJourneyDayComplete(session, 7) && session.days[7].draft.publicListing
  );
}

export function getStudioDayRoute(day: 1 | JourneyDay) {
  return `/studio/day-${day}`;
}
