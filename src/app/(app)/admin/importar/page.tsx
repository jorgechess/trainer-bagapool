import { CargasList } from "@/components/CargasList";
import { ImportForm } from "@/components/ImportForm";
import { CARGAS } from "@/lib/cargas";
import { getLegend, listStrategies, requireContentManager } from "@/lib/data";

export default async function ImportPage() {
  await requireContentManager();
  const [legend, strategies] = await Promise.all([getLegend(), listStrategies()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Importar estratégias e drills</h1>
        <p className="muted">
          Para a carga inicial: cole um JSON com estratégias (ranges em notação de texto) e drills. Itens com o mesmo
          id são substituídos, então dá para importar de novo depois de corrigir.
        </p>
      </div>
      <CargasList
        cargas={CARGAS.map((c) => {
          const bundle = c.bundle as { strategies?: { id: string }[]; drills?: unknown[] };
          const ids = new Set(strategies.map((s) => s.id));
          const imported = (bundle.strategies ?? []).filter((s) => ids.has(s.id)).length;
          return {
            id: c.id,
            name: c.name,
            description: c.description,
            strategies: bundle.strategies?.length ?? 0,
            drills: bundle.drills?.length ?? 0,
            imported,
            requires: c.requires.map((r) => CARGAS.find((x) => x.id === r)?.name ?? r),
          };
        })}
      />
      <div>
        <h2 className="font-semibold">Importar outro arquivo</h2>
        <p className="muted">Cole um JSON ou abra um arquivo .json.</p>
      </div>
      {/* Só o necessário para conferir referências (enviar todos os ranges deixa a página pesada demais) */}
      <ImportForm
        legend={legend}
        strategies={strategies.map((s) => ({
          id: s.id,
          name: s.name,
          street: s.street,
          situation: s.situation,
          heroPosition: s.heroPosition,
          villainPosition: s.villainPosition ?? null,
          stack: s.stack,
          tags: [],
          actionIds: s.actionIds,
          defaultActionId: s.defaultActionId,
          dealFrom: s.dealFrom ?? null,
          range: {},
          textureRanges: [],
        }))}
      />
    </div>
  );
}
