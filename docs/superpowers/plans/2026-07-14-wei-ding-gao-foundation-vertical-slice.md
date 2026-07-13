# 《未定稿》首个纵向切片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可在真实浏览器中体验的《未定稿》首个纵向切片，覆盖作品级品牌首页、自由选题访谈、AI 诊断、Day 1 私人工作室和第 001 期发行特刊。

**Architecture:** 采用 Next.js App Router + TypeScript 的模块化单体。第一阶段先建立品牌体验与申请到入驻的核心闭环；业务规则集中在 `src/features`，页面只编排组件；AI 诊断通过可替换 provider 接口接入 Anthropic，演示模式使用显式 deterministic provider，不把失败静默伪装成 AI 成功。持久化、账户、支付、小班协作和主编后台在后续独立计划中实现，避免首个切片铺出大量空壳模块。

**Tech Stack:** Next.js、React、TypeScript、CSS Modules、Motion、Zod、Anthropic TypeScript SDK、Vitest、Testing Library、Playwright、axe-core。

---

## 0. 规格拆分与阶段边界

完整产品包含多个可以独立验收的子系统。按以下顺序分阶段，每一阶段单独写实施计划并产出可运行软件：

1. **Foundation Vertical Slice（本计划）**：品牌首页 → 选题访谈 → AI 诊断 → Day 1 工作室 → 发行特刊；使用浏览器 sessionStorage 保存演示进度。
2. **Accounts & Persistence**：账户、PostgreSQL、项目/版本/批注/能力证据持久化、对象存储、权限。
3. **Residency Operations**：期次、三人编辑桌、互评、匿名卡点、工作坊、主编风险视图。
4. **Commerce**：基础驻留席位、主编桌、价格后台、订单、支付回调、候补、退款与审计。
5. **AI Learning Orchestration**：七日任务生成、按能力渐退、对象级批注、救援/挑战模式、成本与评测。
6. **Publication & Community**：真实作品提交、隔离预览、自动验收、策展、公开授权、特刊、后续修订。
7. **Production Hardening**：安全、隐私请求、通知、监控、性能、视觉回归矩阵和首期开营演练。

本计划明确不实现账户、数据库、支付、多人实时数据、完整七日路线或第三方构建工具 OAuth。首个切片的验收重点是：艺术方向成立、核心交互清晰、AI 诊断契约可用、页面在桌面和移动端可访问。

## 1. 文件结构

```text
app/
  (public)/
    page.tsx                          # 品牌首页
    apply/page.tsx                    # 选题访谈
    diagnosis/page.tsx                # 诊断单
    publication/001/page.tsx          # 第 001 期特刊
  studio/
    day-1/page.tsx                    # Day 1 私人工作室
  api/
    diagnosis/route.ts                # 诊断 API
  layout.tsx                          # 全局字体、元数据、Providers
  globals.css                         # reset、tokens、基础排版、动效降级
components/
  brand/
    masthead.tsx                      # 《未定稿》刊头
    editorial-link.tsx                # 统一编辑式链接
    issue-strip.tsx                   # 期号/状态栏
  motion/
    reveal.tsx                        # 可访问的渐入编排
  publication/
    work-spread.tsx                   # 作品跨页
features/
  application/
    application-flow.tsx              # 访谈容器
    interview-step.tsx                # 单题交互
    progress-folio.tsx                # 编辑式进度
    application-session.ts            # sessionStorage 边界
    application.types.ts              # 访谈数据类型
    application.schema.ts             # Zod 校验
    application.test.ts               # 流程规则测试
  diagnosis/
    diagnosis.schema.ts               # 结构化诊断契约
    diagnosis-provider.ts             # provider 接口
    anthropic-diagnosis-provider.ts   # Claude 实现
    demo-diagnosis-provider.ts        # 显式演示实现
    create-diagnosis.ts               # provider 选择与用例
    diagnosis-sheet.tsx               # 诊断单 UI
    create-diagnosis.test.ts          # 用例测试
  studio/
    day-one-brief.ts                  # Day 1 内容模型
    boundary-editor.tsx               # 项目边界编辑器
    margin-note.tsx                   # 对象级 AI 批注
    studio-session.ts                 # 本地工作室状态
    studio-session.test.ts            # 状态测试
  publication/
    issue-001.ts                      # 首期策展样例数据
lib/
  env.ts                              # 服务端环境变量校验
  result.ts                           # 明确 success/error 结果类型
  cn.ts                               # className 合并
  test/
    render.tsx                        # 测试渲染器
public/
  textures/
    paper-noise.svg                   # 本地纸张纹理
  publication/
    work-01.svg                       # 样例作品图
    work-02.svg
styles/
  editorial.module.css                # 共享编辑版式
  studio.module.css                   # 工作室空间系统
  publication.module.css              # 特刊版式
 tests/
  e2e/
    public-journey.spec.ts            # 首页到 Day 1
    accessibility.spec.ts             # axe 和键盘路径
    visual.spec.ts                    # 关键页面截图
vitest.config.ts
vitest.setup.ts
playwright.config.ts
.env.example
README.md
```

## Task 1: 初始化 Next.js、测试与质量工具

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/(public)/page.tsx`
- Create: `.env.example`

- [ ] **Step 1: 用官方脚手架创建 TypeScript App Router 项目**

Run:

```bash
npm create next-app@latest . -- --typescript --eslint --app --src-dir=false --import-alias="@/*" --use-npm --no-tailwind
```

Expected: `package.json`、`app/`、`next.config.ts`、`tsconfig.json` 创建成功，命令退出码为 0。

- [ ] **Step 2: 安装运行和测试依赖**

Run:

```bash
npm install motion zod @anthropic-ai/sdk clsx
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test @axe-core/playwright prettier prettier-plugin-organize-imports
```

Expected: 依赖安装成功，无 `ERESOLVE` 或安全安装错误。

- [ ] **Step 3: 添加测试脚本**

在 `package.json` 的 `scripts` 中使用：

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:visual": "playwright test tests/e2e/visual.spec.ts",
  "format": "prettier --write .",
  "check": "npm run typecheck && npm run test && npm run build"
}
```

若当前 Next.js 脚手架未提供 `next lint`，将 `lint` 改为：

```json
"lint": "eslint ."
```

- [ ] **Step 4: 配置 Vitest**

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: 配置 Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 6: 建立最小应用并验证基线**

Create `app/(public)/page.tsx`:

```tsx
export default function HomePage() {
  return <main><h1>未定稿</h1></main>;
}
```

Run:

```bash
npm run typecheck
npm run test
npm run build
```

Expected: 类型检查通过；Vitest 显示 `No test files found` 时允许非零退出前先创建 Task 2 的首个测试，或临时使用 `vitest run --passWithNoTests`；构建生成首页且退出码为 0。

- [ ] **Step 7: 提交脚手架**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts app .env.example
git commit -m "chore: scaffold wei ding gao web app"
```

## Task 2: 建立编辑部设计系统与品牌基础组件

**Files:**
- Create: `components/brand/masthead.tsx`
- Create: `components/brand/masthead.test.tsx`
- Create: `components/brand/editorial-link.tsx`
- Create: `components/brand/issue-strip.tsx`
- Create: `components/motion/reveal.tsx`
- Create: `styles/editorial.module.css`
- Create: `public/textures/paper-noise.svg`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: 先写刊头可访问性测试**

Create `components/brand/masthead.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Masthead } from "./masthead";

describe("Masthead", () => {
  it("renders the Chinese brand as the primary home link", () => {
    render(<Masthead issue="DRAFT 001" />);
    expect(screen.getByRole("link", { name: "未定稿，返回首页" })).toHaveAttribute("href", "/");
    expect(screen.getByText("DRAFT 001")).toBeVisible();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test -- components/brand/masthead.test.tsx
```

Expected: FAIL，提示无法找到 `./masthead`。

- [ ] **Step 3: 实现刊头与辅助组件**

Create `components/brand/masthead.tsx`:

```tsx
import Link from "next/link";
import styles from "@/styles/editorial.module.css";

export function Masthead({ issue }: { issue: string }) {
  return (
    <header className={styles.masthead}>
      <Link className={styles.brand} href="/" aria-label="未定稿，返回首页">未定稿</Link>
      <span className={styles.issue}>{issue}</span>
      <span className={styles.descriptor}>AI 产品驻留计划</span>
    </header>
  );
}
```

Create `components/brand/editorial-link.tsx`:

```tsx
import Link, { type LinkProps } from "next/link";
import type { PropsWithChildren } from "react";
import styles from "@/styles/editorial.module.css";

export function EditorialLink({ children, ...props }: PropsWithChildren<LinkProps>) {
  return <Link {...props} className={styles.editorialLink}>{children}<span aria-hidden="true">↗</span></Link>;
}
```

Create `components/brand/issue-strip.tsx`:

```tsx
import styles from "@/styles/editorial.module.css";

export function IssueStrip({ status, date }: { status: string; date: string }) {
  return <div className={styles.issueStrip}><span>{status}</span><time>{date}</time></div>;
}
```

- [ ] **Step 4: 建立全局 tokens 和纸张质感**

Create `public/textures/paper-noise.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="4" stitchTiles="stitch"/></filter>
  <rect width="100%" height="100%" filter="url(#noise)" opacity=".18"/>
</svg>
```

Replace `app/globals.css` with tokens that include:

```css
:root {
  --paper: #efe9dc;
  --paper-bright: #f8f3e9;
  --ink: #171713;
  --ink-muted: #68645b;
  --proof-red: #e63c27;
  --editor-blue: #315fd6;
  --acid-note: #d7ef45;
  --rule: color-mix(in srgb, var(--ink) 24%, transparent);
  --font-display: var(--font-serif), "Songti SC", serif;
  --font-body: var(--font-serif), "Noto Serif SC", serif;
  --font-mono: var(--font-mono), "SFMono-Regular", monospace;
  --ease-editorial: cubic-bezier(.2,.8,.2,1);
  --duration-fast: 160ms;
  --duration-scene: 720ms;
}

* { box-sizing: border-box; }
html { background: var(--paper); color: var(--ink); }
body { margin: 0; min-height: 100vh; background: var(--paper) url("/textures/paper-noise.svg"); font-family: var(--font-body); }
a { color: inherit; }
button, input, textarea { font: inherit; }
:focus-visible { outline: 3px solid var(--editor-blue); outline-offset: 4px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```

在 `app/layout.tsx` 使用 `next/font/google` 的 `Noto_Serif_SC` 和 `IBM_Plex_Mono`，并设置中文 metadata：

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const serif = Noto_Serif_SC({ subsets: ["latin"], weight: ["400", "600", "700", "900"], variable: "--font-serif", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "未定稿", template: "%s｜未定稿" },
  description: "面向非技术创作者的 AI 产品驻留计划。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${serif.variable} ${mono.variable}`}>{children}</body></html>;
}
```

- [ ] **Step 5: 实现可降级的场景渐入**

Create `components/motion/reveal.tsx`:

```tsx
"use client";

import { motion, useReducedMotion } from "motion/react";
import type { PropsWithChildren } from "react";

export function Reveal({ children, delay = 0 }: PropsWithChildren<{ delay?: number }>) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : .72, delay, ease: [.2, .8, .2, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 6: 运行测试和类型检查**

```bash
npm run test -- components/brand/masthead.test.tsx
npm run typecheck
```

Expected: PASS。

- [ ] **Step 7: 提交设计系统基础**

```bash
git add app components styles public/textures
git commit -m "feat: establish editorial design system"
```

## Task 3: 构建作品级品牌首页

**Files:**
- Modify: `app/(public)/page.tsx`
- Create: `app/(public)/home.module.css`
- Create: `tests/e2e/home.spec.ts`

- [ ] **Step 1: 先写首页行为测试**

Create `tests/e2e/home.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("home presents the residency and starts an application", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /所有好作品/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "提交你的选题" })).toHaveAttribute("href", "/apply");
  await expect(page.getByText("12 位驻留创作者")).toBeVisible();
  await expect(page.getByText("7 天完成一次正式发行")).toBeVisible();
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx playwright install chromium
npm run test:e2e -- tests/e2e/home.spec.ts --project=desktop-chromium
```

Expected: FAIL，首页缺少指定标题和 CTA。

- [ ] **Step 3: 实现首页内容结构**

`app/(public)/page.tsx` 必须包含以下语义区块：

```tsx
import { EditorialLink } from "@/components/brand/editorial-link";
import { IssueStrip } from "@/components/brand/issue-strip";
import { Masthead } from "@/components/brand/masthead";
import { Reveal } from "@/components/motion/reveal";
import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main>
      <Masthead issue="DRAFT 001" />
      <section className={styles.hero}>
        <Reveal><p className={styles.kicker}>本期征稿中 · 12 个席位</p></Reveal>
        <Reveal delay={.08}><h1>所有好作品，<em>都曾经是未定稿。</em></h1></Reveal>
        <Reveal delay={.16}><p className={styles.lede}>带着一个真实问题入驻编辑部。七天里，在 AI 编辑搭档、真人主编与同伴试读中，把它做成可以被使用、被分享、被正式发行的数字作品。</p></Reveal>
        <Reveal delay={.24}><EditorialLink href="/apply">提交你的选题</EditorialLink></Reveal>
      </section>
      <IssueStrip status="第 001 期 · 开放申请" date="7 DAY RESIDENCY" />
      <section className={styles.facts} aria-label="驻留计划摘要">
        <article><strong>12</strong><span>位驻留创作者</span></article>
        <article><strong>07</strong><span>天完成一次正式发行</span></article>
        <article><strong>01</strong><span>件真实可访问作品</span></article>
      </section>
      <section className={styles.manifesto}>
        <p>不是学完再做。</p><h2>在做一件真实作品的过程中，学会下一次独立完成。</h2>
      </section>
      <section className={styles.route} aria-labelledby="route-title">
        <h2 id="route-title">一份稿件的七日编辑周期</h2>
        <ol>{["立题", "初稿", "编辑", "校样", "成形", "试读", "发行"].map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ol>
      </section>
      <section className={styles.finalCta}><p>你的想法，值得一次正式发行。</p><EditorialLink href="/apply">提交你的选题</EditorialLink></section>
    </main>
  );
}
```

- [ ] **Step 4: 在 CSS 中完成非模板化版式**

`app/(public)/home.module.css` 必须实现：

- hero 使用不对称双栏和超大中文标题；
- `em` 以错位斜体形成第二节奏，不使用渐变文字；
- facts 使用编辑表格而非 KPI 卡片；
- route 在桌面横向排版、移动端纵向排版；
- CTA 具备明确 hover/focus，但不使用胶囊按钮；
- 1440、1024、390 宽度均无水平滚动。

关键 CSS：

```css
.hero { min-height: 78svh; padding: clamp(5rem, 10vw, 10rem) 5vw 4rem; display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(18rem, .65fr); align-items: end; gap: 5vw; border-bottom: 1px solid var(--ink); }
.hero h1 { grid-column: 1; margin: 0; max-width: 12ch; font-size: clamp(4rem, 9vw, 9rem); line-height: .88; letter-spacing: -.075em; }
.hero h1 em { display: block; margin-left: 12vw; font-weight: 400; }
.lede { grid-column: 2; grid-row: 2; max-width: 32rem; border-left: .45rem solid var(--proof-red); padding-left: 1.25rem; line-height: 1.9; }
.facts { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid var(--ink); }
.facts article { min-height: 14rem; padding: 2rem; border-right: 1px solid var(--ink); display: flex; flex-direction: column; justify-content: space-between; }
.facts strong { font-family: var(--font-mono); font-size: clamp(3rem, 6vw, 6rem); color: var(--proof-red); }
@media (max-width: 760px) { .hero { grid-template-columns: 1fr; min-height: auto; } .lede { grid-column: 1; grid-row: auto; } .facts { grid-template-columns: 1fr; } .facts article { min-height: 9rem; border-right: 0; border-bottom: 1px solid var(--ink); } }
```

- [ ] **Step 5: 运行首页 E2E 与截图检查**

```bash
npm run test:e2e -- tests/e2e/home.spec.ts --project=desktop-chromium
npm run test:e2e -- tests/e2e/home.spec.ts --project=mobile-chromium
```

Expected: 两个项目均 PASS；人工打开首页确认排版节奏和中文换行。

- [ ] **Step 6: 提交首页**

```bash
git add app/'(public)' components tests/e2e/home.spec.ts
git commit -m "feat: create wei ding gao editorial landing page"
```

## Task 4: 建立自由选题访谈状态机

**Files:**
- Create: `features/application/application.types.ts`
- Create: `features/application/application.schema.ts`
- Create: `features/application/application-flow.ts`
- Create: `features/application/application.test.ts`
- Create: `features/application/application-session.ts`

- [ ] **Step 1: 写失败的状态机测试**

Create `features/application/application.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { advanceApplication, createApplicationDraft } from "./application-flow";

describe("application flow", () => {
  it("does not advance when the current answer is empty", () => {
    const draft = createApplicationDraft();
    const result = advanceApplication(draft, "   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("请先写下一个具体回答。");
  });

  it("records an answer and advances one step", () => {
    const draft = createApplicationDraft();
    const result = advanceApplication(draft, "每周整理访谈记录时，我很难快速发现共性。");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stepIndex).toBe(1);
      expect(result.value.answers.problem).toContain("访谈记录");
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm run test -- features/application/application.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 定义类型和七个访谈步骤**

Create `features/application/application.types.ts`:

```ts
export const applicationSteps = [
  { id: "problem", eyebrow: "01 / 问题", prompt: "你想解决的真实问题是什么？", help: "描述一个反复发生、让你或他人感到麻烦的具体时刻。" },
  { id: "audience", eyebrow: "02 / 读者", prompt: "这个问题主要发生在谁身上？", help: "先只选择一种最重要的使用者。" },
  { id: "currentMethod", eyebrow: "03 / 现状", prompt: "他们现在如何处理它？", help: "写下现有工具、人工步骤或放弃处理的原因。" },
  { id: "painMoment", eyebrow: "04 / 瞬间", prompt: "最令人挫败的一刻是什么？", help: "具体到一个动作、一段等待或一次错误。" },
  { id: "outcome", eyebrow: "05 / 结果", prompt: "七天后，什么结果值得交给别人使用？", help: "用可观察结果描述，不要罗列功能。" },
  { id: "materials", eyebrow: "06 / 素材", prompt: "你已经拥有哪些真实素材？", help: "例如访谈记录、表格、文本、图片或工作流程。" },
  { id: "firstReader", eyebrow: "07 / 试读", prompt: "谁愿意成为第一位试用者？", help: "可以是一位同事、朋友、同学或你自己。" },
] as const;

export type ApplicationStepId = typeof applicationSteps[number]["id"];
export type ApplicationAnswers = Partial<Record<ApplicationStepId, string>>;
export type ApplicationDraft = { stepIndex: number; answers: ApplicationAnswers };
```

Create `features/application/application.schema.ts`:

```ts
import { z } from "zod";

const answer = z.string().trim().min(8, "请至少写下 8 个字，让编辑搭档理解你的真实场景。").max(800, "单项回答请控制在 800 字以内。");
export const applicationAnswersSchema = z.object({
  problem: answer,
  audience: answer,
  currentMethod: answer,
  painMoment: answer,
  outcome: answer,
  materials: answer,
  firstReader: answer,
});
export type CompleteApplicationAnswers = z.infer<typeof applicationAnswersSchema>;
```

- [ ] **Step 4: 实现最小状态机**

Create `lib/result.ts`:

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const success = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const failure = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Create `features/application/application-flow.ts`:

```ts
import { failure, success, type Result } from "@/lib/result";
import { applicationSteps, type ApplicationDraft } from "./application.types";

export function createApplicationDraft(): ApplicationDraft { return { stepIndex: 0, answers: {} }; }

export function advanceApplication(draft: ApplicationDraft, rawAnswer: string): Result<ApplicationDraft, string> {
  const answer = rawAnswer.trim();
  if (!answer) return failure("请先写下一个具体回答。");
  const step = applicationSteps[draft.stepIndex];
  if (!step) return failure("这份选题访谈已经完成。");
  return success({ stepIndex: draft.stepIndex + 1, answers: { ...draft.answers, [step.id]: answer } });
}
```

- [ ] **Step 5: 实现明确的 sessionStorage 边界**

Create `features/application/application-session.ts`:

```ts
import type { ApplicationDraft } from "./application.types";

const KEY = "wei-ding-gao:application:v1";
export function saveApplicationDraft(draft: ApplicationDraft) { sessionStorage.setItem(KEY, JSON.stringify(draft)); }
export function loadApplicationDraft(): ApplicationDraft | null {
  const value = sessionStorage.getItem(KEY);
  if (!value) return null;
  try { return JSON.parse(value) as ApplicationDraft; } catch { sessionStorage.removeItem(KEY); return null; }
}
export function clearApplicationDraft() { sessionStorage.removeItem(KEY); }
```

- [ ] **Step 6: 运行测试**

```bash
npm run test -- features/application/application.test.ts
```

Expected: 2 tests PASS。

- [ ] **Step 7: 提交访谈状态机**

```bash
git add features/application lib/result.ts
git commit -m "feat: add application interview state machine"
```

## Task 5: 构建选题访谈体验

**Files:**
- Create: `app/(public)/apply/page.tsx`
- Create: `app/(public)/apply/apply.module.css`
- Create: `features/application/application-flow.tsx`
- Create: `features/application/interview-step.tsx`
- Create: `features/application/progress-folio.tsx`
- Create: `tests/e2e/application.spec.ts`

- [ ] **Step 1: 先写访谈 E2E**

Create `tests/e2e/application.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("applicant completes seven editorial questions", async ({ page }) => {
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
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm run test:e2e -- tests/e2e/application.spec.ts --project=desktop-chromium
```

Expected: FAIL，`/apply` 不存在。

- [ ] **Step 3: 实现单题和进度组件**

`features/application/interview-step.tsx`:

```tsx
export function InterviewStep({ eyebrow, prompt, help, value, onChange, error }: {
  eyebrow: string; prompt: string; help: string; value: string; onChange: (value: string) => void; error?: string;
}) {
  return <fieldset><legend><span>{eyebrow}</span>{prompt}</legend><p>{help}</p><label htmlFor="application-answer">你的回答</label><textarea id="application-answer" autoFocus value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={error ? "answer-error" : undefined} rows={7} />{error && <p id="answer-error" role="alert">{error}</p>}</fieldset>;
}
```

`features/application/progress-folio.tsx`:

```tsx
import { applicationSteps } from "./application.types";
export function ProgressFolio({ current }: { current: number }) {
  return <ol aria-label="选题访谈进度">{applicationSteps.map((step, index) => <li key={step.id} aria-current={index === current ? "step" : undefined} data-complete={index < current}>{String(index + 1).padStart(2, "0")}<span>{step.eyebrow.split(" / ")[1]}</span></li>)}</ol>;
}
```

- [ ] **Step 4: 实现客户端访谈容器**

`features/application/application-flow.tsx` 使用状态机，并在最后把完整 answers 写入 sessionStorage 后导航：

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { advanceApplication, createApplicationDraft } from "./application-flow";
import { applicationAnswersSchema } from "./application.schema";
import { applicationSteps } from "./application.types";
import { loadApplicationDraft, saveApplicationDraft } from "./application-session";
import { InterviewStep } from "./interview-step";
import { ProgressFolio } from "./progress-folio";

export function ApplicationFlow() {
  const router = useRouter();
  const [draft, setDraft] = useState(createApplicationDraft);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => { const saved = loadApplicationDraft(); if (saved) setDraft(saved); }, []);
  const step = applicationSteps[draft.stepIndex];
  function submit() {
    const result = advanceApplication(draft, answer);
    if (!result.ok) return setError(result.error);
    const next = result.value;
    saveApplicationDraft(next);
    if (next.stepIndex === applicationSteps.length) {
      const parsed = applicationAnswersSchema.safeParse(next.answers);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "请补全访谈。");
      router.push("/diagnosis");
      return;
    }
    setDraft(next); setAnswer(""); setError(undefined);
  }
  if (!step) return null;
  return <div><ProgressFolio current={draft.stepIndex} /><InterviewStep {...step} value={answer} onChange={setAnswer} error={error} /><button type="button" onClick={submit}>{draft.stepIndex === applicationSteps.length - 1 ? "完成访谈" : "继续编辑"}</button></div>;
}
```

- [ ] **Step 5: 实现页面与编辑式布局**

`app/(public)/apply/page.tsx` 包含 Masthead、说明和 ApplicationFlow；桌面端采用 35/65 双栏，移动端进度改为横向滚动；textarea 不使用默认表单卡片外观，而像一张正在书写的稿纸。

- [ ] **Step 6: 运行 E2E**

```bash
npm run test:e2e -- tests/e2e/application.spec.ts --project=desktop-chromium
npm run test:e2e -- tests/e2e/application.spec.ts --project=mobile-chromium
```

Expected: 两端 PASS。

- [ ] **Step 7: 提交访谈 UI**

```bash
git add app/'(public)'/apply features/application tests/e2e/application.spec.ts
git commit -m "feat: build editorial application interview"
```

## Task 6: 建立结构化 AI 诊断契约与 Anthropic Provider

**Files:**
- Create: `features/diagnosis/diagnosis.schema.ts`
- Create: `features/diagnosis/diagnosis-provider.ts`
- Create: `features/diagnosis/anthropic-diagnosis-provider.ts`
- Create: `features/diagnosis/demo-diagnosis-provider.ts`
- Create: `features/diagnosis/create-diagnosis.ts`
- Create: `features/diagnosis/create-diagnosis.test.ts`
- Create: `lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: 写 provider 选择和输出测试**

Create `features/diagnosis/create-diagnosis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDiagnosis } from "./create-diagnosis";
import { DemoDiagnosisProvider } from "./demo-diagnosis-provider";

const answers = {
  problem: "每周整理访谈记录时，很难快速发现共性。",
  audience: "需要处理反馈的产品经理。",
  currentMethod: "复制到表格后手工分类。",
  painMoment: "面对几十条记录不知道先看哪里。",
  outcome: "得到带依据的主题和下一步建议。",
  materials: "匿名访谈记录和分类表格。",
  firstReader: "一位产品经理同事。",
};

describe("createDiagnosis", () => {
  it("returns a structured diagnosis from the selected provider", async () => {
    const result = await createDiagnosis(answers, new DemoDiagnosisProvider());
    expect(result.verdict).toBe("revise");
    expect(result.coreFlow).toHaveLength(3);
    expect(result.mustCut.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm run test -- features/diagnosis/create-diagnosis.test.ts
```

Expected: FAIL，诊断模块不存在。

- [ ] **Step 3: 定义结构化输出契约**

Create `features/diagnosis/diagnosis.schema.ts`:

```ts
import { z } from "zod";

export const diagnosisSchema = z.object({
  verdict: z.enum(["accepted", "revise", "editor_review"]),
  headline: z.string(),
  problemStatement: z.string(),
  primaryAudience: z.string(),
  coreScenario: z.string(),
  valueDensity: z.enum(["low", "medium", "high"]),
  dataReadiness: z.enum(["low", "medium", "high"]),
  technicalRisk: z.enum(["low", "medium", "high"]),
  sevenDayProbability: z.number().min(0).max(100),
  coreFlow: z.array(z.string()).length(3),
  primaryAiCapability: z.string(),
  mustCut: z.array(z.string()).min(1).max(4),
  firstReaderPlan: z.string(),
  editorNote: z.string(),
});
export type Diagnosis = z.infer<typeof diagnosisSchema>;
```

- [ ] **Step 4: 定义 provider 接口和演示实现**

`features/diagnosis/diagnosis-provider.ts`:

```ts
import type { CompleteApplicationAnswers } from "@/features/application/application.schema";
import type { Diagnosis } from "./diagnosis.schema";
export interface DiagnosisProvider { diagnose(answers: CompleteApplicationAnswers): Promise<Diagnosis>; }
```

`features/diagnosis/demo-diagnosis-provider.ts` 返回明确标记为演示规则生成的诊断，并固定 `verdict: "revise"`、三步 coreFlow、至少一个 mustCut。页面必须显示“演示评估，不代表正式 AI 审核”，禁止将其伪装为线上 AI 输出。

- [ ] **Step 5: 实现 Anthropic provider**

Create `features/diagnosis/anthropic-diagnosis-provider.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { CompleteApplicationAnswers } from "@/features/application/application.schema";
import type { DiagnosisProvider } from "./diagnosis-provider";
import { diagnosisSchema } from "./diagnosis.schema";

export class AnthropicDiagnosisProvider implements DiagnosisProvider {
  constructor(private readonly client = new Anthropic()) {}
  async diagnose(answers: CompleteApplicationAnswers) {
    const response = await this.client.messages.parse({
      model: process.env.ANTHROPIC_DIAGNOSIS_MODEL ?? "claude-opus-4-8",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(diagnosisSchema) },
      system: "你是《未定稿》的选题编辑。温暖、具体、克制。你的任务是判断一个非技术创作者的自由选题能否在七天内形成真实可试用的 AI 微应用。优先删减，不替用户扩大范围。只依据用户提供的内容，不编造市场事实。",
      messages: [{ role: "user", content: JSON.stringify(answers) }],
    });
    if (!response.parsed_output) throw new Error("DIAGNOSIS_PARSE_FAILED");
    return response.parsed_output;
  }
}
```

- [ ] **Step 6: 实现用例与明确模式选择**

Create `features/diagnosis/create-diagnosis.ts`:

```ts
import type { CompleteApplicationAnswers } from "@/features/application/application.schema";
import type { DiagnosisProvider } from "./diagnosis-provider";
export function createDiagnosis(answers: CompleteApplicationAnswers, provider: DiagnosisProvider) { return provider.diagnose(answers); }
```

Create `lib/env.ts`:

```ts
import { z } from "zod";
const schema = z.object({ APP_DEMO_MODE: z.enum(["true", "false"]).default("true"), ANTHROPIC_API_KEY: z.string().optional(), ANTHROPIC_DIAGNOSIS_MODEL: z.string().optional() });
export const env = schema.parse({ APP_DEMO_MODE: process.env.APP_DEMO_MODE, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, ANTHROPIC_DIAGNOSIS_MODEL: process.env.ANTHROPIC_DIAGNOSIS_MODEL });
```

`.env.example`:

```dotenv
APP_DEMO_MODE=true
ANTHROPIC_API_KEY=
ANTHROPIC_DIAGNOSIS_MODEL=claude-opus-4-8
```

模式规则：`APP_DEMO_MODE=true` 明确使用 Demo provider；`false` 时缺少 `ANTHROPIC_API_KEY` 必须返回配置错误，不能自动回退到演示结果。

- [ ] **Step 7: 运行测试和类型检查**

```bash
npm run test -- features/diagnosis/create-diagnosis.test.ts
npm run typecheck
```

Expected: PASS。

- [ ] **Step 8: 提交诊断领域层**

```bash
git add features/diagnosis features/application/application.schema.ts lib/env.ts .env.example
git commit -m "feat: add structured ai diagnosis providers"
```

## Task 7: 实现诊断 API 与诊断单页面

**Files:**
- Create: `app/api/diagnosis/route.ts`
- Create: `app/(public)/diagnosis/page.tsx`
- Create: `app/(public)/diagnosis/diagnosis-client.tsx`
- Create: `app/(public)/diagnosis/diagnosis.module.css`
- Create: `features/diagnosis/diagnosis-sheet.tsx`
- Modify: `tests/e2e/application.spec.ts`

- [ ] **Step 1: 扩展 E2E，要求诊断完成后可入驻工作室**

在 `tests/e2e/application.spec.ts` 最后增加：

```ts
await expect(page.getByRole("heading", { name: "选题诊断单" })).toBeVisible();
await expect(page.getByText(/七日完成概率/)).toBeVisible();
await page.getByRole("link", { name: "确认边界，入驻工作室" }).click();
await expect(page).toHaveURL(/studio\/day-1/);
```

- [ ] **Step 2: 运行确认失败**

```bash
npm run test:e2e -- tests/e2e/application.spec.ts --project=desktop-chromium
```

Expected: FAIL，诊断页不存在。

- [ ] **Step 3: 实现 API**

`app/api/diagnosis/route.ts`：

```ts
import { NextResponse } from "next/server";
import { applicationAnswersSchema } from "@/features/application/application.schema";
import { AnthropicDiagnosisProvider } from "@/features/diagnosis/anthropic-diagnosis-provider";
import { createDiagnosis } from "@/features/diagnosis/create-diagnosis";
import { DemoDiagnosisProvider } from "@/features/diagnosis/demo-diagnosis-provider";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const parsed = applicationAnswersSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ code: "INVALID_APPLICATION", issues: parsed.error.issues }, { status: 400 });
  if (env.APP_DEMO_MODE === "false" && !env.ANTHROPIC_API_KEY) return NextResponse.json({ code: "AI_NOT_CONFIGURED" }, { status: 503 });
  const provider = env.APP_DEMO_MODE === "true" ? new DemoDiagnosisProvider() : new AnthropicDiagnosisProvider();
  try { return NextResponse.json(await createDiagnosis(parsed.data, provider)); }
  catch (error) { console.error("diagnosis failed", error); return NextResponse.json({ code: "DIAGNOSIS_UNAVAILABLE" }, { status: 502 }); }
}
```

- [ ] **Step 4: 实现诊断单 UI**

`features/diagnosis/diagnosis-sheet.tsx` 必须呈现：

- 结果状态；
- 问题陈述；
- 目标用户；
- 核心场景；
- 七日完成概率；
- 三步核心流程；
- 唯一 AI 能力；
- 必须删除项；
- 第一位读者计划；
- AI 编辑便签；
- 演示模式标识；
- “确认边界，入驻工作室”链接。

组件接收 `diagnosis` 和 `isDemo`，不自行请求数据。

- [ ] **Step 5: 实现页面客户端状态**

`diagnosis-client.tsx` 从 sessionStorage 读取完整申请，POST `/api/diagnosis`，分别渲染：

- 正在校读；
- 成功诊断单；
- 申请缺失，返回 `/apply`；
- AI 未配置；
- AI 暂不可用，保留“重新校读”按钮。

禁止用无限 spinner；请求 20 秒后显示“校读时间比预期更长，但你的稿件已经保存”。

- [ ] **Step 6: 运行 E2E**

```bash
npm run test:e2e -- tests/e2e/application.spec.ts --project=desktop-chromium
```

Expected: PASS，演示模式完整流转到 `/studio/day-1`。

- [ ] **Step 7: 提交诊断体验**

```bash
git add app/api app/'(public)'/diagnosis features/diagnosis tests/e2e/application.spec.ts
git commit -m "feat: turn applications into editorial diagnoses"
```

## Task 8: 构建 Day 1 私人工作室

**Files:**
- Create: `features/studio/day-one-brief.ts`
- Create: `features/studio/studio-session.ts`
- Create: `features/studio/studio-session.test.ts`
- Create: `features/studio/boundary-editor.tsx`
- Create: `features/studio/margin-note.tsx`
- Create: `app/studio/day-1/page.tsx`
- Create: `styles/studio.module.css`
- Create: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: 写项目边界状态测试**

`features/studio/studio-session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { confirmBoundary, createStudioDraft } from "./studio-session";

describe("day one studio", () => {
  it("requires one audience, one outcome and at least one excluded feature", () => {
    const result = confirmBoundary(createStudioDraft());
    expect(result.ok).toBe(false);
  });
  it("confirms a focused project boundary", () => {
    const draft = { audience: "产品经理", outcome: "从访谈记录得到三条有依据的洞察", exclusions: ["登录", "团队协作"] };
    const result = confirmBoundary(draft);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm run test -- features/studio/studio-session.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现边界规则**

`features/studio/studio-session.ts`:

```ts
import { z } from "zod";
import { failure, success } from "@/lib/result";
const schema = z.object({ audience: z.string().trim().min(2), outcome: z.string().trim().min(8), exclusions: z.array(z.string().trim().min(2)).min(1) });
export type StudioDraft = z.infer<typeof schema>;
export function createStudioDraft(): StudioDraft { return { audience: "", outcome: "", exclusions: [] }; }
export function confirmBoundary(draft: StudioDraft) { const result = schema.safeParse(draft); return result.success ? success(result.data) : failure("请确认一个使用者、一个可观察结果，以及至少一项本期不做内容。"); }
```

- [ ] **Step 4: 实现对象级批注和边界编辑器**

`margin-note.tsx` 接收 `kind: "question" | "cut" | "risk" | "recognition"`、`anchorLabel` 和 children；在 DOM 中用 `aside aria-label="编辑搭档批注：..."`，不得仅靠颜色表达类型。

`boundary-editor.tsx` 提供三个编辑区：唯一使用者、七日结果、本期不做；确认后将状态写入 `sessionStorage("wei-ding-gao:studio:v1")` 并显示“边界已签署”。

- [ ] **Step 5: 实现工作室页面**

页面结构：

- 固定刊头和 Day 01/07；
- 左侧“今日排期”；
- 中央大稿件区；
- 右侧 AI 页边批注；
- 底部保存状态；
- 完成后项目夹出现压印动画；
- 移动端按“排期 → 稿件 → 批注”顺序纵向排列。

使用真实文案：

```ts
export const dayOneBrief = {
  title: "立题：你究竟在解决什么",
  duration: "约 60–90 分钟",
  outcome: "签署一份七日项目边界",
  steps: ["确定唯一使用者", "写出可观察结果", "主动删除本期不做内容"],
};
```

- [ ] **Step 6: 写并运行工作室 E2E**

`tests/e2e/studio.spec.ts` 从 `/studio/day-1` 填写三个字段，添加“登录”排除项，确认后断言“边界已签署”和“V0.0 / 选题页”可见。

```bash
npm run test -- features/studio/studio-session.test.ts
npm run test:e2e -- tests/e2e/studio.spec.ts --project=desktop-chromium
npm run test:e2e -- tests/e2e/studio.spec.ts --project=mobile-chromium
```

Expected: 全部 PASS。

- [ ] **Step 7: 提交工作室**

```bash
git add app/studio features/studio styles/studio.module.css tests/e2e/studio.spec.ts
git commit -m "feat: create day one living studio"
```

## Task 9: 构建第 001 期发行特刊

**Files:**
- Create: `features/publication/issue-001.ts`
- Create: `components/publication/work-spread.tsx`
- Create: `app/(public)/publication/001/page.tsx`
- Create: `styles/publication.module.css`
- Create: `public/publication/work-01.svg`
- Create: `public/publication/work-02.svg`
- Create: `tests/e2e/publication.spec.ts`

- [ ] **Step 1: 写特刊 E2E**

```ts
import { expect, test } from "@playwright/test";
test("issue 001 reads like a curated publication", async ({ page }) => {
  await page.goto("/publication/001");
  await expect(page.getByRole("heading", { name: "十二个问题，十二种回答" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "申请下一期驻留" })).toHaveAttribute("href", "/apply");
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm run test:e2e -- tests/e2e/publication.spec.ts --project=desktop-chromium
```

Expected: FAIL。

- [ ] **Step 3: 创建策展数据**

`features/publication/issue-001.ts`:

```ts
export const issue001 = {
  number: "001",
  title: "十二个问题，十二种回答",
  dek: "第 001 期驻留创作者把工作与生活中的真实混乱，编辑成可以被使用的数字作品。",
  works: [
    { slug: "interview-lens", number: "WORK 01", title: "访谈透镜", creator: "林述", problem: "让产品经理从访谈记录中看见有依据的共性。", decision: "删除团队协作，只保留上传、分析和证据回看。", image: "/publication/work-01.svg", href: "#interview-lens" },
    { slug: "brief-editor", number: "WORK 02", title: "简报裁纸刀", creator: "迟青", problem: "把过长活动需求裁成一页可执行简报。", decision: "不生成完整策划案，只指出矛盾、缺口和下一步。", image: "/publication/work-02.svg", href: "#brief-editor" },
  ],
} as const;
```

- [ ] **Step 4: 实现作品跨页**

`work-spread.tsx` 使用语义化 `<article id>`、作品图、编号、问题、编辑决定和“查看作品”链接；交替左右版式，但 DOM 顺序保持阅读顺序。

- [ ] **Step 5: 实现特刊页面**

页面包含封面、目录、两组作品跨页、编辑说明、下一期 CTA。CSS 允许局部 grid-breaking，但正文行宽限制在 42–68 个中文字符；移动端取消重叠而保留编号和节奏。

- [ ] **Step 6: 运行特刊测试**

```bash
npm run test:e2e -- tests/e2e/publication.spec.ts --project=desktop-chromium
npm run test:e2e -- tests/e2e/publication.spec.ts --project=mobile-chromium
```

Expected: PASS。

- [ ] **Step 7: 提交特刊**

```bash
git add app/'(public)'/publication components/publication features/publication public/publication styles/publication.module.css tests/e2e/publication.spec.ts
git commit -m "feat: publish curated issue 001 experience"
```

## Task 10: 补齐无障碍、异常状态和视觉回归

**Files:**
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/visual.spec.ts`
- Modify: `app/(public)/diagnosis/diagnosis-client.tsx`
- Modify: `app/globals.css`
- Modify: all page CSS modules found by tests

- [ ] **Step 1: 写 axe 与键盘测试**

`tests/e2e/accessibility.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of ["/", "/apply", "/studio/day-1", "/publication/001"]) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  });
}

test("application is usable by keyboard", async ({ page }) => {
  await page.goto("/apply");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("你的回答")).toBeFocused();
});
```

- [ ] **Step 2: 写视觉基线测试**

`tests/e2e/visual.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

for (const [name, path] of [["home", "/"], ["apply", "/apply"], ["studio-day-1", "/studio/day-1"], ["issue-001", "/publication/001"]] as const) {
  test(`${name} visual baseline`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: "disabled" });
  });
}
```

- [ ] **Step 3: 运行测试并逐项修复**

```bash
npm run test:e2e -- tests/e2e/accessibility.spec.ts --project=desktop-chromium
npm run test:visual -- --project=desktop-chromium --update-snapshots
npm run test:visual -- --project=mobile-chromium --update-snapshots
```

Expected: axe 无 serious/critical；生成 8 张基线截图。

- [ ] **Step 4: 人工作品级审阅**

用真实浏览器逐页检查：

- 1440×900；
- 1024×768；
- 390×844；
- `prefers-reduced-motion: reduce`；
- 200% 浏览器缩放；
- 键盘 Tab 顺序；
- 网络 Fast 3G；
- `/api/diagnosis` 返回 502 时诊断页可重试且申请不丢失。

发现问题时先补失败测试或截图，再修改 CSS/组件。不得只凭静态代码判断视觉完成。

- [ ] **Step 5: 运行完整检查**

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Expected: 全部退出码 0。

- [ ] **Step 6: 提交无障碍和视觉基线**

```bash
git add app components features styles tests
git commit -m "test: lock accessibility and visual quality"
```

## Task 11: 文档、运行说明和阶段验收

**Files:**
- Modify: `README.md`
- Create: `docs/architecture/phase-1-boundaries.md`
- Create: `docs/verification/phase-1-browser-check.md`

- [ ] **Step 1: 写 README**

README 必须包含：

```markdown
# 未定稿

面向非技术创作者的 AI 产品驻留计划。

## 本地运行

1. `npm install`
2. `Copy-Item .env.example .env.local`
3. 演示模式保持 `APP_DEMO_MODE=true`
4. `npm run dev`
5. 打开 `http://localhost:3000`

## 真实 AI 诊断

在 `.env.local` 设置：

- `APP_DEMO_MODE=false`
- `ANTHROPIC_API_KEY=...`
- `ANTHROPIC_DIAGNOSIS_MODEL=claude-opus-4-8`

## 验证

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run build`
```

- [ ] **Step 2: 记录阶段边界**

`docs/architecture/phase-1-boundaries.md` 明确说明 sessionStorage 仅用于首个纵向切片；第二阶段会以 repository 接口替换，不允许业务组件直接访问数据库；真实支付、账户和多人协作不属于本阶段。

- [ ] **Step 3: 记录真实浏览器证据**

`docs/verification/phase-1-browser-check.md` 记录测试日期、浏览器、视口、完成路径、截图文件名、发现和修复的问题。只记录实际观察结果，不提前填写成功结论。

- [ ] **Step 4: 运行最终验证**

```bash
npm run check
npm run test:e2e
```

Expected: 全部 PASS。

- [ ] **Step 5: 提交文档**

```bash
git add README.md docs/architecture docs/verification
git commit -m "docs: document phase one runtime and boundaries"
```

## Task 12: 远程推送前检查

**Files:**
- No code files

- [ ] **Step 1: 确认工作区状态和提交历史**

```bash
git status --short
git log --oneline --decorate -12
```

Expected: 工作区为空；历史包含本计划要求的原子提交。

- [ ] **Step 2: 确认远程实际目标**

```bash
git remote -v
git ls-remote origin
```

Expected: `origin` 指向用户最终确认的 Gitea 仓库。若请求 URL 重定向到不同仓库名，必须先由用户确认目标，不能静默推送。

- [ ] **Step 3: 推送 main**

```bash
git push -u origin main
```

Expected: 推送成功，Gitea 显示所有提交；若远程已有历史，停止并检查，不使用 force push。

## 2. 后续独立计划的触发条件

完成本计划并满足以下条件后，开始 Accounts & Persistence 计划：

- 首页、访谈、诊断、Day 1 和特刊在真实浏览器通过；
- 视觉方向经用户确认；
- AI 结构化诊断在演示模式和真实 API 模式各验证一次；
- sessionStorage 状态模型稳定；
- 用户确认首个纵向切片的交互节奏；
- 不存在 serious/critical axe 问题；
- 桌面和移动视觉基线已建立。

下一份计划将引入 PostgreSQL、账户、权限、项目版本和对象存储，但不会同时引入支付或小班协作。
