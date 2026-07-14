import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Masthead } from "@/components/brand/masthead";
import { journeyDayMeta } from "@/features/studio/journey-content";
import { JourneyStudio } from "@/features/studio/journey-studio";
import type { JourneyDay } from "@/features/studio/journey-session";
import styles from "@/styles/studio.module.css";

type PageProps = { params: Promise<{ day: string }> };

function parseJourneyDay(value: string): JourneyDay | null {
  const match = /^day-([2-7])$/.exec(value);
  return match ? (Number(match[1]) as JourneyDay) : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const day = parseJourneyDay((await params).day);
  if (!day) return {};

  const meta = journeyDayMeta[day];
  return {
    title: `Day ${day} ${meta.label}`,
    description: meta.introduction,
  };
}

export default async function JourneyDayPage({ params }: PageProps) {
  const day = parseJourneyDay((await params).day);
  if (!day) notFound();

  return (
    <main className={styles.page}>
      <Masthead issue={`第 ${day} 天 / 共 7 天`} />
      <JourneyStudio day={day} />
    </main>
  );
}
