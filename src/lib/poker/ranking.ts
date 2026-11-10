/**
 * Ranking mensal do time: premia quem treina mais E acerta. Pontuação = acerto (%) × log10(decisões),
 * com mínimo de 500 decisões no mês para entrar. Ex.: 1.000 decisões a 70% = 210 pts; 500 a 80% = 215,9.
 * Cada decisão conta: numa mão com duas decisões, acertar uma e errar a outra ("meio certo") vale meio.
 * Todos os drills contam, inclusive os especiais (Mesa Final); fica fora só o drill com a tag "fora-do-ranking".
 */
export const RANKING_MIN_DECISIONS = 500;
/** Tag de drill que não conta no ranking. */
export const RANKING_EXCLUDED_TAG = "fora-do-ranking";
/** Primeiro mês do ranking (lançamento); meses anteriores não aparecem. */
export const RANKING_START = "2026-11";
/** Quantos meses ficam à mostra (os mais recentes). */
export const RANKING_VISIBLE_MONTHS = 4;

export interface RankingRow {
  userId: string;
  decisions: number;
  correct: number;
}

export interface RankingEntry extends RankingRow {
  position: number;
  /** Acerto de 0 a 100. */
  accuracy: number;
  score: number;
}

export function rankingScore(correct: number, decisions: number): number {
  if (decisions <= 0) return 0;
  return (correct / decisions) * 100 * Math.log10(decisions);
}

/** Classificados (por pontuação; empate: mais decisões) e quem ainda não chegou no mínimo (por volume). */
export function buildRanking(rows: readonly RankingRow[], min = RANKING_MIN_DECISIONS) {
  const scored = rows
    .filter((r) => r.decisions > 0)
    .map((r) => ({ ...r, accuracy: (r.correct / r.decisions) * 100, score: rankingScore(r.correct, r.decisions) }));
  const ranked: RankingEntry[] = scored
    .filter((r) => r.decisions >= min)
    .sort((a, b) => b.score - a.score || b.decisions - a.decisions)
    .map((r, i) => ({ ...r, position: i + 1 }));
  const pending = scored.filter((r) => r.decisions < min).sort((a, b) => b.decisions - a.decisions);
  return { ranked, pending };
}

/** Mês no fuso de São Paulo (AAAA-MM) e o intervalo dele em UTC, para a consulta no banco. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  // Brasil sem horário de verão desde 2019: meia-noite em São Paulo = 03:00 UTC
  const from = new Date(Date.UTC(y, m - 1, 1, 3));
  const to = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 3));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function currentMonth(now = new Date()): string {
  const sp = new Date(now.getTime() - 3 * 3600_000);
  return `${sp.getUTCFullYear()}-${String(sp.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Meses à mostra, do mais antigo (esquerda) ao atual (direita): no máximo os 4 últimos, desde o lançamento. */
export function rankingMonths(current: string, start = RANKING_START, visible = RANKING_VISIBLE_MONTHS): string[] {
  const months = [current];
  while (months.length < visible) {
    const prev = previousMonth(months[0]);
    if (prev < start) break;
    months.unshift(prev);
  }
  return months;
}
