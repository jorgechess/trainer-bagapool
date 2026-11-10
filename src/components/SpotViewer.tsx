"use client";

import { useEffect, useRef } from "react";
import { RangeGrid } from "@/components/RangeGrid";
import { SpecialBrief } from "@/components/SpecialBrief";
import { type Legend, findAction, textColorFor } from "@/lib/poker/legend";
import { rangeBreakdown } from "@/lib/poker/range";
import { type Strategy, positionLabel } from "@/lib/poker/strategy";

/**
 * "Visualizar Spot" dos drills especiais: o enunciado completo (torneio, payouts, Risk Premium) e os ranges
 * do HRC de todos os spots da mesma mão. O range do spot que você está respondendo só abre depois da resposta.
 */
export function SpotViewer({
  strategy,
  related,
  legend,
  answered,
  open,
  onClose,
}: {
  strategy: Strategy;
  related: Strategy[];
  legend: Legend;
  answered: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  if (!strategy.special) return null;
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[min(1100px,96vw)] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-0 text-zinc-100 backdrop:bg-black/70"
      data-testid="visualizar-spot"
      aria-label="Visualizar spot"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3">
        <h2 className="font-display text-2xl tracking-wide">Visualizar spot</h2>
        <button type="button" className="btn-secondary px-3 py-1.5" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div className="space-y-5 p-4">
        <SpecialBrief spot={strategy.special} hero={strategy.heroPosition} villain={strategy.villainPosition} answered={answered} />
        <div className="grid gap-4 md:grid-cols-2">
          {related.map((s) => {
            const current = s.id === strategy.id;
            const hidden = current && !answered;
            return (
              <section key={s.id} className={`space-y-2 rounded-lg border p-3 ${current ? "border-baga-gold/60" : "border-zinc-800"}`}>
                <h3 className="text-sm font-semibold">
                  Range do {positionLabel(s.heroPosition, s.special)} ({s.stack.min.toLocaleString("pt-BR")}bb)
                  <span className="font-normal text-zinc-400">
                    {s.villainPosition ? ` vs open do ${positionLabel(s.villainPosition, s.special)}` : " · first in"}
                  </span>
                  {current && <span className="ml-2 text-xs text-baga-gold">(este spot)</span>}
                </h3>
                <p className="text-xs text-zinc-400">{s.description}</p>
                {hidden ? (
                  <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-500">
                    Responda para ver o range deste spot
                  </div>
                ) : (
                  <>
                    <ActionShares strategy={s} legend={legend} />
                    <RangeGrid range={s.range} defaultActionId={s.defaultActionId} legend={legend} alsoCorrect={s.alsoCorrect} compact />
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}

/** Legenda do range com a fatia de cada ação (% das 1326 combinações), como no cabeçalho do HRC. */
function ActionShares({ strategy, legend }: { strategy: Strategy; legend: Legend }) {
  const shares = new Map(rangeBreakdown(strategy.range, strategy.defaultActionId).map((a) => [a.actionId, a.percent]));
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="legenda-range">
      {strategy.actionIds.map((id) => {
        const action = findAction(legend, id);
        if (!action) return null;
        return (
          <span
            key={id}
            className="rounded px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: action.color, color: textColorFor(action.color) }}
          >
            {action.label} {(shares.get(id) ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
        );
      })}
    </div>
  );
}
