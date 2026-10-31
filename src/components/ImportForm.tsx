"use client";

import { useMemo, useState, useTransition } from "react";
import { importBundle } from "@/app/(app)/admin/importar/actions";
import { IMPORT_EXAMPLE } from "@/lib/import-example";
import type { ActionResult } from "@/lib/format";
import { parseImportBundle } from "@/lib/poker/importer";
import type { Legend } from "@/lib/poker/legend";
import { STREET_LABELS, type Strategy } from "@/lib/poker/strategy";

export function ImportForm({ legend, strategies }: { legend: Legend; strategies: Strategy[] }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return parseImportBundle(JSON.parse(text), legend, strategies);
    } catch {
      return { legend: null, strategies: [], drills: [], errors: ["JSON inválido: confira vírgulas, aspas e chaves."] };
    }
  }, [text, legend, strategies]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setText(JSON.stringify(IMPORT_EXAMPLE, null, 2))}
        >
          Carregar exemplo
        </button>
        <label className="btn-secondary cursor-pointer">
          Abrir arquivo .json
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setText(await file.text());
            }}
          />
        </label>
      </div>
      <textarea
        className="input min-h-80 font-mono text-xs"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        placeholder='{ "strategies": [...], "drills": [...] }'
        spellCheck={false}
      />

      {preview && (
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Prévia</h2>
          {preview.errors.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-red-400">
              {preview.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="text-green-400">Tudo certo para importar.</p>
          )}
          {preview.legend && <p>Legenda com {preview.legend.length} ações (substitui a atual).</p>}
          {preview.strategies.length > 0 && (
            <div>
              <p className="text-zinc-400">Estratégias ({preview.strategies.length}):</p>
              <ul className="pl-4">
                {preview.strategies.map((s) => (
                  <li key={s.id}>
                    {STREET_LABELS[s.street] ?? s.street} · {s.name} <span className="text-zinc-500">({s.id})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.drills.length > 0 && (
            <div>
              <p className="text-zinc-400">Drills ({preview.drills.length}):</p>
              <ul className="pl-4">
                {preview.drills.map((d) => (
                  <li key={d.id}>
                    {d.name} <span className="text-zinc-500">({d.variants ? `${d.variants.length} variações` : `${d.steps.length} decisão/ões`})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {result && (
        <p className={`text-sm ${result.ok ? "text-green-400" : "text-red-400"}`}>
          {result.ok ? result.message : result.error}
        </p>
      )}
      <button
        type="button"
        className="btn-primary"
        disabled={pending || !preview || preview.errors.length > 0}
        onClick={() => startTransition(async () => setResult(await importBundle(text)))}
      >
        {pending ? "Importando..." : "Importar"}
      </button>
    </div>
  );
}
