/** Desempenho agregado das pools que o mentor acompanha. */
import type { Attempt } from "./drill";
import { overallAccuracy } from "./leaks";

export interface PoolPlayer {
  id: string;
  name: string;
  poolId: string | null;
}

export interface PlayerSummary {
  id: string;
  name: string;
  total: number;
  accuracy: number;
  drills: number;
  lastAt: string | null;
}

export interface PoolDrillSummary {
  drillId: string;
  total: number;
  accuracy: number;
  /** Jogadores da pool que treinaram este drill no período. */
  players: number;
}

export interface PoolSummary {
  poolId: string;
  players: number;
  /** Jogadores com pelo menos uma decisão no período. */
  active: number;
  total: number;
  accuracy: number;
  /** Do pior acerto para o melhor. */
  drills: PoolDrillSummary[];
  /** Quem mais treinou primeiro; quem não treinou fica no fim. */
  ranking: PlayerSummary[];
}

export function summarizePlayer(player: PoolPlayer, attempts: readonly Attempt[]): PlayerSummary {
  const overall = overallAccuracy(attempts);
  return {
    id: player.id,
    name: player.name,
    total: overall.total,
    accuracy: overall.accuracy,
    drills: new Set(attempts.map((a) => a.drillId)).size,
    lastAt: attempts.reduce<string | null>((max, a) => (max === null || a.createdAt > max ? a.createdAt : max), null),
  };
}

export function poolSummary(
  poolId: string,
  players: readonly PoolPlayer[],
  attemptsByUser: ReadonlyMap<string, readonly Attempt[]>,
): PoolSummary {
  const members = players.filter((p) => p.poolId === poolId);
  const ranking = members
    .map((p) => summarizePlayer(p, attemptsByUser.get(p.id) ?? []))
    .sort((a, b) => b.total - a.total || b.accuracy - a.accuracy || a.name.localeCompare(b.name));
  const all = members.flatMap((p) => attemptsByUser.get(p.id) ?? []);
  const byDrill = new Map<string, { total: number; correct: number; players: Set<string> }>();
  for (const p of members)
    for (const a of attemptsByUser.get(p.id) ?? []) {
      const entry = byDrill.get(a.drillId) ?? { total: 0, correct: 0, players: new Set<string>() };
      entry.total += 1;
      if (a.correct) entry.correct += 1;
      entry.players.add(p.id);
      byDrill.set(a.drillId, entry);
    }
  const overall = overallAccuracy(all);
  return {
    poolId,
    players: members.length,
    active: ranking.filter((r) => r.total > 0).length,
    total: overall.total,
    accuracy: overall.accuracy,
    drills: [...byDrill.entries()]
      .map(([drillId, e]) => ({ drillId, total: e.total, accuracy: e.correct / e.total, players: e.players.size }))
      .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total),
    ranking,
  };
}
