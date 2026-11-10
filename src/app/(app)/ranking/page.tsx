import Link from "next/link";
import { PoolChip } from "@/components/PoolBadge";
import { getRankingRows, listPools, listProfiles, requireProfile } from "@/lib/data";
import { RANKING_MIN_DECISIONS, buildRanking, currentMonth, rankingMonths } from "@/lib/poker/ranking";

export const metadata = { title: "Ranking · Baga Trainer" };

const MEDALS = ["🥇", "🥈", "🥉"];
const fmt = (n: number, digits = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

/** Ranking mensal do time: acerto × log10(decisões), mínimo de 500 decisões; todos os drills contam, inclusive a Mesa Final. */
export default async function RankingPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const viewer = await requireProfile();
  const now = currentMonth();
  const months = rankingMonths(now);
  const requested = (await searchParams).mes;
  const month = requested && months.includes(requested) ? requested : now;

  const [rows, profiles, pools] = await Promise.all([getRankingRows(month), listProfiles(), listPools()]);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const poolById = new Map(pools.map((p) => [p.id, p]));
  const { ranked, pending } = buildRanking(rows.filter((r) => byId.has(r.userId)));
  const mine = ranked.find((r) => r.userId === viewer.id);
  const minePending = pending.find((r) => r.userId === viewer.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Ranking de {monthLabel(month)}</h1>
          <p className="muted mt-1 max-w-2xl text-sm">
            Pontos = acerto × log₁₀ das decisões do mês. Treinar mais soma, mas só com bom aproveitamento. Entra quem fizer
            pelo menos {fmt(RANKING_MIN_DECISIONS)} decisões. Todos os drills contam, inclusive a Mesa Final.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="Mês">
          {months.length > 1 && months.map((m) => (
            <Link
              key={m}
              href={m === now ? "/ranking" : `/ranking?mes=${m}`}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                m === month ? "bg-baga-cream text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {monthLabel(m).replace(/ \d+$/, "")}
            </Link>
          ))}
        </nav>
      </div>

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2" data-testid="ranking-voce">
        {mine ? (
          <p className="text-lg">
            Você está em <strong className="text-baga-cream">{mine.position}º</strong> com {fmt(mine.score, 1)} pontos
            ({fmt(mine.decisions)} decisões, {fmt(mine.accuracy, 1)}% de acerto).
          </p>
        ) : (
          <div className="w-full max-w-xl space-y-2">
            <p>
              Faltam <strong className="text-baga-cream">{fmt(RANKING_MIN_DECISIONS - (minePending?.decisions ?? 0))}</strong>{" "}
              decisões para você entrar no ranking deste mês.
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-baga-red"
                style={{ width: `${Math.min(100, ((minePending?.decisions ?? 0) / RANKING_MIN_DECISIONS) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm" data-testid="ranking-tabela">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-400">
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Jogador</th>
              <th className="px-4 py-3 text-right">Decisões</th>
              <th className="px-4 py-3 text-right">Acerto</th>
              <th className="px-4 py-3 text-right">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  Ninguém chegou a {fmt(RANKING_MIN_DECISIONS)} decisões neste mês ainda.
                </td>
              </tr>
            )}
            {ranked.map((r) => {
              const profile = byId.get(r.userId)!;
              const me = r.userId === viewer.id;
              return (
                <tr key={r.userId} className={`border-b border-zinc-900 ${me ? "bg-baga-red/10" : ""}`} data-me={me || undefined}>
                  <td className="px-4 py-2.5 text-lg font-display tracking-wide">{MEDALS[r.position - 1] ?? r.position}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{profile.name}</span>
                      {profile.nick && <span className="text-xs text-zinc-500">@{profile.nick}</span>}
                      <PoolChip pool={profile.poolId ? (poolById.get(profile.poolId) ?? null) : null} compact />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(r.decisions)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(r.accuracy, 1)}%</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-baga-cream">{fmt(r.score, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            A caminho ({fmt(RANKING_MIN_DECISIONS)} decisões para entrar)
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="ranking-a-caminho">
            {pending.map((r) => {
              const profile = byId.get(r.userId)!;
              return (
                <li key={r.userId} className="rounded-md border border-zinc-800 px-3 py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{profile.name}</span>
                    <span className="tabular-nums text-zinc-400">
                      {fmt(r.decisions)}/{fmt(RANKING_MIN_DECISIONS)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full bg-zinc-400" style={{ width: `${(r.decisions / RANKING_MIN_DECISIONS) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
