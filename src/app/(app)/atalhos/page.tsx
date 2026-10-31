import { ShortcutsEditor } from "@/components/ShortcutsEditor";
import { getLegend, requireProfile } from "@/lib/data";

export default async function ShortcutsPage() {
  await requireProfile();
  const legend = await getLegend();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">Atalhos</h1>
        <p className="muted">
          Escolha uma tecla ou um botão do mouse para cada ação do treino. Os atalhos ficam salvos neste navegador e
          valem só para você.
        </p>
      </div>
      <ShortcutsEditor legend={legend} />
    </div>
  );
}
