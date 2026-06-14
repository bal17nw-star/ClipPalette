import { useEffect, useRef } from "react";
import { ClipboardList } from "lucide-react";
import { useClipStore } from "../store/clipStore";
import { ClipCard } from "./ClipCard";

export function ClipGrid() {
  const { visibleClips, selectedIndex, setSelectedIndex } = useClipStore();
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  if (visibleClips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-neutral-400">
        <ClipboardList size={40} className="opacity-30" />
        <p className="text-sm">No clips yet. Copy something!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      {visibleClips.map((clip, i) => (
        <div key={clip.id} ref={i === selectedIndex ? selectedRef : undefined}>
          <ClipCard
            clip={clip}
            isSelected={i === selectedIndex}
            onClick={() => setSelectedIndex(i)}
          />
        </div>
      ))}
    </div>
  );
}
