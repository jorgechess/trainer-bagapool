"use client";

import { useState, useTransition } from "react";
import { saveLegend } from "@/app/(app)/legenda/actions";
import { ACTION_KINDS, ACTION_KIND_LABELS, type ActionKind, type Legend, textColorFor, validateLegend } from "@/lib/poker/legend";
import { slugify } from "@/lib/poker/importer";

export function LegendEditor({ initial }: { initial: Legend }) {
  const [legend, setLegend] = useState<Legend>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const problems = validateLegend(legend);

  function update(index: number, patch: Partial<Legend[number]>) {
    setLegend((current) => current.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function add() {
    const used = new Set(legend.map((a) => a.color.toLowerCase()));
    const palette = ["#06b6d4", "#84cc16", "#f43f5e", "#8b5cf6", "#14b8a6", "#fb923c", "#facc15", "#0ea5e9"];
    const color = palette.find((c) => !used.has(c)) ?? "#ffffff";
    setLegend((current) => [...current, { id: `acao-${current.length + 1}`, label: "Nova ação", color, kind: "bet" }]);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveLegend(legend);
      setMessage(result.ok ? { ok: true, text: "Legenda salva." } : { ok: false, text: result.error });
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {legend.map((action, index) => (
          <div key={index} className="card grid items-end gap-3 sm:grid-cols-[auto_1fr_1fr_1fr_1fr_auto]">
            <div>
              <label className="label">Cor</label>
              <input
                type="color"
                className="h-10 w-14 cursor-pointer rounded border border-zinc-700 bg-transparent"
                value={action.color}
                onChange={(e) => update(index, { color: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Nome</label>
              <input
                className="input"
                value={action.label}
                onChange={(e) => update(index, { label: e.target.value })}
                onBlur={() => {
                  if (/^acao-\d+$/.test(action.id) && action.label.trim())
                    update(index, { id: slugify(action.label) || action.id });
                }}
              />
            </div>
            <div>
              <label className="label">Identificador</label>
              <input
                className="input font-mono"
                value={action.id}
                onChange={(e) => update(index, { id: e.target.value.toLowerCase() })}
                disabled={initial.some((a) => a.id === action.id)}
                title="O identificador não muda depois de salvo, porque as estratégias usam ele."
              />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select
                className="input"
                value={action.kind}
                onChange={(e) => update(index, { kind: e.target.value as ActionKind })}
              >
                {ACTION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {ACTION_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sizing (opcional)</label>
              <input
                className="input"
                value={action.sizing ?? ""}
                onChange={(e) => update(index, { sizing: e.target.value })}
                placeholder="33%, 2.2bb..."
              />
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-md px-2 py-2 text-xs font-semibold whitespace-nowrap"
                style={{ backgroundColor: action.color, color: textColorFor(action.color) }}
              >
                {action.label || "?"}
              </span>
              <button
                type="button"
                className="btn-danger px-2 py-2"
                onClick={() => setLegend((current) => current.filter((_, i) => i !== index))}
                aria-label="Remover ação"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      {problems.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-amber-400">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {message && <p className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={add}>
          Adicionar ação
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={pending || problems.length > 0}>
          {pending ? "Salvando..." : "Salvar legenda"}
        </button>
      </div>
    </div>
  );
}
