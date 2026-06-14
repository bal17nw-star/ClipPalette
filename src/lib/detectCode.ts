/**
 * フロントエンド側でコードかどうかを再判定する。
 * DBに text として保存済みのクリップにも遡って適用される。
 */
export function looksLikeCode(text: string): boolean {
  const lines = text.split("\n");

  // 2行以上インデントされた行があればコード
  const indented = lines.filter(
    (l) => /^(\t| {2,})/.test(l) && l.trim().length > 0
  ).length;
  if (indented >= 2) return true;

  // 強いシグナル（1つでもあればコード確定）
  const strong = [
    /\(\)\s*\{/, /\(\)\s*=>/, /=>\s*\{/,
    /\bfn\s+\w+/, /\bdef\s+\w+/, /\bfunc\s+\w+/,
    /\bSELECT\b.+\bFROM\b/i,
    /^#include\b/m, /^package\s+main\b/m, /^using namespace\b/m,
    /^import\s+\w[\w.]*\s*$/m,
  ];
  if (strong.some((re) => re.test(text))) return true;

  if (lines.length < 2) return false;

  // 弱いシグナルを2つ以上で判定
  const weak = [
    /\bconst\s+\w/, /\blet\s+\w/, /\bvar\s+\w/,
    /\bfunction\s+\w/, /\bclass\s+\w/,
    /\breturn\s+/, /\bif\s*\(/, /\bfor\s*\(/, /\bwhile\s*\(/,
    /[!=]=\s/, /&&\s/, /\|\|\s/,
    /\bpublic\s+/, /\bprivate\s+/, /\bvoid\s+/,
    /:=\s/, /\bmod\s+/, /\buse\s+\w/,
    /\brequire\(/, /\bexport\s+/,
  ];
  const hits = weak.filter((re) => re.test(text)).length;
  return hits >= 2;
}

export function detectLanguage(code: string): string {
  if (/\bfn\s+\w+|let\s+mut\s|impl\s|pub\s+fn\s|use\s+std::/.test(code)) return "rust";
  if (/def\s+\w+\s*\(|import\s+\w|from\s+\w+\s+import|:\s*$/.test(code)) return "python";
  if (/^package\s+main|:=\s|fmt\.|func\s+\w/.test(code)) return "go";
  if (/interface\s+\w|type\s+\w+\s*=|:\s*(string|number|boolean|void)\b/.test(code)) return "typescript";
  if (/<\/?[a-z][\s\S]*>/i.test(code) && /<\/\w/.test(code)) return "markup";
  if (/^\s*[{\[]/.test(code) && /[}\]]$/.test(code.trim())) return "json";
  if (/\bSELECT\b|\bFROM\b|\bWHERE\b/i.test(code)) return "sql";
  if (/^[a-z-]+\s*\{|^@[a-z]/m.test(code)) return "css";
  if (/^#!\/|^\s*(echo|cd|ls|grep|awk|sed|export)\s/m.test(code)) return "bash";
  if (/\bconst\s|\blet\s|\bfunction\s|\bexport\s|\brequire\(/.test(code)) return "javascript";
  return "javascript";
}
