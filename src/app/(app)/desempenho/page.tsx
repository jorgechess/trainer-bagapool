import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { getAttempts, listPools, listProfiles, requireProfile } from "@/lib/data";
import { currentMonth, formatPercent, monthStartIso } from "@/lib/format";
import {
  DEFAULT_LEAK_OPTIONS,
  DIMENSIONS,
  DIMENSION_LABELS,
  findLeaks,
  groupAttempts,
  mostMissedHands,
  overallAccuracy,
} from "@/lib/poker/leaks";
import { canViewPerformance } from "@/lib/poker/permissions";

const PERIODS = {
  mes: "Este mês",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  tudo: "Tudo",
} as const;
type Period = keyof typeof PERIODS;

function sinceFor(period: Period): string | undefined {
  if (period === "mes") return monthStartIso(currentMonth());
  if (period === "30d") return new Date(Date.now() - 30 * 86400000).toISOString();
  if (period === "90d") return new Date(Date.now() - 90 * 86400000).toISOString();
  return undefined;
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ jogador?: string; periodo?: string }>;
}) {
  const viewer = await requireProfile();
  const params = await searchParams;
  const [profiles, pools] = await Promise.all([listProfiles(), listPools()]);
  const visible = profiles.filter((p) => p.active && canViewPerformance(viewer, p));
  const target = visible.find((p) => p.id === params.jogador) ?? viewer;
  const period: Period = params.periodo && params.periodo in PERIODS ? (params.periodo as Period) : "mes";
  const attempts = await getAttempts(target.id, sinceFor(period));
  const overall = overallAccuracy(attempts);
  const leaks = findLeaks(attempts);
  const poolName = new Map(pools.map((p) => [p.id, p.name]));

  const strategyErrors = groupAttempts(attempts, "estrategia").filter((g) => g.errors > 0).slice(0, 5);
  const strategyIdByName = new Map(attempts.map((a) => [a.strategyName, a.strategyId]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Desempenho</h1>
        <p className="muted">Leak finder: onde estão os erros, por tipo de spot.</p>
      </div>

      <form className="card flex flex-wrap items-end gap-3" method="get">
        {visible.length > 1 && (
          <div className="min-w-48 flex-1">
            <label className="label">Jogador</label>
            <AutoSubmitSelect name="jogador" defaultValue={target.id}>
              {visible.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.poolId ? ` · ${poolName.get(p.poolId) ?? ""}` : ""}
                </option>
              ))}
            </AutoSubmitSelect>
          </div>
        )}
        <div className="min-w-40">
          <label className="label">Período</label>
          <AutoSubmitSelect name="periodo" defaultValue={period}>
            {Object.entries(PERIODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </AutoSubmitSelect>
        </div>
        <noscript>
          <button className="btn-secondary">Ver</button>
        </noscript>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="label">Jogador</p>
          <p className="text-lg font-semibold">{target.name}</p>
        </div>
        <div className="card">
          <p className="label">Decisões</p>
          <p className="text-3xl font-semibold">{overall.total}</p>
        </div>
        <div className="card">
          <p className="label">Acerto</p>
          <p className="text-3xl font-semibold">{overall.total ? formatPercent(overall.accuracy, 1) : "—"}</p>
        </div>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">Leaks</h2>
        <p className="muted">
          Grupos com pelo menos {DEFAULT_LEAK_OPTIONS.minAttempts} decisões e acerto abaixo de{" "}
          {formatPercent(DEFAULT_LEAK_OPTIONS.targetAccuracy)}, do pior para o melhor.
        </p>
        {leaks.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhum leak encontrado neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-400 uppercase">
                <tr>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Grupo</th>
                  <th className="py-2 pr-3 text-right">Decisões</th>
                  <th className="py-2 pr-3 text-right">Erros</th>
                  <th className="py-2 text-right">Acerto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {leaks.map((leak) => (
                  <tr key={`${leak.dimension}-${leak.key}`}>
                    <td className="py-2 pr-3 text-zinc-400">{DIMENSION_LABELS[leak.dimension]}</td>
                    <td className="py-2 pr-3">{leak.key}</td>
                    <td className="py-2 pr-3 text-right">{leak.total}</td>
                    <td className="py-2 pr-3 text-right">{leak.errors}</td>
                    <td className="py-2 text-right text-red-400">{formatPercent(leak.accuracy, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {strategyErrors.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Mãos que mais erra</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {strategyErrors.map((group) => {
              const id = strategyIdByName.get(group.key);
              const hands = id ? mostMissedHands(attempts, id, 8) : [];
              return (
                <div key={group.key} className="rounded-lg bg-zinc-950 p-3">
                  <p className="mb-2 text-sm font-medium">
                    {group.key} <span className="text-zinc-500">· {formatPercent(group.accuracy)}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {hands.map((h) => (
                      <span key={h.hand} className="rounded bg-red-950 px-2 py-1 font-mono text-xs text-red-200">
                        {h.hand} <span className="opacity-70">{h.errors}/{h.total}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Detalhe por tipo</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {DIMENSIONS.map((dimension) => {
            const groups = groupAttempts(attempts, dimension);
            if (groups.length === 0) return null;
            return (
              <details key={dimension} className="card" open={dimension === "situacao"}>
                <summary className="cursor-pointer font-medium">{DIMENSION_LABELS[dimension]}</summary>
                <table className="mt-3 w-full text-sm">
                  <tbody className="divide-y divide-zinc-800">
                    {groups.map((g) => (
                      <tr key={g.key}>
                        <td className="py-1.5 pr-2">{g.key}</td>
                        <td className="py-1.5 pr-2 text-right text-zinc-400">{g.total}</td>
                        <td
                          className={`py-1.5 text-right ${
                            g.accuracy >= DEFAULT_LEAK_OPTIONS.targetAccuracy ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {formatPercent(g.accuracy, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
