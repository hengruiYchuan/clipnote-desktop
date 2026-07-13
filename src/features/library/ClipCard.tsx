import { Code2, Copy, FileText, Folder, Link2, Star } from "lucide-react";
import { motion } from "motion/react";
import { IconButton } from "../../components/IconButton";
import type { ClipItem } from "../../types/content";

const kindIcon = {
  code: Code2,
  link: Link2,
  text: FileText,
  path: Folder,
};

export function ClipCard({
  item,
  onCopy,
}: {
  item: ClipItem;
  onCopy: (item: ClipItem) => void;
}) {
  const KindIcon = kindIcon[item.kind];

  return (
    <motion.article className="clip-card" data-kind={item.kind} layout whileHover={{ y: -2 }}>
      <div className="clip-card__meta">
        <KindIcon aria-hidden="true" />
        <span>{item.source}</span>
        <span aria-hidden="true">·</span>
        <time>{item.capturedAt}</time>
      </div>
      <h3>{item.title}</h3>
      <pre>{item.preview}</pre>
      <div className="clip-card__actions">
        {item.favorite && <Star aria-label="已收藏" fill="currentColor" />}
        <span>使用 {item.useCount} 次</span>
        <IconButton label={`复制：${item.title}`} onClick={() => onCopy(item)}>
          <Copy aria-hidden="true" />
        </IconButton>
      </div>
    </motion.article>
  );
}
