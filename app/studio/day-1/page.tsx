import type { Metadata } from "next";

import { Masthead } from "@/components/brand/masthead";
import { BoundaryEditor } from "@/features/studio/boundary-editor";
import styles from "@/styles/studio.module.css";

export const metadata: Metadata = {
  title: "Day 1 私人工作室",
  description: "确认唯一使用者、七日结果和本期不做，签署第一版项目边界。",
};

export default function DayOneStudioPage() {
  return (
    <main className={styles.page}>
      <Masthead issue="第 1 天 / 共 7 天" />
      <BoundaryEditor />
    </main>
  );
}
