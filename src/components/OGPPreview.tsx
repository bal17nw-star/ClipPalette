import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, Globe } from "lucide-react";
import type { ClipItem, OgpData } from "../types";

interface Props {
  clip: ClipItem;
}

export function OGPPreview({ clip }: Props) {
  const [ogp, setOgp] = useState<OgpData | null>(
    clip.ogp_title || clip.ogp_domain
      ? {
          title: clip.ogp_title,
          image: clip.ogp_image,
          domain: clip.ogp_domain,
          description: null,
        }
      : null
  );
  const [loading, setLoading] = useState(!ogp);

  useEffect(() => {
    if (ogp) return;
    let cancelled = false;
    setLoading(true);
    invoke<OgpData>("fetch_ogp", { url: clip.content })
      .then((data) => {
        if (cancelled) return;
        setOgp(data);
        // Persist to DB
        invoke("update_ogp", { id: clip.id, ogp: data }).catch(() => {});
      })
      .catch(() => setOgp({ title: null, image: null, domain: null, description: null }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clip.id, clip.content, ogp]);

  if (loading) {
    return (
      <div className="mt-2 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 animate-pulse">
        <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2" />
        <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
      </div>
    );
  }

  if (!ogp?.title && !ogp?.domain) {
    return (
      <div className="mt-1 text-xs text-violet-500 truncate flex items-center gap-1">
        <Globe size={11} />
        <span className="truncate">{clip.content}</span>
      </div>
    );
  }

  return (
    <a
      href={clip.content}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-2 flex gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700
        hover:border-violet-400 dark:hover:border-violet-500 transition-colors
        overflow-hidden bg-neutral-50 dark:bg-neutral-800/50 no-underline group"
    >
      {ogp.image && (
        <img
          src={ogp.image}
          alt=""
          className="w-16 h-16 object-cover flex-shrink-0"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="flex-1 min-w-0 p-2">
        {ogp.title && (
          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 line-clamp-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
            {ogp.title}
          </p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <Globe size={10} className="text-neutral-400 flex-shrink-0" />
          <span className="text-[10px] text-neutral-400 truncate">{ogp.domain}</span>
          <ExternalLink size={10} className="text-neutral-300 flex-shrink-0 ml-auto" />
        </div>
      </div>
    </a>
  );
}
