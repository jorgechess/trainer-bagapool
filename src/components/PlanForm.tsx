"use client";

import { useState, useTransition } from "react";
import { savePlan } from "@/app/(app)/plano/actions";
import { type StatStandard, STATUS_LABELS, evaluateStat } from "@/lib/poker/plan";

interface PlanFormProps {
  userId: string;
  month: string;
  standards: StatStandard[];
  initial: Record<string, number>;
}

export function PlanForm({ userId, month, standards, initial }: PlanFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(standards.map((s) => [s.statKey, initial[s.statKey]?.toString() ?? ""])),
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const numeric: Record<string, number> = {};
    for (const [key, raw] of Object.entries(values)) {
      if (raw.trim() === "") continue;
      const n = Number(raw.replace(",", "."));
      if (Number.isFinite(n)) numeric[key] = n;
    }
    startTransition(async () => {
      const result = await savePlan(userId, month, numeric);
      setMessage(result.ok ? { ok: true, text: "Plano salvo." } : { ok: false, text: result.error });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="muted">
        Digite os valores do popup. A leitura automática do print do Hand2Note fica para a próxima etapa, quando
        tivermos exemplos do popup do time.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {standards.map((standard) => {
          const raw = values[standard.statKey] ?? "";
          const n = Number(raw.replace(",", "."));
          const evaluation = raw.trim() !== "" && Number.isFinite(n) ? evaluateStat(standard, n) : null;
          return (
            <div key={standard.id}>
              <label className="label">
                {standard.label} <span className="normal-case text-zinc-600">(ideal {standard.min}–{standard.max})</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  inputMode="decimal"
                  value={raw}
                  onChange={(e) => setValues((v) => ({ ...v, [standard.statKey]: e.target.value }))}
                />
                {evaluation && (
                  <span
                    className={`text-xs whitespace-nowrap ${
                      evaluation.status === "dentro"
                        ? "text-green-400"
                        : evaluation.status === "fora"
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {STATUS_LABELS[evaluation.status]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {message && <p className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Gerando..." : "Gerar plano"}
      </button>
    </form>
  );
}
