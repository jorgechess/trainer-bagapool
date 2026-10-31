import { ImportForm } from "@/components/ImportForm";
import { getLegend, requireContentManager } from "@/lib/data";

export default async function ImportPage() {
  await requireContentManager();
  const legend = await getLegend();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Importar estratégias e drills</h1>
        <p className="muted">
          Para a carga inicial: cole um JSON com estratégias (ranges em notação de texto) e drills. Itens com o mesmo
          id são substituídos, então dá para importar de novo depois de corrigir.
        </p>
      </div>
      <ImportForm legend={legend} />
    </div>
  );
}
