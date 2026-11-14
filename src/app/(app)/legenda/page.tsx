import { LegendEditor } from "@/components/LegendEditor";
import { getLegend, requireAdmin } from "@/lib/data";

export default async function LegendPage() {
  // Só o admin mexe nas cores da legenda
  await requireAdmin();
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
