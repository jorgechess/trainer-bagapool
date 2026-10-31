import Link from "next/link";
import { getLegend, listStrategies, requireContentManager } from "@/lib/data";
import { rangeBreakdown } from "@/lib/poker/range";
import { BUBBLE_LABELS, STREETS, STREET_LABELS, formatNumberRange, formatRatio } from "@/lib/poker/strategy";
import { findAction } from "@/lib/poker/legend";

export default async function StrategiesPage() {
  await requireContentManager();
  const [strategies, legend] = await Promise.all([listStrategies(), getLegend()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Estratégias</h1>
          <p className="muted">Os ranges do time para cada spot. Os drills são montados a partir delas.</p>
        </div>
        <Link href="/estrategias/nova" className="btn-primary">
          Nova estratégia
        </Link>
      </div>

      {strategies.length === 0 && <p className="card muted">Nenhuma estratégia cadastrada ainda.</p>}

      {STREETS.map((street) => {
        const list = strategies.filter((s) => s.street === street);
        if (list.length === 0) return null;
        return (
          <section key={street} className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{STREET_LABELS[street]}</h2>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 text-left text-xs text-zinc-400 uppercase">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Spot</th>
                    <th className="px-3 py-2">Stack</th>
                    <th className="px-3 py-2">Proporção</th>
                    <th className="px-3 py-2">Resumo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {list.map((s) => {
                    const summary =
                      s.street === "preflop"
                        ? rangeBreakdown(s.range, s.defaultActionId)
                            .filter((b) => b.actionId !== s.defaultActionId)
                            .map((b) => `${findAction(legend, b.actionId)?.label ?? b.actionId} ${b.percent}%`)
                            .join(" · ")
                        : `${s.textureRanges.length} textura(s)`;
                    return (
                      <tr key={s.id} className="hover:bg-zinc-900/60">
                        <td className="px-3 py-2">
                          <Link href={`/estrategias/${s.id}`} className="font-medium text-orange-300 hover:underline">
                            {s.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {s.situation} · {s.heroPosition}
                          {s.villainPosition ? ` vs ${s.villainPosition}` : ""}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatNumberRange(s.stack, "bb")}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {s.ratio ? formatRatio(s.ratio) : "—"}
                          {s.bubble ? ` · ${BUBBLE_LABELS[s.bubble]}` : ""}
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{summary || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
