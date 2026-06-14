import { useRef, useEffect, useState } from "react";
import { Search, X, Moon, Sun, Scissors } from "lucide-react";
import { useClipStore } from "../store/clipStore";
import type { Snippet } from "../types";

export function SearchBar() {
  const {
    searchQuery,
    setSearchQuery,
    isDark,
    toggleDark,
    toggleSnippetPanel,
    snippets,
    pasteSnippet,
  } = useClipStore();

  const ref = useRef<HTMLInputElement>(null);
  const [snippetIndex, setSnippetIndex] = useState(0);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Snippet mode: input starts with "/"
  const isSnippetMode = searchQuery.startsWith("/");
  const snippetQuery = isSnippetMode ? searchQuery.slice(1).toLowerCase() : "";
  const matchingSnippets: Snippet[] = isSnippetMode
    ? snippets.filter(
        (s) => !snippetQuery || s.trigger.toLowerCase().startsWith(snippetQuery)
      )
    : [];

  // Reset selection index whenever the filtered list changes
  useEffect(() => {
    setSnippetIndex(0);
  }, [snippetQuery]);

  const safeIndex = Math.min(snippetIndex, Math.max(0, matchingSnippets.length - 1));

  const selectSnippet = async (sn: Snippet) => {
    await pasteSnippet(sn.trigger);
    setSearchQuery("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (isSnippetMode) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSnippetIndex((i) => Math.min(i + 1, matchingSnippets.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSnippetIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const sn = matchingSnippets[safeIndex];
        if (sn) selectSnippet(sn);
        return;
      }
      if (e.key === "Escape") {
        // Clear snippet search without hiding window.
        // The global useKeyboard handler checks searchQuery.startsWith("/")
        // and returns early, so the window won't be hidden this tick.
        setSearchQuery("");
        return;
      }
    } else {
      // Normal mode: prevent cursor movement in input so global nav works
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        e.preventDefault();
      }
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 sticky top-0 z-10">
      <div className="relative flex-1">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          ref={ref}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search clips… (/ for snippets)"
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg
            bg-neutral-100 dark:bg-neutral-800
            text-neutral-900 dark:text-neutral-100
            placeholder-neutral-400 dark:placeholder-neutral-500
            border border-transparent focus:border-violet-500
            outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <X size={14} />
          </button>
        )}

        {/* Snippet suggestion dropdown */}
        {isSnippetMode && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl z-50 overflow-hidden">
            {matchingSnippets.length === 0 ? (
              <p className="text-xs text-neutral-400 px-3 py-2.5">
                {snippets.length === 0
                  ? "No snippets yet. Click ✂ to create one."
                  : "No snippets match."}
              </p>
            ) : (
              <ul className="max-h-60 overflow-y-auto">
                {matchingSnippets.map((sn, i) => (
                  <li key={sn.id}>
                    <button
                      onMouseDown={(e) => e.preventDefault()} // keep input focused
                      onClick={() => selectSnippet(sn)}
                      className={`w-full text-left px-3 py-2 transition-colors ${
                        i === safeIndex
                          ? "bg-violet-100 dark:bg-violet-900/40"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <code className="text-xs font-mono text-violet-600 dark:text-violet-400">
                          /{sn.trigger}
                        </code>
                        {sn.description && (
                          <span className="text-[11px] text-neutral-400 truncate">
                            {sn.description}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {sn.content}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <button
        onClick={toggleSnippetPanel}
        title="Snippets"
        className="p-2 rounded-lg text-neutral-500 hover:text-violet-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <Scissors size={16} />
      </button>

      <button
        onClick={toggleDark}
        title="Toggle theme"
        className="p-2 rounded-lg text-neutral-500 hover:text-violet-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
