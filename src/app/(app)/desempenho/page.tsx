import Link from "next/link";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { PoolChip } from "@/components/PoolBadge";
import { MentoredPoolsEditor } from "@/components/MentoredPoolsEditor";
import { getAttempts, getAttemptsByUser, getMentoredPools, listDrills, listPools, listProfiles, requireProfile } from "@/lib/data";
import { currentMonth, formatPercent, monthStartIso } from "@/lib/format";
import { DIMENSION_LABELS, overallAccuracy, reportByDrill } from "@/lib/poker/leaks";
import { canViewAllPerformance, canViewPerformance } from "@/lib/poker/permissions";
import { type PoolSummary, poolSummary } from "@/lib/poker/pool-report";

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
  searchParams: Promise<{ jogador?: string; periodo?: string; visao?: string; pool?: string }>;
}) {
  const viewer = await requireProfile();
  const params = await searchParams;
  const canPools = canViewAllPerformance(viewer.role);
  const [profiles, pools, drills, mentored] = await Promise.all([
    listProfiles(),
    listPools(),
    listDrills(),
    canPools ? getMentoredPools(viewer.id) : Promise.resolve([] as string[]),
  ]);
  const period: Period = params.periodo && params.periodo in PERIODS ? (params.periodo as Period) : "mes";
  const drillById = new Map(drills.map((d) => [d.id, d]));
  // Admin, coach e mentor veem todas as pools (as que mentoram primeiro); o jogador vê a própria pool
  const poolOptions = canPools
    ? [...pools].sort((a, b) => Number(mentored.includes(b.id)) - Number(mentored.includes(a.id)))
    : pools.filter((p) => p.id === viewer.poolId);
  const hasPools = poolOptions.length > 0;
  const view =
    hasPools && (params.visao === "pools" || (!params.visao && !params.jogador && mentored.length > 0)) ? "pools" : "jogador";
  const selectedPool = poolOptions.find((p) => p.id === params.pool) ?? poolOptions[0];

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="page-title">Desempenho</h1>
        <p className="muted">
          {view === "pools"
            ? "Desempenho da pool: acerto, drills e cada jogador."
            : "Resultado de cada drill: acerto, posições e as mãos que mais erra."}
        </p>
      </div>
      {hasPools && (
        <nav className="flex gap-1 rounded-lg border border-zinc-800 bg-black/40 p-1 text-sm" data-testid="visao-desempenho">
          {(
            [
              ["pools", canPools ? "Pools" : "Minha pool"],
              ["jogador", "Individual"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={`/desempenho?visao=${value}&periodo=${period}`}
              className={`rounded-md px-3 py-1.5 ${view === value ? "bg-baga-red text-white" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );

  const periodSelect = (
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
  );

  if (view === "pools" && selectedPool) {
    const members = profiles.filter((p) => p.active && p.poolId === selectedPool.id);
    const attemptsByUser = await getAttemptsByUser(
      members.map((p) => p.id),
      sinceFor(period),
    );
    const summary = poolSummary(selectedPool.id, members, attemptsByUser);
    return (
      <div className="space-y-6">
        {header}
        <form className="card flex flex-wrap items-end gap-3" method="get">
          <input type="hidden" name="visao" value="pools" />
          <input type="hidden" name="pool" value={selectedPool.id} />
          {periodSelect}
          <noscript>
            <button className="btn-secondary">Ver</button>
          </noscript>
        </form>
        {poolOptions.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Pool" data-testid="seletor-pool">
            {poolOptions.map((p) => (
              <Link
                key={p.id}
                href={`/desempenho?visao=pools&pool=${p.id}&periodo=${period}`}
                aria-current={p.id === selectedPool.id ? "page" : undefined}
                className={`rounded-lg border p-1 transition ${
                  p.id === selectedPool.id ? "border-baga-red bg-baga-red/10" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <PoolChip pool={p} />
              </Link>
            ))}
          </nav>
        )}
        {canPools && <MentoredPoolsEditor pools={pools} selected={mentored} />}
        <PoolSection
          summary={summary}
          pool={selectedPool}
          drillName={(id) => drillById.get(id)?.name ?? "Drill arquivado"}
          period={period}
        />
      </div>
    );
  }

  const visible = profiles.filter((p) => p.active && canViewPerformance(viewer, p));
  const target = visible.find((p) => p.id === params.jogador) ?? viewer;
  const attempts = await getAttempts(target.id, sinceFor(period));
  const overall = overallAccuracy(attempts);
  const report = reportByDrill(attempts);
  const poolName = new Map(pools.map((p) => [p.id, p.name]));
  // Quem é das pools que o mentor acompanha aparece primeiro no seletor
  const ordered = [...visible].sort(
    (a, b) =>
      Number(b.poolId !== null && mentored.includes(b.poolId)) - Number(a.poolId !== null && mentored.includes(a.poolId)),
  );

  return (
    <div className="space-y-6">
      {header}

      <form className="card flex flex-wrap items-end gap-3" method="get">
        <input type="hidden" name="visao" value="jogador" />
        {visible.length > 1 && (
          <div className="min-w-48 flex-1">
            <label className="label">Jogador</label>
            <AutoSubmitSelect name="jogador" defaultValue={target.id}>
              {ordered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.poolId ? ` · ${poolName.get(p.poolId) ?? ""}` : ""}
                </option>
              ))}
            </AutoSubmitSelect>
          </div>
        )}
        {periodSelect}
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

              {r.breakdown.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-zinc-500 uppercase">
                    <tr>
                      <th className="pb-1 font-medium">{DIMENSION_LABELS[r.breakdown[0].dimension]}</th>
                      <th className="pb-1 text-right font-medium">Decisões</th>
                      <th className="pb-1 text-right font-medium">Acerto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {r.breakdown.map((s) => (
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

              {r.missedByGroup.length > 0 && (
                <div className="space-y-3" data-testid="maos-que-mais-erra">
                  <p className="label mb-0">Mãos que mais erra</p>
                  {r.missedByGroup.map((g) => (
                    <div key={g.key} data-testid="maos-erradas-grupo">
                      {r.missedByGroup.length > 1 || r.breakdown.length > 1 ? (
                        <p className="mb-1 text-xs font-semibold text-zinc-400">{g.key}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        {g.hands.map((m) => {
                          // O nome da estratégia sem o próprio grupo (ex.: "Call em shove BB vs HJ 4bb 3:1" → "vs HJ 4bb")
                          const detail = m.strategyName
                            .replace(g.key, "")
                            .replace(/\s*bolha (não )?garantido/i, "")
                            .replace(/^.*?\b(vs .*)$/, "$1")
                            .replace(/\s+/g, " ")
                            .trim();
                          return (
                            <span
                              key={`${m.strategyName}-${m.hand}`}
                              className="rounded bg-red-950 px-2 py-1 font-mono text-xs text-red-200"
                              title={m.strategyName}
                            >
                              {m.hand} <span className="opacity-70">{m.errors}/{m.total}</span>
                              {r.byStrategy.length > 1 && detail && <span className="ml-1 font-sans opacity-60">· {detail}</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PoolSection({
  summary,
  pool,
  drillName,
  period,
}: {
  summary: PoolSummary;
  pool: { id: string; name: string; color: string; logo: string | null };
  drillName: (id: string) => string;
  period: Period;
}) {
  return (
    <section className="card space-y-5" data-testid="pool-desempenho">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="min-w-40 flex-1">
          <PoolChip pool={pool} />
        </div>
        <div>
          <p className="label">Jogadores</p>
          <p className="text-2xl font-semibold">{summary.players}</p>
        </div>
        <div>
          <p className="label">Treinaram</p>
          <p className="text-2xl font-semibold">{summary.active}</p>
        </div>
        <div>
          <p className="label">Decisões</p>
          <p className="text-2xl font-semibold">{summary.total}</p>
        </div>
        <div>
          <p className="label">Acerto da pool</p>
          <p className="text-2xl font-semibold">{summary.total ? formatPercent(summary.accuracy, 1) : "—"}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <p className="label">Jogadores</p>
          {summary.ranking.length === 0 ? (
            <p className="muted text-sm">Nenhum jogador nesta pool.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="pb-1 font-medium">Jogador</th>
                  <th className="pb-1 text-right font-medium">Decisões</th>
                  <th className="pb-1 text-right font-medium">Drills</th>
                  <th className="pb-1 text-right font-medium">Acerto</th>
                  <th className="pb-1 text-right font-medium">Último</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {summary.ranking.map((r) => (
                  <tr key={r.id} data-testid="pool-jogador">
                    <td className="py-1.5 pr-2">
                      <Link
                        href={`/desempenho?visao=jogador&jogador=${r.id}&periodo=${period}`}
                        className="hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2 text-right text-zinc-400">{r.total}</td>
                    <td className="py-1.5 pr-2 text-right text-zinc-400">{r.drills}</td>
                    <td className="py-1.5 pr-2 text-right">{r.total ? formatPercent(r.accuracy, 1) : "—"}</td>
                    <td className="py-1.5 text-right text-zinc-500">{r.lastAt ? formatDate(r.lastAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <p className="label">Drills da pool (pior acerto primeiro)</p>
          {summary.drills.length === 0 ? (
            <p className="muted text-sm">Nenhum treino neste período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="pb-1 font-medium">Drill</th>
                  <th className="pb-1 text-right font-medium">Jogadores</th>
                  <th className="pb-1 text-right font-medium">Decisões</th>
                  <th className="pb-1 text-right font-medium">Acerto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {summary.drills.map((d) => (
                  <tr key={d.drillId}>
                    <td className="py-1.5 pr-2">{drillName(d.drillId)}</td>
                    <td className="py-1.5 pr-2 text-right text-zinc-400">{d.players}</td>
                    <td className="py-1.5 pr-2 text-right text-zinc-400">{d.total}</td>
                    <td className="py-1.5 text-right">{formatPercent(d.accuracy, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
