"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importCarga } from "@/app/(app)/admin/importar/actions";
import type { ActionResult } from "@/lib/format";

interface CargaInfo {
  id: string;
  name: string;
  description: string;
  strategies: number;
  drills: number;
  /** Quantas estratégias desta carga já estão cadastradas. */
  imported: number;
  requires: string[];
}

export function CargasList({ cargas }: { cargas: CargaInfo[] }) {
  const router = useRouter();
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-semibold">Cargas prontas</h2>
        <p className="muted">Preparadas a partir dos prints do time. Importar de novo atualiza sem duplicar.</p>
      </div>
      <ul className="divide-y divide-zinc-800">
        {cargas.map((c) => {
          const done = c.imported === c.strategies && c.strategies > 0;
          const result = results[c.id];
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`carga-${c.id}`}>
              <div className="min-w-60 flex-1">
                <p className="font-medium">
                  {c.name}{" "}
                  {done && <span className="ml-1 rounded bg-green-950 px-1.5 py-0.5 text-xs text-green-300">importada</span>}
                </p>
                <p className="text-xs text-zinc-500">
                  {c.description} {c.requires.length > 0 && `Precisa de: ${c.requires.join(", ")}.`}
                </p>
                {result && (
                  <p className={`mt-1 text-xs ${result.ok ? "text-green-400" : "text-red-400"}`}>
                    {result.ok ? result.message : result.error}
                  </p>
                )}
              </div>
              <button
                type="button"
                className={done ? "btn-secondary" : "btn-primary"}
                disabled={pending}
                onClick={() => {
                  setRunning(c.id);
                  startTransition(async () => {
                    const r = await importCarga(c.id);
                    setResults((current) => ({ ...current, [c.id]: r }));
                    setRunning(null);
                    if (r.ok) router.refresh();
                  });
                }}
              >
                {running === c.id ? "Importando..." : done ? "Importar de novo" : "Importar"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
