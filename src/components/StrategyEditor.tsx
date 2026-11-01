"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteStrategy, saveStrategy } from "@/app/(app)/estrategias/actions";
import { RangePainter } from "@/components/RangePainter";
import type { Legend } from "@/lib/poker/legend";
import {
  BUBBLE_LABELS,
  type BubbleContext,
  POSITIONS,
  type Position,
  STREETS,
  STREET_LABELS,
  type Street,
  type Strategy,
  type TextureRange,
  pruneAlsoCorrect,
  validateStrategy,
} from "@/lib/poker/strategy";
import {
  CARD_CLASSES,
  CARD_CLASS_LABELS,
  type CardClass,
  PAIR_TEXTURE_LABELS,
  type PairTexture,
  SUIT_TEXTURE_LABELS,
  type SuitTexture,
  type TextureMatch,
} from "@/lib/poker/texture";

function emptyStrategy(legend: Legend): Strategy {
  const ids = legend.map((a) => a.id);
  const actionIds = ["fold", "rfi", "shove"].filter((id) => ids.includes(id));
  const finalIds = actionIds.length >= 2 ? actionIds : ids.slice(0, 2);
  return {
    id: "",
    name: "",
    street: "preflop",
    situation: "RFI",
    heroPosition: "BTN",
    villainPosition: null,
    stack: { min: 0, max: 15 },
    ratio: null,
    bubble: null,
    tags: [],
    actionIds: finalIds,
    defaultActionId: finalIds[0] ?? "",
    entryActionIds: [],
    range: {},
    textureRanges: [],
  };
}

function toggle<T>(list: readonly T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function CheckGroup<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T[] | undefined;
  onChange: (value: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-1.5 rounded-md bg-zinc-950 px-2 py-1 text-xs">
          <input type="checkbox" checked={value?.includes(option) ?? false} onChange={() => onChange(toggle(value, option))} />
          {labels[option]}
        </label>
      ))}
    </div>
  );
}

function TextureMatchEditor({ match, onChange }: { match: TextureMatch; onChange: (m: TextureMatch) => void }) {
  const [patterns, setPatterns] = useState((match.patterns ?? []).join(", "));
  const classLabels = CARD_CLASS_LABELS as Record<CardClass, string>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Padrões do flop (A = ás, H = high, M = mid, L = low, * = qualquer)</label>
        <input
          className="input font-mono"
          placeholder="H-M-L, L-L-L, A-*-*"
          value={patterns}
          onChange={(e) => {
            setPatterns(e.target.value);
            onChange({
              ...match,
              patterns: e.target.value
                .split(",")
                .map((p) => p.trim().toUpperCase())
                .filter(Boolean),
            });
          }}
        />
      </div>
      <div>
        <label className="label">Naipes</label>
        <CheckGroup
          options={["monotone", "twotone", "rainbow"] as SuitTexture[]}
          labels={SUIT_TEXTURE_LABELS}
          value={match.suits}
          onChange={(suits) => onChange({ ...match, suits })}
        />
      </div>
      <div>
        <label className="label">Pareado</label>
        <CheckGroup
          options={["nao", "pareado", "trinca"] as PairTexture[]}
          labels={PAIR_TEXTURE_LABELS}
          value={match.paired}
          onChange={(paired) => onChange({ ...match, paired })}
        />
      </div>
      <div>
        <label className="label">Carta dobrada</label>
        <CheckGroup
          options={CARD_CLASSES}
          labels={classLabels}
          value={match.pairedClass}
          onChange={(pairedClass) => onChange({ ...match, pairedClass })}
        />
      </div>
      <div>
        <label className="label">Carta do turn</label>
        <CheckGroup
          options={CARD_CLASSES}
          labels={classLabels}
          value={match.turnClass}
          onChange={(turnClass) => onChange({ ...match, turnClass })}
        />
      </div>
      <div>
        <label className="label">Carta do river</label>
        <CheckGroup
          options={CARD_CLASSES}
          labels={classLabels}
          value={match.riverClass}
          onChange={(riverClass) => onChange({ ...match, riverClass })}
        />
      </div>
    </div>
  );
}

export function StrategyEditor({
  legend,
  strategy,
  strategies = [],
}: {
  legend: Legend;
  strategy?: Strategy;
  /** Outras estratégias, para "sortear só do range de". */
  strategies?: Strategy[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [s, setS] = useState<Strategy>(strategy ?? emptyStrategy(legend));
  const [tags, setTags] = useState((strategy?.tags ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);
  const isNew = !strategy;

  const update = (patch: Partial<Strategy>) => setS((current) => ({ ...current, ...patch }));
  const draft: Strategy = {
    ...s,
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
  const problems = validateStrategy(draft, legend).filter((p) => !p.includes("nome"));

  function setTexture(index: number, patch: Partial<TextureRange>) {
    update({ textureRanges: s.textureRanges.map((tr, i) => (i === index ? { ...tr, ...patch } : tr)) });
  }

  function moveTexture(index: number, delta: number) {
    const copy = [...s.textureRanges];
    const target = index + delta;
    if (target < 0 || target >= copy.length) return;
    [copy[index], copy[target]] = [copy[target], copy[index]];
    update({ textureRanges: copy });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveStrategy(draft, isNew);
      if (!result.ok) setError(result.error);
      else router.push("/estrategias");
    });
  }

  function remove() {
    if (!strategy || !confirm("Excluir esta estratégia?")) return;
    startTransition(async () => {
      const result = await deleteStrategy(strategy.id);
      if (!result.ok) setError(result.error);
      else router.push("/estrategias");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Nome</label>
          <input
            className="input"
            value={s.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="RFI BTN max late 2:1"
            required
          />
        </div>
        <div>
          <label className="label">Situação</label>
          <input
            className="input"
            value={s.situation}
            onChange={(e) => update({ situation: e.target.value })}
            placeholder="RFI, vs RFI, Cbet, Probe turn..."
            list="situacoes"
          />
          <datalist id="situacoes">
            {["RFI", "vs RFI", "vs 3-bet", "Flat", "Squeeze", "Cbet", "Segundo barril", "Probe turn", "Probe river"].map(
              (v) => (
                <option key={v} value={v} />
              ),
            )}
          </datalist>
        </div>
        <div>
          <label className="label">Street</label>
          <select
            className="input"
            value={s.street}
            onChange={(e) => update({ street: e.target.value as Street })}
          >
            {STREETS.map((street) => (
              <option key={street} value={street}>
                {STREET_LABELS[street]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Posição do herói</label>
          <select
            className="input"
            value={s.heroPosition}
            onChange={(e) => update({ heroPosition: e.target.value as Position })}
          >
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Vilão (opcional)</label>
          <select
            className="input"
            value={s.villainPosition ?? ""}
            onChange={(e) => update({ villainPosition: (e.target.value || null) as Position | null })}
          >
            <option value="">—</option>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Stack mínimo (bb)</label>
          <input
            type="number"
            step="0.5"
            className="input"
            value={s.stack.min}
            onChange={(e) => update({ stack: { ...s.stack, min: Number(e.target.value) } })}
          />
        </div>
        <div>
          <label className="label">Stack máximo (bb)</label>
          <input
            type="number"
            step="0.5"
            className="input"
            value={s.stack.max}
            onChange={(e) => update({ stack: { ...s.stack, max: Number(e.target.value) } })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">
            <input
              type="checkbox"
              className="mr-2 align-middle"
              checked={s.ratio != null}
              onChange={(e) => update({ ratio: e.target.checked ? { min: 2, max: 2 } : null })}
            />
            Proporção jogadores : premiados
          </label>
          {s.ratio && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min={1}
                className="input"
                value={s.ratio.min}
                onChange={(e) => update({ ratio: { ...s.ratio!, min: Number(e.target.value) } })}
              />
              <span className="text-zinc-400">a</span>
              <input
                type="number"
                step="0.1"
                min={1}
                className="input"
                value={s.ratio.max}
                onChange={(e) => update({ ratio: { ...s.ratio!, max: Number(e.target.value) } })}
              />
              <span className="text-zinc-400">: 1</span>
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label">Bolha</label>
          <select
            className="input"
            value={s.bubble ?? ""}
            onChange={(e) => update({ bubble: (e.target.value || null) as BubbleContext | null })}
          >
            <option value="">Não se aplica</option>
            {Object.entries(BUBBLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">PKO (bounty)</label>
          <select
            className="input"
            value={s.pko?.coverage ?? ""}
            onChange={(e) =>
              update({
                pko: e.target.value ? { ...(s.pko ?? {}), coverage: e.target.value as "cobrindo" | "coberto" } : null,
              })
            }
          >
            <option value="">Não é PKO</option>
            <option value="cobrindo">PKO · herói cobrindo</option>
            <option value="coberto">PKO · herói coberto</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Etiqueta de bounty (opcional)</label>
          <input
            className="input"
            placeholder="$10.00"
            disabled={!s.pko}
            value={s.pko?.bounty ?? ""}
            onChange={(e) => s.pko && update({ pko: { ...s.pko, bounty: e.target.value } })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label">Etiquetas (separadas por vírgula)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="max-late, rfi" />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label">Descrição (opcional)</label>
          <textarea
            className="input min-h-16"
            value={s.description ?? ""}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold">Ações</h2>
          <p className="muted">Botões que o jogador vai ver no exercício. A ação padrão vale para as mãos não pintadas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {legend.map((action) => (
            <label key={action.id} className="flex items-center gap-2 rounded-md bg-zinc-950 px-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={s.actionIds.includes(action.id)}
                onChange={() => update({ actionIds: toggle(s.actionIds, action.id) })}
              />
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: action.color }} />
              {action.label}
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Ação padrão</label>
            <select
              className="input"
              value={s.defaultActionId}
              onChange={(e) => update({ defaultActionId: e.target.value })}
            >
              {legend
                .filter((a) => s.actionIds.includes(a.id))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Só acontece depois de (em drills com várias decisões)</label>
            <div className="flex flex-wrap gap-2">
              {legend.map((action) => (
                <label key={action.id} className="flex items-center gap-1.5 rounded-md bg-zinc-950 px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={s.entryActionIds?.includes(action.id) ?? false}
                    onChange={() => update({ entryActionIds: toggle(s.entryActionIds, action.id) })}
                  />
                  {action.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Ex.: segundo barril só depois de cbet. Nada marcado = qualquer ação que continue a mão.
            </p>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <div>
          <h2 className="font-semibold">Mãos sorteadas</h2>
          <p className="muted">
            Para spots que só acontecem com parte das mãos (ex.: vs 3-bet só com o que você abriu), sorteie apenas do
            range de outra estratégia.
          </p>
        </div>
        <select
          className="input max-w-lg"
          value={s.dealFrom?.strategyId ?? ""}
          onChange={(e) => {
            const source = strategies.find((x) => x.id === e.target.value);
            update({
              dealFrom: source
                ? { strategyId: source.id, actionIds: source.actionIds.filter((id) => id !== source.defaultActionId) }
                : null,
            });
          }}
        >
          <option value="">Todas as mãos</option>
          {strategies
            .filter((x) => x.street === "preflop" && x.id !== s.id)
            .map((x) => (
              <option key={x.id} value={x.id}>
                Só do range de: {x.name}
              </option>
            ))}
        </select>
        {s.dealFrom && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">Com as ações:</span>
            {legend
              .filter((a) => strategies.find((x) => x.id === s.dealFrom?.strategyId)?.actionIds.includes(a.id))
              .map((action) => (
                <label key={action.id} className="flex items-center gap-1.5 rounded-md bg-zinc-950 px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={s.dealFrom?.actionIds.includes(action.id) ?? false}
                    onChange={() =>
                      s.dealFrom && update({ dealFrom: { ...s.dealFrom, actionIds: toggle(s.dealFrom.actionIds, action.id) } })
                    }
                  />
                  {action.label}
                </label>
              ))}
          </div>
        )}
      </div>

      {s.street === "preflop" ? (
        <div className="card space-y-3">
          <h2 className="font-semibold">Range</h2>
          <RangePainter
            range={s.range}
            alsoCorrect={s.alsoCorrect}
            onChange={(range) => update({ range, alsoCorrect: pruneAlsoCorrect(s.alsoCorrect, s.range, range) })}
            legend={legend}
            actionIds={s.actionIds}
            defaultActionId={s.defaultActionId}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold">Ranges por textura</h2>
            <p className="muted">
              O board sorteado usa a primeira textura da lista que combinar. Coloque as mais específicas em cima e
              deixe uma &quot;Geral&quot; (sem filtros) por último, se quiser cobrir todos os boards.
            </p>
          </div>
          {s.textureRanges.map((tr, index) => (
            <div key={tr.id} className="card space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input max-w-xs"
                  value={tr.label}
                  onChange={(e) => setTexture(index, { label: e.target.value })}
                />
                <span className="text-xs text-zinc-500">#{index + 1}</span>
                <div className="ml-auto flex gap-1">
                  <button type="button" className="btn-secondary px-2 py-1" onClick={() => moveTexture(index, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn-secondary px-2 py-1" onClick={() => moveTexture(index, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1"
                    onClick={() =>
                      update({
                        textureRanges: [
                          ...s.textureRanges.slice(0, index + 1),
                          { ...tr, id: `t-${Date.now().toString(36)}`, label: `${tr.label} (cópia)` },
                          ...s.textureRanges.slice(index + 1),
                        ],
                      })
                    }
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    className="btn-danger px-2 py-1"
                    onClick={() => update({ textureRanges: s.textureRanges.filter((_, i) => i !== index) })}
                  >
                    Remover
                  </button>
                </div>
              </div>
              <TextureMatchEditor match={tr.match} onChange={(match) => setTexture(index, { match })} />
              <RangePainter
                range={tr.range}
                onChange={(range) => setTexture(index, { range })}
                legend={legend}
                actionIds={s.actionIds}
                defaultActionId={s.defaultActionId}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              update({
                textureRanges: [
                  ...s.textureRanges,
                  { id: `t-${Date.now().toString(36)}`, label: `Textura ${s.textureRanges.length + 1}`, match: {}, range: {} },
                ],
              })
            }
          >
            Adicionar textura
          </button>
        </div>
      )}

      {problems.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-400">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando..." : "Salvar estratégia"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancelar
        </button>
        {strategy && (
          <button type="button" className="btn-danger ml-auto" onClick={remove} disabled={pending}>
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
