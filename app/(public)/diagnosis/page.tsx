import type { Metadata } from "next";

import { Masthead } from "@/components/brand/masthead";

import { DiagnosisClient } from "./diagnosis-client";

export const metadata: Metadata = {
  title: "选题诊断",
  description: "把七页选题访谈整理成七日作品边界。",
};

export default function DiagnosisPage() {
  return (
    <main>
      <Masthead issue="DIAGNOSIS / 001" />
      <DiagnosisClient />
    </main>
  );
}
