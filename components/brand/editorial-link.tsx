import type { LinkProps } from "next/link";
import Link from "next/link";
import type { PropsWithChildren } from "react";

import styles from "@/styles/editorial.module.css";

export function EditorialLink({ children, ...props }: PropsWithChildren<LinkProps>) {
  return (
    <Link {...props} className={styles.editorialLink}>
      <span>{children}</span>
      <span aria-hidden="true">↗</span>
    </Link>
  );
}
