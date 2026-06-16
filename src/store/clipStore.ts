import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ClipItem, Snippet, SearchOptions } from "../types";
import { looksLikeCode } from "../lib/detectCode";

// Client-side filtering: type/pinned/tag filters applied locally so DB always returns all clips
function applyFilters(
  clips: ClipItem[],
  selectedType: string,
  pinnedOnly: boolean,
  selectedTag: string
): ClipItem[] {
  return clips.filter((c) => {
    const effectiveType =
      c.clip_type === "text" && looksLikeCode(c.content) ? "code" : c.clip_type;
    if (selectedType && effectiveType !== selectedType) return false;
    if (pinnedOnly && !c.is_pinned) return false;
    if (selectedTag && !c.tags.includes(selectedTag)) return false;
    return true;
  });
}

interface ClipStore {
  clips: ClipItem[];         // All clips from DB (text-search filtered only)
  visibleClips: ClipItem[];  // clips after applying type/pinned/tag filters (client-side)
  snippets: Snippet[];
  searchQuery: string;
  selectedType: string;
  selectedTag: string;
  pinnedOnly: boolean;
  selectedIndex: number;
  isDark: boolean;
  isSnippetPanelOpen: boolean;
  sensitiveMode: string;
  isSettingsPanelOpen: boolean;

  loadClips: () => Promise<void>;
  loadSnippets: () => Promise<void>;
  loadSettings: () => Promise<void>;
  deleteClip: (id: number) => Promise<void>;
  togglePin: (id: number) => Promise<void>;
  toggleSensitive: (id: number) => Promise<boolean>;
  updateTags: (id: number, tags: string[]) => Promise<void>;
  copyClip: (clip: ClipItem) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setSelectedType: (t: string) => void;
  setSelectedTag: (t: string) => void;
  setPinnedOnly: (v: boolean) => void;
  setSelectedIndex: (i: number) => void;
  resetFilters: () => void;
  toggleDark: () => void;
  toggleSnippetPanel: () => void;
  setSensitiveMode: (mode: string) => Promise<void>;
  toggleSettingsPanel: () => void;

  upsertSnippet: (trigger: string, content: string, description?: string) => Promise<void>;
  deleteSnippet: (id: number) => Promise<void>;
  pasteSnippet: (trigger: string) => Promise<boolean>;
}

export const useClipStore = create<ClipStore>((set, get) => ({
  clips: [],
  visibleClips: [],
  snippets: [],
  searchQuery: "",
  selectedType: "",
  selectedTag: "",
  pinnedOnly: false,
  selectedIndex: 0,
  isDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
  isSnippetPanelOpen: false,
  sensitiveMode: "masked",
  isSettingsPanelOpen: false,

  // Always fetch without type/pinned/tag filters — those are applied client-side
  // so that no clip is ever hidden by a server-side filter mismatch.
  // IMPORTANT: applyFilters is called inside the set() callback, not before it.
  // This avoids a race condition where the user changes filters during the await,
  // which would cause loadClips to overwrite visibleClips with a stale filter snapshot.
  loadClips: async () => {
    const searchQuery = get().searchQuery;
    const opts: SearchOptions = {
      query: searchQuery || undefined,
      limit: 10000,
      pinned_only: false, // never filter pinned server-side
    };
    const clips = await invoke<ClipItem[]>("get_clips", { opts });
    set((s) => {
      const visibleClips = applyFilters(clips, s.selectedType, s.pinnedOnly, s.selectedTag);
      return {
        clips,
        visibleClips,
        selectedIndex: Math.min(s.selectedIndex, Math.max(0, visibleClips.length - 1)),
      };
    });
  },

  loadSnippets: async () => {
    const snippets = await invoke<Snippet[]>("get_snippets");
    set({ snippets });
  },

  loadSettings: async () => {
    const raw = await invoke<string | null>("get_setting", { key: "sensitive_mode" });
    set({ sensitiveMode: raw ?? "masked" });
  },

  deleteClip: async (id) => {
    await invoke("delete_clip", { id });
    set((s) => {
      const clips = s.clips.filter((c) => c.id !== id);
      const visibleClips = applyFilters(clips, s.selectedType, s.pinnedOnly, s.selectedTag);
      return { clips, visibleClips };
    });
  },

  togglePin: async (id) => {
    const pinned = await invoke<boolean>("toggle_pin", { id });
    set((s) => {
      const clips = s.clips
        .map((c) => (c.id === id ? { ...c, is_pinned: pinned } : c))
        .sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return Number(b.is_pinned) - Number(a.is_pinned);
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      const visibleClips = applyFilters(clips, s.selectedType, s.pinnedOnly, s.selectedTag);
      return { clips, visibleClips };
    });
  },

  toggleSensitive: async (id) => {
    const sensitive = await invoke<boolean>("toggle_sensitive", { id });
    set((s) => {
      const clips = s.clips.map((c) => (c.id === id ? { ...c, is_sensitive: sensitive } : c));
      const visibleClips = applyFilters(clips, s.selectedType, s.pinnedOnly, s.selectedTag);
      return { clips, visibleClips };
    });
    return sensitive;
  },

  updateTags: async (id, tags) => {
    await invoke("update_tags", { id, tags });
    set((s) => {
      const clips = s.clips.map((c) => (c.id === id ? { ...c, tags } : c));
      const visibleClips = applyFilters(clips, s.selectedType, s.pinnedOnly, s.selectedTag);
      return { clips, visibleClips };
    });
  },

  copyClip: async (clip) => {
    if (clip.clip_type === "image") return;
    await invoke("write_to_clipboard", { text: clip.content });
  },

  // Text search hits the server; snippet mode (starts with /) skips server search
  setSearchQuery: (q) => {
    set({ searchQuery: q });
    if (!q.startsWith("/")) {
      get().loadClips();
    }
  },

  setSelectedType: (t) => {
    // Selecting a type clears pinnedOnly — they are mutually exclusive filters
    set((s) => {
      const visibleClips = applyFilters(s.clips, t, false, s.selectedTag);
      return { selectedType: t, pinnedOnly: false, selectedIndex: 0, visibleClips };
    });
  },

  setSelectedTag: (t) => {
    set((s) => {
      const visibleClips = applyFilters(s.clips, s.selectedType, s.pinnedOnly, t);
      return { selectedTag: t, selectedIndex: 0, visibleClips };
    });
  },

  setPinnedOnly: (v) => {
    // Activating Pinned clears selectedType — they are mutually exclusive filters
    set((s) => {
      const selectedType = v ? "" : s.selectedType;
      const visibleClips = applyFilters(s.clips, selectedType, v, s.selectedTag);
      return { pinnedOnly: v, selectedType, selectedIndex: 0, visibleClips };
    });
  },

  setSelectedIndex: (i) => set({ selectedIndex: i }),

  // Atomically reset all sidebar filters so "All" truly means "show everything"
  resetFilters: () => {
    set((s) => {
      const visibleClips = applyFilters(s.clips, "", false, "");
      return { selectedType: "", pinnedOnly: false, selectedTag: "", selectedIndex: 0, visibleClips };
    });
  },

  toggleDark: () => {
    set((s) => {
      const isDark = !s.isDark;
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return { isDark };
    });
  },

  toggleSnippetPanel: () =>
    set((s) => ({ isSnippetPanelOpen: !s.isSnippetPanelOpen })),

  setSensitiveMode: async (mode) => {
    await invoke("set_setting", { key: "sensitive_mode", value: mode });
    set({ sensitiveMode: mode });
  },

  toggleSettingsPanel: () =>
    set((s) => ({ isSettingsPanelOpen: !s.isSettingsPanelOpen })),

  upsertSnippet: async (trigger, content, description) => {
    await invoke("upsert_snippet", { trigger, content, description });
    await get().loadSnippets();
  },

  deleteSnippet: async (id) => {
    await invoke("delete_snippet", { id });
    set((s) => ({ snippets: s.snippets.filter((sn) => sn.id !== id) }));
  },

  pasteSnippet: async (trigger) => {
    const snip = get().snippets.find((s) => s.trigger === trigger);
    if (!snip) return false;
    await invoke("write_to_clipboard", { text: snip.content });
    return true;
  },
}));
