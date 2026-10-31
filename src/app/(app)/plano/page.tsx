import Link from "next/link";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { PlanForm } from "@/components/PlanForm";
import {
  getAttempts,
  getPlan,
  listDrills,
  listPools,
  listProfiles,
  listStandards,
  requireProfile,
} from "@/lib/data";
import { currentMonth, formatPercent, monthLabel, monthStartIso } from "@/lib/format";
import { canManageContent, canViewPerformance } from "@/lib/poker/permissions";
import { STATUS_LABELS, evaluateStat, planProgress } from "@/lib/poker/plan";

function recentMonths(count: number): string[] {
  const now = currentMonth();
  const [y, m] = now.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1 - i, 1));
    return date.toISOString().slice(0, 7);
  });
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ jogador?: string; mes?: string }>;
}) {
  const viewer = await requireProfile();
  const params = await searchParams;
  const months = recentMonths(6);
  const month = params.mes && months.includes(params.mes) ? params.mes : months[0];
  const [profiles, pools, standards, drills] = await Promise.all([
    listProfiles(),
    listPools(),
    listStandards(),
    listDrills(),
  ]);
  const visible = profiles.filter((p) => p.active && canViewPerformance(viewer, p));
  const target = visible.find((p) => p.id === params.jogador) ?? viewer;
  const canEdit = target.id === viewer.id || canManageContent(viewer.role);
  const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
  const monthEnd = nextMonth.toISOString().slice(0, 7);
  const [saved, attempts] = await Promise.all([getPlan(target.id, month), getAttempts(target.id, monthStartIso(month))]);
  const monthAttempts = attempts.filter((a) => a.createdAt < monthStartIso(monthEnd));
  const progress = saved ? planProgress(saved.plan, monthAttempts) : [];
  const progressByDrill = new Map(progress.map((p) => [p.drillId, p]));
  const drillName = new Map(drills.map((d) => [d.id, d.name]));
  const poolName = new Map(pools.map((p) => [p.id, p.name]));
  const standardByKey = new Map(standards.map((s) => [s.statKey, s]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Plano do mês</h1>
        <p className="muted">
          Os stats do relatório do Hand2Note viram metas de drills. Primeiro entram os stats muito fora, depois os fora,
          sempre na ordem de prioridade do time.
        </p>
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
          <label className="label">Mês</label>
          <AutoSubmitSelect name="mes" defaultValue={month}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </AutoSubmitSelect>
        </div>
      </form>

      {saved ? (
        <section className="space-y-3">
          <h2 className="font-semibold">
            Focos de {target.name} em {monthLabel(month)}
          </h2>
          {saved.plan.focus.length === 0 && (
            <p className="card text-sm text-green-400">Todos os stats estão dentro dos standards. Nada a corrigir.</p>
          )}
          {saved.plan.focus.map((focus) => {
            const standard = standardByKey.get(focus.statKey);
            return (
              <div key={focus.statKey} className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    <span className="mr-2 text-zinc-500">#{focus.order}</span>
                    {focus.label}
                  </p>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      focus.status === "muito-fora" ? "bg-red-900 text-red-100" : "bg-amber-900 text-amber-100"
                    }`}
                  >
                    {STATUS_LABELS[focus.status]} · {focus.direction === "abaixo" ? "abaixo" : "acima"}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">
                  Valor: {focus.value}
                  {standard && ` · ideal ${standard.min} a ${standard.max}`}
                </p>
                {focus.goals.length === 0 ? (
                  <p className="text-sm text-amber-400">Nenhum drill ligado a este stat. Ligue drills em Standards.</p>
                ) : (
                  <ul className="space-y-2">
                    {focus.goals.map((goal) => {
                      const p = progressByDrill.get(goal.drillId);
                      const done = p?.done ?? 0;
                      return (
                        <li key={goal.drillId}>
                          <div className="mb-1 flex justify-between gap-2 text-sm">
                            <Link href={`/drills/${goal.drillId}/treinar`} className="hover:underline">
                              {drillName.get(goal.drillId) ?? `${goal.drillId} (arquivado)`}
                            </Link>
                            <span className="text-zinc-400">
                              {done}/{goal.targetDecisions} decisões
                              {done > 0 && p ? ` · ${formatPercent(p.accuracy)}` : ""}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={`h-full ${done >= goal.targetDecisions ? "bg-green-500" : "bg-baga-red"}`}
                              style={{ width: `${Math.min(100, (done / goal.targetDecisions) * 100)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          {saved.plan.missing.length > 0 && (
            <p className="text-sm text-zinc-500">Sem valor no relatório: {saved.plan.missing.join(", ")}.</p>
          )}
          <details className="card">
            <summary className="cursor-pointer text-sm font-medium">Todos os stats do relatório</summary>
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-zinc-800">
                {standards.map((standard) => {
                  const value = saved.stats[standard.statKey];
                  if (value === undefined) return null;
                  const evaluation = evaluateStat(standard, value);
                  return (
                    <tr key={standard.id}>
                      <td className="py-1.5 pr-2">{standard.label}</td>
                      <td className="py-1.5 pr-2 text-right">{value}</td>
                      <td className="py-1.5 pr-2 text-right text-zinc-500">
                        {standard.min}–{standard.max}
                      </td>
                      <td
                        className={`py-1.5 text-right ${
                          evaluation.status === "dentro"
                            ? "text-green-400"
                            : evaluation.status === "fora"
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {STATUS_LABELS[evaluation.status]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </section>
      ) : (
        <p className="card muted">Nenhum plano salvo para {monthLabel(month)}.</p>
      )}

      {canEdit && (
        <section className="card space-y-3">
          <h2 className="font-semibold">{saved ? "Atualizar stats do relatório" : "Montar plano"}</h2>
          {standards.length === 0 ? (
            <p className="muted">Cadastre os standards do time primeiro (menu Standards).</p>
          ) : (
            <PlanForm userId={target.id} month={month} standards={standards} initial={saved?.stats ?? {}} />
          )}
        </section>
      )}
    </div>
  );
}
