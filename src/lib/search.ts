/**
 * Lightweight fuzzy matching for smart search.
 *
 * A query matches when every character appears in the target in order
 * (subsequence match). Exact substrings rank highest so "hack" puts
 * "Hackathon" first — and in-order runs (contiguous characters) score
 * higher than scattered ones.
 */
export function fuzzyScore(text: string, q: string): number {
  const t = text.toLowerCase();
  const query = q.toLowerCase().trim();
  if (!query) return 1;
  if (t.includes(query)) return 3 + (t.startsWith(query) ? 1 : 0);
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of query) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return 0;
    streak = idx === ti ? streak + 1 : 0;
    score += 1 + streak * 0.5;
    ti = idx + 1;
  }
  return score / (query.length + 2);
}
