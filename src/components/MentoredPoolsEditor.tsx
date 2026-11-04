"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveMentoredPools } from "@/app/(app)/desempenho/actions";
import { PoolChip, type PoolLook } from "@/components/PoolBadge";

type PoolOption = PoolLook & { id: string };

/** Escolha das pools que o mentor acompanha. */
export function MentoredPoolsEditor({ pools, selected }: { pools: PoolOption[]; selected: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(selected.length === 0);
  const [chosen, setChosen] = useState<string[]>(selected);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mine = pools.filter((p) => selected.includes(p.id));

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="card space-y-3" data-testid="minhas-pools">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label mb-0">Pools que você mentora</p>
        {!editing && (
          <button type="button" className="btn-secondary text-xs" onClick={() => setEditing(true)}>
            Editar pools
          </button>
        )}
      </div>
      {!editing ? (
        <div className="flex flex-wrap gap-2">
          {mine.map((p) => (
            <PoolChip key={p.id} pool={p} />
          ))}
        </div>
      ) : (
        <>
          <p className="muted text-sm">Marque as pools que você acompanha. A visão de desempenho mostra cada uma delas.</p>
          <div className="flex flex-wrap gap-2">
            {pools.map((p) => {
              const on = chosen.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  data-testid="pool-opcao"
                  onClick={() => toggle(p.id)}
                  className={`rounded-full transition ${on ? "opacity-100 ring-2 ring-baga-cream/70" : "opacity-40 hover:opacity-80"}`}
                >
                  <PoolChip pool={p} />
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const r = await saveMentoredPools(chosen);
                  if (!r.ok) return setError(r.error);
                  setEditing(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Salvando..." : "Salvar pools"}
            </button>
            {selected.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setChosen(selected);
                  setEditing(false);
                }}
              >
                Cancelar
              </button>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
