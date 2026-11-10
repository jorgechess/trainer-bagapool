"use client";

import { useEffect, useRef, useState } from "react";
import { type PayLadder, formatMoney, payLadder } from "@/lib/poker/payjumps";
import type { Position, SpecialSpot } from "@/lib/poker/strategy";

const fmt = (n: number, digits = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

/** Cor da célula do Risk Premium: verde quando o fator < 1 (incentivo a pagar), vermelho quando > 1. */
function cellTone(factor: number): string {
  if (factor < 0.75) return "bg-emerald-500/45 text-emerald-50";
  if (factor < 0.95) return "bg-emerald-500/25 text-emerald-100";
  if (factor <= 1.05) return "bg-zinc-700/40 text-zinc-200";
  return "bg-red-500/25 text-red-100";
}

/**
 * Enunciado dos drills especiais (mãos rodadas no HRC): o torneio, o momento (restantes, ITM, blinds),
 * os pay jumps e, depois de responder, o que aconteceu na mão real. O Risk Premium fica atrás do botão RP
 * (acima da mesa) ou completo no "Visualizar spot". Stacks e bounties de cada lugar ficam na própria mesa.
 */
export function SpecialBrief({
  spot,
  hero,
  villain,
  answered,
  compact = false,
  payJumpsAside = false,
  onView,
}: {
  spot: SpecialSpot;
  hero: Position;
  villain?: Position | null;
  answered: boolean;
  /** Acima da mesa: torneio, pay jumps e botões RP / Visualizar spot. */
  compact?: boolean;
  /** Pay jumps num quadro vertical ao lado da mesa: a linha do enunciado só aparece em telas estreitas. */
  payJumpsAside?: boolean;
  onView?: () => void;
}) {
  const t = spot.tournament;
  const facts = [
    t.playersLeft && t.entrants ? `${fmt(t.playersLeft, 0)}/${fmt(t.entrants, 0)} restantes` : null,
    t.itm ? `${fmt(t.itm, 0)} ITM` : null,
    t.blinds ? `Blinds ${t.blinds}${t.ante ? ` (ante ${fmt(t.ante)}bb)` : ""}` : null,
    t.averageStack ? `Média ${fmt(t.averageStack, 1)}bb` : null,
  ].filter(Boolean);
  const rp = spot.riskPremium;
  const ladder = payLadder(spot.payouts, t.playersLeft);

  if (compact) {
    return (
      <section
        className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-baga-gold/30 bg-gradient-to-br from-zinc-900 to-black/60 px-3 py-2"
        data-testid="enunciado-especial"
        aria-label="Enunciado do spot"
      >
        {t.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logo} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight text-zinc-50">{t.name}</p>
          <p className="text-xs text-zinc-300">
            <span className="text-baga-gold">{[t.site, t.format, t.buyIn].filter(Boolean).join(" · ")}</span>
            {facts.length > 0 && ` · ${facts.join(" · ")}`}
          </p>
          {ladder && (
            <div className={payJumpsAside ? "md:hidden" : undefined}>
              <PayJumps ladder={ladder} compact />
            </div>
          )}
          {answered && spot.note && (
            <p className="mt-1 rounded-md bg-zinc-800/80 px-2 py-1 text-xs text-zinc-200" data-testid="nota-mao-real">
              {spot.note}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {rp && <RiskPremiumButton spot={spot} hero={hero} villain={villain} />}
          {onView && (
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={onView} data-testid="botao-visualizar-spot">
              Visualizar spot
            </button>
          )}
        </div>
      </section>
    );
  }
  return (
    <section
      className="grid gap-3 rounded-lg border border-baga-gold/30 bg-gradient-to-br from-zinc-900 to-black/60 p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
      data-testid="enunciado-especial-completo"
      aria-label="Enunciado do spot"
    >
      <div className="flex min-w-0 gap-3">
        {t.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logo} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
        )}
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold leading-tight text-zinc-50">{t.name}</h2>
          <p className="text-xs text-baga-gold">{[t.site, t.format, t.buyIn].filter(Boolean).join(" · ")}</p>
          {facts.length > 0 && <p className="text-xs text-zinc-300">{facts.join(" · ")}</p>}
          {spot.source && <p className="text-[11px] text-zinc-500">{spot.source}</p>}
          {answered && spot.note && (
            <p className="rounded-md bg-zinc-800/80 px-2 py-1 text-xs text-zinc-200" data-testid="nota-mao-real-completa">
              {spot.note}
            </p>
          )}
        </div>
      </div>

      {rp && (
        <div className="overflow-x-auto">
          <RiskPremiumTable spot={spot} hero={hero} villain={villain} />
        </div>
      )}

      {ladder && (
        <div className="lg:col-span-2">
          <PayJumps ladder={ladder} />
        </div>
      )}
    </section>
  );
}

/** Botão RP acima da mesa: abre a matriz de Risk Premium num painel por cima, sem empurrar a mesa. */
function RiskPremiumButton({ spot, hero, villain }: { spot: SpecialSpot; hero: Position; villain?: Position | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className={`btn-secondary px-3 py-1.5 text-sm font-semibold ${open ? "ring-2 ring-baga-gold" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Risk Premium"
        title="Risk Premium"
        data-testid="botao-rp"
      >
        RP
      </button>
      {open && (
        <div
          className="absolute top-full right-0 z-30 mt-2 max-w-[92vw] overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-950 p-3 shadow-2xl shadow-black/70"
          data-testid="painel-rp"
        >
          <RiskPremiumTable spot={spot} hero={hero} villain={villain} />
        </div>
      )}
    </div>
  );
}

function RiskPremiumTable({ spot, hero, villain }: { spot: SpecialSpot; hero: Position; villain?: Position | null }) {
  const rp = spot.riskPremium;
  if (!rp) return null;
  return (
    <>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Risk Premium (linha = quem decide)</p>
      <table className="border-separate border-spacing-0.5 text-center text-[11px] tabular-nums" data-testid="risk-premium">
        <thead>
          <tr>
            <th />
            {rp.positions.map((p) => (
              <th key={p} className={`px-1 font-semibold ${p === villain ? "text-baga-gold" : "text-zinc-400"}`}>
                {p}
                <span className="block font-normal text-zinc-500">{spot.stacks[p] !== undefined ? fmt(spot.stacks[p]!, 1) : ""}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rp.positions.map((row, i) => (
            <tr key={row}>
              <th className={`pr-1 text-left font-semibold whitespace-nowrap ${row === hero ? "text-baga-cream" : "text-zinc-400"}`}>
                {row === hero ? `${row} (você)` : row}
              </th>
              {rp.cells[i].map((cell, j) => {
                const col = rp.positions[j];
                const focus = row === hero && col === villain;
                return (
                  <td
                    key={col}
                    className={`rounded px-1 py-0.5 ${cell ? cellTone(cell.factor) : "bg-zinc-800/60"} ${
                      focus ? "ring-2 ring-baga-gold" : row === hero ? "ring-1 ring-zinc-500" : ""
                    }`}
                  >
                    {cell && (
                      <>
                        <span className="block font-semibold">
                          {cell.factor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="block opacity-80">
                          {cell.premium > 0 ? "+" : ""}
                          {cell.premium.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                        </span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * Escada de prêmios. Acima da mesa: do lugar garantido até o 1º, com o pay jump de cada degrau e o próximo
 * em destaque. No "Visualizar spot": a escada inteira, com os lugares já pagos apagados.
 */
function PayJumps({ ladder, compact = false }: { ladder: PayLadder; compact?: boolean }) {
  const money = (v: number) => formatMoney(v, ladder.currency);
  // Sobe da esquerda para a direita: do último lugar mostrado até o 1º
  const climb = [...ladder.steps]
    .filter((s) => !compact || s.status !== "pago")
    .sort((a, b) => b.place - a.place);
  if (compact) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs" data-testid="pay-jumps">
        <span className="mr-0.5 font-semibold text-zinc-400">Pay jumps</span>
        {climb.map((s, i) => {
          const isNext = ladder.next?.place === s.place;
          const below = climb[i - 1];
          const jump = below && below.prize !== null && s.prize !== null ? s.prize - below.prize : null;
          return (
            <span key={s.place} className="flex items-center gap-1">
              {i > 0 && <span className="text-zinc-600">›</span>}
              <span
                className={`rounded px-1.5 py-0.5 tabular-nums ${
                  isNext
                    ? "bg-baga-gold/20 text-baga-gold ring-1 ring-baga-gold/70"
                    : s.status === "garantido"
                      ? "bg-zinc-800 text-zinc-200"
                      : "bg-zinc-900 text-zinc-300"
                }`}
                data-testid={isNext ? "proximo-pay-jump" : undefined}
              >
                {s.place}º {s.prize !== null ? s.label : "?"}
                {jump !== null && <span className="ml-1 font-semibold">+{money(jump)}</span>}
                {s.status === "garantido" && <span className="ml-1 text-zinc-500">garantido</span>}
              </span>
            </span>
          );
        })}
      </p>
    );
  }
  return (
    <div data-testid="pay-jumps-completo">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Pay jumps</p>
      <ol className="flex flex-wrap items-stretch gap-1.5">
        {climb.map((s, i) => {
          const isNext = ladder.next?.place === s.place;
          const below = climb[i - 1];
          const jump = below && below.prize !== null && s.prize !== null ? s.prize - below.prize : null;
          return (
            <li
              key={s.place}
              className={`min-w-20 rounded-md border px-2 py-1 text-center tabular-nums ${
                isNext
                  ? "border-baga-gold bg-baga-gold/15"
                  : s.status === "garantido"
                    ? "border-zinc-500 bg-zinc-800"
                    : s.status === "pago"
                      ? "border-zinc-800 opacity-45"
                      : "border-zinc-700"
              }`}
            >
              <span className="block text-sm font-semibold text-zinc-100">{s.place}º</span>
              <span className="block text-xs text-zinc-300">{s.prize !== null ? s.label : "não informado"}</span>
              <span className={`block text-[11px] ${isNext ? "font-semibold text-baga-gold" : "text-zinc-500"}`}>
                {s.status === "garantido" ? "garantido" : jump !== null ? `+${money(jump)}` : " "}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Quadro vertical de pay jumps ao lado da mesa: 1º no topo, cada lugar com o prêmio e quanto se ganha
 * subindo até ele. O lugar garantido e o próximo pay jump ficam em destaque; os já pagos, apagados.
 */
export function PayJumpsPanel({ spot, className = "" }: { spot: SpecialSpot; className?: string }) {
  const ladder = payLadder(spot.payouts, spot.tournament.playersLeft);
  if (!ladder) return null;
  const money = (v: number) => formatMoney(v, ladder.currency);
  const left = spot.tournament.playersLeft;
  return (
    <aside
      className={`w-44 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 text-xs ${className}`}
      data-testid="quadro-pay-jumps"
      aria-label="Pay jumps"
    >
      <p className="px-1 font-semibold uppercase tracking-wide text-zinc-400">Pay jumps</p>
      {left ? <p className="mb-1.5 px-1 text-[11px] text-zinc-500">{left} restantes</p> : null}
      <ol className="space-y-0.5">
        {ladder.steps.map((s, i) => {
          const isNext = ladder.next?.place === s.place;
          const below = ladder.steps[i + 1];
          const jump = below && below.prize !== null && s.prize !== null ? s.prize - below.prize : null;
          return (
            <li
              key={s.place}
              className={`grid grid-cols-[2rem_1fr_auto] items-center gap-1 rounded px-1.5 py-1 tabular-nums ${
                isNext
                  ? "bg-baga-gold/15 ring-1 ring-baga-gold/70"
                  : s.status === "garantido"
                    ? "bg-zinc-800"
                    : s.status === "pago"
                      ? "opacity-40"
                      : ""
              }`}
              data-testid={isNext ? "quadro-proximo-pay-jump" : undefined}
            >
              <span className="font-semibold text-zinc-100">{s.place}º</span>
              <span className="text-zinc-200">{s.prize !== null ? s.label : "?"}</span>
              <span className={`text-right text-[11px] ${isNext ? "font-semibold text-baga-gold" : "text-zinc-500"}`}>
                {s.status === "garantido" ? "garantido" : jump !== null ? `+${money(jump)}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
