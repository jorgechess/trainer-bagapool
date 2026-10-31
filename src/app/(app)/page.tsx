import Link from "next/link";
import { getAttempts, getPlan, listDrills, requireProfile } from "@/lib/data";
import { currentMonth, formatPercent, monthLabel, monthStartIso } from "@/lib/format";
import { overallAccuracy, findLeaks, DIMENSION_LABELS } from "@/lib/poker/leaks";
import { planProgress } from "@/lib/poker/plan";
import { ROLE_LABELS } from "@/lib/poker/permissions";

export default async function HomePage() {
  const profile = await requireProfile();
  const month = currentMonth();
  const [monthAttempts, plan, drills] = await Promise.all([
    getAttempts(profile.id, monthStartIso(month)),
    getPlan(profile.id, month),
    listDrills(),
  ]);
  const drillName = new Map(drills.map((d) => [d.id, d.name]));
  const stats = overallAccuracy(monthAttempts);
  const progress = plan ? planProgress(plan.plan, monthAttempts) : [];
  const leaks = findLeaks(monthAttempts).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Olá, {profile.name.split(" ")[0]}</h1>
        <p className="muted">
          {ROLE_LABELS[profile.role]} · resumo de {monthLabel(month)}
        </p>
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
          <Link href="/plano" className="text-sm text-orange-400 hover:underline">
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
                    className={`h-full ${goal.completed ? "bg-green-500" : "bg-orange-500"}`}
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
          <h2 className="font-semibold">Principais leaks do mês</h2>
          <Link href="/desempenho" className="text-sm text-orange-400 hover:underline">
            Ver desempenho
          </Link>
        </div>
        {leaks.length === 0 ? (
          <p className="muted">Nenhum leak com amostra suficiente (mínimo de 20 decisões por grupo).</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {leaks.map((leak) => (
              <li key={`${leak.dimension}-${leak.key}`} className="flex justify-between">
                <span>
                  <span className="text-zinc-400">{DIMENSION_LABELS[leak.dimension]}:</span> {leak.key}
                </span>
                <span className="text-red-400">
                  {formatPercent(leak.accuracy)} em {leak.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
