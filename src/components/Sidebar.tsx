import { FileText, Link, Code2, Image, Pin, Hash } from "lucide-react";
import clsx from "clsx";
import { useClipStore } from "../store/clipStore";

const TYPES = [
  { label: "All", value: "", icon: null },
  { label: "Text", value: "text", icon: FileText },
  { label: "URLs", value: "url", icon: Link },
  { label: "Code", value: "code", icon: Code2 },
  { label: "Images", value: "image", icon: Image },
];

export function Sidebar() {
  const { clips, selectedType, setSelectedType, selectedTag, setSelectedTag, pinnedOnly, setPinnedOnly, resetFilters } =
    useClipStore();

  // Collect unique tags from clips
  const allTags = Array.from(new Set(clips.flatMap((c) => c.tags))).sort();

  const btn = (active: boolean) =>
    clsx(
      "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs w-full text-left transition-colors",
      active
        ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium"
        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
    );

  return (
    <aside className="w-36 flex-shrink-0 border-r border-neutral-200 dark:border-neutral-700 p-2 flex flex-col gap-3 overflow-y-auto">
      {/* Type filter */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1 px-2">
          Type
        </p>
        {TYPES.map(({ label, value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => value === "" ? resetFilters() : setSelectedType(value)}
            className={btn(selectedType === value && !pinnedOnly && !selectedTag)}
          >
            {Icon && <Icon size={12} />}
            {!Icon && <span className="w-3" />}
            {label}
          </button>
        ))}
      </div>

      {/* Pinned */}
      <div>
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1 px-2">
          Filter
        </p>
        <button
          onClick={() => setPinnedOnly(!pinnedOnly)}
          className={btn(pinnedOnly)}
        >
          <Pin size={12} />
          Pinned
        </button>
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1 px-2">
            Tags
          </p>
          <button
            onClick={() => setSelectedTag("")}
            className={btn(selectedTag === "")}
          >
            <Hash size={12} />
            All tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? "" : tag)}
              className={btn(selectedTag === tag)}
            >
              <Hash size={12} />
              {tag}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
