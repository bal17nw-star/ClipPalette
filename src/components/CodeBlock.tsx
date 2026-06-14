import { useEffect, useRef } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-go";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-sql";
// Prism dark theme — code blocks are always dark regardless of app theme
import "prismjs/themes/prism-tomorrow.css";
import { detectLanguage } from "../lib/detectCode";

interface Props {
  code: string;
  maxLines?: number;
}

export function CodeBlock({ code, maxLines = 8 }: Props) {
  const ref = useRef<HTMLElement>(null);
  const lang = detectLanguage(code);

  const lines = code.split("\n");
  const truncated = lines.length > maxLines;
  const display = truncated ? lines.slice(0, maxLines).join("\n") + "\n…" : code;

  useEffect(() => {
    if (ref.current) {
      // Prism.highlightElement が class を見て色付けする
      Prism.highlightElement(ref.current);
    }
  }, [display, lang]);

  return (
    <div className="relative rounded-md overflow-hidden bg-[#2d2d2d] text-xs mt-1">
      <span className="absolute top-1 right-2 text-neutral-500 text-[10px] uppercase tracking-wider z-10 pointer-events-none">
        {lang}
      </span>
      <pre className="overflow-x-auto p-3 pr-12 m-0 leading-5 max-h-40 overflow-y-auto !bg-transparent">
        <code ref={ref} className={`language-${lang} !bg-transparent`}>
          {display}
        </code>
      </pre>
      {truncated && (
        <div className="text-center text-neutral-500 text-[10px] py-0.5 bg-neutral-900/60">
          +{lines.length - maxLines} more lines
        </div>
      )}
    </div>
  );
}
