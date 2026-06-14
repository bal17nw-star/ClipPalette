import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useClipStore } from "./store/clipStore";
import { useKeyboard } from "./hooks/useKeyboard";
import { SearchBar } from "./components/SearchBar";
import { Sidebar } from "./components/Sidebar";
import { ClipGrid } from "./components/ClipGrid";
import { SnippetPanel } from "./components/SnippetPanel";

export default function App() {
  const {
    visibleClips,
    selectedIndex,
    isDark,
    isSnippetPanelOpen,
    loadClips,
    loadSnippets,
    copyClip,
    deleteClip,
  } = useClipStore();

  useEffect(() => {
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDark]);

  // Initial data load
  useEffect(() => {
    loadClips();
    loadSnippets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload all clips whenever a new one arrives from the Rust backend
  useEffect(() => {
    const unlisten = listen("clip:new", () => {
      loadClips();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload all clips when the window gains focus (e.g. Alt+V to show window)
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) loadClips();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = useCallback(() => {
    const clip = visibleClips[selectedIndex];
    if (clip) copyClip(clip);
  }, [visibleClips, selectedIndex, copyClip]);

  const handleDelete = useCallback(() => {
    const clip = visibleClips[selectedIndex];
    if (clip) deleteClip(clip.id);
  }, [visibleClips, selectedIndex, deleteClip]);

  useKeyboard(handleCopy, handleDelete);

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 select-none overflow-hidden">
      <SearchBar />

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        <main className="flex-1 flex flex-col min-w-0">
          <ClipGrid />
        </main>

        {isSnippetPanelOpen && (
          <div className="w-64 flex-shrink-0">
            <SnippetPanel />
          </div>
        )}
      </div>
    </div>
  );
}
