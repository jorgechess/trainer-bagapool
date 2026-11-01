"use client";

interface FilterChipsProps {
  label: string;
  options: readonly string[];
  /** Vazio = todas. */
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}

/** Botões de filtro (várias escolhas), com "Todas"; mesmo visual dos botões de posição. */
export function FilterChips({ label, options, selected, onChange }: FilterChipsProps) {
  const all = selected.length === 0;
  const base = "rounded-md px-2.5 py-1 text-xs font-semibold transition";
  function toggle(option: string) {
    const next = selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option];
    onChange(options.filter((o) => next.includes(o)));
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 text-xs text-zinc-400">{label}</span>
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={all}
        className={`${base} ${all ? "bg-zinc-200 text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
      >
        Todas
      </button>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            aria-pressed={on}
            className={`${base} ${on ? "bg-zinc-200 text-black" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
