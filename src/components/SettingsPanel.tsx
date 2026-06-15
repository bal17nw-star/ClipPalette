import { X } from "lucide-react";
import clsx from "clsx";
import { useClipStore } from "../store/clipStore";

const SENSITIVE_OPTIONS = [
  {
    value: "visible",
    label: "表示する",
    sub: "そのまま保存・表示",
  },
  {
    value: "masked",
    label: "マスクする",
    sub: "保存するが隠す（クリックで展開）",
  },
  {
    value: "skip",
    label: "保存しない",
    sub: "検出したら即破棄",
  },
] as const;

export function SettingsPanel() {
  const { toggleSettingsPanel, sensitiveMode, setSensitiveMode } = useClipStore();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={toggleSettingsPanel}
    >
      <div
        className="relative w-80 rounded-2xl border border-neutral-200 dark:border-neutral-700
          bg-white dark:bg-neutral-900 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">設定</h2>
          <button
            onClick={toggleSettingsPanel}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Sensitive content section */}
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-3 uppercase tracking-wide">
            センシティブコンテンツの扱い
          </p>
          <div className="space-y-2">
            {SENSITIVE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={clsx(
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                  sensitiveMode === opt.value
                    ? "border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                    : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                )}
              >
                <input
                  type="radio"
                  name="sensitive_mode"
                  value={opt.value}
                  checked={sensitiveMode === opt.value}
                  onChange={() => setSensitiveMode(opt.value)}
                  className="mt-0.5 accent-violet-600"
                />
                <div>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {opt.label}
                  </p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {opt.sub}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
