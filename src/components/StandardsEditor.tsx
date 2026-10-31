"use client";

import { useState, useTransition } from "react";
import { savePlanConfig, saveStandards } from "@/app/(app)/admin/standards/actions";
import type { ActionResult } from "@/lib/format";
import type { PlanConfig, StatStandard } from "@/lib/poker/plan";

interface StandardsEditorProps {
  initial: StatStandard[];
  drills: { id: string; name: string }[];
  config: PlanConfig;
}

function NumberInput({ value, onChange, step = "any" }: { value: number; onChange: (n: number) => void; step?: string }) {
  return (
    <input
      type="number"
      step={step}
      className="input"
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
    />
  );
}

export function StandardsEditor({ initial, drills, config }: StandardsEditorProps) {
  const [standards, setStandards] = useState<StatStandard[]>(initial);
  const [removed, setRemoved] = useState<string[]>([]);
  const [planConfig, setPlanConfig] = useState(config);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [configResult, setConfigResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function update(index: number, patch: Partial<StatStandard>) {
    setStandards((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function add() {
    setStandards((current) => [
      ...current,
      {
        id: `novo-${Date.now().toString(36)}`,
        statKey: "",
        label: "",
        min: 0,
        max: 0,
        margin: 0,
        priority: current.length + 1,
        drillIds: [],
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {standards.map((standard, index) => (
          <div key={standard.id} className="card space-y-3">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
              <div className="lg:col-span-2">
                <label className="label">Stat</label>
                <input
                  className="input"
                  value={standard.label}
                  placeholder="RFI BTN"
                  onChange={(e) => update(index, { label: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Chave</label>
                <input
                  className="input font-mono"
                  value={standard.statKey}
                  placeholder="rfi_btn"
                  onChange={(e) => update(index, { statKey: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Mínimo ideal</label>
                <NumberInput value={standard.min} onChange={(min) => update(index, { min })} />
              </div>
              <div>
                <label className="label">Máximo ideal</label>
                <NumberInput value={standard.max} onChange={(max) => update(index, { max })} />
              </div>
              <div>
                <label className="label">Margem</label>
                <NumberInput value={standard.margin} onChange={(margin) => update(index, { margin })} />
              </div>
              <div>
                <label className="label">Prioridade</label>
                <NumberInput step="1" value={standard.priority} onChange={(priority) => update(index, { priority })} />
              </div>
            </div>
            <div>
              <label className="label">Drills que treinam este stat</label>
              <div className="flex flex-wrap gap-2">
                {drills.length === 0 && <span className="text-sm text-zinc-500">Nenhum drill cadastrado.</span>}
                {drills.map((drill) => (
                  <label key={drill.id} className="flex items-center gap-1.5 rounded-md bg-zinc-950 px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={standard.drillIds.includes(drill.id)}
                      onChange={() =>
                        update(index, {
                          drillIds: standard.drillIds.includes(drill.id)
                            ? standard.drillIds.filter((id) => id !== drill.id)
                            : [...standard.drillIds, drill.id],
                        })
                      }
                    />
                    {drill.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>
                Fora: entre {standard.min - standard.margin} e {standard.min} ou entre {standard.max} e{" "}
                {standard.max + standard.margin}. Muito fora: além disso.
              </span>
              <button
                type="button"
                className="btn-danger px-2 py-1"
                onClick={() => {
                  if (!standard.id.startsWith("novo-")) setRemoved((r) => [...r, standard.id]);
                  setStandards((current) => current.filter((_, i) => i !== index));
                }}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={add}>
          Adicionar stat
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveStandards(standards, removed);
              setResult(r);
              if (r.ok) setRemoved([]);
            })
          }
        >
          {pending ? "Salvando..." : "Salvar standards"}
        </button>
        {result && (
          <span className={`text-sm ${result.ok ? "text-green-400" : "text-red-400"}`}>
            {result.ok ? result.message : result.error}
          </span>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Metas do plano mensal</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Máximo de focos por mês</label>
            <NumberInput
              step="1"
              value={planConfig.maxFocus}
              onChange={(maxFocus) => setPlanConfig((c) => ({ ...c, maxFocus }))}
            />
          </div>
          <div>
            <label className="label">Decisões por drill (fora)</label>
            <NumberInput
              step="1"
              value={planConfig.decisionsFora}
              onChange={(decisionsFora) => setPlanConfig((c) => ({ ...c, decisionsFora }))}
            />
          </div>
          <div>
            <label className="label">Decisões por drill (muito fora)</label>
            <NumberInput
              step="1"
              value={planConfig.decisionsMuitoFora}
              onChange={(decisionsMuitoFora) => setPlanConfig((c) => ({ ...c, decisionsMuitoFora }))}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => startTransition(async () => setConfigResult(await savePlanConfig(planConfig)))}
          >
            Salvar metas
          </button>
          {configResult && (
            <span className={`text-sm ${configResult.ok ? "text-green-400" : "text-red-400"}`}>
              {configResult.ok ? configResult.message : configResult.error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
