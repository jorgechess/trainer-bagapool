import { StandardsEditor } from "@/components/StandardsEditor";
import { getPlanConfig, listDrills, listStandards, requireContentManager } from "@/lib/data";

export default async function StandardsPage() {
  await requireContentManager();
  const [standards, drills, config] = await Promise.all([listStandards(), listDrills(), getPlanConfig()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Standards do time</h1>
        <p className="muted">
          Faixa ideal de cada stat do popup, a margem até virar &quot;muito fora&quot;, a prioridade (1 = mais
          importante) e os drills que treinam o stat.
        </p>
      </div>
      <StandardsEditor initial={standards} drills={drills.map((d) => ({ id: d.id, name: d.name }))} config={config} />
    </div>
  );
}
