"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DRILL_SECTIONS, type DrillSectionId } from "@/lib/poker/sections";
import { LENGTH_KEY, LENGTH_OPTIONS } from "@/lib/session-length";

export interface DrillCard {
  id: string;
  name: string;
  description?: string;
  spot: string;
  tags: string[];
  handsPerSession: number;
  section: DrillSectionId;
}

const COLLAPSED_KEY = "trainer:secoes-fechadas";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // armazenamento indisponível: a preferência vale só nesta visita
  }
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
      <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Lista de drills por seção (Vanilla, PKO, BW, Pós-flop), com a escolha de mãos da sessão. */
export function DrillsBrowser({ drills }: { drills: DrillCard[] }) {
  const [length, setLength] = useState<number>(0);
  const [collapsed, setCollapsed] = useState<string[]>([]);

  useEffect(() => {
    const stored = Number(readStorage(LENGTH_KEY));
    if ((LENGTH_OPTIONS as readonly number[]).includes(stored)) setLength(stored);
    try {
      const parsed = JSON.parse(readStorage(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(parsed)) setCollapsed(parsed.filter((x) => typeof x === "string"));
    } catch {
      // preferência inválida: tudo aberto
    }
  }, []);

  function chooseLength(option: number) {
    setLength(option);
    writeStorage(LENGTH_KEY, String(option));
  }

  function toggle(section: string) {
    const next = collapsed.includes(section) ? collapsed.filter((s) => s !== section) : [...collapsed, section];
    setCollapsed(next);
    writeStorage(COLLAPSED_KEY, JSON.stringify(next));
  }

  // Se todos os drills têm o mesmo padrão, ele aparece como "N (padrão)" e não se repete na lista
  const defaults = [...new Set(drills.map((d) => d.handsPerSession))];
  const sharedDefault = defaults.length === 1 ? defaults[0] : null;
  const options = LENGTH_OPTIONS.filter((o) => o === 0 || o === -1 || o !== sharedDefault);

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-1.5 py-3" role="group" aria-label="Mãos da sessão">
        <span className="mr-1 text-xs text-zinc-400">Mãos por sessão</span>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => chooseLength(option)}
            aria-pressed={length === option}
            title={option === 0 ? "Quantidade definida em cada drill" : option === -1 ? "Até clicar em Encerrar sessão" : undefined}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              length === option ? "bg-zinc-200 text-black" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {option === 0 ? (sharedDefault ? `${sharedDefault} (padrão)` : "Padrão do drill") : option === -1 ? "Sem limite" : option}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-zinc-500 sm:inline">Vale para todos os drills; dá para trocar no treino.</span>
      </div>

      {DRILL_SECTIONS.map(({ id, label }) => {
        const items = drills.filter((d) => d.section === id);
        if (items.length === 0) return null;
        const open = !collapsed.includes(id);
        return (
          <section key={id} className="space-y-3" data-testid={`secao-${id}`}>
            <button
              type="button"
              onClick={() => toggle(id)}
              aria-expanded={open}
              className="flex w-full items-center gap-2 border-b border-zinc-800 pb-2 text-left"
            >
              <Chevron open={open} />
              <h2 className="font-display text-2xl tracking-wide text-baga-cream">{label}</h2>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{items.length}</span>
            </button>
            {open && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((drill) => (
                  <div key={drill.id} className="card flex flex-col gap-3" data-testid="drill-card">
                    <div>
                      <h3 className="font-semibold">{drill.name}</h3>
                      {drill.description && <p className="muted mt-1">{drill.description}</p>}
                    </div>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="text-zinc-400">Spot inicial</span>
                      <span className="text-right">{drill.spot}</span>
                    </div>
                    {drill.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {drill.tags.map((tag) => (
                          <span key={tag} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-auto pt-2">
                      <Link href={`/drills/${drill.id}/treinar`} className="btn-primary w-full">
                        Treinar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
