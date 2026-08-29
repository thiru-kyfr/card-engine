/**
 * Stage 5 — ranking.
 *
 * Sort by NAV descending. Then, where cards sit within the tiebreak band of one
 * another, order those by fit instead: inside that band the rupee difference is
 * smaller than the engine's own modelling error, so it is honest to let the
 * user's preferences decide. Outside it, money wins.
 *
 * Banding is done by greedy clustering from the top so the result is
 * deterministic and every card lands in exactly one cluster.
 */
import type { CardResult, EngineConfig } from "./types";

export function rankResults(results: CardResult[], config: EngineConfig): CardResult[] {
  const band = config.tiebreak_band_pct / 100;

  // Deterministic primary sort: NAV desc, then card_id for stability.
  const sorted = [...results].sort((a, b) => {
    const na = a.valuation?.nav_inr ?? Number.NEGATIVE_INFINITY;
    const nb = b.valuation?.nav_inr ?? Number.NEGATIVE_INFINITY;
    if (nb !== na) return nb - na;
    return a.card.card_id.localeCompare(b.card.card_id);
  });

  const output: CardResult[] = [];
  let i = 0;
  while (i < sorted.length) {
    const anchor = sorted[i].valuation?.nav_inr ?? 0;
    const cluster: CardResult[] = [sorted[i]];
    let j = i + 1;

    // Band is measured against the cluster anchor (the highest NAV in it).
    // A non-positive anchor makes the percentage meaningless, so no banding there.
    while (j < sorted.length) {
      const nav = sorted[j].valuation?.nav_inr ?? 0;
      const within = anchor > 0 ? (anchor - nav) / anchor < band : false;
      if (!within) break;
      cluster.push(sorted[j]);
      j++;
    }

    if (cluster.length > 1) {
      const navOrder = cluster.map((c) => c.card.card_id);
      cluster.sort((a, b) => {
        const fa = a.fit?.total ?? 0;
        const fb = b.fit?.total ?? 0;
        if (fb !== fa) return fb - fa;
        const na = a.valuation?.nav_inr ?? 0;
        const nb = b.valuation?.nav_inr ?? 0;
        if (nb !== na) return nb - na;
        return a.card.card_id.localeCompare(b.card.card_id);
      });
      // Flag only the cards the tiebreak actually moved.
      cluster.forEach((c, idx) => {
        c.tiebreak_applied = navOrder[idx] !== c.card.card_id;
      });
    } else {
      cluster[0].tiebreak_applied = false;
    }

    output.push(...cluster);
    i = j;
  }

  output.forEach((r, idx) => {
    r.rank = idx + 1;
  });
  return output;
}
