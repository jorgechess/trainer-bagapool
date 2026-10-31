import { StrategyEditor } from "@/components/StrategyEditor";
import { getLegend, listStrategies, requireContentManager } from "@/lib/data";

export default async function NewStrategyPage() {
  await requireContentManager();
  const [legend, strategies] = await Promise.all([getLegend(), listStrategies()]);
  return (
    <div className="space-y-6">
      <h1 className="page-title">Nova estratégia</h1>
      <StrategyEditor legend={legend} strategies={strategies} />
    </div>
  );
}
