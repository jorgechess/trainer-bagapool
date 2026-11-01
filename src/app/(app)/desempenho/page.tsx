import Link from "next/link";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { PoolChip } from "@/components/PoolBadge";
import { getAttempts, listDrills, listPools, listProfiles, requireProfile } from "@/lib/data";
import { currentMonth, formatPercent, monthStartIso } from "@/lib/format";
import { overallAccuracy, reportByDrill } from "@/lib/poker/leaks";
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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(
    new Date(iso),
  );
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ jogador?: string; periodo?: string }>;
}) {
  const viewer = await requireProfile();
  const params = await searchParams;
  const [profiles, pools, drills] = await Promise.all([listProfiles(), listPools(), listDrills()]);
  const visible = profiles.filter((p) => p.active && canViewPerformance(viewer, p));
  const target = visible.find((p) => p.id === params.jogador) ?? viewer;
  const period: Period = params.periodo && params.periodo in PERIODS ? (params.periodo as Period) : "mes";
  const attempts = await getAttempts(target.id, sinceFor(period));
  const overall = overallAccuracy(attempts);
  const report = reportByDrill(attempts);
  const drillById = new Map(drills.map((d) => [d.id, d]));
  const poolName = new Map(pools.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Desempenho</h1>
        <p className="muted">Resultado de cada drill: acerto, posições e as mãos que mais erra.</p>
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

      <div className="card flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="min-w-40 flex-1">
          <p className="text-lg font-semibold">{target.name}</p>
          <div className="mt-1">
            <PoolChip pool={pools.find((p) => p.id === target.poolId) ?? null} />
          </div>
        </div>
        <div>
          <p className="label">Drills</p>
          <p className="text-2xl font-semibold">{report.length}</p>
        </div>
        <div>
          <p className="label">Decisões</p>
          <p className="text-2xl font-semibold">{overall.total}</p>
        </div>
        <div>
          <p className="label">Acerto geral</p>
          <p className="text-2xl font-semibold">{overall.total ? formatPercent(overall.accuracy, 1) : "—"}</p>
        </div>
        
      </div>

      {report.length === 0 && <p className="card muted">Nenhum treino neste período.</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {report.map((r) => {
          const drill = drillById.get(r.drillId);
          return (
            <section key={r.drillId} className="card space-y-4" data-testid="drill-report">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {drill ? (
                    <Link href={`/drills/${drill.id}/treinar`} className="font-semibold hover:underline">
                      {drill.name}
                    </Link>
                  ) : (
                    <p className="font-semibold text-zinc-400">Drill arquivado</p>
                  )}
                  <p className="text-xs text-zinc-500">
                    {r.total} decisões · {r.errors} erros · último treino {formatDate(r.lastAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-4xl leading-none text-baga-cream">{formatPercent(r.accuracy, 1)}</p>
                  <p className="text-xs text-zinc-500">acerto</p>
                </div>
              </div>

              <div className="h-2 rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-baga-red" style={{ width: `${r.accuracy * 100}%` }} />
              </div>

              {r.byStrategy.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-zinc-500 uppercase">
                    <tr>
                      <th className="pb-1 font-medium">Estratégia</th>
                      <th className="pb-1 text-right font-medium">Decisões</th>
                      <th className="pb-1 text-right font-medium">Acerto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {r.byStrategy.map((s) => (
                      <tr key={s.key}>
                        <td className="py-1.5 pr-2">{s.key}</td>
                        <td className="py-1.5 pr-2 text-right text-zinc-400">{s.total}</td>
                        <td className="py-1.5 text-right">
                          {formatPercent(s.accuracy, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {r.missedHands.length > 0 && (
                <div>
                  <p className="label">Mãos que mais erra</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.missedHands.map((m) => (
                      <span
                        key={`${m.strategyName}-${m.hand}`}
                        className="rounded bg-red-950 px-2 py-1 font-mono text-xs text-red-200"
                        title={m.strategyName}
                      >
                        {m.hand} <span className="opacity-70">{m.errors}/{m.total}</span>
                        {r.byStrategy.length > 1 && (
                          <span className="ml-1 font-sans opacity-60">· {m.strategyName}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
