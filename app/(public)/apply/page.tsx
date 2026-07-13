import type { Metadata } from "next";

import { Masthead } from "@/components/brand/masthead";
import { ApplicationInterview } from "@/features/application/application-interview";

import styles from "./apply.module.css";

export const metadata: Metadata = {
  title: "提交选题",
  description: "用七个问题整理你的真实问题、目标读者和七日作品边界。",
};

export default function ApplyPage() {
  return (
    <main className={styles.page}>
      <Masthead issue="APPLICATION / 001" />
      <header className={styles.intro}>
        <p>OPEN CALL / 第 001 期</p>
        <div>
          <h1>先别写功能清单。<br />从一个真实时刻开始。</h1>
          <p>七个问题，一次只回答一页。内容会保存在当前浏览器会话里，刷新后仍可继续。</p>
        </div>
      </header>
      <ApplicationInterview />
    </main>
  );
}
