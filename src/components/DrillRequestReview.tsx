"use client";

import { useState, useTransition } from "react";
import { reviewDrillRequest } from "@/app/(app)/drills/novo/actions";

const OPTIONS: [string, string][] = [
  ["novo", "Novo"],
  ["em_analise", "Em análise"],
  ["aprovado", "Aprovado"],
  ["feito", "Feito"],
  ["recusado", "Recusado"],
];

/** Análise semanal: status e resposta para quem pediu. */
export function DrillRequestReview({ id, status, reply }: { id: string; status: string; reply: string | null }) {
  const [value, setValue] = useState(status);
  const [text, setText] = useState(reply ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await reviewDrillRequest({ id, status: value as "novo", reply: text });
          setMessage(result.ok ? "Salvo." : result.error);
        });
      }}
      data-testid="analise-pedido"
    >
      <label className="space-y-1">
        <span className="label">Status</span>
        <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
          {OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-60 flex-1 space-y-1">
        <span className="label">Resposta para quem pediu</span>
        <input className="input w-full" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
      </label>
      <button className="btn-secondary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </button>
      {message && <span className="text-xs text-zinc-400">{message}</span>}
    </form>
  );
}
