import { useState } from "react";
import { Pin, Trash2, Copy, Check, Tag, Code2, Link, FileText, Image } from "lucide-react";
import clsx from "clsx";
import { useClipStore } from "../store/clipStore";
import { CodeBlock } from "./CodeBlock";
import { OGPPreview } from "./OGPPreview";
import { looksLikeCode } from "../lib/detectCode";
import type { ClipItem } from "../types";

interface Props {
  clip: ClipItem;
  isSelected: boolean;
  onClick: () => void;
}

const TYPE_ICONS = {
  text: FileText,
  url: Link,
  code: Code2,
  image: Image,
} as const;

const TYPE_COLORS = {
  text: "text-neutral-400",
  url: "text-blue-500",
  code: "text-emerald-500",
  image: "text-pink-500",
} as const;

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function ClipCard({ clip, isSelected, onClick }: Props) {
  const { deleteClip, togglePin, copyClip, updateTags } = useClipStore();
  const [copied, setCopied] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  // DBに "text" で保存済みでもフロントエンドで再検出してコードとして表示する
  const effectiveType =
    clip.clip_type === "text" && looksLikeCode(clip.content) ? "code" : clip.clip_type;

  const Icon = TYPE_ICONS[effectiveType as keyof typeof TYPE_ICONS] ?? FileText;
  const iconColor = TYPE_COLORS[effectiveType as keyof typeof TYPE_COLORS] ?? TYPE_COLORS.text;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyClip(clip);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteClip(clip.id);
  };

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await togglePin(clip.id);
  };

  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      const newTag = tagInput.trim().toLowerCase();
      if (!clip.tags.includes(newTag)) {
        await updateTags(clip.id, [...clip.tags, newTag]);
      }
      setTagInput("");
      setShowTagInput(false);
    }
    if (e.key === "Escape") {
      setTagInput("");
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = async (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    await updateTags(clip.id, clip.tags.filter((t) => t !== tag));
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        "group relative rounded-xl border p-3 cursor-pointer transition-all duration-150",
        "hover:shadow-md dark:hover:shadow-black/30",
        isSelected
          ? "border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-sm"
          : "border-neutral-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-800/60 hover:border-neutral-300 dark:hover:border-neutral-600"
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 mb-2">
        <Icon size={13} className={clsx("mt-0.5 flex-shrink-0", iconColor)} />

        {/* Content preview */}
        <div className="flex-1 min-w-0">
          {effectiveType === "image" && clip.image_data ? (
            <img
              src={clip.image_data}
              alt="Captured"
              className="max-h-32 rounded object-cover"
            />
          ) : effectiveType === "code" ? (
            <CodeBlock code={clip.content} />
          ) : effectiveType === "url" ? (
            <OGPPreview clip={clip} />
          ) : (
            <p className="text-sm text-neutral-800 dark:text-neutral-200 line-clamp-4 break-words leading-relaxed">
              {clip.content}
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      {(clip.tags.length > 0 || showTagInput) && (
        <div className="flex flex-wrap gap-1 mt-2 mb-1">
          {clip.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px]
                bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
            >
              #{tag}
              <button
                onClick={(e) => handleRemoveTag(e, tag)}
                className="hover:text-red-500 ml-0.5 leading-none"
              >
                ×
              </button>
            </span>
          ))}
          {showTagInput && (
            <input
              autoFocus
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              onClick={(e) => e.stopPropagation()}
              placeholder="tag name…"
              className="text-[10px] px-1.5 py-0.5 rounded-full border border-violet-300 dark:border-violet-600
                bg-transparent outline-none text-violet-700 dark:text-violet-300 w-20"
            />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center mt-2">
        <span className="text-[10px] text-neutral-400">{formatTime(clip.created_at)}</span>
        {clip.source_app && (
          <span className="text-[10px] text-neutral-300 dark:text-neutral-600 ml-1.5 truncate max-w-[80px]">
            · {clip.source_app.replace(/\.(exe|app)$/i, "")}
          </span>
        )}

        {/* Action buttons (shown on hover / selected) */}
        <div
          className={clsx(
            "ml-auto flex items-center gap-0.5 transition-opacity",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowTagInput((v) => !v); }}
            title="Add tag"
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-violet-500 transition-colors"
          >
            <Tag size={12} />
          </button>

          <button
            onClick={handlePin}
            title={clip.is_pinned ? "Unpin" : "Pin"}
            className={clsx(
              "p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors",
              clip.is_pinned
                ? "text-amber-500"
                : "text-neutral-400 hover:text-amber-500"
            )}
          >
            <Pin size={12} />
          </button>

          <button
            onClick={handleDelete}
            title="Delete"
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={12} />
          </button>

          <button
            onClick={handleCopy}
            title="Copy"
            className={clsx(
              "p-1.5 rounded-lg transition-colors",
              copied
                ? "text-emerald-500"
                : "text-neutral-400 hover:text-violet-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            )}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}
