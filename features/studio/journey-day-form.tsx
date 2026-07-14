import styles from "@/styles/studio.module.css";

import type {
  JourneyDay,
  JourneyDayDraft,
  JourneySession,
} from "./journey-session";

type JourneyDayFormProps = {
  day: JourneyDay;
  session: JourneySession;
  onChange: <D extends JourneyDay>(
    day: D,
    draft: JourneyDayDraft<D>,
  ) => void;
};

type WritingFieldProps = {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
};

function WritingField({
  id,
  label,
  hint,
  value,
  onChange,
  maxLength = 800,
  rows = 3,
}: WritingFieldProps) {
  return (
    <label className={styles.writingField} htmlFor={id}>
      <strong>{label}</strong>
      <span>{hint}</span>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ShortField({
  id,
  label,
  hint,
  value,
  onChange,
  maxLength = 240,
}: Omit<WritingFieldProps, "rows">) {
  return (
    <label className={styles.writingField} htmlFor={id}>
      <strong>{label}</strong>
      <span>{hint}</span>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function QuestionBlock({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.questionBlock} aria-labelledby={`question-${number}`}>
      <header>
        <span>{number}</span>
        <h2 id={`question-${number}`}>{title}</h2>
      </header>
      <div className={styles.questionBody}>{children}</div>
    </section>
  );
}

function ChoiceList({
  legend,
  name,
  value,
  choices,
  onChange,
}: {
  legend: string;
  name: string;
  value: string;
  choices: readonly { value: string; label: string; description: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className={styles.choiceField}>
      <legend>{legend}</legend>
      <div className={styles.choiceList}>
        {choices.map((choice) => (
          <label key={choice.value}>
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
            />
            <span>
              <strong>{choice.label}</strong>
              <small>{choice.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CheckList({
  legend,
  items,
}: {
  legend: string;
  items: readonly {
    key: string;
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }[];
}) {
  return (
    <fieldset className={styles.checkField}>
      <legend>{legend}</legend>
      <div className={styles.checkList}>
        {items.map((item) => (
          <label key={item.key}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(event) => item.onChange(event.target.checked)}
            />
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DayTwoForm({
  value,
  onChange,
}: {
  value: JourneyDayDraft<2>;
  onChange: (value: JourneyDayDraft<2>) => void;
}) {
  return (
    <>
      <QuestionBlock number="01" title="从哪里开始？">
        <ShortField
          id="day-2-entry"
          label="唯一入口"
          hint="例如：打开首页后，直接看到粘贴区域。"
          value={value.entry}
          onChange={(entry) => onChange({ ...value, entry })}
        />
      </QuestionBlock>
      <QuestionBlock number="02" title="使用者只需要交给它什么？">
        <ShortField
          id="day-2-input"
          label="主要输入"
          hint="只保留完成核心结果不可缺少的一项。"
          value={value.mainInput}
          onChange={(mainInput) => onChange({ ...value, mainInput })}
        />
      </QuestionBlock>
      <QuestionBlock number="03" title="中间只做哪一次关键处理？">
        <WritingField
          id="day-2-processing"
          label="核心处理"
          hint="用普通语言写清输入如何变成结果，不需要技术术语。"
          value={value.processing}
          onChange={(processing) => onChange({ ...value, processing })}
        />
      </QuestionBlock>
      <QuestionBlock number="04" title="最后让使用者拿走什么？">
        <WritingField
          id="day-2-result"
          label="唯一结果"
          hint="写出结果页面上最重要、可以被验证的内容。"
          value={value.result}
          onChange={(result) => onChange({ ...value, result })}
        />
        <ShortField
          id="day-2-preview"
          label="预览链接（可选）"
          hint="如果首版已有可访问地址，填写完整的 https:// 网址。"
          value={value.previewUrl}
          maxLength={500}
          onChange={(previewUrl) => onChange({ ...value, previewUrl })}
        />
      </QuestionBlock>
    </>
  );
}

function DayThreeForm({
  value,
  onChange,
}: {
  value: JourneyDayDraft<3>;
  onChange: (value: JourneyDayDraft<3>) => void;
}) {
  return (
    <>
      <aside className={styles.truthNote}>
        <strong>今天需要一位真实的人</strong>
        <p>把 V0.1 给身边的人看一次。这里记录他真实说过的话，不生成或模拟反馈。</p>
      </aside>
      <QuestionBlock number="01" title="谁看了你的第一版？">
        <ShortField
          id="day-3-reviewer"
          label="反馈者姓名或称呼"
          hint="例如：同事小周、朋友阿澄。"
          value={value.reviewer}
          onChange={(reviewer) => onChange({ ...value, reviewer })}
        />
      </QuestionBlock>
      <QuestionBlock number="02" title="他是怎么理解这件作品的？">
        <WritingField
          id="day-3-understood"
          label="他认为作品为谁解决什么"
          hint="尽量保留对方的原话。"
          value={value.understood}
          onChange={(understood) => onChange({ ...value, understood })}
        />
        <WritingField
          id="day-3-hesitation"
          label="哪一步让他犹豫"
          hint="没有犹豫也请写出你观察到的路径。"
          value={value.hesitation}
          onChange={(hesitation) => onChange({ ...value, hesitation })}
        />
      </QuestionBlock>
      <QuestionBlock number="03" title="哪些内容该删，哪些结果最有价值？">
        <WritingField
          id="day-3-unnecessary"
          label="看起来不必要的部分"
          hint="这通常是今天最值得删掉的候选。"
          value={value.unnecessary}
          onChange={(unnecessary) => onChange({ ...value, unnecessary })}
        />
        <WritingField
          id="day-3-valuable"
          label="对他最有价值的结果"
          hint="保住真正有用的部分，再谈美化。"
          value={value.valuable}
          onChange={(valuable) => onChange({ ...value, valuable })}
        />
      </QuestionBlock>
      <QuestionBlock number="04" title="你决定怎么编辑？">
        <ChoiceList
          legend="选择一个编辑决定"
          name="day-3-decision"
          value={value.decision}
          choices={[
            { value: "keep", label: "保留", description: "反馈验证了现有方向。" },
            { value: "change", label: "修改", description: "修正真实的理解或使用障碍。" },
            { value: "reject", label: "拒绝", description: "这条意见偏离本期边界。" },
          ]}
          onChange={(decision) =>
            onChange({
              ...value,
              decision: decision as JourneyDayDraft<3>["decision"],
            })
          }
        />
        <WritingField
          id="day-3-change"
          label="具体保留、修改或拒绝什么"
          hint="写一条能直接落实到 V0.2 的决定。"
          value={value.changeSummary}
          onChange={(changeSummary) => onChange({ ...value, changeSummary })}
        />
      </QuestionBlock>
    </>
  );
}

function DayFourForm({
  value,
  onChange,
}: {
  value: JourneyDayDraft<4>;
  onChange: (value: JourneyDayDraft<4>) => void;
}) {
  return (
    <>
      <QuestionBlock number="01" title="先故意试坏三次">
        <CheckList
          legend="完成三类校样"
          items={[
            {
              key: "empty",
              label: "空输入",
              description: "什么都不填时，页面有清楚的下一步。",
              checked: value.checks.emptyInput,
              onChange: (emptyInput) =>
                onChange({ ...value, checks: { ...value.checks, emptyInput } }),
            },
            {
              key: "invalid",
              label: "异常输入",
              description: "过长、格式错误或不相关内容不会破坏页面。",
              checked: value.checks.invalidInput,
              onChange: (invalidInput) =>
                onChange({ ...value, checks: { ...value.checks, invalidInput } }),
            },
            {
              key: "error",
              label: "错误状态",
              description: "处理失败时，使用者知道发生了什么和如何恢复。",
              checked: value.checks.errorState,
              onChange: (errorState) =>
                onChange({ ...value, checks: { ...value.checks, errorState } }),
            },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock number="02" title="选一次真正暴露的问题">
        <WritingField
          id="day-4-incident"
          label="发生了什么"
          hint="写清输入、预期结果和实际结果。"
          value={value.incident}
          onChange={(incident) => onChange({ ...value, incident })}
        />
        <WritingField
          id="day-4-fix"
          label="你做了什么修复"
          hint="只记录这次问题直接需要的修改。"
          value={value.fix}
          onChange={(fix) => onChange({ ...value, fix })}
        />
      </QuestionBlock>
      <QuestionBlock number="03" title="这次修改应该留下吗？">
        <ChoiceList
          legend="选择处理结果"
          name="day-4-rollback"
          value={value.rollbackDecision}
          choices={[
            { value: "keep", label: "保留修复", description: "新修改解决问题且没有破坏旧流程。" },
            { value: "rollback", label: "回退修改", description: "新修改造成更大问题，先恢复可用版本。" },
          ]}
          onChange={(rollbackDecision) =>
            onChange({
              ...value,
              rollbackDecision:
                rollbackDecision as JourneyDayDraft<4>["rollbackDecision"],
            })
          }
        />
        <WritingField
          id="day-4-reflection"
          label="下次如何更早发现"
          hint="把这次事故变成一条可复用的校样方法。"
          value={value.reflection}
          onChange={(reflection) => onChange({ ...value, reflection })}
        />
      </QuestionBlock>
    </>
  );
}

function DayFiveForm({
  value,
  onChange,
}: {
  value: JourneyDayDraft<5>;
  onChange: (value: JourneyDayDraft<5>) => void;
}) {
  return (
    <>
      <QuestionBlock number="01" title="先决定一种感受">
        <ShortField
          id="day-5-emotion"
          label="使用者首先应该感到什么"
          hint="例如：安心、清楚、被理解，而不是“高级感”。"
          value={value.emotion}
          onChange={(emotion) => onChange({ ...value, emotion })}
        />
      </QuestionBlock>
      <QuestionBlock number="02" title="建立清楚的信息顺序">
        <WritingField
          id="day-5-key-information"
          label="第一眼最重要的信息"
          hint="只选一条，其他内容都为它服务。"
          value={value.keyInformation}
          onChange={(keyInformation) => onChange({ ...value, keyInformation })}
        />
        <WritingField
          id="day-5-emphasis"
          label="哪一步需要安静或强调"
          hint="说明你会减少什么，又会突出什么。"
          value={value.emphasis}
          onChange={(emphasis) => onChange({ ...value, emphasis })}
        />
        <WritingField
          id="day-5-action"
          label="最值得记住的一个视觉动作"
          hint="动作必须帮助理解或反馈，不只是装饰。"
          value={value.memorableAction}
          onChange={(memorableAction) => onChange({ ...value, memorableAction })}
        />
      </QuestionBlock>
      <QuestionBlock number="03" title="让更多人真的能用">
        <CheckList
          legend="完成基础体验检查"
          items={[
            {
              key: "responsive",
              label: "移动端可浏览",
              description: "小屏上文字不重叠，核心流程可以完成。",
              checked: value.responsiveChecked,
              onChange: (responsiveChecked) =>
                onChange({ ...value, responsiveChecked }),
            },
            {
              key: "accessibility",
              label: "基础无障碍",
              description: "键盘焦点清楚，字段有名称，颜色不是唯一提示。",
              checked: value.accessibilityChecked,
              onChange: (accessibilityChecked) =>
                onChange({ ...value, accessibilityChecked }),
            },
          ]}
        />
      </QuestionBlock>
    </>
  );
}

function DaySixForm({
  value,
  onChange,
}: {
  value: JourneyDayDraft<6>;
  onChange: (value: JourneyDayDraft<6>) => void;
}) {
  return (
    <>
      <aside className={styles.truthNote}>
        <strong>今天观察，不解释</strong>
        <p>请一位目标使用者真实试用 V0.5。先看他怎么做，完成后再问下面四个问题。</p>
      </aside>
      <QuestionBlock number="01" title="谁真实试用了一次？">
        <ShortField
          id="day-6-reader"
          label="试读者姓名或称呼"
          hint="填写现实中完成这次试用的人。"
          value={value.reader}
          onChange={(reader) => onChange({ ...value, reader })}
        />
      </QuestionBlock>
      <QuestionBlock number="02" title="记录他看到的作品">
        <WritingField
          id="day-6-solved"
          label="他认为作品解决什么"
          hint="保留他的表达，不替他补全答案。"
          value={value.solved}
          onChange={(solved) => onChange({ ...value, solved })}
        />
        <WritingField
          id="day-6-pause"
          label="他在哪一步停顿"
          hint="记录真实行为和位置。"
          value={value.pause}
          onChange={(pause) => onChange({ ...value, pause })}
        />
        <WritingField
          id="day-6-usefulness"
          label="结果对他是否有用"
          hint="写下理由，不只写“有用”或“没用”。"
          value={value.usefulness}
          onChange={(usefulness) => onChange({ ...value, usefulness })}
        />
        <WritingField
          id="day-6-one-change"
          label="只能改一处时，他希望改什么"
          hint="这不是命令，而是一条需要判断的反馈。"
          value={value.oneChange}
          onChange={(oneChange) => onChange({ ...value, oneChange })}
        />
      </QuestionBlock>
      <QuestionBlock number="03" title="决定发布前是否处理">
        <ChoiceList
          legend="给反馈分类"
          name="day-6-category"
          value={value.category}
          choices={[
            { value: "must", label: "必须修", description: "阻碍核心流程，发布前处理。" },
            { value: "could", label: "可以修", description: "范围可控且明显改善体验。" },
            { value: "later", label: "下一版", description: "有价值，但不进入本期。" },
            { value: "reject", label: "不采纳", description: "属于偏好或偏离作品目标。" },
          ]}
          onChange={(category) =>
            onChange({
              ...value,
              category: category as JourneyDayDraft<6>["category"],
            })
          }
        />
        <WritingField
          id="day-6-final-change"
          label="最终修改或不修改的理由"
          hint="形成一条发布前可以完成的结论。"
          value={value.finalChange}
          onChange={(finalChange) => onChange({ ...value, finalChange })}
        />
      </QuestionBlock>
    </>
  );
}

function DaySevenForm({
  value,
  onChange,
}: {
  value: JourneyDayDraft<7>;
  onChange: (value: JourneyDayDraft<7>) => void;
}) {
  return (
    <>
      <QuestionBlock number="01" title="完成最后一次发行检查">
        <CheckList
          legend="六项全部确认后才能发行"
          items={[
            ["link", "公开入口可访问", "发行页能打开，并能看到作品或清楚的作品说明。"],
            ["coreFlow", "核心流程已完成", "从入口到结果完整走过一次。"],
            ["errorState", "错误状态可理解", "失败时有原因和恢复方向。"],
            ["mobile", "移动端可浏览", "在小屏上完成过关键检查。"],
            ["aiBoundary", "AI 与数据边界明确", "使用者知道 AI 做什么、数据如何使用。"],
            ["realFeedback", "存在真实试用反馈", "Day 6 的试读来自一位现实中的人。"],
          ].map(([key, label, description]) => ({
            key,
            label,
            description,
            checked: value.checks[key as keyof typeof value.checks],
            onChange: (checked: boolean) =>
              onChange({
                ...value,
                checks: { ...value.checks, [key]: checked },
              }),
          }))}
        />
      </QuestionBlock>
      <QuestionBlock number="02" title="用自己的话介绍作品">
        <ShortField
          id="day-7-title"
          label="作品名称"
          hint="让人能够记住和复述。"
          value={value.title}
          onChange={(title) => onChange({ ...value, title })}
        />
        <WritingField
          id="day-7-introduction"
          label="它为谁解决什么，如何使用"
          hint="这段文字会在授权后进入公开特刊。"
          value={value.introduction}
          rows={5}
          maxLength={1200}
          onChange={(introduction) => onChange({ ...value, introduction })}
        />
        <WritingField
          id="day-7-boundary"
          label="AI 做了什么，数据如何处理"
          hint="明确哪些判断仍由人完成，以及作品是否保存或分享输入内容。"
          value={value.aiDataBoundary}
          rows={5}
          maxLength={1200}
          onChange={(aiDataBoundary) => onChange({ ...value, aiDataBoundary })}
        />
      </QuestionBlock>
      <QuestionBlock number="03" title="确认公开范围">
        <label className={styles.permissionCheck}>
          <input
            type="checkbox"
            checked={value.publicListing}
            onChange={(event) =>
              onChange({ ...value, publicListing: event.target.checked })
            }
          />
          <span>
            <strong>同意将作品说明加入第 001 期公开特刊</strong>
            <small>只公开 Day 1 的作品方向、上面的作品说明和关键编辑决定；不会公开反馈者姓名或完整过程记录。</small>
          </span>
        </label>
      </QuestionBlock>
    </>
  );
}

export function JourneyDayForm({
  day,
  session,
  onChange,
}: JourneyDayFormProps) {
  switch (day) {
    case 2:
      return (
        <DayTwoForm
          value={session.days[2].draft}
          onChange={(draft) => onChange(2, draft)}
        />
      );
    case 3:
      return (
        <DayThreeForm
          value={session.days[3].draft}
          onChange={(draft) => onChange(3, draft)}
        />
      );
    case 4:
      return (
        <DayFourForm
          value={session.days[4].draft}
          onChange={(draft) => onChange(4, draft)}
        />
      );
    case 5:
      return (
        <DayFiveForm
          value={session.days[5].draft}
          onChange={(draft) => onChange(5, draft)}
        />
      );
    case 6:
      return (
        <DaySixForm
          value={session.days[6].draft}
          onChange={(draft) => onChange(6, draft)}
        />
      );
    case 7:
      return (
        <DaySevenForm
          value={session.days[7].draft}
          onChange={(draft) => onChange(7, draft)}
        />
      );
  }
}
