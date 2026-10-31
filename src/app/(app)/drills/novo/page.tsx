import { DrillForm } from "@/components/DrillForm";
import { listStrategies, requireContentManager } from "@/lib/data";

export default async function NewDrillPage() {
  await requireContentManager();
  const strategies = await listStrategies();
  return (
    <div className="space-y-6">
      <h1 className="page-title">Novo drill</h1>
      {strategies.length === 0 ? (
        <p className="card muted">Cadastre pelo menos uma estratégia antes de criar um drill.</p>
      ) : (
        <DrillForm strategies={strategies} />
      )}
    </div>
  );
}
