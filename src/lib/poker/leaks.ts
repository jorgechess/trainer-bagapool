/** Leak finder: acertos e erros agrupados por tipo de spot. */
import type { Attempt } from "./drill";
import { STREET_LABELS } from "./strategy";

export const DIMENSIONS = ["situacao", "posicao", "street", "stack", "proporcao", "tag", "estrategia"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  situacao: "Situação",
  posicao: "Posição",
  street: "Street",
  stack: "Stack",
  proporcao: "Proporção",
  tag: "Etiqueta",
  estrategia: "Estratégia",
};

function keysFor(attempt: Attempt, dimension: Dimension): string[] {
  switch (dimension) {
    case "situacao":
      return [attempt.situation];
    case "posicao":
      return [attempt.heroPosition];
    case "street":
      return [STREET_LABELS[attempt.street]];
    case "stack":
      return [attempt.stackLabel];
    case "proporcao":
      return attempt.ratioLabel ? [attempt.ratioLabel] : [];
    case "tag":
      return attempt.tags;
    case "estrategia":
      return [attempt.strategyName];
  }
}

export interface GroupStats {
  dimension: Dimension;
  key: string;
  total: number;
  correct: number;
  errors: number;
  accuracy: number;
}

export function groupAttempts(attempts: readonly Attempt[], dimension: Dimension): GroupStats[] {
  const groups = new Map<string, { total: number; correct: number }>();
  for (const attempt of attempts) {
    for (const key of keysFor(attempt, dimension)) {
      const entry = groups.get(key) ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (attempt.correct) entry.correct += 1;
      groups.set(key, entry);
    }
  }
  return [...groups.entries()]
    .map(([key, { total, correct }]) => ({
      dimension,
      key,
      total,
      correct,
      errors: total - correct,
      accuracy: total ? correct / total : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

export interface LeakOptions {
  /** Mínimo de decisões para um grupo contar como leak (evita conclusões com pouca amostra). */
  minAttempts: number;
  /** Acerto abaixo disso é considerado leak (0 a 1). */
  targetAccuracy: number;
}

export const DEFAULT_LEAK_OPTIONS: LeakOptions = { minAttempts: 20, targetAccuracy: 0.9 };

/** Grupos abaixo da meta, do pior para o melhor (empate: mais erros primeiro). */
export function findLeaks(attempts: readonly Attempt[], options: LeakOptions = DEFAULT_LEAK_OPTIONS): GroupStats[] {
  return DIMENSIONS.flatMap((dimension) => groupAttempts(attempts, dimension))
    .filter((g) => g.total >= options.minAttempts && g.accuracy < options.targetAccuracy)
    .sort((a, b) => a.accuracy - b.accuracy || b.errors - a.errors);
}

/** Mãos que o jogador mais erra em uma estratégia. */
export function mostMissedHands(attempts: readonly Attempt[], strategyId: string, limit = 10) {
  const counts = new Map<string, { total: number; errors: number }>();
  for (const attempt of attempts) {
    if (attempt.strategyId !== strategyId) continue;
    const entry = counts.get(attempt.hand) ?? { total: 0, errors: 0 };
    entry.total += 1;
    if (!attempt.correct) entry.errors += 1;
    counts.set(attempt.hand, entry);
  }
  return [...counts.entries()]
    .filter(([, c]) => c.errors > 0)
    .map(([hand, c]) => ({ hand, ...c }))
    .sort((a, b) => b.errors - a.errors || a.total - b.total)
    .slice(0, limit);
}

export function overallAccuracy(attempts: readonly Attempt[]): { total: number; correct: number; accuracy: number } {
  const correct = attempts.filter((a) => a.correct).length;
  return { total: attempts.length, correct, accuracy: attempts.length ? correct / attempts.length : 0 };
}
