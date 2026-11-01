import Link from "next/link";
import { listDrills, listStrategies, requireProfile } from "@/lib/data";
import { DrillsBrowser } from "@/components/DrillsBrowser";
import { drillVariants, spotSummary } from "@/lib/poker/drill";
import { drillSection } from "@/lib/poker/sections";
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
        <DrillsBrowser
          drills={drills.map((drill) => {
            const variants = drillVariants(drill);
            const first = strategies.get(variants[0]?.[0] ?? "");
            const firstPositions = [
              ...new Set(variants.map((v) => strategies.get(v[0] ?? "")?.heroPosition).filter(Boolean)),
            ];
            return {
              id: drill.id,
              name: drill.name,
              description: drill.description,
              spot:
                variants.length > 1
                  ? `${first?.situation ?? ""} · ${firstPositions.join(", ")} (sorteado)`
                  : first
                    ? spotSummary(first)
                    : "—",
              tags: drill.tags,
              handsPerSession: drill.handsPerSession,
              section: drillSection(drill, strategies),
            };
          })}
        />
      )}
    </div>
  );
}
