import Link from "next/link";
import { PoolLogo } from "@/components/PoolBadge";
import { getAttempts, getPlan, getPool, listDrills, requireProfile } from "@/lib/data";
import { currentMonth, formatPercent, monthLabel, monthStartIso } from "@/lib/format";
import { overallAccuracy, reportByDrill } from "@/lib/poker/leaks";
import { planProgress } from "@/lib/poker/plan";
import { ROLE_LABELS } from "@/lib/poker/permissions";

export default async function HomePage() {
  const profile = await requireProfile();
  const month = currentMonth();
  const [monthAttempts, plan, drills, pool] = await Promise.all([
    getAttempts(profile.id, monthStartIso(month)),
    getPlan(profile.id, month),
    listDrills(),
    getPool(profile.poolId),
  ]);
  const drillName = new Map(drills.map((d) => [d.id, d.name]));
  const stats = overallAccuracy(monthAttempts);
  const progress = plan ? planProgress(plan.plan, monthAttempts) : [];
  const drillById = new Map(drills.map((d) => [d.id, d]));
  const belowGoal = reportByDrill(monthAttempts)
    .filter((r) => r.accuracy < (drillById.get(r.drillId)?.passAccuracy ?? 0.9))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {pool && <PoolLogo pool={pool} size={88} />}
        <div>
          <h1 className="page-title">Olá, {profile.name.split(" ")[0]}</h1>
          <p className="muted">
            {ROLE_LABELS[profile.role]}
            {pool && (
              <>
                {" · "}
                <span style={{ color: pool.color }}>{pool.name}</span>
              </>
            )}{" "}
            · resumo de {monthLabel(month)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="label">Decisões no mês</p>
          <p className="text-3xl font-semibold">{stats.total}</p>
        </div>
        <div className="card">
          <p className="label">Acerto no mês</p>
          <p className="text-3xl font-semibold">{stats.total ? formatPercent(stats.accuracy) : "—"}</p>
        </div>
        <div className="card">
          <p className="label">Drills disponíveis</p>
          <p className="text-3xl font-semibold">{drills.length}</p>
        </div>
      </div>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Metas do mês</h2>
          <Link href="/plano" className="text-sm text-baga-red hover:underline">
            Ver plano
          </Link>
        </div>
        {progress.length === 0 ? (
          <p className="muted">Nenhum plano para este mês ainda.</p>
        ) : (
          <ul className="space-y-3">
            {progress.map((goal) => (
              <li key={goal.drillId}>
                <div className="mb-1 flex justify-between text-sm">
                  <Link href={`/drills/${goal.drillId}/treinar`} className="hover:underline">
                    {drillName.get(goal.drillId) ?? goal.drillId}
                  </Link>
                  <span className="text-zinc-400">
                    {goal.done}/{goal.targetDecisions}
                    {goal.done > 0 && ` · ${formatPercent(goal.accuracy)}`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full ${goal.completed ? "bg-green-500" : "bg-baga-red"}`}
                    style={{ width: `${Math.min(100, (goal.done / goal.targetDecisions) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Drills abaixo da meta no mês</h2>
          <Link href="/desempenho" className="text-sm text-baga-red hover:underline">
            Ver desempenho
          </Link>
        </div>
        {belowGoal.length === 0 ? (
          <p className="muted">Nenhum drill abaixo da meta neste mês.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {belowGoal.map((r) => (
              <li key={r.drillId} className="flex justify-between gap-2">
                <Link href={`/drills/${r.drillId}/treinar`} className="hover:underline">
                  {drillById.get(r.drillId)?.name ?? "Drill arquivado"}
                </Link>
                <span className="text-red-400">
                  {formatPercent(r.accuracy)} em {r.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
