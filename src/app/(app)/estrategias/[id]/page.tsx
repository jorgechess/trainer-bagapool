import { notFound } from "next/navigation";
import { StrategyEditor } from "@/components/StrategyEditor";
import { getLegend, getStrategy, listStrategies, requireContentManager } from "@/lib/data";

export default async function EditStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireContentManager();
  const { id } = await params;
  const [strategy, legend, strategies] = await Promise.all([getStrategy(id), getLegend(), listStrategies()]);
  if (!strategy) notFound();
  return (
    <div className="space-y-6">
      <h1 className="page-title">{strategy.name}</h1>
      <StrategyEditor legend={legend} strategy={strategy} strategies={strategies} />
    </div>
  );
}
