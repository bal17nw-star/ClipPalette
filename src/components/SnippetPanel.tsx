import { useState } from "react";
import { Plus, Trash2, Copy, Check, X } from "lucide-react";
import clsx from "clsx";
import { useClipStore } from "../store/clipStore";

export function SnippetPanel() {
  const { snippets, upsertSnippet, deleteSnippet, pasteSnippet, toggleSnippetPanel } =
    useClipStore();

  const [showNew, setShowNew] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  const handleSave = async () => {
    if (!trigger || !content) return;
    await upsertSnippet(trigger.replace(/^\//, ""), content, description || undefined);
    setTrigger("");
    setContent("");
    setDescription("");
    setShowNew(false);
  };

  const handlePaste = async (snippet: (typeof snippets)[0]) => {
    await pasteSnippet(snippet.trigger);
    setCopied(snippet.id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Snippets</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNew((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-600 transition-colors"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={toggleSnippetPanel}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* New snippet form */}
      {showNew && (
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 space-y-2">
          <input
            type="text"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="/trigger (e.g. email)"
            className="w-full px-3 py-1.5 text-xs rounded-lg
              bg-neutral-100 dark:bg-neutral-800
              text-neutral-900 dark:text-neutral-100
              border border-neutral-200 dark:border-neutral-700
              outline-none focus:border-violet-500"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Snippet content…"
            rows={3}
            className="w-full px-3 py-1.5 text-xs rounded-lg
              bg-neutral-100 dark:bg-neutral-800
              text-neutral-900 dark:text-neutral-100
              border border-neutral-200 dark:border-neutral-700
              outline-none focus:border-violet-500 resize-none"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-1.5 text-xs rounded-lg
              bg-neutral-100 dark:bg-neutral-800
              text-neutral-900 dark:text-neutral-100
              border border-neutral-200 dark:border-neutral-700
              outline-none focus:border-violet-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!trigger || !content}
              className="flex-1 py-1.5 text-xs rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {snippets.length === 0 && (
          <p className="text-xs text-neutral-400 text-center mt-8 px-4">
            No snippets yet. Create one with the + button above.
          </p>
        )}
        {snippets.map((sn) => (
          <div
            key={sn.id}
            className="group rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5 hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <code className="text-[11px] font-mono text-violet-600 dark:text-violet-400">
                  /{sn.trigger}
                </code>
                {sn.description && (
                  <p className="text-[10px] text-neutral-400 mt-0.5">{sn.description}</p>
                )}
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 line-clamp-2 break-words">
                  {sn.content}
                </p>
              </div>
              <div className={clsx(
                "flex gap-0.5 flex-shrink-0 transition-opacity",
                "opacity-0 group-hover:opacity-100"
              )}>
                <button
                  onClick={() => handlePaste(sn)}
                  title="Copy to clipboard"
                  className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-violet-500 transition-colors"
                >
                  {copied === sn.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
                <button
                  onClick={() => deleteSnippet(sn.id)}
                  title="Delete"
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
