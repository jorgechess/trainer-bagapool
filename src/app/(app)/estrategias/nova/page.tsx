import { StrategyEditor } from "@/components/StrategyEditor";
import { getLegend, requireContentManager } from "@/lib/data";

export default async function NewStrategyPage() {
  await requireContentManager();
  const legend = await getLegend();
  return (
    <div className="space-y-6">
      <h1 className="page-title">Nova estratégia</h1>
      <StrategyEditor legend={legend} />
    </div>
  );
}
