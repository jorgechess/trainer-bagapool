"use client";

import { POSITIONS } from "@/lib/poker/strategy";

interface PositionChipsProps {
  /** Posições que podem ser escolhidas; as outras aparecem apagadas. */
  available: readonly string[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  label?: string;
  /** Mostra o botão "Todas" (seleção vazia = todas). */
  allowAll?: boolean;
}

/** Botões de posição no estilo do GTO Wizard. */
export function PositionChips({ available, selected, onChange, label = "Hero", allowAll = true }: PositionChipsProps) {
  const all = allowAll && selected.length === 0;
  function toggle(position: string) {
    const next = selected.includes(position) ? selected.filter((p) => p !== position) : [...selected, position];
    onChange(POSITIONS.filter((p) => next.includes(p)));
  }
  const base = "rounded-md px-2.5 py-1 text-xs font-semibold transition";
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 text-xs text-zinc-400">{label}</span>
      {allowAll && (
        <button
          type="button"
          onClick={() => onChange([])}
          className={`${base} ${all ? "bg-zinc-200 text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
          aria-pressed={all}
        >
          Todas
        </button>
      )}
      {POSITIONS.map((position) => {
        const enabled = available.includes(position);
        const on = enabled && selected.includes(position);
        return (
          <button
            key={position}
            type="button"
            disabled={!enabled}
            onClick={() => toggle(position)}
            className={`${base} ${
              on
                ? "bg-zinc-200 text-black"
                : enabled
                  ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  : "cursor-not-allowed bg-zinc-900 text-zinc-600"
            }`}
            aria-pressed={on}
          >
            {position}
          </button>
        );
      })}
    </div>
  );
}
