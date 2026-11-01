"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveDrill, saveDrill } from "@/app/(app)/drills/actions";
import {
  type Drill,
  type HandSampling,
  SAMPLING_LABELS,
  drillScope,
  drillVariants,
  strategyFamilies,
  validateDrill,
} from "@/lib/poker/drill";
import { PositionChips } from "@/components/PositionChips";
import { POSITIONS, STREET_LABELS, type Strategy } from "@/lib/poker/strategy";

interface DrillFormProps {
  drill?: Drill;
  strategies: Strategy[];
}

export function DrillForm({ drill, strategies }: DrillFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(drill?.name ?? "");
  const [description, setDescription] = useState(drill?.description ?? "");
  const [variants, setVariants] = useState<string[][]>(drill ? drillVariants(drill) : [[]]);
  const [sampling, setSampling] = useState<HandSampling>(drill?.sampling ?? "uniforme");
  const [tags, setTags] = useState((drill?.tags ?? []).join(", "));
  const [handsPerSession, setHandsPerSession] = useState(drill?.handsPerSession ?? 50);
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const strategyMap = new Map(strategies.map((s) => [s.id, s]));
  const families = strategyFamilies(strategies);
  const [familyKey, setFamilyKey] = useState(() => {
    const current = drill ? drillVariants(drill) : [];
    return (
      families.find(
        (f) => current.length > 0 && current.every((v) => v.length === 1 && Object.values(f.byPosition).includes(v[0])),
      )?.key ?? ""
    );
  });
  const [advanced, setAdvanced] = useState(() => Boolean(drill) && !familyKey);
  const family = families.find((f) => f.key === familyKey);
  const familyPositions = family ? POSITIONS.filter((p) => family.byPosition[p]) : [];
  const selectedPositions = family
    ? familyPositions.filter((p) => variants.some((v) => v.length === 1 && v[0] === family.byPosition[p]))
    : [];

  function chooseFamily(key: string) {
    setFamilyKey(key);
    const f = families.find((x) => x.key === key);
    if (!f) return;
    // Começa com todas as posições disponíveis
    setVariants(POSITIONS.filter((p) => f.byPosition[p]).map((p) => [f.byPosition[p]!]));
  }

  function choosePositions(next: string[]) {
    if (!family) return;
    setVariants(next.map((p) => [family.byPosition[p]!]).filter((v) => v[0]));
  }
  const draft: Drill = {
    id: drill?.id ?? "novo",
    name,
    description,
    steps: variants[0] ?? [],
    ...(variants.length > 1 ? { variants } : {}),
    sampling,
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    handsPerSession,
    passAccuracy: drill?.passAccuracy ?? 0.9,
  };
  const hasSteps = variants.some((v) => v.length > 0);
  const problems = hasSteps ? validateDrill(draft, strategyMap).filter((p) => !p.includes("nome")) : [];

  function setVariant(index: number, update: (steps: string[]) => string[]) {
    setVariants((current) => current.map((v, i) => (i === index ? update(v) : v)));
  }

  function move(variant: number, index: number, delta: number) {
    setVariant(variant, (current) => {
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
      const result = await saveDrill({ ...draft, id: drill?.id, variants: variants.length > 1 ? variants : undefined });
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
          <label className="label">Mãos por sessão (padrão)</label>
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
            várias = a mão continua pela linha correta até a última. Com mais de uma variação, cada mão sorteia uma
            delas (ex.: RFI de todas as posições).
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-black/30 p-3">
          <div>
            <label className="label">Spot</label>
            <select className="input" value={familyKey} onChange={(e) => chooseFamily(e.target.value)}>
              <option value="">Escolha o spot...</option>
              {families.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          {family && (
            <PositionChips
              available={familyPositions}
              selected={selectedPositions}
              onChange={choosePositions}
              allowAll={false}
            />
          )}
          {family && (
            <p className="text-xs text-zinc-500">
              Cada mão sorteia uma das posições marcadas. O jogador ainda pode filtrar as posições na hora de treinar.
            </p>
          )}
        </div>

        <button type="button" className="text-sm text-zinc-400 underline" onClick={() => setAdvanced((v) => !v)}>
          {advanced ? "Esconder modo avançado" : "Modo avançado: sequências de decisões (ex.: pré-flop até o river)"}
        </button>
        {advanced && (
          <div className="space-y-3">
        {variants.map((steps, variantIndex) => (
          <div key={variantIndex} className="space-y-2 rounded-lg border border-zinc-800 p-3">
            {variants.length > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Variação {variantIndex + 1}</span>
                <button
                  type="button"
                  className="btn-danger px-2 py-1"
                  onClick={() => setVariants((c) => c.filter((_, i) => i !== variantIndex))}
                >
                  Remover variação
                </button>
              </div>
            )}
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
                            <span className="text-baga-cream">{STREET_LABELS[s.street]}</span> · {s.name}
                          </>
                        ) : (
                          <span className="text-red-400">Estratégia removida ({id})</span>
                        )}
                      </span>
                      <button type="button" className="btn-secondary px-2 py-1" onClick={() => move(variantIndex, index, -1)}>
                        ↑
                      </button>
                      <button type="button" className="btn-secondary px-2 py-1" onClick={() => move(variantIndex, index, 1)}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn-danger px-2 py-1"
                        onClick={() => setVariant(variantIndex, (c) => c.filter((_, i) => i !== index))}
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="flex gap-2">
              <select
                className="input"
                value={toAdd[variantIndex] ?? ""}
                onChange={(e) =>
                  setToAdd((c) => {
                    const copy = [...c];
                    copy[variantIndex] = e.target.value;
                    return copy;
                  })
                }
              >
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
                disabled={!toAdd[variantIndex]}
                onClick={() => {
                  const id = toAdd[variantIndex];
                  if (!id) return;
                  setVariant(variantIndex, (c) => [...c, id]);
                  setToAdd((c) => {
                    const copy = [...c];
                    copy[variantIndex] = "";
                    return copy;
                  });
                }}
              >
                Adicionar
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => setVariants((c) => [...c, []])}>
          Adicionar variação
        </button>
          </div>
        )}
        {hasSteps && <p className="text-sm text-zinc-400">Escopo: {drillScope(draft, strategyMap)}</p>}
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
