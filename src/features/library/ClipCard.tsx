import { useState, type CSSProperties } from "react";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  FileText,
  Folder,
  Link2,
  Star,
  Trash2,
} from "lucide-react";
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
  onFavorite,
  onDelete,
  busy,
  collapseLongClips,
  previewLines,
}: {
  item: ClipItem;
  onCopy: (item: ClipItem) => void;
  onFavorite: (item: ClipItem) => void;
  onDelete: (item: ClipItem) => void;
  busy: boolean;
  collapseLongClips: boolean;
  previewLines: 4 | 6 | 8;
}) {
  const KindIcon = kindIcon[item.kind];
  const [expanded, setExpanded] = useState(false);
  const collapsible = collapseLongClips && shouldCollapse(item.preview, previewLines);

  return (
    <motion.article className="clip-card" data-kind={item.kind} layout whileHover={{ y: -2 }}>
      <div className="clip-card__meta">
        <KindIcon aria-hidden="true" />
        <span>{item.source}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={new Date(item.capturedAt * 1000).toISOString()}>
          {formatRelativeTime(item.capturedAt)}
        </time>
      </div>
      <h3>{item.title}</h3>
      <pre
        className="clip-card__preview"
        data-collapsed={collapsible && !expanded ? "true" : undefined}
        style={{ "--clip-preview-lines": previewLines } as CSSProperties}
      >
        {item.preview}
      </pre>
      {collapsible && (
        <button
          className="clip-card__preview-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          {expanded ? "收起全文" : "展开全文"}
        </button>
      )}
      <div className="clip-card__actions">
        <span>使用 {item.useCount} 次</span>
        <IconButton
          label={item.favorite ? `取消收藏：${item.title}` : `收藏：${item.title}`}
          onClick={() => onFavorite(item)}
          disabled={busy}
          aria-pressed={item.favorite}
        >
          <Star aria-hidden="true" fill={item.favorite ? "currentColor" : "none"} />
        </IconButton>
        <IconButton
          label={`复制：${item.title}`}
          onClick={() => onCopy(item)}
          disabled={busy}
        >
          <Copy aria-hidden="true" />
        </IconButton>
        <IconButton
          label={`删除：${item.title}`}
          onClick={() => onDelete(item)}
          disabled={busy}
        >
          <Trash2 aria-hidden="true" />
        </IconButton>
      </div>
    </motion.article>
  );
}

function shouldCollapse(preview: string, previewLines: number) {
  return preview.length > 180 || preview.split(/\r?\n/).length > previewLines;
}

function formatRelativeTime(timestamp: number) {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (elapsed < 60) return "刚刚";
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)} 分钟前`;
  if (elapsed < 86400) return `${Math.floor(elapsed / 3600)} 小时前`;
  if (elapsed < 604800) return `${Math.floor(elapsed / 86400)} 天前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(
    new Date(timestamp * 1000),
  );
}
