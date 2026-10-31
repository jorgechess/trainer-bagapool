"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveDrill, saveDrill } from "@/app/(app)/drills/actions";
import { type Drill, type HandSampling, SAMPLING_LABELS, drillScope, validateDrill } from "@/lib/poker/drill";
import { STREET_LABELS, type Strategy } from "@/lib/poker/strategy";

interface DrillFormProps {
  drill?: Drill;
  strategies: Strategy[];
}

export function DrillForm({ drill, strategies }: DrillFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(drill?.name ?? "");
  const [description, setDescription] = useState(drill?.description ?? "");
  const [steps, setSteps] = useState<string[]>(drill?.steps ?? []);
  const [sampling, setSampling] = useState<HandSampling>(drill?.sampling ?? "uniforme");
  const [tags, setTags] = useState((drill?.tags ?? []).join(", "));
  const [handsPerSession, setHandsPerSession] = useState(drill?.handsPerSession ?? 50);
  const [passPercent, setPassPercent] = useState(Math.round((drill?.passAccuracy ?? 0.9) * 100));
  const [toAdd, setToAdd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const strategyMap = new Map(strategies.map((s) => [s.id, s]));
  const draft: Drill = {
    id: drill?.id ?? "novo",
    name,
    description,
    steps,
    sampling,
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    handsPerSession,
    passAccuracy: passPercent / 100,
  };
  const problems = steps.length ? validateDrill(draft, strategyMap).filter((p) => !p.includes("nome")) : [];

  function move(index: number, delta: number) {
    setSteps((current) => {
      const copy = [...current];
      const target = index + delta;
      if (target < 0 || target >= copy.length) return current;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveDrill({ ...draft, id: drill?.id });
      if (!result.ok) setError(result.error);
      else router.push("/drills");
    });
  }

  function archive() {
    if (!drill || !confirm("Arquivar este drill? O histórico de treinos é mantido.")) return;
    startTransition(async () => {
      const result = await archiveDrill(drill.id);
      if (!result.ok) setError(result.error);
      else router.push("/drills");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Descrição (opcional)</label>
          <textarea
            className="input min-h-20"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Mãos por sessão</label>
          <input
            type="number"
            min={1}
            max={500}
            className="input"
            value={handsPerSession}
            onChange={(e) => setHandsPerSession(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Acerto mínimo (%)</label>
          <input
            type="number"
            min={1}
            max={100}
            className="input"
            value={passPercent}
            onChange={(e) => setPassPercent(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Sorteio das mãos</label>
          <select className="input" value={sampling} onChange={(e) => setSampling(e.target.value as HandSampling)}>
            {Object.entries(SAMPLING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Etiquetas (separadas por vírgula)</label>
          <input
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="max-late, bolha"
          />
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold">Decisões do drill</h2>
          <p className="muted">
            Escolha as estratégias na ordem em que as decisões acontecem. Uma estratégia só = treino de uma ação;
            várias = a mão continua pela linha correta até a última.
          </p>
        </div>
        {steps.length > 0 && (
          <ol className="space-y-2">
            {steps.map((id, index) => {
              const s = strategyMap.get(id);
              return (
                <li key={`${id}-${index}`} className="flex items-center gap-2 rounded-lg bg-zinc-950 p-2">
                  <span className="w-6 text-center text-sm text-zinc-500">{index + 1}</span>
                  <span className="flex-1 text-sm">
                    {s ? (
                      <>
                        <span className="text-orange-300">{STREET_LABELS[s.street]}</span> · {s.name}
                      </>
                    ) : (
                      <span className="text-red-400">Estratégia removida ({id})</span>
                    )}
                  </span>
                  <button type="button" className="btn-secondary px-2 py-1" onClick={() => move(index, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn-secondary px-2 py-1" onClick={() => move(index, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-danger px-2 py-1"
                    onClick={() => setSteps((c) => c.filter((_, i) => i !== index))}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <div className="flex gap-2">
          <select className="input" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
            <option value="">Escolha uma estratégia...</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {STREET_LABELS[s.street]} · {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            disabled={!toAdd}
            onClick={() => {
              setSteps((c) => [...c, toAdd]);
              setToAdd("");
            }}
          >
            Adicionar
          </button>
        </div>
        {steps.length > 0 && <p className="text-sm text-zinc-400">Escopo: {drillScope(draft, strategyMap)}</p>}
        {problems.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-amber-400">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando..." : "Salvar drill"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancelar
        </button>
        {drill && (
          <button type="button" className="btn-danger ml-auto" onClick={archive} disabled={pending}>
            Arquivar
          </button>
        )}
      </div>
    </form>
  );
}
