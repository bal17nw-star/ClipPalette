import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useClipStore } from "../store/clipStore";

export function useKeyboard(onCopy: () => void, onDelete: () => void) {
  const { visibleClips, selectedIndex, setSelectedIndex, searchQuery } = useClipStore();

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // In snippet mode (search starts with /) the SearchBar handles all key events.
      // Return early so clip navigation doesn't interfere.
      if (searchQuery.startsWith("/")) return;

      if (e.key === "Escape") {
        await getCurrentWindow().hide();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, visibleClips.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onCopy();
        return;
      }
      if (e.key === "Delete" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onDelete();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visibleClips.length, selectedIndex, onCopy, onDelete, setSelectedIndex, searchQuery]);
}
