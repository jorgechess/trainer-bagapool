import Link from "next/link";
import { listDrills, listStrategies, requireProfile } from "@/lib/data";
import { drillScope, drillVariants, spotSummary } from "@/lib/poker/drill";
import { canManageContent } from "@/lib/poker/permissions";

export default async function DrillsPage() {
  const profile = await requireProfile();
  const [drills, strategyList] = await Promise.all([listDrills(), listStrategies()]);
  const strategies = new Map(strategyList.map((s) => [s.id, s]));
  const manager = canManageContent(profile.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Drills</h1>
          <p className="muted">Escolha um drill e treine as estratégias do time.</p>
        </div>
        {manager && (
          <Link href="/drills/novo" className="btn-primary">
            Novo drill
          </Link>
        )}
      </div>

      {drills.length === 0 ? (
        <div className="card muted">
          Nenhum drill cadastrado ainda.
          {manager && " Cadastre as estratégias e depois crie um drill, ou use a tela Importar."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drills.map((drill) => {
            const variants = drillVariants(drill);
            const first = strategies.get(variants[0]?.[0] ?? "");
            const firstPositions = [
              ...new Set(variants.map((v) => strategies.get(v[0] ?? "")?.heroPosition).filter(Boolean)),
            ];
            return (
              <div key={drill.id} className="card flex flex-col gap-3">
                <div>
                  <h2 className="font-semibold">{drill.name}</h2>
                  {drill.description && <p className="muted mt-1">{drill.description}</p>}
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-400">Spot inicial</dt>
                    <dd className="text-right">
                      {variants.length > 1
                        ? `${first?.situation ?? ""} · ${firstPositions.join(", ")} (sorteado)`
                        : first
                          ? spotSummary(first)
                          : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-400">Escopo</dt>
                    <dd>{drillScope(drill, strategies)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-400">Sessão</dt>
                    <dd>{drill.handsPerSession} mãos</dd>
                  </div>
                </dl>
                {drill.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {drill.tags.map((tag) => (
                      <span key={tag} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex gap-2 pt-2">
                  <Link href={`/drills/${drill.id}/treinar`} className="btn-primary flex-1">
                    Treinar
                  </Link>
                  {manager && (
                    <Link href={`/drills/${drill.id}/editar`} className="btn-secondary">
                      Editar
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
