import { LegendEditor } from "@/components/LegendEditor";
import { getLegend, requireContentManager } from "@/lib/data";

export default async function LegendPage() {
  await requireContentManager();
  const legend = await getLegend();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Legenda de cores</h1>
        <p className="muted">
          Cada ação e cada sizing tem uma cor própria. Escolha cores bem diferentes entre si para facilitar a leitura
          das estratégias com vários sizings.
        </p>
      </div>
      <LegendEditor initial={legend} />
    </div>
  );
}
