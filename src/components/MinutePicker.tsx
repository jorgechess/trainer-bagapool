"use client";

import { useEffect, useRef, useState } from "react";

const ITEM = 44;

interface MinutePickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

/**
 * Seletor numérico em rolo vertical (como o relógio do celular): rola com o dedo, a roda do mouse ou
 * as setas; clicar no número do meio abre o campo para digitar.
 */
export function MinutePicker({ value, onChange, min = 1, max = 60, label = "Minutos" }: MinutePickerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  /** Abriu o campo com um dígito: o cursor fica no fim para continuar digitando. */
  const selectOnOpen = useRef(true);
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));

  // Valor mudou por fora (digitado, setas): leva o rolo até ele
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = (value - min) * ITEM;
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTo({ top: target, behavior: "smooth" });
  }, [value, min]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = (value - min) * ITEM;
    return () => {
      if (settle.current) clearTimeout(settle.current);
    };
    // Só na montagem: posiciona sem animação
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = scroller.current;
      if (!el) return;
      const next = clamp(min + el.scrollTop / ITEM);
      if (next !== value) onChange(next);
    }, 90);
  };

  const commit = () => {
    const n = Number(draft.replace(",", "."));
    if (Number.isFinite(n) && draft.trim() !== "") onChange(clamp(n));
    setEditing(false);
  };

  return (
    <div className="relative h-[132px] w-20 select-none" data-testid="warmup-minutos">
      {/* Faixa do valor escolhido */}
      <div className="pointer-events-none absolute inset-x-0 top-[44px] h-[44px] rounded-lg border border-baga-red/70 bg-baga-red/10" />
      <div
        ref={scroller}
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") onChange(clamp(value - 1));
          else if (event.key === "ArrowDown") onChange(clamp(value + 1));
          else if (event.key === "Enter" || /^\d$/.test(event.key)) {
            selectOnOpen.current = !/^\d$/.test(event.key);
            setDraft(/^\d$/.test(event.key) ? event.key : String(value));
            setEditing(true);
          } else return;
          event.preventDefault();
        }}
        className="h-full snap-y snap-mandatory overflow-y-scroll rounded-lg bg-zinc-900 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-baga-cream [&::-webkit-scrollbar]:hidden"
        style={{ paddingBlock: ITEM, maskImage: "linear-gradient(transparent, black 30%, black 70%, transparent)" }}
      >
        {values.map((n) => (
          <button
            key={n}
            type="button"
            tabIndex={-1}
            onClick={() => {
              if (n === value) {
                selectOnOpen.current = true;
                setDraft(String(value));
                setEditing(true);
              } else onChange(n);
            }}
            className={`flex w-full snap-center items-center justify-center font-display tracking-wide transition ${
              n === value ? "text-3xl text-baga-cream" : "text-xl text-zinc-500"
            }`}
            style={{ height: ITEM }}
          >
            {n}
          </button>
        ))}
      </div>
      {editing && (
        <input
          autoFocus
          inputMode="numeric"
          aria-label={`${label} (digite)`}
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          onFocus={(event) => {
            if (selectOnOpen.current) event.target.select();
            else event.target.setSelectionRange(draft.length, draft.length);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setEditing(false);
          }}
          className="absolute inset-x-0 top-[44px] h-[44px] rounded-lg border border-baga-cream bg-zinc-950 text-center font-display text-3xl text-baga-cream outline-none"
          data-testid="warmup-minutos-input"
        />
      )}
    </div>
  );
}
