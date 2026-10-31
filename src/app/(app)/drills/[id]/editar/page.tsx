import { notFound } from "next/navigation";
import { DrillForm } from "@/components/DrillForm";
import { getDrill, listStrategies, requireContentManager } from "@/lib/data";

export default async function EditDrillPage({ params }: { params: Promise<{ id: string }> }) {
  await requireContentManager();
  const { id } = await params;
  const [drill, strategies] = await Promise.all([getDrill(id), listStrategies()]);
  if (!drill) notFound();
  return (
    <div className="space-y-6">
      <h1 className="page-title">Editar drill</h1>
      <DrillForm drill={drill} strategies={strategies} />
    </div>
  );
}
